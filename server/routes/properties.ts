// server/routes/properties.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';
import { assertPropertyDeletable } from '../services/property';
import { sendDbError } from '../lib/errors';
import { coerceForModel } from '../lib/coerce';

const router = Router();

// GET /api/properties
router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const search = req.query.search as string;

    const where: any = {};
    if (search) where.title = { contains: search };

    const [data, total] = await Promise.all([
      prisma.properties.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.properties.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) {
    sendDbError(res, e, 'properties.list');
  }
});

// GET /api/properties/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.properties.findFirst({
      where: { id },
      include: { units: true, property_images: true, property_amenities: true },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) {
    sendDbError(res, e, 'properties.get');
  }
});

// POST /api/properties
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = coerceForModel('properties', req.body || {});
    const item = await prisma.properties.create({ data });
    res.status(201).json(item);
  } catch (e: any) {
    sendDbError(res, e, 'properties.create');
  }
});

// PATCH /api/properties/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = coerceForModel('properties', req.body || {});
    const result = await prisma.properties.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'Property not found' });
    res.json({ success: true });
  } catch (e: any) {
    sendDbError(res, e, 'properties.update');
  }
});

// DELETE /api/properties/:id — rules in services/property.ts (no deletion with occupied units or live leases).
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await assertPropertyDeletable(id);
    const result = await prisma.properties.deleteMany({ where: { id } });
    if (result.count === 0) return res.status(404).json({ error: 'Property not found' });
    res.json({ success: true });
  } catch (e: any) {
    sendDbError(res, e, 'properties.delete');
  }
});

export default router;
