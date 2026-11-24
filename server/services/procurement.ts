// server/services/procurement.ts
// Purchase-order approval limits, three-way matching of supplier invoices, and landed-cost allocation.
import prisma from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { num, money } from './leases';
import { postGlEvent } from './posting';

/**
 * Delegation of authority. An approver may approve a purchase order up to their own employee
 * approval_limit; above that, the order needs the next level up.
 */
export const APPROVAL_LEVELS = [
  { role: 'Property Manager', max: 10000 },
  { role: 'Director', max: 50000 },
  { role: 'Chief Executive', max: Number.POSITIVE_INFINITY },
];

const VENDOR_INVOICE_EXPENSE = '51004';   // Repairs & Maintenance (live VENDOR_INVOICE rule)
const AP_CONTROL = '21000';               // Accounts payable (live VENDOR_INVOICE rule)

// ── Purchase-order approval ─────────────────────────────────────────────────────
export async function approvePurchaseOrder(poId: string, approverUserId: string) {
  const po = await prisma.proc_purchase_orders.findUnique({ where: { id: poId } });
  if (!po) throw new HttpError(404, 'Purchase order not found');
  if (String(po.status) === 'APPROVED') throw new HttpError(409, 'Purchase order is already approved');
  if (!['SUBMITTED', 'PENDING_APPROVAL'].includes(String(po.status))) {
    throw new HttpError(409, `Purchase order must be submitted before approval (status ${po.status})`);
  }

  const approver = await prisma.employees.findFirst({ where: { user_id: approverUserId } });
  const limit = num(approver?.approval_limit);
  if (!approver || limit <= 0) throw new HttpError(403, 'No approval authority is configured for this user');

  const total = money(num(po.total_amount));
  if (total > limit) {
    const level = APPROVAL_LEVELS.find((l) => total <= l.max) ?? APPROVAL_LEVELS[APPROVAL_LEVELS.length - 1];
    throw new HttpError(403,
      `User approval limit (${limit}) exceeded. Required Level: ${level.role} (up to ${level.max})`);
  }

  const updated = await prisma.proc_purchase_orders.update({
    where: { id: poId },
    // approved_by references employees.id, so the approver's employee record is stored.
    data: { status: 'APPROVED', approved_by: approver.id, approved_at: new Date() },
  });
  return updated;
}

// ── Three-way match ─────────────────────────────────────────────────────────────
/**
 * Matches each invoice line to its purchase-order line and to the goods received against it.
 * A bill quantity above the received quantity, or above the ordered quantity, is an exception
 * and blocks approval.
 */
export async function matchPayableInvoice(invoiceId: string) {
  const inv = await prisma.proc_payable_invoices.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new HttpError(404, 'Invoice not found');
  const lines = await prisma.proc_payable_invoice_lines.findMany({ where: { payable_invoice_id: invoiceId }, orderBy: { line_no: 'asc' } });
  if (!lines.length) throw new HttpError(400, 'Invoice has no lines to match');

  const exceptions: string[] = [];
  let quantityVariance = 0;
  let amountVariance = 0;
  for (const line of lines) {
    if (!line.source_line_id) {
      exceptions.push(`Line ${line.line_no ?? '?'} is not linked to a purchase-order line`);
      continue;
    }
    const poLine = await prisma.proc_purchase_order_lines.findUnique({ where: { id: line.source_line_id } });
    if (!poLine) {
      exceptions.push(`Line ${line.line_no ?? '?'} references an unknown purchase-order line`);
      continue;
    }
    const grnLines = await prisma.proc_grn_lines.findMany({ where: { purchase_order_line_id: poLine.id } });
    const grnQty = grnLines.reduce((s, g) => s + num(g.accepted_quantity ?? g.received_quantity), 0);
    const poQty = num(poLine.ordered_quantity ?? poLine.quantity);
    const billQty = num(line.quantity);

    if (billQty > grnQty) {
      const over = money(billQty - grnQty);
      exceptions.push(`Bill quantity (${billQty}) exceeds GRN quantity (${grnQty}) by ${over} units`);
      quantityVariance += over;
    }
    if (billQty > poQty) {
      exceptions.push(`Bill quantity (${billQty}) exceeds PO quantity (${poQty}) by ${money(billQty - poQty)} units`);
    }
    const rateDiff = money(num(line.unit_rate) - num(poLine.unit_rate));
    if (rateDiff !== 0) {
      amountVariance += money(rateDiff * billQty);
      exceptions.push(`Unit rate ${num(line.unit_rate)} differs from PO rate ${num(poLine.unit_rate)}`);
    }
  }

  const status = exceptions.length ? 'MATCHING_EXCEPTION' : 'MATCHED';
  await prisma.proc_three_way_matches.create({
    data: {
      payable_invoice_id: invoiceId,
      purchase_order_id: inv.purchase_order_id,
      goods_receipt_id: inv.goods_receipt_id,
      match_status: status,
      quantity_variance: money(quantityVariance),
      amount_variance: money(amountVariance),
    },
  });
  await prisma.proc_payable_invoices.update({ where: { id: invoiceId }, data: { status } });
  return { invoice_id: invoiceId, status, exceptions };
}

