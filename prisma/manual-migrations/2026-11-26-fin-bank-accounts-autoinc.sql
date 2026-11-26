-- fin_bank_accounts: id had no AUTO_INCREMENT, so inserts failed and accounts fell back to app_kv_store.
ALTER TABLE fin_bank_accounts MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
-- Rollback: ALTER TABLE fin_bank_accounts MODIFY COLUMN id INT NOT NULL;
