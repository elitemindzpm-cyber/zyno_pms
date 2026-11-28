/**
 * Final Settlement & Lease Closure Engine
 *
 * Implements the complete master logic for:
 *   1. Calculating final tenant liabilities & balance:
 *      Refundable Deposit - (Rent + Utilities + Damage + Penalties + Other) = Refund or Recovery
 *   2. Step-by-step or atomic Posting of settlement transactions:
 *      - Move 21500 to 21100006
 *      - Recognize damage/penalty/utility charges into AR (12413)
 *      - Settle AR against 21100006
 *      - Post final bank/cash refund
 *   3. Unclaimed deposit transfer & redemption (21100006 <-> 21100002)
 *   4. Early termination future PDC identification and return
 *   5. Reservation advance applications and forfeitures
 *   6. Guarantee cheque returns
 */

import { db } from '../db';
import { request as apiRequest } from '../api-client';
import { resolveAccountingAccounts, normalizeUuid } from './account-resolver';
import { type PostingResult } from './posting-engine';
import { returnPdc } from './pdcService';

// ── Types ─────────────────────────────────────────────────────────────────────

import type { DepositType } from './account-resolver';

export type SettlementDeduction = {
  type: 'RENT' | 'UTILITY' | 'DAMAGE' | 'PENALTY' | 'OTHER';
  description: string;
  amount: number;
  /** If the charge is already invoiced into AR (12413), set to true */
  alreadyInvoiced?: boolean;
};

/**
 * Per-category deposit breakdown. Source-account driven settlement uses the
 * deposit's GL/SL code (21500 for SECURITY, 21100003 Qatar Cool, 21100004
 * Kahramaa, 21100005 Service Fee) as the deduction source.
 */
export type SettlementDepositLine = {
  depositType: DepositType;
  amount: number;
};

export type FinalSettlementInput = {
  leaseId: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  unitName?: string;
  /**
   * Total deposit amount held (used for backward-compat single-bucket settlement).
   * If `deposits` is supplied, this is ignored.
   */
  depositAmount: number;
  /**
   * Multi-category deposit breakdown. When present, each bucket is settled from
   * its own source GL/SL (21500, 21100003, 21100004, 21100005).
   */
  deposits?: SettlementDepositLine[];
  deductions: SettlementDeduction[];
  paymentMethod?: 'BANK' | 'CASH';
  referenceNo?: string;
  settlementDate?: string;
  settlementMode?: 'DEDUCT_FROM_DEPOSIT' | 'PAY_SEPARATELY';
  damagePaymentMethod?: 'BANK' | 'CASH' | 'CHEQUE';
};

export type SettlementSummary = {
  depositAmount: number;
  totalDeductions: number;
  netRefundAmount: number;
  netRecoveryAmount: number;
  isRefund: boolean;
};

// ── Master Calculation ────────────────────────────────────────────────────────

/**
 * Calculates the exact settlement figures without posting entries.
 */
export function calculateSettlementSummary(
  depositAmount: number,
  deductions: SettlementDeduction[],
): SettlementSummary {
  const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const net = depositAmount - totalDeductions;

  return {
    depositAmount,
    totalDeductions,
    netRefundAmount: net > 0 ? Number(net.toFixed(2)) : 0,
    netRecoveryAmount: net < 0 ? Number(Math.abs(net).toFixed(2)) : 0,
    isRefund: net >= 0,
  };
}

async function resolveLeaseFinanceContext(params: {
  leaseId: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
}) {
  let tenantId = params.tenantId;
  let propertyId = params.propertyId;
  let unitId = params.unitId;
  let leaseUuid = params.leaseId;

  if (!tenantId || !propertyId || !unitId || !normalizeUuid(params.leaseId)) {
    try {
      const lookup = normalizeUuid(params.leaseId)
        ? db.from('leases').select('id, customer_id, property_id, unit_id').eq('id', params.leaseId).maybeSingle()
        : db.from('leases').select('id, customer_id, property_id, unit_id').eq('lease_number', params.leaseId).maybeSingle();
      const { data: leaseRow } = await lookup;
      if (leaseRow) {
        leaseUuid = String(leaseRow.id);
        tenantId = tenantId || (leaseRow.customer_id ? String(leaseRow.customer_id) : undefined);
        propertyId = propertyId || (leaseRow.property_id ? String(leaseRow.property_id) : undefined);
        unitId = unitId || (leaseRow.unit_id ? String(leaseRow.unit_id) : undefined);
      }
    } catch (e) {
      // best-effort
    }
  }

  // No placeholder fallbacks: a settlement must be posted against a real lease, tenant, property and unit.
  const ids = {
    leaseUuid: normalizeUuid(leaseUuid),
    tenantId: normalizeUuid(tenantId),
    propertyId: normalizeUuid(propertyId),
    unitId: normalizeUuid(unitId),
  };
  if (!ids.leaseUuid || !ids.tenantId || !ids.propertyId || !ids.unitId) {
    throw new Error('Cannot post the settlement: the lease, tenant, property or unit could not be resolved to a real record.');
  }
  return ids as { leaseUuid: string; tenantId: string; propertyId: string; unitId: string };
}

