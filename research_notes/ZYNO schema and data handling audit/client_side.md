# Client-side persistence and calculation in ZYNO PMS

Scope: local repo only (src/, server/ for kv). Read-only static audit; citations are file:line in E:/Port/ZYNO PMS. Not every call site was read; grep-based counts are approximate.

## 1. Where does the browser store data (localStorage/sessionStorage/IndexedDB/kv-store)?

### Takeaway
No real browser storage is used: kv-store.ts is a server-backed, tenant-scoped key/value table (app_kv_store) with an in-memory cache, and __root.tsx actively wipes localStorage/sessionStorage. But a large amount of BUSINESS data (leases, PDCs, vouchers, payroll slips, work orders, AP invoices) is stored as opaque JSON blobs in that KV table, which is a schema/integrity problem even though it is shared across devices.

### Cited Findings
- kv-store.ts is a "drop-in replacement for localStorage"; data lives in API table app_kv_store, browser keeps only an in-memory Map; hydrateKv() loads all keys via GET /api/kv; setItem is optimistic (cache first, then fire-and-forget PUT; failures only console.error) — src/lib/kv-store.ts:1-6, 14-19, 10-13, 38-42
- Server side is real: server/routes/kv.ts GET/PUT/DELETE on app_kv_store keyed (tenant_id, k) with `ON DUPLICATE KEY UPDATE` (MySQL/MariaDB syntax) — server/routes/kv.ts:11-35
- Tenant comes from the client-supplied `x-tenant-id` header, defaulting to a hard-coded tenant a0000000-...0001 — server/routes/kv.ts:6-7. Mounted after requireSession/tenantPolicy (server/index.ts:66-68, 101) so a session is required, but there is no per-user/role scoping or validation of key names/size; any authenticated user of the tenant can read/overwrite every key (incl. finance blobs) via PUT /api/kv/:key.
- Last-write-wins on whole JSON arrays: read-modify-write of whole lists in the client (e.g. `pms_renewal_pdcs`, `pms_custom_lease_overrides`) — src/components/leasing-module.tsx:2170-2171, 4805-4806, 5722-5723; src/components/leases-module.tsx:211-238. Two users editing concurrently will clobber each other. Cache is hydrated once, so other users' changes are not seen until reload.
- __root.tsx:122-129 clears window.localStorage and sessionStorage on every load and removes sidebar_state cookie; grep found no other direct localStorage/sessionStorage/indexedDB/zustand-persist use under src (only kv-store.ts comment + __root.tsx).
- Number of distinct kv keys is large (~70+ distinct key patterns from grep of kvStore.get/setItem). Business-critical keys:
  - Leases: `pms_leasing_v2_leases`, `pms_renewed_leases_v1`, `pms_custom_lease_overrides`, `pms_deleted_leases_v1` (default value hard-codes `["SLT-OS41-14-R3","SLT-OS4114-R3"]` as deleted leases) — src/components/leases-module.tsx:648, 1283; leasing-module.tsx:4160-4175, 5584-5640
  - Cheques: `pms_renewal_pdcs` (12+ reads, 8+ writes), merged into PDC register in app-data-context.tsx:731 and finance-module.tsx:7840 ("primary source with real historical cheque dates")
  - Finance ledger: `finance_master_v1-vouchers`, `-ap` (finance-store.tsx:1109-1124, 2092-2101), payroll vouchers pushed into same blob (payrollIntegrationService.ts:167-197; hrms-module.tsx:910-1017), `fin_custom_coa_accounts_v1` (custom COA accounts! finance-module.tsx:1995-2155, 4117), `pms_posting_periods_cache` (closed periods; used by posting-engine.ts:662 to block posting), `fin_revenue_generation_batches_v2` (finance-module.tsx:7634, 7769), `grn_cost_mappings_v2`, `zyno_finance_budget_heads` (:984), credit/debit note lists via LS_KEY (:11320, 11723), `partial_paid_*`/advance keys
  - Procurement/AP: `proc_ap_invoices_cache_v2`, `proc_payment_receipts_v2` (proc-invoices-api.ts:72-101), `pms_vendor_invoices` (proc-invoices-api.ts:194,356-368; finance-module.tsx:4469-4475; maintenance-module.tsx:532), `pms_vendors`
  - Maintenance: `pms_maintenance_tickets`, `pms_work_orders`, `pms_technicians`, `pms_ppm_schedules`, `pms_ticket_comments`, `pms_maintenance_stock`, `pms_stock_movements` (maintenance-module.tsx:433-775)
  - HR: payslips/payroll cycles overlay HRMS_PAYSLIPS_LOCAL_KEY / HRMS_PAYROLL_CYCLES_LOCAL_KEY (hrmsService.ts:243-253, 1269-1285: "Always persist in kvStore overlay so payroll works reliably even if DB insert fails")
  - Checkout/settlement: `pms_checkout_cases_v3`, `pms_settlement_cases_v3`, `pms_deposit_settlements_v1`, `zyno_signed_handover_receipts` (leasing-module.tsx:697,707,1903,1945,2628-2650)
  - Assets: asset_revaluation/sale/writeoff/allocation/maintenance/warranty `_records_v2` (assets-module.tsx:363-398)
  - Audit log: security.ts STORAGE_KEY (security.ts:45-60, 123 can removeItem the audit log from the client)
  - Config: RBAC workflows (rbac.ts:202-215), document branding (document-branding.ts:232-264), dynamic masters + mandatory flags (dynamic-masters-service.ts:265-314), procurement catalog (procurement-catalog.ts:308-360), Excel import history/audit (excel-import/storage-service.ts:37-154), impersonation session (impersonation.ts:37-74)
