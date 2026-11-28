# ZYNO live database verification

Read-only queries (information_schema plus a few counts) against `pms_db`, run on 2026-11-28. Nothing was written. No row contents were read except kv key names, sizes and timestamps. Complements `ZYNO schema and data handling audit 2.md`.

## Environment
- MariaDB 10.5.27, database `pms_db`, 193 base tables, 200 foreign keys, every table has a primary key.
- No `_prisma_migrations` table. Migrations are applied by hand with nothing tracking them.

## Verdicts on previously unverified items

| Item | Verdict | Evidence |
|---|---|---|
| `app_kv_store` / `app_sequences` exist | CONFIRMED, but DDL is not in the repo | `app_kv_store(tenant_id varchar36 PK, k varchar255 PK, v longtext, updated_at datetime6)`; `app_sequences(name PK, current_value bigint)`. A fresh DB built from the repo would not have them. |
| PDC register id types vs UUID entities | CONFIRMED | `fin_pdc_register.tenant_id/property_id/unit_id` are `bigint`; `leases`, `units`, `properties` and `customers` use `varchar(36)`. All 24 PDC rows have NULL tenant_id, property_id and unit_id, while lease_id is populated. The UUID references are being silently dropped on write. |
| `fin_legal_receivables` | CONFIRMED | `tenant_id` is `bigint NOT NULL` and the other refs are `bigint`. A UUID tenant cannot be stored. The table is empty. |
| `fin_pdc_register.id` has no autoincrement | CONFIRMED | Ids come from `app_sequences.fin_pdc_register_id` (currently 111) while the table has 24 rows, so sequence and table already disagree. |
| `fin_deposits` fix applied | CONFIRMED | Refs are `varchar(36)` and id is auto_increment. |
| `mst_*` ids without default | CONFIRMED, worse than reported | 26 `mst_*` tables have an `id` with no auto_increment (11 are `varchar(255)`, 15 `int`). Inserts without an explicit id fail. |
| `fin_*` ids without autoinc | Only `fin_pdc_register` remains | The manual autoincrement patches were applied. |
| Hand-added columns exist | CONFIRMED | `fin_bank_accounts.status/gl_code`, `fin_banks.status`, `leases.collection_status`, `units.market_rent`, `fin_deposits.payment_mode` are all present, so those manual SQL files were applied. |
| UI column drift | CONFIRMED against the live DB | Missing: `leases.tenant_name/status/host_id/tenant_id/has_rent_free`; `fin_vouchers.approval_status/reviewed_by/voucher_no/tenant_id`; `fin_voucher_lines.debit/credit` (only `debit_amount/credit_amount` exist); `fin_pdc_register.tenant_name/drawer_name/pdc_type/updated_at`; `customers.name`. Any update or filter on these fails. |
| `fin_posting_periods` | EMPTY (0 rows) | The server treats a missing period row as open, so period locking is effectively off, while 47 vouchers are posted. |
| Duplicate/parallel tables | CONFIRMED, mostly unused | `customers` has 339 rows while `fin_customers` has 0. `pdcs` has 0 rows while `fin_pdc_register` has 24. `fin_legal_cases`, `fin_payroll_runs` and `collection_receipts` are all empty. Only `fin_transaction_receipts` (47) is in use. |
| Users `tenant_id` in metadata | 0 of 2 users | Both users (ADMIN, SUPER_ADMIN) have no `tenant_id` in `raw_user_meta_data`. The JWT claim is therefore always null, and the server falls back to the `x-tenant-id` header or the hard-coded default `a0000000-0000-0000-0000-000000000001`. |
| Unique constraints | PARTIAL | `uq_fin_pdc_lease_cheque(lease_id, cheque_number)` and `uq_units_property_unit(property_id, unit_number)` exist (the latter over a nullable column). `fin_accounting_event_lines` has two duplicate unique indexes on `(event_id, line_number)`. |
| `reservations` | Table exists | The earlier reservation insert drift (`agent`, `isHold`, `tokenAmount` ...) still applies to the model, but `reservations` and `lease_reservations` are two separate tables. |

## Business data held in the kv blobs (live)
15 keys, all under the default tenant. They still hold business data outside real tables:
- `pms_renewal_pdcs`, `pms_leasing_v2_leases`, `pms_custom_lease_overrides`, `pms_deleted_leases_v1`, `pms_renewed_leases_v1` (leases and cheques), updated 2026-11-27.
- `pms_fin_bank_accounts_override_v2` (bank accounts), `pms_voucher_date_corrections`, `hrms_employee_leave_meta_v1`.
- `zyno_pms_import_batches_history_v2` is 4.17 MB in one row (import history). Every save rewrites the whole value.
- Only 2 leases exist in the `leases` table, so most lease state lives in the blobs and is merged at render time.

## Other live observations
- Lease and PDC statuses are mixed free text (`In Hand`, `Deposited`, `Cleared`, `ACTIVE`).
- `fin_ar_invoices` has 1 row and is not in `schema.prisma`, so it gets no coercion.
- `erp_chart_of_accounts_backup_20260823` is still in the live schema.

## Root-cause conclusion
1. **Schema**: BigInt vs UUID mismatch on `fin_pdc_register` / `fin_legal_receivables`, missing id defaults, and manual migrations with no tracking. This is the cause of silent NULLs and hard insert failures.
2. **Data handling**: the proxy and query shim hide failures, and UI columns do not match the live tables, so updates and filters error out or are ignored.
3. **Architecture**: lease and cheque state split between tables and kv blobs, an empty periods table, and an unauthenticated tenant fallback.

## Recommended next steps (not yet done)
1. Convert `fin_pdc_register` and `fin_legal_receivables` tenant/property/unit columns to `varchar(36)` and backfill PDC refs from `leases`.
2. Add auto_increment (or UUID defaults) to the 26 `mst_*` ids, and move `fin_pdc_register` off `app_sequences`.
3. Commit the DDL for `app_kv_store`, `app_sequences`, `fin_ar_invoices` and the other hand-made tables, and add a migration tracking table.
4. Fix the UI column names to match the live schema, starting with the leases, vouchers and PDC modules.
5. Move the lease and cheque kv blobs into `leases` / `fin_pdc_register`.
6. Seed `fin_posting_periods`, and put the tenant id into user metadata.
7. Apply the P0 security fixes from the audit (profile role escalation, password hash, kv access).

## Security note
The database password was pasted in chat. It was passed only through an environment variable for the probe and is not stored in any file. Consider rotating it, and note that port 3307 on a public IP is reachable from the internet.