// ── Master Settlement Execution ───────────────────────────────────────────────

/**
 * Executes the complete Final Settlement flow:
 *   1. Validates all inputs and balances
 *   2. Moves each deposit bucket from its source GL to its refundable counterpart
 *      (21500 → 21100006, 21100003 → 21100006, 21100004 → 21100006, 21100005 → 21100006).
 *      If no `deposits` breakdown is supplied, falls back to a single SECURITY bucket.
 *   3. For uninvoiced deductions: recognizes them via AR (12413 Dr / Revenue Cr)
 *   4. Settle AR against each deposit bucket (capped at the bucket amount —
 *      excess stays in AR so deposit balances never go negative)
 *   5. Issues bank/cash refund for remaining positive balance
 */
export async function executeFinalSettlement(
  input: FinalSettlementInput,
): Promise<{
  summary: SettlementSummary;
  vouchers: PostingResult[];
}> {
  const dateStr = input.settlementDate || new Date().toISOString().split('T')[0];
  const context = await resolveLeaseFinanceContext(input);
  const financeInput = { ...input, leaseId: context.leaseUuid, tenantId: context.tenantId, propertyId: context.propertyId, unitId: context.unitId };

  // Resolve deposit buckets (multi-category if supplied, else single SECURITY).
  const depositBuckets: SettlementDepositLine[] =
    financeInput.deposits && financeInput.deposits.length > 0
      ? financeInput.deposits.filter((d) => d.amount > 0)
      : financeInput.depositAmount > 0
        ? [{ depositType: 'SECURITY', amount: financeInput.depositAmount }]
        : [];

  const totalDeposit = depositBuckets.reduce((s, d) => s + d.amount, 0);
  const settlementMode = financeInput.settlementMode ?? 'DEDUCT_FROM_DEPOSIT';
  const baseSummary = calculateSettlementSummary(totalDeposit, financeInput.deductions);
  const summary: SettlementSummary = settlementMode === 'PAY_SEPARATELY'
    ? { ...baseSummary, netRefundAmount: Number(totalDeposit.toFixed(2)), netRecoveryAmount: 0, isRefund: true }
    : baseSummary;
  const vouchers: PostingResult[] = [];
  // Vouchers are queued here and posted together, in one server transaction, at the end.
  const queue: Array<{ voucher_date: string; voucher_type: string; reference_no?: string; description: string; lines: Array<{ account_code: string; debit: number; credit: number; description?: string }> }> = [];
  const queueVoucher = (v: any) => {
    queue.push({
      voucher_date: v.voucher_date,
      voucher_type: v.voucher_type,
      reference_no: v.reference_no,
      description: v.description,
      lines: (v.lines || []).map((l: any) => ({ account_code: l.account_code, debit: Number(l.debit || 0), credit: Number(l.credit || 0), description: l.description })),
    });
    return {} as PostingResult;
  };

  // 1. (removed) The deposit is no longer reclassified to a refundable account first. The entries sheet settles
  //    straight from the deposit ledger (Dr 21500 / Cr Bank). The old reclass debited 21500 and credited 21100,
  //    but the offset and refund below debit 21500 again, so 21500 went negative and 21100 never cleared.

  // 2. Recognize non-invoiced charges into AR (12413)
  for (const deduction of financeInput.deductions) {
    if (!deduction.alreadyInvoiced && deduction.amount > 0) {
      let txnType: 'DAMAGE_CHARGE' | 'PENALTY_CHARGE' | 'UTILITY_CHARGE' = 'DAMAGE_CHARGE';
      if (deduction.type === 'PENALTY') txnType = 'PENALTY_CHARGE';
      else if (deduction.type === 'UTILITY') txnType = 'UTILITY_CHARGE';

      const { debit: drChg, credit: crChg } = await resolveAccountingAccounts({
        transactionType: txnType,
        propertyId: financeInput.propertyId,
        unitId: financeInput.unitId,
        tenantId: financeInput.tenantId,
        leaseId: financeInput.leaseId,
        unitName: financeInput.unitName,
      });

      const vchChg = queueVoucher({
        voucher_date: dateStr,
        voucher_type: 'Journal',
        description: `Final Settlement Charge: ${deduction.description}`,
        tenant_id: financeInput.tenantId,
        property_id: financeInput.propertyId,
        unit_id: financeInput.unitId,
        lease_id: financeInput.leaseId,
        lines: [
          {
            account_code: drChg.slCode,
            account_name: `${drChg.glName} / ${drChg.slName}`,
            debit: deduction.amount,
            credit: 0,
            description: deduction.description,
          },
          {
            account_code: crChg.slCode,
            account_name: `${crChg.glName} / ${crChg.slName}`,
            debit: 0,
            credit: deduction.amount,
            description: crChg.slName,
          },
        ],
      });
      vouchers.push(vchChg);
    }
  }

  // 3. Settle Deductions against the deposit buckets (waterfall: consume each
  //    bucket in order, capping at its available balance). Excess stays in
  //    Tenant AR — deposit balances never go negative.
  let remainingDeductions = summary.totalDeductions;
  const appliedByBucket = new Map<SettlementDepositLine, number>();
  for (const bucket of depositBuckets) {
    if (remainingDeductions <= 0) break;
    const applied = Math.min(bucket.amount, remainingDeductions);
    if (applied <= 0) continue;

    const { debit: drSettle, credit: crSettle } = await resolveAccountingAccounts({
      transactionType: 'DEPOSIT_DEDUCTION_SETTLE',
      depositType: bucket.depositType,
      propertyId: financeInput.propertyId,
      unitId: financeInput.unitId,
      tenantId: financeInput.tenantId,
      leaseId: financeInput.leaseId,
      unitName: financeInput.unitName,
    });

    const vchSettle = queueVoucher({
      voucher_date: dateStr,
      voucher_type: 'Journal',
      description: `Final Settlement: Offset Dues against ${bucket.depositType} Deposit`,
      tenant_id: financeInput.tenantId,
      property_id: financeInput.propertyId,
      unit_id: financeInput.unitId,
      lease_id: financeInput.leaseId,
      lines: [
        {
          account_code: drSettle.slCode,
          account_name: `${drSettle.glName} / ${drSettle.slName}`,
          debit: applied,
          credit: 0,
          description: drSettle.slName,
        },
        {
          account_code: crSettle.slCode,
          account_name: `${crSettle.glName} / ${crSettle.slName}`,
          debit: 0,
          credit: applied,
          description: `Offset Tenant Dues – ${crSettle.slName}`,
        },
      ],
    });
    vouchers.push(vchSettle);
    appliedByBucket.set(bucket, applied);
    remainingDeductions -= applied;
  }

  if (settlementMode === 'PAY_SEPARATELY' && summary.totalDeductions > 0) {
    const paymentMethod = financeInput.damagePaymentMethod ?? 'BANK';
    const { debit: drCollect, credit: crCollect } = await resolveAccountingAccounts({
      transactionType: 'RENT_RECEIPT',
      paymentMethod,
      propertyId: financeInput.propertyId,
      unitId: financeInput.unitId,
      tenantId: financeInput.tenantId,
      leaseId: financeInput.leaseId,
      unitName: financeInput.unitName,
    });

    const vchCollect = queueVoucher({
      voucher_date: dateStr,
      voucher_type: 'Receipt',
      description: `Final Settlement: Tenant Dues Paid Separately`,
      reference_no: financeInput.referenceNo ? `COLLECT-${financeInput.referenceNo}` : undefined,
      tenant_id: financeInput.tenantId,
      property_id: financeInput.propertyId,
      unit_id: financeInput.unitId,
      lease_id: financeInput.leaseId,
      lines: [
        { account_code: drCollect.slCode, account_name: `${drCollect.glName} / ${drCollect.slName}`, debit: summary.totalDeductions, credit: 0, description: drCollect.slName },
        { account_code: crCollect.slCode, account_name: `${crCollect.glName} / ${crCollect.slName}`, debit: 0, credit: summary.totalDeductions, description: crCollect.slName },
      ],
    });
    vouchers.push(vchCollect);
  }

  // If deductions exceed total deposit, the remainder stays in Tenant AR (12413).
  // The waterfall above never permits a deposit balance to go negative.

  // 4. Refund remaining deposit if netRefundAmount > 0
  if (summary.netRefundAmount > 0) {
    const paymentMethod = financeInput.paymentMethod ?? 'BANK';

    // For multi-category refunds, issue one voucher per bucket refunding the
    // bucket's net available balance. For single-bucket (legacy) settle all
    // netRefundAmount against the SECURITY bucket.
    if (depositBuckets.length === 1) {
      const { debit: drRef, credit: crRef } = await resolveAccountingAccounts({
        transactionType: 'DEPOSIT_REFUND',
        paymentMethod,
        depositType: depositBuckets[0].depositType,
        propertyId: financeInput.propertyId,
        unitId: financeInput.unitId,
        tenantId: financeInput.tenantId,
        leaseId: financeInput.leaseId,
        unitName: financeInput.unitName,
      });

      const vchRefund = queueVoucher({
        voucher_date: dateStr,
        voucher_type: paymentMethod === 'BANK' ? 'Payment' : 'Receipt',
        description: `Final Settlement: Refund Remaining Deposit to Tenant`,
        reference_no: financeInput.referenceNo ? `REFUND-${financeInput.referenceNo}` : undefined,
        tenant_id: financeInput.tenantId,
        property_id: financeInput.propertyId,
        unit_id: financeInput.unitId,
        lease_id: financeInput.leaseId,
        lines: [
          {
            account_code: drRef.slCode,
            account_name: `${drRef.glName} / ${drRef.slName}`,
            debit: summary.netRefundAmount,
            credit: 0,
            description: drRef.slName,
          },
          {
            account_code: crRef.slCode,
            account_name: `${crRef.glName} / ${crRef.slName}`,
            debit: 0,
            credit: summary.netRefundAmount,
            description: `Deposit Refund via ${paymentMethod}`,
          },
        ],
      });
      vouchers.push(vchRefund);
    } else {
      // Multi-category refund: each bucket refunds its own net (bucket.amount
      // minus its share of deductions) — simple equal split by netRefundAmount
      // is unsafe, so we refund the actual bucket remainder computed above.
      let remainingRefund = summary.netRefundAmount;
      for (const bucket of depositBuckets) {
        if (remainingRefund <= 0) break;
        // The bucket's net is its amount minus any deduction already applied
        // to it. Recompute by re-walking the deductions total allocated above.
        const bucketApplied = appliedByBucket.get(bucket) ?? 0;
        const bucketNet = Math.max(0, bucket.amount - bucketApplied);
        const refund = Math.min(bucketNet, remainingRefund);
        if (refund <= 0) continue;

        const { debit: drRef, credit: crRef } = await resolveAccountingAccounts({
          transactionType: 'DEPOSIT_REFUND',
          paymentMethod,
          depositType: bucket.depositType,
          propertyId: financeInput.propertyId,
          unitId: financeInput.unitId,
          tenantId: financeInput.tenantId,
          leaseId: financeInput.leaseId,
          unitName: financeInput.unitName,
        });

        const vchRefund = queueVoucher({
          voucher_date: dateStr,
          voucher_type: paymentMethod === 'BANK' ? 'Payment' : 'Receipt',
          description: `Final Settlement: Refund ${bucket.depositType} Deposit to Tenant`,
          reference_no: financeInput.referenceNo
            ? `REFUND-${bucket.depositType}-${financeInput.referenceNo}`
            : undefined,
          tenant_id: financeInput.tenantId,
          property_id: financeInput.propertyId,
          unit_id: financeInput.unitId,
          lease_id: financeInput.leaseId,
          lines: [
            {
              account_code: drRef.slCode,
              account_name: `${drRef.glName} / ${drRef.slName}`,
              debit: refund,
              credit: 0,
              description: drRef.slName,
            },
            {
              account_code: crRef.slCode,
              account_name: `${crRef.glName} / ${crRef.slName}`,
              debit: 0,
              credit: refund,
              description: `Deposit Refund via ${paymentMethod}`,
            },
          ],
        });
        vouchers.push(vchRefund);
        remainingRefund -= refund;
      }
    }
  }

  if (queue.length > 0) {
    const settlementKey = `${financeInput.leaseId}|${financeInput.referenceNo || dateStr}`;
    const res: any = await apiRequest('/api/accounting/post-settlement', {
      method: 'POST',
      body: JSON.stringify({ lease_id: financeInput.leaseId, settlement_key: settlementKey, vouchers: queue }),
    });
    vouchers.length = 0;
    for (const r of (res?.data || [])) {
      vouchers.push({ event_id: r.event_id, voucher_id: r.voucher_id, voucher_number: r.voucher_number, receipt_id: '', receipt_number: '', status: 'POSTED' });
    }
  }

  return { summary, vouchers };
}

