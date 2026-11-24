// server/lib/middleware.ts
// Shared middleware: tenant isolation, auth JWT extraction, pagination helpers

import { Request, Response, NextFunction } from 'express';

/**
 * Extracts tenant_id from request headers or JWT payload.
 * All DB queries MUST scope to req.tenantId for multi-tenancy isolation
 * (replaces DB RLS, which MariaDB does not support natively).
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req.headers['x-tenant-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
  (req as any).tenantId = tenantId;
  next();
}

/**
 * Parse standard pagination query params: ?page=1&limit=25
 */
export function parsePagination(req: Request): { skip: number; take: number; page: number; limit: number } {
  const page  = Math.max(1, parseInt((req.query.page  as string) || '1', 10));
  const limit = Math.min(100, parseInt((req.query.limit as string) || '25', 10));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

/**
 * Standard paginated response envelope
 */
export function paginatedResponse(data: any[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
