// server/services/property.ts
// Units, customers, reservations, the reservation-expiry job, and market-rent pricing.
// Shared by the dedicated routes and by the generic DB API that the UI uses.
import prisma from '../lib/prisma';
import { txn } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { ensureUnitCoaMapping } from '../lib/finance-rpc';
import { num, money } from './leases';

export const LIVE_RESERVATION_STATUSES = ['Active', 'ACTIVE', 'Confirmed', 'CONFIRMED'];
const OCCUPIED_UNIT = ['OCCUPIED', 'Occupied', 'occupied'];

// ── Units ───────────────────────────────────────────────────────────────────────
/** Creates a unit (unique unit number per property) and its COA / Sub-Ledger mapping. */
export async function createUnit(body: Record<string, any>) {
  const unit = await txn(async (tx) => {
    if (body.property_id) {
      // Lock the property so two concurrent creates cannot both pass the duplicate check.
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${body.property_id} FOR UPDATE`;
    }
    if (body.property_id && body.unit_number) {
      const dup = await tx.units.findFirst({
        where: { property_id: body.property_id, unit_number: String(body.unit_number) }, select: { id: true },
      });
      if (dup) throw new HttpError(409, `Unit ${body.unit_number} already exists in this property`);
    }
    return tx.units.create({ data: body as any });
  });
  try {
    await ensureUnitCoaMapping(unit as any);
  } catch (mapErr) {
    await prisma.fin_unit_sl_accounts.deleteMany({ where: { unit_id: unit.id } });
    await prisma.units.deleteMany({ where: { id: unit.id } });
    throw mapErr;
  }
  return unit;
}

/** Protects a property from deletion while it has occupied units or live leases. */
export async function assertPropertyDeletable(propertyId: string) {
  const occupied = await prisma.units.count({ where: { property_id: propertyId, status: { in: OCCUPIED_UNIT } } });
  const live = await prisma.leases.count({
    where: { property_id: propertyId, lease_status: { in: ['ACTIVE', 'Active', 'active', 'PENDING', 'Pending', 'pending'] } },
  });
  if (occupied > 0 || live > 0) throw new HttpError(400, 'Cannot delete property with active leases or occupied units');
}

// ── Market rent ─────────────────────────────────────────────────────────────────
const HIGH_FLOOR_MIN = 10;

function ruleApplies(rule: { rule_type: string; unit_id: string | null }, unit: { id: string; floor_number: string | null; view_type: string | null }) {
  if (rule.unit_id) return rule.unit_id === unit.id;           // a rule set on this unit always applies
  switch (rule.rule_type.toUpperCase()) {
    case 'HIGH_FLOOR': return parseInt(unit.floor_number ?? '', 10) >= HIGH_FLOOR_MIN;
    case 'SEA_VIEW': return /sea/i.test(unit.view_type ?? '');
    default: return false;
  }
}

/** Market rent = base × (1 + Σ percentage adjustments) + Σ fixed adjustments, from the pricing rules in force today. */
export async function computeMarketRent(unitId: string, baseOverride?: number) {
  const unit = await prisma.units.findUnique({ where: { id: unitId } });
  if (!unit) throw new HttpError(404, 'Unit not found');
  const base = money(baseOverride ?? (num(unit.price) || num(unit.current_rent)));
  if (!(base > 0)) throw new HttpError(400, 'Unit has no base rent to price from');

  const today = new Date();
  const rules = await prisma.pricing_rules.findMany({
    where: {
      AND: [
        { start_date: { lte: today } },
        { end_date: { gte: today } },
        { OR: [{ unit_id: unitId }, { unit_id: null }] },
      ],
    },
  });
  const applicable = rules.filter((r) => ruleApplies(r, unit));
  let pct = 0;
  let fixed = 0;
  const adjustments = applicable.map((r) => {
    const value = num(r.value);
    if (String(r.adjustment_type).toLowerCase() === 'fixed') fixed += value;
    else pct += value;
    return { rule_type: r.rule_type, adjustment_type: r.adjustment_type, value };
  });
  const marketRent = money(base * (1 + pct / 100) + fixed);
  await prisma.units.update({ where: { id: unitId }, data: { market_rent: marketRent } });
  return { unit_id: unitId, base_rent: base, percentage_total: pct, fixed_total: fixed, adjustments, market_rent: marketRent };
}

// ── Customers ───────────────────────────────────────────────────────────────────
/** Individuals need a Qatar ID or passport; corporates need a CR and a trade licence. No duplicate IDs. */
export async function createCustomer(body: Record<string, any>) {
  const type = String(body.customer_type || 'Individual').toLowerCase();
  if (type === 'corporate' || type === 'company') {
    if (!body.commercial_registration || !body.trade_licence_no) {
      throw new HttpError(400, 'Corporate customers require a commercial registration number and a trade licence number');
    }
  } else if (!body.qatar_id && !body.passport_number) {
    throw new HttpError(400, 'Individual customers require a Qatar ID or a passport number');
  }
  return txn(async (tx) => {
    const ids: any[] = [];
    if (body.qatar_id) ids.push({ qatar_id: String(body.qatar_id) });
    if (body.tax_identification_no) ids.push({ tax_identification_no: String(body.tax_identification_no) });
    if (ids.length) {
      const dup = await tx.customers.findFirst({ where: { OR: ids }, select: { id: true } });
      if (dup) throw new HttpError(409, 'A customer with this National ID/Tax Number already exists');
    }
    return tx.customers.create({ data: body as any });
  });
}

// ── Reservations ────────────────────────────────────────────────────────────────
/** Reserves a unit under a row lock, refusing it if it is already reserved, leased, or held. */
export async function createReservation(body: Record<string, any>) {
  return txn(async (tx) => {
    if (body.unit_id) {
      const units = await tx.$queryRaw<{ id: string; status: string | null }[]>`
        SELECT id, status FROM units WHERE id = ${body.unit_id} FOR UPDATE`;
      if (!units.length) throw new HttpError(404, 'Unit not found');
      const st = String(units[0].status || '').toUpperCase();
      if (st === 'OCCUPIED' || st === 'RESERVED') throw new HttpError(409, 'Unit has already been reserved or leased');
      const live = await tx.reservations.findFirst({
        where: {
          unit_id: body.unit_id,
          status: { in: LIVE_RESERVATION_STATUSES },
          OR: [{ reservation_validity: null }, { reservation_validity: { gte: new Date() } }],
        },
        select: { id: true },
      });
      if (live) throw new HttpError(409, 'Unit has already been reserved or leased');
      await tx.units.update({ where: { id: body.unit_id }, data: { status: 'Reserved' } });
    }
    return tx.reservations.create({ data: body as any });
  });
}

/**
 * Reservation-expiry job. Reservations whose validity has passed become EXPIRED, and their unit is
 * released when no other live reservation holds it. Pass ids to limit the run to specific reservations.
 */
export async function expireReservations(opts: { ids?: string[]; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const due = await prisma.reservations.findMany({
    where: {
      status: { in: LIVE_RESERVATION_STATUSES },
      reservation_validity: { lt: now, not: null },
      ...(opts.ids ? { id: { in: opts.ids } } : {}),
    },
  });
  const releasedUnits: string[] = [];
  for (const r of due) {
    await prisma.reservations.update({ where: { id: r.id }, data: { status: 'EXPIRED' } });
    if (!r.unit_id) continue;
    const stillHeld = await prisma.reservations.count({
      where: {
        unit_id: r.unit_id,
        status: { in: LIVE_RESERVATION_STATUSES },
        OR: [{ reservation_validity: null }, { reservation_validity: { gte: now } }],
      },
    });
    if (stillHeld === 0) {
      await prisma.units.updateMany({ where: { id: r.unit_id, status: { in: ['Reserved', 'RESERVED'] } }, data: { status: 'Available' } });
      releasedUnits.push(r.unit_id);
    }
  }
  return { expired: due.length, reservation_ids: due.map((r) => r.id), released_units: releasedUnits };
}
