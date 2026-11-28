# Verification round confirms ZYNO's data failures and security gaps

ZYNO's failed updates and reads come from three layers that compound each other. The generic proxy and shim lose or hide errors. The schema carries ID-type and column drift, and it is patched by hand-run SQL that nothing tracks. Much business data and calculation also lives outside relational tables. This round resolved every item the first audit left "not verified". **Confirmed:** the tenant-role 403 on `maintenance_tickets`, open `/api/kv` access, password hashes returned to admins, mock-only tenant portal pages, server-enforced period locks with fail-open edges, VAT and ageing inconsistencies, and alias selects being dropped. **Reconciled:** the database is MySQL/MariaDB throughout. **New and serious:** any authenticated non-tenant user can change any profile's role through `PATCH /api/auth/profile/:userId`, and the General Ledger date filter never works because of a regex typo. Four things stay unverifiable from the repo: real column types, which migrations ran, and the DDL of `app_kv_store` and `app_sequences`. All findings come from static reading of this repo. Nothing was run and no database was contacted. Citations are repo paths with line numbers, written as `path:line`.

## Verdicts on the items previously left unverified

| Item | Verdict | Evidence |
|---|---|---|
| TENANT role gets 403 on `maintenance_tickets` | **Confirmed** | `tenantPolicy` allows the route (`server/lib/tenant-policy.ts:14`), then `dbAllowed` applies `OPERATIONS_RULE`, whose roles are `STAFF_ROLES` without `TENANT` (`server/lib/db-policy.ts:47-48, 77-84`; `server/routes/db.ts:133-147`). The tenant-scoped query and insert branches (`db.ts:213-216, 408-416`) are unreachable. |
| `/api/kv` access control | **Confirmed, no role or key check** | GET, PUT and DELETE only need a valid session (`server/routes/kv.ts:233-266`). Only `tenantPolicy` blocks TENANT. Any other role, including GUEST, MAINTENANCE and EMPLOYEE, can overwrite every key. |
| JWT carries `tenant_id` | **Partial** | The claim is `meta.tenant_id \|\| user.tenant_id \|\| null` (`server/routes/auth.ts:69-78`), but the `users` model has no `tenant_id` column (`prisma/schema.prisma:3074-3090`). `requireSession` overwrites the header only when the claim is non-empty (`server/lib/require-session.ts:216-217`). Otherwise the client header, then a hard-coded default tenant, is used (`server/lib/middleware.ts:116-120`). |
| `users` password hash exposure | **Confirmed, admins only** | The bcrypt hash sits in `users.raw_user_meta_data` (`auth.ts:41-56`). `/api/db` query returns whole rows with no stripping (`db.ts:203-247`). Read is limited to ADMIN and SUPER_ADMIN (`db-policy.ts:58`), and those roles receive the hash. |
| Portal mock data | **Confirmed** | The `portal.*` pages and `owner.statements.tsx` render from `src/lib/mock-data.ts` (for example `portal.index.tsx:11`, `owner.statements.tsx:5`). The only DB call is `db.auth.getUser()` for the display name. The routes are reachable by TENANT, GUEST, ADMIN and SUPER_ADMIN with no environment gating (`src/lib/rbac.ts:461`). The client guard fails open on an 800 ms timeout (`src/lib/auth-guards.ts:94-111`). |
| Server-side period lock | **Confirmed on two paths, fail-open edges** | `postAccountingEvent` and `postManualVoucher` check `fin_posting_periods` inside the transaction and throw 403 on a closed period (`server/lib/finance-rpc.ts:178-187, 520-525`). A missing period row means open (`:185, 523`). `manualPdcStatusUpdate` (`:330`) has no period reference. |
| `app_kv_store` and `app_sequences` DDL | **Unverifiable from the repo** | No file defines or creates either table, and no model, baseline DDL or startup code mentions them. They exist only in the live DB. The 2026-11-25 backup shows `app_kv_store` with 33 rows and columns `k, tenant_id, updated_at, v`, and `app_sequences` with 3 rows (`customer_code`, `fin_pdc_register_id`, `fin_unit_sl_seq`). The `ON DUPLICATE KEY` upserts imply keys on `(tenant_id, k)` and `name` (`kv.ts:13-39`; `finance-rpc.ts:16-18`). |
| Migration tracking | **None exists** | The 16 files in `prisma/manual-migrations` are referenced by no script, README or startup code (`package.json:18-20`). Only `2026-11-23-features.sql:2` says "Applied". |
| DB provider | **Reconciled: MySQL/MariaDB** | `prisma/schema.prisma:5-7`, `server/lib/prisma.ts:4-14`, MySQL-syntax raw SQL, and a baseline that names MariaDB 10.5+/MySQL 8+ (`scripts/01_pms_mariadb_schema.sql:1-4`). `ADD COLUMN IF NOT EXISTS` suggests MariaDB. Stale PostgreSQL comments remain in two components (`maintenance-module.tsx:469`, `assets-module.tsx:403`). |
| Models after `schema.prisma:3332` | **No insert-breaking gap** | Every model has `@id`/`@@id`. `pms_app_state` has no default (`:3452-3456`), which is fine for a caller-supplied key. The only transactional BigInt key without a default is `fin_pdc_register` (`:847`). |
| `accounting.ts`, `hr.ts`, `procurement.ts` | **Reviewed** | No SQL injection: raw SQL uses tagged templates, and the one `$queryRawUnsafe` uses `?` placeholders (`finance-rpc.ts:512-515`). The weaknesses are non-atomic flows, missing tenant scoping and a regex bug (next sections). |
| VAT | **Not one rate; five GL codes** | See the section below. |
| Ageing | **Two incompatible client implementations; no server endpoint** | See the section below. |
| Column drift | **Confirmed**, listed below | |
| Alias selects | **Confirmed dropped** | `buildIncludeFromSelect` matches the identifier before `(`, so `properties:property_id(...)` yields `property_id`, a scalar, and is skipped (`server/lib/coerce.ts:94-106`). Returned lease rows have no `properties` or `customers` key (`src/hooks/queries/useLeases.ts:27-55`). One caveat: the client shim (`src/lib/db.ts:35-163`) was not read and might rewrite the string first. |

