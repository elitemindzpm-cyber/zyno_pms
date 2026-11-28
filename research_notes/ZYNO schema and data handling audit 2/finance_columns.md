# ZYNO PMS: finance routes, services, VAT/ageing, column drift, alias selects (repo-only audit, read-only)

Source convention: all sources are repo files (path:line). No web or DB access was used.

## 1. server/routes/accounting.ts, services/hr.ts, services/procurement.ts: transactions, errors, validation, SQL injection, tenant scoping

### Takeaway
Raw SQL in accounting.ts is parameterised (tagged templates, or `?` placeholders in finance-rpc), so no SQL injection was found. The weaknesses are: tenant scoping that is absent or broken, a regex typo that disables GL date filters, ledger posting and register writes done as two separate steps (no shared transaction), and HR/procurement services that post to GL outside the DB transaction.

### Cited Findings
Transactions
- Only the COA create, unit-ledger create and bank-account create endpoints use `prisma.$transaction` — server/routes/accounting.ts:114, :393, :522.
- AR invoice create: `postManualVoucher` (ledger) runs first, then a separate `INSERT INTO fin_ar_invoices`; if the INSERT fails the voucher stays posted with no invoice. Same pattern in AP create (accounting.ts:1045-1058; :1120-1130), collect (:1081-1087), pay (:1151-1157), legal-case create (:1202-1209), recover (:1229-1236), payroll-run post (:1263-1271). Partial protection: postManualVoucher uses an idempotency key `MANUAL|type|reference|date` (server/lib/finance-rpc.ts:530-533), so a retry returns the existing voucher.
- AR/AP "collect"/"pay" always pays the full remainder (`amount - paid_amount`) and then sets `paid_amount = amount` (accounting.ts:1080, 1087, 1150, 1157); no partial payment path; status check (`inv.status === 'Paid'`) is read-then-write with no row lock, so concurrent clicks race (the voucher idempotency key `RCV-<invoiceNo>`/`PAY-<invoiceNo>` mitigates this).
- `/ar-invoices` POST loops invoices and does one dup check and two writes per invoice with no outer transaction; a 400 mid-loop returns after earlier invoices were already created (accounting.ts:1033-1060).
- hr.ts `runPayrollCycle`: payslips, loan updates and cycle status change are inside one `txn` (hr.ts:41-105). The GL journal (`postGlEvent`) runs after the transaction commits (hr.ts:107-119). If posting fails, the cycle is already `Processed`, so a re-run is blocked by the 409 check at hr.ts:25-27 and the voucher is missing. Idempotency key `payroll:<cycleId>` exists (hr.ts:116).
- hr.ts `approveFnfSettlement`: asset-return check then update, no transaction (hr.ts:146-164). `returnAssetAllocation` uses `txn` (hr.ts:173).
- procurement.ts: `matchPayableInvoice` creates a `proc_three_way_matches` row then updates the invoice with no transaction (procurement.ts:95-105); each run adds another match row. `approvePayableInvoice` posts GL (idempotency key `ap:<id>`) then updates the invoice with no transaction (procurement.ts:124-135). `allocateLandedCost` has no transaction and no idempotency, so a repeat call inserts duplicate `-DUTY`/`-FREIGHT` rows (procurement.ts:177-182); `doc_number` uniqueness (if any) is not checked in code.
- procurement.ts `approverUserId` is accepted but unused in `approvePayableInvoice` (`void approverUserId`, :136), so no approval-limit or role check on AP approval, unlike PO approval (:30-39).

Error handling
- Most handlers wrap in try/catch. Early routes return the raw `e.message` to the client (accounting.ts:26, 39, 53, 64, 356, 1335), which can leak Prisma/DB internals. Later routes use generic messages and `console.error` (e.g. :655, :713, :781; helper `fail` :1179-1182).
- `/compliance` has no role check (accounting.ts:1331-1336) and returns `SELECT * FROM v_posting_engine_compliance`.
- `/events`, `/vouchers`, `/coa` GETs have no `dbAllowed` check (accounting.ts:14-65); `/coa` has no tenant filter at all.

