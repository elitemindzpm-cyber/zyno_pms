// server/lib/errors.ts
// One error type for business-rule failures, and one place that turns any error into a safe HTTP response.
import { Response } from 'express';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

/**
 * Sends an error response without leaking database internals.
 * - HttpError: its own status and message.
 * - Prisma unique/foreign-key/not-found codes: 409 / 409 / 404 with a plain message.
 * - Prisma validation errors: 400.
 * - Anything else: 500 with a generic message (details are logged on the server).
 */
export function sendDbError(res: Response, err: any, context = 'request') {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ data: null, error: err.message });
  }
  const code: string | undefined = err?.code;
  console.error(`[${context}] ${code ?? err?.name ?? 'error'}:`, err?.meta ?? String(err?.message ?? err).slice(0, 400));
  if (code === 'P2002') return res.status(409).json({ data: null, error: 'A record with the same unique value already exists' });
  if (code === 'P2003') return res.status(409).json({ data: null, error: 'This record is referenced by other data and cannot be changed or removed' });
  if (code === 'P2025') return res.status(404).json({ data: null, error: 'Record not found' });
  if (err?.name === 'PrismaClientValidationError') {
    return res.status(400).json({ data: null, error: 'Invalid data for this request' });
  }
  console.error(`[${context}]`, err);
  return res.status(500).json({ data: null, error: 'Internal server error' });
}

/** Sent when a user is not allowed to perform the action. */
export const forbidden = (res: Response, requiredRole: string[] | string, message = 'INSUFFICIENT_PERMISSIONS') =>
  res.status(403).json({ error: message, requiredRole });
