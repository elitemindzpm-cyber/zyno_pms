// server/routes/accounting.ts
// Finance / GL / Accounting Events endpoints
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma, { txn } from '../lib/prisma';
import { tenantMiddleware, parsePagination, paginatedResponse } from '../lib/middleware';
import { dbAllowed } from '../lib/db-policy';
import { postManualVoucher } from '../lib/finance-rpc';
import { money as money2 } from '../lib/money';
import {
  ensureStockInventoryAccountTx,
  ensureVendorLedgerTx,
  buildVendorAllocationPlan,
} from '../lib/vendor-ledger';

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
    const where: any = {};
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

// Rename a GL or SL ledger account across COA hierarchy, ERP COA master, and fin_coa_accounts.
router.patch('/coa', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'coa_sl', 'write')) {
      return res.status(403).json({ error: 'Not authorized to update Chart of Accounts' });
    }
    const code = String(req.body?.code || '').trim();
    const name = String(req.body?.name || '').trim();
    const level = req.body?.level === 'GL' ? 'GL' : req.body?.level === 'SL' ? 'SL' : undefined;
    if (!code || !name) {
      return res.status(400).json({ error: 'Account code and new ledger name are required' });
    }
    if (name.length > 200) {
      return res.status(400).json({ error: 'Account name must be 200 characters or fewer' });
    }

    const updated = await txn(async (tx) => {
      let matched = false;

      if (level !== 'SL') {
        const glRow = await tx.coa_gl.findUnique({ where: { code } });
        if (glRow) {
          matched = true;
          await tx.coa_gl.update({ where: { code }, data: { name } });
          await tx.erp_chart_of_accounts.updateMany({ where: { gl_code: code }, data: { gl_name: name } });
        }
      }

      if (level !== 'GL') {
        const slRow = await tx.coa_sl.findUnique({ where: { code } });
        if (slRow) {
          matched = true;
          await tx.coa_sl.update({ where: { code }, data: { name } });
          await tx.fin_unit_sl_accounts.updateMany({ where: { sl_code: code }, data: { sl_name: name } });
          await tx.unit_coa_mapping.updateMany({ where: { pdc_sl_code: code }, data: { pdc_sl_name: name } });
          await tx.unit_coa_mapping.updateMany({ where: { deposit_sl_code: code }, data: { deposit_sl_name: name } });
          await tx.unit_coa_mapping.updateMany({ where: { receivable_sl_code: code }, data: { receivable_sl_name: name } });
        }
      }

      const erpRow = await tx.erp_chart_of_accounts.findUnique({ where: { code } });
      if (erpRow) {
        matched = true;
        await tx.erp_chart_of_accounts.update({
          where: { code },
          data: {
            name,
            ...(erpRow.sl_code === code ? { sl_name: name } : {}),
            ...(erpRow.gl_code === code ? { gl_name: name } : {}),
          },
        });
      }

      const finRow = await tx.fin_coa_accounts.findUnique({ where: { account_code: code } });
      if (finRow) {
        matched = true;
        await tx.fin_coa_accounts.update({ where: { account_code: code }, data: { account_name: name } });
      }

      if (!matched) {
        throw Object.assign(new Error(`Account code ${code} not found in Chart of Accounts`), { status: 404 });
      }
      return { code, name, level: level || (finRow?.account_level === 'GL' ? 'GL' : 'SL') };
    });

    res.json({ data: updated });
  } catch (e: any) {
    const status = e?.status || 500;
    res.status(status).json({ error: e.message || 'Failed to rename Chart of Account' });
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

// ── Company bank accounts: each account gets the next GL code from 12000001 and its own posting SL under GL 12000 ──
const BANK_GL_PARENT = '12000';
const BANK_GL_FIRST = 12000001;

router.post('/bank-accounts', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'coa_sl', 'write')) {
      return res.status(403).json({ error: 'Not authorized to create bank accounts' });
    }

    const body = req.body || {};
    const bankId = Number(body.bank_id);
    const accountNumber = String(body.account_number ?? '').trim();
    const accountTitle = String(body.account_title ?? '').trim();
    const currency = String(body.currency ?? 'QAR').trim() || 'QAR';

    if (!Number.isInteger(bankId) || bankId <= 0) return res.status(400).json({ error: 'bank_id is required' });
    if (!accountNumber || !accountTitle) return res.status(400).json({ error: 'Account number and account title are required' });
    if (currency !== 'QAR') return res.status(400).json({ error: 'Only QAR bank accounts are supported' });

    const result = await prisma.$transaction(async (tx) => {
      const bank = await tx.fin_banks.findUnique({ where: { id: bankId } });
      if (!bank) throw httpError(404, 'Bank not found');

      const duplicate = await tx.fin_bank_accounts.findUnique({ where: { account_number: accountNumber } });
      if (duplicate) throw httpError(409, `Account number ${accountNumber} already exists`);

      // Next code after the highest one in use; never below 12000001, so 12000000 is never assigned.
      const used = await tx.fin_bank_accounts.findMany({ where: { gl_code: { not: null } }, select: { gl_code: true } });
      const highest = used.reduce((m: number, r: any) => Math.max(m, Number(r.gl_code)), BANK_GL_FIRST - 1);
      const glCode = String(highest + 1);

      const parentGl = await tx.coa_gl.findUnique({ where: { code: BANK_GL_PARENT } });
      if (!parentGl) throw httpError(422, `GL ${BANK_GL_PARENT} (Bank) is not in the Chart of Accounts.`);
      const parentFin = await tx.fin_coa_accounts.findUnique({ where: { account_code: BANK_GL_PARENT } });
      if (!parentFin) throw httpError(422, `GL ${BANK_GL_PARENT} (Bank) is missing from the posting chart.`);

      // A code that already exists in the chart (12000001 is the generic "Bank" SL) is reused, not duplicated.
      let coaSl = await tx.coa_sl.findUnique({ where: { code: glCode } });
      if (!coaSl) {
        coaSl = await tx.coa_sl.create({
          data: {
            gl_id: parentGl.id,
            class_id: parentGl.class_id,
            group_id: parentGl.group_id,
            type_id: parentGl.type_id,
            gl_code: parentGl.code,
            class_code: parentGl.class_code,
            group_code: parentGl.group_code,
            type_code: parentGl.type_code,
            code: glCode,
            name: `${bank.name} - ${accountTitle}`,
            normal_balance: parentGl.normal_balance,
            is_active: true,
          },
        });
      }
      let finSl = await tx.fin_coa_accounts.findUnique({ where: { account_code: glCode } });
      if (!finSl) {
        finSl = await tx.fin_coa_accounts.create({
          data: {
            account_code: glCode,
            account_name: `${bank.name} - ${accountTitle}`,
            account_type: parentFin.account_type,
            parent_id: parentFin.id,
            parent_account_id: parentFin.id,
            group_name: parentFin.group_name,
            class_name: parentFin.class_name,
            account_level: 'SL',
            is_active: true,
          },
        });
      }

      const account = await tx.fin_bank_accounts.create({
        data: {
          bank_id: bankId,
          account_number: accountNumber,
          account_title: accountTitle,
          currency,
          opening_balance: 0,
          gl_code: glCode,
        },
      });
      return { account, glCode, bankName: bank.name, coaSlId: coaSl.id, finAccountId: finSl.id };
    });

    res.status(201).json({ data: result });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e.message || 'Failed to create bank account' });
  }
});

