// server/services/leases.ts
// Lease rules, shared by POST /api/leases and by the generic DB API (which the UI uses).
// PDCs are stored in fin_pdc_register, the single PDC store the UI and the PDC engine both use.
import prisma from '../lib/prisma';
import { txn } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { nextIntSequence } from '../lib/finance-rpc';
import { postGlEvent } from './posting';

export const ACTIVE_LEASE_STATUSES = ['ACTIVE', 'Active', 'active', 'PENDING', 'Pending', 'pending'];
/** A cheque that has not been deposited, so it can still be voided when a lease ends. */
const UNMATURED_PDC_STATUSES = ['In Hand', 'IN HAND', 'in hand', 'SCHEDULED', 'Scheduled', 'ISSUED'];
/** Placeholder rows generated from number_of_pdc; a real cheque entered for the lease fills one of these. */
export const SCHEDULED_SLOT = 'SCHEDULED';

export const isActiveLease = (s: unknown) => ACTIVE_LEASE_STATUSES.includes(String(s ?? ''));
export const isTerminatedLease = (s: unknown) => String(s ?? '').toUpperCase() === 'TERMINATED';
export const num = (v: unknown) => Number(String(v ?? 0)) || 0;
export const money = (n: number) => Math.round(n * 100) / 100;

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

/** Date-only strings from the UI are stored as UTC midnight (Prisma DateTime fields need a full ISO value). */
export function normaliseDates<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (/_date$/.test(k) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = `${v}T00:00:00.000Z`;
  }
  return out as T;
}

const toDate = (v: unknown) => {
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : new Date(s);
};

/** Next register id. fin_pdc_register.id has no auto-increment, so it comes from the shared sequence table. */
export async function nextPdcId(): Promise<bigint> {
  return BigInt(await nextIntSequence('fin_pdc_register_id'));
}

const numericOrNull = (v: unknown) => (v !== undefined && v !== null && /^\d+$/.test(String(v)) ? BigInt(String(v)) : null);

/** Maps a PDC as the UI or API describes it onto fin_pdc_register columns. */
function registerData(row: Record<string, any>, leaseId: string | null, id: bigint) {
  const chequeNumber = row.cheque_number !== undefined && row.cheque_number !== null ? String(row.cheque_number).trim() : '';
  if (!chequeNumber) throw new HttpError(422, 'cheque_number is required for a PDC');
  const maturity = row.cheque_date ?? row.maturity_date;
  if (!maturity) throw new HttpError(422, 'maturity_date is required for a PDC');
  const data: Record<string, any> = {
    id,
    lease_id: leaseId,
    cheque_number: chequeNumber,
    cheque_date: toDate(maturity),
    amount: money(num(row.amount)),
    status: row.status || 'In Hand',
  };
  if (row.deposit_date) data.deposit_date = toDate(row.deposit_date);
  const tenant = numericOrNull(row.tenant_id);
  const property = numericOrNull(row.property_id);
  const unit = numericOrNull(row.unit_id);
  const bank = numericOrNull(row.bank_id);
  if (tenant !== null) data.tenant_id = tenant;
  if (property !== null) data.property_id = property;
  if (unit !== null) data.unit_id = unit;
  if (bank !== null) data.bank_id = bank;
  return data;
}

/**
 * Inserts one PDC. A cheque already on the lease is not stored twice, and a real cheque fills the
 * earliest unclaimed scheduled slot instead of adding a row.
 */
export async function insertPdc(row: Record<string, any>) {
  const leaseId = row.lease_id ? String(row.lease_id) : null;
  if (leaseId && row.cheque_number) {
    const dup = await prisma.fin_pdc_register.findFirst({ where: { lease_id: leaseId, cheque_number: String(row.cheque_number) } });
    if (dup) return dup;
  }
  if (leaseId) {
    const slot = await prisma.fin_pdc_register.findFirst({
      where: { lease_id: leaseId, status: SCHEDULED_SLOT }, orderBy: { cheque_date: 'asc' },
    });
    if (slot) {
      const { id: _ignored, ...data } = registerData(row, leaseId, slot.id);
      return prisma.fin_pdc_register.update({ where: { id: slot.id }, data: data as any });
    }
  }
  const id = numericOrNull(row.id) ?? (await nextPdcId());
  return prisma.fin_pdc_register.create({ data: registerData(row, leaseId, id) as any });
}

