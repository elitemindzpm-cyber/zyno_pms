# ZYNO PMS: consolidated issue register

**Scope:** this repo plus a read-only inspection of `pms_db` (MariaDB 10.5.27) on 2026-11-28. Static code review; nothing was written to the database.
**Supersedes:** `ZYNO schema and data handling audit.md`, `... audit 2.md` and `ZYNO live database verification.md`. Detail and line references live in the notes under `research_notes/`.
**Status key:** `LIVE` = confirmed against the live database. `CODE` = confirmed by reading code. `INFERRED` = deduced, not run.

## 1. Executive summary

Update and fetch failures come from three layers that compound each other:

1. **Data handling (biggest cause).** The generic proxy (`server/routes/db.ts`) and the client shim (`src/lib/db.ts`) hide or distort failures. Many "successes" are silent no-ops.
2. **Schema.** Mismatched id types (BigInt vs UUID), missing id defaults, untracked hand-run SQL, and UI columns that do not exist in the tables. These cause the repeatable, loud failures and the silent NULLs.
3. **Architecture.** Business data split between real tables and about 70 JSON blobs in `app_kv_store`, calculations done in the browser, several write paths with different validation, and weak tenant and role enforcement.

Separate from the data bugs, there is one serious security hole (any logged-in non-tenant user can make themselves SUPER_ADMIN). Fix it first.

Current data volume is small: 2 leases, 24 PDCs, 47 vouchers, 339 customers, 15 kv blobs, 2 users. Fixing now is cheap.

---

## 2. Issue register

Priority: **P0** = security or data-loss now. **P1** = repeatable failures. **P2** = integrity. **P3** = structural.

### A. Security and access control

| ID | Pri | Issue | Evidence | Status | Fix |
|---|---|---|---|---|---|
| A1 | P0 | **Role escalation.** `PATCH /api/auth/profile/:userId` runs `profiles.updateMany` with `data: req.body`, no role or ownership check. The profile role wins at login, so any logged-in non-tenant user (GUEST, EMPLOYEE, MAINTENANCE ...) can set any user to SUPER_ADMIN. `GET` on the same route returns any profile. | `server/routes/auth.ts:166-185`, `:67` | CODE | Require self-or-admin, whitelist editable fields (never `role`), then audit current `profiles.role` values. Live now: only ADMIN x1, SUPER_ADMIN x1. |
| A2 | P0 | **Password hash exposed.** The bcrypt hash sits in `users.raw_user_meta_data`; `/api/db` returns whole rows with no field stripping, to ADMIN and SUPER_ADMIN. | `auth.ts:41-56`, `db.ts:203-247`, `db-policy.ts:58` | CODE | Move the hash to a dedicated column and never select it. Strip sensitive fields in the proxy. |
| A3 | P0 | **`/api/kv` has no role or key checks.** Any logged-in non-tenant role can read, write or delete every key of the tenant, including the demo-session key and the audit-log cache. | `server/routes/kv.ts:233-266` | CODE | Key allowlist plus per-key role rules. Stop holding audit logs and security flags in kv. |
| A4 | P0 | **Public DB port and shared credential.** The database password was shared in chat and port 3307 is reachable on a public IP. | live probe | LIVE | Rotate the password, restrict the port to the app server, and use a least-privilege user. |
| A5 | P1 | **Tenant id is spoofable.** `tenant_id` in the JWT is null for every user (0 of 2 have it in metadata and the `users` model has no column). The server then trusts the client `x-tenant-id` header or a hard-coded default tenant. The proxy never filters by tenant for staff, and only 13 models have `tenant_id`. | `auth.ts:69-78`, `require-session.ts:216-217`, `middleware.ts:116-120`, `kv.ts:230` | LIVE+CODE | Derive tenant only from the session, store it in a real column, and add a tenant filter in the proxy. |
| A6 | P1 | **Ledger controls reachable from the proxy.** `fin_posting_periods` and `fin_vouchers` fall under `LEDGER_RULE`, which includes CASHIER. A cashier can reopen a period or insert vouchers through `/api/db`. Unprefixed money tables (`ar_ledgers`, `payments`, `receipts`, `journal_entries`, `pdcs`) fall under the broad staff rule. No table allowlist exists. | `db-policy.ts:62-84` | CODE | Tighten the rules, add an allowlist, and move period and voucher writes behind the accounting routes only. |
| A7 | P1 | **Period locks effectively off.** The server checks `fin_posting_periods` on event and manual-voucher posting, but the table has 0 rows while 47 vouchers are posted, and a missing row means open. `manualPdcStatusUpdate` has no period check (not traced). | `finance-rpc.ts:178-187, 330, 520-525` | LIVE+CODE | Seed periods, default to closed when none exists, and add the check to PDC status changes. |
| A8 | P1 | **TENANT role gets 403 on tickets.** `tenantPolicy` allows `maintenance_tickets` but `dbAllowed` excludes TENANT. The tenant-scoping code is unreachable. | `tenant-policy.ts:14`, `db-policy.ts:47-48,77-84`, `db.ts:133-147,213-216,408-416` | CODE | Add the tenant exception in `dbAllowed`, or remove the dead branches. |
| A9 | P1 | **Mock-data portal.** `portal.*` pages and `owner.statements` render only from `mock-data.ts` and are reachable in production, so real tenants see fake data. The route guard fails open on an 800 ms timeout. | `portal.index.tsx:11`, `owner.statements.tsx:5`, `rbac.ts:461`, `auth-guards.ts:94-111` | CODE | Build real queries or hide the routes. Make the guard fail closed. |
| A10 | P2 | Client honours a `zyno-demo-session` kv key that any user can write. The server still enforces the JWT, so this is client-only spoofing. | `auth-guards.ts:75-83`, `leasing-module.tsx:898-900` | CODE | Remove the kv-based demo and role fallback. |
| A11 | P2 | Tenant users can read notifications by a caller-chosen `user_id` and all `role_permissions`. The 25 MB JSON limit applies before `requireSession`. Raw `e.message` is returned to clients on early accounting routes. Finance `/events`, `/vouchers`, `/coa` and `/compliance` skip `dbAllowed`. | `auth.ts:190-214`, `server/index.ts:46,66`, `accounting.ts:14-65,1331-1336` | CODE | Scope by caller, lower the limit before auth, sanitise errors, add role checks. |