// General Ledger: one row per posted voucher line, with property / unit / customer resolved in the database.
// The browser only displays and filters this; it does not build the ledger.
const VOUCHER_SOURCE_LABEL: Record<string, string> = {
  rv: 'Receipt Voucher', receipt: 'Receipt Voucher', 'receipt voucher': 'Receipt Voucher',
  pv: 'Payment Voucher', payment: 'Payment Voucher', 'payment voucher': 'Payment Voucher',
  jv: 'Journal Voucher', journal: 'Journal Voucher', 'journal voucher': 'Journal Voucher',
};
router.get('/general-ledger', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view the general ledger' });

    const from = isoDate(req.query.from);
    const to = isoDate(req.query.to);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT l.id AS id,
             DATE_FORMAT(v.voucher_date, '%Y-%m-%d') AS date,
             l.account_code AS account_code,
             COALESCE(c.account_name, l.account_name) AS account_name,
             c.account_type AS account_type,
             v.voucher_number AS reference,
             v.voucher_type AS voucher_type,
             COALESCE(l.description, v.description) AS description,
             l.debit_amount AS debit,
             l.credit_amount AS credit,
             p.title AS property_name,
             u.unit_ref AS unit_ref,
             COALESCE(cu.display_name, cu.full_name) AS tenant_name
        FROM fin_voucher_lines l
        JOIN fin_vouchers v ON v.id = l.voucher_id
        LEFT JOIN fin_accounting_events e ON e.id = v.accounting_event_id
        LEFT JOIN fin_coa_accounts c ON c.account_code = l.account_code
        LEFT JOIN properties p ON p.id = COALESCE(l.property_id, e.property_id)
        LEFT JOIN units u ON u.id = COALESCE(l.unit_id, e.unit_id)
        LEFT JOIN customers cu ON cu.id = COALESCE(l.customer_id, l.tenant_id, e.customer_id, e.tenant_id)
       WHERE LOWER(v.status) = 'posted'
         AND (${from} IS NULL OR v.voucher_date >= ${from})
         AND (${to} IS NULL OR v.voucher_date <= ${to})
       ORDER BY v.voucher_date DESC, v.created_at DESC, l.created_at ASC
       LIMIT 20001`;

    const truncated = rows.length > 20000;
    const sliced = truncated ? rows.slice(0, 20000) : rows;
    const data = sliced.map((r) => ({
      id: String(r.id),
      date: r.date,
      account_code: r.account_code,
      account_name: r.account_name || r.account_code,
      account_type: TB_TYPE[String(r.account_type || '').toLowerCase()] || 'Assets',
      reference: r.reference,
      source: VOUCHER_SOURCE_LABEL[String(r.voucher_type || '').toLowerCase()] || r.voucher_type || 'Journal Voucher',
      description: r.description || '',
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      property_name: r.property_name || '',
      unit_ref: r.unit_ref || '',
      tenant_name: r.tenant_name || '',
    }));
    const totalDebit = data.reduce((a, r) => a + r.debit, 0);
    const totalCredit = data.reduce((a, r) => a + r.credit, 0);
    res.json({ data, truncated, limit: 20000, totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 } });
  } catch (e: any) { res.status(500).json({ error: 'Failed to load the general ledger' }); console.error('[general-ledger]', e?.message); }
});

// Post a hand-entered voucher / journal. The server builds the event and lines and posts them atomically.
router.post('/post-voucher', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to post vouchers' });
    const b = req.body || {};
    const result = await postManualVoucher({
      voucher_date: b.voucher_date,
      voucher_type: b.voucher_type,
      reference_no: b.reference_no,
      description: b.description,
      lines: Array.isArray(b.lines) ? b.lines : [],
      property_id: b.property_id,
      unit_id: b.unit_id,
      customer_id: b.customer_id,
      created_by: (req as any).user?.id ?? null,
    });
    res.status(201).json({ data: result });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[post-voucher]', e?.message);
    res.status(500).json({ error: 'Failed to post the voucher' });
  }
});

// Final settlement: every voucher of one settlement posts in ONE transaction (all or nothing), against the
// lease's own tenant/property/unit as stored in the database. The client only supplies the resolved account
// lines; it can no longer post against placeholder or mismatched dimensions.
router.post('/post-settlement', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to post a settlement' });
    const b = req.body || {};
    const leaseId = String(b.lease_id || '').trim();
    const key = String(b.settlement_key || '').trim();
    const vouchers: any[] = Array.isArray(b.vouchers) ? b.vouchers : [];
    if (!leaseId || key.length < 3) return res.status(400).json({ error: 'lease_id and settlement_key are required' });
    if (!vouchers.length || vouchers.length > 40) return res.status(400).json({ error: 'A settlement needs between 1 and 40 vouchers' });
    const leaseRows = await prisma.$queryRaw<any[]>`SELECT id, customer_id, property_id, unit_id FROM leases WHERE id = ${leaseId} LIMIT 1`;
    if (!leaseRows.length) return res.status(404).json({ error: 'Lease not found. A settlement cannot be posted without a real lease.' });
    const lease = leaseRows[0];
    if (!lease.customer_id || !lease.property_id || !lease.unit_id) {
      return res.status(409).json({ error: 'The lease has no tenant, property or unit recorded, so the settlement cannot be dimensioned.' });
    }
    const userId = (req as any).user?.id ?? null;
    const results = await txn(async (tx) => {
      const out: any[] = [];
      for (let i = 0; i < vouchers.length; i += 1) {
        const v = vouchers[i] || {};
        const posted = await postManualVoucher({
          voucher_date: v.voucher_date,
          voucher_type: v.voucher_type,
          reference_no: v.reference_no || null,
          description: v.description || null,
          lines: Array.isArray(v.lines) ? v.lines : [],
          property_id: lease.property_id,
          unit_id: lease.unit_id,
          customer_id: lease.customer_id,
          tenant_id: lease.customer_id,
          lease_id: lease.id,
          source_type: 'FINAL_SETTLEMENT',
          source_id: lease.id,
          created_by: userId,
          idempotency_key: `SETTLE|${key}|${i + 1}`,
        }, tx);
        out.push(...posted);
      }
      return out;
    });
    res.status(201).json({ data: results });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[post-settlement]', e?.message);
    res.status(500).json({ error: 'Failed to post the settlement' });
  }
});

// Early vacate: reverses the unearned part of rent invoices already recognised, in ONE transaction, with the
// amounts computed here from the posted ledger (not by the browser). A repeat call posts nothing twice.
// The client supplies only the two resolved account codes for the reversal entry.
router.post('/early-vacate-reversals', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to post reversals' });
    const b = req.body || {};
    const leaseId = String(b.lease_id || '').trim();
    const vacate = ymd(b.vacate_date);
    const leaseEnd = ymd(b.lease_end_date);
    const debitCode = String(b.debit_code || '').trim();
    const creditCode = String(b.credit_code || '').trim();
    if (!leaseId || !vacate || !leaseEnd || !debitCode || !creditCode) {
      return res.status(400).json({ error: 'lease_id, vacate_date, lease_end_date, debit_code and credit_code are required' });
    }
    if (new Date(vacate).getTime() >= new Date(leaseEnd).getTime()) {
      return res.json({ data: { reversedInvoiceCount: 0, reversedRentAmount: 0 } });
    }
    const leaseRows = await prisma.$queryRaw<any[]>`SELECT id, customer_id, property_id, unit_id FROM leases WHERE id = ${leaseId} LIMIT 1`;
    if (!leaseRows.length) return res.status(404).json({ error: 'Lease not found' });
    const lease = leaseRows[0];
    if (!lease.customer_id || !lease.property_id || !lease.unit_id) {
      return res.status(409).json({ error: 'The lease has no tenant, property or unit recorded, so the reversal cannot be dimensioned.' });
    }
    const userId = (req as any).user?.id ?? null;
    const result = await txn(async (tx) => {
      const events = await tx.$queryRaw<any[]>`
        SELECT id, reference_number, posting_date, metadata FROM fin_accounting_events
         WHERE lease_id = ${lease.id} AND status = 'POSTED' ORDER BY posting_date ASC`;
      const vacateMs = new Date(vacate).getTime();
      let count = 0;
      let total = 0;
      for (const ev of events) {
        let meta: any = {};
        try { meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata || '{}') : (ev.metadata || {}); } catch { meta = {}; }
        const origin = String(meta.accounting_origin || '');
        if (origin && origin !== 'RENT_INVOICE') continue;
        const ref = String(ev.reference_number || ev.id);
        // Already reversed by an earlier run (any vacate date).
        const done = await tx.$queryRaw<any[]>`SELECT id FROM fin_accounting_events WHERE reference_number = ${`REV-${ref}`} AND status = 'POSTED' LIMIT 1`;
        if (done.length) continue;
        const lines = await tx.$queryRaw<any[]>`SELECT credit FROM fin_accounting_event_lines WHERE event_id = ${ev.id} AND account_code = '41100001'`;
        const rent = money2(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
        if (rent <= 0) continue;
        let amount = 0;
        const ps = typeof meta.service_period_start === 'string' ? meta.service_period_start : null;
        const pe = typeof meta.service_period_end === 'string' ? meta.service_period_end : null;
        if (ps && pe) {
          const start = new Date(ps).getTime();
          const end = new Date(pe).getTime();
          if (!(end > vacateMs)) continue;
          if (start > vacateMs) amount = rent;
          else {
            const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
            const futureDays = Math.max(0, Math.ceil((end - vacateMs) / 86400000));
            amount = rent * Math.min(1, futureDays / totalDays);
          }
        } else {
          if (new Date(ev.posting_date).getTime() <= vacateMs) continue;
          amount = rent;
        }
        amount = money2(amount);
        if (amount <= 0) continue;
        await postManualVoucher({
          voucher_date: new Date().toISOString().slice(0, 10),
          voucher_type: 'Journal',
          reference_no: `REV-${ref}`,
          description: `Rent Invoice Reversal - ${ref} (Early tenant vacate effective ${vacate}; contractual expiry was ${leaseEnd})`,
          lines: [
            { account_code: debitCode, debit: amount, credit: 0, description: 'Unearned rent reversal' },
            { account_code: creditCode, debit: 0, credit: amount, description: 'Unearned rent reversal' },
          ],
          property_id: lease.property_id,
          unit_id: lease.unit_id,
          customer_id: lease.customer_id,
          tenant_id: lease.customer_id,
          lease_id: lease.id,
          source_type: 'EARLY_VACATE_REVERSAL',
          source_id: lease.id,
          created_by: userId,
          idempotency_key: `EVACATE|${lease.id}|${ev.id}`,
        }, tx);
        count += 1;
        total = money2(total + amount);
      }
      return { reversedInvoiceCount: count, reversedRentAmount: total };
    });
    res.status(201).json({ data: result });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[early-vacate-reversals]', e?.message);
    res.status(500).json({ error: 'Failed to post the early-vacate reversals' });
  }
});

// Cancels (returns) a lease's unpresented cheques: the cancellation voucher (Dr 21400001 / Cr 12900001) and the
// status change of every cheque happen in ONE transaction, so a posted voucher can never be left with cheques
// still "In Hand", or the other way round. The cheques and amounts are taken from the register, not the browser.
router.post('/cancel-lease-pdcs', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to cancel cheques' });
    const b = req.body || {};
    const leaseRef = String(b.lease_id || '').trim();
    const effective = ymd(b.effective_date) || new Date().toISOString().slice(0, 10);
    const cancelAll = b.cancel_all !== false;
    const reason = String(b.reason || 'Lease termination / checkout').slice(0, 200);
    if (!leaseRef) return res.status(400).json({ error: 'lease_id is required' });
    const leaseRows = await prisma.$queryRaw<any[]>`SELECT id, lease_number, customer_id, property_id, unit_id FROM leases WHERE id = ${leaseRef} OR lease_number = ${leaseRef} LIMIT 1`;
    if (!leaseRows.length) return res.status(404).json({ error: 'Lease not found' });
    const lease = leaseRows[0];
    const userId = (req as any).user?.id ?? null;
    const result = await txn(async (tx) => {
      const cheques = await tx.$queryRaw<any[]>`
        SELECT id, cheque_number, amount, cheque_date FROM fin_pdc_register
         WHERE lease_id = ${lease.id} AND LOWER(status) IN ('in hand', 'received', 'in_hand')
           AND (${cancelAll ? 1 : 0} = 1 OR cheque_date >= ${effective})
         FOR UPDATE`;
      if (!cheques.length) return { count: 0, total: 0, voucher_number: null };
      const total = money2(cheques.reduce((s, c) => s + Number(c.amount || 0), 0));
      let voucherNumber: string | null = null;
      if (total > 0) {
        const ids = cheques.map((c) => String(c.id)).sort();
        const posted = await postManualVoucher({
          voucher_date: new Date().toISOString().slice(0, 10),
          voucher_type: 'Journal',
          description: `PDC Cancellation (${cheques.length} cheque${cheques.length === 1 ? '' : 's'}) - lease ${lease.lease_number || lease.id}: ${reason}`,
          lines: [
            { account_code: '21400001', debit: total, credit: 0, description: 'PDC cancelled' },
            { account_code: '12900001', debit: 0, credit: total, description: 'PDC cancelled' },
          ],
          property_id: lease.property_id,
          unit_id: lease.unit_id,
          customer_id: lease.customer_id,
          tenant_id: lease.customer_id,
          lease_id: lease.id,
          source_type: 'PDC_CANCEL',
          source_id: lease.id,
          created_by: userId,
          idempotency_key: `PDCCANCEL|${lease.id}|${ids.join(',')}`,
        }, tx);
        voucherNumber = posted?.[0]?.voucher_number ?? null;
      }
      for (const c of cheques) {
        await tx.$executeRaw`UPDATE fin_pdc_register SET status = 'Cancelled' WHERE id = ${c.id}`;
      }
      return { count: cheques.length, total, voucher_number: voucherNumber };
    });
    res.status(201).json({ data: result });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[cancel-lease-pdcs]', e?.message);
    res.status(500).json({ error: 'Failed to cancel the cheques' });
  }
});

// Journal ledger: posted journal vouchers, shaped for the Journal Ledger page.
router.get('/journals', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view journals' });
    const rows = await prisma.$queryRaw<any[]>`
      SELECT v.id AS vid, v.voucher_number AS je_no, DATE_FORMAT(v.voucher_date, '%Y-%m-%d') AS posting_date,
             v.reference_no AS reference, v.description AS narration, v.total_amount AS amount,
             l.id AS lid, l.account_code, COALESCE(c.account_name, l.account_name) AS account_name,
             l.debit_amount AS debit, l.credit_amount AS credit
        FROM fin_vouchers v
        JOIN fin_voucher_lines l ON l.voucher_id = v.id
        LEFT JOIN fin_coa_accounts c ON c.account_code = l.account_code
       WHERE LOWER(v.status) = 'posted' AND LOWER(v.voucher_type) IN ('journal', 'jv', 'journal voucher')
       ORDER BY v.voucher_date DESC, v.created_at DESC, l.created_at ASC
       LIMIT 5001`;
    const truncated = rows.length > 5000;
    const sliced = truncated ? rows.slice(0, 5000) : rows;
    const byVoucher = new Map<string, any>();
    for (const r of sliced) {
      let j = byVoucher.get(r.vid);
      if (!j) {
        j = { id: String(r.vid), je_no: r.je_no, posting_date: r.posting_date, reference: r.reference || r.je_no, narration: r.narration || '',
          dr_account: '', dr_code: '', cr_account: '', cr_code: '', amount: Number(r.amount) || 0, status: 'Posted', lines: [] as any[] };
        byVoucher.set(r.vid, j);
      }
      const debit = Number(r.debit) || 0; const credit = Number(r.credit) || 0;
      j.lines.push({ id: String(r.lid), type: debit > 0 ? 'DR' : 'CR', account: r.account_name || r.account_code, account_code: r.account_code, amount: debit > 0 ? debit : credit });
      if (debit > 0 && !j.dr_code) { j.dr_code = r.account_code; j.dr_account = r.account_name || r.account_code; }
      if (credit > 0 && !j.cr_code) { j.cr_code = r.account_code; j.cr_account = r.account_name || r.account_code; }
    }
    res.json({ data: Array.from(byVoucher.values()), truncated, limit: 5000 });
  } catch (e: any) { console.error('[journals]', e?.message); res.status(500).json({ error: 'Failed to load journals' }); }
});

// Trial Balance: debit / credit totals per account over posted voucher lines, computed in the database.
const TB_TYPE: Record<string, string> = { assets: 'Assets', liabilities: 'Liabilities', capital: 'Capital', revenue: 'Revenue', expenditure: 'Expenses', expenses: 'Expenses' };
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

router.get('/trial-balance', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view the trial balance' });
    const from = isoDate(req.query.from);
    const to = isoDate(req.query.to);
    const rows = await prisma.$queryRaw<any[]>`
      SELECT l.account_code AS code,
             MAX(COALESCE(c.account_name, l.account_name)) AS name,
             MAX(c.account_type) AS type,
             SUM(l.debit_amount) AS debit,
             SUM(l.credit_amount) AS credit
        FROM fin_voucher_lines l
        JOIN fin_vouchers v ON v.id = l.voucher_id
        LEFT JOIN fin_coa_accounts c ON c.account_code = l.account_code
       WHERE LOWER(v.status) = 'posted'
         AND (${from} IS NULL OR v.voucher_date >= ${from})
         AND (${to} IS NULL OR v.voucher_date <= ${to})
       GROUP BY l.account_code
       ORDER BY l.account_code`;
    const data = rows.map((r) => {
      const debit = Number(r.debit) || 0;
      const credit = Number(r.credit) || 0;
      return { code: r.code, name: r.name || r.code, type: TB_TYPE[String(r.type || '').toLowerCase()] || 'Assets', debit, credit, balance: debit - credit };
    });
    const totalDebit = data.reduce((a, r) => a + r.debit, 0);
    const totalCredit = data.reduce((a, r) => a + r.credit, 0);
    res.json({ data, totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 } });
  } catch (e: any) { console.error('[trial-balance]', e?.message); res.status(500).json({ error: 'Failed to load the trial balance' }); }
});

// Per-account totals of posted voucher lines (optionally for one calendar month, e.g. "2026-11").
async function accountTotals(month: string | null) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT l.account_code AS code, MAX(c.account_type) AS type,
           SUM(l.debit_amount) AS debit, SUM(l.credit_amount) AS credit
      FROM fin_voucher_lines l
      JOIN fin_vouchers v ON v.id = l.voucher_id
      LEFT JOIN fin_coa_accounts c ON c.account_code = l.account_code
     WHERE LOWER(v.status) = 'posted'
       AND (${month} IS NULL OR DATE_FORMAT(v.voucher_date, '%Y-%m') = ${month})
     GROUP BY l.account_code`;
  return rows.map((r) => ({
    code: String(r.code || ''),
    type: TB_TYPE[String(r.type || '').toLowerCase()] || 'Assets',
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
  }));
}
const isMonth = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : null);

