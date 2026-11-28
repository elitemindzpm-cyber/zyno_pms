// server/services/posting.ts
// One helper for every feature that posts to the general ledger. It builds a balanced, idempotent
// accounting event and hands it to the posting engine (postAccountingEvent), which enforces the
// balance check, the closed-period check and the active-account check.
import prisma from '../lib/prisma';
import { txn } from '../lib/prisma';
import { postAccountingEvent } from '../lib/finance-rpc';
import { HttpError } from '../lib/errors';
import { money } from '../lib/money';

export type GlLine = {
  code: string;
  debit: number;
  credit: number;
  description?: string;
  lease_id?: string | null;
  unit_id?: string | null;
  customer_id?: string | null;
  property_id?: string | null;
};

export type PostOptions = {
  eventType: string;          // must be a value of fin_accounting_events_event_type
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;     // unique per business event; a repeat returns the earlier posting
  description: string;
  lines: GlLine[];
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  customerId?: string | null;
  postingDate?: Date;
  tx?: any;
};

export type PostedEvent = { eventId: string; voucherId: string | null; voucherNumber: string | null; duplicate: boolean };

export async function postGlEvent(opts: PostOptions): Promise<PostedEvent> {
  const db = opts.tx ?? prisma;
  // Same key again: return the earlier result instead of posting twice.
  const existing = await db.fin_accounting_events.findUnique({ where: { idempotency_key: opts.idempotencyKey } });
  if (existing) {
    if (String(existing.status) !== 'POSTED') {
      const [p] = await postAccountingEvent(existing.id, opts.tx);
      return { eventId: existing.id, voucherId: p.voucher_id, voucherNumber: p.voucher_number, duplicate: true };
    }
    const v = await db.fin_vouchers.findFirst({ where: { accounting_event_id: existing.id }, select: { id: true, voucher_number: true } });
    return { eventId: existing.id, voucherId: v?.id ?? null, voucherNumber: v?.voucher_number ?? null, duplicate: true };
  }

  const lines = opts.lines
    .map((l) => ({ ...l, debit: money(l.debit), credit: money(l.credit) }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  const totalDebit = money(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = money(lines.reduce((s, l) => s + l.credit, 0));
  if (lines.length < 2 || totalDebit <= 0) throw new HttpError(400, `Accounting event "${opts.description}" has no postable amount`);
  if (totalDebit !== totalCredit) {
    throw new HttpError(400, `Total Debits (${totalDebit}) must equal Total Credits (${totalCredit}). Out of balance by ${money(Math.abs(totalDebit - totalCredit))}`);
  }

  // Resolve every account to an active COA row before anything is written.
  const coa = new Map<string, { id: string; account_code: string; account_name: string }>();
  for (const l of lines) {
    if (coa.has(l.code)) continue;
    const row = await db.fin_coa_accounts.findFirst({
      where: { account_code: l.code, is_active: true }, select: { id: true, account_code: true, account_name: true },
    });
    if (!row) throw new HttpError(400, `GL account ${l.code} is not active in the chart of accounts`);
    coa.set(l.code, row);
  }

  const eventId = crypto.randomUUID();
  const now = opts.postingDate ?? new Date();
  const writeEvent = async (tx: any) => {
    await tx.fin_accounting_events.create({
      data: {
        id: eventId,
        event_type: opts.eventType as any,
        status: 'DRAFT',
        event_date: now,
        posting_date: now,
        source_type: opts.sourceType,
        source_id: opts.sourceId,
        idempotency_key: opts.idempotencyKey,
        description: opts.description,
        total_debit: totalDebit,
        total_credit: totalCredit,
        metadata: '{}',
        lease_id: opts.leaseId ?? null,
        property_id: opts.propertyId ?? null,
        unit_id: opts.unitId ?? null,
        customer_id: opts.customerId ?? null,
      },
    });
    for (const [i, l] of lines.entries()) {
      const a = coa.get(l.code)!;
      await tx.fin_accounting_event_lines.create({
        data: {
          event_id: eventId,
          line_number: i + 1,
          account_id: a.id,
          account_code: a.account_code,
          account_name: a.account_name,
          debit: l.debit,
          credit: l.credit,
          description: l.description ?? opts.description,
          lease_id: l.lease_id ?? opts.leaseId ?? null,
          unit_id: l.unit_id ?? opts.unitId ?? null,
          customer_id: l.customer_id ?? opts.customerId ?? null,
          property_id: l.property_id ?? opts.propertyId ?? null,
          source_type: opts.sourceType,
          source_id: opts.sourceId,
        },
      });
    }
  };

  if (opts.tx) {
    await writeEvent(opts.tx);
    const [posted] = await postAccountingEvent(eventId, opts.tx);
    return { eventId, voucherId: posted.voucher_id, voucherNumber: posted.voucher_number, duplicate: false };
  }

  await txn(writeEvent);
  const [posted] = await postAccountingEvent(eventId);
  return { eventId, voucherId: posted.voucher_id, voucherNumber: posted.voucher_number, duplicate: false };
}