Validation gaps
- BUG: date regexes on `/general-ledger` are written `/^d{4}-d{2}-d{2}$/` with no backslashes (accounting.ts:607-608). They only match literal "dddd-dd-dd", so `from`/`to` are always null and the date filter is silently ignored. Compare the correct `isoDate` helper at :718.
- `/vouchers` filters `where: { tenant_id }` on `fin_vouchers` (accounting.ts:45-49) but the `fin_vouchers` model has no `tenant_id` column (schema fin_vouchers: id, voucher_number, voucher_date, voucher_type, reference_no, description, total_amount, status, accounting_event_id, posted_by, posted_at, created_at, source_type, source_id, created_by). Prisma will reject the unknown field, so the endpoint should fail with 500 (inferred from the schema; not run).
- `/ar-invoices` POST: no check that `account_code` exists (postManualVoucher checks it, finance-rpc.ts:510-518), no length limits, `inv.tenant/property/stream/notes` unsanitised but parameterised; `due_date` can be null; `period` derived by slicing a string (:1037).
- `/legal-cases` POST: `status` accepted from body unchecked (accounting.ts:1209); `outstanding_balance` can exceed `original_amount` (`money2(b.outstanding_balance ?? amount)`).
- `/payroll-runs` POST: `total_amount` is trusted from the client; `basic_salary + allowances + overtime - deductions` is not reconciled with `total_amount` (accounting.ts:1256-1271). Unknown `account_code` silently falls back to 51101001 (:1261-1262).
- `/bank-accounts`: next GL code computed as max+1 inside the transaction but without a lock; two concurrent requests could pick the same code (accounting.ts:530-532); the unique constraint on `coa_sl.code` is the only backstop.
- `/bank-clearances`, `/bank-reconciliations`, `/recon-statements` POST: `status`/`type`/`bank` free text, no enum check (accounting.ts:1288, 1308, 1325). Reconciliation difference is computed as `stmt - book` (:1306) and no check that the account exists.
- `/trial-balance` rolls up any code longer than 5 chars to `code.slice(0,5)` (accounting.ts:747); bank GLs such as 12000001..12000006 go to 12000 correctly, but any 6-to-8-digit expense SL like 51004007 is rolled to 51004; this is by design but depends on a 5-digit GL convention.
- Voucher-level reports (`/cash-flow`) pull `LIMIT 100000` lines into memory and classify in JS (accounting.ts:961-966); `/general-ledger` caps at 20000 rows (:635); `/journals` caps at 5000 (:698); `/ar-invoices` and `/ap-invoices` cap at 5000 (:1020, 1099). No pagination, so totals silently truncate.
- Hard-coded GL codes spread through the file: 12413001 AR control, 21000 AP control, 12000001 default bank, 12411001 legal receivable, 51101001 payroll default (accounting.ts:992-994, 1166-1167, 909-910); the P&L/BS classification uses code prefixes ('411', '51101', '501', '523', '51003', '121', '129', '12411', '124', '123', '13', '221', '214', '215', '211', '213') (accounting.ts:811-860).
- Balance sheet: `totalAssets` includes any Assets code, but the `else bankCashAssets += net` fall-through (accounting.ts:853) means unclassified asset codes are reported as bank/cash.

SQL injection review
- All `$queryRaw`/`$executeRaw` use tagged templates, so values are bound parameters (accounting.ts:610, 688, 726, 786, 884, 915, 941, 961, 1040, 1043, 1055, 1087, 1126, 1157, 1208, 1236, 1269, 1288, 1307, 1325).
- Only `prisma.$queryRawUnsafe` seen is in server/lib/finance-rpc.ts:512-515, using `?` placeholders for `codes`; table names/placeholders are not user-controlled, so safe. (Not exhaustive for the rest of finance-rpc.ts or other files.)
- `LIKE '12100%'` literal at accounting.ts:893 is constant.