function buildProfitLoss(accounts: Array<{ code: string; type: string; debit: number; credit: number }>) {
  let rentalRevenue = 0, otherRevenue = 0, maintenanceExpense = 0, payrollExpense = 0, utilitiesExpense = 0, cleaningExpense = 0;
  let totalRevenue = 0, totalExpenses = 0;
  for (const a of accounts) {
    if (a.type === 'Revenue') {
      const net = a.credit - a.debit;
      totalRevenue += net;
      if (a.code.startsWith('411')) rentalRevenue += net; else otherRevenue += net;
    } else if (a.type === 'Expenses') {
      const net = a.debit - a.credit;
      totalExpenses += net;
      if (a.code.startsWith('51101') || a.code.startsWith('501') || a.code.startsWith('523')) payrollExpense += net;
      else if (a.code.startsWith('51003')) utilitiesExpense += net;
      else if (a.code === '51004007' || a.code === '51001002' || a.code === '51002002') cleaningExpense += net;
      else maintenanceExpense += net;
    }
  }
  return { rentalRevenue, otherRevenue, totalRevenue, maintenanceExpense, payrollExpense, utilitiesExpense, cleaningExpense, totalExpenses, netProfit: totalRevenue - totalExpenses };
}

// Profit & Loss from posted voucher lines. ?month=YYYY-MM limits it to one month.
router.get('/profit-loss', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view the profit and loss' });
    const months = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT DATE_FORMAT(v.voucher_date, '%Y-%m') AS m FROM fin_vouchers v WHERE LOWER(v.status) = 'posted' ORDER BY m DESC`;
    const data = buildProfitLoss(await accountTotals(isMonth(req.query.month)));
    res.json({ data, months: months.map((r) => r.m).filter(Boolean) });
  } catch (e: any) { console.error('[profit-loss]', e?.message); res.status(500).json({ error: 'Failed to load the profit and loss' }); }
});

// Balance Sheet from posted voucher lines (all periods), with current-period profit carried into equity.
router.get('/balance-sheet', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view the balance sheet' });
    const accounts = await accountTotals(null);
    let bankCashAssets = 0, pdcInHandAssets = 0, arReceivablesAssets = 0, legalReceivablesAssets = 0, fixedAssets = 0, totalAssets = 0;
    let apLiabilities = 0, securityDepositLiabilities = 0, pdcCustomerLiabilities = 0, totalLiabilities = 0, ownerCapital = 0;
    for (const a of accounts) {
      if (a.type === 'Assets') {
        const net = a.debit - a.credit;
        totalAssets += net;
        if (a.code.startsWith('121') || a.code.startsWith('12000') || a.code === '10000') bankCashAssets += net;
        else if (a.code.startsWith('129')) pdcInHandAssets += net;
        else if (a.code.startsWith('12411')) legalReceivablesAssets += net;
        else if (a.code.startsWith('124') || a.code.startsWith('123')) arReceivablesAssets += net;
        else if (a.code.startsWith('13')) fixedAssets += net;
        else bankCashAssets += net;
      } else if (a.type === 'Liabilities') {
        const net = a.credit - a.debit;
        totalLiabilities += net;
        if (a.code.startsWith('221')) apLiabilities += net;
        else if (a.code.startsWith('214')) pdcCustomerLiabilities += net;
        else if (a.code.startsWith('215') || a.code.startsWith('211') || a.code.startsWith('213')) securityDepositLiabilities += net;
        else apLiabilities += net;
      } else if (a.type === 'Capital') {
        ownerCapital += a.credit - a.debit;
      }
    }
    const netProfit = buildProfitLoss(accounts).netProfit;
    const totalEquity = ownerCapital + netProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    res.json({
      data: {
        bankCashAssets, pdcInHandAssets, arReceivablesAssets, legalReceivablesAssets, fixedAssets, totalAssets,
        apLiabilities, securityDepositLiabilities, pdcCustomerLiabilities, totalLiabilities,
        ownerCapital, retainedNetProfit: netProfit, totalEquity, totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      },
    });
  } catch (e: any) { console.error('[balance-sheet]', e?.message); res.status(500).json({ error: 'Failed to load the balance sheet' }); }
});

// Cash Book: every posted movement on the Cash In Hand accounts (12100*), with a running balance.
router.get('/cash-book', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view the cash book' });
    const rows = await prisma.$queryRaw<any[]>`
      SELECT l.id AS id,
             DATE_FORMAT(v.voucher_date, '%Y-%m-%d') AS date,
             v.voucher_number AS voucher,
             COALESCE(l.description, v.description) AS description,
             l.debit_amount AS cash_in,
             l.credit_amount AS cash_out
        FROM fin_voucher_lines l
        JOIN fin_vouchers v ON v.id = l.voucher_id
       WHERE LOWER(v.status) = 'posted' AND l.account_code LIKE '12100%'
       ORDER BY v.voucher_date ASC, v.created_at ASC, l.created_at ASC`;
    let balance = 0;
    const chrono = rows.map((r) => {
      const cashIn = Number(r.cash_in) || 0;
      const cashOut = Number(r.cash_out) || 0;
      balance += cashIn - cashOut;
      return { id: String(r.id), date: r.date, voucher: r.voucher, description: r.description || '', cash_in: cashIn, cash_out: cashOut, balance };
    });
    const totalIn = chrono.reduce((a, r) => a + r.cash_in, 0);
    const totalOut = chrono.reduce((a, r) => a + r.cash_out, 0);
    res.json({ data: chrono.reverse(), totals: { cash_in: totalIn, cash_out: totalOut, balance: totalIn - totalOut } });
  } catch (e: any) { console.error('[cash-book]', e?.message); res.status(500).json({ error: 'Failed to load the cash book' }); }
});

// Petty cash: movements on the Petty Cash account (12100002). Credits are expenses paid, debits are float top-ups.
const PETTY_CASH_CODE = '12100002';
const CASH_IN_HAND_CODE = '12100001';
router.get('/petty-cash', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view petty cash' });
    const rows = await prisma.$queryRaw<any[]>`
      SELECT l.id AS id, DATE_FORMAT(v.voucher_date, '%Y-%m-%d') AS date, v.voucher_number AS voucher,
             COALESCE(l.description, v.description) AS description, l.debit_amount AS debit, l.credit_amount AS credit
        FROM fin_voucher_lines l
        JOIN fin_vouchers v ON v.id = l.voucher_id
       WHERE LOWER(v.status) = 'posted' AND l.account_code = ${PETTY_CASH_CODE}
       ORDER BY v.voucher_date ASC, v.created_at ASC, l.created_at ASC`;
    let balance = 0;
    const entries = rows.map((r) => {
      const debit = Number(r.debit) || 0; const credit = Number(r.credit) || 0;
      balance += debit - credit;
      const text = String(r.description || '');
      const m = text.match(/^(.*?)\s*\|\s*Paid to:\s*(.*)$/i);
      return { id: String(r.id), date: r.date, voucher: r.voucher, expense: m ? m[1] : text, paid_to: m ? m[2] : '', amount: credit > 0 ? credit : debit, kind: credit > 0 ? 'expense' : 'topup', balance };
    });
    const spent = entries.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0);
    const funded = entries.filter((e) => e.kind === 'topup').reduce((a, e) => a + e.amount, 0);
    res.json({ data: entries.reverse(), totals: { spent, funded, balance: funded - spent } });
  } catch (e: any) { console.error('[petty-cash]', e?.message); res.status(500).json({ error: 'Failed to load petty cash' }); }
});

// Cash on hand: balances of the Cash In Hand and Petty Cash accounts.
router.get('/cash-on-hand', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view cash on hand' });
    const rows = await prisma.$queryRaw<any[]>`
      SELECT l.account_code AS code, SUM(l.debit_amount) AS debit, SUM(l.credit_amount) AS credit
        FROM fin_voucher_lines l JOIN fin_vouchers v ON v.id = l.voucher_id
       WHERE LOWER(v.status) = 'posted' AND l.account_code IN ('12100001', '12100002', '10100')
       GROUP BY l.account_code`;
    let vaultCash = 0; let pettyCashFloat = 0;
    for (const r of rows) {
      const net = (Number(r.debit) || 0) - (Number(r.credit) || 0);
      if (r.code === PETTY_CASH_CODE) pettyCashFloat += net; else vaultCash += net;
    }
    res.json({ data: { vaultCash, pettyCashFloat, siteDesks: 0, totalCashOnHand: vaultCash + pettyCashFloat } });
  } catch (e: any) { console.error('[cash-on-hand]', e?.message); res.status(500).json({ error: 'Failed to load cash on hand' }); }
});

// Cash flow statement from posted voucher lines: cash and bank movements classified by the other side of each voucher.
router.get('/cash-flow', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view the cash flow' });
    const CASH = new Set(['10100', '12000', '12000001', '12000002', '12000003', '12000004', '12000005', '12000006', '12001', '12100', '12100001', '12100002']);
    const rows = await prisma.$queryRaw<any[]>`
      SELECT v.id AS vid, l.account_code AS code, COALESCE(l.description, v.description) AS description,
             l.debit_amount AS debit, l.credit_amount AS credit
        FROM fin_voucher_lines l JOIN fin_vouchers v ON v.id = l.voucher_id
       WHERE LOWER(v.status) = 'posted'
       LIMIT 100001`;
    const truncated = rows.length > 100000;
    const sliced = truncated ? rows.slice(0, 100000) : rows;
    const byVoucher = new Map<string, any[]>();
    for (const r of sliced) { const b = byVoucher.get(r.vid) || []; b.push(r); byVoucher.set(r.vid, b); }
    let operatingInflow = 0, operatingOutflow = 0, investingCash = 0, financingCash = 0;
    byVoucher.forEach((lines) => {
      const cashLines = lines.filter((l) => CASH.has(l.code));
      const nonCash = lines.filter((l) => !CASH.has(l.code));
      if (!cashLines.length || !nonCash.length) return;
      const cashNet = cashLines.reduce((a, l) => a + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
      if (Math.abs(cashNet) < 0.005) return;
      const narration = lines.map((l) => l.description || '').join(' ').toLowerCase();
      if (narration.includes('pdc deposited')) return;
      if (nonCash.some((l) => String(l.code).startsWith('13'))) investingCash += cashNet;
      else if (nonCash.some((l) => String(l.code).startsWith('3'))) financingCash += cashNet;
      else if (cashNet > 0) operatingInflow += cashNet;
      else operatingOutflow += Math.abs(cashNet);
    });
    const endingCashBalance = sliced.filter((l) => CASH.has(l.code)).reduce((a, l) => a + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
    const netOperatingCash = operatingInflow - operatingOutflow;
    res.json({ data: { operatingInflow, operatingOutflow, netOperatingCash, investingCash, financingCash, netCashChange: netOperatingCash + investingCash + financingCash, endingCashBalance }, truncated, limit: 100000 });
  } catch (e: any) { console.error('[cash-flow]', e?.message); res.status(500).json({ error: 'Failed to load the cash flow' }); }
});

// ── Receivable (AR) and payable (AP) invoices ──────────────────────────────────────────────────────
// Invoices are stored in fin_ar_invoices / fin_ap_invoices; every create and settlement is posted to the ledger
// through postManualVoucher, so the ledger, trial balance and statements always agree with the invoice registers.
const AR_CONTROL_CODE = '12413001';   // Tenant Receivables
const AP_CONTROL_CODE = '21000';      // Sundry Creditors (trade payables control)
const DEFAULT_BANK_CODE = '12000001';
const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const dateOnly = (d: any) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : '');

function arRow(r: any) {
  return {
    id: String(r.id), invoice_no: r.invoice_no, tenant: r.tenant || '', property: r.property || '', unit: r.unit || '',
    date: dateOnly(r.invoice_date), due_date: dateOnly(r.due_date), stream: r.stream || '', account_code: r.account_code,
    amount: Number(r.amount) || 0, status: r.status, customerId: r.customer_id || undefined, billingPeriod: r.billing_period || undefined,
    leaseId: r.lease_id || undefined, notes: r.notes || undefined, paidAmount: Number(r.paid_amount) || 0,
  };
}
function apRow(r: any) {
  let lines: any[] | undefined;
  try { lines = r.lines_json ? JSON.parse(r.lines_json) : undefined; } catch { lines = undefined; }
  return {
    id: String(r.id), invoice_no: r.invoice_no, vendor: r.vendor || '', date: dateOnly(r.invoice_date), voucher_date: dateOnly(r.voucher_date) || undefined,
    due_date: dateOnly(r.due_date), account: r.account || '', account_code: r.account_code, stream: r.stream || undefined,
    amount: Number(r.amount) || 0, status: r.status, property: r.property || undefined, lines,
  };
}

router.get('/ar-invoices', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view receivable invoices' });
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_ar_invoices ORDER BY invoice_date DESC, created_at DESC LIMIT 5001`;
    const truncated = rows.length > 5000;
    const sliced = truncated ? rows.slice(0, 5000) : rows;
    res.json({ data: sliced.map(arRow), truncated, limit: 5000 });
  } catch (e: any) { console.error('[ar-invoices]', e?.message); res.status(500).json({ error: 'Failed to load receivable invoices' }); }
});

