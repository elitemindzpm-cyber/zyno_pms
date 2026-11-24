// e2e/pms.e2e.test.mjs
// End-to-end suite for the PMS/ERP spec (AUTH-001 … PORT-002).
//
// Run against a live API server:   npm run api:dev   (default http://localhost:3002, override with E2E_API)
//                                  node --test e2e/pms.e2e.test.mjs
//
// Test names carry the spec ID. Where one ID has several checks they are suffixed a/b/c.
// A failing test means the running API does not meet the spec's expected outcome; the assertion
// message shows the actual HTTP status and body. A skipped test names why it is not automated.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, TAG, ROOT, dotenv, trackIds } from './lib/env.mjs';
import { call, idOf, short } from './lib/api.mjs';
import {
  makeTenantOrg, makeUser, makeProperty, makeUnit, makeCustomer, makeLease,
  makePdc, callRpc, daysFromNow, isoDT, dateOnly,
} from './lib/fixtures.mjs';
import { cleanup } from './cleanup.mjs';
import { ensureTestAccounts } from './lib/fixtures.mjs';

// Safety: this suite writes test rows (and removes them) in the database named in .env.
// Run it only on purpose: set E2E_ALLOW_LIVE_DB=1 for that run.
if (process.env.E2E_ALLOW_LIVE_DB !== '1') {
  throw new Error('E2E writes to the database in .env. Set E2E_ALLOW_LIVE_DB=1 to run it deliberately.');
}

const ctx = {};
const JWT_SECRET = dotenv.parse(fs.readFileSync(path.join(ROOT, '.env'))).JWT_SECRET;
const rnd = () => crypto.randomUUID().slice(0, 8);
const money = (n) => Math.round(Number(n) * 100) / 100;

const expectStatus = (r, status, label) =>
  assert.equal(r.status, status, `${label}: expected HTTP ${status}, got ${r.status}. body=${short(r.body)}`);

// ── Helper: two active chart-of-accounts rows ───────────────────────────────────
async function pickAccounts() {
  const rows = await db.fin_coa_accounts.findMany({ where: { is_active: true }, orderBy: { account_code: 'asc' }, take: 20 });
  const a = rows[0];
  const b = rows.find((r) => r.account_code !== a?.account_code);
  if (!a || !b) throw new Error('Need at least two active fin_coa_accounts rows');
  return [a, b];
}
const account = (code) => db.fin_coa_accounts.findFirst({ where: { account_code: code, is_active: true } });

// ── Helper: a balanced journal through the generic DB API (what the UI does) ────
async function makeEvent({ dr, cr, amount, creditAmount = amount, eventDate, label, cookie = null }) {
  const [a, b] = dr && cr ? [dr, cr] : await pickAccounts();
  const ev = await call('POST', '/api/db/fin_accounting_events/insert', {
    cookie: cookie ?? ctx.finance.cookie,
    body: {
      data: {
        event_type: 'MANUAL_JOURNAL', status: 'DRAFT', event_date: eventDate, posting_date: eventDate,
        source_type: 'E2E_TEST', source_id: TAG, idempotency_key: `${TAG}-${label}-${rnd()}`,
        description: `${TAG} ${label}`,         total_debit: amount, total_credit: creditAmount, metadata: '{}',
      },
    },
  });
  expectStatus(ev, 200, `${label}: create event`);
  const eventId = ev.body?.data?.id ?? ev.body?.id;
  for (const [i, line] of [{ acct: a, debit: amount, credit: 0 }, { acct: b, debit: 0, credit: creditAmount }].entries()) {
    const l = await call('POST', '/api/db/fin_accounting_event_lines/insert', {
      cookie: cookie ?? ctx.finance.cookie,
      body: {
        data: {
          event_id: eventId, line_number: i + 1, account_id: line.acct.id, account_code: line.acct.account_code,
          account_name: line.acct.account_name, debit: line.debit, credit: line.credit, description: `${TAG} ${label}`,
        },
      },
    });
    expectStatus(l, 200, `${label}: create line ${i + 1}`);
  }
  return { eventId };
}

// ── Fixtures ────────────────────────────────────────────────────────────────────
before(async () => {
  ctx.tA = await makeTenantOrg('a');
  ctx.tB = await makeTenantOrg('b');
  ctx.admin = await makeUser('admin', 'ADMIN');
  ctx.finance = await makeUser('finance', 'FINANCE');
  ctx.tenantA = await makeUser('tenant-a', 'TENANT', ctx.tA.id);
  ctx.tenantB = await makeUser('tenant-b', 'TENANT', ctx.tB.id);
  await ensureTestAccounts();
});