### B. Data handling (proxy and client shim)

| ID | Pri | Issue | Evidence | Status | Fix |
|---|---|---|---|---|---|
| B1 | P0 | **Unguarded bulk writes.** `update` and `delete` run `updateMany` and `deleteMany` with whatever `where` the client sent, even an empty one. A zero-row update reports success. | `db.ts:456-472, 495-511` | CODE | Reject empty or non-key filters, treat zero matches as an error. |
| B2 | P0 | **Lossy filters.** The query builder keeps one filter per column, so `.gte().lte()` or two `.in()` calls leave only the last. `.contains`, `.overlaps`, `.is` and `.not(col, op, v)` degrade to equality or `{not: value}`. | `src/lib/db.ts`, `db.ts` | CODE | Compose filters with AND and implement the operators properly. |
| B3 | P1 | **Alias joins dropped.** `properties:property_id(...)` is parsed as relation `property_id` (a scalar), skipped, and rows come back without `properties` or `customers`. About 62 such selects exist. (The client shim was not read, so end-to-end behaviour is not fully proven.) | `coerce.ts:94-106`, `useLeases.ts:27-55`, `app-data-context.tsx` | CODE | Map `alias:fk(...)` to the real relation, or use unaliased relation names. |
| B4 | P1 | **Update returns `{count}`, not the row.** `.update().eq().select().single()` receives `{count:1}` as its "row". | `useUpdateLease` and others | CODE | Return the updated row. |
| B5 | P1 | **Errors swallowed.** The shim never throws and resolves `{error}`. A read on an unknown table returns empty with no error. `fetchAllRows` stops on the first error and returns a partial list, and pages with `.range()` without `ORDER BY`. About 96 empty catch handlers. | `app-data-context.tsx:302-321` | CODE | Surface errors, add a stable order, and fail loudly. |
| B6 | P1 | **No default `take` and `count` is the page length.** Several finance reports silently truncate at fixed caps: 100,000 (cash flow), 20,000 (GL), 5,000 (journals, AR/AP lists). | `accounting.ts:635,698,961-966,1020,1099` | CODE | Paginate and return true totals with a truncation flag. |
| B7 | P1 | **Coercion covers filters, not writes.** Numeric-string ids convert only in `where`. Empty string becomes NULL only for optional String columns, so empty Int, Decimal and Date values still error. | `coerce.ts` | CODE | Coerce on writes using the Prisma metadata. |
| B8 | P1 | **Raw-SQL tables get no coercion.** Tables created only by manual SQL (`fin_ar_invoices`, `fin_ap_invoices`, `fin_legal_cases`, `fin_payroll_runs`, `fin_bank_clearances`, `fin_bank_recon_records`, `fin_recon_statements`, `app_kv_store`, `app_sequences`) are not in `schema.prisma`. | `coerce.ts`, `accounting.ts:990-1043` | LIVE+CODE | Add them to the schema (see C7). |
| B9 | P1 | **Broken endpoints.** `/general-ledger` date regexes lack backslashes (`/^d{4}-d{2}-d{2}$/`), so `from` and `to` are always null and the date filter never applies. `/vouchers` filters `fin_vouchers` by a `tenant_id` column that does not exist (live: confirmed missing). | `accounting.ts:607-608, 45-49` | LIVE+CODE | Reuse `isoDate` (`:718`) and drop the tenant filter or add the column. |
| B10 | P2 | The dedicated REST routes in `api-client.ts` are mostly unused and return different response shapes from the proxy. Property routes pass `req.body` straight to Prisma. `limit=abc` and `limit=0` are not handled in `parsePagination`. | `server/routes/properties.ts`, `parsePagination` | CODE | Retire duplicate layers, validate input. |
| B11 | P2 | **Money rounding inconsistent.** Storage keeps 4 decimals, `money()` rounds to 2. Many money columns are nullable. | `finance-rpc.ts:10` | CODE | One rounding policy, `NOT NULL DEFAULT 0` on money columns. |