Tenant scoping
- `tenantMiddleware` takes tenant from the client-supplied `x-tenant-id` header and falls back to a fixed default id `a0000000-0000-0000-0000-000000000001` (server/lib/middleware.ts:11-15). It is not derived from the authenticated user, so any caller can send another tenant id.
- Only `/events`, `/events/:id` and `/vouchers` use `tenantId` (accounting.ts:19, 34, 47). Every other endpoint (GL, TB, P&L, BS, cash book, AR/AP, legal, payroll, bank, COA, unit ledgers) is global and reads all tenants' data; none of fin_ar_invoices/fin_ap_invoices/fin_legal_cases/fin_payroll_runs are filtered by tenant.
- hr.ts and procurement.ts: no tenant or property scoping anywhere. Lookups use `findUnique({id})` only (hr.ts:23, 141, 169; procurement.ts:23, 56, 111, 146).
- Role gating is by `dbAllowed(role, table, op)` using table 'coa_sl' or 'fin_vouchers' (accounting.ts:71, 317, 363, 508, 605...), keyed to the role from `req.user`.

### Inferences
- Because AR/AP writes are two-step (post voucher, then write register), a DB failure on the second step creates ledger entries without register rows; the idempotency key lets the user retry, which is a partial mitigation.
- The `x-tenant-id` header trust plus unscoped finance endpoints means multi-tenant isolation depends entirely on there being one real tenant.
- The GL date-filter regex typo means the UI "from/to" boxes on the General Ledger page do nothing (unless the client filters locally).

### Gaps
- server/lib/finance-rpc.ts (rest of file), server/services/posting.ts and server/lib/db-policy.ts rule table were only partly read; whether `postGlEvent` itself is transactional was not verified.
- Auth middleware that sets `req.user` was not read, so whether `x-tenant-id` is overwritten upstream is unconfirmed.
- No runtime test was made of the `/vouchers` tenant_id failure.

## 2. VAT rate definition and receivable ageing: formulas and duplicates

### Takeaway
There is no single VAT rate. Qatar currently has no VAT, and the UI hard-codes 0%; the only live rate selector is a per-invoice 0/5% dropdown in maintenance vendor invoices, and VAT GL accounts are defined under five different codes. Ageing is computed client-side in two non-equivalent ways (due-date based in the AR/AP ageing report, document-date based in the customer statement), and the server has no ageing endpoint.

### Cited Findings
VAT
- Invoice view dialog hard-codes "Tax / VAT (0%)" and `0.00 QAR`; total payable equals subtotal (src/components/finance/invoice-view-dialog.tsx:263-264).
- Proforma dialog hard-codes "VAT / Tax Amount (0% / Exempt)" (src/components/proforma-invoice-dialog.tsx:332) and shows a debit to "12800001 Input VAT / Recoverable Tax" (:311) and a "Tax / VAT ID: TAX-300912-QA" (:187).
- Maintenance vendor invoice modal: `taxRate` state defaults to 0 (src/components/maintenance-module.tsx:866), option "5% VAT / Tax" (:4922); formula `tax = base * (rate/100)`, `total = base + tax` (:1626-1627, :4932-4935). The listed VAT account in that module is "21300001 VAT / Input Tax Recoverable" (:5758).
- Vendor master has a free-text `tax_rate` default "0" (src/components/vendor-module.tsx:172, 1086-1087).
- Procurement AP posting: reads `invoice.tax_amount` and posts Input VAT to GL 12500 only if tax > 0 (src/lib/procurement/postingService.ts:104-125); no rate computed there. `procurement/operations.ts:181` has `taxRate?: number`.
- VAT account codes disagree: finance-store 13200 "VAT Recoverable (Input Tax)" and 22200 "VAT Payable (Output Tax)" (src/lib/finance/finance-store.tsx:2609, 2631); account-resolver comment 21600001 Output VAT / 12600001 Input VAT (src/lib/finance/account-resolver.ts:908) and event keys VAT_OUTPUT_INVOICE / VAT_INPUT_VENDOR (:106-107); proforma 12800001; procurement posting 12500; maintenance 21300001.
- revenue-billing-engine.ts header lists "VAT" as an invoice component (src/lib/finance/revenue-billing-engine.ts:5) but grep found no VAT/tax computation in that file, revenue-engine.ts or posting-engine.ts.
- Server side: no VAT rate or tax computation found in server/ (grep VAT|tax_rate in server/ returned only unrelated reservation-status hits). Server AR invoice route posts the gross amount to AR and the stream account with no tax line (server/routes/accounting.ts:1045-1053).

