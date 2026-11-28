# ZYNO PMS access control claims (code-verified, read-only)

All sources are local files under E:/Port/ZYNO PMS (no external sources).

## 1. TENANT role vs maintenance_tickets (tenantPolicy vs dbAllowed)

### Takeaway
CONFIRMED. tenantPolicy lets TENANT through to POST /api/db/maintenance_tickets/(insert|query), but the db router's own check (dbAllowed) then rejects TENANT with 403, so the tenant ticket code in db.ts is unreachable.

### Cited Findings
- tenantPolicy allowlist includes POST /api/db/maintenance_tickets/(insert|query) — server/lib/tenant-policy.ts:14
- db router middleware runs dbAllowed(role, model, op) for every table route before handlers — server/routes/db.ts:133-147
- maintenance_tickets has no TABLE_RULES entry, so it gets OPERATIONS_RULE (read/write = STAFF_ROLES) — server/lib/db-policy.ts:77,79-84
- STAFF_ROLES = SUPER_ADMIN, ADMIN, PROP_MGR, HOST, LEASING, FINANCE, CASHIER; TENANT absent — server/lib/db-policy.ts:47-48
- Result: query maps to op read, insert to write; both return 403 INSUFFICIENT_PERMISSIONS for TENANT — db.ts:144-145
- Dead code for tenants: tenant ticket scoping in query (db.ts:213-216) and insert (db.ts:408-416, active-lease check db.ts:26-41).
- Side note: MAINTENANCE, GUEST, EMPLOYEE roles are also not in STAFF_ROLES, so they get 403 on generic /api/db for ordinary tables.

### Inferences
- Tenant-portal ticket calls via /api/db return 403 today. A fix needs a tenant exception for maintenance_tickets in the db router/dbAllowed.
- The portal UI does not hit this anyway (see Q5).

### Gaps
- Server was not run; verdict is static reading. maintenance_tickets model exists (prisma/schema.prisma:3288); resolveModelName at db.ts:165-176.

## 2. /api/kv access control

### Takeaway
CONFIRMED for non-tenant roles. kv.ts has no role or key check. Only tenantPolicy blocks TENANT (not in allowlist, so 403). Every other logged-in role can read all keys of the tenant and write/delete any key, including the demo session key and the audit-log cache key.

### Cited Findings
- GET /, PUT /:key, DELETE /:key have no role checks and no key allowlist — server/routes/kv.ts:233-266
- Only gate is requireSession (any valid JWT) — server/lib/require-session.ts:207-222; mounted server/index.ts:66,101
- TENANT blocked because /api/kv is not in TENANT_RULES — server/lib/tenant-policy.ts:10-19,38-43
- Tenant comes from x-tenant-id header with hardcoded default — kv.ts:230 (header overwritten only if JWT has tenant_id, require-session.ts:217; see Q3)
- Client kv holds former localStorage: demo session key zyno-demo-session (src/lib/demo-auth.ts:4,101,106), audit cache pms_security_audit_logs (src/lib/security.ts:40,60); many modules call kvStore.setItem.
- Client getCurrentProfile falls back to a kv-stored demo session when there is no real session — src/lib/auth-guards.ts:75-83. kv itself needs a real session, so this only matters for logged-in users; the server still enforces the JWT role.
- setDemoSession has no callers in src (grep), DEMO_CREDENTIALS is empty (demo-auth.ts:89) — demo login effectively disabled; only the fallback reader remains.
- kv-store.ts hydrateKv calls GET /api/kv (src/lib/kv-store.ts:19), so a TENANT login would get 403 on hydration.

### Inferences
- kv is not a security boundary: any authenticated non-tenant user (GUEST, MAINTENANCE, EMPLOYEE included) can tamper with shared tenant UI state, including the kv audit-log cache. The authoritative audit log is the security_audit_logs table (read ADMIN_ROLES, write SUPER_ADMIN, delete nobody: db-policy.ts:65).

### Gaps
- Keys are not namespaced per user in kv.ts; which keys are per-user vs shared was not mapped.

## 3. JWT tenant_id and x-tenant-id header trust

### Takeaway
PARTIAL. JWT carries a tenant_id field but it can be null; the header is overridden only when the claim is non-empty. When null, the client-supplied x-tenant-id is trusted, and with no header a hardcoded default tenant is used. Also the generic /api/db proxy does not scope by tenant at all for staff.

### Cited Findings
- Login payload tenant_id = meta.tenant_id || (user as any).tenant_id || null — server/routes/auth.ts:69-78
- users Prisma model has no tenant_id column (id, email, role, raw_user_meta_data, created_at, updated_at), so the second fallback is always undefined — prisma/schema.prisma:3074-3090
- requireSession: if (claims.tenant_id) req.headers['x-tenant-id'] = claim — require-session.ts:216-217 (header trusted otherwise)
- tenantMiddleware: x-tenant-id header else default a0000000-0000-0000-0000-000000000001 — server/lib/middleware.ts:116-120; used by accounting.ts:11, finance.ts:8, masters.ts:8, procurement.ts:7, auth.ts:188
- kv.ts re-implements same header/default logic — kv.ts:230; CORS allows X-Tenant-Id — server/index.ts:42
- Generic /api/db query uses client-supplied where; tenant_id forced only for TENANT on maintenance_tickets (db.ts:213-216) and insert (db.ts:411); no other tenant scoping in db.ts.
- Tenant ticket scoping uses claims.tenant_id, which may be null/undefined (db.ts:214,411).

### Inferences
- Isolation depends on the claim being set; null-claim users can choose any tenant via header. Practically single-tenant today (default constant), so multi-tenant isolation is not enforced.
- Impersonation is client-side only (src/lib/auth-guards.ts:28-39), no server effect.

