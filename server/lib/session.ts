// server/lib/session.ts
// Login session stored in an httpOnly cookie, so the browser never holds the JWT in JS-readable storage.
import { Request, Response } from 'express';

export const SESSION_COOKIE = 'pms_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/** Bearer header (API clients) takes precedence, then the session cookie. */
export function readSessionToken(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || '';
}

export function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`,
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}