Ageing
- Implementation A (client, due-date based): src/components/finance/ar-ap-aging-report.tsx. `computeDaysOverdue = floor((asOf - due) / 86400000)` (:154-159); buckets `<=0 current, <=30 "1_30", <=60 "31_60", <=90 "61_90", else "90_plus"` (:161-167); status flips to "Overdue" if days > 0 (:465). AR outstanding is reconciled to GL 12413001 by restoring/reducing `paidAmount` against a shortfall (:440-446, comment :169); AP lines are split per property (:498-575). Party rows are grouped by party plus property (:580-615).
- Implementation B (client, document-date based): src/components/finance/customer-statement-submodule.tsx:759-790. `diffDays = floor((now - row.date)/86400000)` using the invoice/row date (not due date); `<=30` goes to `current`, `<=60 d30_60`, `<=90 d61_90`, else `d90plus` (the variable named `d31_60` is exposed as `d30_60`); uses `now` rather than a selectable as-of date; only unpaid debit rows are counted. The label says "Standard 30-day aging brackets" (:1671).
- The two disagree on the base (due date vs document date), the reference date (as-of picker vs now), and the first bucket (current includes not-yet-due vs 0-30 days from document date).
- Other files that matched "aging|bucket" are unrelated or analytics (procurement/analytics.ts, approvalIntelligence.ts, hrmsMastersService.ts, rbac.ts, console-config.tsx, super-admin routes); not read in detail.
- Server has no ageing endpoint in accounting.ts (grep). AR invoice rows carry `due_date` and `paid_amount` (server/routes/accounting.ts:998-1005), so ageing could be done in SQL but is not.
- Status-from-days duplication: "Overdue" computed in ageing report (:465, :551, :569).

### Inferences
- With VAT at 0% everywhere, the five different VAT GL codes are latent: if 5% is ever enabled, vendor-invoice VAT would post to a code (maintenance 21300001 or procurement 12500) different from the resolver's (12600001/21600001) and the chart in finance-store (13200/22200).
- The customer statement's ageing and the ageing report will not match for the same customer.

### Gaps
- Did not read lines 170-440 of ar-ap-aging-report.tsx fully (candidate invoice collection and receipt allocation) or the `revenue-billing-engine.ts` body; the claim that it has no VAT maths is from grep only.
- Whether `fin_ar_invoices` actually has a VAT column was not checked (it is a raw-SQL table, not in the Prisma model list checked here).

## 3. Column drift: UI table/column use vs prisma/schema.prisma

### Takeaway
Method: counted `db.from('<table>')` in src/ (top: leases 35, units 25, pdcs 24, fin_vouchers 15, properties 13, proc_purchase_orders 13, fin_voucher_lines 13, fin_pdc_register 13, customers 12, assets 11, proc_goods_receipts 10); then ran a heuristic script over `.eq/.order/.in/.select/.insert/.update` columns and verified each hit by reading the line. Confirmed real drift is listed below; script noise (e.g. `data`, `error`, `input`) is excluded. fin_deposits and maintenance_tickets showed no drift in the sampled usage.

