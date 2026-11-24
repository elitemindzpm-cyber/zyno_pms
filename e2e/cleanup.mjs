// e2e/cleanup.mjs
// Removes rows created by the E2E suite. It matches only the test markers:
//   names/titles/codes starting with "E2E-" (or containing "E2E-" in document numbers), and emails/keys
//   starting with "e2e-" (ending "@e2e.test"). Rows without a marker (pricing rules) are removed by id,
//   from the run-state files the suite writes.
// Run directly:  node e2e/cleanup.mjs [--dry-run]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, STATE_DIR } from './lib/env.mjs';

const NAME = { startsWith: 'E2E-' };
const DOC = { contains: 'E2E-' };
const EMAIL = { startsWith: 'e2e-', endsWith: '@e2e.test' };

function recordedIds(kind) {
  if (!fs.existsSync(STATE_DIR)) return [];
  const ids = [];
  for (const f of fs.readdirSync(STATE_DIR).filter((n) => n.startsWith('state-') && n.endsWith('.json'))) {
    try {
      const st = JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
      for (const c of st.created ?? []) if (c.kind === kind) ids.push(c.id);
    } catch { /* unreadable state file: ignore */ }
  }
  return ids;
}

export async function cleanup({ dryRun = false, log = console.log } = {}) {
  const counts = {};
  const ids = {};

  // ── Collect tagged ids first, so dependent rows can be matched after their parents are gone.
  ids.pdc = (await db.fin_pdc_register.findMany({ where: { cheque_number: NAME }, select: { id: true } })).map((p) => String(p.id));
  ids.leases = (await db.leases.findMany({ where: { lease_number: NAME }, select: { id: true } })).map((l) => l.id);
  ids.units = (await db.units.findMany({ where: { OR: [{ unit_ref: NAME }, { unit_name: NAME }] }, select: { id: true } })).map((u) => u.id);
  ids.users = (await db.users.findMany({ where: { email: EMAIL }, select: { id: true } })).map((u) => u.id);
  ids.employees = (await db.employees.findMany({ where: { first_name: NAME }, select: { id: true } })).map((e) => e.id);
  ids.assets = (await db.assets.findMany({ where: { asset_name: NAME }, select: { id: true } })).map((a) => a.id);
  ids.cycles = (await db.hrms_payroll_cycles.findMany({ where: { name: NAME }, select: { id: true } })).map((c) => c.id);
  ids.invoices = (await db.proc_payable_invoices.findMany({ where: { doc_number: NAME }, select: { id: true } })).map((i) => i.id);
  ids.pos = (await db.proc_purchase_orders.findMany({ where: { doc_number: NAME }, select: { id: true } })).map((p) => p.id);
  ids.grns = (await db.proc_goods_receipts.findMany({ where: { grn_number: NAME }, select: { id: true } })).map((g) => g.id);
  ids.vendors = (await db.fin_vendors.findMany({ where: { code: NAME }, select: { id: true } })).map((v) => v.id);
  ids.tickets = (await db.maintenance_tickets.findMany({ where: { title: NAME }, select: { id: true } })).map((t) => t.id);
  ids.parts = (await db.inventory_parts.findMany({ where: { name: NAME }, select: { id: true } })).map((p) => p.id);
  ids.units_sl = (await db.fin_unit_sl_accounts.findMany({ where: { OR: [{ unit_id: { in: ids.units } }, { sl_name: { contains: 'E2E-' } }] }, select: { sl_code: true } })).map((s) => s.sl_code);

  const events = await db.fin_accounting_events.findMany({
    where: {
      OR: [
        { idempotency_key: NAME }, { source_id: NAME },
        { source_id: { in: [...ids.pdc, ...ids.leases, ...ids.assets, ...ids.invoices, ...ids.cycles, ...ids.pos] } },
        { lease_id: { in: ids.leases } },
      ],
    },
    select: { id: true, voucher_id: true },
  });
  const eventIds = events.map((e) => e.id);
  const vouchers = (await db.fin_vouchers.findMany({
    where: {
      OR: [
        { voucher_number: NAME }, { accounting_event_id: { in: eventIds } },
        { id: { in: events.map((e) => e.voucher_id).filter(Boolean) } },
      ],
    },
    select: { id: true },
  })).map((v) => v.id);
  const pricingRuleIds = recordedIds('pricing_rules');

  if (dryRun) {
    log(`[cleanup] dry run. matched: events=${eventIds.length} vouchers=${vouchers.length} leases=${ids.leases.length} units=${ids.units.length} employees=${ids.employees.length} assets=${ids.assets.length} pos=${ids.pos.length} pricing_rules=${pricingRuleIds.length}`);
    return counts;
  }

  const plan = [
    ['pricing_rules (recorded by runs)', () => db.pricing_rules.deleteMany({ where: { id: { in: pricingRuleIds } } })],
    ['payments', () => db.payments.deleteMany({ where: { reference_no: NAME } })],
    ['fin_accounting_events.voucher_id (unlink)', () => db.fin_accounting_events.updateMany({ where: { id: { in: eventIds } }, data: { voucher_id: null } })],
    ['fin_vouchers.accounting_event_id (unlink)', () => db.fin_vouchers.updateMany({ where: { id: { in: vouchers } }, data: { accounting_event_id: null } })],
    ['fin_voucher_lines', () => db.fin_voucher_lines.deleteMany({ where: { voucher_id: { in: vouchers } } })],
    ['fin_vouchers', () => db.fin_vouchers.deleteMany({ where: { id: { in: vouchers } } })],
    ['fin_accounting_event_lines', () => db.fin_accounting_event_lines.deleteMany({ where: { event_id: { in: eventIds } } })],
    ['fin_accounting_events', () => db.fin_accounting_events.deleteMany({ where: { id: { in: eventIds } } })],
    ['material_usage', () => db.material_usage.deleteMany({ where: { OR: [{ ticket_id: { in: ids.tickets } }, { part_id: { in: ids.parts } }] } })],
    ['maintenance_tickets', () => db.maintenance_tickets.deleteMany({ where: { title: NAME } })],
    ['inventory_parts', () => db.inventory_parts.deleteMany({ where: { name: NAME } })],
    ['hrms_payroll_payslips', () => db.hrms_payroll_payslips.deleteMany({ where: { OR: [{ payroll_cycle_id: { in: ids.cycles } }, { employee_id: { in: ids.employees } }] } })],
    ['hrms_payroll_cycles', () => db.hrms_payroll_cycles.deleteMany({ where: { id: { in: ids.cycles } } })],
    ['hrms_employee_loans', () => db.hrms_employee_loans.deleteMany({ where: { employee_id: { in: ids.employees } } })],
    ['hrms_attendance_daily', () => db.hrms_attendance_daily.deleteMany({ where: { employee_id: { in: ids.employees } } })],
    ['hrms_fnf_settlements', () => db.hrms_fnf_settlements.deleteMany({ where: { employee_id: { in: ids.employees } } })],
    ['hrms_asset_allocations', () => db.hrms_asset_allocations.deleteMany({ where: { OR: [{ employee_id: { in: ids.employees } }, { asset_id: { in: ids.assets } }] } })],
    ['hrms_leave_applications', () => db.hrms_leave_applications.deleteMany({ where: { employee_id: { in: ids.employees } } })],
    ['hrms_leave_balances', () => db.hrms_leave_balances.deleteMany({ where: { employee_id: { in: ids.employees } } })],
    ['hrms_leave_types', () => db.hrms_leave_types.deleteMany({ where: { code: NAME } })],
    ['assets', () => db.assets.deleteMany({ where: { id: { in: ids.assets } } })],
    ['proc_three_way_matches', () => db.proc_three_way_matches.deleteMany({ where: { payable_invoice_id: { in: ids.invoices } } })],
    ['proc_payable_invoice_lines', () => db.proc_payable_invoice_lines.deleteMany({ where: { payable_invoice_id: { in: ids.invoices } } })],
    ['proc_payable_invoices', () => db.proc_payable_invoices.deleteMany({ where: { id: { in: ids.invoices } } })],
    ['proc_grn_lines', () => db.proc_grn_lines.deleteMany({ where: { goods_receipt_id: { in: ids.grns } } })],
    ['proc_goods_receipts', () => db.proc_goods_receipts.deleteMany({ where: { id: { in: ids.grns } } })],
    ['proc_landed_costs', () => db.proc_landed_costs.deleteMany({ where: { doc_number: DOC } })],
    ['proc_purchase_order_lines', () => db.proc_purchase_order_lines.deleteMany({ where: { purchase_order_id: { in: ids.pos } } })],
    ['proc_purchase_orders', () => db.proc_purchase_orders.deleteMany({ where: { id: { in: ids.pos } } })],
    ['proc_purchase_requests', () => db.proc_purchase_requests.deleteMany({ where: { doc_number: NAME } })],
    ['fin_vendors', () => db.fin_vendors.deleteMany({ where: { id: { in: ids.vendors } } })],
    ['fin_pdc_register', () => db.fin_pdc_register.deleteMany({ where: { OR: [{ cheque_number: NAME }, { lease_id: { in: ids.leases } }] } })],
    ['fin_posting_periods', () => db.fin_posting_periods.deleteMany({ where: { period_name: NAME } })],
    ['reservations', () => db.reservations.deleteMany({ where: { prospect_name: NAME } })],
    ['leases', () => db.leases.deleteMany({ where: { lease_number: NAME } })],
    ['employees', () => db.employees.deleteMany({ where: { id: { in: ids.employees } } })],
    ['unit_coa_mapping', () => db.unit_coa_mapping.deleteMany({ where: { unit_id: { in: ids.units } } })],
    ['fin_unit_sl_accounts', () => db.fin_unit_sl_accounts.deleteMany({ where: { OR: [{ unit_id: { in: ids.units } }, { sl_code: { in: ids.units_sl } }] } })],
    ['fin_coa_accounts (unit SL rows)', () => db.fin_coa_accounts.deleteMany({ where: { account_code: { in: ids.units_sl } } })],
    ['fin_coa_accounts (test sub-ledgers)', () => db.fin_coa_accounts.deleteMany({ where: { account_name: { startsWith: 'E2E-' }, account_level: 'SL' } })],
    ['fin_coa_accounts (test GL rows)', () => db.fin_coa_accounts.deleteMany({ where: { account_name: { startsWith: 'E2E-' } } })],
    ['units', () => db.units.deleteMany({ where: { id: { in: ids.units } } })],
    ['properties', () => db.properties.deleteMany({ where: { title: NAME } })],
    ['customers', () => db.customers.deleteMany({ where: { full_name: NAME } })],
    ['tenant_organisations', () => db.tenant_organisations.deleteMany({ where: { tenant_key: { startsWith: 'e2e-' } } })],
    ['profiles', () => db.profiles.deleteMany({ where: { id: { in: ids.users } } })],
    ['users', () => db.users.deleteMany({ where: { id: { in: ids.users } } })],
  ];

  for (const [name, run] of plan) {
    try {
      const res = await run();
      counts[name] = res?.count ?? 0;
    } catch (e) {
      counts[name] = `ERROR: ${e.message.split('\n').pop()}`;
    }
  }
  log('[cleanup] rows removed:', JSON.stringify(counts));
  return counts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dry = process.argv.includes('--dry-run');
  cleanup({ dryRun: dry }).finally(() => db.$disconnect());
}