- database-state.ts (getDbState/setDbState) writes to table pms_app_state via db proxy and falls back to kv cache / defaultValue when DB errors; setDbState swallows errors (console.warn) — src/lib/database-state.ts:11-60. ~31 usages outside the file.
- Browser-held mutable ledger state: finance-store.tsx computes `allLedgerTransactions`, `trialBalanceDetailed` (:2686-2711), `trialBalanceSummary` (:2713+) in React useMemo from locally-held vouchers.

### Inferences
- Because kv is server-backed, "lost across devices" is NOT the main issue; the issues are (a) no schema/constraints/FKs/audit for these blobs, (b) lost-update races from whole-array overwrite, (c) fire-and-forget saves that can silently fail (cache and server diverge), (d) data invisible to SQL reports/reconciliation and to server-side validation, (e) no authz on keys.
- A DB reset or tenant change loses the "real" leases/PDC data if it only lives in app_kv_store; leases-module merges DB `leases` with kv overrides so the DB row is not authoritative (leases-module.tsx:595-716, qatar-lease-contract.ts:459-463 reads override at contract-print time).

### Gaps
- Did not verify the app_kv_store DDL (table appears in prisma/schema.prisma and a manual migration was listed by grep; not opened). Did not enumerate every kv key (grep output was truncated to top 70).
- Not checked: whether tenantPolicy blocks /api/kv for tenant-portal roles.

## 2. mock-data, demo-auth, fallbacks to mock/local data when API fails

### Takeaway
Mock data is still wired into live screens (tenant portal, owner statements, sitemap, maintenance unit/property lookup, prop-mgr manage page), and a demo-session path remains in auth guards. In the main app-data loader, API failure falls back only to an empty seed array, but several services fall back to cached kv/local data on DB errors and keep local overlays so UI can show data the DB does not have.

### Cited Findings
- mock-data.ts (294 lines) "Centralized mock data" imported by: portal.index/lease/payments/tickets/bookings/documents routes (e.g. src/routes/portal.index.tsx:11, portal.payments.tsx:8), owner.statements.tsx:5 (`mockOwnerStatements`), admin.index.tsx:6 (formatSAR), sitemap[.]xml.ts:3 (properties), prop-mgr.manage.$id.tsx:15,91,318-328 (mock properties/units/leases), maintenance-module.tsx:83,558-588 (mock properties/units merged into unit directory). So tenant portal and owner statements display fictitious data, not DB data.
- demo-auth.ts: 12 hard-coded demo users with fixed UUIDs incl. SUPER_ADMIN/ADMIN/FINANCE (demo-auth.ts:12-100). Session stored in kv key `zyno-demo-session` (:3, setDemoSession ~:105). `DEMO_CREDENTIALS` is now empty and findDemoUserByEmail returns null (:~103-107) but setDemoSession(role)/getDemoSession remain; auth-guards.ts:75-81 accepts "Active Demo Session in kvStore" as a secondary identity for route guards, and properties-module.tsx:32 reads it. Because kv is writable by any authenticated user, a user could PUT `zyno-demo-session` with role SUPER_ADMIN and client guards would honor it (client-side only; server is gated by requireSession). Moderate/UI-guard risk; leasing-module.tsx:898-900 also reads `zyno_user_role`/`userRole`/`zyno_demo_session` from kv to decide role.
- app-data-context.tsx:878-884: on loader error, keep previous data or fall back to `INITIAL_SEED_RESERVATIONS`, which is `[]` (:263), i.e. effectively empty, not mock. Comment at :762 "strict DB data only, zero static fallbacks".
- app-data-context.tsx:502-504 and :731 merge kv "imported customers" (`zyno_pms_import_batches_history_v2`) and `pms_renewal_pdcs` into the in-memory customer and PDC lists, so UI contains records not in DB tables.
- database-state.ts:28-34: falls back to kv-cached state, then default value if DB unreachable (silent).
- hrmsService.ts:1269: payroll "works even if DB insert fails" via kv overlay; payslips/cycles can exist only in kv.
- purge-legacy-test-data.ts:2-10: documents that work orders, AP invoice tables, maintenance tickets "only ever existed in this browser's saved data (the work-order and AP-invoice tables are not in the database)". It deletes by hard-coded invoice numbers (INV-CARRIER-2026-081, INV-ALMANA-4482, WO-2026-001/003, T-101/T-103) from many kv keys and fin_vouchers; one-shot flags in kv (`pms_legacy_purge_*`). Evidence that work orders / AP invoices / vendor invoices have no relational tables.
- sitemap route builds the public sitemap from mock properties (sitemap[.]xml.ts:3).