// Create one or more AR invoices. A unit already invoiced for the billing period is skipped (reported back).
router.post('/ar-invoices', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to create invoices' });
    const list: any[] = Array.isArray(req.body?.invoices) ? req.body.invoices : [];
    if (!list.length) return res.status(400).json({ error: 'No invoices supplied' });
    const created: any[] = []; const skipped: any[] = [];
    for (const inv of list) {
      const date = ymd(inv.date); const amount = money2(inv.amount);
      const invoiceNo = String(inv.invoice_no || '').trim();
      if (!invoiceNo || !date || amount <= 0 || !inv.account_code) return res.status(400).json({ error: 'Each invoice needs invoice_no, date, account_code and an amount above zero' });
      const period = String(inv.billingPeriod || inv.billing_period || date).slice(0, 7);
      const unit = String(inv.unit || '').trim();
      const outcome = await txn(async (tx) => {
        if (unit) {
          const dup = await tx.$queryRaw<any[]>`SELECT invoice_no FROM fin_ar_invoices WHERE LOWER(unit) = ${unit.toLowerCase()} AND billing_period = ${period} LIMIT 1 FOR UPDATE`;
          if (dup.length) return { skipReason: `Unit ${unit} is already invoiced (${dup[0].invoice_no}) for ${period}` };
        }
        const exists = await tx.$queryRaw<any[]>`SELECT id FROM fin_ar_invoices WHERE invoice_no = ${invoiceNo} LIMIT 1 FOR UPDATE`;
        if (exists.length) return { skipReason: 'Invoice number already exists' };
        const posted = await postManualVoucher({
          voucher_date: date, voucher_type: 'Journal', reference_no: invoiceNo,
          idempotency_key: `AR_CREATE|${invoiceNo}`,
          description: `Rent invoice ${invoiceNo} — ${inv.tenant || ''} ${unit ? '(' + unit + ')' : ''}`.trim(),
          lines: [
            { account_code: AR_CONTROL_CODE, debit: amount, credit: 0 },
            { account_code: String(inv.account_code), debit: 0, credit: amount },
          ],
          customer_id: inv.customerId || inv.customer_id || null, created_by: (req as any).user?.id ?? null,
        }, tx);
        const voucherNumber = posted?.[0]?.voucher_number ?? invoiceNo;
        await tx.$executeRaw`INSERT INTO fin_ar_invoices
          (id, invoice_no, tenant, property, unit, customer_id, lease_id, invoice_date, due_date, stream, account_code, amount, status, billing_period, notes, voucher_number)
          VALUES (${randomUUID()}, ${invoiceNo}, ${inv.tenant || null}, ${inv.property || null}, ${unit || null}, ${inv.customerId || inv.customer_id || null},
                  ${inv.leaseId || inv.lease_id || null}, ${date}, ${ymd(inv.due_date)}, ${inv.stream || null}, ${String(inv.account_code)}, ${amount}, 'Pending', ${period}, ${inv.notes || null}, ${voucherNumber})`;
        return { createdNo: invoiceNo };
      });
      if ('skipReason' in outcome) skipped.push({ invoice_no: invoiceNo, reason: outcome.skipReason });
      else created.push(outcome.createdNo);
    }
    res.status(201).json({ created, skipped });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[ar-invoices:create]', e?.message); res.status(500).json({ error: 'Failed to create the invoice' });
  }
});

// Collect an AR invoice (supports partial collection): post the receipt (Dr bank, Cr tenant receivable) and update paid_amount/status atomically.
router.post('/ar-invoices/:invoiceNo/collect', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to collect invoices' });
    const invoiceNo = String(req.params.invoiceNo);
    const date = ymd(req.body?.date) || new Date().toISOString().slice(0, 10);
    const bank = String(req.body?.bank_gl || DEFAULT_BANK_CODE);

    const result = await txn(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`SELECT * FROM fin_ar_invoices WHERE invoice_no = ${invoiceNo} LIMIT 1 FOR UPDATE`;
      if (!rows.length) { const err: any = new Error('Invoice not found'); err.status = 404; throw err; }
      const inv = rows[0];
      if (inv.status === 'Paid') { const err: any = new Error('Invoice is already paid'); err.status = 409; throw err; }
      const totalAmount = money2(inv.amount);
      const currentPaid = money2(inv.paid_amount || 0);
      const remaining = money2(totalAmount - currentPaid);
      const amount = req.body?.amount !== undefined ? money2(req.body.amount) : remaining;
      if (amount <= 0) { const err: any = new Error('Collection amount must be above zero'); err.status = 400; throw err; }
      if (amount > remaining + 0.005) { const err: any = new Error(`Collection amount (${amount}) exceeds remaining balance (${remaining})`); err.status = 400; throw err; }
      const newPaid = money2(currentPaid + amount);
      const newStatus = newPaid >= totalAmount - 0.005 ? 'Paid' : 'Partial';
      const posted = await postManualVoucher({
        voucher_date: date, voucher_type: 'Receipt', reference_no: `RCV-${invoiceNo}`,
        idempotency_key: `AR_COLLECT|${invoiceNo}|${newPaid}`,
        description: `${inv.tenant || ''} — Receipt for Rent Invoice ${invoiceNo} ${inv.unit ? '(' + inv.unit + ')' : ''}`.trim(),
        lines: [{ account_code: bank, debit: amount, credit: 0 }, { account_code: AR_CONTROL_CODE, debit: 0, credit: amount }],
        customer_id: inv.customer_id, created_by: (req as any).user?.id ?? null,
      }, tx);
      await tx.$executeRaw`UPDATE fin_ar_invoices SET status = ${newStatus}, paid_amount = ${newPaid}, receipt_voucher_number = ${posted?.[0]?.voucher_number ?? null} WHERE invoice_no = ${invoiceNo}`;
      return { invoice_no: invoiceNo, status: newStatus, paid_amount: newPaid };
    });
    res.json({ data: result });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[ar-invoices:collect]', e?.message); res.status(500).json({ error: 'Failed to collect the invoice' });
  }
});

