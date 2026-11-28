// server/lib/require-session.ts
// Every /api route except login/session/logout and the signed payment webhook requires a valid session
// (httpOnly cookie or Bearer token).
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { readSessionToken } from './session';

import { jwtSecret } from './config';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';
// The webhook is called by the payment gateway, so it has no session. It verifies an HMAC signature instead.
const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/payments/webhook',
]);

/** Returns the session claims for this request, or null when there is no valid session. */
export function verifySession(req: Request): any | null {
  const token = readSessionToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret()) as any;
  } catch {
    return null;
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS' || !req.path.startsWith('/api/') || PUBLIC_PATHS.has(req.path)) {
    return next();
  }
  const token = readSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const claims = jwt.verify(token, jwtSecret()) as any;
    (req as any).user = claims;
    // A tenant-bound user is always scoped to their own tenant, regardless of the header they send.
    // A5: the tenant is decided by the server (session claim, else the single default tenant). A client
    // supplied x-tenant-id header is never trusted.
    req.headers['x-tenant-id'] = String(claims.tenant_id || DEFAULT_TENANT_ID);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}
