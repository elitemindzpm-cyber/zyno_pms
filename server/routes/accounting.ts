// server/routes/accounting.ts
// Finance / GL / Accounting Events endpoints
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tenantMiddleware, parsePagination, paginatedResponse } from '../lib/middleware';
import { dbAllowed } from '../lib/db-policy';

const router = Router();
router.use(tenantMiddleware);

// Accounting Events
router.get('/events', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { skip, take, page, limit } = parsePagination(req);
    const status = req.query.status as string;
    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      prisma.fin_accounting_events.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, include: { fin_accounting_event_lines: true } }),
      prisma.fin_accounting_events.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const id = req.params.id as string;
    const item = await prisma.fin_accounting_events.findFirst({
      where: { id, tenant_id: tenantId },
      include: { fin_accounting_event_lines: true },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Vouchers
router.get('/vouchers', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { skip, take, page, limit } = parsePagination(req);
    const where: any = { tenant_id: tenantId };
    const [data, total] = await Promise.all([
      prisma.fin_vouchers.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, include: { fin_voucher_lines: true } }),
      prisma.fin_vouchers.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Chart of Accounts
router.get('/coa', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.fin_coa_accounts.findMany({
      where: { is_active: true },
      orderBy: { account_code: 'asc' },
    });
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Create 5-Tier Chart of Account (TYPE -> GROUP -> CLASS -> GL -> SL)
router.post('/coa', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'coa_sl', 'write')) {
      return res.status(403).json({ error: 'Not authorized to create Chart of Accounts entries' });
    }

    const body = req.body || {};
    const type_code = String(body.type_code ?? '').trim();
    const type_name = String(body.type_name ?? '').trim();
    const group_code = String(body.group_code ?? '').trim();
    const group_name = String(body.group_name ?? '').trim();
    const class_code = String(body.class_code ?? '').trim();
    const class_name = String(body.class_name ?? '').trim();
    const gl_code = String(body.gl_code ?? '').trim();
    const gl_name = String(body.gl_name ?? '').trim();
    const sl_code = String(body.sl_code ?? '').trim();
    const sl_name = String(body.sl_name ?? '').trim();

    const missing: string[] = [];
    if (!type_code) missing.push('TYPE');
    if (!type_name) missing.push('TYPE NAME');
    if (!group_code) missing.push('GROUP');
    if (!group_name) missing.push('GROUP NAME');
    if (!class_code) missing.push('CLASS');
    if (!class_name) missing.push('CLASS NAME');
    if (!gl_code) missing.push('GL');
    if (!gl_name) missing.push('GL NAME');
    if (!sl_code) missing.push('SL');
    if (!sl_name) missing.push('SL NAME');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required COA fields: ${missing.join(', ')}` });
    }

    const isDebit =
      type_code.startsWith('1') ||
      type_code.startsWith('5') ||
      /asset|expenditure|expense|cost/i.test(type_name);
    const normalBalance = isDebit ? 'Debit' : 'Credit';
    const isPnl =
      type_code.startsWith('4') ||
      type_code.startsWith('5') ||
      /revenue|income|expenditure|expense|cost/i.test(type_name);
    const reportType = isPnl ? 'Profit & Loss' : 'Balance Sheet';

    const result = await prisma.$transaction(async (tx) => {
      // 1. TYPE
      let coaType = await tx.coa_types.findUnique({ where: { code: type_code } });
      if (!coaType) {
        coaType = await tx.coa_types.create({
          data: {
            code: type_code,
            name: type_name,
            normal_balance: normalBalance,
            report_type: reportType,
            is_active: true,
          },
        });
      }

      // 2. GROUP
      let coaGroup = await tx.coa_groups.findUnique({ where: { code: group_code } });
      if (!coaGroup) {
        coaGroup = await tx.coa_groups.create({
          data: {
            type_id: coaType.id,
            type_code: coaType.code,
            code: group_code,
            name: group_name,
            is_active: true,
          },
        });
      }

      // 3. CLASS
      let coaClass = await tx.coa_classes.findUnique({ where: { code: class_code } });
      if (!coaClass) {
        coaClass = await tx.coa_classes.create({
          data: {
            group_id: coaGroup.id,
            type_id: coaType.id,
            group_code: coaGroup.code,
            type_code: coaType.code,
            code: class_code,
            name: class_name,
            is_active: true,
          },
        });
      }

      // 4. GL
      let coaGl = await tx.coa_gl.findUnique({ where: { code: gl_code } });
      if (!coaGl) {
        coaGl = await tx.coa_gl.create({
          data: {
            class_id: coaClass.id,
            group_id: coaGroup.id,
            type_id: coaType.id,
            class_code: coaClass.code,
            group_code: coaGroup.code,
            type_code: coaType.code,
            code: gl_code,
            name: gl_name,
            normal_balance: coaType.normal_balance || normalBalance,
            is_active: true,
          },
        });
      }

      // 5. SL
      const existingSl = await tx.coa_sl.findUnique({ where: { code: sl_code } });
      if (existingSl) {
        const err: any = new Error(`Sub-Ledger (SL) code "${sl_code}" already exists (${existingSl.name}).`);
        err.status = 409;
        throw err;
      }

      const coaSl = await tx.coa_sl.create({
        data: {
          gl_id: coaGl.id,
          class_id: coaClass.id,
          group_id: coaGroup.id,
          type_id: coaType.id,
          gl_code: coaGl.code,
          class_code: coaClass.code,
          group_code: coaGroup.code,
          type_code: coaType.code,
          code: sl_code,
          name: sl_name,
          normal_balance: coaGl.normal_balance || coaType.normal_balance || normalBalance,
          is_active: true,
        },
      });

      // 6. Sync erp_chart_of_accounts (ensure parent GL row exists for FK erp_coa_gl_code_fk)
      const existingErpGl = await tx.erp_chart_of_accounts.findUnique({ where: { code: gl_code } });
      if (!existingErpGl) {
        await tx.erp_chart_of_accounts.create({
          data: {
            code: gl_code,
            name: gl_name,
            type: type_name,
            type_code,
            type_name,
            group_code,
            group_name,
            class_code,
            class_name,
            gl_code: null,
            gl_name,
            sl_code: null,
            sl_name: null,
          },
        });
      }

      let erpSl = await tx.erp_chart_of_accounts.findUnique({ where: { code: sl_code } });
      if (!erpSl) {
        erpSl = await tx.erp_chart_of_accounts.create({
          data: {
            code: sl_code,
            name: sl_name,
            type: type_name,
            type_code,
            type_name,
            group_code,
            group_name,
            class_code,
            class_name,
            gl_code: sl_code === gl_code ? null : gl_code,
            gl_name,
            sl_code,
            sl_name,
          },
        });
      } else {
        erpSl = await tx.erp_chart_of_accounts.update({
          where: { code: sl_code },
          data: {
            name: sl_name,
            type: type_name,
            type_code,
            type_name,
            group_code,
            group_name,
            class_code,
            class_name,
            gl_code: sl_code === gl_code ? null : gl_code,
            gl_name,
            sl_code,
            sl_name,
          },
        });
      }

      // 7. Sync fin_coa_accounts (GL parent + SL posting account)
      let finGl = await tx.fin_coa_accounts.findUnique({ where: { account_code: gl_code } });
      if (!finGl) {
        finGl = await tx.fin_coa_accounts.create({
          data: {
            account_code: gl_code,
            account_name: gl_name,
            account_type: type_name,
            group_name,
            class_name,
            account_level: 'GL',
            is_active: true,
          },
        });
      }

      let finSl = await tx.fin_coa_accounts.findUnique({ where: { account_code: sl_code } });
      if (!finSl) {
        finSl = await tx.fin_coa_accounts.create({
          data: {
            account_code: sl_code,
            account_name: sl_name,
            account_type: type_name,
            parent_id: finGl.id,
            parent_account_id: finGl.id,
            group_name,
            class_name,
            account_level: 'SL',
            is_active: true,
          },
        });
      }

      return { coaType, coaGroup, coaClass, coaGl, coaSl, erpAccount: erpSl, finAccount: finSl };
    });

    res.status(201).json({ data: result });
  } catch (e: any) {
    const status = e?.status || 500;
    res.status(status).json({ error: e.message || 'Failed to create Chart of Account' });
  }
});

// ── Unit ledgers: one PDC In Hand, Deposit and Receivables sub-ledger per unit ──
// Posting resolves a unit's SL from fin_unit_sl_accounts (unit + GL). unit_coa_mapping is the per-unit summary.
const UNIT_LEDGER_GLS = { pdc: '12900', deposit: '21500', receivable: '12413' } as const;
const UNIT_LEDGER_GL_CODES: string[] = Object.values(UNIT_LEDGER_GLS);
const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

// Lookup data for the Excel importer: units, properties, the three parent GLs and every code already in use.
router.get('/unit-ledgers/context', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'coa_sl', 'read')) {
      return res.status(403).json({ error: 'Not authorized to read Chart of Accounts' });
    }
    const [units, properties, glRows, coaSl, coaGl, finAccounts, unitSl, mappings] = await Promise.all([
      prisma.units.findMany({ select: { id: true, property_id: true, unit_ref: true, unit_code: true, unit_name: true } }),
      prisma.properties.findMany({ select: { id: true, title: true, property_code: true } }),
      prisma.coa_gl.findMany({ where: { code: { in: UNIT_LEDGER_GL_CODES } }, select: { code: true, name: true } }),
      prisma.coa_sl.findMany({ select: { code: true } }),
      prisma.coa_gl.findMany({ select: { code: true } }),
      prisma.fin_coa_accounts.findMany({ select: { account_code: true } }),
      prisma.fin_unit_sl_accounts.findMany({ select: { unit_id: true, gl_code: true, sl_code: true } }),
      prisma.unit_coa_mapping.findMany({ select: { unit_id: true } }),
    ]);

    const takenCodes = new Set<string>([
      ...coaSl.map(r => r.code),
      ...coaGl.map(r => r.code),
      ...finAccounts.map(r => r.account_code),
      ...unitSl.map(r => r.sl_code),
    ]);
    const unitsWithLedgers = new Set<string>([
      ...unitSl.filter(r => UNIT_LEDGER_GL_CODES.includes(r.gl_code)).map(r => r.unit_id),
      ...mappings.map(r => r.unit_id),
    ]);

    res.json({
      data: {
        units: units.map(u => ({
          id: u.id,
          property_id: u.property_id,
          unit_code: u.unit_code || u.unit_ref,
          unit_name: u.unit_name || u.unit_ref,
        })),
        properties: properties.map(p => ({ id: p.id, property_code: p.property_code, title: p.title })),
        gls: Object.fromEntries(glRows.map(g => [g.code, { code: g.code, name: g.name }])),
        takenCodes: [...takenCodes],
        unitsWithLedgers: [...unitsWithLedgers],
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Creates the PDC, deposit and receivable SLs for one unit in a single transaction (all or nothing).
router.post('/unit-ledgers', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'coa_sl', 'write')) {
      return res.status(403).json({ error: 'Not authorized to create unit ledgers' });
    }

    const body = req.body || {};
    const unitId = String(body.unit_id ?? '').trim();
    const propertyId = String(body.property_id ?? '').trim();
    if (!unitId || !propertyId) {
      return res.status(400).json({ error: 'unit_id and property_id are required' });
    }

    const specs = (
      [
        { kind: 'pdc', gl: UNIT_LEDGER_GLS.pdc, input: body.pdc },
        { kind: 'deposit', gl: UNIT_LEDGER_GLS.deposit, input: body.deposit },
        { kind: 'receivable', gl: UNIT_LEDGER_GLS.receivable, input: body.receivable },
      ] as { kind: string; gl: string; input: any }[]
    ).map(s => ({ ...s, code: String(s.input?.code ?? '').trim(), name: String(s.input?.name ?? '').trim() }));

    const missing = specs.filter(s => !s.code || !s.name).map(s => `${s.kind} code and name`);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    if (new Set(specs.map(s => s.code)).size !== specs.length) {
      return res.status(400).json({ error: 'The PDC, deposit and receivable SL codes must be different' });
    }
    if (specs.some(s => UNIT_LEDGER_GL_CODES.includes(s.code))) {
      return res.status(400).json({ error: 'An SL code cannot be the same as a GL code' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const unit = await tx.units.findUnique({
        where: { id: unitId },
        select: { id: true, property_id: true, unit_ref: true, unit_code: true },
      });
      if (!unit) throw httpError(404, 'Unit not found');
      if ((unit.property_id ?? '') !== propertyId) {
        throw httpError(400, 'Unit does not belong to the given property');
      }
      const unitLabel = unit.unit_code || unit.unit_ref;

      const existingMapping = await tx.unit_coa_mapping.findUnique({ where: { unit_id: unitId } });
      const existingSl = await tx.fin_unit_sl_accounts.findFirst({
        where: { unit_id: unitId, gl_code: { in: UNIT_LEDGER_GL_CODES } },
      });
      if (existingMapping || existingSl) {
        throw httpError(409, `Unit ${unitLabel} already has unit ledgers.`);
      }

      for (const s of specs) {
        const taken =
          (await tx.coa_sl.findUnique({ where: { code: s.code } })) ||
          (await tx.coa_gl.findUnique({ where: { code: s.code } })) ||
          (await tx.fin_coa_accounts.findUnique({ where: { account_code: s.code } })) ||
          (await tx.fin_unit_sl_accounts.findUnique({ where: { sl_code: s.code } }));
        if (taken) throw httpError(409, `Code "${s.code}" is already in use.`);
      }

      const created: Record<string, { coaSl: any; finSl: any }> = {};
      for (const s of specs) {
        const gl = await tx.coa_gl.findUnique({ where: { code: s.gl } });
        if (!gl) throw httpError(422, `GL ${s.gl} is not in the Chart of Accounts. Upload the chart first.`);
        const finGl = await tx.fin_coa_accounts.findUnique({ where: { account_code: s.gl } });
        if (!finGl) throw httpError(422, `GL ${s.gl} is missing from the posting chart (fin_coa_accounts).`);

        const coaSl = await tx.coa_sl.create({
          data: {
            gl_id: gl.id,
            class_id: gl.class_id,
            group_id: gl.group_id,
            type_id: gl.type_id,
            gl_code: gl.code,
            class_code: gl.class_code,
            group_code: gl.group_code,
            type_code: gl.type_code,
            code: s.code,
            name: s.name,
            normal_balance: gl.normal_balance,
            is_active: true,
          },
        });

        const finSl = await tx.fin_coa_accounts.create({
          data: {
            account_code: s.code,
            account_name: s.name,
            account_type: finGl.account_type,
            parent_id: finGl.id,
            parent_account_id: finGl.id,
            group_name: finGl.group_name,
            class_name: finGl.class_name,
            account_level: 'SL',
            is_active: true,
          },
        });

        await tx.fin_unit_sl_accounts.create({
          data: {
            unit_id: unitId,
            property_id: propertyId,
            gl_code: s.gl,
            sl_code: s.code,
            sl_name: s.name,
            coa_account_id: finSl.id,
            is_active: true,
          },
        });

        created[s.kind] = { coaSl, finSl };
      }

      const mapping = await tx.unit_coa_mapping.create({
        data: {
          unit_id: unitId,
          property_id: propertyId,
          unit_code: unitLabel,
          pdc_sl_id: created.pdc.coaSl.id,
          pdc_sl_code: specs[0].code,
          pdc_sl_name: specs[0].name,
          deposit_sl_id: created.deposit.coaSl.id,
          deposit_sl_code: specs[1].code,
          deposit_sl_name: specs[1].name,
          receivable_sl_id: created.receivable.coaSl.id,
          receivable_sl_code: specs[2].code,
          receivable_sl_name: specs[2].name,
          status: 'Active',
        },
      });

      return { unit_id: unitId, unit_code: unitLabel, mapping };
    });

    res.status(201).json({ data: result });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e.message || 'Failed to create unit ledgers' });
  }
});

// Posting Engine Compliance View
router.get('/compliance', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw`SELECT * FROM v_posting_engine_compliance LIMIT 100`;
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
