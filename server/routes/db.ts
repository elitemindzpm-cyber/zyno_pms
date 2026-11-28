// server/routes/db.ts
// Universal REST query proxy for Prisma models
// Powers the frontend REST-backed DB proxy with 100% MariaDB execution

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { txn } from '../lib/prisma';
import { coerceForModel, coerceWhere, buildIncludeFromSelect } from '../lib/coerce';
import { postManualVoucher, postAccountingEvent, resolveUnitSl, refreshEventTotals, validateEventBalance, manualPdcStatusUpdate, nextCustomerCode } from '../lib/finance-rpc';
import { HttpError, sendDbError } from '../lib/errors';
import { dbAllowed, ruleFor, rpcAllowed, type Op } from '../lib/db-policy';
import { createLease, terminateLease, insertPdc, isTerminatedLease } from '../services/leases';
import { createUnit, createCustomer, createReservation, assertPropertyDeletable } from '../services/property';

// Tables whose inserts run the shared business rules (the same functions the dedicated routes use).
const DOMAIN_INSERT: Record<string, (row: any) => Promise<any>> = {
  leases: createLease,
  reservations: createReservation,
  units: createUnit,
  customers: createCustomer,
  fin_pdc_register: insertPdc,   // the "pdcs" table name is an alias for fin_pdc_register
};
import { isTenant, tenantLeaseWhere } from '../lib/tenant-policy';

// Tenant ticket rule: the unit must be on an active lease held by this tenant.
async function tenantHoldsActiveLeaseForUnitRef(claims: { sub: string; email?: string }, unitRef: string | null) {
  if (!unitRef) return false;
  const units = await prisma.units.findMany({ where: { unit_ref: unitRef }, select: { id: true } });
  if (!units.length) return false;
  const lease = await prisma.leases.findFirst({
    where: {
      AND: [
        tenantLeaseWhere(claims),
        { unit_id: { in: units.map((u) => u.id) } },
        { lease_status: { in: ['ACTIVE', 'Active', 'active'] } },
      ],
    },
    select: { id: true },
  });
  return !!lease;
}

// Stock is consumed with a conditional update, so on-hand quantity can never go negative.
async function recordMaterialUsage(usage: any) {
  // Stock and the usage record are saved together; the ledger entry (Dr consumption / Cr inventory) follows.
  // If the ledger entry cannot be posted, the issue is undone so stock and ledger never disagree.
  let unitCost = 0;
  const created = await txn(async (tx) => {
    const qty = Number(usage.quantity);
    if (!Number.isInteger(qty) || qty <= 0) throw new HttpError(400, 'Quantity must be a positive whole number');
    if (usage.part_id) {
      const parts = await tx.$queryRaw<{ id: string; name: string; quantity_on_hand: number; unit_cost: unknown }[]>`
        SELECT id, name, quantity_on_hand, unit_cost FROM inventory_parts WHERE id = ${usage.part_id} FOR UPDATE`;
      if (!parts.length) throw new HttpError(404, `Part ${usage.part_id} was not found`);
      const part = parts[0];
      if (Number(part.quantity_on_hand) < qty) {
        throw new HttpError(400,
          `Insufficient stock available for part ${part.name}. Available: ${part.quantity_on_hand}, Requested: ${qty}`);
      }
      unitCost = Number(part.unit_cost) || 0;
      await tx.$executeRaw`UPDATE inventory_parts SET quantity_on_hand = quantity_on_hand - ${qty}
        WHERE id = ${part.id} AND quantity_on_hand >= ${qty}`;
    }
    const data = { ...usage };
    if ((data.cost === undefined || data.cost === null || Number(data.cost) === 0) && unitCost > 0) data.cost = unitCost * qty;
    return tx.material_usage.create({ data });
  });

  const cost = Number((created as any).cost) || 0;
  if (cost > 0) {
    try {
      await postManualVoucher({
        voucher_date: new Date().toISOString().slice(0, 10),
        voucher_type: 'Journal',
        reference_no: `MI-${String((created as any).id).slice(0, 18)}`,
        description: `Material issue — part ${usage.part_id ?? ''} x ${usage.quantity}${usage.ticket_id ? ' (ticket ' + usage.ticket_id + ')' : ''}`,
        lines: [
          { account_code: '51004001', debit: cost, credit: 0 },   // Repair and Maintenance Cost
          { account_code: '12800001', debit: 0, credit: cost },   // Stock-Inventory
        ],
      });
    } catch (err) {
      await txn(async (tx) => {
        await tx.material_usage.delete({ where: { id: (created as any).id } });
        if (usage.part_id) await tx.$executeRaw`UPDATE inventory_parts SET quantity_on_hand = quantity_on_hand + ${Number(usage.quantity)} WHERE id = ${usage.part_id}`;
      });
      throw err;
    }
  }
  return created;
}

