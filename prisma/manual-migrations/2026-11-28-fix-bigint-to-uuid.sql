-- =============================================================================
-- C1: fin_pdc_register — BigInt → VARCHAR(36) for tenant_id, property_id, unit_id
-- C2: fin_legal_receivables — BigInt → VARCHAR(36) for tenant_id, property_id, unit_id, lease_id
-- C3: fin_pdc_register.id — add AUTO_INCREMENT so manual sequence is no longer needed
-- C4: mst_* tables — add AUTO_INCREMENT to all Int @id columns that lack it
-- A7: Seed posting periods so the "missing = open" gap is closed
-- =============================================================================

-- ── STEP 0: Safety ──────────────────────────────────────────────────────────
-- Back up the tables before altering them.
-- MariaDB: CREATE TABLE ... AS SELECT makes a full copy.
CREATE TABLE IF NOT EXISTS _bak_fin_pdc_register AS SELECT * FROM fin_pdc_register;
CREATE TABLE IF NOT EXISTS _bak_fin_legal_receivables AS SELECT * FROM fin_legal_receivables;

-- ── STEP 1: C1 — fin_pdc_register BigInt → VARCHAR(36) ─────────────────────
-- Drop the index first (if it conflicts), then alter columns.
ALTER TABLE fin_pdc_register
  MODIFY COLUMN tenant_id   VARCHAR(36) NULL,
  MODIFY COLUMN property_id VARCHAR(36) NULL,
  MODIFY COLUMN unit_id     VARCHAR(36) NULL;

-- Backfill from leases (the only source of truth for these references).
UPDATE fin_pdc_register pdc
  JOIN leases l ON l.id = pdc.lease_id
  SET pdc.tenant_id   = l.customer_id,
      pdc.property_id = l.property_id,
      pdc.unit_id     = l.unit_id
  WHERE pdc.lease_id IS NOT NULL
    AND (pdc.tenant_id IS NULL OR pdc.property_id IS NULL OR pdc.unit_id IS NULL);

-- ── STEP 2: C2 — fin_legal_receivables BigInt → VARCHAR(36) ────────────────
ALTER TABLE fin_legal_receivables
  MODIFY COLUMN tenant_id   VARCHAR(36) NOT NULL,
  MODIFY COLUMN property_id VARCHAR(36) NULL,
  MODIFY COLUMN unit_id     VARCHAR(36) NULL,
  MODIFY COLUMN lease_id    VARCHAR(36) NULL;

-- ── STEP 3: C3 — fin_pdc_register.id AUTO_INCREMENT ────────────────────────
-- The current max id must be less than the new auto_increment start.
ALTER TABLE fin_pdc_register MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;

-- ── STEP 4: C4 — mst_* tables: add AUTO_INCREMENT to Int PK columns ───────
-- Disable FK checks temporarily because mst_asset_subcategories and mst_unit_codes reference these PKs.
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE mst_asset_categories         MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_asset_conditions         MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_asset_ownership_types    MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_asset_statuses           MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_asset_subcategories      MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_departments              MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_designations             MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_employee_statuses        MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_employment_types         MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_facilities               MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_genders                  MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_payment_modes            MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_property_codes           MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_ticket_categories        MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_unit_codes               MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mst_work_locations           MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
SET FOREIGN_KEY_CHECKS = 1;

-- ── STEP 5: A7 — Seed posting periods ──────────────────────────────────────
-- Generate periods for 2024, 2025, and 2026, all Open by default.
-- Existing rows are skipped by INSERT IGNORE (period_name is UNIQUE).
INSERT IGNORE INTO fin_posting_periods (period_name, year, month, status) VALUES
  ('2024-01', '2024', 1, 'Open'), ('2024-02', '2024', 2, 'Open'), ('2024-03', '2024', 3, 'Open'),
  ('2024-04', '2024', 4, 'Open'), ('2024-05', '2024', 5, 'Open'), ('2024-06', '2024', 6, 'Open'),
  ('2024-07', '2024', 7, 'Open'), ('2024-08', '2024', 8, 'Open'), ('2024-09', '2024', 9, 'Open'),
  ('2024-10', '2024', 10, 'Open'), ('2024-11', '2024', 11, 'Open'), ('2024-12', '2024', 12, 'Open'),
  ('2025-01', '2025', 1, 'Open'), ('2025-02', '2025', 2, 'Open'), ('2025-03', '2025', 3, 'Open'),
  ('2025-04', '2025', 4, 'Open'), ('2025-05', '2025', 5, 'Open'), ('2025-06', '2025', 6, 'Open'),
  ('2025-07', '2025', 7, 'Open'), ('2025-08', '2025', 8, 'Open'), ('2025-09', '2025', 9, 'Open'),
  ('2025-10', '2025', 10, 'Open'), ('2025-11', '2025', 11, 'Open'), ('2025-12', '2025', 12, 'Open'),
  ('2026-01', '2026', 1, 'Open'), ('2026-02', '2026', 2, 'Open'), ('2026-03', '2026', 3, 'Open'),
  ('2026-04', '2026', 4, 'Open'), ('2026-05', '2026', 5, 'Open'), ('2026-06', '2026', 6, 'Open'),
  ('2026-07', '2026', 7, 'Open'), ('2026-08', '2026', 8, 'Open'), ('2026-09', '2026', 9, 'Open'),
  ('2026-10', '2026', 10, 'Open'), ('2026-11', '2026', 11, 'Open'), ('2026-12', '2026', 12, 'Open');

-- ── Done ────────────────────────────────────────────────────────────────────
-- After running this, regenerate Prisma client:
--   npx prisma db pull
--   npx prisma generate
