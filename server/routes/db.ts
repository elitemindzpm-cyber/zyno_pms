// server/routes/db.ts
// Universal REST query proxy for Prisma models
// Powers the frontend REST-backed Supabase proxy with 100% MariaDB execution

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Table aliases for backwards compatibility with legacy Supabase code
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
    const table = req.params.table;
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
    } = req.body;

    // Filter out unsupported columns or format conditions
    const cleanWhere: Record<string, any> = {};
    for (const [key, val] of Object.entries(where)) {
      if (val !== undefined) {
        cleanWhere[key] = val;
      }
    }

    if (countOnly) {
      const count = await model.count({ where: cleanWhere });
      return res.json({ data: null, count, error: null });
    }

    if (single || maybeSingle) {
      const item = await model.findFirst({
        where: cleanWhere,
        orderBy,
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
    if (orderBy) queryOptions.orderBy = orderBy;
    if (typeof skip === 'number') queryOptions.skip = skip;
    if (typeof take === 'number') queryOptions.take = take;

    const items = await model.findMany(queryOptions);
    return res.json({ data: items, error: null, count: items.length });
  } catch (err: any) {
    console.error(`[db-proxy query error on ${req.params.table}]`, err.message);
    return res.status(500).json({ data: null, error: err.message });
  }
});

// ── Insert ───────────────────────────────────────────────────────────────────
router.post('/:table/insert', async (req: Request, res: Response) => {
  try {
    const table = req.params.table;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' not found in Prisma client`,
      });
    }

    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ data: null, error: 'No data provided for insert' });
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
    return res.status(500).json({ data: null, error: err.message });
  }
});

// ── Update ───────────────────────────────────────────────────────────────────
router.post('/:table/update', async (req: Request, res: Response) => {
  try {
    const table = req.params.table;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' not found in Prisma client`,
      });
    }

    const { where = {}, data } = req.body;
    if (!data) {
      return res.status(400).json({ data: null, error: 'No data provided for update' });
    }

    const result = await model.updateMany({
      where,
      data,
    });

    return res.json({ data: result, error: null });
  } catch (err: any) {
    console.error(`[db-proxy update error on ${req.params.table}]`, err.message);
    return res.status(500).json({ data: null, error: err.message });
  }
});

// ── Delete ───────────────────────────────────────────────────────────────────
router.post('/:table/delete', async (req: Request, res: Response) => {
  try {
    const table = req.params.table;
    const modelName = resolveModelName(table);
    const model = (prisma as any)[modelName];

    if (!model) {
      return res.status(404).json({
        data: null,
        error: `Model '${table}' not found in Prisma client`,
      });
    }

    const { where = {} } = req.body;
    const result = await model.deleteMany({
      where,
    });

    return res.json({ data: result, error: null });
  } catch (err: any) {
    console.error(`[db-proxy delete error on ${req.params.table}]`, err.message);
    return res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