### Gaps
- DB contents not inspected (no DB access), so unknown whether real users have tenant_id in raw_user_meta_data.

## 4. users password hash exposure through /api/db

### Takeaway
CONFIRMED (limited to admins). The hash is stored in users.raw_user_meta_data (LongText JSON) and /api/db query returns whole rows with no field stripping. Read is restricted to ADMIN/SUPER_ADMIN, but those roles receive the bcrypt hash.

### Cited Findings
- Login reads meta.password_hash from JSON.parse(user.raw_user_meta_data) — server/routes/auth.ts:41-56; column at prisma/schema.prisma:3078; no dedicated password column
- Query handler returns findMany/findFirst results directly; no select/omit — server/routes/db.ts:203-247; buildIncludeFromSelect only builds relation includes
- No redaction code in server outside auth.ts (grep for password_hash|strip|omit|redact: no hits)
- users rule: read ADMIN_ROLES, write ADMIN_ROLES, delete SUPER_ADMIN — db-policy.ts:58
- Related: PATCH /api/auth/profile/:userId does profiles.updateMany with data: req.body, no role or ownership check — auth.ts:177-185. Any non-tenant authenticated user can change any profile, including role (profiles.role wins at login, auth.ts:67). Bypasses db-policy profiles write = ADMIN_ROLES. TENANT is blocked by tenantPolicy.
- GET /api/auth/profile/:userId returns any profile to any authenticated non-tenant user — auth.ts:166-175.

### Inferences
- Hash is not exposed to non-admins via /api/db, but admin API responses carry bcrypt hashes. The profile PATCH route is a privilege-escalation path.

### Gaps
- Did not check src for code that calls db.from users and renders fields.

## 5. Tenant portal routes in production and mock-data

### Takeaway
CONFIRMED. portal.* pages render from src/lib/mock-data.ts only, as does owner.statements; routes are reachable in production for TENANT/GUEST/ADMIN/SUPER_ADMIN with no env gating.

### Cited Findings
- /portal layout guarded by requireConsoleAccess("portal") — src/routes/portal.tsx:6-10; allowed roles TENANT, GUEST, SUPER_ADMIN, ADMIN — src/lib/rbac.ts:461
- No PROD/DEV env gating found in routes or demo-auth (grep).
- Mock imports: portal.bookings.tsx:11, portal.documents.tsx:8, portal.index.tsx:11 (tenantLease, tenantInvoices, tickets, pdcCheques), portal.lease.tsx:8, portal.payments.tsx:8, portal.tickets.tsx:11, owner.statements.tsx:5 (mockOwnerStatements)
- Only db use in portal: db.auth.getUser() for display name — portal.index.tsx:22, portal.settings.tsx:55; no db.from calls in portal.*.
- Client guard is fail-open: checkAccessWithTimeout returns true on 800ms timeout or error, and prefix shortcut — src/lib/auth-guards.ts:94-111 (relative to file listing; function checkAccessWithTimeout).
- Server exposes to TENANT only: leases GET, ticket insert/query (403 per Q1), auth session/notifications/permissions, listed masters — tenant-policy.ts:10-19.
- GET /api/auth/notifications filters by tenant_id and optional caller-chosen user_id, not by caller; /permissions returns all role_permissions of tenant — auth.ts:190-214 (both open to TENANT).

### Inferences
- In production the tenant portal is a demo UI showing the same sample lease/invoices to every user — data-honesty risk, not a leak.
- Client route guards are UX only; server enforces by role.

### Gaps
- Build config not checked for route stripping; owner.* route role guard not read beyond rbac.ts.

## 6. Server-side accounting period lock

### Takeaway
CONFIRMED server-enforced on the two posting paths, with fail-open edges (missing period row = open; period table and voucher tables writable via generic proxy by finance roles).

### Cited Findings
- postAccountingEvent (RPC post_accounting_event_atomic), inside the transaction: selects status from fin_posting_periods by year/month; if closed, throws HttpError 403 "Financial Period ... is closed for entries" — server/lib/finance-rpc.ts:178-187; RPC dispatched in server/routes/db.ts (fn === post_accounting_event_atomic)
- postManualVoucher repeats the check — finance-rpc.ts:520-525; called from accounting.ts (lines 664, 1045, 1081, 1120, 1151, 1202, 1229, 1263) and db.ts:72
- Table fin_posting_periods(id, period_name unique, year Text, month Int, status default Open) — prisma/schema.prisma:866-872
- Fail-open: if (period.length && status lower == closed) — no row means allowed (finance-rpc.ts:185, 523)
- Date used is posting_date ?? event_date (finance-rpc.ts:179).
- manualPdcStatusUpdate (finance-rpc.ts:330) has no period reference (grep of "period" in finance-rpc.ts matched only 179-185 and 520-523).
- fin_posting_periods and fin_vouchers fall under LEDGER_RULE: write FINANCE_ROLES incl. CASHIER (db-policy.ts:69-70,81), so via generic /api/db a cashier could reopen a period or insert voucher rows directly; the message says Contact Super-Admin but this is not enforced.
- Client also checks periods (grep hits in src/lib/finance/posting-engine.ts, db-finance.ts) but the server does not rely on it.

### Inferences
- Lock is real server-side for event posting and manual vouchers. Weak points: absent period rows, writable period table, direct fin_* inserts through /api/db, and PDC status path.

### Gaps
- Not verified whether manualPdcStatusUpdate posts via postAccountingEvent (would inherit the check); client posting-engine not examined in detail.