The kv result strengthens the earlier conclusion. kv is not a security boundary, and the real audit log is the `security_audit_logs` table, which only SUPER_ADMIN can write and nobody can delete (`db-policy.ts:65`). The kv audit cache is a deletable copy. The demo-session path is mostly dead: `DEMO_CREDENTIALS` is empty and `setDemoSession` has no callers (`src/lib/demo-auth.ts:89`). The client still honours a `zyno-demo-session` key that any user can write (`auth-guards.ts:75-83`), but the server still enforces the JWT role. Impersonation is client-only with no server effect (`auth-guards.ts:28-39`). Tenant isolation is not enforced. The `x-tenant-id` header is trusted whenever the JWT claim is null, the generic proxy never scopes by tenant for staff, and only 13 models have `tenant_id`. Because one tenant exists today, this is a latent risk and not a current failure.

## New findings that change the risk picture

**Privilege escalation through the profile route.** `PATCH /api/auth/profile/:userId` runs `profiles.updateMany` with `data: req.body` and no role or ownership check (`server/routes/auth.ts:177-185`). The profile role wins at login (`auth.ts:67`), so any authenticated non-tenant user, including GUEST, MAINTENANCE and EMPLOYEE, can set any user's role to SUPER_ADMIN. This bypasses the `profiles` write rule of ADMIN_ROLES in `db-policy.ts`. `GET /api/auth/profile/:userId` likewise returns any profile to any such user (`auth.ts:166-175`). The first audit had not found this. It is the top fix.

**The General Ledger date filter is dead.** The `/general-ledger` handler writes its date regexes without backslashes, as `/^d{4}-d{2}-d{2}$/` (`server/routes/accounting.ts:607-608`). They match only the literal text "dddd-dd-dd", so `from` and `to` are always null and the filter is ignored. The correct `isoDate` helper already exists at `:718`. The report also silently caps at 20,000 rows (`:635`).