### Cited Findings
Confirmed UI columns missing from the Prisma model
- leases: `tenant_name` (src/components/leasing-module.tsx:1400, src/lib/finance/finance-store.tsx:1829), `tenantName` (finance-store.tsx:1829), `status` (leasing-module.tsx:4073 `update({status:'active'})`; model uses `lease_status`), `host_id` (src/lib/db.ts:1195-1196 `.eq('host_id')`), `tenant_id` (src/lib/finance/financial-gatekeeper.ts:49), `has_rent_free`, `rent_free_period_days`, `rent_free_position` (src/components/leases-module.tsx:451 update; no `rent_free` anywhere in schema.prisma per grep). Model columns: tenant is via `customer_id`; no tenant_name.
- units: `unit_status` (src/routes/super-admin.analytics.tsx:58; model has `status`), `current_tenant` (leasing-module.tsx:1401 select), `unit_number` (leasing-module.tsx:4074 `.eq("unit_number")`, not a model column per the units column listing: `unit_ref`, `unit_name`, `status`), `status` is fine, `unit_ref` is fine.
- customers: `name` (finance-store.tsx:1828 `select("id, name")`, leasing-module.tsx:1400 `customers:customer_id(full_name, name)`); model has `full_name`, `display_name`, `company_legal_name`, `trade_name`, no `name`.
- fin_pdc_register (model: id, cheque_number, bank_id, cheque_date, amount, tenant_id, property_id, unit_id, status, deposit_date, cleared_date, returned_date, original_pdc_id, created_at, lease_id): UI selects `tenant_name, drawer_name` (leasing-module.tsx:1398), `pdc_type` (src/lib/finance/financial-gatekeeper.ts:126), `updated_at` (src/hooks/queries/usePdcs.ts:47 insert-adjacent / update). None exist in the model (there is no updated_at).
- pdcs (model: id, lease_id, cheque_number, bank, deposit_date, amount, status, created_at, maturity_date, collection_date, bank_branch, cheque_front_url, cheque_back_url, unit_name, property_code, tenant_name, rent_from_date, rent_to_date, sl_no, status_pdc): UI orders by `cheque_date` (leasing-module.tsx:972; also finance-store.tsx:2550 region uses `cleared_date`), uses `cheque_no` (leasing-module.tsx:3266), `drawer_name` (leasing-module.tsx:1399), `updated_at` (src/lib/db.ts:1291 `updatePDC`), and a `leases(tenant_name, unit_ref)` relation select (db.ts:1239) asking for leases.tenant_name which does not exist. Also pdcs and fin_pdc_register are two parallel PDC tables with different columns (bank text vs bank_id; tenant_name vs tenant_id).
- fin_vouchers (model has `status`, `voucher_number`; no approval columns): UI uses `approval_status`, `reviewed_by`, `reviewed_at` (src/lib/finance/voucher-approval-service.ts:108-111, 124), `rejection_reason` (:124), `narration`, `origin_module`, `voucher_no` (src/components/leasing/voucher-approval-modal.tsx:33). The model has `voucher_number`, not `voucher_no`. The voucher approval workflow therefore writes columns that are not in the Prisma model (the update to approval_status fails unless the live DB differs from schema.prisma).
- fin_voucher_lines: UI uses `debit`, `credit` (src/lib/finance/settlement-engine.ts:817), but the server SQL uses `debit_amount`/`credit_amount` (server/routes/accounting.ts:619-620, 730-731).
- reservations (model: id, unit_id, prospect_name, prospect_contact, prospect_id_type, prospect_id_number, marketing_agent_id, proposed_lease_period, expected_start_date, proposed_rental_amount, reservation_validity, special_conditions, status, created_at, updated_at): insert at leasing-module.tsx:3459 sends `agent`, `isHold`, `remarks`, `tokenAmount`, `tokenPaymentMode`, `tokenReceiptNo` (camelCase UI fields; none in the model).
- fin_deposits (model: id, deposit_type, coa_account_code, amount, tenant_id, property_id, unit_id, lease_id, payment_mode, status, receipt_ref, created_at): no mismatches found in the sampled usage (12 columns used, all present).
- maintenance_tickets (model: id, tenant_id, property_id, unit_ref, title, description, category, priority, status, assignee, host_id, reported_by, resolved_at, created_at, updated_at): no mismatches in sampled usage. Server restricts tenant users by `tenant_id` (server/routes/db.ts:213-215).
- properties: no mismatches found in sampled usage (`city`, `is_active`, `title` exist or at least were not flagged).

Model columns the UI mostly never uses (reverse direction)
- leases has 46 columns, the script saw 34 distinct names referenced, many from the UI payload; unused-by-UI examples that matter: `collection_status`, `previous_lease_id`, `check_in_report_id`, `check_out_report_id` (not verified individually). The reverse comparison was not exhaustive.

How the proxy treats unknown columns
- coerceWhere only converts known DateTime/Int/BigInt fields; unknown keys are passed straight to Prisma (server/lib/coerce.ts:61-76, server/routes/db.ts:207-211). Prisma will throw on unknown fields in `where`, `orderBy`, `data`. `select` strings are NOT passed to Prisma as column lists: server/routes/db.ts:200-202 only derives `include` from the select string; the response returns all scalar columns (see section 4). So a wrong column in `.select()` does not error, but one in `.eq/.order/.update` does.

