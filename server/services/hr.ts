// server/services/hr.ts
// Payroll runs, final-settlement (FnF) approval with the asset gate, and asset return.
import prisma from '../lib/prisma';
import { txn } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { num, money } from './leases';
import { postGlEvent } from './posting';

const SALARY_EXPENSE = '50100';     // Staff Salary (GL)
const SALARY_PAYABLE = '21900';     // Salary Payable (GL)
const STAFF_RECEIVABLE = '12412';   // Staff Current Account: loan instalments recovered from salary
const WORKING_DAYS = 30;
const UNPAID_STATUSES = ['ABSENT', 'UNPAID_LEAVE', 'LOP'];

// ── Payroll run ─────────────────────────────────────────────────────────────────
/**
 * Processes a payroll cycle: gross from the employee's pay components, minus unpaid-leave days
 * (pro-rated over 30 days), minus loan instalments. It writes one payslip per employee, updates the
 * cycle totals, and posts one salary journal: Dr Staff Salary / Cr Salary Payable (net) / Cr Staff
 * Current Account (loan recovery).
 */
export async function runPayrollCycle(cycleId: string, opts: { employeeIds?: string[] } = {}) {
  const cycle = await prisma.hrms_payroll_cycles.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new HttpError(404, 'Payroll cycle not found');
  if (String(cycle.status || '').toLowerCase() !== 'draft') {
    throw new HttpError(409, `Payroll cycle is already ${cycle.status}`);
  }

  const employees = await prisma.employees.findMany({
    where: {
      ...(opts.employeeIds ? { id: { in: opts.employeeIds } } : {}),
      OR: [{ employee_status: null }, { employee_status: { in: ['Active', 'ACTIVE', 'active'] } }],
    },
  });

  const payslips: any[] = [];
  let totalEarnings = 0;
  let totalNet = 0;
  let totalLoans = 0;

  await txn(async (tx) => {
    for (const emp of employees) {
      const gross = money(num(emp.basic_salary) + num(emp.hra) + num(emp.tra) + num(emp.other_allowances));
      if (!(gross > 0)) continue;

      const unpaidDays = await tx.hrms_attendance_daily.count({
        where: {
          employee_id: emp.id,
          attendance_date: { gte: cycle.start_date, lte: cycle.end_date },
          status: { in: UNPAID_STATUSES },
        },
      });
      const unpaidDeduction = money((gross / WORKING_DAYS) * unpaidDays);
      const earnings = money(gross - unpaidDeduction);

      let loanDeduction = 0;
      const loans = await tx.hrms_employee_loans.findMany({ where: { employee_id: emp.id, status: 'Active' } });
      for (const loan of loans) {
        const instalment = money(Math.min(num(loan.monthly_emi), num(loan.remaining_balance)));
        if (instalment <= 0) continue;
        loanDeduction = money(loanDeduction + instalment);
        const remaining = money(num(loan.remaining_balance) - instalment);
        await tx.hrms_employee_loans.update({
          where: { id: loan.id },
          data: {
            total_repaid: money(num(loan.total_repaid) + instalment),
            remaining_balance: remaining,
            status: remaining <= 0 ? 'Closed' : 'Active',
          },
        });
      }

      const net = money(earnings - loanDeduction);
      payslips.push(await tx.hrms_payroll_payslips.create({
        data: {
          payroll_cycle_id: cycle.id,
          employee_id: emp.id,
          working_days: WORKING_DAYS,
          present_days: WORKING_DAYS - unpaidDays,
          unpaid_leaves: unpaidDays,
          basic_pay: money(num(emp.basic_salary)),
          allowances: money(num(emp.hra) + num(emp.tra) + num(emp.other_allowances)),
          gross_earnings: earnings,
          loan_deductions: loanDeduction,
          total_deductions: loanDeduction,
          net_salary: net,
          status: 'Generated',
        },
      }));
      totalEarnings = money(totalEarnings + earnings);
      totalNet = money(totalNet + net);
      totalLoans = money(totalLoans + loanDeduction);
    }

    await tx.hrms_payroll_cycles.update({
      where: { id: cycle.id },
      data: {
        status: 'Processed',
        total_gross: totalEarnings,
        total_deductions: money(totalEarnings - totalNet),
        total_net: totalNet,
        total_employees: payslips.length,
      },
    });
  });

  let voucher: string | null = null;
  if (totalEarnings > 0) {
    const lines = [
      { code: SALARY_EXPENSE, debit: totalEarnings, credit: 0 },
      { code: SALARY_PAYABLE, debit: 0, credit: money(totalNet) },
    ];
    if (totalLoans > 0) lines.push({ code: STAFF_RECEIVABLE, debit: 0, credit: totalLoans });
    const posted = await postGlEvent({
      eventType: 'MANUAL_JOURNAL', sourceType: 'PAYROLL', sourceId: cycle.id,
      idempotencyKey: `payroll:${cycle.id}`, description: `Salary journal - ${cycle.name}`, lines,
    });
    voucher = posted.voucherNumber;
  }

  return {
    cycle_id: cycleId,
    status: 'Processed',
    employees: payslips.length,
    total_earnings: totalEarnings,
    total_loan_recovery: totalLoans,
    total_net: totalNet,
    voucher,
    payslips: payslips.map((p) => ({
      employee_id: p.employee_id, gross_earnings: p.gross_earnings, unpaid_leaves: p.unpaid_leaves,
      loan_deductions: p.loan_deductions, net_salary: p.net_salary,
    })),
  };
}