### Inferences
- Tenant portal (`/portal/*`) and owner statements are mock-only: critical for any production claim, since users would see static figures (QAR amounts) unrelated to their lease.
- Default hard-coded deleted-lease list (`SLT-OS41-14-R3`) shows data cleanup done in code rather than in DB.

### Gaps
- Did not verify whether portal routes are reachable in production builds or hidden behind flags.
- Did not open the mock-data fixture contents beyond the first 30 lines.

## 3. Business calculations performed in the browser

### Takeaway
Most accounting aggregation (trial balance, ageing, statements, settlement summary, EOSB/gratuity, WPS SIF, payslip totals, invoice/deposit logic, period-close checks) is computed in client code from client-held data; posting itself is partly server-authoritative (RPC post_accounting_event_atomic, /api/accounting/post-voucher) but many paths still write vouchers into the kv blob and rely on the client for period locks and balances.

### Cited Findings
- Trial balance: `trialBalanceDetailed` / `trialBalanceSummary` computed by client useMemo over `allLedgerTransactions` (finance-store.tsx:2686-2740); finance-module.tsx:7401-7428 `summarizeTrialBalance(dbAccounts)` on the client for the simple TB and "isBalanced" flag. Server also has sub-ledger rollup code (server/services/finance.ts:11-34, "subledger_total", "variance"), so logic is duplicated.
- Posting: postAccountingEvent calls RPC `post_accounting_event_atomic` (posting-engine.ts:537; allowed for FINANCE_ROLES in server/lib/db-policy.ts:50; implemented server-side in server/lib/finance-rpc.ts:121) = authoritative, atomic. postJournalToBackend posts via /api/accounting/post-voucher (backend-posting.ts:12-38). But:
  - Closed-period enforcement is client-side from kv cache `pms_posting_periods_cache` (posting-engine.ts:655-670, finance-module.tsx:81,350); a missing/stale cache returns `{closed:false}` (posting allowed). Server enforcement not verified.
  - Payroll sync writes a voucher into kv `finance_master_v1-vouchers` as well as the API (payrollIntegrationService.ts:167-197), so TB/GL "reflect immediately" from client copy; duplicate-by-voucher_no check done in client.
  - insertVoucherOnce does check-then-insert from the client for idempotency (voucher-persist.ts:11-27).
