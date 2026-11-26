-- Tenant, property and unit IDs are UUIDs. tenant_id was a required bigint, so no deposit could be saved.
-- The table was empty when this ran and has no foreign keys.
ALTER TABLE fin_deposits MODIFY COLUMN tenant_id VARCHAR(36) NULL;
ALTER TABLE fin_deposits MODIFY COLUMN property_id VARCHAR(36) NULL;
ALTER TABLE fin_deposits MODIFY COLUMN unit_id VARCHAR(36) NULL;
-- Rollback: ALTER TABLE fin_deposits MODIFY COLUMN tenant_id BIGINT NOT NULL; ALTER TABLE fin_deposits MODIFY COLUMN property_id BIGINT NULL; ALTER TABLE fin_deposits MODIFY COLUMN unit_id BIGINT NULL;
