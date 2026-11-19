// server/routes/finance.ts
// Finance: PDCs, bank accounts, payment allocations, deposits
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tenantMiddleware, parsePagination, paginatedResponse } from '../lib/middleware';

const router = Router();
router.use(tenantMiddleware);

// PDC Register
router.get('/pdcs', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { skip, take, page, limit } = parsePagination(req);
    const status = req.query.status as string;
    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      prisma.fin_pdc_register.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.fin_pdc_register.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Bank Accounts
router.get('/bank-accounts', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.fin_bank_accounts.findMany();
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Deposits
router.get('/deposits', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.fin_deposits.findMany({ where: { tenant_id: tenantId }, skip, take }),
      prisma.fin_deposits.count({ where: { tenant_id: tenantId } }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Payment Allocations
router.get('/payment-allocations', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.fin_payment_allocations.findMany({ where: { tenant_id: tenantId }, skip, take }),
      prisma.fin_payment_allocations.count({ where: { tenant_id: tenantId } }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Financial Years
router.get('/financial-years', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.fin_financial_years.findMany({ orderBy: { start_date: 'desc' } });
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
