# ZYNO PMS: migrations, DDL provenance, provider and PK audit (repo files only)

## 1. DDL for app_kv_store and app_sequences

### Takeaway
No repo file defines or auto-creates either table. They are used by raw SQL and exist only in the live DB and in the 2026-11-25 JSON backup. Creation time and DDL are unknown. VERDICT: UNVERIFIABLE from the repo (tables exist, DDL missing).

### Cited Findings
- Only raw-SQL usage exists: server/routes/kv.ts:13,28,39 (SELECT / INSERT ... ON DUPLICATE KEY UPDATE / DELETE on app_kv_store keyed by tenant_id,k); server/lib/finance-rpc.ts:16-18,73-89,135-136 (app_sequences name/current_value upsert).
- Neither name appears in prisma/schema.prisma, scripts/01_pms_mariadb_schema.sql (151-table baseline), Documents/*.md, README.md, or server startup code. A grep for CREATE TABLE in server/ returned nothing, so there is no ensure-table at startup.
- prisma/manual-migrations/2026-11-26-fin-bank-accounts-autoinc.sql:1 mentions app_kv_store only in a comment.
- backups/pms_db_backup_2026-11-25T09-47-45-454Z.json is a JSON data export (keys: exported_at, tables, fallback, errors). It shows app_kv_store (33 rows; columns k, tenant_id, updated_at, v) and app_sequences (3 rows; columns name, current_value) existed on 2026-11-25. Sequence names present: customer_code, fin_pdc_register_id, fin_unit_sl_seq. The `errors` array is empty.
- Code also creates receipt_<year> sequence rows on demand (finance-rpc.ts:135), not present in the backup.

### Inferences
- The tables were most likely created by hand on the DB. A (tenant_id,k) key and a name key are implied by ON DUPLICATE KEY usage but not proven.
- A fresh DB built from the repo would break /api/kv and every sequence-based id because the tables would not exist.

### Gaps
- Exact DDL, charset, creation date. Only SHOW CREATE TABLE on the live DB can settle it (not allowed here).

## 2. Manual migrations: idempotency, references, applied record, dumps vs schema

### Takeaway
The 16 files in prisma/manual-migrations are not referenced by package.json, README, or server startup, and there is no applied-migrations table or log. Only one file says "Applied". The backup has no DDL, so real column types cannot be compared from dumps; drift is inferred from comments, git history and the baseline DDL.

### Cited Findings
- package.json:18-20 has only db:pull / db:generate / db:studio, no migrate script. README.md:12-13 mentions only a Supabase migration process. Documents/MIGRATION_PLAN_SUPABASE_TO_MYSQL.md:268 mentions `prisma db pull`. Nothing references manual-migrations. Only the .cjs header gives a run command: `node prisma/manual-migrations/2026-11-27-posting-accounts.cjs`.
- Applied record: only 2026-11-23-features.sql:2 says "Applied to pms_db on 2026-11-23". No other file and no migrations table in schema. `git log --stat -- prisma` gives authoring dates only: 11-24 af8b0aa (features, pdc-unify, unique-constraints); 11-26 3f0517b, 5b2dfa1, bad0b37, cf9da50, 05ed6c0; 11-27 e83cc35, 7e8b1c7, f5af0d9, 054d55a, cea2f01.
- Idempotent (safe to re-run): 2026-11-23-features.sql (ADD COLUMN IF NOT EXISTS); 2026-11-26-bank-account-gl-code.sql; 2026-11-26-deposit-payment-mode.sql; 2026-11-26-deposit-ids-text.sql (MODIFY repeatable); 2026-11-26-fin-bank-accounts-autoinc.sql; 2026-11-26-fin-banks-status-autoinc.sql; 2026-11-27-fin-id-autoincrement.sql; 2026-11-26-lease-collection-status.sql; 2026-11-27-bank-account-status.sql; 2026-11-27-fin-ar-ap-invoices.sql and 2026-11-27-fin-registers.sql (CREATE TABLE IF NOT EXISTS); 2026-11-27-advance-to-vendors-account.sql and 2026-11-27-petty-cash-account.sql (INSERT...SELECT ... WHERE NOT EXISTS); 2026-11-27-posting-accounts.cjs (header says idempotent, skips existing codes).
- NOT idempotent: 2026-11-24-pdc-unify.sql (line 3 CREATE INDEX unguarded) and 2026-11-24-unique-constraints.sql (4 unguarded CREATE UNIQUE INDEX; could also fail on existing duplicate data). Re-running errors out rather than corrupting.
- unique-constraints.sql:2 says Prisma cannot express prefix-length indexes, so those unique indexes live only in SQL, not in schema.prisma.
- backups/ holds 5 files, all JSON (no .sql dumps): the full pms_db backup plus 4 targeted deleted_*/unit_furnishing_* snapshots. The full backup has rows only, no types. In it, fin_pdc_register, fin_legal_receivables and fin_deposits had 0 rows; fin_ar_invoices was absent (table created after 2026-11-25, consistent with its 2026-11-27 migration).
- Baseline scripts/01_pms_mariadb_schema.sql vs schema.prisma:
  - fin_deposits: baseline lines 597-608 have id BIGINT without AUTO_INCREMENT, tenant_id BIGINT NOT NULL, property/unit/lease BIGINT. schema.prisma:773-786 has id @default(autoincrement()), tenant/property/unit/lease VARCHAR(36) NULL, plus payment_mode. Matches migrations deposit-ids-text, deposit-payment-mode, fin-id-autoincrement; in sync only if those were applied (unconfirmed).
  - fin_legal_receivables: baseline lines 621-633 id BIGINT, tenant_id BIGINT NOT NULL, lease_id BIGINT. schema.prisma:796-809 adds @default(autoincrement()) but keeps tenant_id BigInt required and property/unit/lease BigInt?. App ids are UUIDs and no migration converts these columns (unlike fin_deposits). Likely insert failure for UUID ids. Note: fin_legal_cases (fin-registers.sql) is a separate newer table.
  - fin_pdc_register: baseline lines 670-684 id BIGINT without default, tenant/property/unit BIGINT, no lease_id. schema.prisma:847-864 id BigInt @id with no default (fin-id-autoincrement.sql last line says it "keeps its own id handling"), lease_id added by pdc-unify. Ids come from app_sequences row fin_pdc_register_id (present in backup). server/services/leases.ts:47,70-76 numericOrNull drops UUID tenant/property/unit ids (per earlier schema.md notes).
  - fin_ar_invoices, fin_ap_invoices, fin_legal_cases, fin_payroll_runs and the other fin-registers tables: created only by manual SQL (2026-11-27), no model in schema.prisma, not in the baseline; accessed by raw SQL (server/routes/accounting.ts:990-1043). Their ids are VARCHAR(36) PK DEFAULT (UUID()).
  - mst_* tables: schema.prisma ids are Int or String @id without default (e.g. mst_asset_categories:1797, mst_payment_modes:1882, mst_property_codes:1894, mst_unit_codes:1923); lookup data loaded with explicit ids. Real DB types not comparable (no typed dump).

