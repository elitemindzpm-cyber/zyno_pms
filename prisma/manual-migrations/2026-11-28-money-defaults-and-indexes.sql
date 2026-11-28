-- =============================================================================
-- B11: Normalize NULL money columns to 0.0000 and set NOT NULL DEFAULT 0.0000
-- C8 / C9: Add missing query performance indexes on fin_pdc_register & fin_voucher_lines
-- =============================================================================

-- ── STEP 1: B11 — Backfill NULL money columns to 0 before setting NOT NULL ───
UPDATE fin_pdc_register      SET amount = 0.0000 WHERE amount IS NULL;
UPDATE fin_vouchers          SET total_amount = 0.0000 WHERE total_amount IS NULL;
UPDATE fin_voucher_lines     SET debit_amount = 0.0000 WHERE debit_amount IS NULL;
UPDATE fin_voucher_lines     SET credit_amount = 0.0000 WHERE credit_amount IS NULL;
UPDATE fin_legal_receivables SET original_amount = 0.0000 WHERE original_amount IS NULL;
UPDATE fin_legal_receivables SET outstanding_balance = 0.0000 WHERE outstanding_balance IS NULL;

ALTER TABLE fin_pdc_register
  MODIFY COLUMN amount DECIMAL(18, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE fin_vouchers
  MODIFY COLUMN total_amount DECIMAL(18, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE fin_voucher_lines
  MODIFY COLUMN debit_amount  DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  MODIFY COLUMN credit_amount DECIMAL(18, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE fin_legal_receivables
  MODIFY COLUMN original_amount     DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  MODIFY COLUMN outstanding_balance DECIMAL(18, 4) NOT NULL DEFAULT 0.0000;

-- ── STEP 2: C9 — Missing indexes on fin_pdc_register and fin_voucher_lines ──
CREATE INDEX IF NOT EXISTS idx_fin_pdc_register_tenant   ON fin_pdc_register (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_pdc_register_property ON fin_pdc_register (property_id);
CREATE INDEX IF NOT EXISTS idx_fin_pdc_register_unit     ON fin_pdc_register (unit_id);
CREATE INDEX IF NOT EXISTS idx_fin_pdc_register_status   ON fin_pdc_register (status);
CREATE INDEX IF NOT EXISTS idx_fin_voucher_lines_code    ON fin_voucher_lines (account_code(50));
