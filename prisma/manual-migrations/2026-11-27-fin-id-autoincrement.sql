-- These fin_* tables had an integer primary key with no AUTO_INCREMENT, so any insert that did not supply an id
-- failed ("Argument id is missing"). That broke saving security deposits (fin_deposits) and the Setup screens.
ALTER TABLE fin_deposits MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_legal_receivables MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_payroll_syncs MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_bank_reconciliations MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_contracts MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_cost_centers MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_customers MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_financial_years MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_posting_periods MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fin_regions MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
-- Rollback: ALTER TABLE <table> MODIFY COLUMN id <same type> NOT NULL;  (fin_pdc_register keeps its own id handling)
