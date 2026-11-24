-- Database-level uniqueness (NULLs are allowed to repeat, so optional fields are unaffected).
-- Text columns need a key prefix length, which Prisma's schema cannot express, so these live here.
-- Rollback: DROP INDEX uq_units_property_unit ON units; DROP INDEX uq_customers_qatar_id ON customers;
--           DROP INDEX uq_customers_tax_id ON customers; DROP INDEX uq_fin_pdc_lease_cheque ON fin_pdc_register;
CREATE UNIQUE INDEX uq_units_property_unit ON units (property_id, unit_number(100));
CREATE UNIQUE INDEX uq_customers_qatar_id ON customers (qatar_id(64));
CREATE UNIQUE INDEX uq_customers_tax_id ON customers (tax_identification_no(64));
CREATE UNIQUE INDEX uq_fin_pdc_lease_cheque ON fin_pdc_register (lease_id, cheque_number(100));
