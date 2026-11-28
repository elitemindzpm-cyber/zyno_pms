// server/lib/db-policy.ts
// Server-side permissions for the generic /api/db endpoints. Deny by default: a role may only do what
// the table rules below allow. The browser's role checks are not a security boundary.
export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
export const STAFF_ROLES = [...ADMIN_ROLES, 'PROP_MGR', 'HOST', 'LEASING', 'FINANCE', 'CASHIER'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'FINANCE', 'CASHIER'];
const SUPER_ADMIN = ['SUPER_ADMIN'];

export type Op = 'read' | 'write' | 'delete';
type Rule = { read: string[]; write: string[]; delete: string[] };

// Sensitive configuration and identity tables.
const ADMIN_ONLY: Rule = { read: ADMIN_ROLES, write: SUPER_ADMIN, delete: SUPER_ADMIN };
const TABLE_RULES: Record<string, Rule> = {
  users: { read: ADMIN_ROLES, write: ADMIN_ROLES, delete: SUPER_ADMIN },
  profiles: { read: STAFF_ROLES, write: ADMIN_ROLES, delete: SUPER_ADMIN },
  role_permissions: ADMIN_ONLY,
  system_configurations: ADMIN_ONLY,
  modules: ADMIN_ONLY,
  platform_subscription_plans: ADMIN_ONLY,
  tenant_organisations: ADMIN_ONLY,
  security_audit_logs: { read: ADMIN_ROLES, write: SUPER_ADMIN, delete: [] },
  maintenance_tickets: { read: [...STAFF_ROLES, 'TENANT'], write: [...STAFF_ROLES, 'TENANT'], delete: ADMIN_ROLES },
  fin_posting_periods: { read: STAFF_ROLES, write: [...ADMIN_ROLES, 'FINANCE'], delete: [] },
};

// Accounting: only finance roles post or change ledger data; nobody below admin deletes it.
const LEDGER_PREFIXES = ['fin_', 'erp_', 'coa_'];
const LEDGER_RULE: Rule = { read: STAFF_ROLES, write: FINANCE_ROLES, delete: ADMIN_ROLES };

// People data: staff read, admins write, only super admin deletes.
const PEOPLE_TABLES = ['employees', 'hrms_'];
const PEOPLE_RULE: Rule = { read: STAFF_ROLES, write: ADMIN_ROLES, delete: SUPER_ADMIN };

// Everything else (properties, units, leases, customers, tickets, procurement, ...): staff operate, admins delete.
const OPERATIONS_RULE: Rule = { read: STAFF_ROLES, write: STAFF_ROLES, delete: ADMIN_ROLES };

export function ruleFor(table: string): Rule {
  if (TABLE_RULES[table]) return TABLE_RULES[table];
  if (LEDGER_PREFIXES.some((p) => table.startsWith(p))) return LEDGER_RULE;
  if (PEOPLE_TABLES.some((p) => table === p || table.startsWith(p))) return PEOPLE_RULE;
  return OPERATIONS_RULE;
}

export function dbAllowed(role: string | undefined, table: string, op: Op): boolean {
  if (!role) return false;
  return ruleFor(table)[op].includes(role);
}

// Stored procedures the UI calls by name. Each one is restricted to the roles that use it.
const RPC_RULES: Record<string, string[]> = {
  post_accounting_event_atomic: FINANCE_ROLES,
  fin_manual_pdc_status_update: FINANCE_ROLES,
  fin_validate_event_balance: STAFF_ROLES,
  fin_resolve_unit_sl: FINANCE_ROLES,
  fin_refresh_event_totals: FINANCE_ROLES,
  proc_next_document_number: STAFF_ROLES,
};

export function rpcAllowed(role: string | undefined, fn: string): boolean {
  if (!role) return false;
  const allowed = RPC_RULES[fn] ?? ADMIN_ROLES;   // unknown functions: admins only
  return allowed.includes(role);
}
