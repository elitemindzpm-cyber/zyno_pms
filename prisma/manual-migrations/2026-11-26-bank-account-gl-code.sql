-- Each company bank account posts to its own GL code, assigned in sequence from 12000001.
-- Banks themselves (fin_banks) carry no GL code, and 12000000 is the GL control account, never assigned.
ALTER TABLE fin_bank_accounts ADD COLUMN IF NOT EXISTS gl_code VARCHAR(20) NULL;
ALTER TABLE fin_bank_accounts ADD UNIQUE INDEX IF NOT EXISTS uq_fin_bank_accounts_gl_code (gl_code);
-- Rollback: ALTER TABLE fin_bank_accounts DROP INDEX uq_fin_bank_accounts_gl_code; ALTER TABLE fin_bank_accounts DROP COLUMN gl_code;
