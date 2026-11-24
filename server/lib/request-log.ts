// server/lib/request-log.ts
// One JSON line per request: time, request id, method, path, status, duration, user id.
// Never logs query strings, headers, or bodies, so passwords, tokens and personal data stay out of the logs.
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestLog(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  (req as any).requestId = id;
  res.setHeader('x-request-id', id);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(JSON.stringify({
      t: new Date().toISOString(),
      id,
      method: req.method,
      // Original path without the query string: routers rewrite req.path while a request is handled.
      path: String(req.originalUrl ?? req.url).split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms),
      user: (req as any).user?.sub ?? null,
    }));
  });
  next();
}