// Leave: the request must fit within the employee's remaining balance (balance minus pending) for that year.
async function recordLeaveApplication(app: any) {
  return txn(async (tx) => {
    const requested = Number(app.days_count);
    const year = new Date(app.start_date).getUTCFullYear();
    if (app.employee_id && app.leave_type_id) {
      const bal = await tx.hrms_leave_balances.findFirst({
        where: { employee_id: app.employee_id, leave_type_id: app.leave_type_id, year },
      });
      if (bal) {
        const available = Number(bal.balance ?? 0) - Number(bal.pending ?? 0);
        if (requested > available) {
          throw new HttpError(422, `Insufficient leave balance. Available: ${available} days, Requested: ${requested} days`);
        }
        await tx.hrms_leave_balances.update({ where: { id: bal.id }, data: { pending: { increment: requested } } });
      }
    }
    return tx.hrms_leave_applications.create({ data: app });
  });
}

// Next number from proc_document_sequences (shared by document numbering and entity codes).
export async function nextSequenceNumber(docType: string, fiscalYear: number, prefix: string): Promise<string> {
  const row = await txn(async (tx) => {
    await tx.$executeRaw`INSERT INTO proc_document_sequences (document_type, prefix, current_number, padding_length, fiscal_year)
      VALUES (${docType}, ${prefix}, 1, 6, ${fiscalYear})
      ON DUPLICATE KEY UPDATE current_number = current_number + 1`;
    const rows = await tx.$queryRaw<{ prefix: string; current_number: bigint; padding_length: number }[]>`
      SELECT prefix, current_number, padding_length FROM proc_document_sequences
      WHERE document_type = ${docType} AND fiscal_year = ${fiscalYear}`;
    return rows[0];
  });
  const pad = Number(row.padding_length) || 6;
  return `${row.prefix || prefix}-${String(Number(row.current_number)).padStart(pad, '0')}`;
}

const router = Router();

// Permission check for every /api/db request, before any handler runs. Deny by default.
const OP_FOR_ROUTE: Record<string, Op> = { query: 'read', insert: 'write', upsert: 'write', update: 'write', delete: 'delete' };
router.use((req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).user?.role as string | undefined;
  const parts = req.path.split('/').filter(Boolean);   // ['<table>', '<op>']  or  ['rpc', '<fn>']
  if (parts[0] === 'rpc') {
    if (!rpcAllowed(role, parts[1] ?? '')) return res.status(403).json({ data: null, error: 'INSUFFICIENT_PERMISSIONS' });
    return next();
  }
  const [table, route] = parts;
  const op = OP_FOR_ROUTE[route ?? ''];
  if (!table || !op) return next();                     // unknown route: falls through to 404
  const model = resolveModelName(table);
  if (!dbAllowed(role, model, op)) {
    return res.status(403).json({ data: null, error: 'INSUFFICIENT_PERMISSIONS', requiredRole: ruleFor(model)[op] });
  }
  next();
});
const ACCOUNT_LINE_TABLES = new Set(['fin_accounting_event_lines', 'fin_voucher_lines']);