### Inferences
- Application of each migration cannot be proved from the repo. Commits that change schema.prisma together with a migration, and comments describing the failure ("Argument id is missing"), suggest those were applied to the live DB, but nothing records it.
- fin_pdc_register id has no managed default; any insert skipping nextIntSequence fails.

### Gaps
- Real column types (needs information_schema or SHOW CREATE TABLE on live DB; not permitted).
- Whether each migration has run on pms_db.

## 3. DB provider reconciliation

### Takeaway
Consistent MySQL/MariaDB throughout. VERDICT: reconciled.

### Cited Findings
- prisma/schema.prisma:5-7 datasource db { provider = "mysql"; url = env("DATABASE_URL") }.
- .env DATABASE_URL scheme is mysql://, database name pms_db (credentials/host not reproduced).
- server/lib/prisma.ts:4-14 uses a plain `new PrismaClient({log})`, no driver adapter; txn() sets a 20s interactive-transaction timeout.
- package.json:96 @prisma/client ^6.4.1; package.json:112 prisma ^6.4.1; no adapter package seen in the grepped lines.
- Raw SQL is MySQL syntax (ON DUPLICATE KEY UPDATE: kv.ts:28, finance-rpc.ts:16); baseline header says MariaDB 10.5+ / MySQL 8+ (scripts/01_pms_mariadb_schema.sql:1-4). Stale PostgreSQL comments remain in src/components/maintenance-module.tsx:469 and assets-module.tsx:403.

### Inferences
- ADD COLUMN IF NOT EXISTS (MySQL does not support it) suggests the server is MariaDB.

### Gaps
- Exact server flavour/version (not in repo).

## 4. Models after schema.prisma:3332 lacking PKs/defaults

### Takeaway
A scan of all models found every model has @id or @@id. After line 3332 only pms_app_state has no id default, which is fine for a caller-supplied string key. VERDICT: no insert-breaking gap in the hand-appended section; the real risk is fin_pdc_register (earlier section).

### Cited Findings
- pms_app_state (schema.prisma:3452-3456): id String @id VarChar(255), no @default; keyed state store, caller supplies id.
- PKs without defaults elsewhere: fin_pdc_register (847, BigInt), amenities (10), modules, profiles, users, mst_* lookups, erp_chart_of_accounts_backup_20260823 (514), composite keys proc_document_sequences (2032) and property_amenities (2683).
- fin_pdc_register is the only transactional table with a BigInt PK lacking a default.

### Inferences
- Fix would be an AUTO_INCREMENT migration plus schema change, or keep strictly using app_sequences.

### Gaps
- Live DB defaults not visible in schema.prisma (no live access).