router.get('/ap-invoices', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'read')) return res.status(403).json({ error: 'Not authorized to view payable invoices' });
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_ap_invoices ORDER BY invoice_date DESC, created_at DESC LIMIT 5001`;
    const truncated = rows.length > 5000;
    const sliced = truncated ? rows.slice(0, 5000) : rows;
    res.json({ data: sliced.map(apRow), truncated, limit: 5000 });
  } catch (e: any) { console.error('[ap-invoices]', e?.message); res.status(500).json({ error: 'Failed to load payable invoices' }); }
});

// Create an AP invoice: Dr expense (one line, or each invoice line), Cr trade payables.
router.post('/ap-invoices', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to create invoices' });
    const b = req.body || {};
    const invoiceNo = String(b.invoice_no || '').trim();
    const date = ymd(b.voucher_date) || ymd(b.date);
    const amount = money2(b.amount);
    if (!invoiceNo || !date || amount <= 0) return res.status(400).json({ error: 'invoice_no, a date and an amount above zero are required' });
    const lines: any[] = Array.isArray(b.lines) && b.lines.length ? b.lines : [{ account_code: b.account_code, amount }];
    const debitLines = lines.filter((l) => l.account_code && Number(l.amount) > 0).map((l) => ({ account_code: String(l.account_code), debit: money2(l.amount), credit: 0, description: l.description || null }));
    const total = money2(debitLines.reduce((a, l) => a + l.debit, 0));
    if (!debitLines.length) return res.status(400).json({ error: 'The invoice needs at least one expense line with an account and amount' });

    await txn(async (tx) => {
      const exists = await tx.$queryRaw<any[]>`SELECT id FROM fin_ap_invoices WHERE invoice_no = ${invoiceNo} LIMIT 1 FOR UPDATE`;
      if (exists.length) { const err: any = new Error(`Invoice ${invoiceNo} already exists`); err.status = 409; throw err; }
      const posted = await postManualVoucher({
        voucher_date: date, voucher_type: 'Journal', reference_no: invoiceNo,
        idempotency_key: `AP_CREATE|${invoiceNo}`,
        description: `Invoice ${invoiceNo} from ${b.vendor || ''}`.trim(),
        lines: [...debitLines, { account_code: AP_CONTROL_CODE, debit: 0, credit: total }],
        created_by: (req as any).user?.id ?? null,
      }, tx);
      await tx.$executeRaw`INSERT INTO fin_ap_invoices
        (id, invoice_no, vendor, property, invoice_date, voucher_date, due_date, account, account_code, stream, amount, status, lines_json, voucher_number)
        VALUES (${randomUUID()}, ${invoiceNo}, ${b.vendor || null}, ${b.property || null}, ${ymd(b.date) || date}, ${ymd(b.voucher_date)}, ${ymd(b.due_date)},
                ${b.account || null}, ${String(b.account_code || debitLines[0].account_code)}, ${b.stream || null}, ${total}, 'Unpaid',
                ${Array.isArray(b.lines) && b.lines.length ? JSON.stringify(b.lines) : null}, ${posted?.[0]?.voucher_number ?? invoiceNo})`;
    });
    res.status(201).json({ data: { invoice_no: invoiceNo } });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[ap-invoices:create]', e?.message); res.status(500).json({ error: 'Failed to create the invoice' });
  }
});

// Pay an AP invoice (supports partial payment): Dr trade payables, Cr bank.
router.post('/ap-invoices/:invoiceNo/pay', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role as string | undefined;
    if (!dbAllowed(role, 'fin_vouchers', 'write')) return res.status(403).json({ error: 'Not authorized to pay invoices' });
    const invoiceNo = String(req.params.invoiceNo);
    const date = ymd(req.body?.date) || new Date().toISOString().slice(0, 10);
    const bank = String(req.body?.bank_gl || DEFAULT_BANK_CODE);

    const result = await txn(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`SELECT * FROM fin_ap_invoices WHERE invoice_no = ${invoiceNo} LIMIT 1 FOR UPDATE`;
      if (!rows.length) { const err: any = new Error('Invoice not found'); err.status = 404; throw err; }
      const inv = rows[0];
      if (inv.status === 'Paid') { const err: any = new Error('Invoice is already paid'); err.status = 409; throw err; }
      const totalAmount = money2(inv.amount);
      const currentPaid = money2(inv.paid_amount || 0);
      const remaining = money2(totalAmount - currentPaid);
      const amount = req.body?.amount !== undefined ? money2(req.body.amount) : remaining;
      if (amount <= 0) { const err: any = new Error('Payment amount must be above zero'); err.status = 400; throw err; }
      if (amount > remaining + 0.005) { const err: any = new Error(`Payment amount (${amount}) exceeds remaining balance (${remaining})`); err.status = 400; throw err; }
      const newPaid = money2(currentPaid + amount);
      const newStatus = newPaid >= totalAmount - 0.005 ? 'Paid' : 'Partial';
      const posted = await postManualVoucher({
        voucher_date: date, voucher_type: 'Payment', reference_no: `PAY-${invoiceNo}`,
        idempotency_key: `AP_PAY|${invoiceNo}|${newPaid}`,
        description: `${inv.vendor || ''} — Settlement for Invoice ${invoiceNo}`.trim(),
        lines: [{ account_code: AP_CONTROL_CODE, debit: amount, credit: 0 }, { account_code: bank, debit: 0, credit: amount }],
        created_by: (req as any).user?.id ?? null,
      }, tx);
      await tx.$executeRaw`UPDATE fin_ap_invoices SET status = ${newStatus}, paid_amount = ${newPaid}, payment_voucher_number = ${posted?.[0]?.voucher_number ?? null} WHERE invoice_no = ${invoiceNo}`;
      return { invoice_no: invoiceNo, status: newStatus, paid_amount: newPaid };
    });
    res.json({ data: result });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    console.error('[ap-invoices:pay]', e?.message); res.status(500).json({ error: 'Failed to pay the invoice' });
  }
});

// ── Legal cases, payroll runs, bank clearances, reconciliations and statements ───────────────────────
const LEGAL_RECEIVABLE_CODE = '12411001';
const PAYROLL_DEFAULT_EXPENSE_CODE = '51101001';
const readGuard = (req: Request, res: Response, what: string) => {
  const role = (req as any).user?.role as string | undefined;
  if (!dbAllowed(role, 'fin_vouchers', 'read')) { res.status(403).json({ error: `Not authorized to view ${what}` }); return false; }
  return true;
};
const writeGuard = (req: Request, res: Response, what: string) => {
  const role = (req as any).user?.role as string | undefined;
  if (!dbAllowed(role, 'fin_vouchers', 'write')) { res.status(403).json({ error: `Not authorized to ${what}` }); return false; }
  return true;
};
const fail = (res: Response, tag: string, e: any, msg: string) => {
  if (e?.status) return res.status(e.status).json({ error: e.message });
  console.error(`[${tag}]`, e?.message); return res.status(500).json({ error: msg });
};

router.get('/legal-cases', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'legal cases')) return;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_legal_cases ORDER BY escalation_date DESC, created_at DESC`;
    res.json({ data: rows.map((r) => ({ id: String(r.id), legal_case_id: r.legal_case_id, tenant_name: r.tenant_name || '', property_name: r.property_name || '', unit_ref: r.unit_ref || '',
      original_amount: Number(r.original_amount) || 0, outstanding_balance: Number(r.outstanding_balance) || 0, escalation_date: dateOnly(r.escalation_date), reason: r.reason || '', status: r.status })) });
  } catch (e: any) { fail(res, 'legal-cases', e, 'Failed to load legal cases'); }
});

// Escalate to legal: reclassify the amount from tenant receivables to legal receivables.
router.post('/legal-cases', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'escalate cases')) return;
    const b = req.body || {};
    const caseId = String(b.legal_case_id || '').trim(); const amount = money2(b.original_amount); const date = ymd(b.escalation_date);
    if (!caseId || amount <= 0 || !date) return res.status(400).json({ error: 'legal_case_id, escalation_date and an amount above zero are required' });
    await txn(async (tx) => {
      const dup = await tx.$queryRaw<any[]>`SELECT id FROM fin_legal_cases WHERE legal_case_id = ${caseId} LIMIT 1 FOR UPDATE`;
      if (dup.length) { const err: any = new Error(`Legal case ${caseId} already exists`); err.status = 409; throw err; }
      const posted = await postManualVoucher({
        voucher_date: date, voucher_type: 'Journal', reference_no: `LGL-${caseId}`,
        idempotency_key: `LEGAL_ESCALATE|${caseId}`,
        description: `Legal escalation — ${b.tenant_name || ''} (${b.unit_ref || ''}) [${caseId}]`,
        lines: [{ account_code: LEGAL_RECEIVABLE_CODE, debit: amount, credit: 0 }, { account_code: AR_CONTROL_CODE, debit: 0, credit: amount }],
        created_by: (req as any).user?.id ?? null,
      }, tx);
      await tx.$executeRaw`INSERT INTO fin_legal_cases (id, legal_case_id, tenant_name, property_name, unit_ref, original_amount, outstanding_balance, escalation_date, reason, status, voucher_number)
        VALUES (${randomUUID()}, ${caseId}, ${b.tenant_name || null}, ${b.property_name || null}, ${b.unit_ref || null}, ${amount}, ${money2(b.outstanding_balance ?? amount)}, ${date}, ${b.reason || null}, ${b.status || 'Legal Notice Sent'}, ${posted?.[0]?.voucher_number ?? null})`;
    });
    res.status(201).json({ data: { legal_case_id: caseId } });
  } catch (e: any) { fail(res, 'legal-cases:create', e, 'Failed to escalate the case'); }
});

// Record a recovery: receipt into cash / bank / PDC in hand against legal receivables, then reduce the case balance.
router.post('/legal-cases/:caseId/recover', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'record recoveries')) return;
    const caseId = String(req.params.caseId);
    const b = req.body || {};
    const amount = money2(b.amount);
    if (amount <= 0) return res.status(400).json({ error: 'amount must be above zero' });
    const method = String(b.payment_method || 'Bank Transfer').toLowerCase();
    const debitCode = method.includes('cash') ? CASH_IN_HAND_CODE : method.includes('pdc') ? '12900001' : String(b.bank_gl || DEFAULT_BANK_CODE);
    const date = ymd(b.date) || new Date().toISOString().slice(0, 10);

    const result = await txn(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`SELECT * FROM fin_legal_cases WHERE legal_case_id = ${caseId} OR id = ${caseId} LIMIT 1 FOR UPDATE`;
      if (!rows.length) { const err: any = new Error('Legal case not found'); err.status = 404; throw err; }
      const c = rows[0];
      if (amount > Number(c.outstanding_balance) + 0.001) {
        const err: any = new Error(`Recovery exceeds the outstanding balance of ${Number(c.outstanding_balance)}`);
        err.status = 400; throw err;
      }
      const newBal = Math.max(0, money2(Number(c.outstanding_balance) - amount));
      await postManualVoucher({
        voucher_date: date, voucher_type: 'Receipt', reference_no: b.reference ? `REC-${b.reference}` : undefined,
        idempotency_key: `LEGAL_RECOVER|${c.legal_case_id}|${newBal}`,
        description: `Legal Settlement Recovery — ${c.tenant_name || ''} (${c.unit_ref || ''}) [${c.legal_case_id}]${b.narration ? ' ' + b.narration : ''}`,
        lines: [{ account_code: debitCode, debit: amount, credit: 0 }, { account_code: LEGAL_RECEIVABLE_CODE, debit: 0, credit: amount }],
        created_by: (req as any).user?.id ?? null,
      }, tx);
      await tx.$executeRaw`UPDATE fin_legal_cases SET outstanding_balance = ${newBal}, status = ${newBal <= 0 ? 'Fully Recovered' : 'Partially Recovered'} WHERE id = ${c.id}`;
      return { legal_case_id: c.legal_case_id, outstanding_balance: newBal };
    });
    res.json({ data: result });
  } catch (e: any) { fail(res, 'legal-cases:recover', e, 'Failed to record the recovery'); }
});

