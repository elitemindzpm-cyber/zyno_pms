// server/routes/procurement.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tenantMiddleware, parsePagination, paginatedResponse } from '../lib/middleware';

const router = Router();
router.use(tenantMiddleware);

// Purchase Requests
router.get('/purchase-requests', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { skip, take, page, limit } = parsePagination(req);
    const status = req.query.status as string;
    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      prisma.proc_purchase_requests.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, include: { proc_purchase_request_lines: true } }),
      prisma.proc_purchase_requests.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Purchase Orders
router.get('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.proc_purchase_orders.findMany({ skip, take, orderBy: { po_date: 'desc' }, include: { proc_purchase_order_lines: true } }),
      prisma.proc_purchase_orders.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Vendors
router.get('/vendors', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.fin_vendors.findMany();
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// RFX
router.get('/rfx', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.proc_rfx.findMany({ skip, take, orderBy: { issue_date: 'desc' } }),
      prisma.proc_rfx.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GRN
router.get('/goods-receipts', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.proc_goods_receipts.findMany({ skip, take }),
      prisma.proc_goods_receipts.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
