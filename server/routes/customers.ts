// server/routes/customers.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';
import { createCustomer } from '../services/property';
import { HttpError, sendDbError } from '../lib/errors';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const search = req.query.search as string;
    const where: any = {};
    if (search) where.full_name = { contains: search };
    const [data, total] = await Promise.all([
      prisma.customers.findMany({ where, skip, take }),
      prisma.customers.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.customers.findFirst({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/customers — rules in services/property.ts (KYC by customer type, no duplicate IDs).
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await createCustomer(req.body || {});
    res.status(201).json(item);
  } catch (e: any) {
    sendDbError(res, e, 'customers.create');
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.customers.updateMany({ where: { id }, data: req.body });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.customers.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
