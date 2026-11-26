-- Persists lease collection progress so Collect stays locked after a reload.
-- NULL = nothing collected yet, 'deposit_collected', 'rent_collected' or 'collection_completed'.
ALTER TABLE leases ADD COLUMN IF NOT EXISTS collection_status VARCHAR(32) NULL;
-- Rollback: ALTER TABLE leases DROP COLUMN collection_status;
