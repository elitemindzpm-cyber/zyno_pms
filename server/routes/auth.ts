// server/routes/auth.ts
// Auth: user identity, profiles, roles, system notifications
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tenantMiddleware } from '../lib/middleware';

const router = Router();

// GET current user profile (no tenant required - uses user id)
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const item = await prisma.profiles.findFirst({ where: { id: userId } });
    if (!item) return res.status(404).json({ error: 'Profile not found' });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update profile
router.patch('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    await prisma.profiles.updateMany({ where: { id: userId }, data: req.body });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// System notifications (tenant-scoped)
router.use(tenantMiddleware);

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = req.query.user_id as string;
    const where: any = { tenant_id: tenantId };
    if (userId) where.target_user = userId;
    const data = await prisma.system_notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Role permissions
router.get('/permissions', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const data = await prisma.role_permissions.findMany({ where: { tenant_id: tenantId } });
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
