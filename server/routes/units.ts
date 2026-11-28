// server/routes/units.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';
import { createUnit } from '../services/property';
import { sendDbError } from '../lib/errors';
import { coerceForModel } from '../lib/coerce';

const router = Router();

// GET /api/units
router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const propertyId = req.query.property_id as string;
    const status = req.query.status as string;

    const where: any = {};
    if (propertyId) where.property_id = propertyId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.units.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.units.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/units/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.units.findFirst({
      where: { id },
      include: { properties: true, unit_amenities: true },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/units — rules in services/property.ts (unique unit number per property, COA mapping).
router.post('/', async (req: Request, res: Response) => {
  try {
    const unit = await createUnit(req.body || {});
    res.status(201).json(unit);
  } catch (e: any) {
    sendDbError(res, e, 'units.create');
  }
});

// PATCH /api/units/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = coerceForModel('units', req.body || {});
    const result = await prisma.units.updateMany({ where: { id }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json({ success: true });
  } catch (e: any) {
    sendDbError(res, e, 'units.update');
  }
});

// DELETE /api/units/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await prisma.units.deleteMany({ where: { id } });
    if (result.count === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json({ success: true });
  } catch (e: any) {
    sendDbError(res, e, 'units.delete');
  }
});

export default router;