/** D5: Posted vouchers, posted accounting events, and their lines are immutable. */
async function assertNotPostedLedgerRecord(modelName: string, model: any, where: Record<string, any>, action: 'modified' | 'deleted') {
  if (modelName === 'fin_vouchers' || modelName === 'fin_accounting_events') {
    const rows = await model.findMany({ where, select: { id: true, status: true } });
    if (rows.some((r: any) => String(r.status).toUpperCase() === 'POSTED')) {
      throw new HttpError(400, modelName === 'fin_vouchers'
        ? `Posted vouchers cannot be ${action}. You must post a Reversal Voucher`
        : `Posted accounting events cannot be ${action}. Reverse the event instead`);
    }
  } else if (modelName === 'fin_voucher_lines') {
    const lines = await model.findMany({ where, select: { voucher_id: true } });
    const voucherIds = Array.from(new Set(lines.map((l: any) => l.voucher_id).filter(Boolean))) as string[];
    if (voucherIds.length) {
      const postedV = await prisma.fin_vouchers.findFirst({ where: { id: { in: voucherIds }, status: { in: ['Posted', 'POSTED', 'posted'] } }, select: { id: true } });
      if (postedV) throw new HttpError(400, `Lines of a posted voucher cannot be ${action}`);
    }
  } else if (modelName === 'fin_accounting_event_lines') {
    const lines = await model.findMany({ where, select: { event_id: true } });
    const eventIds = Array.from(new Set(lines.map((l: any) => l.event_id).filter(Boolean))) as string[];
    if (eventIds.length) {
      const postedE = await prisma.fin_accounting_events.findFirst({ where: { id: { in: eventIds }, status: 'POSTED' as any }, select: { id: true } });
      if (postedE) throw new HttpError(400, `Lines of a posted accounting event cannot be ${action}`);
    }
  }
}

// Table aliases for backwards compatibility with legacy DB code
const TABLE_ALIASES: Record<string, string> = {
  pdcs: 'fin_pdc_register',
  gl_accounts: 'fin_coa_accounts',
  vouchers: 'fin_vouchers',
  accounting_events: 'fin_accounting_events',
  deposits: 'fin_deposits',
  bank_accounts: 'fin_bank_accounts',
  departments: 'departments',
  designations: 'designations',
  employees: 'employees',
  vendors: 'fin_vendors',
};

function resolveModelName(table: string): string {
  const normalized = table.toLowerCase();
  const target = TABLE_ALIASES[normalized] || normalized;
  
  // Find matching key in prisma
  const prismaKeys = Object.keys(prisma).filter(
    (k) => !k.startsWith('$') && !k.startsWith('_')
  );
  
  const found = prismaKeys.find((k) => k.toLowerCase() === target.toLowerCase());
  return found || target;
}

// ── Query (findMany / findFirst / count) ──────────────────────────────────────
router.post('/:table/query', async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' (resolved: '${modelName}') not found in Prisma client`,
      });
    }

    const {
      where = {},
      orderBy,
      skip,
      take,
      single = false,
      maybeSingle = false,
      countOnly = false,
      select,
    } = req.body;
    const include = buildIncludeFromSelect(modelName, select);

    // Filter out unsupported columns or format conditions
    const cleanWhere: Record<string, any> = {};
    // Plain dates ("2026-12-01") in a filter on a DateTime column must be full ISO timestamps for Prisma.
    for (const [key, val] of Object.entries(coerceWhere(modelName, where) as Record<string, any>)) {
      if (val !== undefined) {
        cleanWhere[key] = val;
      }
    }
    // Tenants see only their own tickets, whatever the request asks for.
    if (isTenant(req) && modelName === 'maintenance_tickets') {
      cleanWhere.tenant_id = (req as any).user.tenant_id;
    }

    if (countOnly) {
      const count = await model.count({ where: cleanWhere });
      return res.json({ data: null, count, error: null });
    }

    if (single || maybeSingle) {
      const item = await model.findFirst({
        where: cleanWhere,
        orderBy,
        ...(include ? { include } : {}),
      });

      if (single && !item) {
        return res.status(404).json({
          data: null,
          error: `No record found in ${table}`,
        });
      }
      return res.json({ data: item, error: null });
    }

    const queryOptions: any = {
      where: cleanWhere,
    };
    if (include) queryOptions.include = include;
    if (orderBy) queryOptions.orderBy = orderBy;
    if (typeof skip === 'number') queryOptions.skip = skip;
    if (typeof take === 'number') queryOptions.take = take;

    const items = await model.findMany(queryOptions);
    return res.json({ data: items, error: null, count: items.length });
  } catch (err: any) {
    console.error(`[db-proxy query error on ${req.params.table}]`, err.message);
    return sendDbError(res, err, 'db-proxy');
  }
});