**Broken or leaking endpoints.** `/vouchers` filters `fin_vouchers` by `tenant_id`, but that model has no such column (`accounting.ts:45-49`), so Prisma should reject it (inferred, not run). `/coa` has no tenant filter. `/events`, `/vouchers` and `/coa` GETs skip `dbAllowed` (`:14-65`). `/compliance` has no role check (`:1331-1336`). Early routes return raw `e.message` to clients (`:26, 39, 53, 64, 356, 1335`). Only the COA, unit-ledger and bank-account endpoints use a transaction (`:114, 393, 522`). Besides these, every other endpoint is global across tenants.

**Non-atomic money flows.** AR and AP create, collect, pay, legal-case and payroll-run endpoints post the voucher first and then write the register row (`accounting.ts:1045-1058, 1120-1130, 1080-1087, 1150-1157, 1202-1271`). A failed second step leaves a ledger entry with no invoice. The idempotency key `MANUAL|type|reference|date` allows a safe retry but not a repeat on another date (`finance-rpc.ts:530-533`). Collect and pay always settle the full remainder, with no partial-payment path. The `/ar-invoices` POST loops with no outer transaction, so a mid-loop 400 leaves earlier invoices created (`:1033-1060`). In HR, `runPayrollCycle` commits the cycle as Processed and then posts the GL journal outside the transaction (`server/services/hr.ts:41-119`), so a failed post blocks a rerun through the 409 at `hr.ts:25-27` and leaves no voucher. Procurement has three similar gaps. `matchPayableInvoice` and `approvePayableInvoice` run without a transaction. `allocateLandedCost` has no idempotency and can insert duplicate rows. AP approval accepts `approverUserId` but ignores it (`procurement.ts:95-136, 177-182`), so there is no approval-limit check. Payroll runs trust a client `total_amount` and fall back to account 51101001 for unknown codes (`accounting.ts:1256-1271`).

**Ledger controls reachable through the proxy.** `fin_posting_periods` and `fin_vouchers` fall under `LEDGER_RULE`, which includes CASHIER (`db-policy.ts:69-70, 81`). A cashier can reopen a period or insert voucher rows directly through `/api/db`, so the "contact Super-Admin" message is not enforced. Unprefixed financial tables such as `ar_ledgers`, `payments` and `pdcs` fall under the broad staff rule.

**Other defects.** Reports silently truncate at fixed caps: 100,000 lines for cash flow, 20,000 for the GL, 5,000 for journals and AR/AP lists (`accounting.ts:961-966, 635, 698, 1020, 1099`). The balance sheet reports any unclassified asset code as bank/cash (`:853`). The trial balance rolls any code longer than 5 characters up to its first 5, which assumes a 5-digit GL convention (`:747`). A tenant user can read notifications by a caller-chosen `user_id` and all `role_permissions` of the tenant (`auth.ts:190-214`). The 25 MB JSON limit is applied before `requireSession` (`server/index.ts:46` against `:66`).

## Column drift, VAT and ageing

**Column drift (UI uses a column that the Prisma model lacks).** Filters, orders and writes with such a column fail with a generic 400. A wrong column in `.select()` does not fail, because the proxy ignores the select list. The list below comes from a heuristic scan with each hit verified by reading the line. It is not exhaustive.