after(async () => {
  await cleanup();
  await db.$disconnect();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 1: Authentication, Sessions, RBAC & Multi-Tenancy', () => {
  test('AUTH-001 admin login returns a session cookie and the session resolves', async () => {
    assert.ok(ctx.admin.cookie, 'admin session cookie missing from fixtures');
    const s = await call('GET', '/api/auth/session', { cookie: ctx.admin.cookie });
    expectStatus(s, 200, 'session check');
    assert.ok(['ADMIN', 'SUPER_ADMIN'].includes(s.body?.user?.role ?? s.body?.role), `role not admin: ${short(s.body)}`);
  });

  test('AUTH-002 brute-force: attempts 6+ are rate limited with Retry-After', async () => {
    const statuses = [];
    let retryAfter = null;
    for (let i = 0; i < 10; i++) {
      const r = await call('POST', '/api/auth/login', { body: { email: ctx.admin.email, password: `wrong-${i}` } });
      statuses.push(r.status);
      if (r.status === 429) retryAfter = r.headers.get('retry-after');
    }
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401], `first 5 attempts: ${statuses}`);
    assert.ok(statuses.slice(5).includes(429), `no HTTP 429 in attempts 6-10: ${statuses}`);
    assert.ok(retryAfter, 'Retry-After header missing on 429');
  });

  test('AUTH-003a tenant cannot POST accounting vouchers (expects 403)', async () => {
    const r = await call('POST', '/api/accounting/vouchers', {
      cookie: ctx.tenantA.cookie, body: { voucher_number: `${TAG}-AUTH003A`, voucher_type: 'JV' },
    });
    expectStatus(r, 403, 'tenant voucher POST');
  });

  test('AUTH-003b tenant cannot GET /api/properties (expects 403)', async () => {
    const r = await call('GET', '/api/properties', { cookie: ctx.tenantA.cookie });
    expectStatus(r, 403, 'tenant GET properties');
  });

  test('AUTH-003c tenant cannot write fin_vouchers through the generic DB API (expects 403)', async () => {
    const r = await call('POST', '/api/db/fin_vouchers/insert', {
      cookie: ctx.tenantA.cookie,
      body: { data: { voucher_number: `${TAG}-AUTH003C`, voucher_date: isoDT(new Date()), voucher_type: 'JV', status: 'DRAFT', description: 'E2E RBAC probe' } },
    });
    expectStatus(r, 403, 'tenant generic voucher insert');
  });

  test('AUTH-004a tenant A cannot read tenant B lease by id (expects 403/404)', async () => {
    const prop = await makeProperty('AUTH-004 property', ctx.admin.cookie);
    const unit = await makeUnit(prop, '401', 'Occupied', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, created_by: ctx.tenantB.id }, ctx.admin.cookie);
    const r = await call('GET', `/api/leases/${lease.id}`, { cookie: ctx.tenantA.cookie });
    assert.ok([403, 404].includes(r.status), `expected 403/404, got ${r.status}. body=${short(r.body)}`);
  });

  test('AUTH-004b tenant A lease list does not contain tenant B lease', async () => {
    const prop = await makeProperty('AUTH-004b property', ctx.admin.cookie);
    const unit = await makeUnit(prop, '402', 'Occupied', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, created_by: ctx.tenantB.id }, ctx.admin.cookie);
    const r = await call('GET', '/api/leases', { cookie: ctx.tenantA.cookie });
    expectStatus(r, 200, 'tenant A lease list');
    assert.ok(!(r.body?.data ?? []).map((x) => x.id).includes(lease.id), 'tenant A can see tenant B lease in list');
  });

  test('AUTH-005 forged, unsigned, wrong-key, expired and tampered tokens return 401', async () => {
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const sign = (payload, key) => {
      const h = b64({ alg: 'HS256', typ: 'JWT' });
      const p = b64(payload);
      return `${h}.${p}.${crypto.createHmac('sha256', key).update(`${h}.${p}`).digest('base64url')}`;
    };
    const claims = { sub: ctx.admin.id, email: ctx.admin.email, role: 'SUPER_ADMIN', tenant_id: null, iat: now, exp: now + 3600 };
    const realToken = ctx.admin.cookie.split('=')[1];
    const [rh, , rs] = realToken.split('.');
    const cases = {
      'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`,
      'wrong key': sign(claims, 'not-the-server-secret'),
      expired: sign({ ...claims, exp: now - 60 }, JWT_SECRET),
      'tampered payload with original signature': `${rh}.${b64({ ...claims, tenant_id: 'x' })}.${rs}`,
      'truncated signature': realToken.slice(0, -6),
    };
    for (const [name, tok] of Object.entries(cases)) {
      const r = await call('GET', '/api/properties', { cookie: `pms_session=${tok}` });
      assert.equal(r.status, 401, `${name}: expected 401, got ${r.status}`);
    }
    const none = await call('GET', '/api/properties');
    assert.equal(none.status, 401, `no credentials: expected 401, got ${none.status}`);
  });

  test.skip('AUTH-006 idle session timeout shows "Session Expired" modal and redirects to /auth', {
    skip: 'Browser behaviour (client idle timer in src/routes/__root.tsx). Verified in the browser, not from the API.',
  }, () => {});
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 2: Property Hierarchy, Unit Master & Pricing Rules', () => {
  test('PROP-001a property and units are saved with valid foreign keys', async () => {
    const prop = await makeProperty('PROP-001', ctx.admin.cookie);
    const u1 = await makeUnit(prop, '101', 'Available', ctx.admin.cookie);
    const u2 = await makeUnit(prop, '102', 'Available', ctx.admin.cookie);
    const units = await db.units.findMany({ where: { property_id: prop.id } });
    assert.equal(units.length, 2, `expected 2 units linked to property, got ${units.length}`);
    assert.deepEqual(units.map((u) => u.id).sort(), [u1.id, u2.id].sort());
  });

  test('PROP-001b each unit has a default COA/Sub-Ledger mapping (unit_coa_mapping)', async () => {
    const prop = await makeProperty('PROP-001b', ctx.admin.cookie);
    const u = await makeUnit(prop, '201', 'Available', ctx.admin.cookie);
    const mapping = await db.unit_coa_mapping.findUnique({ where: { unit_id: u.id } });
    assert.ok(mapping, `no unit_coa_mapping row created for unit ${u.id}`);
    assert.ok(mapping.receivable_sl_code && mapping.pdc_sl_code && mapping.deposit_sl_code, 'mapping is missing sub-ledger codes');
  });

  test('PROP-002 duplicate unit number in the same property returns 409', async () => {
    const prop = await makeProperty('PROP-002', ctx.admin.cookie);
    await makeUnit(prop, '101', 'Available', ctx.admin.cookie);
    const dup = await call('POST', '/api/units', {
      cookie: ctx.admin.cookie,
      body: { property_id: prop.id, unit_ref: `${TAG}-dup-101`, unit_number: '101', status: 'Available' },
    });
    expectStatus(dup, 409, 'duplicate unit 101');
  });

  test('PROP-003 deleting a property with an occupied unit and active lease returns 400', async () => {
    const prop = await makeProperty('PROP-003', ctx.admin.cookie);
    const unit = await makeUnit(prop, '301', 'Occupied', ctx.admin.cookie);
    const cust = await makeCustomer('PROP-003 tenant', { qatar_id: `QID-P3-${rnd()}` }, ctx.admin.cookie);
    await makeLease({ unit_id: unit.id, property_id: prop.id, customer_id: cust.id, lease_status: 'ACTIVE' }, ctx.admin.cookie);
    const r = await call('DELETE', `/api/properties/${prop.id}`, { cookie: ctx.admin.cookie });
    expectStatus(r, 400, 'delete occupied property');
    assert.ok(await db.properties.findUnique({ where: { id: prop.id } }), 'property was deleted despite active lease');
  });

  test('PROP-004 market rent = base × (1 + high-floor 10% + sea-view 15%) and is saved on the unit', async () => {
    const prop = await makeProperty('PROP-004', ctx.admin.cookie);
    const unit = await makeUnit(prop, '401', 'Available', ctx.admin.cookie);
    await db.units.update({ where: { id: unit.id }, data: { floor_number: '12', view_type: 'Sea View', price: 1000 } });
    const wide = { start_date: isoDT('2000-01-01'), end_date: isoDT('2100-12-31'), adjustment_type: 'percentage' };
    for (const [rule_type, value] of [['HIGH_FLOOR', 10], ['SEA_VIEW', 15]]) {
      const r = await call('POST', '/api/db/pricing_rules/insert', {
        cookie: ctx.admin.cookie, body: { data: { ...wide, rule_type, value } },
      });
      expectStatus(r, 200, `create ${rule_type} rule`);
      trackIds('pricing_rules', r.body.data.id);
    }
    const r = await call('POST', `/api/units/${unit.id}/market-rent`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(r, 200, 'market rent');
    assert.equal(r.body.market_rent, 1250, `market rent ${r.body.market_rent}, expected 1250`);
    assert.equal(r.body.adjustments.length, 2, 'both pricing rules should apply');
    const saved = await db.units.findUnique({ where: { id: unit.id } });
    assert.equal(Number(saved.market_rent), 1250, 'market rent not saved on the unit');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 3: Customer & Tenant CRM Lifecycle', () => {
  test('CRM-001a individual customer with QID and passport is stored', async () => {
    const c = await makeCustomer('CRM-001 individual', { qatar_id: `QID-${rnd()}`, passport_number: 'P1234567', customer_type: 'Individual' }, ctx.admin.cookie);
    const row = await db.customers.findUnique({ where: { id: c.id } });
    assert.ok(row?.qatar_id && row?.passport_number, 'KYC identifiers not persisted');
  });

  test('CRM-001b KYC fields are validated by tenant type (individual needs QID; corporate needs CR and trade licence)', async () => {
    expectStatus(await call('POST', '/api/customers', { cookie: ctx.admin.cookie, body: { full_name: `${TAG} no-QID`, customer_type: 'Individual' } }), 400, 'individual without QID');
    expectStatus(await call('POST', '/api/customers', { cookie: ctx.admin.cookie, body: { full_name: `${TAG} no-CR`, customer_type: 'Corporate' } }), 400, 'corporate without CR/trade licence');
  });

  test('CRM-002 duplicate QID / tax number returns 409', async () => {
    const qid = `QID-DUP-${rnd()}`;
    await makeCustomer('CRM-002 first', { qatar_id: qid }, ctx.admin.cookie);
    const dup = await call('POST', '/api/customers', {
      cookie: ctx.admin.cookie, body: { full_name: `${TAG} CRM-002 second`, customer_type: 'Individual', qatar_id: qid },
    });
    expectStatus(dup, 409, 'duplicate QID');
  });

  test('CRM-003 lease cannot be created for a blacklisted customer (expects 403)', async () => {
    // Schema has no is_blacklisted column; customer_status is the nearest existing field.
    const cust = await makeCustomer('CRM-003 blacklisted', { qatar_id: `QID-BL-${rnd()}`, customer_status: 'Blacklisted' }, ctx.admin.cookie);
    const prop = await makeProperty('CRM-003 property', ctx.admin.cookie);
    const unit = await makeUnit(prop, '303', 'Available', ctx.admin.cookie);
    const r = await call('POST', '/api/leases', {
      cookie: ctx.admin.cookie,
      body: {
        lease_number: `${TAG}-BL-${rnd()}`, customer_id: cust.id, unit_id: unit.id, property_id: prop.id,
        commencement_date: isoDT(daysFromNow(0)), expiry_date: isoDT(daysFromNow(365)), lease_period_months: 12, rental_amount: 1000,
      },
    });
    expectStatus(r, 403, 'lease for blacklisted customer');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 4: Reservations & Booking Engine', () => {
  test('RES-001a reservation with holding deposit is created', async () => {
    const prop = await makeProperty('RES-001', ctx.admin.cookie);
    const unit = await makeUnit(prop, '401', 'Available', ctx.admin.cookie);
    const r = await call('POST', '/api/reservations', {
      cookie: ctx.admin.cookie,
      body: { unit_id: unit.id, prospect_name: `${TAG} prospect`, prospect_contact: '+97400000000', reservation_validity: isoDT(daysFromNow(7)), status: 'CONFIRMED' },
    });
    expectStatus(r, 201, 'create reservation');
  });

  test('RES-001b reserving a unit moves it to Reserved', async () => {
    const prop = await makeProperty('RES-001b', ctx.admin.cookie);
    const unit = await makeUnit(prop, '402', 'Available', ctx.admin.cookie);
    await call('POST', '/api/reservations', {
      cookie: ctx.admin.cookie,
      body: { unit_id: unit.id, prospect_name: `${TAG} prospect b`, prospect_contact: '+97400000001', status: 'CONFIRMED' },
    });
    const u = await db.units.findUnique({ where: { id: unit.id } });
    assert.equal(u.status, 'Reserved', `unit status is ${u.status}`);
  });

  test('RES-002 two simultaneous reservations for one unit: exactly one succeeds (other 409)', async () => {
    const prop = await makeProperty('RES-002', ctx.admin.cookie);
    const unit = await makeUnit(prop, '403', 'Available', ctx.admin.cookie);
    const body = (n) => ({ unit_id: unit.id, prospect_name: `${TAG} race ${n}`, prospect_contact: `+9740000000${n}`, status: 'CONFIRMED' });
    const [a, b] = await Promise.all([
      call('POST', '/api/reservations', { cookie: ctx.admin.cookie, body: body(1) }),
      call('POST', '/api/reservations', { cookie: ctx.admin.cookie, body: body(2) }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409], `concurrent statuses were ${[a.status, b.status]}`);
  });

  test('RES-003 holding period expiry: expired reservation becomes EXPIRED and its unit is released', async () => {
    const prop = await makeProperty('RES-003', ctx.admin.cookie);
    const unit = await makeUnit(prop, '404', 'Available', ctx.admin.cookie);
    const created = await call('POST', '/api/reservations', {
      cookie: ctx.admin.cookie,
      body: { unit_id: unit.id, prospect_name: `${TAG} expiring`, prospect_contact: '+97400000004', reservation_validity: isoDT(new Date(Date.now() - 3600_000)), status: 'CONFIRMED' },
    });
    expectStatus(created, 201, 'create expired-validity reservation');
    const reservationId = created.body.id;
    assert.equal((await db.units.findUnique({ where: { id: unit.id } })).status, 'Reserved', 'unit should be reserved before the job');
    // Scoped to this reservation so the job does not touch other live data.
    const job = await call('POST', '/api/jobs/reservation-expiry', { cookie: ctx.admin.cookie, body: { reservation_ids: [reservationId] } });
    expectStatus(job, 200, 'expiry job');
    assert.equal(job.body.expired, 1, `job expired ${job.body.expired} reservations`);
    assert.equal((await db.reservations.findUnique({ where: { id: reservationId } })).status, 'EXPIRED');
    assert.equal((await db.units.findUnique({ where: { id: unit.id } })).status, 'Available', 'unit not released');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 5: Lease Lifecycle, Staging, Overlaps & Termination', () => {
  test('LEASE-001a lease with rent, PDC count and security deposit is created', async () => {
    const prop = await makeProperty('LEASE-001', ctx.admin.cookie);
    const unit = await makeUnit(prop, '501', 'Available', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, lease_period_months: 12, rental_amount: 120000, number_of_pdc: 4, security_deposit: 6000 }, ctx.admin.cookie);
    assert.ok(lease.id, 'lease not created');
  });

  test('LEASE-001b creating a lease sets the unit to Occupied', async () => {
    const prop = await makeProperty('LEASE-001b', ctx.admin.cookie);
    const unit = await makeUnit(prop, '502', 'Available', ctx.admin.cookie);
    await makeLease({ unit_id: unit.id, property_id: prop.id }, ctx.admin.cookie);
    const u = await db.units.findUnique({ where: { id: unit.id } });
    assert.equal(u.status, 'Occupied', `unit status is ${u.status}`);
  });

  test('LEASE-001c lease creates 4 PDC schedule rows', async () => {
    const prop = await makeProperty('LEASE-001c', ctx.admin.cookie);
    const unit = await makeUnit(prop, '503', 'Available', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, number_of_pdc: 4 }, ctx.admin.cookie);
    const n = await db.fin_pdc_register.count({ where: { lease_id: lease.id } });
    assert.equal(n, 4, `PDC schedule rows for lease: ${n}`);
  });

  test('LEASE-001d security deposit is recorded: Dr Bank / Cr Deposits for the deposit amount', async () => {
    const prop = await makeProperty('LEASE-001d', ctx.admin.cookie);
    const unit = await makeUnit(prop, '504', 'Available', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, security_deposit: 6000 }, ctx.admin.cookie);
    const ev = await db.fin_accounting_events.findFirst({ where: { event_type: 'SECURITY_DEPOSIT_RECEIVED', lease_id: lease.id } });
    assert.ok(ev, 'no security-deposit receipt event for the lease');
    assert.equal(Number(ev.total_debit), 6000, `deposit receipt amount ${ev.total_debit}`);
    assert.equal(ev.status, 'POSTED', 'deposit receipt was not posted');
  });

  test('LEASE-002 overlapping lease on the same unit returns 409', async () => {
    const prop = await makeProperty('LEASE-002', ctx.admin.cookie);
    const unit = await makeUnit(prop, '102', 'Available', ctx.admin.cookie);
    await makeLease({ unit_id: unit.id, property_id: prop.id, lease_status: 'ACTIVE', commencement_date: isoDT('2026-01-01'), expiry_date: isoDT('2026-12-31'), lease_period_months: 12 }, ctx.admin.cookie);
    const r = await call('POST', '/api/leases', {
      cookie: ctx.admin.cookie,
      body: { lease_number: `${TAG}-OVERLAP-${rnd()}`, unit_id: unit.id, property_id: prop.id, lease_status: 'ACTIVE', commencement_date: isoDT('2026-06-01'), expiry_date: isoDT('2027-05-31'), lease_period_months: 12, rental_amount: 1000 },
    });
    expectStatus(r, 409, 'overlapping lease');
  });

  test('LEASE-003 end date before start date returns 422', async () => {
    const prop = await makeProperty('LEASE-003', ctx.admin.cookie);
    const unit = await makeUnit(prop, '103', 'Available', ctx.admin.cookie);
    const r = await call('POST', '/api/leases', {
      cookie: ctx.admin.cookie,
      body: { lease_number: `${TAG}-INV-${rnd()}`, unit_id: unit.id, property_id: prop.id, commencement_date: isoDT('2026-12-01'), expiry_date: isoDT('2026-01-01'), lease_period_months: 12, rental_amount: 1000 },
    });
    expectStatus(r, 422, 'inverted dates');
  });

  test('LEASE-004 early termination: unmatured PDCs voided, $500 damage taken from the $5,000 deposit, $4,500 refund voucher', async () => {
    const prop = await makeProperty('LEASE-004', ctx.admin.cookie);
    const unit = await makeUnit(prop, '104', 'Occupied', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, lease_status: 'ACTIVE', security_deposit: 5000 }, ctx.admin.cookie);
    for (const m of [1, 2, 3]) {
      await db.fin_pdc_register.create({ data: { id: BigInt(Date.now()) * 1000n + BigInt(m), lease_id: lease.id, cheque_number: `${TAG}-LCHQ-${m}`, amount: 30000, cheque_date: daysFromNow(30 * m), status: 'In Hand' } });
    }
    const r = await call('POST', `/api/leases/${lease.id}/terminate`, { cookie: ctx.admin.cookie, body: { damage_charges: 500 } });
    expectStatus(r, 200, 'terminate lease');
    assert.equal(r.body.refund, 4500, `refund ${r.body.refund}, expected 4500`);
    assert.ok(r.body.refund_voucher, 'refund voucher number missing');
    const refund = await db.fin_accounting_events.findFirst({ where: { event_type: 'SECURITY_DEPOSIT_REFUNDED', lease_id: lease.id } });
    assert.equal(Number(refund?.total_debit), 4500, 'refund event not posted at 4500');
    const left = await db.fin_pdc_register.findMany({ where: { lease_id: lease.id, status: 'In Hand' } });
    assert.equal(left.length, 0, `${left.length} unmatured PDCs still In Hand after termination`);
    assert.equal(await db.fin_pdc_register.count({ where: { lease_id: lease.id, status: 'Cancelled' } }), 3, 'unmatured cheques not cancelled');
    assert.equal((await db.units.findUnique({ where: { id: unit.id } })).status, 'Available', 'unit not released');
  });

  test('LEASE-005a renewal links the new lease to its parent via previous_lease_id', async () => {
    const prop = await makeProperty('LEASE-005', ctx.admin.cookie);
    const unit = await makeUnit(prop, '105', 'Occupied', ctx.admin.cookie);
    const parent = await makeLease({ unit_id: unit.id, property_id: prop.id, lease_status: 'ACTIVE' }, ctx.admin.cookie);
    const child = await makeLease({ unit_id: unit.id, property_id: prop.id, previous_lease_id: parent.id, rental_amount: 126000 }, ctx.admin.cookie);
    assert.equal((await db.leases.findUnique({ where: { id: child.id } })).previous_lease_id, parent.id);
  });

  test('LEASE-005b renewal moves the parent lease to EXPIRED or RENEWED', async () => {
    const prop = await makeProperty('LEASE-005b', ctx.admin.cookie);
    const unit = await makeUnit(prop, '106', 'Occupied', ctx.admin.cookie);
    const parent = await makeLease({ unit_id: unit.id, property_id: prop.id, lease_status: 'ACTIVE' }, ctx.admin.cookie);
    await makeLease({ unit_id: unit.id, property_id: prop.id, previous_lease_id: parent.id }, ctx.admin.cookie);
    const row = await db.leases.findUnique({ where: { id: parent.id } });
    assert.ok(['EXPIRED', 'RENEWED'].includes(String(row.lease_status).toUpperCase()), `parent lease_status is ${row.lease_status}`);
  });

  test('LEASE-006a a lease created with pdc_schedule "none" gets no placeholder schedule rows (the UI enters its own cheques)', async () => {
    const prop = await makeProperty('LEASE-006a', ctx.admin.cookie);
    const unit = await makeUnit(prop, '107', 'Available', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, number_of_pdc: 2, pdc_schedule: 'none', rental_amount: 20000 }, ctx.admin.cookie);
    assert.equal(await db.fin_pdc_register.count({ where: { lease_id: lease.id } }), 0, 'placeholder rows were created despite pdc_schedule "none"');
  });

  test('LEASE-006b cheques supplied with the lease are written once; a cheque repeated in the request is not stored twice', async () => {
    const prop = await makeProperty('LEASE-006b', ctx.admin.cookie);
    const unit = await makeUnit(prop, '108', 'Available', ctx.admin.cookie);
    const cheque = (n, amount) => ({ cheque_number: `${TAG}-REAL-${n}`, amount, maturity_date: isoDT(daysFromNow(30 * n)), bank: 'QNB', status: 'In Hand' });
    const r = await call('POST', '/api/leases', {
      cookie: ctx.admin.cookie,
      body: {
        lease_number: `${TAG}-CHQ-${rnd()}`, unit_id: unit.id, property_id: prop.id, lease_status: 'ACTIVE',
        commencement_date: isoDT(daysFromNow(0)), expiry_date: isoDT(daysFromNow(365)), lease_period_months: 12,
        rental_amount: 20000, number_of_pdc: 2,
        pdcs: [cheque(1, 10000), cheque(2, 10000), cheque(1, 10000)],
      },
    });
    expectStatus(r, 201, 'create lease with cheques');
    assert.equal(await db.fin_pdc_register.count({ where: { lease_id: r.body.id } }), 2, 'each cheque should be stored once');
    assert.equal(await db.fin_pdc_register.count({ where: { lease_id: r.body.id, cheque_number: `${TAG}-REAL-1` } }), 1, 'a repeated cheque was stored twice');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
  test('LEASE-006c a cheque entered through the UI "pdcs" table fills a scheduled slot in the register (no extra row)', async () => {
    const prop = await makeProperty('LEASE-006c', ctx.admin.cookie);
    const unit = await makeUnit(prop, '109', 'Available', ctx.admin.cookie);
    const lease = await makeLease({ unit_id: unit.id, property_id: prop.id, number_of_pdc: 2, rental_amount: 20000 }, ctx.admin.cookie);
    assert.equal(await db.fin_pdc_register.count({ where: { lease_id: lease.id, status: 'SCHEDULED' } }), 2, 'schedule slots missing');
    const r = await call('POST', '/api/db/pdcs/insert', {
      cookie: ctx.admin.cookie,
      body: { data: { lease_id: lease.id, cheque_number: `${TAG}-CLAIM-1`, amount: 10000, maturity_date: isoDT(daysFromNow(30)), bank: 'QNB', status: 'In Hand' } },
    });
    expectStatus(r, 200, 'enter cheque via pdcs');
    assert.equal(await db.fin_pdc_register.count({ where: { lease_id: lease.id } }), 2, 'the cheque was added as an extra row');
    const claimed = await db.fin_pdc_register.findFirst({ where: { lease_id: lease.id, cheque_number: `${TAG}-CLAIM-1` } });
    assert.ok(claimed, 'cheque not stored against the lease');
    assert.equal(claimed.status, 'In Hand', 'slot status not updated to the cheque status');
  });

describe('Module 6: Post-Dated Cheques, Vault Custody & Banking Lifecycle', () => {
  test('PDC-001a cheque moves In Hand → Deposited → Cleared through the status RPC', async () => {
    const id = await makePdc('In Hand', daysFromNow(-1));
    const dep = await callRpc('fin_manual_pdc_status_update', { p_pdc_id: id.toString(), p_status: 'Deposited', p_deposit_date: dateOnly(new Date()) }, ctx.finance.cookie);
    const depRow = await db.fin_pdc_register.findUnique({ where: { id } });
    assert.equal(dep.status, 200, `deposit: HTTP ${dep.status} ${short(dep.body)}; DB status afterwards='${depRow.status}'`);
    const clr = await callRpc('fin_manual_pdc_status_update', { p_pdc_id: id.toString(), p_status: 'Cleared', p_cleared_date: dateOnly(new Date()) }, ctx.finance.cookie);
    expectStatus(clr, 200, 'clear');
    assert.equal((await db.fin_pdc_register.findUnique({ where: { id } })).status, 'Cleared');
  });

  test('PDC-001b clearing a cheque posts a PDC_CLEARED accounting event (Dr Bank / Cr Cheques Deposited)', async () => {
    const id = await makePdc('Deposited', daysFromNow(-1));
    await callRpc('fin_manual_pdc_status_update', { p_pdc_id: id.toString(), p_status: 'Cleared', p_cleared_date: dateOnly(new Date()) }, ctx.finance.cookie);
    const ev = await db.fin_accounting_events.findMany({ where: { event_type: 'PDC_CLEARED', source_id: id.toString() } });
    assert.ok(ev.length >= 1, 'no PDC_CLEARED accounting event created on clearance');
    assert.equal(ev[0].status, 'POSTED', 'clearance event was not posted');
  });

  test('PDC-002 bounced cheque posts a penalty/AR reversal event', async () => {
    const id = await makePdc('Deposited', daysFromNow(-1));
    const r = await callRpc('fin_manual_pdc_status_update', { p_pdc_id: id.toString(), p_status: 'Bounced', p_returned_date: dateOnly(new Date()) }, ctx.finance.cookie);
    expectStatus(r, 200, 'bounce');
    const ev = await db.fin_accounting_events.findMany({ where: { event_type: 'PDC_BOUNCED', source_id: id.toString() } });
    assert.ok(ev.length >= 1, 'no PDC_BOUNCED accounting event (AR reversal / penalty) created');
  });

  test('PDC-003 two simultaneous clearances: one 200, one 409, no duplicate credit', async () => {
    const id = await makePdc('Deposited', daysFromNow(-1));
    const body = { p_pdc_id: id.toString(), p_status: 'Cleared', p_cleared_date: dateOnly(new Date()) };
    const [a, b] = await Promise.all([
      callRpc('fin_manual_pdc_status_update', body, ctx.finance.cookie),
      callRpc('fin_manual_pdc_status_update', body, ctx.finance.cookie),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], `concurrent clear statuses were ${[a.status, b.status]}`);
    const clears = await db.fin_accounting_events.count({ where: { event_type: 'PDC_CLEARED', source_id: id.toString() } });
    assert.equal(clears, 1, `clearance posted ${clears} times`);
  });

  test('PDC-004 clearing before the maturity date is refused without an override', async () => {
    const id = await makePdc('Deposited', daysFromNow(30));
    const r = await callRpc('fin_manual_pdc_status_update', { p_pdc_id: id.toString(), p_status: 'Cleared', p_cleared_date: dateOnly(new Date()) }, ctx.finance.cookie);
    assert.equal(r.status, 400, `premature clearance returned ${r.status}: ${short(r.body)}`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 7: Finance, General Ledger, Vouchers & Sub-Ledger Posting', () => {
  let postedVoucherId = null;

  test('FIN-001 balanced manual JE posts to a voucher with two lines', async () => {
    const { eventId } = await makeEvent({ amount: 2500, eventDate: isoDT(new Date()), label: 'FIN-001' });
    const r = await callRpc('post_accounting_event_atomic', { p_event_id: eventId }, ctx.finance.cookie);
    expectStatus(r, 200, 'post balanced JE');
    const posted = r.body?.data?.[0];
    assert.equal(posted?.status, 'POSTED', `post result: ${short(r.body)}`);
    postedVoucherId = posted.voucher_id;
    assert.equal(await db.fin_voucher_lines.count({ where: { voucher_id: postedVoucherId } }), 2, 'voucher should have 2 lines');
  });

  test('FIN-002a unbalanced JE is rejected and no voucher is created', async () => {
    const [a, b] = await pickAccounts();
    const { eventId } = await makeEvent({ dr: a, cr: b, amount: 1500, creditAmount: 1200, eventDate: isoDT(new Date()), label: 'FIN-002' });
    const r = await callRpc('post_accounting_event_atomic', { p_event_id: eventId }, ctx.finance.cookie);
    assert.notEqual(r.status, 200, `unbalanced JE was accepted: ${short(r.body)}`);
    assert.equal(await db.fin_vouchers.count({ where: { accounting_event_id: eventId } }), 0, 'a voucher was created for an unbalanced entry');
  });

  test('FIN-002b unbalanced JE returns HTTP 400 with "Out of balance by 300"', async () => {
    const [a, b] = await pickAccounts();
    const { eventId } = await makeEvent({ dr: a, cr: b, amount: 1500, creditAmount: 1200, eventDate: isoDT(new Date()), label: 'FIN-002b' });
    const r = await callRpc('post_accounting_event_atomic', { p_event_id: eventId }, ctx.finance.cookie);
    expectStatus(r, 400, 'unbalanced JE status');
    assert.match(JSON.stringify(r.body), /Out of balance by 300/, 'message does not state the 300 difference');
  });

  test('FIN-003 posting into a CLOSED period returns 403', async () => {
    await db.fin_posting_periods.create({
      data: { id: 900000000 + Math.floor(Math.random() * 1000000), period_name: `${TAG}-2025-12`, year: '2025', month: 12, status: 'Closed' },
    });
    const { eventId } = await makeEvent({ amount: 500, eventDate: '2025-12-15T00:00:00.000Z', label: 'FIN-003' });
    const r = await callRpc('post_accounting_event_atomic', { p_event_id: eventId }, ctx.finance.cookie);
    expectStatus(r, 403, 'post into closed period');
  });

  test('FIN-004 month-end reconciliation: postings through the unit sub-ledger leave the variance at zero', async () => {
    const prop = await makeProperty('FIN-004', ctx.admin.cookie);
    const unit = await makeUnit(prop, '601', 'Available', ctx.admin.cookie);
    const mapping = await db.unit_coa_mapping.findUnique({ where: { unit_id: unit.id } });
    const sl = await db.fin_coa_accounts.findFirst({ where: { account_code: mapping.receivable_sl_code } });
    assert.ok(sl, 'unit receivable sub-ledger account missing');
    const rent = await account('41100');
    const before = (await call('GET', '/api/finance/reconciliation?control=12413', { cookie: ctx.finance.cookie })).body;

    const { eventId } = await makeEvent({ dr: sl, cr: rent, amount: 1000, eventDate: isoDT(new Date()), label: 'FIN-004 sl', cookie: ctx.finance.cookie });
    const posted = await callRpc('post_accounting_event_atomic', { p_event_id: eventId }, ctx.finance.cookie);
    expectStatus(posted, 200, 'post sub-ledger event');
    const after = (await call('GET', '/api/finance/reconciliation?control=12413', { cookie: ctx.finance.cookie })).body;

    assert.equal(money(after.subledger_total - before.subledger_total), 1000, 'sub-ledger total did not move by the posting');
    assert.equal(money(after.variance - before.variance), 0, 'a sub-ledger posting changed the variance');
    assert.equal(after.direct_postings, before.direct_postings, 'a sub-ledger posting counted as a direct control posting');
  });

  test('FIN-004b a direct posting to the control account is reported as a variance', async () => {
    const control = await account('12413');
    const rent = await account('41100');
    const before = (await call('GET', '/api/finance/reconciliation?control=12413', { cookie: ctx.finance.cookie })).body;
    const { eventId } = await makeEvent({ dr: control, cr: rent, amount: 500, eventDate: isoDT(new Date()), label: 'FIN-004 direct', cookie: ctx.finance.cookie });
    expectStatus(await callRpc('post_accounting_event_atomic', { p_event_id: eventId }, ctx.finance.cookie), 200, 'post direct control event');
    const after = (await call('GET', '/api/finance/reconciliation?control=12413', { cookie: ctx.finance.cookie })).body;
    assert.equal(money(after.variance - before.variance), 500, 'direct control posting not reported in the variance');
  });

  test('FIN-005 DELETE of a POSTED voucher returns 400 and the voucher survives', async () => {
    assert.ok(postedVoucherId, 'FIN-001 did not produce a voucher; cannot run FIN-005');
    const r = await call('POST', '/api/db/fin_vouchers/delete', { cookie: ctx.admin.cookie, body: { where: { id: postedVoucherId } } });
    expectStatus(r, 400, 'DELETE posted voucher');
    assert.match(JSON.stringify(r.body), /Posted vouchers cannot be deleted/, 'message does not state the posted-voucher rule');
    assert.ok(await db.fin_vouchers.findUnique({ where: { id: postedVoucherId } }), 'posted voucher was deleted');
  });

  test('FA-001 straight-line depreciation: $120,000 over 5 years = $2,000 a month, NBV falls to $118,000, depreciation JV posted', async () => {
    const asset = await db.assets.create({ data: { asset_name: `${TAG} truck`, purchase_cost: 120000, life_of_asset: 5, salvage_value: 0, closing_accumulated_depreciation: 0, net_book_value: 120000, asset_status: 'Available' } });
    const r = await call('POST', `/api/assets/${asset.id}/depreciate`, { cookie: ctx.finance.cookie, body: { period: '2026-11' } });
    expectStatus(r, 200, 'depreciate');
    assert.equal(r.body.amount, 2000, `monthly charge ${r.body.amount}`);
    assert.equal(r.body.net_book_value, 118000, `NBV ${r.body.net_book_value}`);
    assert.ok(r.body.voucher, 'depreciation voucher not posted');
    const again = await call('POST', `/api/assets/${asset.id}/depreciate`, { cookie: ctx.finance.cookie, body: { period: '2026-11' } });
    expectStatus(again, 409, 'second run for the same month');
  });

  test('FA-001b depreciation stops at salvage value', async () => {
    const asset = await db.assets.create({ data: { asset_name: `${TAG} near salvage`, purchase_cost: 1000, life_of_asset: 1, salvage_value: 990, closing_accumulated_depreciation: 9.5, net_book_value: 990.5, asset_status: 'Available' } });
    const r = await call('POST', `/api/assets/${asset.id}/depreciate`, { cookie: ctx.finance.cookie, body: { period: '2026-11' } });
    expectStatus(r, 200, 'depreciate near salvage');
    assert.equal(r.body.amount, 0.5, `charge should be capped at 0.5, got ${r.body.amount}`);
    assert.equal(r.body.net_book_value, 990, 'NBV should land exactly on salvage');
    const next = await call('POST', `/api/assets/${asset.id}/depreciate`, { cookie: ctx.finance.cookie, body: { period: '2026-12' } });
    expectStatus(next, 409, 'depreciation past salvage');
  });

  test('FA-002 disposal at $14,000 on NBV $10,000 posts a $4,000 gain and derecognises the asset', async () => {
    const asset = await db.assets.create({ data: { asset_name: `${TAG} scrap`, purchase_cost: 120000, life_of_asset: 5, closing_accumulated_depreciation: 110000, net_book_value: 10000, asset_status: 'Available' } });
    const r = await call('POST', `/api/assets/${asset.id}/dispose`, { cookie: ctx.finance.cookie, body: { sale_price: 14000, disposal_date: '2026-11-23' } });
    expectStatus(r, 200, 'dispose');
    assert.equal(r.body.gain_on_disposal, 4000, `gain ${r.body.gain_on_disposal}`);
    assert.ok(r.body.voucher, 'disposal voucher not posted');
    const row = await db.assets.findUnique({ where: { id: asset.id } });
    assert.equal(row.asset_status, 'Disposed');
    assert.equal(Number(row.closing_accumulated_depreciation), 0, 'accumulated depreciation not derecognised');
    expectStatus(await call('POST', `/api/assets/${asset.id}/dispose`, { cookie: ctx.finance.cookie, body: { sale_price: 1 } }), 409, 'dispose twice');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 8: Procurement, RFX, 3-Way Matching, Customs & Gate Inward', () => {
  const makeVendor = () => db.fin_vendors.create({ data: { code: `${TAG}-V${rnd()}`, name: `${TAG} Vendor` } });

  async function makePo(vendorId, qty, rate, status = 'PENDING_APPROVAL') {
    const total = money(qty * rate);
    const po = await db.proc_purchase_orders.create({
      data: { doc_number: `${TAG}-PO-${rnd()}`, vendor_id: vendorId, status, subtotal: total, total_amount: total, currency_code: 'QAR' },
    });
    const line = await db.proc_purchase_order_lines.create({
      data: {
        purchase_order_id: po.id, line_no: 1, item_type: 'CAPEX', item_name: `${TAG} HVAC compressor`,
        quantity: qty, ordered_quantity: qty, unit_rate: rate, line_total: total,
      },
    });
    return { po, line, total };
  }

  async function makeApprover(label, limit) {
    const user = await makeUser(label, 'ADMIN');
    await db.employees.create({ data: { first_name: TAG, last_name: label, user_id: user.id, approval_limit: limit } });
    return user;
  }

  async function makeGrn(po, line, qty) {
    const grn = await db.proc_goods_receipts.create({
      data: { grn_number: `${TAG}-GRN-${rnd()}`, purchase_order_id: po.id, vendor_id: po.vendor_id },
    });
    await db.proc_grn_lines.create({
      data: {
        goods_receipt_id: grn.id, purchase_order_line_id: line.id, line_no: 1, item_name: line.item_name,
        ordered_quantity: qty, received_quantity: qty, accepted_quantity: qty, unit_rate: line.unit_rate,
        accepted_amount: money(qty * Number(line.unit_rate)),
      },
    });
    return grn;
  }

  async function makeInvoice(po, line, grn, qty, rate = Number(line.unit_rate)) {
    const total = money(qty * rate);
    const inv = await db.proc_payable_invoices.create({
      data: {
        doc_number: `${TAG}-INV-${rnd()}`, vendor_id: String(po.vendor_id), purchase_order_id: po.id,
        goods_receipt_id: grn?.id ?? null, invoice_date: new Date(), status: 'DRAFT',
        subtotal: total, total_amount: total, outstanding_amount: total,
      },
    });
    await db.proc_payable_invoice_lines.create({
      data: {
        payable_invoice_id: inv.id, line_no: 1, source_line_id: line.id, description: `${TAG} invoice line`,
        quantity: qty, unit_rate: rate, line_total: total, expense_account_code: '51004',
      },
    });
    return inv;
  }

  test('PROC-001 PR → PO → GRN → invoice: 3-way match passes, PO and invoice approved, invoice posted to AP', async () => {
    const vendor = await makeVendor();
    await db.proc_purchase_requests.create({ data: { doc_number: `${TAG}-PR-${rnd()}` } });
    const director = await makeApprover('director', 60000);
    const { po, line, total } = await makePo(vendor.id, 50, 1000);
    assert.equal(total, 50000);

    const approved = await call('POST', `/api/procurement/purchase-orders/${po.id}/approve`, { cookie: director.cookie, body: {} });
    expectStatus(approved, 200, 'director approves PO');
    assert.equal(approved.body.status, 'APPROVED');

    const grn = await makeGrn(po, line, 50);
    const inv = await makeInvoice(po, line, grn, 50);
    const match = await call('POST', `/api/procurement/payable-invoices/${inv.id}/match`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(match, 200, 'match');
    assert.equal(match.body.status, 'MATCHED', `match result: ${short(match.body)}`);

    const post = await call('POST', `/api/procurement/payable-invoices/${inv.id}/approve`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(post, 200, 'approve invoice');
    assert.equal(post.body.status, 'APPROVED');
    assert.ok(post.body.voucher, 'AP voucher not posted');
    assert.equal(Number(post.body.amount), 50000);
  });

  test('PROC-002 bill quantity above GRN quantity is flagged and blocks approval', async () => {
    const vendor = await makeVendor();
    const { po, line } = await makePo(vendor.id, 10, 100, 'APPROVED');
    const grn = await makeGrn(po, line, 10);
    const inv = await makeInvoice(po, line, grn, 12);
    const match = await call('POST', `/api/procurement/payable-invoices/${inv.id}/match`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(match, 200, 'match');
    assert.equal(match.body.status, 'MATCHING_EXCEPTION');
    assert.ok(match.body.exceptions.includes('Bill quantity (12) exceeds GRN quantity (10) by 2 units'), `exceptions: ${match.body.exceptions}`);
    const blocked = await call('POST', `/api/procurement/payable-invoices/${inv.id}/approve`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(blocked, 409, 'approve a matching exception');
    assert.equal((await db.proc_payable_invoices.findUnique({ where: { id: inv.id } })).status, 'MATCHING_EXCEPTION');
  });

  test('PROC-003 PO approval above the approver limit is rejected and the PO stays pending', async () => {
    const vendor = await makeVendor();
    const assistant = await makeApprover('assistant-pm', 10000);
    const { po } = await makePo(vendor.id, 1, 45000);
    const r = await call('POST', `/api/procurement/purchase-orders/${po.id}/approve`, { cookie: assistant.cookie, body: {} });
    expectStatus(r, 403, 'approve above limit');
    assert.match(JSON.stringify(r.body), /User approval limit \(10000\) exceeded\. Required Level: Director/);
    assert.equal((await db.proc_purchase_orders.findUnique({ where: { id: po.id } })).status, 'PENDING_APPROVAL');
  });

  test('PROC-004 landed cost: $50,000 of compressors plus $5,000 duty and $3,000 freight = $58,000, $1,160 a unit', async () => {
    const vendor = await makeVendor();
    const { po } = await makePo(vendor.id, 50, 1000, 'APPROVED');
    const r = await call('POST', `/api/procurement/purchase-orders/${po.id}/landed-cost`, { cookie: ctx.admin.cookie, body: { duty_amount: 5000, freight_amount: 3000 } });
    expectStatus(r, 200, 'landed cost');
    assert.equal(r.body.total_landed_cost, 58000, `total landed ${r.body.total_landed_cost}`);
    assert.equal(r.body.lines[0].landed_unit_cost, 1160, `unit landed cost ${r.body.lines[0].landed_unit_cost}`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 9: Work Orders, Maintenance Tickets & Spare Parts Inventory', () => {
  test('MAINT-001 issuing 2 valves from stock reduces inventory by 2', async () => {
    const part = await db.inventory_parts.create({
      data: { name: `${TAG} valve`, sku: `${TAG}-VALVE-${rnd()}`, quantity_on_hand: 5, unit_cost: 25 },
    });
    const t = await call('POST', '/api/db/maintenance_tickets/insert', {
      cookie: ctx.admin.cookie,
      body: { data: { title: `${TAG} plumbing`, category: 'Plumbing', priority: 'medium', status: 'new', tenant_id: ctx.tA.id, reported_by: ctx.tenantA.email } },
    });
    expectStatus(t, 200, 'create ticket');
    const u = await call('POST', '/api/db/material_usage/insert', {
      cookie: ctx.admin.cookie, body: { data: { ticket_id: idOf(t), part_id: part.id, quantity: 2, cost: 50 } },
    });
    expectStatus(u, 200, 'record usage');
    assert.equal((await db.inventory_parts.findUnique({ where: { id: part.id } })).quantity_on_hand, 3, 'stock after issue');
  });

  test('MAINT-002 tenant cannot raise a ticket for a unit they do not lease (expects 403)', async () => {
    const r = await call('POST', '/api/db/maintenance_tickets/insert', {
      cookie: ctx.tenantA.cookie,
      body: { data: { title: `${TAG} cross-tenant`, category: 'Plumbing', priority: 'medium', status: 'new', tenant_id: ctx.tA.id, unit_ref: `${TAG}-NOT-MINE` } },
    });
    expectStatus(r, 403, 'cross-tenant ticket');
  });

  test('MAINT-003 consuming more stock than on hand returns 400 and stock stays >= 0', async () => {
    const part = await db.inventory_parts.create({ data: { name: `${TAG} HVAC-09`, sku: `${TAG}-HVAC-${rnd()}`, quantity_on_hand: 3 } });
    const r = await call('POST', '/api/db/material_usage/insert', {
      cookie: ctx.admin.cookie, body: { data: { part_id: part.id, quantity: 10, cost: 0 } },
    });
    expectStatus(r, 400, 'over-consumption');
    assert.ok((await db.inventory_parts.findUnique({ where: { id: part.id } })).quantity_on_hand >= 0, 'stock went negative');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 10: HRMS, Shift Attendance, Payroll & Asset Allocations', () => {
  async function makeEmployee(label, extra = {}) {
    return db.employees.create({ data: { first_name: TAG, last_name: label, employee_status: 'Active', ...extra } });
  }

  test('HRMS-001 payroll: $5,000 + $1,000 less 2 unpaid days and a $500 loan instalment; salary JV posted', async () => {
    const emp = await makeEmployee('payroll', { basic_salary: 5000, hra: 1000 });
    const cycle = await db.hrms_payroll_cycles.create({
      data: { name: `${TAG} cycle`, cycle_month: 11, cycle_year: 2026, start_date: new Date('2026-11-01T00:00:00Z'), end_date: new Date('2026-11-30T00:00:00Z'), status: 'Draft' },
    });
    for (const d of ['2026-11-05', '2026-11-06']) {
      await db.hrms_attendance_daily.create({ data: { employee_id: emp.id, attendance_date: new Date(`${d}T00:00:00Z`), status: 'ABSENT' } });
    }
    await db.hrms_employee_loans.create({
      data: { employee_id: emp.id, loan_amount: 6000, disbursed_date: new Date('2026-10-01T00:00:00Z'), tenure_months: 12, monthly_emi: 500, remaining_balance: 6000, status: 'Active' },
    });
    const r = await call('POST', `/api/hrms/payroll-cycles/${cycle.id}/run`, { cookie: ctx.admin.cookie, body: { employee_ids: [emp.id] } });
    expectStatus(r, 200, 'run payroll');
    assert.equal(r.body.total_earnings, 5600, `earnings ${r.body.total_earnings}`);
    assert.equal(r.body.total_net, 5100, `net ${r.body.total_net}`);
    assert.equal(r.body.total_loan_recovery, 500);
    assert.ok(r.body.voucher, 'salary journal not posted');
    const slip = await db.hrms_payroll_payslips.findFirst({ where: { payroll_cycle_id: cycle.id, employee_id: emp.id } });
    assert.equal(Number(slip.net_salary), 5100, 'payslip net');
    assert.equal(Number((await db.hrms_employee_loans.findFirst({ where: { employee_id: emp.id } })).remaining_balance), 5500, 'loan balance');
    expectStatus(await call('POST', `/api/hrms/payroll-cycles/${cycle.id}/run`, { cookie: ctx.admin.cookie, body: { employee_ids: [emp.id] } }), 409, 'second payroll run');
  });

  test('HRMS-002 leave request above the available balance returns 4xx', async () => {
    const emp = await makeEmployee('leave');
    const lt = await db.hrms_leave_types.create({ data: { code: `${TAG}-AL-${rnd()}`, name: `${TAG} Annual` } });
    await db.hrms_leave_balances.create({ data: { employee_id: emp.id, leave_type_id: lt.id, year: new Date().getUTCFullYear(), total_entitled: 2, balance: 2 } });
    const r = await call('POST', '/api/db/hrms_leave_applications/insert', {
      cookie: ctx.admin.cookie,
      body: { data: { employee_id: emp.id, leave_type_id: lt.id, start_date: isoDT(daysFromNow(10)), end_date: isoDT(daysFromNow(19)), days_count: 10, reason: `${TAG} test` } },
    });
    assert.ok(r.status >= 400 && r.status < 500, `expected 4xx for 10 days on a 2-day balance, got ${r.status}`);
  });

  test('HRMS-003 final settlement is blocked until company assets are returned', async () => {
    const emp = await makeEmployee('fnf');
    const asset = await db.assets.create({ data: { asset_name: `${TAG} laptop`, asset_status: 'Assigned', assigned_employee_id: emp.id } });
    const alloc = await db.hrms_asset_allocations.create({ data: { asset_id: asset.id, employee_id: emp.id, allocated_date: new Date('2026-01-01T00:00:00Z'), status: 'Allocated' } });
    const fnf = await db.hrms_fnf_settlements.create({
      data: { employee_id: emp.id, settlement_date: new Date('2026-11-23T00:00:00Z'), last_working_date: new Date('2026-11-22T00:00:00Z'), net_payable: 1000, status: 'Draft' },
    });
    const blocked = await call('POST', `/api/hrms/fnf/${fnf.id}/approve`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(blocked, 409, 'approve with asset outstanding');
    assert.match(JSON.stringify(blocked.body), /Company assets not yet returned: E2E-/);

    const ret = await call('POST', `/api/hrms/asset-allocations/${alloc.id}/return`, { cookie: ctx.admin.cookie, body: { condition_at_return: 'Good' } });
    expectStatus(ret, 200, 'return asset');
    assert.equal((await db.assets.findUnique({ where: { id: asset.id } })).asset_status, 'Available', 'asset not made available');

    const ok = await call('POST', `/api/hrms/fnf/${fnf.id}/approve`, { cookie: ctx.admin.cookie, body: {} });
    expectStatus(ok, 200, 'approve after return');
    assert.equal(ok.body.status, 'Approved');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 12: Tenant Self-Service Portal & Document Access', () => {
  test('PORT-001 signed gateway webhook credits the tenant once (a retry is a duplicate)', async () => {
    const secret = dotenv.parse(fs.readFileSync(path.join(ROOT, '.env'))).PAYMENT_WEBHOOK_SECRET;
    assert.ok(secret, 'PAYMENT_WEBHOOK_SECRET is not set in .env');
    const reference = `${TAG}-PAY-1`;
    const body = { event: 'payment.succeeded', amount: 2500, reference };
    const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    const headers = { 'x-webhook-signature': sig };
    const first = await call('POST', '/api/payments/webhook', { headers, body });
    expectStatus(first, 200, 'first delivery');
    const retry = await call('POST', '/api/payments/webhook', { headers, body });
    expectStatus(retry, 200, 'retried delivery');
    assert.equal(retry.body.status, 'duplicate', 'retry was not recognised as a duplicate');
    assert.equal(await db.fin_accounting_events.count({ where: { idempotency_key: `gateway:${reference}` } }), 1, 'payment posted more than once');
    const unsigned = await call('POST', '/api/payments/webhook', { body: { ...body, reference: `${TAG}-PAY-2` } });
    assert.equal(unsigned.status, 401, 'unsigned webhook was accepted');
  });

  test('PORT-002 tenant A cannot download tenant B lease document (expects 403)', async () => {
    const r = await call('GET', '/portal/documents/lease-999.pdf', { cookie: ctx.tenantA.cookie });
    assert.equal(r.status, 403, `document probe returned ${r.status}; expected 403 for another tenant's file`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Module 13: Role permissions on the database API (enforced on the server)', () => {
  before(async () => {
    ctx.propMgr = await makeUser('prop-mgr', 'PROP_MGR');
  });

  test('ROLE-001 a property manager cannot delete ledger rows, read user accounts, or change system configuration', async () => {
    expectStatus(await call('POST', '/api/db/fin_vouchers/delete', { cookie: ctx.propMgr.cookie, body: { where: { voucher_number: `${TAG}-NONE` } } }), 403, 'PROP_MGR delete fin_vouchers');
    expectStatus(await call('POST', '/api/db/users/query', { cookie: ctx.propMgr.cookie, body: { where: {} } }), 403, 'PROP_MGR read users');
    expectStatus(await call('POST', '/api/db/system_configurations/insert', {
      cookie: ctx.propMgr.cookie, body: { data: { config_key: `${TAG}-cfg`, config_value: '{}' } },
    }), 403, 'PROP_MGR write system_configurations');
  });

  test('ROLE-002 a property manager cannot post accounting through the RPC, but can read properties', async () => {
    expectStatus(await callRpc('post_accounting_event_atomic', { p_event_id: 'none' }, ctx.propMgr.cookie), 403, 'PROP_MGR post accounting RPC');
    expectStatus(await call('POST', '/api/db/properties/query', { cookie: ctx.propMgr.cookie, body: { where: {} } }), 200, 'PROP_MGR read properties');
  });

  test('ROLE-003 only administrators delete operational rows', async () => {
    const ins = await call('POST', '/api/db/reservations/insert', {
      cookie: ctx.admin.cookie, body: { data: { prospect_name: `${TAG} role-test`, prospect_contact: '+97400000009' } },
    });
    expectStatus(ins, 200, 'admin creates reservation');
    const id = idOf(ins);
    expectStatus(await call('POST', '/api/db/reservations/delete', { cookie: ctx.propMgr.cookie, body: { where: { id } } }), 403, 'PROP_MGR delete reservation');
    expectStatus(await call('POST', '/api/db/reservations/delete', { cookie: ctx.admin.cookie, body: { where: { id } } }), 200, 'admin delete reservation');
  });
});
