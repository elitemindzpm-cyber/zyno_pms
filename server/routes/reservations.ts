// server/routes/reservations.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';
import { createReservation } from '../services/property';
import { HttpError, sendDbError } from '../lib/errors';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const status = req.query.status as string;
    const where: any = {};
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      prisma.reservations.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.reservations.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.reservations.findFirst({
      where: { id },
      include: { users: true },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/reservations
// Reserving a unit locks it (row lock), refuses it if it is already reserved or leased, and marks it RESERVED.
// POST /api/reservations — rules in services/property.ts (unit lock, one live reservation per unit).
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await createReservation(req.body || {});
    res.status(201).json(item);
  } catch (e: any) {
    sendDbError(res, e, 'reservations.create');
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.reservations.updateMany({ where: { id }, data: req.body });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.reservations.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
