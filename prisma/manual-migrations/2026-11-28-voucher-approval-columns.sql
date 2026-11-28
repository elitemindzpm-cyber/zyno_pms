-- C5: voucher approval workflow columns (voucher-approval-service.ts wrote these but they did not exist).
-- Additive and idempotent (MariaDB 10.5+).
ALTER TABLE fin_vouchers
  ADD COLUMN IF NOT EXISTS approval_status  VARCHAR(32)  NULL,
  ADD COLUMN IF NOT EXISTS narration        TEXT         NULL,
  ADD COLUMN IF NOT EXISTS origin_module    VARCHAR(64)  NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by      VARCHAR(36)  NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at      DATETIME(6)  NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT         NULL;
CREATE INDEX IF NOT EXISTS idx_fin_vouchers_approval_status ON fin_vouchers (approval_status);
