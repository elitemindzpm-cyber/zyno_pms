# ZYNO PMS server/API architecture and data-handling path (static code audit)

Scope: read-only review of repo files (server/index.ts, server/routes/*, server/lib/*, server/services/*, src/lib/api-client.ts, db.ts, db-finance.ts, db-masters.ts, src/hooks/queries, app-data-context, kv-store, prisma/schema.prisma). No database was contacted. "Source" for every finding is a repo path (relative to E:/Port/ZYNO PMS); line numbers are exact for server/routes/db.ts and src/lib/db.ts/api-client.ts, otherwise function-level. Items marked (inferred) are reasoned from code, not executed.

## 1. How does an update/get travel from UI to DB, and what is the layering?

### Takeaway
Most UI traffic goes through a Supabase-style shim (`db.from(t).select/eq/update`) in src/lib/db.ts that serialises to `POST /api/db/:table/{query,insert,update,upsert,delete}` handled by one generic Prisma proxy (server/routes/db.ts). A second, mostly unused set of REST routes (properties/leases/accounting/finance) and raw-SQL finance engine (server/lib/finance-rpc.ts) sit beside it. The shim never throws (errors become `{error}` objects), the proxy resolves model names dynamically with no column allowlist, and update/delete are `updateMany/deleteMany` driven by a client-built `where`.

### Cited Findings
Request path (get):
- UI `db.from('leases').select(...).eq('id',x)` builds a QueryBuilder (src/lib/db.ts:5-205) that stores one `_where` object, then in the thenable (db.ts:208-250) calls `dbApi.query` -> `request()` (api-client.ts:20-38, `fetch` with cookie + `x-tenant-id` header) -> Express `app.use(requireSession)` -> `tenantPolicy` -> `/api/db` router.
- Server: permission middleware (db.ts:133-148) -> `resolveModelName` (db.ts:165-176) -> `coerceWhere` (server/lib/coerce.ts) -> `model.findMany/findFirst/count` (db.ts:179-252). Response `{data, error, count}`.

Request path (update):
- `db.from(t).update(payload).eq('id',id)` -> `dbApi.update(table, where, data)` (db.ts:200-204 in QueryBuilder.then) -> `POST /api/db/:table/update` (server db.ts:443-479): `coerceWhere` + `coerceForModel` then `model.updateMany({where,data})`. Special case: `leases` with status TERMINATED goes to `terminateLease` (db.ts:462-467). Inserts for leases/reservations/units/customers/fin_pdc_register are diverted to domain services (`DOMAIN_INSERT`, db.ts:16-22, 395-400); updates are NOT.

Layers that duplicate each other:
- (a) generic proxy db.ts; (b) dedicated REST routers `/api/properties|units|leases|customers|reservations|accounting|finance|hrms|procurement|masters` consumed only through `src/lib/api-client.ts` wrappers (`propertiesApi`, `pdcApi`, `vouchersApi`...), which appear to have almost no callers (only api-client.ts matched a grep for `listRecords|pdcApi|accountingEventsApi|vouchersApi`); (c) typed helper modules src/lib/db-finance.ts and db-masters.ts (thin per-table CRUD over the shim, each doing `if (error) throw error`, db-finance.ts:202-217, db-masters.ts:20-60); (d) React Query hooks src/hooks/queries/*.ts that talk straight to `db.from`; (e) server services (server/services/*.ts) used by both generic and dedicated routes; (f) raw SQL finance engine finance-rpc.ts and accounting.ts (~1340 lines of `$queryRaw`).
- Business rules are enforced inconsistently across these: `useCreateLease` (hooks/queries/useLeases.ts) inserts via the shim, so `createLease` runs; but `useUpdateLease` goes through `updateMany` and skips lease rules except termination. Same table can be written by 3 paths with 3 validation levels.

### Inferences
- Any bug fix must be applied at the proxy plus each duplicated layer; the dedicated REST routers have different shapes (`{data,pagination}`, `{success:true}`, raw object) than the proxy (`{data,error,count}`), so the front end has no uniform response contract.
- Dead/unused REST routes still carry bugs (see section 4) which will surface the moment a screen starts using them.

### Gaps
- Did not enumerate every component calling `db.from` (hundreds); caller-level error handling was sampled, not exhaustively audited.

## 2. Where can the generic CRUD silently misbehave or break (ranked)?

### Takeaway
Highest risk: (1) empty/ineffective `where` on update/delete hits every row, (2) client query-builder semantics drop/overwrite filters and drop PostgREST-style relation aliases, (3) update returns `{count}` not the row, and 0-row matches are reported as success, (4) shim converts all failures to resolved `{error}` and several readers swallow errors producing truncated or empty data.

### Cited Findings (ranked; severity H/M/L)
H1. Unscoped bulk write/delete. `update` and `delete` do `where = req.body.where ?? {}` then `updateMany/deleteMany({where})` with no check that `where` is non-empty (server/routes/db.ts:456, 469-472, 495, 509-511). Any client bug producing `{}` (e.g. a filter silently dropped, see H2) updates or deletes the whole table. Mitigations only exist for `properties`, posted vouchers/events (db.ts:496-508) and the `.or()` unparseable case (src/lib/db.ts:202-204 adds `{id:'__no_match__'}`, which proves the author hit this).
H2. Query-builder overwrites. `_where` is a flat object: `.gte('d',a).lte('d',b)` leaves only the later operator for the same column (db.ts:35-60); two `.in()`, or `.eq()` then `.neq()` on a column likewise overwrite. `.contains`, `.overlaps`, `.is` (db.ts:154-163, 106-109) just assign the raw value (array/boolean) as an equality filter. `.not(col, op, v)` ignores `op` (db.ts:146-149) so `.not('x','in',...)`/`.not('x','is',null)` become `{not: value}`. `.filter()` unknown operators fall back to equality (db.ts:151-161). `.like/.ilike` strip `%` and use `contains` (case sensitivity depends on DB collation) (db.ts:80-90). On reads this returns wrong rows; on update/delete it widens the write (links to H1).
H3. Relation select aliases are silently dropped. `buildIncludeFromSelect` (server/lib/coerce.ts, regex `([a-zA-Z_]\w*)\s*\(([^()]*)\)`) captures the identifier immediately before `(`. For PostgREST aliases like `properties:property_id(title,...)` or `customers:customer_id(full_name,...)` it captures `property_id`/`customer_id`, which is not a Prisma relation field, so it `continue`s and no include is added. Used in src/hooks/queries/useLeases.ts:29-33,49-53, src/components/leases-module.tsx:524, leasing-module.tsx:1400, app-data-context.tsx:349 (grep found ~62 alias-style occurrences across src). Result (inferred, needs runtime confirmation): the joined `properties`/`customers`/`units` object is undefined with no error. Non-aliased `properties(id,title)` does work. Also the `select` column list is never honoured: queries always return `*` (db.ts:223-246 only uses `include`), so `select('id,name')` returns full rows (extra payload and unintended column exposure, e.g. whatever sensitive columns the table has).
H4. Update response shape. Proxy update returns Prisma `{count}` (db.ts:469-474). The shim then returns `{data:{count}}`; code written as `.update(x).eq('id',id).select().single()` (useLeases.ts useUpdateLease) receives `{count:1}` as the "row" (the `select/single` flags are set on the builder but the `update` branch ignores them, db.ts:200-204). Callers reading `data.id`/fields get undefined.
H5. Zero-match is success. `updateMany/deleteMany` never error on 0 rows (db.ts:469, 509); the shim returns `error:null`. Stale ids, wrong id type, or `__no_match__` look like successful saves. Upsert/PDC paths do use optimistic checks (finance-rpc.ts manualPdcStatusUpdate `Number(updated)!==1`), but generic update does not.
H6. Shim never throws. `QueryBuilder.then` catches every exception and resolves `{data:null,error:{message}}` (db.ts:230-249; `onrejected` is only called if provided and still after building errResult). Every call site must check `error`; grep found ~96 empty/no-op catch handlers in src/server (e.g. `.catch(() => {})` in assets-module.tsx:1598,1642,1652,1964,2038 around status/cost updates). A failed `updateAsset` is silently ignored.
H7. Read of unknown table returns empty by design: error text matching `/not found in Prisma client/` on a select yields `{data:[],error:null}` (db.ts:232-239). A typo in a table name or a table that was never added to schema.prisma shows "no data" instead of an error.
M1. Reads truncated silently. `fetchAllRows` in src/lib/app-data-context.tsx:302-321 `break`s on `res.error`, empty data, or exception and returns whatever was collected, with no error surfaced; the paging uses `.range()` with no `order`, so MariaDB gives no stable order across pages (rows can repeat or be skipped) (inferred from SQL semantics). Server `query` has no `take` cap or default (db.ts:238-246): an unbounded `.select('*')` returns the whole table; `count` in the findMany response is `items.length`, not a total (db.ts:247), so the shim's `count` is wrong for paged reads (db.ts:226-229).
M2. `upsert` is non-atomic and ignores unique constraints: does `findFirst` by `onConflict` keys then `update` or `create` per item sequentially (db.ts:332-351). Race: two concurrent upserts both see no row and both create (or one hits P2002 -> 409). If none of the `onConflict` keys are present in the item, `where` is empty and `findFirst({where:{}})` returns an arbitrary first row which is then updated (db.ts:336-345) (inferred: `Object.keys(where).length` guards this only when zero keys are present; it falls to create then. Partial-key case updates a row matching only some keys).
M3. Array insert is sequential and not transactional (db.ts:424-431): row 3 failing leaves rows 1-2 committed while the client sees one error.
M4. Resolve-model dynamics: `resolveModelName` falls back to the raw lower-cased table name if no Prisma key matches (db.ts:174-176), then `(prisma as any)[modelName]` is used. Names such as `constructor` resolve to non-model properties (inferred); the `ruleFor` default for any unlisted table is `OPERATIONS_RULE` (staff read/write, admin delete) (server/lib/db-policy.ts), so there is NO table allowlist: every Prisma model, including ones not meant for the UI, is writable by any STAFF role.
M5. Alias asymmetry: `TABLE_ALIASES` (db.ts:152-163) maps `pdcs`->fin_pdc_register etc. The account-line check uses the raw `table` not `modelName` (`ACCOUNT_LINE_TABLES.has(table)`, db.ts:373), so aliasing/case variants (`FIN_VOUCHER_LINES`) skip the COA validation (inferred). The policy check uses the resolved model (db.ts:143), which is correct.
M6. Role mismatch for tenant portal: `tenantPolicy` lets role TENANT call `/api/db/maintenance_tickets/(insert|query)` (server/lib/tenant-policy.ts) but the `/api/db` permission middleware then calls `dbAllowed('TENANT','maintenance_tickets','read'|'write')`; `OPERATIONS_RULE` lists only STAFF_ROLES (db-policy.ts) so TENANT is not in the list -> 403 (inferred, depends on whether another code path adds TENANT; no such rule found in db-policy.ts). The tenant-specific branches in db.ts:213-215 and 403-413 would then be unreachable.
L1. Error messages: `sendDbError` maps Prisma validation errors to a generic "Invalid data for this request" (errors.ts), hiding which column/type failed. Combined with H6 the UI can only show a generic message, hampering diagnosis of column mapping errors.

### Inferences
- The proxy is the single biggest source of "update/get returns wrong or nothing" symptoms because correctness depends on client query-builder translation that is lossy (H2, H3) and on shape expectations (H4).
- Column-name mismatches between client and Prisma do not fail loudly: unknown columns in `data` hit Prisma validation -> generic 400 (L1); unknown columns in `where` -> 400 too; but unknown relation/alias names are silently ignored (H3).

### Gaps
- Did not diff every UI column name against schema.prisma; see sibling schema audit notes for that.
- Runtime confirmation of H3/M6 needs an actual request (read-only constraint).

## 3. Type coercion and id handling

### Takeaway
Coercion is partial and one-directional: date-only strings and numeric-string ids are converted only in `where` (reads/filters), while on writes only date-only strings, JSON-object-to-string and ''->NULL are handled. String ids sent for Int/BigInt columns on insert/update/upsert are not coerced.

### Cited Findings
- `coerceRow` (server/lib/coerce.ts) converts `YYYY-MM-DD` -> `T00:00:00.000Z` for DateTime fields, stringifies objects for String columns, and maps '' -> NULL for optional strings. It has no Int/BigInt/Decimal/Boolean handling on writes, no ISO-with-space handling ("2026-01-01 10:00:00" or local datetime strings without TZ are rejected by Prisma and surface as the generic 400).
- `coerceWhere` converts numeric strings to Number/BigInt for Int/BigInt fields and date-only for DateTime fields, including inside AND/OR/NOT and operators equals/gt/gte/lt/lte/not/in; it does NOT recurse into relation filters (e.g. `customers: {...}`) and ignores `contains/startsWith`. Bad numeric strings (e.g. "12abc") are passed through and fail validation.
- BigInt ids: fin_pdc_register.id is BigInt without auto-increment (prisma/schema.prisma:847-848); ids come from `nextPdcId()` (server/services/leases.ts) via `app_sequences`. Server serialises BigInt as string (server/index.ts:29), so the browser sees ids as strings; filter coercion on the way back is the only thing that makes `eq('id','7')` work. `registerData` uses `numericOrNull` for tenant_id/property_id/unit_id/bank_id, silently dropping non-numeric (UUID) values (services/leases.ts `registerData`): a UUID customer/property/unit id passed for a PDC is ignored and stored as NULL, no error.
- Mixed id domains: leases/units/properties/customers use UUID VarChar(36); fin_pdc_register uses BigInt for tenant_id/property_id/unit_id/bank_id (schema.prisma:847-860). The UI must translate between them; there is no central mapping.
- UI sends Decimal money as JS numbers; `finance-rpc.ts` rounds with `Math.round(n*100)/100` floating math (`money()`), and `postManualVoucher` compares `totalDebit !== totalCredit` after rounding (finance-rpc.ts), acceptable at 2dp but not exact for 4dp Decimal columns (fin_pdc_register.amount Decimal(18,4)).

### Inferences
- Writes with numeric-string ids into Int/BigInt columns (other than via domain services) will 400; the same value works in a filter. This asymmetry explains "get works, update fails" reports.

### Gaps
- Did not enumerate all Int/BigInt columns that the UI writes as strings.

## 4. Tenant scoping, authorization and session

### Takeaway
The generic proxy has role-based table rules but no tenant (organisation) scoping at all, and "tenant" is overloaded (renter vs organisation). Dedicated finance/accounting REST routes scope by `tenant_id` but filter on columns that are missing or of a different type, so they would error.

### Cited Findings
- Only 13 models in prisma/schema.prisma have a `tenant_id` column (fin_accounting_event_lines, fin_accounting_events, fin_deposits, fin_legal_receivables, fin_payment_allocations, fin_pdc_register, fin_voucher_lines, role_permissions, tenant_subscription_invoices, maintenance_tickets, fin_transaction_receipts, journal_entries, payments). Properties, units, leases, customers, vouchers, HR, procurement have none. The generic proxy never injects a tenant filter except for tenant-role maintenance_tickets (server/routes/db.ts:213-215). Cross-organisation isolation therefore does not exist at the data layer (works only because one tenant org exists; MEMORY note: ZYNO uses single pms_db).
- `tenant_id` has two meanings: organisation UUID (events, deposits, receipts) and renter/customer id (fin_pdc_register.tenant_id BigInt, fin_legal_receivables.tenant_id BigInt, leases.tenant_id used in accounting.ts:630 `COALESCE(l.customer_id, l.tenant_id, ...)`).
- Dedicated routes filter `where:{tenant_id: tenantId}` with the header UUID: `GET /api/finance/pdcs` (server/routes/finance.ts:16) against BigInt column (type mismatch -> Prisma validation error, 500 `{error:e.message}` with raw message); `GET /api/accounting/vouchers` (accounting.ts:~47) filters fin_vouchers which has no `tenant_id` field in schema.prisma (model at line 982) -> validation error. These endpoints are dead today but broken (inferred; not executed).
- Header spoofing: `tenantMiddleware` defaults to the hard-coded UUID `a0000000-...-0001` and trusts `x-tenant-id` (server/lib/middleware.ts), as does kv.ts (`tenantOf`, kv.ts:8). requireSession overrides the header only when the JWT carries `tenant_id` (require-session.ts); a session lacking `tenant_id` claim can choose any KV namespace. The client also hard-codes the same default (api-client.ts:9-10).
- Authorization: `db-policy.ts` is deny-by-default for roles and RPC; unknown RPC names are admin-only; ledger prefixes fin_/erp_/coa_ writable by FINANCE/CASHIER/admins; `users` read by ADMIN_ROLES means password hash columns (if present in the users model) are returned by `select *` to any admin client (column list ignored, see H3) (inferred; password field not seen in `grep password prisma/schema.prisma` output as the grep returned only unrelated lines, so verify the users model).
- Leases routes scope tenants by `created_by` or customer email (tenant-policy.ts `tenantLeaseWhere`), which relies on email equality; but the generic `/api/db/leases/*` is not reachable for TENANT (blocked by tenantPolicy), so scoping holds. Dedicated `PATCH/DELETE /api/leases/:id` have no role check beyond the global `tenantPolicy` (staff of any role incl. LEASING can `deleteMany` a lease with no status check, leases.ts:140-145), whereas the proxy requires ADMIN to delete.
- Dedicated properties routes: `POST/PATCH` pass `req.body` directly to Prisma (`data: req.body`, properties.ts:195, 206-209) with no coercion/validation: mass assignment of any column (`id`, `created_by`) and date strings fail; errors returned raw via `e.message` (info leak of Prisma internals).

### Inferences
- If a second organisation is ever onboarded, the proxy will leak data across tenants, because there is no systemic tenant filter.

### Gaps
- Did not read auth.ts login/claims in full; whether JWT always carries `tenant_id` was not verified.

## 5. Finance postings, transactions and race conditions

### Takeaway
The core posting engine (`postAccountingEvent`, `manualPdcStatusUpdate`, `nextIntSequence`) uses a transaction with row locks and is reasonably robust, but orchestration around it is multi-step and non-atomic: event creation, posting, and business-record updates are separate transactions, and client-driven flows build events/lines through the generic proxy in multiple calls.

### Cited Findings
- `postAccountingEvent` (finance-rpc.ts) runs in one `txn()` with `SELECT ... FOR UPDATE` on the event, balance, period-closed, COA validation, voucher + lines insert and receipt issue. Strong. Note: `fin_posting_periods` compare `year = String(pYear)` (string/number type depends on column) and a missing period row means "open".
- `postManualVoucher` splits work across non-atomic steps: (1) read idempotency key; (2) if a non-posted event exists, DELETE its lines then event outside any txn; (3) create event+lines in `txn`; (4) call `postAccountingEvent` in a second txn; on failure, cleanup DELETEs run outside a txn (finance-rpc.ts postManualVoucher). A crash between steps leaves DRAFT events; concurrent identical requests race on `idempotency_key` unique -> second request fails with a generic 409/500.
- Idempotency key for manual vouchers includes the date (`MANUAL|type|reference|date`), so the same reference posted on a different date is not deduplicated (finance-rpc.ts).
- `manualPdcStatusUpdate`: first txn updates the cheque status and creates a DRAFT event + lines; the actual ledger post happens afterwards in `postAccountingEvent` outside that txn; on failure a compensating UPDATE sets status back and marks the event FAILED (finance-rpc.ts). If the process dies between, the cheque shows Deposited/Cleared with no voucher. The compensation UPDATE `WHERE status = target` is not atomic with respect to other users' changes.
- AR invoice create (accounting.ts:~1030-1062): `postManualVoucher` posts to the ledger, then separately `INSERT INTO fin_ar_invoices`; any failure of the insert (duplicate, constraint) leaves a posted voucher with no invoice; the duplicate checks are SELECT-then-INSERT without a lock, so concurrent submissions can double-post. Loop over `list` is not atomic: a mid-batch 400 returns after earlier invoices were posted.
- AR collect (accounting.ts:~1068-1090): checks `inv.status === 'Paid'` then posts the receipt then updates status, no lock; two concurrent clicks both pass the check; because the voucher idempotency key includes the date, same-day repeats dedupe but different-day repeats create a second receipt. `paid_amount = amount` is set to full amount even if partial was posted.
- `recordMaterialUsage` (db.ts:44-91) does stock decrement in a txn with `FOR UPDATE`, but posts the GL voucher afterwards and compensates by deleting the usage and restoring stock in a separate txn if posting fails; if that compensating txn itself fails, stock and usage diverge. `recordLeaveApplication` (db.ts:94-112) is transactional and checks balance, but `findFirst` on balance is not `FOR UPDATE` (race on concurrent applications; uses Prisma `increment`, so no lost update but both can pass the check).
- Sequences: `nextIntSequence`/`nextSequenceNumber`/`proc_next_document_number` use `INSERT ... ON DUPLICATE KEY UPDATE current_number = current_number + 1` then SELECT inside a txn (finance-rpc.ts; db.ts:115-127, 265-273): safe under concurrency because the upsert takes the row lock in InnoDB; `resolveUnitSl` pre-reads without a txn then re-checks inside (finance-rpc.ts), acceptable.
- `createLease` (services/leases.ts) pre-allocates PDC ids outside the transaction (`nextPdcId` loop before `txn`), so a failed lease burns ids (gaps) but is otherwise safe; `insertPdc` (dedupe + slot fill) is read-then-write without txn: concurrent identical cheque inserts can duplicate.
- `accounting.ts` has 0 `txn(` usages (grep count 0) even though it performs many multi-statement postings via `$executeRaw`; services/finance.ts and procurement.ts also 0.
- Client-driven posting: the proxy exposes `fin_accounting_events` and `fin_accounting_event_lines` for generic insert (any FINANCE role) and rpc `post_accounting_event_atomic`; a UI that inserts the event, then each line, then calls rpc is a multi-request, non-atomic sequence. The only server guard on lines is the COA check (db.ts:373-383), which is bypassed for alias/case variants (M5) and is not applied to updates (`update` on lines is unrestricted: db.ts:443-479), so lines of a DRAFT or even POSTED event can be edited via the proxy (inferred: there is no status check on update of fin_voucher_lines/fin_accounting_event_lines in db.ts, unlike delete, which guards POSTED events/vouchers at db.ts:500-508).

### Inferences
- Ledger integrity risk is concentrated in (a) edits to posted records via generic update, (b) orphaned/duplicate vouchers around AR/AP flows, (c) crash windows between event creation and posting.

### Gaps
- Did not review accounting.ts lines ~80-1000 and 1120-1338 (AP, legal, reports) or services/hr.ts/procurement.ts in depth.

## 6. Pagination, response shapes and client-side limits

### Takeaway
Three different list contracts coexist and none is enforced; pagination limits differ by layer.

### Cited Findings
- Proxy: `{data, error, count}`; no default `take`, count = page length (db.ts:226-229, 247). Count-only returns `{data:null,count}` (db.ts:218-219).
- Dedicated routes: `{data, pagination:{total,page,limit,totalPages}}` via `paginatedResponse` (middleware.ts), with `limit = Math.min(100, parseInt(...))`: `limit=abc` gives NaN (`take:NaN`), `limit=0` gives 0 -> `totalPages = Infinity`, negative limit is not clamped (middleware.ts parsePagination). Silent 25 default only when absent.
- Other routes return bare objects (`res.json(item)`), `{success:true}` for PATCH/DELETE (properties.ts:210, leases.ts:128), and `{error: e.message}` on failure; the shim expects `error` as a string but api-client's `request` throws `Error(err.error)` on non-2xx, so message shapes `{data:null,error}` and `{error}` both work, but `requiredRole`/`error:'INSUFFICIENT_PERMISSIONS'` codes are surfaced as raw text to users.
- Raw-SQL endpoints use hard caps: `LIMIT 5000` on AP invoices (accounting.ts: ap-invoices list) with no pagination indicator, so large datasets truncate silently.
- Front-end bulk load: `fetchAllRows` pages by 1000 without ORDER BY and swallows errors (M1); `.limit(n)`/`.range()` are used 62 times in src (grep count), almost none paired with an explicit `.order()`.
- Dates: UI dates are formatted dd-mm-yyyy per recent commits; the API expects ISO; `normaliseDates` only converts keys matching `/_date$/` (services/leases.ts) while `coerceRow` converts any DateTime field, so fields like `created_at`/`timestamp` strings differ between lease routes and the proxy.

### Inferences
- Pagination bugs most likely show up as missing rows in large tables (units, leases, PDCs > 1000) when a page request errors mid-load; no user-visible error is raised.

### Gaps
- Did not measure actual table sizes.

## 7. KV store and other side channels

### Takeaway
Browser storage was replaced by an `app_kv_store` table with fire-and-forget writes and last-write-wins semantics.

### Cited Findings
- `kvStore.setItem` writes to the in-memory cache first and then PUTs asynchronously; failures are only `console.error`'d (src/lib/kv-store.ts `track`), so a failed save looks successful until reload; `flushKv` exists but must be called by the caller.
- Server: `GET /api/kv` returns all rows for the tenant on every hydrate; `PUT /:key` upserts raw `value` string with no size/key validation beyond JSON body limit (25mb, server/index.ts:46); error handling returns `e.message` (kv.ts:17-19). Reads of one key concurrently written by two users: last write wins, no versioning. Tenant namespace is the spoofable header (see section 4).
- Server-wide: unhandled rejections are only logged (server/index.ts:18-23), and `express.json({limit:'25mb'})` is applied before the session check (index.ts:46 vs 66), so unauthenticated requests can post 25MB bodies (parsed before `requireSession`) (inferred from middleware order).

### Inferences
- KV-backed state (settings, drafts, counters stored client-side) can silently diverge across users/devices.

### Gaps
- Which app features depend on KV for business-critical data was not enumerated.

## Ranked summary (most likely causes of "errors when updating/getting data")
1. H1/H2/H5: lossy, flat filter builder + unguarded `updateMany/deleteMany` (wrong rows matched, or all rows, or zero rows reported as success).
2. H3: PostgREST alias selects (`alias:fk_col(...)`) dropped by `buildIncludeFromSelect`; select column lists ignored.
3. H4: update returns `{count}` while callers expect the row.
4. H6/H7/M1: error swallowing (shim never throws, 96 empty catches, unknown table -> empty, `fetchAllRows` breaks on error; unordered range paging).
5. Section 3: writes lack Int/BigInt/DateTime(non-date-only) coercion; PDC UUID ids silently dropped to NULL.
6. Section 5: non-atomic multi-step postings (AR/AP, manual voucher, PDC status), posted ledger lines editable via generic update.
7. Section 4: no tenant filter in proxy; tenant_id type/semantic mismatches break dedicated finance routes; spoofable `x-tenant-id` default.
8. M6: TENANT role vs `dbAllowed` mismatch makes tenant ticket flow likely return 403.
