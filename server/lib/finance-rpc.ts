// server/lib/finance-rpc.ts
// Port of the original database functions used by the accounting engine.
// Source definitions: post_accounting_event_atomic, fin_resolve_unit_sl, fin_refresh_event_totals,
// fin_validate_event_balance, fin_manual_pdc_status_update, assign_customer_code (see the export in the
// session scratchpad). Each function runs in one database transaction, like the original.
import { randomUUID } from 'crypto';
import prisma from './prisma';
import { txn } from './prisma';
import { HttpError } from './errors';
import { money } from './money';

/** Integer sequence, like a Postgres sequence. Safe under concurrent calls (single-row upsert). */
export async function nextIntSequence(name: string): Promise<number> {
  return txn(async (tx) => {
    await tx.$executeRaw`INSERT INTO app_sequences (name, current_value) VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE current_value = current_value + 1`;
    const rows = await tx.$queryRaw<{ current_value: bigint }[]>`SELECT current_value FROM app_sequences WHERE name = ${name}`;
    return Number(rows[0].current_value);
  });
}

/** customers.customer_code: 13-digit zero-padded sequence (same as assign_customer_code). */
export async function nextCustomerCode(): Promise<string> {
  const n = await nextIntSequence('customer_code');
  return String(n).padStart(13, '0');
}

// ───────────────────────────────────────────────────────────────────────────────
// fin_validate_event_balance
// ───────────────────────────────────────────────────────────────────────────────
export async function validateEventBalance(eventId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ debit: unknown; credit: unknown }[]>`
    SELECT COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit
    FROM fin_accounting_event_lines WHERE event_id = ${eventId}`;
  const d = money(rows[0].debit);
  const c = money(rows[0].credit);
  if (d === 0 && c === 0) throw new Error(`Accounting event ${eventId} contains no accounting value.`);
  if (d !== c) throw new Error(`Accounting event ${eventId} is unbalanced. Debit=${d}, Credit=${c}`);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// fin_refresh_event_totals
