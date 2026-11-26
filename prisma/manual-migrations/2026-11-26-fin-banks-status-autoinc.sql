-- fin_banks: Add Bank failed silently (id had no default, status column missing), so banks never persisted.
ALTER TABLE fin_banks
  MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Active';
-- Rollback: ALTER TABLE fin_banks DROP COLUMN status, MODIFY COLUMN id INT NOT NULL;
