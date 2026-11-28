import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination } from '../../server/lib/middleware';
import { coerceForModel, coerceWhere, buildIncludeFromSelect } from '../../server/lib/coerce';
import { money } from '../../server/lib/money';
import { computeDepositSettlement } from '../../server/lib/settlement';

test('parsePagination handles invalid, zero, negative, and huge limits safely', () => {
  const mkReq = (query: Record<string, string>) => ({ query }) as any;
  assert.deepEqual(parsePagination(mkReq({ page: 'abc', limit: 'abc' })), { skip: 0, take: 25, page: 1, limit: 25 });
  assert.deepEqual(parsePagination(mkReq({ page: '0', limit: '0' })), { skip: 0, take: 25, page: 1, limit: 25 });
  assert.deepEqual(parsePagination(mkReq({ page: '-2', limit: '-5' })), { skip: 0, take: 25, page: 1, limit: 25 });
  assert.deepEqual(parsePagination(mkReq({ page: '3', limit: '500' })), { skip: 200, take: 100, page: 3, limit: 100 });
});

test('coerceForModel converts numeric strings, decimals, empty strings, and DateTime on write', () => {
  const row = coerceForModel('fin_pdc_register', {
    bank_id: '42',
    amount: '1500.50',
    cheque_date: '2026-11-28',
    deposit_date: '',
    tenant_id: 'a0000000-0000-0000-0000-000000000001',
  });
  assert.equal(row.bank_id, 42n);
  assert.equal(row.amount, 1500.5);
  assert.equal(row.cheque_date, '2026-11-28T00:00:00.000Z');
  assert.equal(row.deposit_date, null);
  assert.equal(row.tenant_id, 'a0000000-0000-0000-0000-000000000001');
});

test('coerceWhere recursively converts AND/OR filters and date-only operators', () => {
  const where = coerceWhere('leases', {
    AND: [
      { commencement_date: { gte: '2026-01-01' } },
      { commencement_date: { lte: '2026-12-31' } },
    ],
  });
  assert.equal(where.AND[0].commencement_date.gte, '2026-01-01T00:00:00.000Z');
  assert.equal(where.AND[1].commencement_date.lte, '2026-12-31T00:00:00.000Z');
});

test('buildIncludeFromSelect resolves alias:fk_col(fields) to Prisma relation', () => {
  const include = buildIncludeFromSelect('leases', '*, properties(id, title), customers:customer_id(full_name)');
  assert.ok(include);
  assert.deepEqual(include.properties, { select: { id: true, title: true } });
  assert.deepEqual(include.customers, { select: { full_name: true } });
});

test('money rounds currency consistently to 2 decimals including binary float edge cases', () => {
  assert.equal(money(1.005), 1.01);
  assert.equal(money('1234.567'), 1234.57);
  assert.equal(money(null), 0);
  assert.equal(money('not-a-number'), 0);
});

test('computeDepositSettlement splits deductions between deposit refund and tenant excess charge', () => {
  assert.deepEqual(computeDepositSettlement(5000, 1200.5, 500), {
    deposit: 5000,
    damage_charges: 1200.5,
    early_termination_penalty: 500,
    deductions: 1700.5,
    applied_from_deposit: 1700.5,
    billed_to_tenant: 0,
    refund: 3299.5,
  });
  assert.deepEqual(computeDepositSettlement(2000, 1500, 1000.25), {
    deposit: 2000,
    damage_charges: 1500,
    early_termination_penalty: 1000.25,
    deductions: 2500.25,
    applied_from_deposit: 2000,
    billed_to_tenant: 500.25,
    refund: 0,
  });
});