- Settlement/deposits: `calculateSettlementSummary` pure client function (settlement-engine.ts:82); executeFinalSettlement, returnFuturePdcsForLease, settleEarlyLeaseVacate, auditLeaseClosure/assertLeaseClosable all client-orchestrated (settlement-engine.ts:153, 611, 687, 812, 925); depositService.ts:73,127,212 (collect/transfer/settle deposit). Reconciliations (AR, PDC, deposits, owner payables, month-end audit) run as client functions: financial-reconciliation.ts:67-342.
- Revenue billing: postMultiComponentInvoice (rent/parking/service/VAT), late fee, discount, credit note computed client-side (revenue-billing-engine.ts:48,137,191,246). VAT rate not located by grep (`0.05` search in that file returned nothing relevant); not confirmed whether VAT is a constant.
- Payroll/EOSB: gratuity = `diffYears * (basicSalary * 21/30)` rounded, computed in browser (hrmsService.ts:823-866); total gross/deductions/net = client reduce over payslips (hrmsService.ts:1264-1266); EOSB clearance letter HTML built client-side (qatar-eosb-clearance.ts:67-355); WPS SIF/CSV, IBAN and QID normalisation and validation client-side (qatar-wps-sif.ts:84-313; note normalizeQatarId has a `fallbackSeed` param that fabricates an ID, :105).
- PDF/printing: customer-statement-pdf.ts (1223 lines; sums at :121), payslip-pdf.ts, qatar-lease-contract.ts (1375 lines; contract totals/amounts-in-words, uses kv overrides at :459-463), document-branding.ts. These are presentation, but they compute totals from client data, so printed figures can differ from DB.
- Lease totals/overrides: leases shown to users are DB leases + kv `pms_custom_lease_overrides` + `pms_renewed_leases_v1` + `pms_leasing_v2_leases` merged at render time (leases-module.tsx:595-720; leasing-module.tsx:1753-1762), i.e. effective rent/dates can be a client overlay.
- AR/AP ageing: component ar-ap-aging-report is rendered in finance-module.tsx:70,309; unconfirmed whether aging buckets are computed client-side (file not opened).
- Server has matching service layer (server/services/finance.ts, hr.ts, leases.ts, posting.ts), so some of these have a server counterpart; extent of overlap not verified.

### Inferences
- Should be server-authoritative (critical): posting/period lock, voucher idempotency, payroll voucher posting, settlement/deposit refund execution, lease rent/date overrides and renewals, PDC register state, custom COA accounts, AP/vendor invoices and work orders (need tables), gratuity/final settlement, VAT and invoice totals. Reporting aggregates (TB, ageing, SOA totals) should come from SQL/views so they match the ledger regardless of what a browser has loaded; pagination `.range(from,to)` loaders (app-data-context.tsx:343-367) make client-side totals sensitive to partial loads.
- Benign: PDF/HTML rendering, amount-in-words, date formatting (date-utils.ts), Excel export (excel-export.ts).

### Gaps
- Did not read VAT, ageing, statement-PDF or EOSB formulas in full, nor check server/services for equivalent logic or server-side period-lock enforcement.

## 4. Classification summary

### Takeaway
Critical: kv blobs holding leases/PDCs/vouchers/AP/payroll/COA/period locks; mock-data in portal and owner statements; client-side posting guards. Moderate: demo-session identity in kv, fire-and-forget saves, DB-state silent fallbacks, duplicated TB logic. Benign: UI prefs, branding, import history, cache Map, localStorage wipe.

### Cited Findings
- CRITICAL: `pms_custom_lease_overrides`, `pms_renewed_leases_v1`, `pms_leasing_v2_leases`, `pms_deleted_leases_v1` (leases-module.tsx:595-720, leasing-module.tsx:4160-4175, 5584-5640)
- CRITICAL: `pms_renewal_pdcs`, kv PDC merge into register (app-data-context.tsx:731, finance-module.tsx:7840)
- CRITICAL: `finance_master_v1-vouchers`/`-ap`, payroll voucher local copy, `fin_custom_coa_accounts_v1`, `pms_posting_periods_cache` (finance-store.tsx:1109, 2092; payrollIntegrationService.ts:167; finance-module.tsx:1995; posting-engine.ts:662)
- CRITICAL: proc AP invoices/receipts/vendor invoices/work orders/tickets only in kv (proc-invoices-api.ts:72-101; purge-legacy-test-data.ts:2-10)
- CRITICAL: payroll payslips/cycles overlay (hrmsService.ts:1269); settlement/checkout cases (leasing-module.tsx:1903,1945)
- CRITICAL: mock-data feeding tenant portal/owner statements (portal.*.tsx, owner.statements.tsx)
- MODERATE: demo session and role keys in kv trusted by auth-guards.ts:75-81, leasing-module.tsx:898-900; audit log stored in and deletable from kv (security.ts:45-123); kv.ts default tenant and no key authz (kv.ts:6-7); fire-and-forget save (kv-store.ts:10-13, 38-42); getDbState silent fallback (database-state.ts:28-34); duplicate TB logic client vs server
- BENIGN/UI-config: branding (document-branding.ts:232-264), RBAC workflow config (rbac.ts:202-215; arguably moderate since it may drive permissions), dynamic masters/mandatory flags, Excel import history, asset records (moderate: business data), in-memory cache, sidebar cookie wipe (__root.tsx:122-129)

### Inferences
- The "no localStorage" migration moved the problem rather than solving it: persistence is on the server, but as untyped JSON in one table.

### Gaps
- No runtime verification (no queries against the DB, no app run). Counts of keys approximate.