/** Creates a lease, its PDCs and its unit status in one transaction, then records the deposit. */
export async function createLease(input: Record<string, any>) {
  const { pdc_schedule, pdcs, ...raw } = input || {};
  const body = normaliseDates({ ...raw });
  const start = body.commencement_date ? new Date(body.commencement_date) : null;
  const end = body.expiry_date ? new Date(body.expiry_date) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpError(422, 'commencement_date and expiry_date are required');
  }
  if (end.getTime() <= start.getTime()) throw new HttpError(422, 'End date must be strictly after start date');

  // The cheques to store: the ones supplied with the lease, or an evenly spread placeholder schedule.
  let cheques: Record<string, any>[] = [];
  if (Array.isArray(pdcs) && pdcs.length) {
    cheques = pdcs;
  } else {
    const n = Number(body.number_of_pdc ?? 0);
    if (n > 0 && pdc_schedule !== 'none') {
      const rent = num(body.rental_amount);
      const per = money(rent / n);
      const months = Number(body.lease_period_months) || 12;
      cheques = Array.from({ length: n }, (_, i) => ({
        cheque_number: `${body.lease_number}-${String(i + 1).padStart(2, '0')}`,
        amount: i === n - 1 ? money(rent - per * (n - 1)) : per,
        maturity_date: addMonths(start, Math.round((i * months) / n)),
        status: SCHEDULED_SLOT,
      }));
    }
  }
  const ids: bigint[] = [];
  for (let i = 0; i < cheques.length; i++) ids.push(await nextPdcId());

  const lease = await txn(async (tx) => {
    if (body.customer_id) {
      const customer = await tx.customers.findUnique({ where: { id: body.customer_id } });
      if (customer && String(customer.customer_status || '').toLowerCase() === 'blacklisted') {
        throw new HttpError(403, `Cannot create lease for blacklisted customer. Reason: ${customer.remarks || 'Blacklisted'}`);
      }
    }
    if (body.unit_id && isActiveLease(body.lease_status)) {
      // Serialise lease creation per unit, then look for an overlapping live lease.
      const units = await tx.$queryRaw<{ id: string; unit_ref: string }[]>`
        SELECT id, unit_ref FROM units WHERE id = ${body.unit_id} FOR UPDATE`;
      const unitRef = units[0]?.unit_ref ?? String(body.unit_id);
      const conflict = await tx.leases.findFirst({
        where: {
          unit_id: body.unit_id,
          // A renewal may overlap the lease it replaces; that parent is marked RENEWED in this transaction.
          ...(body.previous_lease_id ? { id: { not: body.previous_lease_id } } : {}),
          lease_status: { in: ACTIVE_LEASE_STATUSES },
          commencement_date: { lte: end },
          expiry_date: { gte: start },
        },
      });
      if (conflict) {
        const fmt = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '?');
        throw new HttpError(409,
          `Unit ${unitRef} has an active lease conflict between ${fmt(start)} and ${fmt(conflict.expiry_date)}`);
      }
    }

    const created = await tx.leases.create({ data: body as any });

    if (created.unit_id && isActiveLease(created.lease_status)) {
      await tx.units.updateMany({ where: { id: created.unit_id }, data: { status: 'Occupied' } });
    }
    if (created.previous_lease_id) {
      await tx.leases.updateMany({ where: { id: created.previous_lease_id }, data: { lease_status: 'RENEWED' } });
    }

    for (const [i, row] of cheques.entries()) {
      const data = registerData(row, created.id, ids[i]);
      const dup = await tx.fin_pdc_register.findFirst({ where: { lease_id: created.id, cheque_number: data.cheque_number } });
      if (!dup) await tx.fin_pdc_register.create({ data: data as any });
    }
    return created;
  });

  // Security deposit received: Dr Bank / Cr Deposits liability.
  const deposit = money(num(lease.security_deposit));
  if (deposit > 0) {
    await postGlEvent({
      eventType: 'SECURITY_DEPOSIT_RECEIVED', sourceType: 'LEASE_DEPOSIT', sourceId: lease.id,
      idempotencyKey: `deposit:${lease.id}`, description: `Security deposit received - ${lease.lease_number}`,
      lines: [
        { code: '12000', debit: deposit, credit: 0 },
        { code: '21500', debit: 0, credit: deposit },
      ],
      leaseId: lease.id, unitId: lease.unit_id, customerId: lease.customer_id, propertyId: lease.property_id,
    });
  }
  return lease;
}