### C. Schema

| ID | Pri | Issue | Evidence | Status | Fix |
|---|---|---|---|---|---|
| C1 | P0 | **BigInt vs UUID on the cheque register.** `fin_pdc_register.tenant_id/property_id/unit_id` are `bigint`, while leases, units, properties and customers use `varchar(36)`. All 24 PDC rows have NULL tenant, property and unit ids, because `numericOrNull` silently drops UUIDs on write. `fin_pdc_register` filtered by `tenant_id` also mismatches. | `schema.prisma:847-864`, `services/leases.ts:47,70-76`, `routes/finance.ts:16` | LIVE | Convert to `varchar(36)`, backfill from `leases`, delete the drop path. |
| C2 | P0 | **`fin_legal_receivables`** has `tenant_id bigint NOT NULL` and bigint refs, so a UUID tenant cannot be stored. Table is empty. | `schema.prisma:796-809` | LIVE | Convert to `varchar(36)` before first use. |
| C3 | P1 | **`fin_pdc_register.id` has no autoincrement.** Ids come from `app_sequences` (value 111 vs 24 rows, so they already disagree). It is the only `fin_*` id still without a default. | `leases.ts:42-44` | LIVE | Add auto_increment and retire the sequence. |
| C4 | P1 | **26 `mst_*` lookup tables have no id default** (15 int, 11 varchar). Inserts without an explicit id fail. Only 8 `app_sequences` rows exist to support them. | `schema.prisma:1798-1949` | LIVE | Auto-increment for int ids, or generate ids in code. |
| C5 | P1 | **UI columns that do not exist (drift).** `leases`: `tenant_name`, `status`, `host_id`, `tenant_id`, `has_rent_free*`. `units`: `unit_status`, `current_tenant`. `customers`: `name`. `fin_pdc_register`: `tenant_name`, `drawer_name`, `pdc_type`, `updated_at`. `pdcs`: `cheque_date`, `cheque_no`, `drawer_name`, `updated_at`. `fin_vouchers`: `approval_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `narration`, `origin_module`, `voucher_no`. `fin_voucher_lines`: `debit`/`credit` (live has `debit_amount`/`credit_amount`). `reservations`: `agent`, `isHold`, `remarks`, `token*`. Using these in filters, orders or writes returns an error. | `leasing-module.tsx:1398-1401,3459,4073`, `finance-store.tsx:1828-1829`, `voucher-approval-service.ts:108-124`, `financial-gatekeeper.ts:49,126`, `usePdcs.ts:47`, `leases-module.tsx:451`, `src/lib/db.ts:1195,1239,1291` | LIVE+CODE | Decide per column: add it to the table or remove it from the UI. The voucher-approval feature was built against a schema that does not exist. |
| C6 | P1 | **No migration tracking.** No `_prisma_migrations` table. 16 manual SQL files, none referenced by scripts or startup. Two are not safe to re-run (`2026-11-24-pdc-unify.sql`, `2026-11-24-unique-constraints.sql`). Some use MariaDB-only `ADD COLUMN IF NOT EXISTS`. The hand-added columns on `fin_bank_accounts`, `fin_banks`, `leases`, `units` and `fin_deposits` do exist live, so those files were applied. | `prisma/manual-migrations/` | LIVE | Adopt tracked migrations after `prisma db pull`. |
| C7 | P1 | **Tables with no definition in the repo.** `app_kv_store` (PK tenant_id,k; v longtext) and `app_sequences` (PK name) exist live but have no DDL anywhere. A database rebuilt from the repo would break `/api/kv` and all sequence ids. The other manual-SQL tables (see B8) are also missing from `schema.prisma`. | live `information_schema` | LIVE | Commit DDL and add them to the Prisma schema. |
| C8 | P2 | **Constraint gaps.** `fin_accounting_event_lines` has two identical unique indexes on `(event_id, line_number)`. Unique constraints exist that Prisma push would drop (manual-only). Uniques over nullable columns never collide (`units(property_id, unit_number)`). Overlapping uniques on `fin_transaction_account_rules` and `fin_account_mappings`. | `schema.prisma:626-627,895-896,598-600` | LIVE+CODE | Clean up, and use the required `unit_ref` for unit uniqueness. |
| C9 | P2 | **Missing foreign keys and indexes.** `leases.unit_id` has no relation. Tenant, lease and unit columns on `fin_voucher_lines`, `fin_accounting_events`, `fin_deposits`, `fin_payment_allocations` have no FK. Hand-appended models (`ar_ledgers`, `payments`, `receipts`, `rent_schedules`, `journal_entries`) have neither FKs nor indexes. `fin_coa_accounts` has two parent columns (`parent_id`, `parent_account_id`). | `schema.prisma:3332+` | CODE | Add FKs and indexes. |
| C10 | P2 | **Statuses are free text, mixed case** (`In Hand`, `Deposited`, `Cleared`, `ACTIVE`, `DRAFT`, `draft`, `open`, `Held`). Only 22 enums exist. `.in()` on a text status column once silently matched nothing. | `coerce.ts:48-50` | LIVE+CODE | Normalise statuses and add enums or check constraints. |
| C11 | P2 | **Duplicate parallel tables.** `customers` (339 rows) vs `fin_customers` (0); `pdcs` (0) vs `fin_pdc_register` (24); `fin_legal_receivables` vs `fin_legal_cases`; `fin_payroll_syncs` vs `fin_payroll_runs`; receipts in `receipts`, `collection_receipts`, `fin_transaction_receipts` (47); chart of accounts in `coa_*` and `fin_coa_accounts`. `erp_chart_of_accounts_backup_20260823` still sits in the live schema. | `schema.prisma:514` | LIVE | Pick one table per concept, drop the empty twins and the backup. |
| C12 | P3 | Stale PostgreSQL comments remain, and `tenant_id` means different things in different tables (organisation id vs renter id). | `maintenance-module.tsx:469`, `assets-module.tsx:403` | CODE | Clean up and document. |

### D. Finance and posting integrity

| ID | Pri | Issue | Evidence | Status | Fix |
|---|---|---|---|---|---|
| D1 | P1 | **Voucher-then-register is not atomic.** AR/AP create, collect, pay, legal-case and payroll-run post the voucher first, then write the register row separately. A failure leaves a ledger entry with no invoice. `/ar-invoices` POST loops with no outer transaction. | `accounting.ts:1045-1058,1080-1087,1120-1130,1150-1157,1202-1271` | CODE | One transaction per flow. |
| D2 | P1 | **Races and idempotency.** AR collect checks status, posts, then updates with no lock. The manual-voucher idempotency key includes the date, so a repeat on another date posts again. Collect and pay always settle the full remainder, with no partial payments. | `finance-rpc.ts:530-533` | CODE | Row locks, date-free keys, partial-payment path. |
| D3 | P1 | **Payroll.** `runPayrollCycle` commits the cycle as Processed, then posts the GL journal outside the transaction. A failed post blocks a rerun (409) and leaves no voucher. The payroll route trusts a client `total_amount` and falls back to account 51101001. | `hr.ts:25-27,41-119`, `accounting.ts:1256-1271` | CODE | Post inside the transaction, validate totals server-side. |
| D4 | P2 | **Procurement.** `approvePayableInvoice`, `matchPayableInvoice` and `allocateLandedCost` run without a transaction. `allocateLandedCost` has no idempotency and can insert duplicate rows. AP approval ignores `approverUserId`, so there is no approval-limit check. | `procurement.ts:95-136,177-182` | CODE | Add transactions, an idempotency key and the approval check. |
| D5 | P2 | The generic `update` does not block edits to ledger line tables, while `delete` guards posted vouchers and events. Voucher idempotency is a client-side check-then-insert. | `voucher-persist.ts:11-27` | CODE | Block edits to posted lines, enforce uniqueness in the DB. |
| D6 | P2 | **Report logic.** The balance sheet reports any unclassified asset code as bank/cash. The trial balance rolls any code longer than 5 characters up to its first 5. Trial-balance logic is duplicated in the browser and the server. | `accounting.ts:747,853`, `finance-store.tsx:2686-2740`, `server/services/finance.ts:11-34` | CODE | One server-side implementation. |
| D7 | P2 | **VAT has no single definition.** Invoice and proforma dialogs hard-code 0%. The only rate selector is a 0/5% dropdown in maintenance vendor invoices. The server posts gross with no tax line. Five conflicting VAT account code sets: 13200/22200 (`finance-store.tsx`), 12600001/21600001 (`account-resolver.ts`), 12800001 (`proforma-invoice-dialog.tsx`), 12500 (`procurement/postingService.ts`), 21300001 (`maintenance-module.tsx`). | see file list | CODE | One rate source and one VAT account set. |
| D8 | P2 | **Ageing is computed twice, differently, in the browser only.** The AR/AP ageing report buckets by due date against a chosen as-of date. The customer statement buckets by document date against today. The same customer shows different buckets. No server endpoint exists. | `ar-ap-aging-report.tsx:154-167`, `customer-statement-submodule.tsx:759-790` | CODE | One SQL-backed ageing endpoint. |

### E. Data and calculations held in the browser

Browser storage itself is not the problem. `localStorage` is wiped on load (`__root.tsx:122-129`), and `kv-store.ts` is an in-memory map syncing to `/api/kv` (table `app_kv_store`). The problem is business data held as untyped blobs, and logic running in the client.

| ID | Pri | Issue | Evidence | Status | Fix |
|---|---|---|---|---|---|
| E1 | P1 | **Lease state lives in kv blobs, merged over DB rows at render.** `pms_custom_lease_overrides`, `pms_renewed_leases_v1`, `pms_leasing_v2_leases`, `pms_deleted_leases_v1` (live, all updated 2026-11-27). The `leases` table has only 2 rows. The contract printout also reads the overrides. | `leases-module.tsx:595-720`, `qatar-lease-contract.ts:459-463` | LIVE+CODE | Move into `leases` columns and related tables. |
| E2 | P1 | **Cheque, voucher and finance state in blobs.** `pms_renewal_pdcs` is merged into the cheque register. Vouchers and AP in `finance_master_v1-vouchers` and `-ap`. Payroll voucher copy. Custom chart-of-accounts entries (`fin_custom_coa_accounts_v1`). Bank-account overrides (`pms_fin_bank_accounts_override_v2`) and voucher date corrections (`pms_voucher_date_corrections`) are live. | `app-data-context.tsx:731`, `finance-module.tsx:7840,1995-2155`, `finance-store.tsx:1109,2092`, `payrollIntegrationService.ts:167-197` | LIVE+CODE | Move into the real finance tables. |
| E3 | P1 | **Procurement, maintenance and HR records have no tables.** AP invoices and receipts, vendor invoices, work orders, tickets, technicians, stock, PPM schedules. Payslips and cycles are kept in a kv overlay "even if DB insert fails". Settlement and checkout cases. `purge-legacy-test-data.ts` states work orders and AP invoices have no DB tables. | `proc-invoices-api.ts:72-101`, `hrmsService.ts:1269`, `leasing-module.tsx:1903,1945` | CODE | Create tables (procurement notes are a good start). |
| E4 | P1 | **Whole-blob read-modify-write.** Concurrent edits overwrite each other (last write wins). The cache hydrates once, so other users' changes only appear after reload. Saves are fire-and-forget and a failure only logs to the console. One live blob is 4.17 MB (`zyno_pms_import_batches_history_v2`) and is rewritten on every save. | `kv-store.ts:10-13`, `leasing-module.tsx:2170`, `leases-module.tsx:211-238` | LIVE+CODE | Real rows with version columns, optimistic locking, surfaced save errors. |
| E5 | P1 | **Browser-side calculations.** Trial balance (`finance-store.tsx:2686-2740`), settlement and deposit logic (`settlement-engine.ts`, `depositService.ts`), reconciliations (`financial-reconciliation.ts`), invoice, late-fee and credit-note posting (`revenue-billing-engine.ts`), gratuity (`hrmsService.ts:823-866`), payroll totals, EOSB clearance, WPS SIF/CSV (`qatar-wps-sif.ts`), ageing and statements. `normalizeQatarId` has a `fallbackSeed` that can fabricate an ID. Posting itself is partly server-authoritative (`post_accounting_event_atomic`, `/api/accounting/post-voucher`). | listed files | CODE | Move money and compliance calculations to the server. Keep rendering and PDF output client-side. |
| E6 | P2 | The audit log is held in kv and is deletable from the client (`security.ts:45-123`). The real `security_audit_logs` table is write-protected. | `db-policy.ts:65` | CODE | Write audit events only to the table. |
| E7 | P3 | **Benign:** in-memory cache, document branding, Excel import history, the localStorage wipe, PDF/HTML rendering and date formatting. | | CODE | No action. |

---

## 3. Recommended fix order

**Step 1: immediate (hours).**
- A1 profile role escalation. Check `profiles.role` values for tampering.
- A2 password hash. A3 kv access. A4 rotate the DB password and restrict the port.
- B9 General Ledger regex.

**Step 2: stop silent failures (days).**
- B1, B2, B4, B5 proxy and shim: reject empty filters, compose filters, return rows, surface errors.
- B3 alias joins.
- A8 tenant 403.

**Step 3: schema repair (1 to 2 weeks).** Take a backup first.
- C1 and C2 convert the id columns to `varchar(36)` and backfill from `leases`.
- C3 autoincrement for `fin_pdc_register`.
- C4 id defaults on the 26 `mst_*` tables.
- C5 column drift, one table at a time (leases, fin_vouchers, fin_pdc_register, reservations).
- C6 and C7 commit the DDL, add the missing tables to the Prisma schema, and start tracked migrations.
- A7 seed `fin_posting_periods`.

**Step 4: integrity (weeks).** D1 to D8, C8 to C11, A5, A6, A9 to A11, B6, B7, B10, B11.

**Step 5: structural (staged).** E1 to E6: move the kv blobs into tables, starting with leases and cheques, then vouchers, payroll, AP and procurement. Serve the trial balance and settlements from SQL.

## 4. Still unverified

- **`src/lib/db.ts`:** not read in full, so B3 and the filter composition (B2) are confirmed on the server side only.
- **`manualPdcStatusUpdate`:** whether it posts through `postAccountingEvent` and inherits the period check.
- **Per-key kv ownership:** which keys are per user and which are shared.
- **Column drift scan:** a heuristic sample, not exhaustive. The reverse direction (model columns the UI never uses) was not checked.
- **`/vouchers` tenant filter:** failure is inferred from the missing column (the column is confirmed missing live) and was not executed.
- **Live data checks not run:** orphan checks (vouchers with no register row), duplicates between kv blobs and tables, and cheque rows whose lease_id no longer resolves.
