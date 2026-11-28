// server/lib/tenant-policy.ts
// Tenant (portal) users may call only the endpoints listed here. Every other API route answers 403,
// including routes that do not exist, so tenants cannot probe for staff endpoints.
import { Request, Response, NextFunction } from 'express';

export const TENANT_ROLE = 'TENANT';

type Rule = { method: string; path: RegExp };

const TENANT_RULES: Rule[] = [
  // Lease list and detail are filtered to the tenant's own leases inside the route.
  { method: 'GET', path: /^\/api\/leases(\/[^/]+)?$/ },
  // Tenant portal aggregated summary scoped strictly to the signed-in tenant's leases/tickets/payments.
  { method: 'GET', path: /^\/api\/portal\/summary$/ },
  // Maintenance tickets: insert and query are scoped (own tenant_id, active lease) inside db.ts.
  { method: 'POST', path: /^\/api\/db\/maintenance_tickets\/(insert|query)$/ },
  // Session and self-service reference data.
  { method: 'GET', path: /^\/api\/auth\/(session|notifications|permissions)$/ },
  { method: 'POST', path: /^\/api\/auth\/logout$/ },
  { method: 'GET', path: /^\/api\/masters\/(amenities|lease-statuses|property-types|security-deposit-types|vat-treatments|work-locations)$/ },
];

export function isTenant(req: Request): boolean {
  return (req as any).user?.role === TENANT_ROLE;
}

/** Lease ownership for a tenant: created by them, or the lease's customer has their email. */
export function tenantLeaseWhere(claims: { sub: string; email?: string }) {
  const or: any[] = [{ created_by: claims.sub }];
  if (claims.email) {
    or.push({
      customers: {
        OR: [{ primary_email: claims.email }, { email_address: claims.email }],
      },
    });
  }
  return { OR: or };
}

export function tenantPolicy(req: Request, res: Response, next: NextFunction) {
  if (!isTenant(req) || !req.path.startsWith('/api/')) return next();
  const allowed = TENANT_RULES.some((r) => r.method === req.method && r.path.test(req.path));
  if (allowed) return next();
  return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS', requiredRole: ['staff'] });
}