/**
 * Terminates a lease: cancels unmatured PDCs, releases the unit, and settles the security deposit.
 *   applied  = min(deposit, damage + early-termination penalty)   -> income from the deposit
 *   excess   = deductions beyond the deposit                      -> billed to the tenant
 *   refund   = deposit - applied                                  -> refund voucher to the tenant
 */
export async function terminateLease(id: string, input: Record<string, any> = {}) {
  const lease = await prisma.leases.findUnique({ where: { id } });
  if (!lease) throw new HttpError(404, 'Lease not found');
  if (isTerminatedLease(lease.lease_status)) throw new HttpError(409, 'Lease is already terminated');

  const deposit = money(num(lease.security_deposit));
  const damage = money(num(input.damage_charges));
  const penalty = money(num(input.early_termination_penalty));
  const deductions = money(damage + penalty);
  const applied = money(Math.min(deposit, deductions));
  const excess = money(deductions - applied);
  const refund = money(deposit - applied);

  const cancelled = await txn(async (tx) => {
    await tx.leases.updateMany({ where: { id }, data: { lease_status: 'TERMINATED' } });
    const res = await tx.fin_pdc_register.updateMany({
      where: { lease_id: id, status: { in: UNMATURED_PDC_STATUSES }, cheque_date: { gt: new Date() } },
      data: { status: 'Cancelled' },
    });
    if (lease.unit_id) await tx.units.updateMany({ where: { id: lease.unit_id }, data: { status: 'Available' } });
    return res.count;
  });

  const ref = { leaseId: lease.id, unitId: lease.unit_id, customerId: lease.customer_id, propertyId: lease.property_id };
  const label = lease.lease_number;
  let adjustment: string | null = null;
  let refundVoucher: string | null = null;

  if (applied > 0) {
    const p = await postGlEvent({
      eventType: 'SECURITY_DEPOSIT_ADJUSTED', sourceType: 'LEASE_TERMINATION', sourceId: id,
      idempotencyKey: `termination-deduct:${id}`, description: `Deposit applied to damages and penalties - ${label}`,
      lines: [
        { code: '21500', debit: applied, credit: 0 },
        { code: '41201', debit: 0, credit: applied },
      ], ...ref,
    });
    adjustment = p.voucherNumber;
  }
  if (excess > 0) {
    await postGlEvent({
      eventType: 'ADJUSTMENT', sourceType: 'LEASE_TERMINATION', sourceId: id,
      idempotencyKey: `termination-excess:${id}`, description: `Damages billed to tenant beyond deposit - ${label}`,
      lines: [
        { code: '12413', debit: excess, credit: 0 },
        { code: '41201', debit: 0, credit: excess },
      ], ...ref,
    });
  }
  if (refund > 0) {
    const p = await postGlEvent({
      eventType: 'SECURITY_DEPOSIT_REFUNDED', sourceType: 'LEASE_TERMINATION', sourceId: id,
      idempotencyKey: `termination-refund:${id}`, description: `Security deposit refund - ${label}`,
      lines: [
        { code: '21500', debit: refund, credit: 0 },
        { code: '12000', debit: 0, credit: refund },
      ], ...ref,
    });
    refundVoucher = p.voucherNumber;
  }

  return {
    lease_id: id,
    deposit,
    damage_charges: damage,
    early_termination_penalty: penalty,
    applied_from_deposit: applied,
    billed_to_tenant: excess,
    refund,
    refund_voucher: refundVoucher,
    deduction_voucher: adjustment,
    pdcs_cancelled: cancelled,
  };
}
