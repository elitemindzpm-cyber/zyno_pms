// server/routes/accounting.ts
// Finance / GL / Accounting Events endpoints
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tenantMiddleware, parsePagination, paginatedResponse } from '../lib/middleware';

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

// Posting Engine Compliance View
router.get('/compliance', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw`SELECT * FROM v_posting_engine_compliance LIMIT 100`;
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
