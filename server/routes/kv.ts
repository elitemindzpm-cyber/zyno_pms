// server/routes/kv.ts
// Tenant-scoped key/value store. Replaces all browser localStorage/sessionStorage usage.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();
const DEFAULT_TENANT = 'a0000000-0000-0000-0000-000000000001';
const tenantOf = (req: Request) => (req.headers['x-tenant-id'] as string) || DEFAULT_TENANT;

// Everything for the tenant, used to hydrate the client on load.
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<{ k: string; v: string }[]>`SELECT k, v FROM app_kv_store WHERE tenant_id = ${tenantOf(req)}`;
    const data: Record<string, string> = {};
    for (const r of rows) data[r.k] = r.v;
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:key', async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string;
    const value = req.body?.value;
    if (typeof value !== 'string') return res.status(400).json({ error: 'value must be a string' });
    const tenant = tenantOf(req);
    await prisma.$executeRaw`INSERT INTO app_kv_store (tenant_id, k, v) VALUES (${tenant}, ${key}, ${value})
      ON DUPLICATE KEY UPDATE v = VALUES(v)`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:key', async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string;
    await prisma.$executeRaw`DELETE FROM app_kv_store WHERE tenant_id = ${tenantOf(req)} AND k = ${key}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