// ── RPC: database functions the app calls by name ─────────────────────────────
// Only functions that are ported are implemented. Anything else returns an explicit error.
router.post('/rpc/:fn', async (req: Request, res: Response) => {
  const fn = req.params.fn as string;
  try {
    if (fn === 'proc_next_document_number') {
      const docType = String(req.body?.p_doc_type || '').toUpperCase();
      const fiscalYear = Number(req.body?.p_fiscal_year);
      if (!docType || !Number.isInteger(fiscalYear)) {
        return res.status(400).json({ data: null, error: 'p_doc_type and p_fiscal_year are required' });
      }
      const row = await txn(async (tx) => {
        await tx.$executeRaw`INSERT INTO proc_document_sequences (document_type, prefix, current_number, padding_length, fiscal_year)
          VALUES (${docType}, ${docType}, 1, 6, ${fiscalYear})
          ON DUPLICATE KEY UPDATE current_number = current_number + 1`;
        const rows = await tx.$queryRaw<{ prefix: string; current_number: bigint; padding_length: number }[]>`
          SELECT prefix, current_number, padding_length FROM proc_document_sequences
          WHERE document_type = ${docType} AND fiscal_year = ${fiscalYear}`;
        return rows[0];
      });
      const pad = Number(row.padding_length) || 6;
      const docNo = `${row.prefix || docType}-${fiscalYear}-${String(Number(row.current_number)).padStart(pad, '0')}`;
      return res.json({ data: docNo, error: null });
    }
    if (fn === 'post_accounting_event_atomic') {
      const data = await postAccountingEvent(String(req.body?.p_event_id || ''));
      return res.json({ data, error: null });
    }
    if (fn === 'fin_resolve_unit_sl') {
      const data = await resolveUnitSl(
        String(req.body?.p_unit_id || ''),
        String(req.body?.p_property_id || ''),
        String(req.body?.p_gl_code || ''),
        req.body?.p_unit_name ?? null,
      );
      return res.json({ data, error: null });
    }
    if (fn === 'fin_refresh_event_totals') {
      await refreshEventTotals(String(req.body?.p_event_id || ''));
      return res.json({ data: null, error: null });
    }
    if (fn === 'fin_validate_event_balance') {
      const data = await validateEventBalance(String(req.body?.p_event_id || ''));
      return res.json({ data, error: null });
    }
    if (fn === 'fin_manual_pdc_status_update') {
      const b = req.body || {};
      const data = await manualPdcStatusUpdate({
        pdcId: b.p_pdc_id,
        status: b.p_status,
        depositDate: b.p_deposit_date ?? null,
        clearedDate: b.p_cleared_date ?? null,
        returnedDate: b.p_returned_date ?? null,
        bankId: b.p_bank_id ?? null,
        overrideCode: b.p_override_code ?? null,
      });
      return res.json({ data, error: null });
    }
    return res.status(501).json({ data: null, error: `Database function '${fn}' is not available in this system yet` });
  } catch (err: any) {
    console.error(`[db-proxy rpc error on ${fn}]`, err.message);
    return sendDbError(res, err, 'db-proxy');
  }
});