router.get('/payroll-runs', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'payroll runs')) return;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_payroll_runs ORDER BY created_at DESC`;
    res.json({ data: rows.map((r) => ({ id: String(r.id), payroll_run_id: r.payroll_run_id, period: r.period || '', department: r.department || '', account_code: r.account_code || '',
      basic_salary: Number(r.basic_salary) || 0, allowances: Number(r.allowances) || 0, overtime: Number(r.overtime) || 0, deductions: Number(r.deductions) || 0,
      total_amount: Number(r.total_amount) || 0, bank_account: r.bank_account || '', status: r.status, error_details: r.error_details || undefined })) });
  } catch (e: any) { fail(res, 'payroll-runs', e, 'Failed to load payroll runs'); }
});

// Post a payroll run: Dr staff cost, Cr bank.
router.post('/payroll-runs', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'post payroll')) return;
    const b = req.body || {};
    const runId = String(b.payroll_run_id || '').trim();
    const basic = money2(b.basic_salary);
    const allowances = money2(b.allowances);
    const overtime = money2(b.overtime);
    const deductions = money2(b.deductions);
    const hasComponents = basic > 0 || allowances > 0 || overtime > 0 || deductions > 0;
    const total = hasComponents ? money2(basic + allowances + overtime - deductions) : money2(b.total_amount);
    if (!runId || total <= 0) return res.status(400).json({ error: 'payroll_run_id and a positive net total are required' });
    const date = ymd(b.date) || new Date().toISOString().slice(0, 10);

    await txn(async (tx) => {
      const dup = await tx.$queryRaw<any[]>`SELECT id FROM fin_payroll_runs WHERE payroll_run_id = ${runId} LIMIT 1 FOR UPDATE`;
      if (dup.length) { const err: any = new Error(`Payroll run ${runId} is already posted`); err.status = 409; throw err; }
      const known = await tx.$queryRaw<any[]>`SELECT account_code FROM fin_coa_accounts WHERE account_code = ${String(b.account_code || '')} AND is_active = TRUE LIMIT 1`;
      const expense = known.length ? String(b.account_code) : PAYROLL_DEFAULT_EXPENSE_CODE;
      const posted = await postManualVoucher({
        voucher_date: date, voucher_type: 'Payment', reference_no: `PAY-${runId}`,
        idempotency_key: `PAYROLL_RUN|${runId}`,
        description: `Payroll Disbursement for Period ${b.period || ''} - ${b.department || ''}`.trim(),
        lines: [{ account_code: expense, debit: total, credit: 0 }, { account_code: String(b.bank_gl || DEFAULT_BANK_CODE), debit: 0, credit: total }],
        created_by: (req as any).user?.id ?? null,
      }, tx);
      await tx.$executeRaw`INSERT INTO fin_payroll_runs (id, payroll_run_id, period, department, account_code, basic_salary, allowances, overtime, deductions, total_amount, bank_account, status, error_details, voucher_number)
        VALUES (${randomUUID()}, ${runId}, ${b.period || null}, ${b.department || null}, ${expense}, ${basic}, ${allowances}, ${overtime}, ${deductions},
                ${total}, ${b.bank_account || null}, 'Posted', ${`Successfully mapped & posted net QR ${total.toLocaleString()} from ${b.bank_account || 'bank'}`}, ${posted?.[0]?.voucher_number ?? null})`;
    });
    res.status(201).json({ data: { payroll_run_id: runId } });
  } catch (e: any) { fail(res, 'payroll-runs:create', e, 'Failed to post the payroll run'); }
});

router.get('/bank-clearances', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'bank clearances')) return;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_bank_clearances ORDER BY clearance_date DESC, created_at DESC`;
    res.json({ data: rows.map((r) => ({ id: String(r.id), ref: r.ref, bank: r.bank || '', type: r.type || '', amount: Number(r.amount) || 0, date: dateOnly(r.clearance_date), status: r.status })) });
  } catch (e: any) { fail(res, 'bank-clearances', e, 'Failed to load bank clearances'); }
});
router.post('/bank-clearances', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'record clearances')) return;
    const b = req.body || {}; const date = ymd(b.date);
    if (!b.ref || !date || money2(b.amount) <= 0) return res.status(400).json({ error: 'ref, date and an amount above zero are required' });
    await prisma.$executeRaw`INSERT INTO fin_bank_clearances (id, ref, bank, type, amount, clearance_date, status) VALUES (${randomUUID()}, ${String(b.ref)}, ${b.bank || null}, ${b.type || null}, ${money2(b.amount)}, ${date}, ${b.status || 'Pending Clearance'})`;
    res.status(201).json({ data: { ref: b.ref } });
  } catch (e: any) { fail(res, 'bank-clearances:create', e, 'Failed to record the clearance'); }
});

router.get('/bank-reconciliations', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'bank reconciliations')) return;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_bank_recon_records ORDER BY statement_date DESC, created_at DESC`;
    res.json({ data: rows.map((r) => ({ id: String(r.id), account_number: r.account_number, statement_date: dateOnly(r.statement_date), book_balance: Number(r.book_balance) || 0,
      statement_balance: Number(r.statement_balance) || 0, difference: Number(r.difference) || 0, status: r.status })) });
  } catch (e: any) { fail(res, 'bank-reconciliations', e, 'Failed to load reconciliations'); }
});
router.post('/bank-reconciliations', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'record reconciliations')) return;
    const b = req.body || {}; const date = ymd(b.statement_date);
    if (!b.account_number || !date) return res.status(400).json({ error: 'account_number and statement_date are required' });
    const book = money2(b.book_balance); const stmt = money2(b.statement_balance); const diff = money2(stmt - book);
    await prisma.$executeRaw`INSERT INTO fin_bank_recon_records (id, account_number, statement_date, book_balance, statement_balance, difference, status)
      VALUES (${randomUUID()}, ${String(b.account_number)}, ${date}, ${book}, ${stmt}, ${diff}, ${Math.abs(diff) < 0.01 ? 'Reconciled' : 'Discrepancy'})`;
    res.status(201).json({ data: { difference: diff } });
  } catch (e: any) { fail(res, 'bank-reconciliations:create', e, 'Failed to record the reconciliation'); }
});

router.get('/recon-statements', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'reconciliation statements')) return;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM fin_recon_statements ORDER BY created_at DESC`;
    res.json({ data: rows.map((r) => ({ id: String(r.id), title: r.title, period: r.period || '', balance: r.balance || '', auditor: r.auditor || '' })) });
  } catch (e: any) { fail(res, 'recon-statements', e, 'Failed to load statements'); }
});
router.post('/recon-statements', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'archive statements')) return;
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ error: 'title is required' });
    await prisma.$executeRaw`INSERT INTO fin_recon_statements (id, title, period, balance, auditor) VALUES (${randomUUID()}, ${String(b.title)}, ${b.period || null}, ${b.balance || null}, ${b.auditor || null})`;
    res.status(201).json({ data: { title: b.title } });
  } catch (e: any) { fail(res, 'recon-statements:create', e, 'Failed to archive the statement'); }
});

// D8: SQL-backed AR/AP Ageing report computed in MariaDB from fin_ar_invoices / fin_ap_invoices.
router.get('/ageing', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'ageing report')) return;
    const type = String(req.query.type || 'ar').toLowerCase() === 'ap' ? 'ap' : 'ar';
    const asOf = isoDate(req.query.as_of) || new Date().toISOString().slice(0, 10);

    const rows = type === 'ap'
      ? await prisma.$queryRaw<any[]>`
          SELECT id, invoice_no, COALESCE(vendor, 'Unknown Vendor') AS party, COALESCE(property, '') AS property,
                 '' AS unit, invoice_date, COALESCE(due_date, invoice_date) AS due_date,
                 amount, paid_amount, (amount - paid_amount) AS outstanding,
                 GREATEST(0, DATEDIFF(${asOf}, COALESCE(due_date, invoice_date))) AS days_overdue, status
            FROM fin_ap_invoices
           WHERE LOWER(status) <> 'paid' AND amount > paid_amount AND invoice_date <= ${asOf}
           ORDER BY days_overdue DESC, invoice_date ASC`
      : await prisma.$queryRaw<any[]>`
          SELECT id, invoice_no, COALESCE(tenant, 'Unknown Tenant') AS party, COALESCE(property, '') AS property,
                 COALESCE(unit, '') AS unit, invoice_date, COALESCE(due_date, invoice_date) AS due_date,
                 amount, paid_amount, (amount - paid_amount) AS outstanding,
                 GREATEST(0, DATEDIFF(${asOf}, COALESCE(due_date, invoice_date))) AS days_overdue, status
            FROM fin_ar_invoices
           WHERE LOWER(status) <> 'paid' AND amount > paid_amount AND invoice_date <= ${asOf}
           ORDER BY days_overdue DESC, invoice_date ASC`;

    const byParty = new Map<string, any>();
    const totals = { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0, totalOutstanding: 0 };

    for (const r of rows) {
      const days = Math.max(0, Number(r.days_overdue) || 0);
      const out = money2(r.outstanding);
      if (out <= 0) continue;
      const bucket = days === 0 ? 'current' : days <= 30 ? '1_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : '90_plus';
      const partyKey = `${r.party}||${r.property}`;
      let p = byParty.get(partyKey);
      if (!p) {
        p = { partyName: r.party, property: r.property, invoiceCount: 0, current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0, totalOutstanding: 0, items: [] as any[] };
        byParty.set(partyKey, p);
      }
      p.invoiceCount += 1;
      p.totalOutstanding = money2(p.totalOutstanding + out);
      totals.totalOutstanding = money2(totals.totalOutstanding + out);
      if (bucket === 'current') { p.current = money2(p.current + out); totals.current = money2(totals.current + out); }
      else if (bucket === '1_30') { p.days1To30 = money2(p.days1To30 + out); totals.days1To30 = money2(totals.days1To30 + out); }
      else if (bucket === '31_60') { p.days31To60 = money2(p.days31To60 + out); totals.days31To60 = money2(totals.days31To60 + out); }
      else if (bucket === '61_90') { p.days61To90 = money2(p.days61To90 + out); totals.days61To90 = money2(totals.days61To90 + out); }
      else { p.days90Plus = money2(p.days90Plus + out); totals.days90Plus = money2(totals.days90Plus + out); }
      p.items.push({
        id: String(r.id), invoiceNo: r.invoice_no, partyName: r.party, property: r.property, unit: r.unit,
        invoiceDate: dateOnly(r.invoice_date), dueDate: dateOnly(r.due_date), daysOverdue: days, bucket,
        originalAmount: money2(r.amount), paidAmount: money2(r.paid_amount), outstandingAmount: out, status: r.status,
      });
    }
    res.json({ data: Array.from(byParty.values()), totals, type, asOf });
  } catch (e: any) { fail(res, 'ageing', e, 'Failed to compute ageing report'); }
});

// D7: Single VAT rate source and GL accounts from fin_tax_configs
router.get('/vat-config', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.fin_tax_configs.findMany({ where: { is_active: true }, orderBy: { rate: 'asc' } });
    res.json({ data });
  } catch (e: any) { fail(res, 'vat-config', e, 'Failed to load VAT configuration'); }
});

// E3 / D6: Credit & Debit Notes (table-backed, with atomic GL voucher posting)
router.get('/credit-debit-notes', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'credit and debit notes')) return;
    const noteType = req.query.note_type ? String(req.query.note_type).toUpperCase() : undefined;
    const data = await prisma.fin_credit_debit_notes.findMany({
      where: noteType ? { note_type: noteType } : undefined,
      orderBy: { created_at: 'desc' },
    });
    res.json({ data });
  } catch (e: any) { fail(res, 'credit-debit-notes:list', e, 'Failed to load credit/debit notes'); }
});

