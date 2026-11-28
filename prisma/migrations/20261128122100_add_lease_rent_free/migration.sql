-- Add rent-free columns directly to leases (E1: eliminate KV override dependency for lease terms)
ALTER TABLE `leases`
  ADD COLUMN IF NOT EXISTS `has_rent_free` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `rent_free_period_days` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `rent_free_position` VARCHAR(32) NOT NULL DEFAULT 'FIRST_MONTH';
