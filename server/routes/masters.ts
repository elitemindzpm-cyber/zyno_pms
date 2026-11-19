// server/routes/masters.ts
// Master data: amenities, property types, lease statuses, etc.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tenantMiddleware } from '../lib/middleware';

const router = Router();
router.use(tenantMiddleware);

router.get('/amenities', async (_req: Request, res: Response) => {
  try { res.json({ data: await prisma.amenities.findMany() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/lease-statuses', async (_req: Request, res: Response) => {
  try { res.json({ data: await prisma.mst_lease_statuses.findMany() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/property-types', async (_req: Request, res: Response) => {
  try { res.json({ data: await prisma.mst_property_types.findMany() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/security-deposit-types', async (_req: Request, res: Response) => {
  try { res.json({ data: await prisma.mst_security_deposit_types.findMany() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/vat-treatments', async (_req: Request, res: Response) => {
  try { res.json({ data: await prisma.mst_vat_treatments.findMany() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/work-locations', async (_req: Request, res: Response) => {
  try { res.json({ data: await prisma.mst_work_locations.findMany() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/tenant-organisations', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const data = await prisma.tenant_organisations.findFirst({ where: { id: tenantId } });
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