// ───────────────────────────────────────────────────────────────────────────────
export async function refreshEventTotals(eventId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE fin_accounting_events e
    JOIN (
      SELECT event_id, ROUND(COALESCE(SUM(debit), 0), 2) AS total_debit, ROUND(COALESCE(SUM(credit), 0), 2) AS total_credit
      FROM fin_accounting_event_lines WHERE event_id = ${eventId} GROUP BY event_id
    ) x ON x.event_id = e.id
    SET e.total_debit = x.total_debit, e.total_credit = x.total_credit, e.updated_at = NOW()`;
}

// ───────────────────────────────────────────────────────────────────────────────
// fin_resolve_unit_sl — the unit's subsidiary account for a GL code (created on first use)
// ───────────────────────────────────────────────────────────────────────────────
const SL_PREFIX: Record<string, string> = {
  '12100': 'Cash - ',
  '12413': 'Tenant Rent Receivable - ',
  '21400': 'PDC Received - ',
  '21500': 'Deposit - ',
};

export async function resolveUnitSl(unitId: string, propertyId: string, glCode: string, unitName?: string | null) {
  const existing = await prisma.$queryRaw<{ sl_code: string; sl_name: string; coa_account_id: string | null }[]>`
    SELECT sl_code, sl_name, coa_account_id FROM fin_unit_sl_accounts
    WHERE unit_id = ${unitId} AND gl_code = ${glCode} AND is_active = TRUE`;
  if (existing.length) {
    // A unit's mapping can outlive its chart account (removed or deactivated by hand). Posting to such a code is
    // refused ("not in the chart of accounts"), so put the account back instead of leaving the unit unusable.
    const ex = existing[0];
    const acct = await prisma.$queryRaw<{ id: string; is_active: any }[]>`
      SELECT id, is_active FROM fin_coa_accounts WHERE account_code = ${ex.sl_code} LIMIT 1`;
    if (acct.length && Number(acct[0].is_active) === 1) return [ex];
    const parent = await prisma.$queryRaw<{ id: string; account_type: string; group_name: string | null; class_name: string | null }[]>`
      SELECT id, account_type, group_name, class_name FROM fin_coa_accounts WHERE account_code = ${glCode} LIMIT 1`;
    if (!parent.length) return [ex];
    let coaId = acct.length ? String(acct[0].id) : randomUUID();
    if (acct.length) {
      await prisma.$executeRaw`UPDATE fin_coa_accounts SET is_active = TRUE WHERE id = ${coaId}`;
    } else {
      await prisma.$executeRaw`INSERT INTO fin_coa_accounts
        (id, account_code, account_name, account_type, account_level, group_name, class_name, parent_account_id, is_active)
        VALUES (${coaId}, ${ex.sl_code}, ${ex.sl_name}, ${parent[0].account_type}, 'SL', ${parent[0].group_name}, ${parent[0].class_name}, ${parent[0].id}, TRUE)`;
    }
    await prisma.$executeRaw`UPDATE fin_unit_sl_accounts SET coa_account_id = ${coaId} WHERE unit_id = ${unitId} AND gl_code = ${glCode}`;
    return [{ ...ex, coa_account_id: coaId }];
  }

  return txn(async (tx) => {
    const seq = await tx.$executeRaw`INSERT INTO app_sequences (name, current_value) VALUES ('fin_unit_sl_seq', 1)
      ON DUPLICATE KEY UPDATE current_value = current_value + 1`;
    void seq;
    const seqRows = await tx.$queryRaw<{ current_value: bigint }[]>`SELECT current_value FROM app_sequences WHERE name = 'fin_unit_sl_seq'`;
    // Jump past the highest sub-ledger number already used under this GL (accounts and unit rows, including
    // legacy inactive ones such as 12413389). Reusing one would give the unit an inactive receivable account.
    const prefix = glCode.length + 1;
    const [{ m }] = await tx.$queryRaw<{ m: bigint | null }[]>`
      SELECT GREATEST(
        COALESCE((SELECT MAX(CAST(SUBSTRING(account_code, ${prefix}) AS UNSIGNED)) FROM fin_coa_accounts
          WHERE account_code LIKE ${glCode + '___'}), 0),
        COALESCE((SELECT MAX(CAST(SUBSTRING(sl_code, ${prefix}) AS UNSIGNED)) FROM fin_unit_sl_accounts
          WHERE sl_code LIKE ${glCode + '___'}), 0)) AS m`;
    let seqVal = Number(seqRows[0].current_value);
    if (Number(m ?? 0) >= seqVal) {
      seqVal = Number(m) + 1;
      await tx.$executeRaw`UPDATE app_sequences SET current_value = ${seqVal} WHERE name = 'fin_unit_sl_seq'`;
    }
    const slCode = glCode + String(seqVal).padStart(3, '0');
    const slName = (SL_PREFIX[glCode] ?? `${glCode} - `) + (unitName || 'Unit');

    let coaId: string | null = null;
    const parent = await tx.$queryRaw<{ id: string; account_type: string; group_name: string | null; class_name: string | null }[]>`
      SELECT id, account_type, group_name, class_name FROM fin_coa_accounts WHERE account_code = ${glCode}`;
    if (parent.length) {
      const sameCode = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM fin_coa_accounts WHERE account_code = ${slCode}`;
      if (sameCode.length) {
        coaId = sameCode[0].id;
      } else {
        coaId = randomUUID();
        await tx.$executeRaw`INSERT INTO fin_coa_accounts
          (id, account_code, account_name, account_type, account_level, group_name, class_name, parent_account_id, is_active)
          VALUES (${coaId}, ${slCode}, ${slName}, ${parent[0].account_type}, 'SL', ${parent[0].group_name}, ${parent[0].class_name}, ${parent[0].id}, TRUE)`;
      }
    }

    const clash = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM fin_unit_sl_accounts WHERE unit_id = ${unitId} AND gl_code = ${glCode}`;
    if (!clash.length) {
      await tx.$executeRaw`INSERT INTO fin_unit_sl_accounts (id, unit_id, property_id, gl_code, sl_code, sl_name, coa_account_id, is_active)
        VALUES (${randomUUID()}, ${unitId}, ${propertyId}, ${glCode}, ${slCode}, ${slName}, ${coaId}, TRUE)`;
    }
    const final = await tx.$queryRaw<{ sl_code: string; sl_name: string; coa_account_id: string | null }[]>`
      SELECT sl_code, sl_name, coa_account_id FROM fin_unit_sl_accounts WHERE unit_id = ${unitId} AND gl_code = ${glCode}`;
    return [final[0]];
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// post_accounting_event_atomic — validates an accounting event and posts it to a voucher.
// Everything happens in one transaction: on any error the event stays unposted.
// ───────────────────────────────────────────────────────────────────────────────
type PostResult = { event_id: string; voucher_id: string; voucher_number: string; status: string };

/**
 * Issues the transaction receipt for a posted event (the original database did this in a trigger; the MariaDB
 * port has no triggers). Without it the client treats every posting as failed with
 * "was posted but its receipt was not generated", even though the ledger entry exists.
 */
async function issueReceiptTx(tx: any, ev: any, voucherId: string, voucherNumber: string, lines: Array<{ code: string; debit: number; credit: number; name?: string | null; description?: string | null }>) {
  const have = await tx.$queryRaw<any[]>`SELECT id FROM fin_transaction_receipts WHERE accounting_event_id = ${ev.id} LIMIT 1`;
  if (have.length) return;
  const year = new Date(ev.posting_date ?? ev.event_date ?? Date.now()).getUTCFullYear();
  await tx.$executeRaw`INSERT INTO app_sequences (name, current_value) VALUES (${'receipt_' + year}, 1) ON DUPLICATE KEY UPDATE current_value = current_value + 1`;
  const seq = await tx.$queryRaw<{ current_value: bigint }[]>`SELECT current_value FROM app_sequences WHERE name = ${'receipt_' + year}`;
  const n = String(Number(seq[0].current_value)).padStart(6, '0');
  const isCash = (c: string) => c.startsWith('12000') || c.startsWith('121');
  const net = lines.filter((l) => isCash(l.code)).reduce((a, l) => a + l.debit - l.credit, 0);
  const direction = Math.abs(net) < 0.005 ? 'NON_CASH' : net > 0 ? 'IN' : 'OUT';
  const amount = lines.reduce((a, l) => a + l.debit, 0);
  const category = String(ev.event_type || 'GENERAL');
  const payload = JSON.stringify({ lines: lines.map((l, i) => ({ line_number: i + 1, account_code: l.code, account_name: l.name ?? null, debit: l.debit, credit: l.credit, description: l.description ?? null })) });
  await tx.$executeRaw`INSERT INTO fin_transaction_receipts
    (id, receipt_no, acknowledgement_no, accounting_event_id, voucher_id, receipt_date, receipt_category, direction, amount, currency_code,
     source_type, source_id, reference_no, description, tenant_id, customer_id, property_id, unit_id, lease_id, status, issued_at, receipt_payload, metadata, created_at)
    VALUES (${randomUUID()}, ${'RCT-' + year + '-' + n}, ${'ACK-' + year + '-' + n}, ${ev.id}, ${voucherId}, ${ev.posting_date ?? ev.event_date}, ${category}, ${direction}, ${amount}, 'QAR',
            ${ev.source_type ?? null}, ${ev.source_id ?? null}, ${voucherNumber}, ${ev.description ?? null}, ${ev.tenant_id ?? null}, ${ev.customer_id ?? null},
            ${ev.property_id ?? null}, ${ev.unit_id ?? null}, ${ev.lease_id ?? null}, 'ISSUED', NOW(6), ${payload}, '{}', NOW(6))`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Period lock enforcement (A7) — missing or non-open period is treated as closed.
// ───────────────────────────────────────────────────────────────────────────────
export async function assertPeriodOpen(db: any, dateInput: Date | string) {
  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid posting date');
  const pYear = d.getUTCFullYear();
  const pMonth = d.getUTCMonth() + 1;
  const period = await db.$queryRaw<{ status: string }[]>`
    SELECT status FROM fin_posting_periods WHERE year = ${String(pYear)} AND month = ${pMonth} LIMIT 1`;
  if (!period.length || String(period[0].status).toLowerCase() !== 'open') {
    throw new HttpError(
      403,
      `Financial Period ${pYear}-${String(pMonth).padStart(2, '0')} is ${period.length ? 'closed' : 'not open'} for entries. Contact Super-Admin to reopen`,
    );
  }
}

export async function postAccountingEvent(eventId: string, externalTx?: any): Promise<PostResult[]> {
  const run = async (tx: any): Promise<PostResult[]> => {
    const evRows = await tx.$queryRaw<any[]>`SELECT * FROM fin_accounting_events WHERE id = ${eventId} FOR UPDATE`;
    if (!evRows.length) throw new HttpError(404, `Accounting event ${eventId} was not found.`);
    const ev = evRows[0];

    if (ev.status === 'POSTED') {
      if (!ev.voucher_id) throw new Error(`Accounting event ${eventId} is POSTED but voucher_id is null.`);
      const v = await tx.$queryRaw<any[]>`SELECT * FROM fin_vouchers WHERE id = ${ev.voucher_id}`;
      if (!v.length) throw new Error(`Accounting event ${eventId} is POSTED but voucher ${ev.voucher_id} was not found.`);
      return [{ event_id: ev.id, voucher_id: v[0].id, voucher_number: v[0].voucher_number, status: 'POSTED' }];
    }
    if (ev.status === 'REVERSED') throw new Error(`Accounting event ${eventId} has already been reversed.`);
    if (ev.status === 'CANCELLED') throw new Error(`Accounting event ${eventId} has been cancelled.`);

    const lines = await tx.$queryRaw<any[]>`SELECT * FROM fin_accounting_event_lines WHERE event_id = ${eventId}`;
    if (!lines.length) throw new Error(`Accounting event ${eventId} contains no accounting lines.`);

    const totalDebit = money(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
    const totalCredit = money(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
    if (totalDebit <= 0 && totalCredit <= 0) throw new Error(`Accounting event ${eventId} contains zero-value accounting lines.`);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      const diff = money(Math.abs(totalDebit - totalCredit));
      throw new HttpError(400,
        `Total Debits (${totalDebit}) must equal Total Credits (${totalCredit}). Out of balance by ${diff}`);
    }

    // Closed or unseeded financial periods accept no new entries (A7).
    await assertPeriodOpen(tx, ev.posting_date ?? ev.event_date);
    if (Math.abs(money(ev.total_debit) - totalDebit) > 0.001) {
      throw new Error(`Accounting event ${eventId} debit total does not match event lines. Event=${ev.total_debit}, Lines=${totalDebit}.`);
    }
    if (Math.abs(money(ev.total_credit) - totalCredit) > 0.001) {
      throw new Error(`Accounting event ${eventId} credit total does not match event lines. Event=${ev.total_credit}, Lines=${totalCredit}.`);
    }

    // Resolve every line to an active COA account (same rules as the original).
    const resolved: { line: any; coa: any }[] = [];
    for (const line of lines) {
      let coa: any = null;
      if (line.account_id) {
        const byId = await tx.$queryRaw<any[]>`SELECT * FROM fin_coa_accounts WHERE id = ${line.account_id}`;
        if (!byId.length) throw new Error(`Accounting event ${eventId} contains an unresolved, inactive, or inconsistent COA account.`);
        if (!byId[0].is_active) throw new Error(`Accounting event ${eventId} contains an unresolved, inactive, or inconsistent COA account.`);
        if (line.account_code && byId[0].account_code !== line.account_code) {
          throw new Error(`Accounting event ${eventId} contains an unresolved, inactive, or inconsistent COA account.`);
        }
        coa = byId[0];
      } else {
        const byCode = await tx.$queryRaw<any[]>`SELECT * FROM fin_coa_accounts WHERE account_code = ${line.account_code} AND is_active = TRUE`;
        if (!byCode.length) throw new Error(`Accounting event ${eventId} contains an unresolved, inactive, or inconsistent COA account.`);
        coa = byCode[0];
      }
      resolved.push({ line, coa });
    }

    // An earlier, incomplete attempt may already have created the voucher.
    const existingVoucher = await tx.$queryRaw<any[]>`SELECT * FROM fin_vouchers WHERE accounting_event_id = ${eventId} LIMIT 1`;
    if (existingVoucher.length) {
      await tx.$executeRaw`UPDATE fin_accounting_events SET status = 'POSTED', voucher_id = ${existingVoucher[0].id},
        posted_at = COALESCE(posted_at, NOW()) WHERE id = ${eventId}`;
      await issueReceiptTx(tx, ev, existingVoucher[0].id, existingVoucher[0].voucher_number, lines.map((l: any) => ({ code: l.account_code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, name: l.account_name, description: l.description })));
      return [{ event_id: eventId, voucher_id: existingVoucher[0].id, voucher_number: existingVoucher[0].voucher_number, status: 'POSTED' }];
    }

    const baseVoucherNumber = String(ev.reference_number || '').trim() !== ''
      ? String(ev.reference_number).trim()
      : 'EVT-' + String(eventId).replace(/-/g, '').slice(0, 8).toUpperCase();
    // Two postings can legitimately share one reference (e.g. a cheque's receipt and its follow-up entry).
    // voucher_number is unique, so a repeat gets a numeric suffix instead of failing the whole post.
    let voucherNumber = baseVoucherNumber;
    for (let n = 2; n < 50; n++) {
      const clash = await tx.$queryRaw<any[]>`SELECT id FROM fin_vouchers WHERE voucher_number = ${voucherNumber} LIMIT 1`;
      if (!clash.length) break;
      voucherNumber = `${baseVoucherNumber}-${n}`;
    }
    const voucherId = randomUUID();
    const description = ev.description || `${ev.event_type} - ${ev.source_type}`;

    await tx.$executeRaw`INSERT INTO fin_vouchers
      (id, voucher_number, voucher_date, voucher_type, reference_no, description, total_amount, status,
       accounting_event_id, source_type, source_id, created_by, posted_at, created_at)
      VALUES (${voucherId}, ${voucherNumber}, ${ev.posting_date}, 'Journal', ${ev.reference_number || ev.source_id || null},
       ${description}, ${totalDebit}, 'Posted', ${eventId}, ${ev.source_type}, ${ev.source_id}, ${ev.created_by}, NOW(), NOW())`;

    for (const { line, coa } of resolved) {
      await tx.$executeRaw`INSERT INTO fin_voucher_lines
        (id, voucher_id, account_id, account_code, account_name, debit_amount, credit_amount, description,
         tenant_id, lease_id, property_id, unit_id, customer_id, cost_center_id, source_type, source_id)
        VALUES (${randomUUID()}, ${voucherId}, ${coa.id}, ${coa.account_code}, ${coa.account_name},
         ${money(line.debit)}, ${money(line.credit)}, ${line.description || coa.account_name || line.account_name || null},
         ${line.tenant_id ?? ev.tenant_id ?? null}, ${line.lease_id ?? ev.lease_id ?? null},
         ${line.property_id ?? ev.property_id ?? null}, ${line.unit_id ?? ev.unit_id ?? null},
         ${line.customer_id ?? ev.customer_id ?? null}, ${line.cost_center_id ?? null},
         ${line.source_type ?? ev.source_type ?? null}, ${line.source_id ?? ev.source_id ?? null})`;
    }

    await tx.$executeRaw`UPDATE fin_accounting_events SET status = 'POSTED', voucher_id = ${voucherId}, posted_at = NOW()
      WHERE id = ${eventId}`;
    await issueReceiptTx(tx, ev, voucherId, voucherNumber, resolved.map(({ line, coa }) => ({ code: coa.account_code, debit: money(line.debit), credit: money(line.credit), name: coa.account_name, description: line.description })));

    return [{ event_id: eventId, voucher_id: voucherId, voucher_number: voucherNumber, status: 'POSTED' }];
  };
  return externalTx ? run(externalTx) : txn(run);
}

// ───────────────────────────────────────────────────────────────────────────────
// fin_manual_pdc_status_update — row-locked state-machine transition with GL postings.
// GL accounts (live chart): 12000 Bank, 12900 PDC In Hand (cheques deposited), 12413 Tenant Receivables,
// 41201 Other Income (bounce charges). Postings follow the spec sequence:
//   Deposited: Dr 12900 / Cr 12413      Cleared: Dr 12000 / Cr 12900
//   Bounced:   Dr 12413 (amount+charge) / Cr 12900 (amount) / Cr 41201 (charge)
// ───────────────────────────────────────────────────────────────────────────────
const PDC_STATUS: Record<string, string> = {
  'in hand': 'In Hand',
  deposited: 'Deposited',
  cleared: 'Cleared',
  returned: 'Returned',
  bounced: 'Bounced',
  dishonoured: 'Dishonoured',
  replaced: 'Replaced',
  cancelled: 'Cancelled',
};

export const PDC_GL = { bank: '12000', pdcInHand: '12900', tenantAr: '12413', bounceIncome: '41201' };
const PDC_BOUNCE_CHARGE = Number(process.env.PDC_BOUNCE_CHARGE ?? 50);

const PDC_TRANSITIONS: Record<string, string[]> = {
  'In Hand': ['Deposited', 'Returned', 'Replaced', 'Cancelled'],
  Deposited: ['Cleared', 'Bounced', 'Dishonoured', 'Returned'],
  Bounced: ['Deposited', 'Replaced', 'Returned', 'Cancelled'],
  Dishonoured: ['Deposited', 'Replaced', 'Returned', 'Cancelled'],
  Returned: ['Replaced', 'Cancelled'],
  Replaced: [],
  Cleared: [],
  Cancelled: [],
};

type GlLine = { code: string; debit: number; credit: number };

function pdcPostingPlan(target: string, amount: number, fromStatus?: string): { eventType: string; lines: GlLine[] } | null {
  if (target === 'Deposited') {
    return {
      eventType: 'PDC_DEPOSITED',
      lines: [
        { code: PDC_GL.pdcInHand, debit: amount, credit: 0 },
        { code: PDC_GL.tenantAr, debit: 0, credit: amount },
      ],
    };
  }
  if (target === 'Cleared') {
    return {
      eventType: 'PDC_CLEARED',
      lines: [
        { code: PDC_GL.bank, debit: amount, credit: 0 },
        { code: PDC_GL.pdcInHand, debit: 0, credit: amount },
      ],
    };
  }
  if (target === 'Returned') {
    if (fromStatus === 'Deposited' || fromStatus === 'Cleared') {
      return {
        eventType: 'PDC_BOUNCED',
        lines: [
          { code: PDC_GL.pdcInHand, debit: amount, credit: 0 },
          { code: PDC_GL.bank, debit: 0, credit: amount },
          { code: PDC_GL.tenantAr, debit: amount, credit: 0 },
          { code: '21400', debit: 0, credit: amount },
        ],
      };
    }
    return {
      eventType: 'PDC_RETURNED',
      lines: [
        { code: '21400', debit: amount, credit: 0 },
        { code: PDC_GL.pdcInHand, debit: 0, credit: amount },
      ],
    };
  }
  if (target === 'Bounced') {
    const charge = money(PDC_BOUNCE_CHARGE);
    const lines: GlLine[] = [
      { code: PDC_GL.tenantAr, debit: money(amount + charge), credit: 0 },
      { code: PDC_GL.pdcInHand, debit: 0, credit: amount },
    ];
    if (charge > 0) lines.push({ code: PDC_GL.bounceIncome, debit: 0, credit: charge });
    return { eventType: 'PDC_BOUNCED', lines };
  }
  return null;
}

export async function manualPdcStatusUpdate(args: {
  pdcId: string | number;
  status: string;
  depositDate?: string | null;
  clearedDate?: string | null;
  returnedDate?: string | null;
  bankId?: string | number | null;
  overrideCode?: string | null;
}) {
  const target = PDC_STATUS[String(args.status || '').trim().toLowerCase()];
  if (!target) throw new HttpError(400, `Invalid PDC status: ${args.status}`);
  let id: bigint;
  try {
    id = BigInt(args.pdcId);
  } catch {
    throw new HttpError(400, `Invalid PDC id: ${args.pdcId}`);
  }

  const txResult = await txn(async (tx) => {
    // A7: Verify posting period is open before changing PDC status or generating events.
    const effectiveDate = args.clearedDate || args.depositDate || args.returnedDate || new Date();
    await assertPeriodOpen(tx, effectiveDate);

    // Lock the cheque row so concurrent status changes run one after another.
    const rows = await tx.$queryRaw<any[]>`SELECT * FROM fin_pdc_register WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw new HttpError(404, `PDC register row ${args.pdcId} not found`);
    const pdc = rows[0];
    const from = String(pdc.status);

    if (from === target) {
      throw new HttpError(409, target === 'Cleared' ? 'PDC has already been cleared.' : `PDC is already ${target}.`);
    }
    if (!(PDC_TRANSITIONS[from] ?? []).includes(target)) {
      throw new HttpError(409, from === 'Cleared'
        ? 'PDC has already been cleared.'
        : `Invalid PDC status change: ${from} -> ${target}.`);
    }

    if (target === 'Cleared' && !args.overrideCode) {
      const maturity = new Date(pdc.cheque_date);
      const endOfToday = new Date();
      endOfToday.setUTCHours(23, 59, 59, 999);
      if (maturity.getTime() > endOfToday.getTime()) {
        throw new HttpError(400,
          `Cheque maturity date is ${maturity.toISOString().slice(0, 10)}. Premature clearance requires supervisor override`);
      }
    }

    const updated = await tx.$executeRaw`UPDATE fin_pdc_register SET
        status = ${target},
        deposit_date = COALESCE(${args.depositDate ?? null}, deposit_date),
        cleared_date = COALESCE(${args.clearedDate ?? null}, cleared_date),
        returned_date = COALESCE(${args.returnedDate ?? null}, returned_date),
        bank_id = COALESCE(${args.bankId ?? null}, bank_id)
      WHERE id = ${id} AND status = ${from}`;
    if (Number(updated) !== 1) throw new HttpError(409, 'PDC was changed by another user. Reload and try again.');

    const amount = money(String(pdc.amount));
    const plan = pdcPostingPlan(target, amount, from);
    let eventId: string | null = null;
    if (plan && amount > 0) {
      eventId = randomUUID();
      const totalDebit = money(plan.lines.reduce((s, l) => s + l.debit, 0));
      const totalCredit = money(plan.lines.reduce((s, l) => s + l.credit, 0));
      const now = new Date();
      await tx.fin_accounting_events.create({
        data: {
          id: eventId,
          event_type: plan.eventType as any,
          status: 'DRAFT',
          event_date: now,
          posting_date: now,
          source_type: 'PDC',
          source_id: String(pdc.id),
          idempotency_key: `pdc:${pdc.id}:${target}:${eventId}`,
          description: `PDC ${pdc.cheque_number} ${target}`,
          total_debit: totalDebit,
          total_credit: totalCredit,
          metadata: '{}',
        },
      });
      for (const [i, line] of plan.lines.entries()) {
        const coa = await tx.$queryRaw<any[]>`SELECT id, account_code, account_name FROM fin_coa_accounts
          WHERE account_code = ${line.code} AND is_active = TRUE LIMIT 1`;
        if (!coa.length) throw new HttpError(400, `GL account ${line.code} is not active in the chart of accounts`);
        await tx.fin_accounting_event_lines.create({
          data: {
            event_id: eventId,
            line_number: i + 1,
            account_id: coa[0].id,
            account_code: coa[0].account_code,
            account_name: coa[0].account_name,
            debit: line.debit,
            credit: line.credit,
            description: `PDC ${pdc.cheque_number} ${target}`,
          },
        });
      }
    }
    return { from, eventId };
  });

  if (txResult.eventId) {
    try {
      await postAccountingEvent(txResult.eventId);
    } catch (e) {
      // Posting failed: restore the cheque's previous status and mark the event failed.
      await prisma.$executeRaw`UPDATE fin_pdc_register SET status = ${txResult.from} WHERE id = ${id} AND status = ${target}`;
      await prisma.$executeRaw`UPDATE fin_accounting_events SET status = 'FAILED' WHERE id = ${txResult.eventId}`;
      throw e;
    }
  }

  const row = await prisma.$queryRaw<any[]>`SELECT * FROM fin_pdc_register WHERE id = ${id}`;
  return row[0];
}

