-- =============================================================================
-- C8:  Drop duplicate unique index on fin_accounting_event_lines
-- C11: Drop temporary backup tables (_bak_fin_pdc_register, _bak_fin_legal_receivables)
-- D7:  Single VAT rate source and GL account configuration (fin_tax_configs)
-- E3:  Create dedicated relational tables for Maintenance, Finance Notes/Receipts/Budgets, and Asset Lifecycle
-- =============================================================================

-- C8: Remove duplicate unique constraint on (event_id, line_number)
DROP INDEX IF EXISTS `ux_fin_event_lines_event_line` ON `fin_accounting_event_lines`;

-- C11: Remove temporary migration backup tables (full backup saved on disk)
DROP TABLE IF EXISTS `_bak_fin_pdc_register`;
DROP TABLE IF EXISTS `_bak_fin_legal_receivables`;

-- D7: Single authoritative VAT configuration table
CREATE TABLE IF NOT EXISTS `fin_tax_configs` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `rate` DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
  `output_gl_code` VARCHAR(50) NOT NULL DEFAULT '21300',
  `input_gl_code` VARCHAR(50) NOT NULL DEFAULT '12500',
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin_tax_configs_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `fin_tax_configs` (`id`, `code`, `name`, `rate`, `output_gl_code`, `input_gl_code`, `is_default`, `is_active`) VALUES
  ('tax-vat-0', 'VAT-0', 'Zero Rated / Exempt (0%)', 0.0000, '21300', '12500', true, true),
  ('tax-vat-5', 'VAT-5', 'Standard VAT (5%)', 5.0000, '21300', '12500', false, true);

-- E3: Credit & Debit Notes
CREATE TABLE IF NOT EXISTS `fin_credit_debit_notes` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `note_number` VARCHAR(100) NOT NULL,
  `note_type` VARCHAR(20) NOT NULL,
  `party_type` VARCHAR(30) NOT NULL,
  `party_id` VARCHAR(64) NULL,
  `party_name` VARCHAR(255) NOT NULL,
  `linked_agreement` VARCHAR(100) NULL,
  `linked_invoice` VARCHAR(100) NULL,
  `amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `account_code` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `note_date` DATE NOT NULL,
  `voucher_number` VARCHAR(255) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin_credit_debit_notes_no` (`note_number`),
  KEY `idx_fin_cdn_type_status` (`note_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Procurement / AP Payment Receipts
CREATE TABLE IF NOT EXISTS `fin_payment_receipts` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `receipt_number` VARCHAR(100) NOT NULL,
  `voucher_number` VARCHAR(100) NOT NULL,
  `invoice_number` VARCHAR(100) NOT NULL,
  `po_number` VARCHAR(100) NULL,
  `grn_number` VARCHAR(100) NULL,
  `vendor_id` VARCHAR(64) NULL,
  `vendor_name` VARCHAR(255) NULL,
  `amount_paid` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(100) NULL,
  `reference_no` VARCHAR(100) NULL,
  `bank_account` VARCHAR(255) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Settled',
  `remarks` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin_payment_receipts_no` (`receipt_number`),
  KEY `idx_fin_payment_receipts_inv` (`invoice_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Finance Budget Heads
CREATE TABLE IF NOT EXISTS `fin_budget_heads` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `budget_type` VARCHAR(30) NOT NULL DEFAULT 'OPEX',
  `annual_limit` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `allocated_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `fiscal_year` INT NOT NULL DEFAULT 2026,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin_budget_heads_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Maintenance Work Orders
CREATE TABLE IF NOT EXISTS `maintenance_work_orders` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `wo_number` VARCHAR(64) NOT NULL,
  `ticket_id` VARCHAR(64) NULL,
  `property` VARCHAR(255) NULL,
  `unit_ref` VARCHAR(100) NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NULL,
  `priority` VARCHAR(30) NOT NULL DEFAULT 'medium',
  `status` VARCHAR(40) NOT NULL DEFAULT 'open',
  `assigned_to` VARCHAR(255) NULL,
  `scheduled_date` DATE NULL,
  `completed_date` DATE NULL,
  `estimated_cost` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `actual_cost` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `notes` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_maintenance_work_orders_no` (`wo_number`),
  KEY `idx_mwo_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Maintenance Technicians
CREATE TABLE IF NOT EXISTS `maintenance_technicians` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(64) NULL,
  `email` VARCHAR(255) NULL,
  `specialty` VARCHAR(120) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'available',
  `rating` DECIMAL(4, 2) NOT NULL DEFAULT 5.00,
  `active_jobs` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Maintenance PPM Schedules
CREATE TABLE IF NOT EXISTS `maintenance_ppm_schedules` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `title` VARCHAR(255) NOT NULL,
  `property` VARCHAR(255) NULL,
  `asset_name` VARCHAR(255) NULL,
  `category` VARCHAR(100) NULL,
  `frequency` VARCHAR(40) NOT NULL DEFAULT 'Monthly',
  `next_due_date` DATE NOT NULL,
  `last_completed_date` DATE NULL,
  `assigned_to` VARCHAR(255) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Maintenance Ticket & Work Order Comments
CREATE TABLE IF NOT EXISTS `maintenance_comments` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `entity_type` VARCHAR(20) NOT NULL,
  `entity_id` VARCHAR(64) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `role` VARCHAR(64) NOT NULL,
  `comment` TEXT NOT NULL,
  `attachments_json` LONGTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_mc_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- E3: Asset Lifecycle Records (revaluations, sales, write-offs, allocations, maintenance, warranties)
CREATE TABLE IF NOT EXISTS `asset_lifecycle_records` (
  `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `record_type` VARCHAR(40) NOT NULL,
  `asset_id` VARCHAR(64) NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_alr_type` (`record_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