/** Posts the given vouchers for one lease in a single server transaction (see POST /api/accounting/post-settlement). */
async function postLeaseVouchers(leaseId: string, key: string, vouchers: Array<{ voucher_date: string; voucher_type: string; reference_no?: string; description: string; lines: Array<{ account_code: string; debit: number; credit: number; description?: string }> }>): Promise<PostingResult> {
  const res: any = await apiRequest('/api/accounting/post-settlement', {
    method: 'POST',
    body: JSON.stringify({ lease_id: leaseId, settlement_key: key, vouchers }),
  });
  const r = (res?.data || [])[0] || {};
  return { event_id: r.event_id, voucher_id: r.voucher_id, voucher_number: r.voucher_number, receipt_id: '', receipt_number: '', status: 'POSTED' };
}

// ── Unclaimed Deposit Handling ────────────────────────────────────────────────

/**
 * Reclassifies an unclaimed refundable deposit:
 *   Dr 21100006 (Refundable Security Deposit)
 *   Cr 21100002 (Unclaimed Liability-Deposit)
 */
export async function markDepositUnclaimed(params: {
  amount: number;
  tenantId: string;
  propertyId: string;
  unitId?: string;
  leaseId: string;
  unitName?: string;
}) {
  const { debit, credit } = await resolveAccountingAccounts({
    transactionType: 'DEPOSIT_TO_UNCLAIMED',
    depositType: 'SECURITY',
    propertyId: params.propertyId,
    unitId: params.unitId,
    tenantId: params.tenantId,
    leaseId: params.leaseId,
    unitName: params.unitName,
  });
  const date = new Date().toISOString().split('T')[0];
  return postLeaseVouchers(params.leaseId, `UNCLAIMED|${params.leaseId}|${date}|${params.amount}`, [{
    voucher_date: date,
    voucher_type: 'Journal',
    description: `Reclassify Unclaimed Deposit to Unclaimed Liability`,
    lines: [
      { account_code: debit.slCode, debit: params.amount, credit: 0, description: debit.slName },
      { account_code: credit.slCode, debit: 0, credit: params.amount, description: credit.slName },
    ],
  }]);
}