### Inferences
- Many UI-only fields (tenant_name on leases, drawer_name, camelCase reservation fields) suggest either a legacy Supabase schema or the DB in `.env` having more columns than prisma/schema.prisma. Per project memory, ZYNO uses only the `pms_db` in `.env`; prisma/schema.prisma is presumably introspected from it, so these would be real runtime failures unless handled by a DB layer I did not read (src/lib/db.ts or server/routes/db.ts may strip unknown columns; db.ts:35-163 not read).
- fin_vouchers approval fields suggest the approval feature was built against a different schema.

### Gaps
- The script heuristic only examined the 900 characters after each `.from()` call, and `.insert()` payloads built as variables (not inline object literals) were not checked.
- Did not read src/lib/db.ts client conversion layer (aliases, column mapping, strip-unknown logic).
- No DB introspection (not permitted), so live columns may differ from schema.prisma.

## 4. Do alias selects like `properties:property_id(...)` get dropped by buildIncludeFromSelect?

### Takeaway
Confirmed, with a nuance: the alias is parsed wrongly, so the join is dropped, but it is dropped because the regex matches the FK column name (`property_id`), not the alias. For leases, though, the relation field in the Prisma model happens to be called `properties`/`customers` (same as the alias), so the data is simply not returned under that key unless the `*` path or the client re-maps; the relation is never included.

### Cited Findings
- Code: `const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^()]*)\)/g;` then `relName = m[1]` and `model.fields.find(f => f.kind === 'object' && f.name === relName)`; if not found, `continue` (server/lib/coerce.ts:94-99).
- For `properties:property_id(title, address, city, country)` the regex requires an identifier immediately before `(` (optional whitespace). The text `properties:` ends with `:` so cannot match; the match starts at `property_id`. So `relName = 'property_id'`, which in `leases` is a scalar (`property_id String? @db.VarChar(36)`, schema.prisma leases model), not an object field. `find` returns undefined, so `continue`. Same for `customers:customer_id(...)` (relName `customer_id`, scalar).
- Resulting include: `{}`, so `buildIncludeFromSelect` returns `undefined` (coerce.ts:106) and `findMany`/`findFirst` runs without `include` (server/routes/db.ts:226, 241). The response contains only leases scalar columns; no `properties` or `customers` key.
- Concrete example: src/hooks/queries/useLeases.ts:27-34 (`useLeases`) and :47-55 (`useLease`) select `*, properties:property_id(title, address, city, country), customers:customer_id(full_name, mobile_number, email_address, qatar_id)`. Returned rows have no `properties`/`customers`, so UI code reading `lease.properties?.title` or `lease.customers?.full_name` gets undefined.
- Note the Prisma model does have relation fields named `properties` and `customers` on `leases` (schema.prisma leases: `customers customers? @relation(fields: [customer_id]...)`, `properties properties? @relation(fields: [property_id]...)`). A non-aliased select like `properties(title)` would work, because relName `properties` matches an object field. Only the `alias:fk(...)` form fails.
- The column list is also ignored when a relation is found: `wanted` is filtered to related scalars; and when no relation is found the top-level select is not applied at all (all scalars returned). `select` is only used for include (server/routes/db.ts:200-202).
- Second concrete usage: `db.from("leases").select("id, tenant_name, customers:customer_id(full_name, name)")` (src/components/leasing-module.tsx:1400). Same drop; also asks for `leases.tenant_name` and `customers.name`, which do not exist (see section 3).
- Prior report records about 62 alias-style selects and marks the claim "inferred" (reports/ZYNO schema and data handling audit.md:13); this trace confirms it from code.
- Unverified: the browser client (src/lib/db.ts:35-163) may transform the select string before sending (e.g. rewrite `alias:fk(...)` to `relation(...)`); I did not read it. If it does, behaviour differs. The server-side function by itself drops the alias form.

### Inferences
- Features that rely on joined `properties`/`customers` objects from `useLeases` silently show blanks unless they use fallbacks (e.g. `lease.tenant_name`, which also does not exist in the model).
- Fix options (not applied): parse `alias:rel(...)` and `alias:fk(...)` by mapping the FK column to the relation whose `relationFromFields` contains it, and wrap the result under the alias key.

### Gaps
- src/lib/db.ts client transformation of select strings was not read, so end-to-end behaviour in the running app is not confirmed.
- Not tested at runtime (no DB connection allowed).
