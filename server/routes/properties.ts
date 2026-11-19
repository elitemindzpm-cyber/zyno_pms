// server/routes/properties.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';

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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

// POST /api/properties
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await prisma.properties.create({ data: req.body });
    res.status(201).json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/properties/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.properties.updateMany({
      where: { id },
      data: req.body,
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/properties/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.properties.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