/**
 * Refund a previously unclaimed deposit when claimed:
 *   Dr 21100002 (Unclaimed Liability-Deposit)
 *   Cr 12000001 (Bank)
 */
export async function refundUnclaimedDeposit(params: {
  amount: number;
  tenantId: string;
  propertyId: string;
  unitId?: string;
  leaseId: string;
  bankRef?: string;
}) {
  const { debit, credit } = await resolveAccountingAccounts({
    transactionType: 'UNCLAIMED_REFUND',
    paymentMethod: 'BANK',
    propertyId: params.propertyId,
    unitId: params.unitId,
    tenantId: params.tenantId,
    leaseId: params.leaseId,
  });
  const date = new Date().toISOString().split('T')[0];
  return postLeaseVouchers(params.leaseId, `UNCLAIMED-REFUND|${params.leaseId}|${params.bankRef || date}|${params.amount}`, [{
    voucher_date: date,
    voucher_type: 'Payment',
    description: `Refund Claimed Unclaimed Deposit`,
    reference_no: params.bankRef,
    lines: [
      { account_code: debit.slCode, debit: params.amount, credit: 0, description: debit.slName },
      { account_code: credit.slCode, debit: 0, credit: params.amount, description: credit.slName },
    ],
  }]);
}

// ── Guarantee Cheque Return ───────────────────────────────────────────────────

