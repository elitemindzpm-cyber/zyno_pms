// server/routes/auth.ts
// Auth: user identity, login, sessions, profiles, roles, system notifications
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { tenantMiddleware } from '../lib/middleware';
import { readSessionToken, setSessionCookie, clearSessionCookie } from '../lib/session';

const router = Router();
import { jwtSecret } from '../lib/config';
import { signInBlockedFor, recordSignInFailure, clearSignInFailures } from '../lib/login-limiter';
const JWT_EXPIRES = '7d';

// ── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const blockedFor = signInBlockedFor(trimmedEmail, req.ip ?? '');
    if (blockedFor > 0) {
      res.set('Retry-After', String(blockedFor));
      return res.status(429).json({ error: 'Too many failed sign-in attempts. Try again later.', retry_after_seconds: blockedFor });
    }

    // Find user in users table
    const user = await prisma.users.findFirst({
      where: {
        email: trimmedEmail,
      },
    });

    if (!user) {
      recordSignInFailure(trimmedEmail, req.ip ?? ''); return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Parse metadata to extract password_hash
    let meta: any = {};
    if (user.raw_user_meta_data) {
      try {
        meta = JSON.parse(user.raw_user_meta_data);
      } catch (err) {
        meta = {};
      }
    }

    const passwordHash = meta.password_hash;
    if (!passwordHash) {
      recordSignInFailure(trimmedEmail, req.ip ?? ''); return res.status(401).json({ error: 'User has no password set' });
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      recordSignInFailure(trimmedEmail, req.ip ?? ''); return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get user profile
    clearSignInFailures(trimmedEmail);
    const profile = await prisma.profiles.findFirst({
      where: { id: user.id },
    });

    const role = profile?.role || user.role || meta.role || 'ADMIN';
    const fullName = profile?.full_name || meta.full_name || user.email?.split('@')[0] || 'User';
    const tenantId = meta.tenant_id || (user as any).tenant_id || null;

    // Generate JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: role,
      full_name: fullName,
      tenant_id: tenantId,
    };

    const token = jwt.sign(payload, jwtSecret(), { expiresIn: JWT_EXPIRES });

    setSessionCookie(res, token);
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: role,
        full_name: fullName,
        tenant_id: tenantId,
      },
      profile: {
        id: user.id,
        role: role,
        full_name: fullName,
        avatar_url: profile?.avatar_url || null,
        tenant_id: tenantId,
      },
    });
  } catch (e: any) {
    console.error('[auth/login error]', e);
    return res.status(500).json({ error: e.message });
  }
});

// ── Current Session / Me ─────────────────────────────────────────────────────
router.get('/session', async (req: Request, res: Response) => {
  try {
    const token = readSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret()) as any;

    const user = await prisma.users.findFirst({
      where: { id: decoded.sub },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: user.id },
    });

    let meta: any = {};
    if (user.raw_user_meta_data) {
      try {
        meta = JSON.parse(user.raw_user_meta_data);
      } catch (err) {}
    }

    const role = profile?.role || user.role || decoded.role || 'ADMIN';
    const fullName = profile?.full_name || meta.full_name || decoded.full_name || 'User';
    const tenantId = meta.tenant_id || decoded.tenant_id || null;

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: role,
        full_name: fullName,
        tenant_id: tenantId,
      },
      profile: {
        id: user.id,
        role: role,
        full_name: fullName,
        avatar_url: profile?.avatar_url || null,
        tenant_id: tenantId,
      },
    });
  } catch (e: any) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

// ── Profile by ID ────────────────────────────────────────────────────────────
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const item = await prisma.profiles.findFirst({ where: { id: userId } });
    if (!item) return res.status(404).json({ error: 'Profile not found' });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    await prisma.profiles.updateMany({ where: { id: userId }, data: req.body });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Notifications & Permissions (tenant-scoped) ─────────────────────────────
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/permissions', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const data = await prisma.role_permissions.findMany({ where: { tenant_id: tenantId } });
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