router.post('/credit-debit-notes', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'create credit/debit notes')) return;
    const b = req.body || {};
    const noteType = String(b.note_type || '').toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';
    const amount = money2(b.amount);
    const date = ymd(b.note_date || b.date) || new Date().toISOString().slice(0, 10);
    const partyName = String(b.party_name || '').trim();
    const accountCode = String(b.account_code || '').trim();
    if (!partyName || amount <= 0 || !accountCode) {
      return res.status(400).json({ error: 'party_name, account_code, and an amount above zero are required' });
    }
    const noteNumber = String(b.note_number || '').trim() ||
      `${noteType === 'CREDIT' ? 'CN' : 'DN'}-${date.slice(0, 4)}-${String(Date.now()).slice(-6)}`;
    const created = await prisma.fin_credit_debit_notes.create({
      data: {
        note_number: noteNumber,
        note_type: noteType,
        party_type: String(b.party_type || (noteType === 'CREDIT' ? 'Tenant' : 'Vendor')),
        party_id: b.party_id ? String(b.party_id) : null,
        party_name: partyName,
        linked_agreement: b.linked_agreement ? String(b.linked_agreement) : null,
        linked_invoice: b.linked_invoice ? String(b.linked_invoice) : null,
        amount,
        account_code: accountCode,
        reason: b.reason ? String(b.reason) : null,
        notes: b.notes ? String(b.notes) : null,
        note_date: new Date(`${date}T00:00:00.000Z`),
        status: 'DRAFT',
      },
    });
    res.status(201).json({ data: created });
  } catch (e: any) { fail(res, 'credit-debit-notes:create', e, 'Failed to create credit/debit note'); }
});

router.post('/credit-debit-notes/:id/action', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'update credit/debit notes')) return;
    const id = String(req.params.id);
    const action = String(req.body?.action || '').toLowerCase();
    if (!['approve', 'post', 'cancel'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve, post, or cancel' });
    }
    const updated = await txn(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`SELECT * FROM fin_credit_debit_notes WHERE id = ${id} LIMIT 1 FOR UPDATE`;
      if (!rows.length) { const err: any = new Error('Note not found'); err.status = 404; throw err; }
      const note = rows[0];
      if (action === 'cancel') {
        if (note.status === 'POSTED') { const err: any = new Error('Posted notes cannot be cancelled'); err.status = 409; throw err; }
        await tx.$executeRaw`UPDATE fin_credit_debit_notes SET status = 'CANCELLED' WHERE id = ${id}`;
        return { ...note, status: 'CANCELLED' };
      }
      if (action === 'approve') {
        if (note.status !== 'DRAFT') { const err: any = new Error(`Note is already ${note.status}`); err.status = 409; throw err; }
        await tx.$executeRaw`UPDATE fin_credit_debit_notes SET status = 'APPROVED' WHERE id = ${id}`;
        return { ...note, status: 'APPROVED' };
      }
      if (note.status === 'POSTED') { const err: any = new Error('Note is already posted'); err.status = 409; throw err; }
      const amt = money2(note.amount);
      const isVendor = String(note.party_type).toLowerCase() === 'vendor';
      const controlCode = isVendor ? AP_CONTROL_CODE : AR_CONTROL_CODE;
      // Debit Note: Vendor -> Dr AP / Cr Expense; Customer -> Dr AR / Cr Revenue. Credit Note: reverse sides.
      const lines = note.note_type === 'DEBIT'
        ? [{ account_code: controlCode, debit: amt, credit: 0 }, { account_code: note.account_code, debit: 0, credit: amt }]
        : [{ account_code: note.account_code, debit: amt, credit: 0 }, { account_code: controlCode, debit: 0, credit: amt }];
      const posted = await postManualVoucher({
        voucher_date: dateOnly(note.note_date),
        voucher_type: 'Journal',
        reference_no: note.note_number,
        idempotency_key: `CDN_POST|${note.note_number}`,
        description: `${note.note_type === 'CREDIT' ? 'Credit' : 'Debit'} Note ${note.note_number} — ${note.party_name}`,
        lines,
        created_by: (req as any).user?.id ?? null,
      }, tx);
      const voucherNumber = posted?.[0]?.voucher_number ?? null;
      await tx.$executeRaw`UPDATE fin_credit_debit_notes SET status = 'POSTED', voucher_number = ${voucherNumber} WHERE id = ${id}`;
      return { ...note, status: 'POSTED', voucher_number: voucherNumber };
    });
    res.json({ data: updated });
  } catch (e: any) { fail(res, 'credit-debit-notes:action', e, 'Failed to process credit/debit note'); }
});

// E3: Budget heads backed by fin_budget_heads
router.get('/budget-heads', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'budget heads')) return;
    const data = await prisma.fin_budget_heads.findMany({ where: { is_active: true }, orderBy: { code: 'asc' } });
    res.json({ data });
  } catch (e: any) { fail(res, 'budget-heads:list', e, 'Failed to load budget heads'); }
});

router.post('/budget-heads', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'manage budget heads')) return;
    const b = req.body || {};
    const code = String(b.code || '').trim();
    const name = String(b.name || '').trim();
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const row = await prisma.fin_budget_heads.upsert({
      where: { code },
      update: { name, budget_type: b.budget_type || 'OPEX', annual_limit: money2(b.annual_limit), allocated_amount: money2(b.allocated_amount) },
      create: { code, name, budget_type: b.budget_type || 'OPEX', annual_limit: money2(b.annual_limit), allocated_amount: money2(b.allocated_amount), fiscal_year: Number(b.fiscal_year) || new Date().getUTCFullYear() },
    });
    res.status(201).json({ data: row });
  } catch (e: any) { fail(res, 'budget-heads:save', e, 'Failed to save budget head'); }
});

router.delete('/budget-heads/:id', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'delete budget heads')) return;
    const id = String(req.params.id);
    await prisma.fin_budget_heads.updateMany({ where: { id }, data: { is_active: false } });
    res.json({ ok: true });
  } catch (e: any) { fail(res, 'budget-heads:delete', e, 'Failed to delete budget head'); }
});

// Posting Engine Compliance View
router.get('/compliance', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw`SELECT * FROM v_posting_engine_compliance LIMIT 100`;
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Vendor Ledgers (21000101+), Direct GRN GL Posting, and Multi-Invoice Supplier Payments ──

router.get('/vendors/ledgers', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'vendor ledgers')) return;
    const [vendors, slRows, balanceRows] = await Promise.all([
      prisma.fin_vendors.findMany({ orderBy: { id: 'asc' } }),
      prisma.fin_coa_accounts.findMany({
        where: { account_code: { startsWith: '210001' }, is_active: true },
        orderBy: { account_code: 'asc' },
      }),
      prisma.$queryRaw<Array<{ account_code: string; net_credit: any }>>`
        SELECT l.account_code, COALESCE(SUM(l.credit - l.debit), 0) AS net_credit
        FROM fin_voucher_lines l
        INNER JOIN fin_vouchers v ON v.id = l.voucher_id
        WHERE LOWER(v.status) = 'posted' AND l.account_code LIKE '21000%'
        GROUP BY l.account_code`,
    ]);
    const slByName = new Map(slRows.map((s) => [String(s.account_name || '').trim().toLowerCase(), s]));
    const balByCode = new Map(balanceRows.map((b) => [String(b.account_code), money2(b.net_credit)]));

    const data = vendors.map((v) => {
      const matched = slByName.get(String(v.name || '').trim().toLowerCase());
      const ledgerCode = matched?.account_code ?? null;
      return {
        vendor_id: v.id,
        vendor_code: v.code,
        vendor_name: v.name,
        ledger_code: ledgerCode,
        ledger_name: matched?.account_name ?? v.name,
        ledger_balance: ledgerCode ? (balByCode.get(ledgerCode) ?? 0) : 0,
      };
    });
    res.json({ data });
  } catch (e: any) { fail(res, 'vendors:ledgers', e, 'Failed to load vendor ledgers'); }
});

router.post('/vendors/ensure-ledger', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'create vendor ledger')) return;
    const vendorId = req.body?.vendor_id ?? null;
    const vendorName = String(req.body?.vendor_name || '').trim();
    if (!vendorId && !vendorName) {
      return res.status(400).json({ error: 'vendor_id or vendor_name is required' });
    }
    const data = await txn((tx) => ensureVendorLedgerTx(tx, { vendorId, vendorName }));
    res.status(201).json({ data });
  } catch (e: any) { fail(res, 'vendors:ensure-ledger', e, 'Failed to assign vendor ledger code'); }
});

// Post GRN double entry immediately on completion:
// Dr 12800001 Inventory / Stock in Hand, Cr 21000xxx Supplier Payable Account.
router.post('/grn-post', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'post goods receipt to ledger')) return;
    const b = req.body || {};
    const grnNumber = String(b.grn_number || '').trim();
    const grnId = b.grn_id ? String(b.grn_id).trim() : null;
    const totalAmount = money2(b.total_amount);
    const grnDate = ymd(b.grn_date || b.date) || new Date().toISOString().slice(0, 10);
    if (!grnNumber || totalAmount <= 0) {
      return res.status(400).json({ error: 'grn_number and total_amount above zero are required' });
    }

    const result = await txn(async (tx) => {
      const stockCode = await ensureStockInventoryAccountTx(tx);
      const vendorLedger = await ensureVendorLedgerTx(tx, {
        vendorId: b.vendor_id ?? null,
        vendorName: b.vendor_name ?? null,
      });
      const poRef = b.po_number ? ` (PO: ${b.po_number})` : '';
      const posted = await postManualVoucher({
        voucher_date: grnDate,
        voucher_type: 'Journal',
        reference_no: grnNumber,
        idempotency_key: `PROC:GRN:${grnId || grnNumber}`,
        source_type: 'PROC_GRN',
        source_id: grnId,
        property_id: b.property_name ? String(b.property_name) : null,
        description: `GRN ${grnNumber} — ${vendorLedger.name}${poRef}`,
        lines: [
          {
            account_code: stockCode,
            debit: totalAmount,
            credit: 0,
            description: `Inventory / Stock in Hand — ${grnNumber}${poRef}`,
          },
          {
            account_code: vendorLedger.code,
            debit: 0,
            credit: totalAmount,
            description: `Supplier Payable — ${vendorLedger.name} (${grnNumber})`,
          },
        ],
        created_by: (req as any).user?.id ?? null,
      }, tx);

      const postInfo = posted?.[0] || null;
      return {
        voucher_id: postInfo?.voucher_id ?? null,
        voucher_number: postInfo?.voucher_number ?? grnNumber,
        vendor_ledger_code: vendorLedger.code,
        vendor_ledger_name: vendorLedger.name,
        stock_account_code: stockCode,
      };
    });

    res.status(201).json({ data: result });
  } catch (e: any) { fail(res, 'grn:post', e, 'Failed to post GRN accounting entry'); }
});