/**
 * Returns a guarantee cheque when not invoked:
 *   Dr 21200001 (Guarantee Cheque Received)
 *   Cr 12900002 (Deposit-PDC In Hand)
 */
export async function returnGuaranteeCheque(params: {
  amount: number;
  tenantId: string;
  propertyId: string;
  unitId?: string;
  leaseId: string;
  chequeNumber: string;
}) {
  const { debit, credit } = await resolveAccountingAccounts({
    transactionType: 'GUARANTEE_CHEQUE_RETURN',
    depositType: 'GUARANTEE',
    propertyId: params.propertyId,
    unitId: params.unitId,
    tenantId: params.tenantId,
    leaseId: params.leaseId,
  });
  const date = new Date().toISOString().split('T')[0];
  return postLeaseVouchers(params.leaseId, `GUARANTEE-RETURN|${params.leaseId}|${params.chequeNumber}`, [{
    voucher_date: date,
    voucher_type: 'Journal',
    description: `Return Guarantee Cheque - ${params.chequeNumber}`,
    reference_no: params.chequeNumber,
    lines: [
      { account_code: debit.slCode, debit: params.amount, credit: 0, description: debit.slName },
      { account_code: credit.slCode, debit: 0, credit: params.amount, description: credit.slName },
    ],
  }]);
}

