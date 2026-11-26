-- Lease IDs are UUIDs, so fin_deposits.lease_id becomes text.
-- payment_mode records how a security deposit was paid: Cash, Bank, Cheque or Split.
ALTER TABLE fin_deposits MODIFY COLUMN lease_id VARCHAR(36) NULL;
ALTER TABLE fin_deposits ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(64) NULL;
-- Rollback: ALTER TABLE fin_deposits DROP COLUMN payment_mode; ALTER TABLE fin_deposits MODIFY COLUMN lease_id BIGINT NULL;
