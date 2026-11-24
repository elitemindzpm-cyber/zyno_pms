// server/services/finance.ts
// Sub-ledger reconciliation, asset depreciation and asset disposal.
import prisma from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { num, money } from './leases';
import { postGlEvent } from './posting';

// ── Reconciliation ──────────────────────────────────────────────────────────────
/**
 * Control-account reconciliation.
 *   subledger_total = Σ balances of the sub-ledger accounts under the control account
 *   gl_balance      = balance posted to the control account itself + subledger_total
 *   variance        = gl_balance − subledger_total  (= amounts posted directly to the control account)
 * Every control-account posting should carry a sub-ledger, so a zero variance is the expected state.
 */
export async function reconcileControl(controlCode: string) {
  const control = await prisma.fin_coa_accounts.findFirst({ where: { account_code: controlCode } });
  if (!control) throw new HttpError(404, `Control account ${controlCode} was not found`);
  const children = await prisma.fin_coa_accounts.findMany({ where: { parent_account_id: control.id } });
  const ids = [control.id, ...children.map((c) => c.id)];

  const sums = await prisma.fin_voucher_lines.groupBy({
    by: ['account_id'],
    where: { account_id: { in: ids } },
    _sum: { debit_amount: true, credit_amount: true },
    _count: { _all: true },
  });
  const balanceOf = (accountId: string) => {
    const s = sums.find((x) => x.account_id === accountId);
    return money(num(s?._sum.debit_amount) - num(s?._sum.credit_amount));
  };

  const direct = sums.find((x) => x.account_id === control.id);
  const directBalance = balanceOf(control.id);
  const subledgers = children.map((c) => ({
    account_code: c.account_code,
    account_name: c.account_name,
    balance: balanceOf(c.id),
  }));
  const subledgerTotal = money(subledgers.reduce((s, x) => s + x.balance, 0));
  const glBalance = money(directBalance + subledgerTotal);
  return {
    control_account: control.account_code,
    control_name: control.account_name,
    gl_balance: glBalance,
    subledger_total: subledgerTotal,
    variance: money(glBalance - subledgerTotal),
    direct_postings: direct?._count._all ?? 0,
    subledgers,
  };
}

// ── Assets ──────────────────────────────────────────────────────────────────────
// Live chart: 51106 Depreciation & Amortisation (expense), 11000 PPE (accumulated depreciation and cost),
// 41301 Gain/Loss on sale of fixed assets, 12000 Bank.
const DEP_EXPENSE = '51106';
const PPE = '11000';
const GAIN_LOSS = '41301';
const BANK = '12000';

const periodEnd = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 12));   // last day of the month
};

/** Straight-line depreciation for one month. life_of_asset is in years; the charge never takes NBV below salvage. */
export async function depreciateAsset(assetId: string, period?: string) {
  const per = period ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(per)) throw new HttpError(400, 'period must be YYYY-MM');
  const asset = await prisma.assets.findUnique({ where: { id: assetId } });
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (String(asset.asset_status || '').toLowerCase() === 'disposed') throw new HttpError(409, 'Disposed assets are not depreciated');
  const years = Number(asset.life_of_asset);
  if (!(years > 0)) throw new HttpError(400, 'Asset has no useful life set (life_of_asset)');

  const cost = num(asset.purchase_cost);
  const salvage = num(asset.salvage_value);
  const accumulated = num(asset.closing_accumulated_depreciation);
  const nbvBefore = money(cost - accumulated);
  const monthly = money((cost - salvage) / (years * 12));
  const amount = money(Math.max(0, Math.min(monthly, nbvBefore - salvage)));
  if (amount <= 0) throw new HttpError(409, 'Asset is fully depreciated to salvage value');

  const posted = await postGlEvent({
    eventType: 'MANUAL_JOURNAL', sourceType: 'DEPRECIATION', sourceId: assetId,
    idempotencyKey: `dep:${assetId}:${per}`, description: `Depreciation ${per} - ${asset.asset_name}`,
    postingDate: periodEnd(per),
    lines: [
      { code: DEP_EXPENSE, debit: amount, credit: 0 },
      { code: PPE, debit: 0, credit: amount },
    ],
  });
  if (posted.duplicate) throw new HttpError(409, `Depreciation for ${per} has already been posted`);

  const newAccumulated = money(accumulated + amount);
  const nbv = money(cost - newAccumulated);
  await prisma.assets.update({
    where: { id: assetId },
    data: { closing_accumulated_depreciation: newAccumulated, net_book_value: nbv, current_year_depreciation: { increment: amount } },
  });
  return { asset_id: assetId, period: per, amount, accumulated_depreciation: newAccumulated, net_book_value: nbv, voucher: posted.voucherNumber };
}

/**
 * Disposal at sale_price. The cost and accumulated depreciation are removed, the sale proceeds are
 * banked, and the difference against NBV goes to the gain/loss account.
 */
export async function disposeAsset(assetId: string, input: { sale_price?: unknown; disposal_date?: string }) {
  const asset = await prisma.assets.findUnique({ where: { id: assetId } });
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (String(asset.asset_status || '').toLowerCase() === 'disposed') throw new HttpError(409, 'Asset is already disposed');

  const cost = money(num(asset.purchase_cost));
  const accumulated = money(num(asset.closing_accumulated_depreciation));
  const nbv = money(cost - accumulated);
  const sale = money(num(input.sale_price));
  const gain = money(sale - nbv);
  const date = input.disposal_date ? new Date(`${input.disposal_date}`.slice(0, 10) + 'T12:00:00Z') : new Date();

  const lines: { code: string; debit: number; credit: number }[] = [];
  if (sale > 0) lines.push({ code: BANK, debit: sale, credit: 0 });
  if (accumulated > 0) lines.push({ code: PPE, debit: accumulated, credit: 0 });
  lines.push({ code: PPE, debit: 0, credit: cost });
  if (gain > 0) lines.push({ code: GAIN_LOSS, debit: 0, credit: gain });
  if (gain < 0) lines.push({ code: GAIN_LOSS, debit: -gain, credit: 0 });

  const posted = await postGlEvent({
    eventType: 'MANUAL_JOURNAL', sourceType: 'ASSET_DISPOSAL', sourceId: assetId,
    idempotencyKey: `dispose:${assetId}`, description: `Disposal - ${asset.asset_name}`,
    postingDate: date, lines,
  });

  await prisma.assets.update({
    where: { id: assetId },
    data: {
      asset_status: 'Disposed', disposal_value: sale, disposal_date: date,
      net_book_value: 0, closing_accumulated_depreciation: 0,
    },
  });
  return {
    asset_id: assetId, net_book_value_at_disposal: nbv, sale_price: sale,
    gain_on_disposal: gain > 0 ? gain : 0, loss_on_disposal: gain < 0 ? -gain : 0, voucher: posted.voucherNumber,
  };
}