// ── Early Lease Termination & Future PDC Return Workflow ──────────────────────

/**
 * Identifies future unpresented PDCs for a lease and returns eligible ones:
 *   Dr 21400 [unit SL] / Cr 12900001
 */
export async function returnFuturePdcsForLease(
  leaseId: string | number,
  vacateDate?: string,
  extra?: { tenantId?: string; propertyId?: string; unitId?: string; unitCode?: string; cancelAllUnpresented?: boolean },
) {
  const returned: any[] = [];
  const processedChequeNos = new Set<string>();

  // 1. Query all active/held PDCs for this lease in fin_pdc_register
  try {
    let query = db
      .from('fin_pdc_register')
      .select('*')
      .or(`lease_id.eq.${String(leaseId)}${extra?.tenantId ? `,tenant_id.eq.${extra.tenantId}` : ''}`)
      .in('status', ['In Hand', 'Received', 'IN_HAND', 'RECEIVED', 'in hand', 'received']);

    if (vacateDate && !extra?.cancelAllUnpresented) query = query.gte('cheque_date', vacateDate);
    const { data: pdcs } = await query;

    for (const pdc of pdcs ?? []) {
      if (pdc.cheque_number && processedChequeNos.has(pdc.cheque_number)) continue;
      try {
        await returnPdc(pdc.id, pdc.cheque_number);
        await db.from('fin_pdc_register').update({ status: 'Cancelled' }).eq('id', pdc.id);
        returned.push(pdc);
        if (pdc.cheque_number) processedChequeNos.add(pdc.cheque_number);
      } catch (e: any) {
        console.warn(`[returnFuturePdcsForLease] PDC #${pdc.cheque_number} return notice:`, e?.message);
      }
    }
  } catch (e) {
    console.warn('[returnFuturePdcsForLease] fin_pdc_register query notice:', e);
  }

  // 2. Also query and update legacy pdcs table
  try {
    let query2 = db
      .from('pdcs')
      .select('*')
      .or(`lease_id.eq.${String(leaseId)}${extra?.unitCode ? `,unit_name.ilike.%${extra.unitCode}%` : ''}`)
      .in('status', ['received', 'replaced', 'in_hand', 'in hand', 'In Hand']);

    if (vacateDate && !extra?.cancelAllUnpresented) query2 = query2.gte('cheque_date', vacateDate);
    const { data: legacyPdcs } = await query2;

    for (const pdc of legacyPdcs ?? []) {
      const chq = pdc.cheque_number || pdc.cheque_no;
      if (chq && processedChequeNos.has(chq)) continue;
      try {
        await returnPdc(pdc.id, chq).catch(() => {});
        await db.from('pdcs').update({ status: 'cancelled', status_pdc: 'Cancelled' }).eq('id', pdc.id);
        returned.push(pdc);
        if (chq) processedChequeNos.add(chq);
      } catch (e: any) {
        console.warn(`[returnFuturePdcsForLease] Legacy PDC #${chq} return notice:`, e?.message);
      }
    }
  } catch (e) {
    console.warn('[returnFuturePdcsForLease] pdcs table query notice:', e);
  }

  return {
    returnedCount: returned.length,
    pdcs: returned,
  };
}


