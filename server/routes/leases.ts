// server/routes/leases.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';
import { sendDbError } from '../lib/errors';
import { isTenant, tenantLeaseWhere } from '../lib/tenant-policy';
import { createLease, terminateLease, isTerminatedLease, normaliseDates } from '../services/leases';

const router = Router();

/** Tenants see only their own leases. Staff see everything. */
function scopeFor(req: Request) {
  const claims = (req as any).user;
  return isTenant(req) ? tenantLeaseWhere(claims) : {};
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const where = scopeFor(req);
    const [data, total] = await Promise.all([
      prisma.leases.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.leases.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { sendDbError(res, e, 'leases.list'); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.leases.findFirst({
      where: { id, ...scopeFor(req) },
      include: { customers: true, properties: true },
    });
    // Not found and not yours look the same to a tenant.
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) { sendDbError(res, e, 'leases.get'); }
});

// POST /api/leases — lease, PDC schedule, unit status and deposit, all through the shared service.
router.post('/', async (req: Request, res: Response) => {
  try {
    const created = await createLease(req.body || {});
    res.status(201).json(created);
  } catch (e: any) { sendDbError(res, e, 'leases.create'); }
});

// PATCH /api/leases/:id — a status change to TERMINATED runs the termination settlement.
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const body = normaliseDates({ ...(req.body || {}) });
    if (isTerminatedLease(body.lease_status)) {
      const result = await terminateLease(id, body);
      return res.json({ success: true, ...result });
    }
    await prisma.leases.updateMany({ where: { id }, data: body });
    res.json({ success: true });
  } catch (e: any) { sendDbError(res, e, 'leases.update'); }
});

// POST /api/leases/:id/terminate — damages and penalties are settled against the deposit; the rest is refunded.
router.post('/:id/terminate', async (req: Request, res: Response) => {
  try {
    const result = await terminateLease(req.params.id as string, req.body || {});
    res.json(result);
  } catch (e: any) { sendDbError(res, e, 'leases.terminate'); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.leases.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (e: any) { sendDbError(res, e, 'leases.delete'); }
});

export default router;