// List outstanding AP invoices / GRNs + current payable balance for a supplier.
router.get('/vendor-open-items', async (req: Request, res: Response) => {
  try {
    if (!readGuard(req, res, 'vendor open invoices')) return;
    const vendorIdParam = String(req.query.vendor_id || '').trim();
    const vendorNameParam = String(req.query.vendor_name || '').trim();
    if (!vendorIdParam && !vendorNameParam) {
      return res.status(400).json({ error: 'vendor_id or vendor_name is required' });
    }

    let vendor: any = null;
    if (vendorIdParam && /^\d+$/.test(vendorIdParam)) {
      vendor = await prisma.fin_vendors.findUnique({ where: { id: Number(vendorIdParam) } });
    }
    if (!vendor && vendorIdParam) {
      vendor = await prisma.fin_vendors.findFirst({ where: { code: vendorIdParam } });
    }
    if (!vendor && vendorNameParam) {
      vendor = await prisma.fin_vendors.findFirst({ where: { name: vendorNameParam } });
    }

    const vIdKeys = Array.from(new Set([
      vendor ? String(vendor.id) : '',
      vendor?.code || '',
      vendor?.name || '',
      vendorIdParam,
      vendorNameParam,
    ].filter(Boolean)));

    const vName = vendor?.name || vendorNameParam;
    const slRows = await prisma.fin_coa_accounts.findMany({
      where: { account_code: { startsWith: '210001' }, is_active: true },
      orderBy: { account_code: 'asc' },
    });
    const matchedSl = slRows.find(
      (s) => String(s.account_name || '').trim().toLowerCase() === String(vName || '').trim().toLowerCase(),
    );

    const ledgerCode = matchedSl?.account_code || '21000';
    const [invoices, receipts, balRows] = await Promise.all([
      prisma.proc_ap_invoices.findMany({
        where: { vendor_id: { in: vIdKeys } },
        orderBy: [{ invoice_date: 'asc' }, { created_at: 'asc' }],
      }),
      prisma.fin_payment_receipts.findMany({
        where: {
          OR: [
            { vendor_id: { in: vIdKeys } },
            ...(vName ? [{ vendor_name: vName }] : []),
          ],
        },
      }),
      prisma.$queryRaw<Array<{ net_credit: any }>>`
        SELECT COALESCE(SUM(l.credit - l.debit), 0) AS net_credit
        FROM fin_voucher_lines l
        INNER JOIN fin_vouchers v ON v.id = l.voucher_id
        WHERE LOWER(v.status) = 'posted' AND l.account_code = ${ledgerCode}`,
    ]);

    const paidByInvoice = new Map<string, number>();
    let unallocatedPaid = 0;
    for (const r of receipts) {
      if (String(r.invoice_number) === 'UNALLOCATED') {
        unallocatedPaid = money2(unallocatedPaid + Number(r.amount_paid || 0));
      } else {
        const key = String(r.invoice_number);
        paidByInvoice.set(key, money2((paidByInvoice.get(key) || 0) + Number(r.amount_paid || 0)));
      }
    }

    const items = invoices.map((inv) => {
      const invNo = String(inv.invoice_number || inv.id);
      const totalAmt = money2(inv.total_amount ?? inv.amount ?? 0);
      const paidAmt = inv.status === 'PAID'
        ? totalAmt
        : Math.min(totalAmt, paidByInvoice.get(invNo) || 0);
      const remainingAmt = Math.max(0, money2(totalAmt - paidAmt));
      return {
        id: inv.id,
        invoice_number: invNo,
        grn_number: inv.grn_number || null,
        po_number: inv.po_number || null,
        invoice_date: inv.invoice_date ? dateOnly(inv.invoice_date) : null,
        due_date: inv.due_date ? dateOnly(inv.due_date) : null,
        total_amount: totalAmt,
        paid_amount: paidAmt,
        remaining_amount: remainingAmt,
        status: remainingAmt <= 0.005 ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : String(inv.status || 'OPEN'),
      };
    });

    const ledgerBalance = matchedSl ? money2(balRows[0]?.net_credit ?? 0) : money2(items.reduce((s, i) => s + i.remaining_amount, 0) - unallocatedPaid);

    res.json({
      data: {
        vendor_id: vendor?.id ?? null,
        vendor_name: vName,
        vendor_gl_code: matchedSl?.account_code ?? null,
        vendor_gl_name: matchedSl?.account_name ?? vName,
        ledger_balance: Math.max(0, ledgerBalance),
        unallocated_paid: unallocatedPaid,
        items,
      },
    });
  } catch (e: any) { fail(res, 'vendor-open-items', e, 'Failed to load supplier outstanding invoices'); }
});

// Multi-GRN / Multi-Invoice OR unallocated partial Supplier Payment Voucher.
router.post('/vendor-payment', async (req: Request, res: Response) => {
  try {
    if (!writeGuard(req, res, 'post supplier payment voucher')) return;
    const b = req.body || {};
    const vendorId = b.vendor_id ?? null;
    const vendorName = String(b.vendor_name || '').trim();
    const paymentDate = ymd(b.payment_date || b.date) || new Date().toISOString().slice(0, 10);
    const bankGlCode = String(b.bank_gl_code || DEFAULT_BANK_CODE).trim();
    const paymentMethod = String(b.payment_method || 'Bank Transfer').trim();
    const referenceNo = b.reference_no ? String(b.reference_no).trim() : null;
    const propertyName = b.property_name ? String(b.property_name).trim() : null;
    const narration = b.narration ? String(b.narration).trim() : '';
    const rawAllocations: any[] = Array.isArray(b.allocations) ? b.allocations : [];
    const reqTotal = money2(b.total_amount ?? b.amount);

    if (!vendorId && !vendorName) {
      return res.status(400).json({ error: 'Supplier vendor_id or vendor_name is required' });
    }

    const result = await txn(async (tx) => {
      const vendorLedger = await ensureVendorLedgerTx(tx, { vendorId, vendorName });
      const vKeys = Array.from(new Set([
        vendorLedger.vendorId !== null ? String(vendorLedger.vendorId) : '',
        vendorId ? String(vendorId) : '',
        vendorLedger.name,
        vendorName,
      ].filter(Boolean)));

      // Load current invoice balances inside the locked transaction
      const allocInputs = [];
      for (const raw of rawAllocations) {
        const payAmt = money2(raw?.amount);
        if (payAmt <= 0) continue;
        const invNo = String(raw?.invoice_number || '').trim();
        const invId = raw?.invoice_id ? String(raw.invoice_id).trim() : null;
        if (!invNo && !invId) continue;

        const invRows = await tx.$queryRaw<any[]>`
          SELECT id, invoice_number, grn_number, po_number, total_amount, amount, status
          FROM proc_ap_invoices
          WHERE ${invId ? Prisma.sql`id = ${invId}` : Prisma.sql`invoice_number = ${invNo}`}
          LIMIT 1 FOR UPDATE`;
        if (!invRows.length) {
          throw Object.assign(new Error(`Invoice ${invNo || invId} not found`), { status: 404 });
        }
        const inv = invRows[0];
        const totalAmt = money2(inv.total_amount ?? inv.amount ?? 0);
        const priorRows = await tx.$queryRaw<Array<{ paid: any }>>`
          SELECT COALESCE(SUM(amount_paid), 0) AS paid
          FROM fin_payment_receipts
          WHERE invoice_number = ${String(inv.invoice_number)}`;
        const alreadyPaid = inv.status === 'PAID' ? totalAmt : money2(priorRows[0]?.paid ?? 0);
        const remaining = Math.max(0, money2(totalAmt - alreadyPaid));
        allocInputs.push({
          invoice_id: String(inv.id),
          invoice_number: String(inv.invoice_number),
          grn_number: inv.grn_number ? String(inv.grn_number) : null,
          po_number: inv.po_number ? String(inv.po_number) : null,
          remaining,
          amount: payAmt,
        });
      }

      const plan = buildVendorAllocationPlan({
        totalAmount: reqTotal,
        allocations: allocInputs,
      });

      const refLabel = plan.allocations.length > 0
        ? plan.allocations.map((a) => a.grn_number || a.invoice_number).join(', ')
        : 'Partial / On-Account';
      const desc = narration || `Supplier Payment — ${vendorLedger.name} (${refLabel})`;

      const posted = await postManualVoucher({
        voucher_date: paymentDate,
        voucher_type: 'Payment',
        reference_no: referenceNo,
        idempotency_key: b.idempotency_key ? String(b.idempotency_key) : undefined,
        source_type: 'VENDOR_PAYMENT',
        property_id: propertyName || null,
        description: desc,
        lines: [
          {
            account_code: vendorLedger.code,
            debit: plan.totalAmount,
            credit: 0,
            description: `Supplier Payable Settlement — ${vendorLedger.name}`,
          },
          {
            account_code: bankGlCode,
            debit: 0,
            credit: plan.totalAmount,
            description: `${paymentMethod} Payment — ${vendorLedger.name}`,
          },
        ],
        created_by: (req as any).user?.id ?? null,
      }, tx);

      const postInfo = posted?.[0];
      const voucherNumber = postInfo?.voucher_number || referenceNo || `PV-${Date.now()}`;

      if (plan.allocations.length > 0) {
        for (let idx = 0; idx < plan.allocations.length; idx++) {
          const alloc = plan.allocations[idx];
          const rcptNo = `VPR-${voucherNumber}-${idx + 1}`;
          await tx.fin_payment_receipts.create({
            data: {
              receipt_number: rcptNo,
              voucher_number: voucherNumber,
              invoice_number: alloc.invoice_number,
              po_number: alloc.po_number,
              grn_number: alloc.grn_number,
              vendor_id: vendorLedger.vendorId !== null ? String(vendorLedger.vendorId) : (vendorId ? String(vendorId) : null),
              vendor_name: vendorLedger.name,
              amount_paid: alloc.amount,
              payment_date: new Date(`${paymentDate}T00:00:00.000Z`),
              payment_method: paymentMethod,
              reference_no: referenceNo,
              bank_account: bankGlCode,
              status: alloc.new_status === 'PAID' ? 'Settled' : 'Partial',
              remarks: desc,
            },
          });
          if (alloc.invoice_id) {
            await tx.proc_ap_invoices.update({
              where: { id: alloc.invoice_id },
              data: { status: alloc.new_status },
            });
          }
        }
      } else {
        await tx.fin_payment_receipts.create({
          data: {
            receipt_number: `VPR-${voucherNumber}`,
            voucher_number: voucherNumber,
            invoice_number: 'UNALLOCATED',
            po_number: null,
            grn_number: null,
            vendor_id: vendorLedger.vendorId !== null ? String(vendorLedger.vendorId) : (vendorId ? String(vendorId) : null),
            vendor_name: vendorLedger.name,
            amount_paid: plan.totalAmount,
            payment_date: new Date(`${paymentDate}T00:00:00.000Z`),
            payment_method: paymentMethod,
            reference_no: referenceNo,
            bank_account: bankGlCode,
            status: 'Partial',
            remarks: desc,
          },
        });
      }

      // If supplier's net payable balance is now settled to 0 (or below 0.01), close all open invoices/GRNs for this supplier.
      const balRows = await tx.$queryRaw<Array<{ net_credit: any }>>`
        SELECT COALESCE(SUM(l.credit - l.debit), 0) AS net_credit
        FROM fin_voucher_lines l
        INNER JOIN fin_vouchers v ON v.id = l.voucher_id
        WHERE LOWER(v.status) = 'posted' AND l.account_code = ${vendorLedger.code}`;
      const remainingLedgerBalance = money2(balRows[0]?.net_credit ?? 0);
      let closedAll = false;
      if (remainingLedgerBalance <= 0.01 && vKeys.length > 0) {
        await tx.proc_ap_invoices.updateMany({
          where: {
            vendor_id: { in: vKeys },
            status: { not: 'PAID' },
          },
          data: { status: 'PAID' },
        });
        closedAll = true;
      }

      return {
        voucher_id: postInfo?.voucher_id ?? null,
        voucher_number: voucherNumber,
        vendor_gl_code: vendorLedger.code,
        vendor_gl_name: vendorLedger.name,
        total_amount: plan.totalAmount,
        remaining_ledger_balance: Math.max(0, remainingLedgerBalance),
        closed_all: closedAll,
        allocations: plan.allocations,
      };
    });

    res.status(201).json({ data: result });
  } catch (e: any) { fail(res, 'vendor-payment', e, 'Failed to post supplier payment voucher'); }
});

export default router;