/**
 * Early-vacate finance normalization. Once a tenant vacates before the
 * contractual lease end, future rent already posted to AR/revenue must be
 * reversed, while rent already earned up to the effective vacate date remains
 * untouched. Held/unpresented PDCs after the vacate date are returned through
 * the normal PDC lifecycle. This keeps GL, tenant AR, PDC exposure and finance
 * reports aligned with the actual lease end date.
 */
export async function settleEarlyLeaseVacate(params: {
  leaseId: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  unitName?: string;
  vacateDate: string;
  leaseEndDate: string;
}) {
  if (new Date(params.vacateDate).getTime() >= new Date(params.leaseEndDate).getTime()) {
    return { reversedInvoiceCount: 0, reversedRentAmount: 0, returnedPdcCount: 0, returnedPdcAmount: 0 };
  }

  // The leasing UI historically stores a lease_number-like ID. Resolve the
  // authoritative UUID context here instead of manufacturing GL/SL context in
  // the UI. This keeps early-vacate accounting on the same resolver path as
  // every other finance event.
  const context = await resolveLeaseFinanceContext(params);
  const { leaseUuid, tenantId, propertyId, unitId } = context;

  // The reversal amounts are computed from the posted ledger on the server and all reversals post in one
  // transaction; the browser only supplies the two resolved accounts.
  const { debit: drAcct, credit: crAcct } = await resolveAccountingAccounts({
    transactionType: 'RENT_INVOICE_REVERSAL',
    propertyId,
    unitId,
    tenantId,
    leaseId: leaseUuid,
    unitName: params.unitName,
  });
  const reversal: any = await apiRequest('/api/accounting/early-vacate-reversals', {
    method: 'POST',
    body: JSON.stringify({
      lease_id: leaseUuid,
      vacate_date: params.vacateDate,
      lease_end_date: params.leaseEndDate,
      debit_code: drAcct.slCode,
      credit_code: crAcct.slCode,
    }),
  });
  const reversedInvoiceCount = Number(reversal?.data?.reversedInvoiceCount || 0);
  const reversedRentAmount = Number(reversal?.data?.reversedRentAmount || 0);

  // Unpresented cheques are returned by cancelLeasePdcs (run first by the screen, which posts
  // Dr 21400001 / Cr 12900001 and sets the status). Returning them again here could post a second entry,
  // so this step only reports the reversals.
  return {
    reversedInvoiceCount,
    reversedRentAmount: Number(reversedRentAmount.toFixed(2)),
    returnedPdcCount: 0,
    returnedPdcAmount: 0,
  };
}

// ── Lease Closure Gate ───────────────────────────────────────────────────────

/**
 * Result of a lease-closure eligibility audit. Closure is permitted only when
 * every blocking condition is `ok === true`.
 */
export type LeaseClosureAudit = {
  canClose: boolean;
  tenantArOutstanding: number;
  refundableDepositOutstanding: number;
  unpresentedPdcs: Array<{ id: string | number; cheque_number: string; status: string; amount: number }>;
  unclaimedDepositOutstanding: number;
  blockers: string[];
};

/**
 * Multi-ledger settlement gate for lease closure.
 *
 * Closure is strictly blocked unless:
 *   1. Tenant AR (12413 [unit SL]) is zero,
 *   2. Refundable deposits (21100006 + 21100003/4/5 buckets) are zero — they
 *      must have been refunded or fully applied as deductions,
 *   3. All PDCs linked to the lease are returned / cancelled / cleared —
 *      no unpresented PDCs remain.
 *
 * Returns a typed audit object. Callers must inspect `canClose` and surface
 * `blockers` to the operator.
 */
