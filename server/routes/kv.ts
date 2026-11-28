// server/routes/kv.ts
// Tenant-scoped key/value store. Replaces all browser localStorage/sessionStorage usage.
//
// A3: this store is for non-authoritative app state only. Identity, role and audit keys are never
// readable or writable through it, keys are validated, values are size-capped, and roles that have no
// business using the store are refused.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ADMIN_ROLES } from '../lib/db-policy';

const router = Router();
const DEFAULT_TENANT = 'a0000000-0000-0000-0000-000000000001';
const tenantOf = (req: Request) => (req.headers['x-tenant-id'] as string) || DEFAULT_TENANT;

// Roles that may use the store at all. TENANT is already blocked by tenantPolicy; GUEST has no use for it.
const KV_ROLES = [...ADMIN_ROLES, 'PROP_MGR', 'HOST', 'LEASING', 'FINANCE', 'CASHIER', 'MAINTENANCE', 'EMPLOYEE'];

// Keys that carry identity, role or audit data. The server (or the database tables) own these.
const PROTECTED_KEYS = new Set([
  'zyno_demo_session', 'zyno-demo-session', 'zyno_user_role', 'userRole', 'pms_security_audit_logs',
]);
const PROTECTED_PATTERNS = [/^zyno[-_]?demo/i, /(^|[_-])(role|roles|permission|permissions|session|token|password|secret)([_-]|$)/i];
const isProtectedKey = (k: string) => PROTECTED_KEYS.has(k) || PROTECTED_PATTERNS.some((re) => re.test(k));

const KEY_RE = /^[A-Za-z0-9_.:\-]{1,200}$/;
const MAX_VALUE_BYTES = 10 * 1024 * 1024;

function guard(req: Request, res: Response): boolean {
  const role = (req as any).user?.role as string | undefined;
  if (!role || !KV_ROLES.includes(role)) {
    res.status(403).json({ error: 'Not authorized to use the application store' });
    return false;
  }
  return true;
}

// Everything for the tenant, used to hydrate the client on load. Protected keys are never returned.
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!guard(req, res)) return;
    const rows = await prisma.$queryRaw<{ k: string; v: string }[]>`SELECT k, v FROM app_kv_store WHERE tenant_id = ${tenantOf(req)}`;
    const data: Record<string, string> = {};
    for (const r of rows) if (!isProtectedKey(r.k)) data[r.k] = r.v;
    res.json({ data });
  } catch (e: any) {
    console.error('[kv get]', e?.message);
    res.status(500).json({ error: 'Failed to load the application store' });
  }
});

router.put('/:key', async (req: Request, res: Response) => {
  try {
    if (!guard(req, res)) return;
    const key = req.params.key as string;
    if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Invalid key' });
    if (isProtectedKey(key)) return res.status(403).json({ error: 'This key cannot be written through the application store' });
    const value = req.body?.value;
    if (typeof value !== 'string') return res.status(400).json({ error: 'value must be a string' });
    if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) return res.status(413).json({ error: 'Value is too large' });
    const tenant = tenantOf(req);
    await prisma.$executeRaw`INSERT INTO app_kv_store (tenant_id, k, v) VALUES (${tenant}, ${key}, ${value})
      ON DUPLICATE KEY UPDATE v = VALUES(v)`;
    res.json({ success: true });
  } catch (e: any) {
    console.error('[kv put]', e?.message);
    res.status(500).json({ error: 'Failed to save' });
  }
});

router.delete('/:key', async (req: Request, res: Response) => {
  try {
    if (!guard(req, res)) return;
    const key = req.params.key as string;
    if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Invalid key' });
    if (isProtectedKey(key)) return res.status(403).json({ error: 'This key cannot be deleted through the application store' });
    await prisma.$executeRaw`DELETE FROM app_kv_store WHERE tenant_id = ${tenantOf(req)} AND k = ${key}`;
    res.json({ success: true });
  } catch (e: any) {
    console.error('[kv delete]', e?.message);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