// ── Upsert (insert, or update the row that matches the onConflict columns) ───
router.post('/:table/upsert', async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];
    if (!model) {
      return res.status(404).json({ data: null, error: `Model '${table}' not found in Prisma client` });
    }
    const { onConflict } = req.body;
    const data = coerceForModel(modelName, req.body.data);
    if (!data) return res.status(400).json({ data: null, error: 'No data provided for upsert' });

    const keys: string[] = onConflict ? String(onConflict).split(',').map((k) => k.trim()).filter(Boolean) : ['id'];
    const items: any[] = Array.isArray(data) ? data : [data];
    const saved: any[] = [];
    for (const item of items) {
      const where: Record<string, any> = {};
      for (const k of keys) {
        if (item[k] !== undefined) where[k] = item[k];
      }
      const existing = Object.keys(where).length
        ? await model.findFirst({ where })
        : null;
      if (existing) {
        const { id: _ignored, ...changes } = item;
        const updated = await model.update({ where: { id: existing.id }, data: changes });
        saved.push(updated);
      } else {
        saved.push(await model.create({ data: item }));
      }
    }
    return res.json({ data: Array.isArray(data) ? saved : saved[0], error: null });
  } catch (err: any) {
    console.error(`[db-proxy upsert error on ${req.params.table}]`, err.message);
    return sendDbError(res, err, 'db-proxy');
  }
});