/** Approves a matched invoice and posts it to accounts payable: Dr expense / Cr 21000. */
export async function approvePayableInvoice(invoiceId: string, approverUserId: string) {
  const inv = await prisma.proc_payable_invoices.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (String(inv.status) !== 'MATCHED') {
    throw new HttpError(409, `Invoice must be matched before approval (status ${inv.status})`);
  }
  const lines = await prisma.proc_payable_invoice_lines.findMany({ where: { payable_invoice_id: invoiceId } });
  const byAccount = new Map<string, number>();
  for (const l of lines) {
    const code = l.expense_account_code || VENDOR_INVOICE_EXPENSE;
    byAccount.set(code, money((byAccount.get(code) ?? 0) + num(l.line_total)));
  }
  const total = money([...byAccount.values()].reduce((s, v) => s + v, 0));

  const posted = await postGlEvent({
    eventType: 'MANUAL_JOURNAL', sourceType: 'AP_INVOICE', sourceId: invoiceId,
    idempotencyKey: `ap:${invoiceId}`, description: `Vendor invoice ${inv.doc_number ?? invoiceId}`,
    lines: [
      ...[...byAccount.entries()].map(([code, amount]) => ({ code, debit: amount, credit: 0 })),
      { code: AP_CONTROL, debit: 0, credit: total },
    ],
  });
  await prisma.proc_payable_invoices.update({
    where: { id: invoiceId },
    data: { status: 'APPROVED', posting_status: 'POSTED', accounting_event_id: posted.eventId },
  });
  void approverUserId;
  return { invoice_id: invoiceId, status: 'APPROVED', amount: total, voucher: posted.voucherNumber };
}

// ── Landed cost ─────────────────────────────────────────────────────────────────
/**
 * Spreads duty and freight over the purchase-order lines in proportion to line value, and returns
 * the true landed cost of each line and per unit. Costs are recorded in proc_landed_costs.
 */
export async function allocateLandedCost(poId: string, input: { duty_amount?: unknown; freight_amount?: unknown }) {
  const po = await prisma.proc_purchase_orders.findUnique({ where: { id: poId } });
  if (!po) throw new HttpError(404, 'Purchase order not found');
  const lines = await prisma.proc_purchase_order_lines.findMany({ where: { purchase_order_id: poId }, orderBy: { line_no: 'asc' } });
  if (!lines.length) throw new HttpError(400, 'Purchase order has no lines');

  const duty = money(num(input.duty_amount));
  const freight = money(num(input.freight_amount));
  const base = money(lines.reduce((s, l) => s + num(l.line_total), 0));
  if (!(base > 0)) throw new HttpError(400, 'Purchase order has no value to allocate against');

  const allocate = (total: number) => {
    let left = total;
    return lines.map((l, i) => {
      const share = i === lines.length - 1 ? money(left) : money((total * num(l.line_total)) / base);
      left = money(left - share);
      return share;
    });
  };
  const dutyShares = allocate(duty);
  const freightShares = allocate(freight);

  const rows = lines.map((l, i) => {
    const landed = money(num(l.line_total) + dutyShares[i] + freightShares[i]);
    const qty = num(l.quantity ?? l.ordered_quantity);
    return {
      line_id: l.id, item_name: l.item_name, quantity: qty, base_cost: money(num(l.line_total)),
      allocated_duty: dutyShares[i], allocated_freight: freightShares[i],
      landed_cost: landed, landed_unit_cost: qty > 0 ? money(landed / qty) : null,
    };
  });

  await prisma.proc_landed_costs.createMany({
    data: [
      { doc_number: `LC-${po.doc_number}-DUTY`, purchase_order_id: poId, cost_type: 'DUTY', amount: duty, allocation_basis: 'VALUE', status: 'ALLOCATED' },
      { doc_number: `LC-${po.doc_number}-FREIGHT`, purchase_order_id: poId, cost_type: 'FREIGHT', amount: freight, allocation_basis: 'VALUE', status: 'ALLOCATED' },
    ],
  });
  return {
    purchase_order_id: poId, base_value: base, duty, freight,
    total_landed_cost: money(rows.reduce((s, r) => s + r.landed_cost, 0)), lines: rows,
  };
}
