import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbAllowed, rpcAllowed, ruleFor } from '../../server/lib/db-policy';

test('admins may delete operational rows; other staff may not', () => {
  assert.equal(dbAllowed('ADMIN', 'reservations', 'delete'), true);
  assert.equal(dbAllowed('PROP_MGR', 'reservations', 'delete'), false);
  assert.equal(dbAllowed('FINANCE', 'reservations', 'delete'), false);
});

test('ledger tables: finance writes, nobody below admin deletes', () => {
  assert.equal(dbAllowed('FINANCE', 'fin_vouchers', 'write'), true);
  assert.equal(dbAllowed('PROP_MGR', 'fin_vouchers', 'write'), false);
  assert.equal(dbAllowed('FINANCE', 'fin_vouchers', 'delete'), false);
  assert.equal(dbAllowed('ADMIN', 'fin_vouchers', 'delete'), true);
});

test('identity and configuration tables are admin-only', () => {
  assert.equal(dbAllowed('PROP_MGR', 'users', 'read'), false);
  assert.equal(dbAllowed('ADMIN', 'users', 'read'), true);
  assert.equal(dbAllowed('ADMIN', 'system_configurations', 'write'), false);   // super admin only
  assert.equal(dbAllowed('SUPER_ADMIN', 'system_configurations', 'write'), true);
  assert.equal(dbAllowed('ADMIN', 'role_permissions', 'read'), true);
});

test('deny by default: tenants, guests, missing roles', () => {
  assert.equal(dbAllowed('TENANT', 'properties', 'read'), false);
  assert.equal(dbAllowed('GUEST', 'properties', 'read'), false);
  assert.equal(dbAllowed(undefined, 'properties', 'read'), false);
});

test('security audit log cannot be deleted by anyone', () => {
  assert.equal(dbAllowed('SUPER_ADMIN', 'security_audit_logs', 'delete'), false);
});

test('finance-prefixed tables use the ledger rule, including the pdcs alias target', () => {
  assert.deepEqual(ruleFor('fin_pdc_register').write, ruleFor('fin_vouchers').write);
  assert.equal(dbAllowed('CASHIER', 'fin_pdc_register', 'write'), true);
});

test('accounting RPCs are restricted to finance roles; unknown RPCs to admins', () => {
  assert.equal(rpcAllowed('FINANCE', 'post_accounting_event_atomic'), true);
  assert.equal(rpcAllowed('PROP_MGR', 'post_accounting_event_atomic'), false);
  assert.equal(rpcAllowed('PROP_MGR', 'some_unknown_function'), false);
  assert.equal(rpcAllowed('ADMIN', 'some_unknown_function'), true);
});

test('TENANT can read/write maintenance_tickets; CASHIER cannot write or delete fin_posting_periods', () => {
  assert.equal(dbAllowed('TENANT', 'maintenance_tickets', 'read'), true);
  assert.equal(dbAllowed('TENANT', 'maintenance_tickets', 'write'), true);
  assert.equal(dbAllowed('TENANT', 'maintenance_tickets', 'delete'), false);
  assert.equal(dbAllowed('CASHIER', 'fin_posting_periods', 'write'), false);
  assert.equal(dbAllowed('FINANCE', 'fin_posting_periods', 'write'), true);
  assert.equal(dbAllowed('SUPER_ADMIN', 'fin_posting_periods', 'delete'), false);
});