// ── Insert ───────────────────────────────────────────────────────────────────
router.post('/:table/insert', async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' not found in Prisma client`,
      });
    }

    const data = coerceForModel(modelName, req.body.data);
    if (modelName === 'fin_voucher_lines') {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        if (!row) continue;
        // C5: Map legacy debit/credit aliases to debit_amount/credit_amount
        if (row.debit !== undefined && row.debit_amount === undefined) { row.debit_amount = row.debit; delete row.debit; }
        if (row.credit !== undefined && row.credit_amount === undefined) { row.credit_amount = row.credit; delete row.credit; }
        // Resolve required account_id from fin_coa_accounts when only account_code is provided
        if (!row.account_id && row.account_code) {
          const coa = await prisma.fin_coa_accounts.findFirst({
            where: { account_code: String(row.account_code), is_active: true },
            select: { id: true, account_name: true },
          });
          if (!coa) {
            return res.status(400).json({ data: null, error: `fin_voucher_lines.account_code "${row.account_code}" does not resolve to an active row in fin_coa_accounts` });
          }
          row.account_id = coa.id;
          if (!row.account_name) row.account_name = coa.account_name;
        }
      }
    }
    if (ACCOUNT_LINE_TABLES.has(table)) {
      const rowsToCheck = Array.isArray(data) ? data : [data];
      for (const row of rowsToCheck) {
        if (!row || !row.account_code) continue;
        const found = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM fin_coa_accounts
          WHERE account_code = ${String(row.account_code)} AND is_active = TRUE LIMIT 1`;
        if (!found.length) {
          return res.status(400).json({ data: null, error: `${table}.account_code "${row.account_code}" does not resolve to an active row in fin_coa_accounts. All accounting events must be composed through the Account Resolver.` });
        }
      }
    }
    if (!data) {
      return res.status(400).json({ data: null, error: 'No data provided for insert' });
    }

    if (modelName === 'customers') {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        if (!row.customer_code) row.customer_code = await nextCustomerCode();
      }
    }

    if (DOMAIN_INSERT[modelName]) {
      const rows = Array.isArray(data) ? data : [data];
      const out: any[] = [];
      for (const row of rows) out.push(await DOMAIN_INSERT[modelName](row));
      return res.json({ data: Array.isArray(data) ? out : out[0], error: null });
    }

    // Tenant maintenance tickets: each unit must be on this tenant's active lease, and the tenant is forced.
    if (modelName === 'maintenance_tickets' && isTenant(req)) {
      const claims = (req as any).user;
      const rowsT = Array.isArray(data) ? data : [data];
      for (const r of rowsT) {
        const unitRef = r?.unit_ref ?? null;
        if (!(await tenantHoldsActiveLeaseForUnitRef(claims, unitRef))) {
          throw new HttpError(403, `User does not hold an active lease for Unit ${unitRef ?? '(none)'}`);
        }
        r.tenant_id = claims.tenant_id;
      }
    }

    if (modelName === 'material_usage' && !Array.isArray(data)) {
      const created = await recordMaterialUsage(data);
      return res.json({ data: created, error: null });
    }
    if (modelName === 'hrms_leave_applications' && !Array.isArray(data)) {
      const created = await recordLeaveApplication(data);
      return res.json({ data: created, error: null });
    }

    if (Array.isArray(data)) {
      // createMany or sequential create
      const created = [];
      for (const item of data) {
        const c = await model.create({ data: item });
        created.push(c);
      }
      return res.json({ data: created, error: null });
    } else {
      const created = await model.create({ data });
      return res.json({ data: created, error: null });
    }
  } catch (err: any) {
    console.error(`[db-proxy insert error on ${req.params.table}]`, err.message);
    return sendDbError(res, err, 'db-proxy');
  }
});

// ── Update ───────────────────────────────────────────────────────────────────
router.post('/:table/update', async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' not found in Prisma client`,
      });
    }

    const where = coerceWhere(modelName, req.body.where ?? {});
    // B1: Reject empty filters to prevent unguarded bulk writes
    if (!where || !Object.keys(where).length) {
      return res.status(400).json({ data: null, error: 'A non-empty filter (where) is required for update operations' });
    }
    const data = coerceForModel(modelName, req.body.data);
    if (!data) {
      return res.status(400).json({ data: null, error: 'No data provided for update' });
    }

    // D5: Block edits to posted vouchers, posted accounting events, and their lines.
    await assertNotPostedLedgerRecord(modelName, model, where, 'modified');

    if (modelName === 'leases' && isTerminatedLease(data.lease_status)) {
      const targets = await model.findMany({ where, select: { id: true } });
      const results: any[] = [];
      for (const t of targets) results.push(await terminateLease(t.id, data));
      return res.json({ data: { count: results.length, settlements: results }, error: null });
    }

    // B4: When filtering by id, return the updated row instead of just {count}
    if (where.id && !Array.isArray(where.id) && typeof where.id !== 'object') {
      const updated = await model.update({ where: { id: where.id }, data });
      return res.json({ data: updated, error: null });
    }

    const result = await model.updateMany({
      where,
      data,
    });

    // B1: Treat zero-match updates as a 404
    if (result.count === 0) {
      return res.status(404).json({ data: null, error: `No matching records found in ${table} to update` });
    }

    return res.json({ data: result, error: null });
  } catch (err: any) {
    console.error(`[db-proxy update error on ${req.params.table}]`, err.message);
    return sendDbError(res, err, 'db-proxy');
  }
});

// ── Delete ───────────────────────────────────────────────────────────────────
router.post('/:table/delete', async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' not found in Prisma client`,
      });
    }

    const where = coerceWhere(modelName, req.body.where ?? {});
    // B1: Reject empty filters to prevent unguarded bulk deletes
    if (!where || !Object.keys(where).length) {
      return res.status(400).json({ data: null, error: 'A non-empty filter (where) is required for delete operations' });
    }
    if (modelName === 'properties') {
      const targets = await model.findMany({ where, select: { id: true } });
      for (const t of targets) await assertPropertyDeletable(t.id);
    }
    // Posted financial records and their lines are never deleted; they are reversed instead.
    await assertNotPostedLedgerRecord(modelName, model, where, 'deleted');
    const result = await model.deleteMany({
      where,
    });

    return res.json({ data: result, error: null });
  } catch (err: any) {
    console.error(`[db-proxy delete error on ${req.params.table}]`, err.message);
    return sendDbError(res, err, 'db-proxy');
  }
});

export default router;
