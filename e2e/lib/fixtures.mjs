// e2e/lib/fixtures.mjs
// Builds test data. Users, tenants and PDCs are written with Prisma (no create-user API exists);
// properties, units, customers and leases go through the real API so the routes are exercised too.
import { randomBytes, randomUUID } from 'crypto';
import { db, bcrypt, TAG, EMAIL_TAG, track, trackIds } from './env.mjs';
import { call, login, idOf, short } from './api.mjs';

// Full ISO timestamp: Prisma DateTime fields reject date-only strings.
export const isoDT = (d) => new Date(d).toISOString();
// Date-only string: only for raw-SQL RPC parameters, which bind as DATE.
export const dateOnly = (d) => new Date(d).toISOString().slice(0, 10);
export const daysFromNow = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};
const rnd = () => Math.floor(Math.random() * 1e6);

export async function makeTenantOrg(n) {
  const key = `${EMAIL_TAG}-t${n}`;
  const row = await db.tenant_organisations.create({
    data: {
      tenant_key: key,
      name: `${TAG} Tenant ${n}`,
      primary_email: `${key}@e2e.test`,
      admin_name: `E2E Tenant ${n}`,
      admin_email: `${key}@e2e.test`,
    },
  });
  track('tenant_organisations', row.id);
  return row;
}

/** Creates a user + profile with a known password, then logs in and returns the session cookie. */
export async function makeUser(label, role, tenantId = null) {
  const id = randomUUID();
  const email = `${EMAIL_TAG}-${label}@e2e.test`;
  const password = randomBytes(12).toString('base64url');
  const meta = {
    password_hash: await bcrypt.hash(password, 10),
    role,
    full_name: `E2E ${label}`,
    tenant_id: tenantId,
  };
  await db.users.create({ data: { id, email, role, raw_user_meta_data: JSON.stringify(meta) } });
  track('users', id);
  await db.profiles.create({ data: { id, role, full_name: `E2E ${label}` } });
  track('profiles', id);
  const session = await login(email, password);
  return { id, email, role, tenantId, cookie: session.cookie };
}

export async function makeProperty(label, cookie) {
  const r = await call('POST', '/api/properties', {
    cookie,
    body: {
      title: `${TAG} ${label}`,
      property_type: 'Residential',
      address: 'E2E Street 1',
      city: 'Doha',
      country: 'Qatar',
      base_price_per_night: 0,
    },
  });
  if (r.status !== 201) throw new Error(`makeProperty failed: ${r.status} ${short(r.body)}`);
  track('properties', r.body.id);
  return r.body;
}

export async function makeUnit(property, unitNumber, status, cookie) {
  const r = await call('POST', '/api/units', {
    cookie,
    body: {
      property_id: property.id,
      unit_ref: `${TAG}-U${unitNumber}-${rnd()}`,
      unit_number: unitNumber,
      unit_name: `${TAG} Unit ${unitNumber}`,
      status,
    },
  });
  if (r.status !== 201) throw new Error(`makeUnit failed: ${r.status} ${short(r.body)}`);
  track('units', r.body.id);
  return r.body;
}

export async function makeCustomer(label, extra, cookie) {
  const r = await call('POST', '/api/customers', {
    cookie,
    body: {
      full_name: `${TAG} ${label}`,
      customer_type: 'Individual',
      verification_status: 'Pending',
      ...extra,
    },
  });
  if (r.status !== 201) throw new Error(`makeCustomer failed: ${r.status} ${short(r.body)}`);
  track('customers', r.body.id);
  return r.body;
}

/** Creates a lease through the real route. Defaults give a valid 12-month lease. */
export async function makeLease(overrides, cookie) {
  const body = {
    lease_number: `${TAG}-L${rnd()}`,
    commencement_date: isoDT(daysFromNow(0)),
    expiry_date: isoDT(daysFromNow(365)),
    lease_period_months: 12,
    rental_amount: 120000,
    lease_status: 'ACTIVE',
    ...overrides,
  };
  const r = await call('POST', '/api/leases', { cookie, body });
  if (r.status !== 201) throw new Error(`makeLease failed: ${r.status} ${short(r.body)}`);
  track('leases', r.body.id);
  return r.body;
}

export async function makePdc(status, chequeDate) {
  const id = BigInt(Date.now()) * 1000n + BigInt(rnd() % 1000);
  await db.fin_pdc_register.create({
    data: {
      id,
      cheque_number: `${TAG}-CHQ-${id}`,
      cheque_date: chequeDate,
      amount: 30000,
      status,
    },
  });
  track('fin_pdc_register', id.toString());
  return id;
}

export async function callRpc(name, body, cookie) {
  return call('POST', `/api/db/rpc/${name}`, { cookie, body });
}

export { idOf, short };

// Chart-of-accounts rows the suite posts to. Created only when a code is missing, named with the E2E- prefix,
// and removed by cleanup. Existing accounts are never changed.
const TEST_ACCOUNTS = [
  ['12000', 'Bank', 'ASSET'], ['12413', 'Tenant Receivables', 'ASSET'], ['12900', 'PDC In Hand', 'ASSET'],
  ['12412', 'Staff Current Account', 'ASSET'], ['11000', 'PPE', 'ASSET'],
  ['21000', 'Accounts Payable', 'LIABILITY'], ['21400', 'Customer PDC Liability', 'LIABILITY'],
  ['21500', 'Deposits - Leasing Customers', 'LIABILITY'], ['21900', 'Salary Payable', 'LIABILITY'],
  ['41100', 'Rental Revenue', 'REVENUE'], ['41201', 'Other Income', 'REVENUE'], ['41301', 'Gain/Loss on Sale of Fixed Assets', 'REVENUE'],
  ['50100', 'Staff Salary', 'EXPENSE'], ['51004', 'Repairs & Maintenance', 'EXPENSE'], ['51106', 'Depreciation & Amortisation', 'EXPENSE'],
];

export async function ensureTestAccounts() {
  const missing = [];
  for (const [code, name, type] of TEST_ACCOUNTS) {
    const existing = await db.fin_coa_accounts.findFirst({ where: { account_code: code } });
    if (existing) {
      if (!existing.is_active) throw new Error(`Account ${code} exists but is inactive; the suite will not change real accounts`);
      continue;
    }
    const row = await db.fin_coa_accounts.create({
      data: { account_code: code, account_name: `E2E-${name}`, account_type: type, is_active: true, account_level: 'GL' },
    });
    trackIds('fin_coa_accounts', row.id);
    missing.push(code);
  }
  return missing;
}
