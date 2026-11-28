// server/routes/auth.ts
// Auth: user identity, login, sessions, profiles, roles, system notifications
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { ADMIN_ROLES } from '../lib/db-policy';
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
    const caller = (req as any).user || {};
    // A user reads their own profile; reading anyone else's needs an admin role.
    if (caller.sub !== userId && !ADMIN_ROLES.includes(caller.role)) {
      return res.status(403).json({ error: 'Not authorized to view this profile' });
    }
    const item = await prisma.profiles.findFirst({ where: { id: userId } });
    if (!item) return res.status(404).json({ error: 'Profile not found' });
    res.json(item);
  } catch (e: any) {
    console.error('[auth/profile get]', e?.message);
    res.status(500).json({ error: 'Failed to load the profile' });
  }
});

const SELF_EDITABLE = ['full_name', 'avatar_url'];
const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROP_MGR', 'HOST', 'LEASING', 'FINANCE', 'CASHIER', 'TENANT', 'MAINTENANCE', 'EMPLOYEE', 'GUEST'];

router.patch('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const caller = (req as any).user || {};
    const isSelf = caller.sub === userId;
    const isAdmin = ADMIN_ROLES.includes(caller.role);
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Not authorized to change this profile' });

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const data: Record<string, any> = {};
    for (const k of SELF_EDITABLE) if (k in body) data[k] = body[k];

    if ('role' in body) {
      // Only admins change roles, never their own, and only a SUPER_ADMIN may grant or alter SUPER_ADMIN.
      if (!isAdmin) return res.status(403).json({ error: 'Only an administrator can change a role' });
      if (isSelf) return res.status(403).json({ error: 'You cannot change your own role' });
      const nextRole = String(body.role || '');
      if (!VALID_ROLES.includes(nextRole)) return res.status(400).json({ error: 'Unknown role' });
      const target = await prisma.profiles.findFirst({ where: { id: userId } });
      const touchesSuper = nextRole === 'SUPER_ADMIN' || target?.role === 'SUPER_ADMIN';
      if (touchesSuper && caller.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only a super administrator can grant or change the super administrator role' });
      }
      data.role = nextRole;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No editable fields supplied' });
    if ('full_name' in data && (typeof data.full_name !== 'string' || !data.full_name.trim())) {
      return res.status(400).json({ error: 'full_name cannot be empty' });
    }

    const result = await prisma.profiles.updateMany({ where: { id: userId }, data });
    if (!result.count) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[auth/profile patch]', e?.message);
    res.status(500).json({ error: 'Failed to update the profile' });
  }
});

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