| Table | UI columns not in the model | Where |
|---|---|---|
| `leases` | `tenant_name`, `tenantName`, `status` (model uses `lease_status`), `host_id`, `tenant_id`, `has_rent_free`, `rent_free_period_days`, `rent_free_position` | `leasing-module.tsx:1400, 4073`; `finance-store.tsx:1829`; `src/lib/db.ts:1195`; `financial-gatekeeper.ts:49`; `leases-module.tsx:451` |
| `units` | `unit_status` (model: `status`), `current_tenant`, `unit_number` as a filter | `super-admin.analytics.tsx:58`; `leasing-module.tsx:1401, 4074` |
| `customers` | `name` (model has `full_name`, `display_name`) | `finance-store.tsx:1828`; `leasing-module.tsx:1400` |
| `fin_pdc_register` | `tenant_name`, `drawer_name`, `pdc_type`, `updated_at` | `leasing-module.tsx:1398`; `financial-gatekeeper.ts:126`; `usePdcs.ts:47` |
| `pdcs` | `cheque_date`, `cheque_no`, `drawer_name`, `updated_at`, plus a join to `leases.tenant_name` | `leasing-module.tsx:972, 3266, 1399`; `src/lib/db.ts:1239, 1291` |
| `fin_vouchers` | `approval_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `narration`, `origin_module`, `voucher_no` (model: `voucher_number`) | `voucher-approval-service.ts:108-124`; `voucher-approval-modal.tsx:33` |
| `fin_voucher_lines` | `debit`, `credit` in the client, while server SQL uses `debit_amount`/`credit_amount` | `settlement-engine.ts:817`; `accounting.ts:619-620, 730-731` |
| `reservations` | `agent`, `isHold`, `remarks`, `tokenAmount`, `tokenPaymentMode`, `tokenReceiptNo` | `leasing-module.tsx:3459` |

`fin_deposits`, `maintenance_tickets` and `properties` showed no drift in the sampled usage. The voucher-approval feature looks built against a different schema, so its writes fail unless the live database differs from `schema.prisma`. That is a question for the database. Two parallel PDC tables with different columns (`pdcs` with bank text, `fin_pdc_register` with `bank_id`) make the cheque column mismatches worse.

**VAT has no single definition.** The invoice and proforma dialogs hard-code "VAT (0%)" and `0.00 QAR` (`invoice-view-dialog.tsx:263-264`; `proforma-invoice-dialog.tsx:332`). The only live rate selector is a per-invoice 0% or 5% dropdown in maintenance vendor invoices (`maintenance-module.tsx:866, 4922, 1626-1627`). The server computes no tax, and the AR route posts the gross amount with no tax line (`accounting.ts:1045-1053`). VAT accounts are defined under five conflicting codes, which stay latent while the rate is 0%.

| Source | VAT account(s) |
|---|---|
| `finance-store.tsx:2609, 2631` | 13200 input, 22200 output |
| `account-resolver.ts:908` | 12600001 input, 21600001 output |
| `proforma-invoice-dialog.tsx:311` | 12800001 |
| `procurement/postingService.ts:104-125` | 12500 |
| `maintenance-module.tsx:5758` | 21300001 |

**Ageing is computed twice, differently, and only in the browser.** The AR/AP ageing report measures days past due date against a selectable as-of date, with a "current" bucket for not-yet-due items (`ar-ap-aging-report.tsx:154-167`). The customer statement measures days since document date against `now` and puts 0-30 days into "current" (`customer-statement-submodule.tsx:759-790`). The same customer therefore shows different buckets in the two screens. No server ageing endpoint exists, although `fin_ar_invoices` rows carry `due_date` and `paid_amount`.

## What stays unverifiable without live database access

Several questions can only be answered against `pms_db`, and the repo cannot settle them. **Real column types** are unknown, because the only dump is a JSON row export with no types. This matters most for `fin_pdc_register`, `fin_legal_receivables` and the `mst_*` ids. Whether `fin_legal_receivables` accepts UUID tenants depends on a live type. The baseline (`scripts/01_pms_mariadb_schema.sql:621-633`) and `schema.prisma:796-809` both show BigInt, and no migration changes it. **Which migrations were applied** is unknown, apart from the one "Applied" line. Commit history gives authoring dates only (2026-11-24 to 2026-11-27). Nothing proves that the deposit, bank-status and autoincrement fixes ran. `fin_ar_invoices` was absent from the 2026-11-25 backup, which is consistent with its 2026-11-27 migration but not proof. **The DDL of `app_kv_store` and `app_sequences`** needs `SHOW CREATE TABLE`. A database rebuilt from the repo would lack both tables, which breaks `/api/kv` and every sequence-based id. **Server flavour and version** are not in the repo.

Smaller gaps remain after this round. Whether the client shim rewrites alias selects before sending them was not read, so the alias finding is confirmed for the server function but not end to end. Whether `manualPdcStatusUpdate` posts through `postAccountingEvent`, and so inherits its period check, was not traced. Whether real users carry `tenant_id` in `raw_user_meta_data` needs data. Which kv keys are per-user and which are shared was not mapped. The `/vouchers` tenant-column failure was not run. Neither round read every call site, and the drift scan sampled 900 characters after each `.from()`.

## Prioritised remediation plan

**P0, this week: close security holes and stop silent failures.**
1. Add a role and ownership check to `PATCH` and `GET /api/auth/profile/:userId`, and whitelist the fields it may change (`auth.ts:166-185`). Audit current `profiles.role` values for tampering.
2. Strip `raw_user_meta_data` password hashes from `/api/db` responses, or move the hash to a dedicated column that is never selected (`db.ts:203-247`; `auth.ts:41-56`).
3. Add a key allowlist and role checks to `kv.ts`, and stop keeping the audit log, demo session and period-lock cache there.
4. Fix the `/general-ledger` regex by reusing `isoDate` (`accounting.ts:607-608`).
5. Make the proxy fail loudly: reject empty or non-key `where` on update and delete, return the updated row, treat zero matches as an error, and return an error for an unknown table (`db.ts:232-239, 443-511`). Make the shim surface errors, and add `.order('id')` plus error reporting to `fetchAllRows` (`app-data-context.tsx:302-321`).

**P1, next 2 weeks: stop the repeatable write failures.**
6. Run a read-only inspection of `pms_db`: `SHOW CREATE TABLE` for the two kv/sequence tables and the `fin_*` tables, `information_schema` column types, and which migrations took effect. Store the DDL for `app_kv_store` and `app_sequences` in the repo.
7. Convert `fin_pdc_register` and `fin_legal_receivables` tenant, property, unit and bank columns to `VarChar(36)`, give `fin_pdc_register.id` an autoincrement, remove the `numericOrNull` drop path, and backfill the NULLs it created (`schema.prisma:796-864`; `leases.ts:47, 70-76`).
8. Reconcile column drift: add the missing `fin_vouchers` approval columns and the lease and reservation fields, or remove them from the UI. Fix the alias-select parser so `alias:fk(...)` maps to the relation (`coerce.ts:94-106`).
9. Fix the TENANT 403 with a tenant exception for `maintenance_tickets` in `dbAllowed`, or retire the dead branches. Replace mock-data portal pages with real queries or hide the routes in production.

**P2, weeks: integrity and tracking.**
10. Adopt tracked migrations: introspect, add the SQL-only tables and columns to the schema, and bring `uq_*` indexes in. Make the two non-idempotent migrations re-runnable.
11. Wrap voucher-plus-register flows (AR/AP, legal cases, payroll runs) in one transaction. Move HR GL posting inside it. Remove the date from idempotency keys, block edits to lines of posted events, and add an idempotency key to `allocateLandedCost`.
12. Unify the VAT account codes and a single rate source. Replace the two ageing implementations with one SQL-backed endpoint. Add pagination or explicit totals to the capped reports.
13. Derive `tenant_id` only from the session, add a tenant filter in the proxy, and tighten `LEDGER_RULE` for the period and voucher tables.

**P3, staged: move browser-held business data into tables.** Start with lease overrides and renewals, cheques, vouchers, payroll slips, custom COA accounts, AP and vendor invoices, work orders and settlement cases. Give each real columns, keys and optimistic-lock versions. Serve the trial balance and settlement summaries from SQL.

## Conclusion

The first audit ranked failure causes. This round shows that the hardest problems are the ones that look like success. A zero-row update, a swallowed error, a dropped alias, a GL date filter that never applies, a ledger voucher with no invoice, and a mock portal all return something plausible. The repeatable schema failures are cheaper to fix, because the repo's own patches document them. The security result matters more than the data result: one unguarded profile PATCH undoes every role rule in `db-policy.ts`.

The repo cannot fully resolve the schema question. It holds hand-run SQL, an untracked set of migrations and two tables with no definition, so the real database is the only authority. One read-only pass against `pms_db`, covering column types, applied migrations, and the DDL of the kv and sequence tables, would turn most "inferred" items in both audits into facts. It should come before the schema changes in P1.
