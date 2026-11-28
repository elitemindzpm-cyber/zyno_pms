# ZYNO PMS schema and data handling audit (schema layer)

Scope: prisma/schema.prisma (3748 lines, 183 models, MySQL provider, line 6), prisma/manual-migrations/*.sql, server/lib/coerce.ts, server/lib/db-policy.ts. Repo-local files only, read-only. Sources below are repo paths (no URLs); "file:line" is the citation form.
Note: the DB is MySQL (schema.prisma:5-7), not Postgres, although memory/other docs mention pms_db.

## 1. ID type inconsistency (int vs text vs uuid)

### Takeaway
Core entities (customers, leases, units, properties, users) use UUID VarChar(36), but several fin_* tables still use BigInt/Int ids for tenant/property/unit/lease references, so UUID values cannot be stored or filtered. Autoincrement was patched table-by-table after inserts failed.

### Cited Findings
- fin_pdc_register: `id BigInt @id` with no autoincrement (prisma/schema.prisma:848); tenant_id, property_id, unit_id, bank_id, original_pdc_id all BigInt (schema:850-860); only lease_id was later added as VarChar(36) (schema:862; manual-migrations/2026-11-24-pdc-unify.sql). Customers/units/properties are UUID (schema:253 customers id VarChar(36); schema:3000 units id VarChar(36)).
- Consequence in code: server/services/leases.ts:47 `numericOrNull` keeps only all-digit values; lines 70-76 therefore silently drop UUID tenant_id/property_id/unit_id (they are never written), so PDC rows lose their tenant/property/unit links. Ids come from an `app_sequences` workaround, not the DB (server/services/leases.ts:42-44; server/lib/finance-rpc.ts:14-20). `app_sequences` is not defined in schema.prisma (grep: no model).
- server/routes/finance.ts:16 filters fin_pdc_register by `tenant_id: tenantId`; if tenantId is a UUID string, Prisma will reject it for a BigInt column (coerceWhere only converts all-digit strings, server/lib/coerce.ts:65-67).
- fin_legal_receivables: tenant_id BigInt NOT NULL, property_id/unit_id/lease_id BigInt (schema:796-809). Same defect that fin_deposits had; a UUID tenant cannot be inserted. Autoinc was patched for this table (manual-migrations/2026-11-27-fin-id-autoincrement.sql) but column types were not.
- fin_deposits was fixed after the fact: tenant/property/unit to VARCHAR(36) (manual-migrations/2026-11-26-deposit-ids-text.sql:3-5), lease_id to VARCHAR(36) in 2026-11-26-deposit-payment-mode.sql. Comment states "tenant_id was a required bigint, so no deposit could be saved". Id remains BigInt autoincrement (schema:774), serialised as string via server/index.ts:28-29 json replacer.
- Autoincrement patches (each documents "inserts failed / Argument id is missing"): 2026-11-26-fin-bank-accounts-autoinc.sql, 2026-11-26-fin-banks-status-autoinc.sql ("Add Bank failed silently"), 2026-11-27-fin-id-autoincrement.sql (10 tables). Schema now shows `@default(autoincrement())` for them (schema:681, 704, 742, 754, 764, 774, 789, 797, 838, 867, 875) but fin_pdc_register was explicitly left out ("keeps its own id handling").
- 17 mst_* lookup tables have `Int @id` with no default (schema:1798-1949; e.g. mst_asset_categories 1798, mst_facilities 1849, mst_departments 1829). Any insert without a client-supplied id fails the same way fin_banks did. Others mst_* (mst_furnishing schema:1860s) use String ids. Mixed int/text ids across lookups means the generic /api/db layer must guess types.
- coerce.ts only converts numeric strings for Int/BigInt columns in `where` (server/lib/coerce.ts:55-84); it does not coerce them in write data (coerceRow handles DateTime, JSON-object-to-string, ''-to-NULL only, coerce.ts:23-40). So a create/update sending `"7"` for an Int/BigInt data field will fail validation.
- coerce.ts:17-20 builds its maps from Prisma DMMF; any table that exists only in the DB (see section 4) has no DMMF entry, so no coercion applies.

### Inferences
- The recurring "update/insert fails" cluster is the BigInt-vs-UUID mismatch in fin_pdc_register and fin_legal_receivables, plus missing autoincrement on Int ids.
- Remaining latent failures: fin_legal_receivables inserts from UI with UUID tenant; any write to mst_* without id; filtering PDCs by UUID tenant.

### Gaps
- Actual DB column state not verified (read-only, no DB access); manual SQL may not match what schema.prisma claims.

## 2. Missing/duplicate unique constraints and missing FKs/indexes

### Takeaway
Duplicate unique declarations exist; some uniqueness rules are only in manual SQL (invisible to Prisma); most fin_* and ledger tables carry bare UUID columns with no foreign keys.

### Cited Findings
- Duplicate identical unique: fin_accounting_event_lines declares `@@unique([event_id, line_number])` twice under two names (schema:626-627). Redundant index, and ambiguous for Prisma compound-unique usage.
- fin_transaction_account_rules has two overlapping uniques, one including is_active and one without (schema:895-896); the second prevents keeping an inactive plus an active rule for the same key, so "deactivate then re-add" fails. Also, uniques over nullable columns (payment_method, deposit_type, pdc_type) never collide in MySQL when NULL, so they do not actually enforce uniqueness.
- fin_account_mappings has three uniques mixing nullable property_id/unit_id with is_active (schema:598-600): NULLs do not collide, and (mapping_key, is_active) blocks two inactive history rows per key (effective_from/to history impossible).
- Uniqueness only in manual SQL (not in schema.prisma): uq_units_property_unit on `units(property_id, unit_number(100))`, uq_customers_qatar_id, uq_customers_tax_id (tax_identification_no), uq_fin_pdc_lease_cheque on `(lease_id, cheque_number(100))` (manual-migrations/2026-11-24-unique-constraints.sql:5-8). A `prisma db push`/migrate would drop them; Prisma cannot report them as P2002 with target names.
- units uniqueness is on `unit_number` (nullable, schema:3041) while `unit_ref` is the required column (schema:3002); unit_ref (the identifying field) has no unique, so duplicates by unit_ref are allowed and rows with NULL unit_number never conflict.
- Missing FK relations (bare VarChar(36) with no @relation): leases.unit_id (schema:1726; leases has relations only to properties, customers, users, inspection_reports, schema:1760-1765, none to units); fin_voucher_lines tenant_id/lease_id/property_id/unit_id/customer_id (schema:960-965); fin_accounting_events tenant/lease/property/unit/customer (schema:649-653); fin_deposits (schema:778-781); fin_payment_allocations (schema:813-818); ar_ledgers, payments, receipts, rent_schedules, journal_entries, fin_transaction_receipts (schema:3332-3460, 3672-3690). Orphan refs and no cascade/restrict behaviour; also units are never checked against leases at DB level.
- fin_coa_accounts has two parallel parent columns, parent_id and parent_account_id, each with its own self-FK (schema:717,721,726-729); code must keep both in sync.
- fin_bank_accounts.bank_id relation uses onDelete: Cascade (schema:689): deleting a bank deletes its accounts.
- Missing indexes: fin_deposits (no index on tenant_id/lease_id though queried by tenant_id, server/routes/finance.ts:40); fin_pdc_register has only the lease index (schema:863) though queried by tenant_id (finance.ts:16) and status; fin_legal_receivables none; ar_ledgers, payments, receipts, rent_schedules, journal_entries have no @@index despite lease_id/customer_id lookups (schema:3332-3460, 3680-3690). fin_unit_sl_accounts and fin_account_mappings are well indexed by comparison.
- pdcs model (schema:1953-1975) is a second PDC table (string id, status + status_pdc duplicate columns schema:1956,1972) while TABLE_ALIASES maps "pdcs" to fin_pdc_register (server/routes/db.ts:153) so `pdcs` model is shadowed/unused for generic API.

### Inferences
- Uniqueness failures produce P2002 only for Prisma-declared keys; the manual indexes will still fail at MySQL level (error 1062) with different error shapes.

### Gaps
- Did not exhaustively grep every one of 183 models for missing indexes; list is from models inspected.

## 3. Nullable columns, enums and status drift, Decimal handling

### Takeaway
Status fields are free-text VarChars with differing vocabularies; only accounting events and procurement use real enums. Money columns are consistently Decimal(18,4) but nullable, and code uses Number().

### Cited Findings
- Only 22 enums, all fin_accounting_events_* and proc_* (schema:3092-3290). Every other status is plain String: leases.lease_status @db.Text default "DRAFT" (schema:1730) alongside units.lease_status Text (schema:3027) and mst_lease_statuses table; fin_vouchers.status VarChar default "DRAFT"; fin_payment_allocations.status default "ALLOCATED"; fin_pdc_register.status default "In Hand" (schema:856); pdcs.status default "ISSUED" and status_pdc default "In Hand" (schema:1956,1972); ar_ledgers.status default "open" (lowercase); journal_entries.status "draft" lowercase vs fin_vouchers "DRAFT"; fin_deposits.status "Held"; fin_banks.status "Active". Mixed case and vocabulary; coerce.ts:35 / the earlier comment at coerce.ts:48-50 shows `.in()` on lease_status text columns had silently matched nothing.
- Unlisted/unchecked status: collection_status VarChar(32) holds 'deposit_collected', 'rent_collected', 'collection_completed' (manual-migrations/2026-11-26-lease-collection-status.sql), documented only in the SQL comment.
- Nullable-but-assumed: fin_deposits.amount Decimal? (schema:777), fin_pdc_register.amount Decimal? (schema:852), fin_payment_allocations.allocated_amount Decimal? (schema:822), fin_accounting_event_lines debit/credit Decimal? (schema:610-611), fin_voucher_lines debit_amount/credit_amount Decimal? (schema:957-958), fin_accounting_events total_debit/total_credit Decimal? (schema:654-655). Balance math over these must coalesce NULL; Prisma returns `Decimal | null`.
- leases.rental_amount is the one non-null money field (schema:1734); leases.security_deposit nullable default 0 (schema:1736); units.price/current_rent/security_deposit_amount nullable, and units.security_deposit (schema:3056) duplicates units.security_deposit_amount (schema:3037).
- Decimal(18,4) used broadly (244 Decimal fields; no Float columns found by grep). Prisma Decimal objects are not JSON numbers; code compensates with Number() (server/routes/db.ts:49-69) and `money()` rounding to 2 decimals (server/lib/finance-rpc.ts:10) while storage is 4 decimals, so rounding policy differs between layers. Decimal fields in fin_legal_receivables.amount etc. are nullable.
- fin_posting_periods.year is a Text column (schema:869) while month is Int.
- Date handling: DateTime/Date fields reject "2026-11-21" unless coerceRow appends T00:00:00.000Z (server/lib/coerce.ts:25-29). Columns that store dates as strings (pdcs.rent_from_date / rent_to_date are Text, schema:1966-1967) bypass coercion and will not sort/compare as dates.
- JSON stored as LongText strings (fin_account_mappings.metadata default "{}", schema:593; fin_accounting_events.metadata schema:656; units.municipality_details schema:3009) while a few newer tables use native Json (fin_transaction_receipts.receipt_payload/metadata, pms_app_state.data). coerce.ts stringifies objects for ALL String columns (coerce.ts:30-33), including legitimate non-JSON text fields; and an array/object sent for a Json column is not stringified (Json fields are not type String). Mixed handling.
- Empty-string-to-NULL applies to every optional String field (coerce.ts:34-36) which is needed for unique emails but also converts intentional blanks, and nothing converts '' for non-String optional columns (Int/Decimal/Date '' will error).

### Inferences
- A client sending '' for an optional Decimal/Date/Int gets a Prisma validation error; only String columns are cleaned.
- Status string drift (case, vocabulary) is a likely cause of "filter returns nothing" bugs.

### Gaps
- Did not enumerate all status vocabularies used by the front end (outside scope).

## 4. Drift between schema.prisma and manual SQL (patchwork)

### Takeaway
At least seven tables were created only by manual SQL and are absent from schema.prisma, so Prisma client cannot access them; schema.prisma itself shows a second, hand-written tail section.

### Cited Findings
- Created in SQL, not in schema.prisma (grep returns 0 models): fin_ar_invoices, fin_ap_invoices (manual-migrations/2026-11-27-fin-ar-ap-invoices.sql:2,28); fin_legal_cases, fin_payroll_runs, fin_bank_clearances, fin_bank_recon_records, fin_recon_statements (manual-migrations/2026-11-27-fin-registers.sql:2,20,40,52,64); app_kv_store (queried with raw SQL, server/routes/kv.ts:10-30); app_sequences (server/lib/finance-rpc.ts:15-17). Any generic /api/db access depends on `resolveModelName` finding a Prisma delegate (server/routes/db.ts:158-167), otherwise it falls through with the raw name; coerceWhere/coerceForModel do nothing for them (coerce.ts has no DMMF entry), and db-policy only matches the "fin_" prefix by name (db-policy.ts:21-23) so permissions work but coercion does not.
- Duplicate/parallel tables with overlapping meaning: fin_legal_receivables (schema:796) vs fin_legal_cases (SQL); fin_payroll_syncs (schema:837) vs fin_payroll_runs (SQL); fin_bank_reconciliations (schema:694) vs fin_bank_recon_records/fin_recon_statements (SQL); fin_customers (schema:763: Int id, own `code`) vs customers (UUID, customer_code) vs ar_ledgers.customer_id; fin_vendors (schema:919, Int id) vs vendor_* tables and proc_* relations; pdcs (schema:1953) vs fin_pdc_register vs lease-embedded pdc; fin_transaction_receipts (schema:3362) vs receipts (schema:3672) vs collection_receipts (schema:225) vs fin_ar_invoices; journal_entries (schema:3405) vs erp_journal_entries vs fin_accounting_events/fin_vouchers vs erp_vouchers; coa_gl/coa_sl/coa_classes vs fin_coa_accounts vs erp_chart_of_accounts (and erp_chart_of_accounts_backup_20260823, schema:514, a backup table living in the live schema); departments/designations vs mst_departments/mst_designations vs hrms_*; mst_* vs same-purpose text tables.
- Chart of accounts is duplicated: coa_sl/coa_gl/coa_classes AND fin_coa_accounts must both be updated; manual scripts insert into both (2026-11-27-petty-cash-account.sql, 2026-11-27-advance-to-vendors-account.sql, 2026-11-27-posting-accounts.cjs). Missing account in either causes posting failures; the .cjs script exists because "the imported chart lacks" accounts the posting code already references (posting-accounts.cjs header).
- Columns added only in SQL (and later back-ported to schema): fin_bank_accounts.gl_code (unique index, 2026-11-26-bank-account-gl-code.sql), fin_bank_accounts.status (2026-11-27-bank-account-status.sql: "every create/update that sent a status failed" because column did not exist), fin_banks.status (2026-11-26-fin-banks-status-autoinc.sql: "Add Bank failed silently"), leases.collection_status, assets.salvage_value, units.market_rent, employees.approval_limit (2026-11-23-features.sql), fin_pdc_register.lease_id (2026-11-24-pdc-unify.sql). Pattern: the UI/API sends a field, the column does not exist, Prisma throws unknown-argument, the write fails. Schema dated back-port is not guaranteed (e.g. `market_rent` appears as the last line of the units block at schema:3057-3058, outside the field-sorted order, evidence of manual append).
- Hand-appended models (different formatting: no column alignment, `@db.Decimal(18,4)` without space) from schema:3332 onward (ar_ledgers, asset_assignments, fin_transaction_receipts, hrms_payroll_overrides, journal_entries, lease_reservations, payments, pms_app_state, proc_ap_invoices ... through hrms_master_items) vs introspected style above; these carry no @relation or @@index. fin_transaction_receipts lives in the tail (line 3362) separate from the other fin_* models (581-1003).
- Migrations are not run by Prisma: files are hand-run (.sql plus one .cjs), have "Rollback:" comments only, no applied-version table; some use `ADD COLUMN IF NOT EXISTS` and `ADD UNIQUE INDEX IF NOT EXISTS` (MariaDB-only syntax, not valid MySQL 8) and `CREATE INDEX` without IF NOT EXISTS (2026-11-24-pdc-unify.sql, unique-constraints.sql) so re-run is not idempotent. Dates in filenames: 2026-11-23..27 only.
- Table naming: all snake_case tables/columns; model names equal table names (no @@map), so "camelCase vs snake_case" is not a problem for columns, but the Prisma client delegates are the snake names (prisma.fin_pdc_register), and db.ts matches case-insensitively (db.ts:164-166). Inconsistent *prefixes* (fin_, erp_, coa_, mst_, proc_, hrms_, no prefix) and relation field names like `fin_accounting_events_fin_vouchers_accounting_event_idTofin_accounting_events` (schema:668-669, 998-1000) are auto-generated and unwieldy; buildIncludeFromSelect in coerce.ts:96+ requires exact relation field names so UI selects like "customers(name)" only work if the field name equals the related table name.
- Circular 1:1 between fin_accounting_events.voucher_id (unique, schema:648) and fin_vouchers.accounting_event_id (unique, schema:991) both with FKs: neither can be inserted first without nulling/deferring one side.

### Inferences
- The "no column / unknown argument" failure family is explained by columns added only through manual SQL on the live DB without matching prisma generate.
- The parallel table families mean reads of one table may miss data written to its twin (e.g. deposits vs lease security_deposit vs fin_transaction_receipts).

### Gaps
- Cannot verify which migrations were actually applied to pms_db; no migrations table. Did not diff live DB vs schema.

## 5. Access policy (db-policy.ts) interactions

### Takeaway
Policy is by table-name prefix, deny-by-default; naming drift between aliases and model names can bypass or wrongly deny.

### Cited Findings
- ruleFor uses the resolved model name: ledger prefixes fin_/erp_/coa_ (db-policy.ts:20-23), people tables 'employees','hrms_' (db-policy.ts:26-27) and everything else OPERATIONS_RULE incl. delete by ADMIN_ROLES (db-policy.ts:30). Tables not matching a prefix but financial (ar_ledgers, journal_entries, payments, receipts, rent_schedules, pdcs, collection_receipts, revenue_recognition_logs, proc_ap_invoices/proc_payable_invoices) fall under OPERATIONS_RULE, so any STAFF role including HOST/LEASING can write ledger data via /api/db. Only works properly for aliased names because index.ts resolves alias first (db.ts:140-160: pdcs -> fin_pdc_register).
- mst_*, property/unit and tenant tables are writeable by any staff role; "users" table rule lists ADMIN_ROLES write (db-policy.ts:12) but delete only SUPER_ADMIN.
- Unknown RPC names default to admin-only (db-policy.ts:56-57); the listed RPCs must have matching server implementations.

### Inferences
- Tables created outside Prisma (fin_ar_invoices etc.) are covered by the fin_ prefix; unprefixed financial tables are not.

### Gaps
- Did not audit route-level checks beyond the policy file.

## Top schema-level causes of failed update/read (ranked)
1. fin_pdc_register and fin_legal_receivables: BigInt tenant/property/unit ids vs UUID entities (schema:796-809, 847-864; leases.ts:47,70-76 silently drops). Filters by UUID fail (finance.ts:16).
2. Column or table exists only in manual SQL / only in DB (fin_*_invoices, fin_registers tables, app_kv_store, app_sequences) or only in schema, causing unknown-argument errors; no migration tracking.
3. Int ids without default (mst_* tables, schema:1798-1949) and fin_pdc_register.id (schema:848) fail on insert without id.
4. Nullable money columns and free-text statuses with mixed case produce wrong aggregates/empty filters.
5. Unique rules living only in manual SQL (unique-constraints.sql), duplicate/overlapping uniques (schema:626-627, 895-896, 598-600), and uniques over nullable columns that do not enforce.
6. Missing FKs/indexes on ledger-adjacent tables (leases.unit_id, fin_voucher_lines.*, fin_deposits.*, tail models).
7. Parallel tables (customers/fin_customers, fin_vendors, pdcs/fin_pdc_register, receipt tables, COA twin sets) cause reads and writes to diverge.