// ── Final settlement and assets ─────────────────────────────────────────────────
const ASSET_OUT_STATUSES = ['Allocated', 'Assigned', 'Issued', 'Active'];

/** A final settlement cannot be approved while the employee still holds company assets. */
export async function approveFnfSettlement(fnfId: string, approverUserId: string) {
  const fnf = await prisma.hrms_fnf_settlements.findUnique({ where: { id: fnfId } });
  if (!fnf) throw new HttpError(404, 'Settlement not found');
  if (String(fnf.status || '').toLowerCase() === 'approved') throw new HttpError(409, 'Settlement is already approved');
  if (!fnf.employee_id) throw new HttpError(400, 'Settlement has no employee');

  const held = await prisma.hrms_asset_allocations.findMany({
    where: {
      employee_id: fnf.employee_id,
      returned_date: null,
      status: { in: ASSET_OUT_STATUSES },
    },
  });
  if (held.length) {
    const assets = await prisma.assets.findMany({ where: { id: { in: held.map((h) => h.asset_id).filter(Boolean) as string[] } }, select: { asset_name: true } });
    const names = assets.map((a) => a.asset_name).join(', ') || `${held.length} asset(s)`;
    throw new HttpError(409, `Company assets not yet returned: ${names}`);
  }

  // approved_by references employees.id: store the approver's employee record when there is one.
  const approver = await prisma.employees.findFirst({ where: { user_id: approverUserId }, select: { id: true } });
  return prisma.hrms_fnf_settlements.update({
    where: { id: fnfId },
    data: { status: 'Approved', approved_by: approver?.id ?? null },
  });
}

/** Records an asset coming back: the allocation is closed and the asset becomes available again. */
export async function returnAssetAllocation(allocationId: string, input: { condition_at_return?: string }) {
  const alloc = await prisma.hrms_asset_allocations.findUnique({ where: { id: allocationId } });
  if (!alloc) throw new HttpError(404, 'Allocation not found');
  if (alloc.returned_date || String(alloc.status) === 'Returned') throw new HttpError(409, 'Asset is already returned');

  await txn(async (tx) => {
    await tx.hrms_asset_allocations.update({
      where: { id: allocationId },
      data: { status: 'Returned', returned_date: new Date(), condition_at_return: input.condition_at_return ?? null },
    });
    if (alloc.asset_id) {
      await tx.assets.update({
        where: { id: alloc.asset_id },
        data: { asset_status: 'Available', assigned_employee_id: null, assigned_employee_name: null, assignment_date: null, return_date: new Date() },
      });
    }
  });
  return { allocation_id: allocationId, status: 'Returned', asset_id: alloc.asset_id };
}