// ───────────────────────────────────────────────────────────────────────────────
// Unit COA mapping: every unit gets receivable, PDC and deposit Sub-Ledger codes when it is created.
// ───────────────────────────────────────────────────────────────────────────────
export async function ensureUnitCoaMapping(unit: { id: string; property_id: string | null; unit_ref: string; unit_code?: string | null; unit_name?: string | null }) {
  const existing = await prisma.unit_coa_mapping.findUnique({ where: { unit_id: unit.id } });
  if (existing) return existing;
  const name = unit.unit_name || unit.unit_ref;
  const propertyId = unit.property_id ?? '';
  const [rec] = await resolveUnitSl(unit.id, propertyId, PDC_GL.tenantAr, name);
  const [pdc] = await resolveUnitSl(unit.id, propertyId, PDC_GL.pdcInHand, name);
  const [dep] = await resolveUnitSl(unit.id, propertyId, '21500', name);
  return prisma.unit_coa_mapping.create({
    data: {
      unit_id: unit.id,
      property_id: unit.property_id,
      unit_code: unit.unit_code || unit.unit_ref,
      // *_sl_id link to the legacy coa_sl table; the codes below are the source of truth for the new engine.
      receivable_sl_id: null,
      receivable_sl_code: rec.sl_code,
      receivable_sl_name: rec.sl_name,
      pdc_sl_id: null,
      pdc_sl_code: pdc.sl_code,
      pdc_sl_name: pdc.sl_name,
      deposit_sl_id: null,
      deposit_sl_code: dep.sl_code,
      deposit_sl_name: dep.sl_name,
      status: 'Active',
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// postManualVoucher — a hand-entered journal / receipt / payment / contra voucher.
// The server creates the accounting event and its lines, then posts it through postAccountingEvent,
// so the voucher and its lines land in fin_vouchers / fin_voucher_lines (the ledger source of truth).
// ───────────────────────────────────────────────────────────────────────────────
const VOUCHER_PREFIX: Record<string, string> = { Journal: 'JV', Receipt: 'RV', Payment: 'PV', Contra: 'CV' };

export interface ManualVoucherInput {
  voucher_date: string;
  voucher_type?: 'Journal' | 'Receipt' | 'Payment' | 'Contra';
  reference_no?: string | null;
  description?: string | null;
  lines: Array<{ account_code: string; debit?: number; credit?: number; description?: string | null }>;
  property_id?: string | null;
  unit_id?: string | null;
  customer_id?: string | null;
  tenant_id?: string | null;
  lease_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  created_by?: string | null;
  idempotency_key?: string | null;
}

export async function postManualVoucher(input: ManualVoucherInput, externalTx?: any): Promise<PostResult[]> {
  const date = String(input.voucher_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'voucher_date must be YYYY-MM-DD');
  const lines = (input.lines || []).map((l) => ({
    account_code: String(l.account_code || '').trim(),
    debit: money(l.debit),
    credit: money(l.credit),
    description: l.description ? String(l.description) : null,
  })).filter((l) => l.account_code && (l.debit > 0 || l.credit > 0));
  if (lines.length < 2) throw new HttpError(400, 'A voucher needs at least two accounting lines.');
  if (lines.some((l) => l.debit > 0 && l.credit > 0)) throw new HttpError(400, 'A line cannot have both a debit and a credit.');
  const totalDebit = money(lines.reduce((a, l) => a + l.debit, 0));
  const totalCredit = money(lines.reduce((a, l) => a + l.credit, 0));
  if (totalDebit <= 0 || totalDebit !== totalCredit) {
    throw new HttpError(400, `Total Debits (${totalDebit}) must equal Total Credits (${totalCredit}).`);
  }

  const run = async (tx: any): Promise<PostResult[]> => {
    // Every account must exist and be active in the posting chart.
    const codes = Array.from(new Set(lines.map((l) => l.account_code)));
    const found = await tx.$queryRawUnsafe(
      `SELECT account_code, account_name FROM fin_coa_accounts WHERE is_active = TRUE AND account_code IN (${codes.map(() => '?').join(',')})`,
      ...codes,
    ) as any[];
    const names = new Map(found.map((r) => [String(r.account_code), String(r.account_name)]));
    const missing = codes.filter((c) => !names.has(c));
    if (missing.length) throw new HttpError(400, `Account code(s) not in the chart of accounts: ${missing.join(', ')}`);

    // Closed or unseeded posting periods accept no entries (A7).
    const y = Number(date.slice(0, 4));
    await assertPeriodOpen(tx, date);

    const type = input.voucher_type && VOUCHER_PREFIX[input.voucher_type] ? input.voucher_type : 'Journal';
    let reference = input.reference_no && String(input.reference_no).trim();
    if (!reference) {
      await tx.$executeRaw`INSERT INTO app_sequences (name, current_value) VALUES (${`voucher_${type.toLowerCase()}_${y}`}, 1)
        ON DUPLICATE KEY UPDATE current_value = current_value + 1`;
      const seqRows = await tx.$queryRaw<{ current_value: bigint }[]>`
        SELECT current_value FROM app_sequences WHERE name = ${`voucher_${type.toLowerCase()}_${y}`}`;
      const seq = Number(seqRows[0].current_value);
      reference = `${VOUCHER_PREFIX[type]}-${y}-${String(seq).padStart(6, '0')}`;
    }
    // D2: Use explicit idempotency_key when provided; omit date for caller-supplied references so retries across dates don't double-post.
    const idempotencyKey = input.idempotency_key
      ? String(input.idempotency_key)
      : input.reference_no && String(input.reference_no).trim()
        ? `MANUAL|${type}|${reference}`
        : `MANUAL|${type}|${reference}|${date}`;

    // A repeat of the same voucher returns the one already posted.
    const existing = await tx.$queryRaw<any[]>`SELECT id, status FROM fin_accounting_events WHERE idempotency_key = ${idempotencyKey} LIMIT 1`;
    if (existing.length && existing[0].status === 'POSTED') return postAccountingEvent(String(existing[0].id), tx);
    if (existing.length) {
      await tx.$executeRaw`DELETE FROM fin_accounting_event_lines WHERE event_id = ${existing[0].id}`;
      await tx.$executeRaw`DELETE FROM fin_accounting_events WHERE id = ${existing[0].id}`;
    }

    const eventId = randomUUID();
    await tx.$executeRaw`INSERT INTO fin_accounting_events
      (id, event_type, status, event_date, posting_date, source_type, source_id, reference_number, description, idempotency_key,
       property_id, unit_id, customer_id, tenant_id, lease_id, total_debit, total_credit, created_by)
      VALUES (${eventId}, 'MANUAL_JOURNAL', 'DRAFT', ${date}, ${date}, ${input.source_type || 'MANUAL_VOUCHER'}, ${input.source_id || null}, ${reference}, ${input.description || null},
              ${idempotencyKey}, ${input.property_id || null}, ${input.unit_id || null}, ${input.customer_id || null},
              ${input.tenant_id || null}, ${input.lease_id || null}, ${totalDebit}, ${totalCredit}, ${input.created_by || null})`;
    let n = 0;
    for (const l of lines) {
      n += 1;
      await tx.$executeRaw`INSERT INTO fin_accounting_event_lines
        (id, event_id, line_number, account_code, account_name, debit, credit, description, property_id, unit_id, customer_id, tenant_id, lease_id)
        VALUES (${randomUUID()}, ${eventId}, ${n}, ${l.account_code}, ${names.get(l.account_code) || null}, ${l.debit}, ${l.credit},
                ${l.description}, ${input.property_id || null}, ${input.unit_id || null}, ${input.customer_id || null},
                ${input.tenant_id || null}, ${input.lease_id || null})`;
    }

    return postAccountingEvent(eventId, tx);
  };

  return externalTx ? run(externalTx) : txn(run);
}
