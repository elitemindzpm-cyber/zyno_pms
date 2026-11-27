-- fin_bank_accounts.status: the Bank Account screen and the bank pickers filter on it, but the column did not exist,
-- so every create/update that sent a status failed.
ALTER TABLE fin_bank_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Active';
-- Rollback: ALTER TABLE fin_bank_accounts DROP COLUMN status;