export async function auditLeaseClosure(leaseId: string | number): Promise<LeaseClosureAudit> {
  const blockers: string[] = [];

  // ── 1. Tenant AR (12413 [unit SL]) for this lease ─────────────────────────
  const { data: arRows, error: arErr } = await db
    .from('fin_voucher_lines')
    .select('debit, credit, account_code, lease_id, voucher:voucher_id(status)')
    .eq('lease_id', String(leaseId))
    .like('account_code', '12413%');

  if (arErr) throw arErr;

  let tenantArOutstanding = 0;
  for (const row of arRows ?? []) {
    // Skip vouchers that aren't POSTED (avoid draft reversals)
    const vch = Array.isArray(row.voucher) ? row.voucher[0] : row.voucher;
    if (vch && vch.status && vch.status !== 'POSTED') continue;
    tenantArOutstanding += Number(row.debit || 0) - Number(row.credit || 0);
  }
  tenantArOutstanding = Number(tenantArOutstanding.toFixed(2));

  if (Math.abs(tenantArOutstanding) > 0.005) {
    blockers.push(
      `Tenant AR outstanding: ${tenantArOutstanding.toFixed(2)} (must be 0)`,
    );
  }

  // ── 2. Refundable deposit balances (21500[unit SL] + 21100006 + 21100003/4/5)
  //    SECURITY deposits live on 21500 (unit-specific SL) until moved via
  //    DEPOSIT_TO_REFUNDABLE. QATAR_COOL / KAHRAMAA / SERVICE_FEE live on
  //    21100003/4/5. The 21100006 bucket is the consolidated refundable pool.
  //    All three must net to zero before closure.
  const { data: depRows, error: depErr } = await db
    .from('fin_voucher_lines')
    .select('debit, credit, account_code, lease_id, voucher:voucher_id(status)')
    .eq('lease_id', String(leaseId))
    .or('account_code.in.(21100003,21100004,21100005,21100006),account_code.like.21500%');

  if (depErr) throw depErr;

  let refundableDepositOutstanding = 0;
  for (const row of depRows ?? []) {
    const vch = Array.isArray(row.voucher) ? row.voucher[0] : row.voucher;
    if (vch && vch.status && vch.status !== 'POSTED') continue;
    refundableDepositOutstanding += Number(row.credit || 0) - Number(row.debit || 0);
  }
  refundableDepositOutstanding = Number(refundableDepositOutstanding.toFixed(2));

  if (Math.abs(refundableDepositOutstanding) > 0.005) {
    blockers.push(
      `Refundable deposit outstanding: ${refundableDepositOutstanding.toFixed(2)} (must be 0)`,
    );
  }

  // ── 3. Unclaimed deposit (21100002) — must be 0 before closure ────────────
  const { data: unRows, error: unErr } = await db
    .from('fin_voucher_lines')
    .select('debit, credit, account_code, lease_id, voucher:voucher_id(status)')
    .eq('lease_id', String(leaseId))
    .eq('account_code', '21100002');

  if (unErr) throw unErr;

  let unclaimedDepositOutstanding = 0;
  for (const row of unRows ?? []) {
    const vch = Array.isArray(row.voucher) ? row.voucher[0] : row.voucher;
    if (vch && vch.status && vch.status !== 'POSTED') continue;
    unclaimedDepositOutstanding += Number(row.credit || 0) - Number(row.debit || 0);
  }
  unclaimedDepositOutstanding = Number(unclaimedDepositOutstanding.toFixed(2));

  if (Math.abs(unclaimedDepositOutstanding) > 0.005) {
    blockers.push(
      `Unclaimed deposit outstanding: ${unclaimedDepositOutstanding.toFixed(2)} (must be 0)`,
    );
  }

  // ── 4. Unpresented PDCs for this lease ────────────────────────────────────
  const { data: pdcs, error: pdcErr } = await db
    .from('fin_pdc_register')
    .select('id, cheque_number, status, amount')
    .eq('lease_id', String(leaseId))
    .in('status', ['In Hand', 'Received', 'IN_HAND', 'RECEIVED', 'Deposited', 'DEPOSITED', 'Clearing', 'CLEARING']);

  if (pdcErr) throw pdcErr;

  const unpresentedPdcs = (pdcs ?? []).map((p: any) => ({
    id:            p.id as string | number,
    cheque_number: p.cheque_number as string,
    status:        p.status as string,
    amount:        Number(p.amount || 0),
  }));

  if (unpresentedPdcs.length > 0) {
    blockers.push(
      `${unpresentedPdcs.length} unpresented PDC(s) — must be returned/cancelled before closure`,
    );
  }

  return {
    canClose: blockers.length === 0,
    tenantArOutstanding,
    refundableDepositOutstanding,
    unpresentedPdcs,
    unclaimedDepositOutstanding,
    blockers,
  };
}

/**
 * Closure gate helper. Throws if any blocker is present; otherwise returns
 * the audit object for the caller to surface as a success payload.
 */
export async function assertLeaseClosable(leaseId: string | number): Promise<LeaseClosureAudit> {
  const audit = await auditLeaseClosure(leaseId);
  if (!audit.canClose) {
    const err = new Error(
      `Lease ${leaseId} cannot be closed: ${audit.blockers.join('; ')}`,
    );
    (err as any).audit = audit;
    throw err;
  }
  return audit;
}
