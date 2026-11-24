// e2e/lib/api.mjs
// Thin HTTP client for the PMS API. Keeps the session cookie separate per user.
import { API } from './env.mjs';

export async function call(method, route, { cookie, body, headers } = {}) {
  const h = { ...(headers || {}) };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (cookie) h.cookie = cookie;
  const res = await fetch(API + route, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const sess = setCookies.find((c) => c.startsWith('pms_session='));
  return { status: res.status, body: json, headers: res.headers, cookie: sess ? sess.split(';')[0] : null };
}

export async function login(email, password) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.cookie) {
    throw new Error(`login failed for ${email}: HTTP ${r.status} ${short(r.body)}`);
  }
  return r;
}

/** Id of a created row, whichever envelope the route used. */
export const idOf = (r) => r?.body?.data?.id ?? r?.body?.id ?? null;

export const short = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return (s ?? 'null').slice(0, 300);
};
