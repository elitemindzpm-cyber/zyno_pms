-- Additive columns for the procurement, asset, pricing and approval features.
-- Applied to pms_db on 2026-11-23. Rollback: ALTER TABLE assets DROP COLUMN salvage_value; ALTER TABLE units DROP COLUMN market_rent; ALTER TABLE employees DROP COLUMN approval_limit;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS salvage_value DECIMAL(18,4) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS market_rent DECIMAL(18,4) NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS approval_limit DECIMAL(18,4) NULL;
