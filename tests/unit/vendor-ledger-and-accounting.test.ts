import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextVendorLedgerCode,
  buildVendorAllocationPlan,
} from '../../server/lib/vendor-ledger';

test('nextVendorLedgerCode starts at 21000101 and increments sequentially', () => {
  assert.equal(nextVendorLedgerCode([]), '21000101');
  assert.equal(nextVendorLedgerCode(['21000', '21000001']), '21000101');
  assert.equal(nextVendorLedgerCode(['21000', '21000001', '21000101']), '21000102');
  assert.equal(nextVendorLedgerCode(['21000101', '21000105', '21000103']), '21000106');
});

test('buildVendorAllocationPlan supports multi-invoice partial settlement (e.g. 7 of 10)', () => {
  const plan = buildVendorAllocationPlan({
    totalAmount: 1750,
    allocations: [
      { invoice_number: 'APINV-001', grn_number: 'GRN-001', remaining: 1000, amount: 1000 },
      { invoice_number: 'APINV-002', grn_number: 'GRN-002', remaining: 1200, amount: 750 },
      { invoice_number: 'APINV-003', grn_number: 'GRN-003', remaining: 500, amount: 0 },
    ],
  });

  assert.equal(plan.totalAmount, 1750);
  assert.equal(plan.allocations.length, 2);
  assert.equal(plan.allocations[0].new_status, 'PAID');
  assert.equal(plan.allocations[1].new_status, 'PARTIAL');
});

test('buildVendorAllocationPlan rejects allocation exceeding remaining invoice balance', () => {
  assert.throws(() => {
    buildVendorAllocationPlan({
      totalAmount: 600,
      allocations: [
        { invoice_number: 'APINV-001', remaining: 500, amount: 600 },
      ],
    });
  }, /exceeds remaining balance/);
});

test('buildVendorAllocationPlan supports unallocated lump-sum partial payment without invoice selection', () => {
  const plan = buildVendorAllocationPlan({
    totalAmount: 2500,
    allocations: [],
  });
  assert.equal(plan.totalAmount, 2500);
  assert.equal(plan.allocations.length, 0);
});
