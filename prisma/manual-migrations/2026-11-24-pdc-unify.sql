-- Unifies the lease PDC schedule with the PDC register (fin_pdc_register is the single PDC store).
ALTER TABLE fin_pdc_register ADD COLUMN IF NOT EXISTS lease_id VARCHAR(36) NULL;
CREATE INDEX idx_fin_pdc_register_lease ON fin_pdc_register (lease_id);
-- Rollback: DROP INDEX idx_fin_pdc_register_lease ON fin_pdc_register; ALTER TABLE fin_pdc_register DROP COLUMN lease_id;
