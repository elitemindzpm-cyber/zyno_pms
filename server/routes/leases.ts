// server/routes/leases.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.leases.findMany({ skip, take, orderBy: { created_at: 'desc' } }),
      prisma.leases.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.leases.findFirst({
      where: { id },
      include: {
        customers: true,
        properties: true,
      },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await prisma.leases.create({ data: req.body });
    res.status(201).json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.leases.updateMany({ where: { id }, data: req.body });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.leases.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
