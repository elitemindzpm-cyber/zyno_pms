-- =====================================================================
-- PMS Database Schema Migration: Supabase PostgreSQL -> MariaDB 10.5+ / MySQL 8+
-- Target Database: pms_db
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_general_ci
-- Total Application Tables: 151 (150 public + 1 users identity stub)
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';
START TRANSACTION;

-- =====================================================================
-- 0. PREREQUISITE: User Identity Table (resolving 9 auth.users FKs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NULL,
    `role` VARCHAR(50) DEFAULT 'USER',
    `raw_user_meta_data` JSON NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================================
-- 1. APPLICATION TABLES (150 tables)
-- =====================================================================
-- Table: amenities
CREATE TABLE IF NOT EXISTS `amenities` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NOT NULL,
    `icon` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: assets
CREATE TABLE IF NOT EXISTS `assets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `asset_code` VARCHAR(255) NULL,
    `asset_name` TEXT NOT NULL,
    `category` VARCHAR(255) NULL,
    `subcategory` TEXT NULL,
    `brand` TEXT NULL,
    `model` TEXT NULL,
    `serial_number` TEXT NULL,
    `ownership_type` TEXT NULL,
    `purchase_date` DATE NULL,
    `supplier` TEXT NULL,
    `purchase_cost` DECIMAL(18, 4) NULL DEFAULT 0,
    `warranty_expiry_date` DATE NULL,
    `warranty_status` TEXT NULL,
    `department_id` VARCHAR(36) NULL,
    `assigned_property_id` VARCHAR(36) NULL,
    `assigned_unit_id` VARCHAR(36) NULL,
    `assigned_employee_id` VARCHAR(36) NULL,
    `assignment_date` DATE NULL,
    `asset_condition` TEXT NULL,
    `asset_status` TEXT NULL DEFAULT 'Available',
    `life_of_asset` INT NULL,
    `opening_cost` DECIMAL(18, 4) NULL DEFAULT 0,
    `last_service_date` DATE NULL,
    `next_service_date` DATE NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `assigned_property_code` TEXT NULL,
    `assigned_unit_code` TEXT NULL,
    `assigned_employee_name` TEXT NULL,
    `addition_during_year` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_asset_value` DECIMAL(18, 4) NULL DEFAULT 0,
    `disposal_value` DECIMAL(18, 4) NULL DEFAULT 0,
    `opening_accumulated_depreciation` DECIMAL(18, 4) NULL DEFAULT 0,
    `current_year_depreciation` DECIMAL(18, 4) NULL DEFAULT 0,
    `closing_accumulated_depreciation` DECIMAL(18, 4) NULL DEFAULT 0,
    `net_book_value` DECIMAL(18, 4) NULL DEFAULT 0,
    `return_date` DATE NULL,
    `disposal_date` DATE NULL,
    `department` TEXT NULL,
    `depreciation_method` TEXT NULL,
    `depreciation_rate` DECIMAL(18, 4) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: bookings
CREATE TABLE IF NOT EXISTS `bookings` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `property_id` VARCHAR(36) NULL,
    `guest_id` VARCHAR(36) NULL,
    `check_in` DATE NOT NULL,
    `check_out` DATE NOT NULL,
    `guests_count` INT NOT NULL,
    `total_price` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'PENDING',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: coa_classes
CREATE TABLE IF NOT EXISTS `coa_classes` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `group_id` VARCHAR(36) NOT NULL,
    `type_id` VARCHAR(36) NOT NULL,
    `group_code` TEXT NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: coa_gl
CREATE TABLE IF NOT EXISTS `coa_gl` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `class_id` VARCHAR(36) NOT NULL,
    `group_id` VARCHAR(36) NOT NULL,
    `type_id` VARCHAR(36) NOT NULL,
    `class_code` TEXT NOT NULL,
    `group_code` TEXT NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `normal_balance` TEXT NOT NULL,
    `is_control_account` TINYINT(1) NOT NULL DEFAULT 0,
    `is_posting_account` TINYINT(1) NOT NULL DEFAULT 1,
    `allows_direct_posting` TINYINT(1) NOT NULL DEFAULT 1,
    `requires_property` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_unit` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_tenant` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_vendor` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_employee` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_asset` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_inventory` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_security_deposit` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_pdc` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_lease` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: coa_groups
CREATE TABLE IF NOT EXISTS `coa_groups` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `type_id` VARCHAR(36) NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: coa_sl
CREATE TABLE IF NOT EXISTS `coa_sl` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `gl_id` VARCHAR(36) NOT NULL,
    `class_id` VARCHAR(36) NOT NULL,
    `group_id` VARCHAR(36) NOT NULL,
    `type_id` VARCHAR(36) NOT NULL,
    `gl_code` TEXT NOT NULL,
    `class_code` TEXT NOT NULL,
    `group_code` TEXT NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `normal_balance` TEXT NOT NULL,
    `is_control_account` TINYINT(1) NOT NULL DEFAULT 0,
    `is_posting_account` TINYINT(1) NOT NULL DEFAULT 1,
    `allows_direct_posting` TINYINT(1) NOT NULL DEFAULT 1,
    `requires_property` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_unit` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_tenant` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_vendor` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_employee` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_asset` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_inventory` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_security_deposit` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_pdc` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_lease` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: coa_types
CREATE TABLE IF NOT EXISTS `coa_types` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `normal_balance` TEXT NOT NULL,
    `report_type` TEXT NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: collection_receipts
CREATE TABLE IF NOT EXISTS `collection_receipts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `lease_collection_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `receipt_no` VARCHAR(255) NOT NULL,
    `receipt_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `tenant_name` TEXT NOT NULL,
    `property_unit` TEXT NOT NULL,
    `payment_type` TEXT NOT NULL,
    `payment_method` TEXT NOT NULL,
    `transaction_reference` TEXT NULL,
    `amount` DECIMAL(18, 4) NULL,
    `collection_period` TEXT NULL,
    `cashier_name` TEXT NULL,
    `print_count` INT NOT NULL DEFAULT 0,
    `emailed_at` DATETIME(6) NULL,
    `shared_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `original_receipt_id` VARCHAR(36) NULL,
    `version` INT NULL DEFAULT 1,
    `cancellation_reason` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: customers
CREATE TABLE IF NOT EXISTS `customers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `customer_type` TEXT NULL DEFAULT 'Individual',
    `full_name` TEXT NOT NULL,
    `qatar_id` TEXT NULL,
    `passport_number` TEXT NULL,
    `commercial_registration` TEXT NULL,
    `nationality` TEXT NULL,
    `mobile_number` TEXT NULL,
    `email_address` TEXT NULL,
    `permanent_address` TEXT NULL,
    `local_address` TEXT NULL,
    `emergency_contact_name` TEXT NULL,
    `emergency_contact_phone` TEXT NULL,
    `employer_name` TEXT NULL,
    `employer_address` TEXT NULL,
    `designation` TEXT NULL,
    `monthly_income` DECIMAL(18, 4) NULL,
    `authorized_signatory_name` TEXT NULL,
    `authorized_signatory_id` TEXT NULL,
    `verification_status` TEXT NULL DEFAULT 'Pending',
    `verified_by` VARCHAR(36) NULL,
    `verified_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `deleted_at` DATETIME(6) NULL,
    `approval_status` TEXT NULL DEFAULT 'Approved',
    `display_name` TEXT NULL,
    `primary_mobile` TEXT NULL,
    `primary_email` TEXT NULL,
    `current_address` TEXT NULL,
    `preferred_communication` TEXT NULL,
    `customer_status` TEXT NULL DEFAULT 'Active',
    `remarks` TEXT NULL,
    `first_name` TEXT NULL,
    `middle_name` TEXT NULL,
    `last_name` TEXT NULL,
    `qid_expiry_date` DATE NULL,
    `passport_expiry_date` DATE NULL,
    `date_of_birth` DATE NULL,
    `gender` TEXT NULL,
    `company_legal_name` TEXT NULL,
    `trade_name` TEXT NULL,
    `cr_expiry_date` DATE NULL,
    `trade_licence_no` TEXT NULL,
    `trade_licence_expiry_date` DATE NULL,
    `computer_card_no` TEXT NULL,
    `computer_card_expiry_date` DATE NULL,
    `tax_identification_no` TEXT NULL,
    `registered_office_address` TEXT NULL,
    `billing_address` TEXT NULL,
    `company_telephone` TEXT NULL,
    `website` TEXT NULL,
    `industry_activity` TEXT NULL,
    `signatory_qid_passport` TEXT NULL,
    `signatory_id_expiry_date` DATE NULL,
    `primary_contact_person` TEXT NULL,
    `contact_designation` TEXT NULL,
    `contact_mobile` TEXT NULL,
    `contact_email` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: departments
CREATE TABLE IF NOT EXISTS `departments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `code` VARCHAR(255) NULL,
    `company_id` VARCHAR(36) NULL,
    `business_unit_id` VARCHAR(36) NULL,
    `department_head_id` VARCHAR(36) NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: designations
CREATE TABLE IF NOT EXISTS `designations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `title` VARCHAR(255) NOT NULL,
    `department_id` VARCHAR(36) NULL,
    `level` INT NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `code` VARCHAR(255) NULL,
    `grade_id` VARCHAR(36) NULL,
    `job_level` INT NULL DEFAULT 1,
    `is_active` TINYINT(1) NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: employees
CREATE TABLE IF NOT EXISTS `employees` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id_code` VARCHAR(255) NULL,
    `user_id` VARCHAR(36) NULL,
    `first_name` TEXT NOT NULL,
    `last_name` TEXT NOT NULL,
    `gender` TEXT NULL,
    `nationality` TEXT NULL,
    `date_of_birth` DATE NULL,
    `mobile_number` TEXT NULL,
    `email` VARCHAR(255) NULL,
    `department_id` VARCHAR(36) NULL,
    `designation_id` VARCHAR(36) NULL,
    `reporting_manager_id` VARCHAR(36) NULL,
    `date_of_joining` DATE NULL,
    `employment_type` TEXT NULL,
    `qid_passport_no` TEXT NULL,
    `id_expiry_date` DATE NULL,
    `basic_salary` DECIMAL(18, 4) NULL DEFAULT 0,
    `hra` DECIMAL(18, 4) NULL DEFAULT 0,
    `tra` DECIMAL(18, 4) NULL DEFAULT 0,
    `other_allowances` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_salary` DECIMAL(18, 4) NULL,
    `bank_name` TEXT NULL,
    `iban` TEXT NULL,
    `air_ticket` TEXT NULL,
    `employee_status` TEXT NULL DEFAULT 'Active',
    `emergency_contact_name` TEXT NULL,
    `emergency_contact_relation` TEXT NULL,
    `emergency_contact_number` TEXT NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `company_id` VARCHAR(36) NULL,
    `branch_id` VARCHAR(36) NULL,
    `business_unit_id` VARCHAR(36) NULL,
    `sub_department_id` VARCHAR(36) NULL,
    `grade_id` VARCHAR(36) NULL,
    `hr_manager_id` VARCHAR(36) NULL,
    `official_email` TEXT NULL,
    `marital_status` TEXT NULL DEFAULT 'Single',
    `contract_type` TEXT NULL DEFAULT 'Permanent',
    `probation_status` TEXT NULL DEFAULT 'In Probation',
    `probation_end_date` DATE NULL,
    `confirmation_date` DATE NULL,
    `notice_period_days` INT NULL DEFAULT 30,
    `date_of_exit` DATE NULL,
    `exit_reason` TEXT NULL,
    `rehire_eligible` TINYINT(1) NULL DEFAULT 1,
    `device_user_id` TEXT NULL,
    `bank_account_holder` TEXT NULL,
    `bank_account_type` TEXT NULL DEFAULT 'Checking',
    `swift_code` TEXT NULL,
    `emergency_contacts` JSON NULL DEFAULT ('[]'),
    `qualifications` JSON NULL DEFAULT ('[]'),
    `previous_experience` JSON NULL DEFAULT ('[]')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: erp_chart_of_accounts
CREATE TABLE IF NOT EXISTS `erp_chart_of_accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `type_code` TEXT NULL,
    `type_name` TEXT NULL,
    `group_code` TEXT NULL,
    `group_name` TEXT NULL,
    `class_code` TEXT NULL,
    `class_name` TEXT NULL,
    `gl_code` VARCHAR(255) NULL,
    `gl_name` TEXT NULL,
    `sl_code` TEXT NULL,
    `sl_name` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: erp_chart_of_accounts_backup_20260823
CREATE TABLE IF NOT EXISTS `erp_chart_of_accounts_backup_20260823` (
    `id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NULL,
    `name` VARCHAR(255) NULL,
    `type` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NULL,
    `type_code` TEXT NULL,
    `type_name` TEXT NULL,
    `group_code` TEXT NULL,
    `group_name` TEXT NULL,
    `class_code` TEXT NULL,
    `class_name` TEXT NULL,
    `gl_code` TEXT NULL,
    `gl_name` TEXT NULL,
    `sl_code` TEXT NULL,
    `sl_name` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: erp_journal_entries
CREATE TABLE IF NOT EXISTS `erp_journal_entries` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `voucher_id` VARCHAR(36) NULL,
    `account_id` VARCHAR(36) NULL,
    `account_name` TEXT NULL,
    `debit` DECIMAL(18, 4) NULL,
    `credit` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `accounting_event_id` VARCHAR(36) NULL,
    `line_number` INT NULL,
    `description` TEXT NULL,
    `lease_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: erp_vouchers
CREATE TABLE IF NOT EXISTS `erp_vouchers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `voucher_no` VARCHAR(255) NOT NULL,
    `voucher_type` TEXT NOT NULL,
    `voucher_date` DATE NOT NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `accounting_event_id` VARCHAR(36) NULL,
    `source_type` VARCHAR(255) NULL,
    `source_id` VARCHAR(36) NULL,
    `posting_status` VARCHAR(255) NOT NULL DEFAULT 'POSTED',
    `reversal_of_voucher_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_account_mappings
CREATE TABLE IF NOT EXISTS `fin_account_mappings` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `mapping_key` VARCHAR(255) NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `account_code` TEXT NULL,
    `account_name` TEXT NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `company_id` VARCHAR(36) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `effective_from` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `effective_to` DATE NULL,
    `metadata` JSON NOT NULL DEFAULT ('{}'),
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_accounting_event_lines
CREATE TABLE IF NOT EXISTS `fin_accounting_event_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `event_id` VARCHAR(36) NOT NULL,
    `line_number` INT NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `account_code` VARCHAR(255) NULL,
    `account_name` TEXT NULL,
    `debit` DECIMAL(18, 4) NULL,
    `credit` DECIMAL(18, 4) NULL,
    `description` TEXT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `cost_center_id` VARCHAR(36) NULL,
    `source_type` TEXT NULL,
    `source_id` VARCHAR(36) NULL,
    `metadata` JSON NOT NULL DEFAULT ('{}'),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_accounting_events
CREATE TABLE IF NOT EXISTS `fin_accounting_events` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `event_type` ENUM('RENT_RECEIVABLE', 'RENT_COLLECTION', 'RENT_ADJUSTMENT', 'SECURITY_DEPOSIT_RECEIVED', 'SECURITY_DEPOSIT_TRANSFERRED', 'SECURITY_DEPOSIT_ADJUSTED', 'SECURITY_DEPOSIT_REFUNDED', 'PDC_RECEIVED', 'PDC_DEPOSITED', 'PDC_CLEARED', 'PDC_BOUNCED', 'PDC_CANCELLED', 'PDC_RETURNED', 'PDC_REPLACED', 'RECEIPT_CREATED', 'RECEIPT_CANCELLED', 'REFUND_CREATED', 'REFUND_CANCELLED', 'MANUAL_JOURNAL', 'ADJUSTMENT') NOT NULL,
    `status` ENUM('DRAFT', 'POSTING', 'POSTED', 'REVERSED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `event_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `posting_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `source_type` VARCHAR(255) NOT NULL,
    `source_id` VARCHAR(36) NULL,
    `reference_number` TEXT NULL,
    `description` TEXT NULL,
    `idempotency_key` VARCHAR(255) NOT NULL,
    `reversal_of_event_id` VARCHAR(36) NULL,
    `reversed_by_event_id` VARCHAR(36) NULL,
    `voucher_id` VARCHAR(36) NULL,
    `tenant_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `total_debit` DECIMAL(18, 4) NULL,
    `total_credit` DECIMAL(18, 4) NULL,
    `metadata` JSON NOT NULL DEFAULT ('{}'),
    `created_by` VARCHAR(36) NULL,
    `posted_by` VARCHAR(36) NULL,
    `reversed_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `posted_at` DATETIME(6) NULL,
    `reversed_at` DATETIME(6) NULL,
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_bank_accounts
CREATE TABLE IF NOT EXISTS `fin_bank_accounts` (
    `id` INT NOT NULL,
    `bank_id` INT NULL,
    `account_number` VARCHAR(255) NOT NULL,
    `account_title` TEXT NOT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `opening_balance` DECIMAL(18, 4) NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_bank_reconciliations
CREATE TABLE IF NOT EXISTS `fin_bank_reconciliations` (
    `id` INT NOT NULL,
    `account_number` TEXT NOT NULL,
    `statement_date` DATE NOT NULL,
    `statement_balance` DECIMAL(18, 4) NULL DEFAULT 0,
    `book_balance` DECIMAL(18, 4) NULL DEFAULT 0,
    `status` VARCHAR(255) NULL DEFAULT 'Pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_banks
CREATE TABLE IF NOT EXISTS `fin_banks` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `swift_code` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_coa_accounts
CREATE TABLE IF NOT EXISTS `fin_coa_accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `account_code` VARCHAR(255) NOT NULL,
    `account_name` TEXT NOT NULL,
    `account_type` VARCHAR(255) NOT NULL,
    `parent_id` VARCHAR(36) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `parent_account_id` VARCHAR(36) NULL,
    `group_name` TEXT NULL,
    `class_name` TEXT NULL,
    `account_level` VARCHAR(255) NOT NULL DEFAULT 'GL'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_contracts
CREATE TABLE IF NOT EXISTS `fin_contracts` (
    `id` INT NOT NULL,
    `contract_number` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `party_name` TEXT NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `total_value` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_cost_centers
CREATE TABLE IF NOT EXISTS `fin_cost_centers` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `manager` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_customers
CREATE TABLE IF NOT EXISTS `fin_customers` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NULL DEFAULT 'Individual',
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(255) NULL,
    `credit_limit` DECIMAL(18, 4) NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_deposits
CREATE TABLE IF NOT EXISTS `fin_deposits` (
    `id` BIGINT NOT NULL,
    `deposit_type` TEXT NOT NULL,
    `coa_account_code` TEXT NOT NULL,
    `amount` DECIMAL(18, 4) NULL,
    `tenant_id` BIGINT NOT NULL,
    `property_id` BIGINT NULL,
    `unit_id` BIGINT NULL,
    `lease_id` BIGINT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Held',
    `receipt_ref` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_financial_years
CREATE TABLE IF NOT EXISTS `fin_financial_years` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_legal_receivables
CREATE TABLE IF NOT EXISTS `fin_legal_receivables` (
    `id` BIGINT NOT NULL,
    `tenant_id` BIGINT NOT NULL,
    `property_id` BIGINT NULL,
    `unit_id` BIGINT NULL,
    `lease_id` BIGINT NULL,
    `original_amount` DECIMAL(18, 4) NULL,
    `outstanding_balance` DECIMAL(18, 4) NULL,
    `escalation_date` DATE NOT NULL,
    `reason` TEXT NULL,
    `legal_case_id` TEXT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_payment_allocations
CREATE TABLE IF NOT EXISTS `fin_payment_allocations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `receipt_id` VARCHAR(36) NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `tenant_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `receivable_reference` TEXT NULL,
    `payment_instrument_type` VARCHAR(255) NOT NULL,
    `payment_instrument_id` VARCHAR(36) NULL,
    `allocated_amount` DECIMAL(18, 4) NULL,
    `allocation_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `status` VARCHAR(255) NOT NULL DEFAULT 'ALLOCATED',
    `reversal_of_allocation_id` VARCHAR(36) NULL,
    `metadata` JSON NOT NULL DEFAULT ('{}'),
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_payroll_syncs
CREATE TABLE IF NOT EXISTS `fin_payroll_syncs` (
    `id` BIGINT NOT NULL,
    `payroll_run_id` TEXT NOT NULL,
    `period` TEXT NOT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Pending',
    `total_amount` DECIMAL(18, 4) NULL,
    `error_details` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_pdc_register
CREATE TABLE IF NOT EXISTS `fin_pdc_register` (
    `id` BIGINT NOT NULL,
    `cheque_number` TEXT NOT NULL,
    `bank_id` BIGINT NULL,
    `cheque_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NULL,
    `tenant_id` BIGINT NULL,
    `property_id` BIGINT NULL,
    `unit_id` BIGINT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'In Hand',
    `deposit_date` DATE NULL,
    `cleared_date` DATE NULL,
    `returned_date` DATE NULL,
    `original_pdc_id` BIGINT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_posting_periods
CREATE TABLE IF NOT EXISTS `fin_posting_periods` (
    `id` INT NOT NULL,
    `period_name` VARCHAR(255) NOT NULL,
    `year` TEXT NOT NULL,
    `month` INT NOT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Open'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_regions
CREATE TABLE IF NOT EXISTS `fin_regions` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_transaction_account_rules
CREATE TABLE IF NOT EXISTS `fin_transaction_account_rules` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `transaction_type` VARCHAR(255) NOT NULL,
    `payment_method` VARCHAR(255) NULL,
    `deposit_type` VARCHAR(255) NULL,
    `pdc_type` VARCHAR(255) NULL,
    `debit_gl_code` TEXT NOT NULL,
    `debit_sl_code` TEXT NULL,
    `credit_gl_code` TEXT NOT NULL,
    `credit_sl_code` TEXT NULL,
    `description` TEXT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_unit_sl_accounts
CREATE TABLE IF NOT EXISTS `fin_unit_sl_accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NOT NULL,
    `property_id` VARCHAR(36) NOT NULL,
    `gl_code` VARCHAR(255) NOT NULL,
    `sl_code` VARCHAR(255) NOT NULL,
    `sl_name` TEXT NOT NULL,
    `coa_account_id` VARCHAR(36) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_vendors
CREATE TABLE IF NOT EXISTS `fin_vendors` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `contact_person` TEXT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(255) NULL,
    `tax_number` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `vendor_type` TEXT NULL DEFAULT 'Supplier',
    `address` TEXT NULL,
    `city` VARCHAR(255) NULL DEFAULT 'Doha',
    `country` VARCHAR(255) NULL DEFAULT 'Qatar',
    `payment_terms` TEXT NULL DEFAULT 'Net 30 Days',
    `settlement_mode` TEXT NULL DEFAULT 'Bank Wire / Electronic Transfer (QNB)',
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `notes` TEXT NULL,
    `bank_name` TEXT NULL,
    `account_number` TEXT NULL,
    `iban` TEXT NULL,
    `swift_code` TEXT NULL,
    `cr_number` TEXT NULL,
    `cr_expiry_date` DATE NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_voucher_lines
CREATE TABLE IF NOT EXISTS `fin_voucher_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `voucher_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NOT NULL,
    `account_code` TEXT NULL,
    `account_name` TEXT NULL,
    `debit_amount` DECIMAL(18, 4) NULL,
    `credit_amount` DECIMAL(18, 4) NULL,
    `description` TEXT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `cost_center_id` VARCHAR(36) NULL,
    `source_type` VARCHAR(255) NULL,
    `source_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fin_vouchers
CREATE TABLE IF NOT EXISTS `fin_vouchers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `voucher_number` VARCHAR(255) NOT NULL,
    `voucher_date` DATE NOT NULL,
    `voucher_type` TEXT NOT NULL,
    `reference_no` TEXT NULL,
    `description` TEXT NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'DRAFT',
    `accounting_event_id` VARCHAR(36) NULL,
    `posted_by` VARCHAR(36) NULL,
    `posted_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_type` VARCHAR(255) NULL,
    `source_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fixed_assets
CREATE TABLE IF NOT EXISTS `fixed_assets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `property_id` VARCHAR(36) NULL,
    `unit_ref` TEXT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(255) NOT NULL,
    `barcode` TEXT NULL,
    `purchase_date` DATE NULL,
    `purchase_value` DECIMAL(18, 4) NULL,
    `current_value` DECIMAL(18, 4) NULL,
    `depreciation_rate` DECIMAL(18, 4) NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_announcements
CREATE TABLE IF NOT EXISTS `hrms_announcements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `priority` TEXT NULL DEFAULT 'Normal',
    `target_department_id` VARCHAR(36) NULL,
    `posted_by` VARCHAR(36) NULL,
    `is_published` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_appraisal_cycles
CREATE TABLE IF NOT EXISTS `hrms_appraisal_cycles` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `title` VARCHAR(255) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `interval_type` TEXT NULL DEFAULT 'Annual',
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_asset_allocations
CREATE TABLE IF NOT EXISTS `hrms_asset_allocations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `asset_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `allocated_date` DATE NOT NULL,
    `expected_return_date` DATE NULL,
    `returned_date` DATE NULL,
    `condition_at_allocation` TEXT NULL DEFAULT 'Good',
    `condition_at_return` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Allocated',
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_attendance_daily
CREATE TABLE IF NOT EXISTS `hrms_attendance_daily` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `attendance_date` DATE NOT NULL,
    `shift_id` VARCHAR(36) NULL,
    `first_in` DATETIME(6) NULL,
    `last_out` DATETIME(6) NULL,
    `total_working_hours` DECIMAL(18, 4) NULL DEFAULT 0,
    `break_hours` DECIMAL(18, 4) NULL DEFAULT 0,
    `late_minutes` INT NULL DEFAULT 0,
    `early_minutes` INT NULL DEFAULT 0,
    `overtime_minutes` INT NULL DEFAULT 0,
    `status` VARCHAR(255) NOT NULL DEFAULT 'PRESENT',
    `is_regularized` TINYINT(1) NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_attendance_raw_events
CREATE TABLE IF NOT EXISTS `hrms_attendance_raw_events` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `device_id` TEXT NULL,
    `device_user_id` TEXT NULL,
    `event_time` DATETIME(6) NOT NULL,
    `direction` TEXT NOT NULL,
    `source` TEXT NULL DEFAULT 'Web',
    `location` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_attendance_regularizations
CREATE TABLE IF NOT EXISTS `hrms_attendance_regularizations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `attendance_date` DATE NOT NULL,
    `requested_in` DATETIME(6) NULL,
    `requested_out` DATETIME(6) NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `reviewed_by` VARCHAR(36) NULL,
    `reviewed_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_branches
CREATE TABLE IF NOT EXISTS `hrms_branches` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `company_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `region` TEXT NULL,
    `timezone` TEXT NULL DEFAULT 'Asia/Qatar',
    `address` TEXT NULL,
    `contact_number` TEXT NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_business_units
CREATE TABLE IF NOT EXISTS `hrms_business_units` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `company_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `head_employee_id` VARCHAR(36) NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_companies
CREATE TABLE IF NOT EXISTS `hrms_companies` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `legal_name` TEXT NULL,
    `registration_no` TEXT NULL,
    `tax_id` TEXT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `financial_year_start` DATE NULL DEFAULT '2026-01-01',
    `country` VARCHAR(255) NULL DEFAULT 'Qatar',
    `state` VARCHAR(255) NULL,
    `city` VARCHAR(255) NULL DEFAULT 'Doha',
    `address` TEXT NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_employee_appraisals
CREATE TABLE IF NOT EXISTS `hrms_employee_appraisals` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `appraisal_cycle_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `manager_id` VARCHAR(36) NULL,
    `self_score` DECIMAL(18, 4) NULL DEFAULT 0,
    `manager_score` DECIMAL(18, 4) NULL DEFAULT 0,
    `peer_score` DECIMAL(18, 4) NULL DEFAULT 0,
    `final_score` DECIMAL(18, 4) NULL DEFAULT 0,
    `self_remarks` TEXT NULL,
    `manager_remarks` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Initiated',
    `completed_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_employee_documents
CREATE TABLE IF NOT EXISTS `hrms_employee_documents` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `document_type` VARCHAR(255) NOT NULL,
    `document_name` TEXT NOT NULL,
    `document_url` TEXT NOT NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `verification_status` TEXT NULL DEFAULT 'Verified',
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_employee_fines
CREATE TABLE IF NOT EXISTS `hrms_employee_fines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `incident_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `deducted_in_payroll_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_employee_loans
CREATE TABLE IF NOT EXISTS `hrms_employee_loans` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `loan_amount` DECIMAL(18, 4) NOT NULL,
    `disbursed_date` DATE NOT NULL,
    `tenure_months` INT NOT NULL,
    `monthly_emi` DECIMAL(18, 4) NOT NULL,
    `total_repaid` DECIMAL(18, 4) NULL DEFAULT 0,
    `remaining_balance` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_employee_salaries
CREATE TABLE IF NOT EXISTS `hrms_employee_salaries` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `basic_salary` DECIMAL(18, 4) NULL DEFAULT 0,
    `hra` DECIMAL(18, 4) NULL DEFAULT 0,
    `transport_allowance` DECIMAL(18, 4) NULL DEFAULT 0,
    `other_allowance` DECIMAL(18, 4) NULL DEFAULT 0,
    `gross_salary` DECIMAL(18, 4) NULL,
    `components` JSON NULL DEFAULT ('[]'),
    `is_current` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_employee_transfers
CREATE TABLE IF NOT EXISTS `hrms_employee_transfers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `effective_date` DATE NOT NULL,
    `transfer_type` TEXT NOT NULL,
    `from_details` JSON NOT NULL,
    `to_details` JSON NOT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Approved',
    `approved_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_entities
CREATE TABLE IF NOT EXISTS `hrms_entities` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `company_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_exit_clearances
CREATE TABLE IF NOT EXISTS `hrms_exit_clearances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `resignation_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `department_name` TEXT NOT NULL,
    `cleared_by` VARCHAR(36) NULL,
    `is_cleared` TINYINT(1) NULL DEFAULT 0,
    `cleared_at` DATETIME(6) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_expense_claims
CREATE TABLE IF NOT EXISTS `hrms_expense_claims` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `expense_type_id` VARCHAR(36) NULL,
    `expense_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `receipt_url` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `approved_by` VARCHAR(36) NULL,
    `reimbursed_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_expense_types
CREATE TABLE IF NOT EXISTS `hrms_expense_types` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `max_limit` DECIMAL(18, 4) NULL DEFAULT 5000,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_fnf_settlements
CREATE TABLE IF NOT EXISTS `hrms_fnf_settlements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `resignation_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `settlement_date` DATE NOT NULL,
    `last_working_date` DATE NOT NULL,
    `unpaid_salary` DECIMAL(18, 4) NULL DEFAULT 0,
    `leave_encashment` DECIMAL(18, 4) NULL DEFAULT 0,
    `gratuity_amount` DECIMAL(18, 4) NULL DEFAULT 0,
    `notice_pay_adjustment` DECIMAL(18, 4) NULL DEFAULT 0,
    `other_earnings` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_gross_settlement` DECIMAL(18, 4) NULL DEFAULT 0,
    `loan_deduction` DECIMAL(18, 4) NULL DEFAULT 0,
    `asset_recovery_deduction` DECIMAL(18, 4) NULL DEFAULT 0,
    `other_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `net_payable` DECIMAL(18, 4) NULL DEFAULT 0,
    `status` VARCHAR(255) NULL DEFAULT 'Draft',
    `approved_by` VARCHAR(36) NULL,
    `disbursed_at` DATETIME(6) NULL,
    `payment_reference` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_grades
CREATE TABLE IF NOT EXISTS `hrms_grades` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `level` INT NULL DEFAULT 1,
    `min_salary` DECIMAL(18, 4) NULL DEFAULT 0,
    `max_salary` DECIMAL(18, 4) NULL DEFAULT 0,
    `benefits` JSON NULL DEFAULT ('[]'),
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_helpdesk_tickets
CREATE TABLE IF NOT EXISTS `hrms_helpdesk_tickets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `ticket_number` VARCHAR(255) NOT NULL,
    `employee_id` VARCHAR(36) NULL,
    `category` VARCHAR(255) NOT NULL,
    `subject` TEXT NOT NULL,
    `description` TEXT NOT NULL,
    `priority` TEXT NULL DEFAULT 'Medium',
    `status` VARCHAR(255) NULL DEFAULT 'Open',
    `assigned_to` VARCHAR(36) NULL,
    `resolution_notes` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_kpa_templates
CREATE TABLE IF NOT EXISTS `hrms_kpa_templates` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `department_id` VARCHAR(36) NULL,
    `designation_id` VARCHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `weightage` INT NULL DEFAULT 100,
    `metrics` JSON NULL DEFAULT ('[]'),
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_leave_applications
CREATE TABLE IF NOT EXISTS `hrms_leave_applications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `leave_type_id` VARCHAR(36) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `days_count` DECIMAL(18, 4) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `applied_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `reviewed_by` VARCHAR(36) NULL,
    `reviewed_at` DATETIME(6) NULL,
    `review_notes` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_leave_balances
CREATE TABLE IF NOT EXISTS `hrms_leave_balances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `leave_type_id` VARCHAR(36) NULL,
    `year` INT NOT NULL,
    `total_entitled` DECIMAL(18, 4) NULL DEFAULT 30,
    `used` DECIMAL(18, 4) NULL DEFAULT 0,
    `pending` DECIMAL(18, 4) NULL DEFAULT 0,
    `encashed` DECIMAL(18, 4) NULL DEFAULT 0,
    `balance` DECIMAL(18, 4) NULL,
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_leave_encashments
CREATE TABLE IF NOT EXISTS `hrms_leave_encashments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `leave_type_id` VARCHAR(36) NULL,
    `days_encashed` DECIMAL(18, 4) NOT NULL,
    `calculated_amount` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_leave_types
CREATE TABLE IF NOT EXISTS `hrms_leave_types` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `annual_allowance` INT NULL DEFAULT 30,
    `is_paid` TINYINT(1) NULL DEFAULT 1,
    `is_encashable` TINYINT(1) NULL DEFAULT 1,
    `carry_forward_limit` INT NULL DEFAULT 10,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_overtime_requests
CREATE TABLE IF NOT EXISTS `hrms_overtime_requests` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `overtime_date` DATE NOT NULL,
    `overtime_hours` DECIMAL(18, 4) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `approved_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_payroll_cycles
CREATE TABLE IF NOT EXISTS `hrms_payroll_cycles` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `company_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `cycle_month` INT NOT NULL,
    `cycle_year` INT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Draft',
    `total_gross` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_net` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_employees` INT NULL DEFAULT 0,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_payroll_payslips
CREATE TABLE IF NOT EXISTS `hrms_payroll_payslips` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `payroll_cycle_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `working_days` DECIMAL(18, 4) NULL DEFAULT 30,
    `present_days` DECIMAL(18, 4) NULL DEFAULT 30,
    `paid_leaves` DECIMAL(18, 4) NULL DEFAULT 0,
    `unpaid_leaves` DECIMAL(18, 4) NULL DEFAULT 0,
    `overtime_hours` DECIMAL(18, 4) NULL DEFAULT 0,
    `basic_pay` DECIMAL(18, 4) NULL DEFAULT 0,
    `allowances` DECIMAL(18, 4) NULL DEFAULT 0,
    `overtime_pay` DECIMAL(18, 4) NULL DEFAULT 0,
    `incentives` DECIMAL(18, 4) NULL DEFAULT 0,
    `gross_earnings` DECIMAL(18, 4) NULL DEFAULT 0,
    `statutory_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `loan_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `fines_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `total_deductions` DECIMAL(18, 4) NULL DEFAULT 0,
    `net_salary` DECIMAL(18, 4) NULL DEFAULT 0,
    `status` VARCHAR(255) NULL DEFAULT 'Generated',
    `payment_mode` TEXT NULL DEFAULT 'Bank Transfer',
    `payment_reference` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_resignations
CREATE TABLE IF NOT EXISTS `hrms_resignations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `resignation_date` DATE NOT NULL,
    `requested_last_working_date` DATE NOT NULL,
    `approved_last_working_date` DATE NULL,
    `notice_period_served_days` INT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Submitted',
    `accepted_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_salary_components
CREATE TABLE IF NOT EXISTS `hrms_salary_components` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `is_statutory` TINYINT(1) NULL DEFAULT 0,
    `is_taxable` TINYINT(1) NULL DEFAULT 1,
    `calculation_type` TEXT NULL DEFAULT 'Fixed',
    `default_amount` DECIMAL(18, 4) NULL DEFAULT 0,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_salary_structures
CREATE TABLE IF NOT EXISTS `hrms_salary_structures` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_shift_allocations
CREATE TABLE IF NOT EXISTS `hrms_shift_allocations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `employee_id` VARCHAR(36) NULL,
    `shift_id` VARCHAR(36) NULL,
    `from_date` DATE NOT NULL,
    `to_date` DATE NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_shifts
CREATE TABLE IF NOT EXISTS `hrms_shifts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `company_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `start_time` TIME(6) NOT NULL,
    `end_time` TIME(6) NOT NULL,
    `break_duration_minutes` INT NULL DEFAULT 60,
    `grace_period_minutes` INT NULL DEFAULT 15,
    `is_night_shift` TINYINT(1) NULL DEFAULT 0,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: hrms_sub_departments
CREATE TABLE IF NOT EXISTS `hrms_sub_departments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `department_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: inspection_reports
CREATE TABLE IF NOT EXISTS `inspection_reports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `lease_id` VARCHAR(36) NULL,
    `inspection_type` TEXT NOT NULL,
    `inspection_date` DATETIME(6) NOT NULL,
    `unit_condition` JSON NULL DEFAULT ('{}'),
    `furniture` JSON NULL DEFAULT ('{}'),
    `appliances` JSON NULL DEFAULT ('{}'),
    `fixtures` JSON NULL DEFAULT ('{}'),
    `meter_readings` JSON NULL DEFAULT ('{}'),
    `keys_access` JSON NULL DEFAULT ('{}'),
    `photos` JSON NULL DEFAULT ('[]'),
    `damages` JSON NULL DEFAULT ('[]'),
    `pending_work` JSON NULL DEFAULT ('[]'),
    `inspector_name` TEXT NOT NULL,
    `tenant_acknowledged` TINYINT(1) NULL DEFAULT 0,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: inventory_parts
CREATE TABLE IF NOT EXISTS `inventory_parts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(255) NULL,
    `quantity_on_hand` INT NOT NULL DEFAULT 0,
    `unit_cost` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: key_handovers
CREATE TABLE IF NOT EXISTS `key_handovers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `lease_id` VARCHAR(36) NULL,
    `handover_date` DATETIME(6) NOT NULL,
    `keys_issued` JSON NULL DEFAULT ('[]'),
    `access_cards_issued` JSON NULL DEFAULT ('[]'),
    `parking_remotes` JSON NULL DEFAULT ('[]'),
    `meter_readings` JSON NULL DEFAULT ('{}'),
    `staff_name` TEXT NOT NULL,
    `staff_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: leases
CREATE TABLE IF NOT EXISTS `leases` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `lease_number` VARCHAR(255) NOT NULL,
    `lease_status` TEXT NULL DEFAULT 'DRAFT',
    `commencement_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `lease_period_months` INT NOT NULL,
    `rental_amount` DECIMAL(18, 4) NOT NULL,
    `payment_frequency` TEXT NULL DEFAULT 'Monthly',
    `security_deposit` DECIMAL(18, 4) NULL DEFAULT 0,
    `security_deposit_status` TEXT NULL DEFAULT 'Pending',
    `grace_period_days` INT NULL DEFAULT 5,
    `late_penalty_percentage` DECIMAL(18, 4) NULL DEFAULT 0,
    `late_penalty_fixed` DECIMAL(18, 4) NULL DEFAULT 0,
    `renewal_terms` TEXT NULL,
    `notice_period_days` INT NULL DEFAULT 60,
    `maintenance_responsibility` TEXT NULL DEFAULT 'Landlord',
    `utility_responsibility` TEXT NULL DEFAULT 'Tenant',
    `parking_details` TEXT NULL,
    `special_conditions` TEXT NULL,
    `number_of_pdc` INT NULL DEFAULT 0,
    `tenant_signed_doc_url` TEXT NULL,
    `landlord_signed_doc_url` TEXT NULL,
    `tenant_signature_date` DATE NULL,
    `landlord_signature_date` DATE NULL,
    `signed_by_receiver` TEXT NULL,
    `key_handover_date` DATE NULL,
    `previous_lease_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `deleted_at` DATETIME(6) NULL,
    `check_in_report_id` VARCHAR(36) NULL,
    `check_out_report_id` VARCHAR(36) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: material_usage
CREATE TABLE IF NOT EXISTS `material_usage` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `ticket_id` VARCHAR(36) NULL,
    `part_id` VARCHAR(36) NULL,
    `quantity` INT NOT NULL,
    `cost` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: modules
CREATE TABLE IF NOT EXISTS `modules` (
    `id` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_asset_categories
CREATE TABLE IF NOT EXISTS `mst_asset_categories` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_asset_conditions
CREATE TABLE IF NOT EXISTS `mst_asset_conditions` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_asset_ownership_types
CREATE TABLE IF NOT EXISTS `mst_asset_ownership_types` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_asset_statuses
CREATE TABLE IF NOT EXISTS `mst_asset_statuses` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_asset_subcategories
CREATE TABLE IF NOT EXISTS `mst_asset_subcategories` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category_id` INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_departments
CREATE TABLE IF NOT EXISTS `mst_departments` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_designations
CREATE TABLE IF NOT EXISTS `mst_designations` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_employee_statuses
CREATE TABLE IF NOT EXISTS `mst_employee_statuses` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_employment_types
CREATE TABLE IF NOT EXISTS `mst_employment_types` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_facilities
CREATE TABLE IF NOT EXISTS `mst_facilities` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `capacity` INT NOT NULL DEFAULT 1,
    `paid` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_furnishing
CREATE TABLE IF NOT EXISTS `mst_furnishing` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_genders
CREATE TABLE IF NOT EXISTS `mst_genders` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `sort_order` INT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_lease_statuses
CREATE TABLE IF NOT EXISTS `mst_lease_statuses` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_maintenance_responsibilities
CREATE TABLE IF NOT EXISTS `mst_maintenance_responsibilities` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_ownership_types
CREATE TABLE IF NOT EXISTS `mst_ownership_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_payment_modes
CREATE TABLE IF NOT EXISTS `mst_payment_modes` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_property_categories
CREATE TABLE IF NOT EXISTS `mst_property_categories` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_property_codes
CREATE TABLE IF NOT EXISTS `mst_property_codes` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_property_types
CREATE TABLE IF NOT EXISTS `mst_property_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_rent_frequencies
CREATE TABLE IF NOT EXISTS `mst_rent_frequencies` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_security_deposit_types
CREATE TABLE IF NOT EXISTS `mst_security_deposit_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_ticket_categories
CREATE TABLE IF NOT EXISTS `mst_ticket_categories` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `sla_hours` INT NOT NULL DEFAULT 24,
    `priority` TEXT NOT NULL DEFAULT 'medium',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_unit_codes
CREATE TABLE IF NOT EXISTS `mst_unit_codes` (
    `id` INT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `property_code_id` INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_unit_usages
CREATE TABLE IF NOT EXISTS `mst_unit_usages` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_vat_treatments
CREATE TABLE IF NOT EXISTS `mst_vat_treatments` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_view_types
CREATE TABLE IF NOT EXISTS `mst_view_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: mst_work_locations
CREATE TABLE IF NOT EXISTS `mst_work_locations` (
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: pdcs
CREATE TABLE IF NOT EXISTS `pdcs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `lease_id` VARCHAR(36) NULL,
    `cheque_number` TEXT NULL,
    `bank` TEXT NULL,
    `deposit_date` DATE NULL,
    `amount` DECIMAL(18, 4) NULL,
    `status` VARCHAR(255) NULL DEFAULT 'ISSUED',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `maturity_date` DATE NULL,
    `collection_date` DATE NULL,
    `bank_branch` TEXT NULL,
    `cheque_front_url` TEXT NULL,
    `cheque_back_url` TEXT NULL,
    `unit_name` TEXT NULL,
    `property_code` TEXT NULL,
    `tenant_name` TEXT NULL,
    `rent_from_date` TEXT NULL,
    `rent_to_date` TEXT NULL,
    `sl_no` INT NULL,
    `status_pdc` TEXT NULL DEFAULT 'In Hand'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: platform_subscription_plans
CREATE TABLE IF NOT EXISTS `platform_subscription_plans` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `plan_code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `price_monthly_qar` DECIMAL(18, 4) NULL,
    `price_annual_qar` DECIMAL(18, 4) NULL,
    `currency` VARCHAR(255) NOT NULL DEFAULT 'QAR',
    `max_properties` INT NOT NULL DEFAULT 30,
    `max_units` INT NOT NULL DEFAULT 500,
    `max_staff_users` INT NOT NULL DEFAULT 20,
    `max_storage_gb` INT NOT NULL DEFAULT 50,
    `enabled_modules` JSON NULL DEFAULT ('["Property CRUD"]'),
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
    `display_order` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: pricing_rules
CREATE TABLE IF NOT EXISTS `pricing_rules` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NULL,
    `rule_type` TEXT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `adjustment_type` TEXT NOT NULL DEFAULT 'percentage',
    `value` DECIMAL(18, 4) NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_customs_clearances
CREATE TABLE IF NOT EXISTS `proc_customs_clearances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `shipment_id` VARCHAR(36) NOT NULL,
    `cha_id` VARCHAR(36) NULL,
    `declaration_number` TEXT NULL,
    `declaration_date` DATE NULL,
    `customs_status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `customs_duty` DECIMAL(18, 4) NULL,
    `customs_tax` DECIMAL(18, 4) NULL,
    `clearance_charges` DECIMAL(18, 4) NULL,
    `clearance_date` DATE NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_document_sequences
CREATE TABLE IF NOT EXISTS `proc_document_sequences` (
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `document_type` VARCHAR(255) NOT NULL,
    `prefix` VARCHAR(255) NOT NULL,
    `current_number` BIGINT NOT NULL DEFAULT 0,
    `padding_length` INT NOT NULL DEFAULT 6,
    `fiscal_year` INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_gate_inwards
CREATE TABLE IF NOT EXISTS `proc_gate_inwards` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `gate_inward_number` VARCHAR(255) NOT NULL,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `shipment_id` VARCHAR(36) NULL,
    `inward_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `vehicle_number` TEXT NULL,
    `driver_name` TEXT NULL,
    `warehouse_name` TEXT NULL,
    `receiving_location` TEXT NULL,
    `security_check_status` TEXT NULL,
    `inspection_status` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `received_by` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_goods_receipts
CREATE TABLE IF NOT EXISTS `proc_goods_receipts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `grn_number` VARCHAR(255) NOT NULL,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `gate_inward_id` VARCHAR(36) NULL,
    `shipment_id` VARCHAR(36) NULL,
    `vendor_id` INT NOT NULL,
    `grn_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `warehouse_name` TEXT NULL,
    `receiving_location` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `posting_status` ENUM('UNPOSTED', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'UNPOSTED',
    `subtotal` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `received_by` VARCHAR(36) NULL,
    `inspected_by` VARCHAR(36) NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_grn_lines
CREATE TABLE IF NOT EXISTS `proc_grn_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `goods_receipt_id` VARCHAR(36) NOT NULL,
    `purchase_order_line_id` VARCHAR(36) NOT NULL,
    `line_no` INT NOT NULL,
    `item_code` TEXT NULL,
    `item_name` TEXT NOT NULL,
    `description` TEXT NULL,
    `ordered_quantity` DECIMAL(18, 4) NULL,
    `received_quantity` DECIMAL(18, 4) NULL,
    `accepted_quantity` DECIMAL(18, 4) NULL,
    `rejected_quantity` DECIMAL(18, 4) NULL,
    `uom` TEXT NULL,
    `unit_rate` DECIMAL(18, 4) NULL,
    `accepted_amount` DECIMAL(18, 4) NULL,
    `rejection_reason` TEXT NULL,
    `batch_number` TEXT NULL,
    `serial_number` TEXT NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `asset_category` TEXT NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_imports
CREATE TABLE IF NOT EXISTS `proc_imports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `import_number` VARCHAR(255) NOT NULL,
    `shipment_id` VARCHAR(36) NOT NULL,
    `import_date` DATE NULL,
    `port_of_entry` TEXT NULL,
    `bill_of_entry_number` TEXT NULL,
    `bill_of_entry_date` DATE NULL,
    `currency_code` TEXT NOT NULL DEFAULT 'QAR',
    `exchange_rate` DECIMAL(18, 4) NULL,
    `customs_value` DECIMAL(18, 4) NULL,
    `duty_amount` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `other_import_cost` DECIMAL(18, 4) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_logistics_partners
CREATE TABLE IF NOT EXISTS `proc_logistics_partners` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `partner_code` VARCHAR(255) NOT NULL,
    `partner_type` ENUM('FORWARDER', 'CHA', 'TRANSPORTER') NOT NULL,
    `partner_name` TEXT NOT NULL,
    `contact_person` TEXT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(255) NULL,
    `country` VARCHAR(255) NULL,
    `tax_number` TEXT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_negotiations
CREATE TABLE IF NOT EXISTS `proc_negotiations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `vendor_quote_id` VARCHAR(36) NOT NULL,
    `round_no` INT NOT NULL,
    `negotiation_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `vendor_amount` DECIMAL(18, 4) NULL,
    `counter_amount` DECIMAL(18, 4) NULL,
    `payment_terms` TEXT NULL,
    `delivery_terms` TEXT NULL,
    `outcome` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
    `negotiated_by` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_purchase_order_lines
CREATE TABLE IF NOT EXISTS `proc_purchase_order_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `line_no` INT NOT NULL,
    `source_rfx_line_id` VARCHAR(36) NULL,
    `source_quote_line_id` VARCHAR(36) NULL,
    `source_pr_line_id` VARCHAR(36) NULL,
    `item_type` ENUM('CAPEX', 'OPEX', 'INVENTORY') NOT NULL,
    `item_code` TEXT NULL,
    `item_name` TEXT NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `uom` TEXT NULL,
    `unit_rate` DECIMAL(18, 4) NULL,
    `discount_percent` DECIMAL(18, 4) NULL,
    `discount_amount` DECIMAL(18, 4) NULL,
    `tax_percent` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `line_total` DECIMAL(18, 4) NULL,
    `ordered_quantity` DECIMAL(18, 4) NULL,
    `received_quantity` DECIMAL(18, 4) NULL,
    `accepted_quantity` DECIMAL(18, 4) NULL,
    `rejected_quantity` DECIMAL(18, 4) NULL,
    `cancelled_quantity` DECIMAL(18, 4) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `expense_account_code` TEXT NULL,
    `asset_category` TEXT NULL,
    `required_date` DATE NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_purchase_orders
CREATE TABLE IF NOT EXISTS `proc_purchase_orders` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `doc_number` VARCHAR(255) NOT NULL,
    `po_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `vendor_id` INT NOT NULL,
    `purchase_request_id` VARCHAR(36) NULL,
    `vendor_quote_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `cost_center_id` INT NULL,
    `department_id` VARCHAR(36) NULL,
    `currency_code` TEXT NOT NULL DEFAULT 'QAR',
    `exchange_rate` DECIMAL(18, 4) NULL,
    `payment_terms` TEXT NULL,
    `delivery_terms` TEXT NULL,
    `delivery_date` DATE NULL,
    `shipping_address` TEXT NULL,
    `billing_address` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `posting_status` ENUM('UNPOSTED', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'UNPOSTED',
    `subtotal` DECIMAL(18, 4) NULL,
    `discount_amount` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `freight_amount` DECIMAL(18, 4) NULL,
    `other_charges` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `created_by` VARCHAR(36) NULL,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(6) NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_purchase_request_lines
CREATE TABLE IF NOT EXISTS `proc_purchase_request_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `purchase_request_id` VARCHAR(36) NOT NULL,
    `line_no` INT NOT NULL,
    `item_type` ENUM('CAPEX', 'OPEX', 'INVENTORY') NOT NULL DEFAULT 'CAPEX',
    `item_code` TEXT NULL,
    `item_name` TEXT NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `uom` TEXT NULL,
    `estimated_unit_rate` DECIMAL(18, 4) NULL,
    `line_total` DECIMAL(18, 4) NULL,
    `required_date` DATE NULL,
    `expense_account_code` TEXT NULL,
    `asset_category` TEXT NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_purchase_requests
CREATE TABLE IF NOT EXISTS `proc_purchase_requests` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `doc_number` VARCHAR(255) NOT NULL,
    `request_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `requester_id` VARCHAR(36) NULL,
    `department_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `cost_center_id` INT NULL,
    `required_date` DATE NULL,
    `priority` TEXT NULL DEFAULT 'NORMAL',
    `purpose` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `posting_status` ENUM('UNPOSTED', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'UNPOSTED',
    `accounting_event_id` VARCHAR(36) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_rfx
CREATE TABLE IF NOT EXISTS `proc_rfx` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `doc_number` VARCHAR(255) NOT NULL,
    `rfx_type` ENUM('RFI', 'RFQ', 'RFP') NOT NULL,
    `purchase_request_id` VARCHAR(36) NULL,
    `issue_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `submission_deadline` DATE NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `property_id` VARCHAR(36) NULL,
    `cost_center_id` INT NULL,
    `total_estimated_amount` DECIMAL(18, 4) NULL,
    `created_by` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_rfx_lines
CREATE TABLE IF NOT EXISTS `proc_rfx_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `rfx_id` VARCHAR(36) NOT NULL,
    `line_no` INT NOT NULL,
    `item_type` ENUM('CAPEX', 'OPEX', 'INVENTORY') NOT NULL DEFAULT 'CAPEX',
    `item_code` TEXT NULL,
    `item_name` TEXT NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `uom` TEXT NULL,
    `target_unit_rate` DECIMAL(18, 4) NULL,
    `line_total` DECIMAL(18, 4) NULL,
    `expense_account_code` TEXT NULL,
    `asset_category` TEXT NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_rfx_vendors
CREATE TABLE IF NOT EXISTS `proc_rfx_vendors` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `rfx_id` VARCHAR(36) NOT NULL,
    `vendor_id` INT NOT NULL,
    `invited_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `response_received` TINYINT(1) NOT NULL DEFAULT 0,
    `response_date` DATETIME(6) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_shipments
CREATE TABLE IF NOT EXISTS `proc_shipments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `shipment_number` VARCHAR(255) NOT NULL,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `vendor_id` INT NOT NULL,
    `shipment_date` DATE NULL,
    `expected_arrival_date` DATE NULL,
    `actual_arrival_date` DATE NULL,
    `shipping_mode` TEXT NULL,
    `forwarder_id` VARCHAR(36) NULL,
    `transporter_id` VARCHAR(36) NULL,
    `cha_id` VARCHAR(36) NULL,
    `tracking_number` TEXT NULL,
    `container_number` TEXT NULL,
    `bill_of_lading_number` TEXT NULL,
    `airway_bill_number` TEXT NULL,
    `origin_country` TEXT NULL,
    `origin_city` TEXT NULL,
    `destination_country` TEXT NULL,
    `destination_city` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_transports
CREATE TABLE IF NOT EXISTS `proc_transports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `transport_number` VARCHAR(255) NOT NULL,
    `shipment_id` VARCHAR(36) NULL,
    `transporter_id` VARCHAR(36) NOT NULL,
    `vehicle_number` TEXT NULL,
    `driver_name` TEXT NULL,
    `driver_phone` TEXT NULL,
    `pickup_location` TEXT NULL,
    `delivery_location` TEXT NULL,
    `pickup_date` DATE NULL,
    `expected_delivery_date` DATE NULL,
    `actual_delivery_date` DATE NULL,
    `freight_amount` DECIMAL(18, 4) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_vendor_quote_lines
CREATE TABLE IF NOT EXISTS `proc_vendor_quote_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `vendor_quote_id` VARCHAR(36) NOT NULL,
    `line_no` INT NOT NULL,
    `rfx_line_id` VARCHAR(36) NULL,
    `item_code` TEXT NULL,
    `item_name` TEXT NOT NULL,
    `description` TEXT NULL,
    `item_type` ENUM('CAPEX', 'OPEX', 'INVENTORY') NOT NULL DEFAULT 'CAPEX',
    `quantity` DECIMAL(18, 4) NULL,
    `uom` TEXT NULL,
    `unit_rate` DECIMAL(18, 4) NULL,
    `discount_amount` DECIMAL(18, 4) NULL,
    `tax_rate` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `line_total` DECIMAL(18, 4) NULL,
    `delivery_days` INT NULL,
    `expense_account_code` TEXT NULL,
    `asset_category` TEXT NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: proc_vendor_quotes
CREATE TABLE IF NOT EXISTS `proc_vendor_quotes` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `quote_number` VARCHAR(255) NOT NULL,
    `rfx_id` VARCHAR(36) NOT NULL,
    `vendor_id` INT NOT NULL,
    `quote_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `valid_until` DATE NULL,
    `currency_code` TEXT NOT NULL DEFAULT 'QAR',
    `subtotal` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `freight_amount` DECIMAL(18, 4) NULL,
    `other_charges` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `payment_terms` TEXT NULL,
    `delivery_terms` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_NEGOTIATION', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `posting_status` ENUM('UNPOSTED', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'UNPOSTED',
    `accounting_event_id` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: profiles
CREATE TABLE IF NOT EXISTS `profiles` (
    `id` VARCHAR(36) NOT NULL,
    `role` VARCHAR(255) NULL DEFAULT 'GUEST',
    `full_name` TEXT NOT NULL,
    `avatar_url` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: properties
CREATE TABLE IF NOT EXISTS `properties` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `host_id` VARCHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `property_type` TEXT NOT NULL,
    `address` TEXT NOT NULL,
    `city` VARCHAR(255) NOT NULL,
    `country` VARCHAR(255) NOT NULL,
    `location` POINT NULL,
    `max_guests` INT NOT NULL DEFAULT 1,
    `bedrooms` INT NOT NULL DEFAULT 1,
    `beds` INT NOT NULL DEFAULT 1,
    `bathrooms` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `base_price_per_night` DECIMAL(18, 4) NOT NULL,
    `cleaning_fee` DECIMAL(18, 4) NULL DEFAULT 0,
    `is_active` TINYINT(1) NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `property_code` TEXT NULL,
    `cost_center_code` TEXT NULL,
    `cost_center_name` TEXT NULL,
    `property_category` TEXT NULL,
    `ownership_type` TEXT NULL,
    `area_zone` TEXT NULL,
    `street_building_name` TEXT NULL,
    `plot_building_no` TEXT NULL,
    `title_deed_no` TEXT NULL,
    `municipality_ref_no` TEXT NULL,
    `property_manager` TEXT NULL,
    `no_of_floors` INT NULL,
    `no_of_units` INT NULL,
    `total_built_up_area_sqm` DECIMAL(18, 4) NULL,
    `common_area_sqm` DECIMAL(18, 4) NULL,
    `parking_count` INT NULL,
    `no_of_elevators` INT NULL,
    `completion_date` DATE NULL,
    `handover_date` DATE NULL,
    `documents_received` TINYINT(1) NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `year_built` INT NULL,
    `total_floors` INT NULL,
    `total_units` INT NULL,
    `property_status` TEXT NULL DEFAULT 'Active',
    `contact_person` TEXT NULL,
    `mobile_number` TEXT NULL,
    `email` VARCHAR(255) NULL,
    `alternate_contact` TEXT NULL,
    `postal_code` VARCHAR(255) NULL,
    `landmark` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: property_amenities
CREATE TABLE IF NOT EXISTS `property_amenities` (
    `property_id` VARCHAR(36) NOT NULL,
    `amenity_id` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: property_coa_mapping
CREATE TABLE IF NOT EXISTS `property_coa_mapping` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `property_id` VARCHAR(36) NOT NULL,
    `property_code` TEXT NULL,
    `property_name` TEXT NULL,
    `rental_revenue_gl_code` TEXT NULL DEFAULT '41100',
    `property_management_fee_gl_code` TEXT NULL DEFAULT '41101',
    `other_income_gl_code` TEXT NULL DEFAULT '41201',
    `gain_loss_disposal_gl_code` TEXT NULL DEFAULT '41301',
    `direct_labour_gl_code` TEXT NULL DEFAULT '51001',
    `amc_maintenance_gl_code` TEXT NULL DEFAULT '51002',
    `utilities_gl_code` TEXT NULL DEFAULT '51003',
    `repairs_gl_code` TEXT NULL DEFAULT '51004',
    `staff_cost_gl_code` TEXT NULL DEFAULT '51101',
    `general_admin_gl_code` TEXT NULL DEFAULT '51102',
    `depreciation_gl_code` TEXT NULL DEFAULT '51106',
    `default_bank_gl_code` TEXT NULL DEFAULT '12000',
    `default_ap_gl_code` TEXT NULL DEFAULT '21000',
    `default_inventory_gl_code` TEXT NULL DEFAULT '12800',
    `default_pdc_in_hand_gl_code` TEXT NULL DEFAULT '12900',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: property_images
CREATE TABLE IF NOT EXISTS `property_images` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `property_id` VARCHAR(36) NULL,
    `image_url` TEXT NOT NULL,
    `is_primary` TINYINT(1) NULL DEFAULT 0,
    `display_order` INT NULL DEFAULT 0,
    `category` VARCHAR(255) NULL DEFAULT 'Exterior'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: reservations
CREATE TABLE IF NOT EXISTS `reservations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NULL,
    `prospect_name` TEXT NOT NULL,
    `prospect_contact` TEXT NOT NULL,
    `prospect_id_type` TEXT NULL,
    `prospect_id_number` TEXT NULL,
    `marketing_agent_id` VARCHAR(36) NULL,
    `proposed_lease_period` INT NULL,
    `expected_start_date` DATE NULL,
    `proposed_rental_amount` DECIMAL(18, 4) NULL,
    `reservation_validity` DATETIME(6) NULL,
    `special_conditions` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: reviews
CREATE TABLE IF NOT EXISTS `reviews` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `booking_id` VARCHAR(36) NULL,
    `author_id` VARCHAR(36) NULL,
    `target_id` VARCHAR(36) NULL,
    `rating` INT NOT NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: role_permissions
CREATE TABLE IF NOT EXISTS `role_permissions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `role_name` VARCHAR(255) NOT NULL,
    `module_id` VARCHAR(255) NULL,
    `has_access` TINYINT(1) NULL DEFAULT 0,
    `tenant_id` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: security_audit_logs
CREATE TABLE IF NOT EXISTS `security_audit_logs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `event_type` VARCHAR(255) NOT NULL,
    `severity` TEXT NOT NULL DEFAULT 'info',
    `user_id` VARCHAR(36) NULL,
    `user_role` TEXT NULL,
    `resource` TEXT NULL,
    `action` VARCHAR(255) NULL,
    `details` JSON NULL,
    `ip_address` TEXT NULL,
    `user_agent` TEXT NULL,
    `timestamp` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: system_configurations
CREATE TABLE IF NOT EXISTS `system_configurations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `config_key` VARCHAR(255) NOT NULL,
    `config_value` JSON NOT NULL DEFAULT ('{}'),
    `category` VARCHAR(255) NOT NULL DEFAULT 'general',
    `description` TEXT NULL,
    `is_encrypted` TINYINT(1) NOT NULL DEFAULT 0,
    `updated_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: system_notifications
CREATE TABLE IF NOT EXISTS `system_notifications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(255) NOT NULL DEFAULT 'info',
    `target_role` VARCHAR(255) NULL DEFAULT 'ALL',
    `target_user` VARCHAR(36) NULL,
    `is_read` TINYINT(1) NOT NULL DEFAULT 0,
    `action_url` TEXT NULL,
    `metadata` JSON NULL DEFAULT ('{}'),
    `expires_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `schedule_type` TEXT NOT NULL DEFAULT 'instant',
    `scheduled_for` DATETIME(6) NULL,
    `recurring_cron` TEXT NULL,
    `engagement_count` INT NOT NULL DEFAULT 0,
    `click_count` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(255) NOT NULL DEFAULT 'sent'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: tenant_organisations
CREATE TABLE IF NOT EXISTS `tenant_organisations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `tenant_key` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `legal_entity_name` TEXT NULL,
    `commercial_reg_no` TEXT NULL,
    `tax_id_no` TEXT NULL,
    `industry_type` TEXT NULL DEFAULT 'Property Management & Real Estate',
    `country` VARCHAR(255) NULL DEFAULT 'Qatar',
    `city` VARCHAR(255) NULL DEFAULT 'Doha',
    `address_line` TEXT NULL,
    `primary_phone` TEXT NULL,
    `primary_email` TEXT NOT NULL,
    `admin_name` TEXT NOT NULL,
    `admin_email` VARCHAR(255) NOT NULL,
    `admin_user_id` VARCHAR(36) NULL,
    `plan` TEXT NOT NULL DEFAULT 'Starter',
    `billing_cycle` TEXT NOT NULL DEFAULT 'monthly',
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active',
    `max_properties` INT NOT NULL DEFAULT 10,
    `max_units` INT NOT NULL DEFAULT 100,
    `max_staff_users` INT NOT NULL DEFAULT 5,
    `max_storage_gb` INT NOT NULL DEFAULT 10,
    `enabled_modules` JSON NULL DEFAULT ('["Property CRUD"]'),
    `custom_subdomain` TEXT NULL,
    `brand_primary_color` TEXT NULL DEFAULT '#0f766e',
    `onboarded_by` VARCHAR(36) NULL,
    `trial_ends_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `subscription_amount` DECIMAL(18, 4) NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `payment_method` TEXT NULL DEFAULT 'credit_card',
    `payment_status` TEXT NULL DEFAULT 'Paid',
    `transaction_ref` TEXT NULL,
    `bank_name` TEXT NULL,
    `cheque_number` TEXT NULL,
    `next_billing_date` DATE NULL DEFAULT (CURRENT_DATE),
    `auto_renew` TINYINT(1) NULL DEFAULT 1,
    `discount_code` TEXT NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `total_paid` DECIMAL(18, 4) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: tenant_subscription_invoices
CREATE TABLE IF NOT EXISTS `tenant_subscription_invoices` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `invoice_number` VARCHAR(255) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `tenant_key` TEXT NOT NULL,
    `tenant_name` TEXT NOT NULL,
    `plan` TEXT NOT NULL,
    `billing_cycle` TEXT NOT NULL,
    `subtotal_amount` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `discount_amount` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `currency` VARCHAR(255) NOT NULL DEFAULT 'QAR',
    `status` VARCHAR(255) NOT NULL DEFAULT 'Paid',
    `issue_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `due_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `payment_date` DATETIME(6) NULL,
    `payment_method` TEXT NOT NULL DEFAULT 'credit_card',
    `transaction_ref` TEXT NULL,
    `invoice_pdf_url` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: unit_amenities
CREATE TABLE IF NOT EXISTS `unit_amenities` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NULL,
    `room_id` VARCHAR(36) NULL,
    `amenity_id` TEXT NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: unit_coa_mapping
CREATE TABLE IF NOT EXISTS `unit_coa_mapping` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NOT NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_code` TEXT NOT NULL,
    `property_name` TEXT NULL,
    `receivable_sl_id` VARCHAR(36) NULL,
    `receivable_sl_code` TEXT NULL,
    `receivable_sl_name` TEXT NULL,
    `pdc_sl_id` VARCHAR(36) NULL,
    `pdc_sl_code` TEXT NULL,
    `pdc_sl_name` TEXT NULL,
    `deposit_sl_id` VARCHAR(36) NULL,
    `deposit_sl_code` TEXT NULL,
    `deposit_sl_name` TEXT NULL,
    `effective_from` DATE NULL DEFAULT (CURRENT_DATE),
    `effective_to` DATE NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: unit_coas
CREATE TABLE IF NOT EXISTS `unit_coas` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `property_name` TEXT NULL,
    `unit_code` VARCHAR(255) NOT NULL,
    `pdc_in_hand_code` TEXT NULL,
    `pdc_in_hand_name` TEXT NULL,
    `deposit_code` TEXT NULL,
    `deposit_name` TEXT NULL,
    `receivables_code` TEXT NULL,
    `receivables_name` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: unit_rooms
CREATE TABLE IF NOT EXISTS `unit_rooms` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `unit_id` VARCHAR(36) NULL,
    `room_type` TEXT NOT NULL,
    `name` VARCHAR(255) NULL,
    `length` DECIMAL(18, 4) NULL,
    `width` DECIMAL(18, 4) NULL,
    `area` DECIMAL(18, 4) NULL,
    `capacity` INT NULL,
    `details` JSON NULL DEFAULT ('{}'),
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: units
CREATE TABLE IF NOT EXISTS `units` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `property_id` VARCHAR(36) NULL,
    `unit_ref` TEXT NOT NULL,
    `room_type` TEXT NULL,
    `bedrooms` INT NULL,
    `bathrooms` DECIMAL(18, 4) NULL,
    `area` TEXT NULL,
    `price` DECIMAL(18, 4) NULL,
    `status` VARCHAR(255) NULL DEFAULT 'AVAILABLE',
    `municipality_details` JSON NULL DEFAULT ('{}'),
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `unit_code` TEXT NULL,
    `unit_cost_center_code` TEXT NULL,
    `unit_name` TEXT NULL,
    `parent_cost_center_code` TEXT NULL,
    `unit_usage` TEXT NULL,
    `block_tower` TEXT NULL,
    `floor` TEXT NULL,
    `balcony_sqm` DECIMAL(18, 4) NULL,
    `total_area_sqm` DECIMAL(18, 4) NULL,
    `view_type` TEXT NULL,
    `furnishing` TEXT NULL,
    `parking_slot_no` TEXT NULL,
    `electricity_meter_no` TEXT NULL,
    `water_meter_no` TEXT NULL,
    `cooling_meter_no` TEXT NULL,
    `lease_status` TEXT NULL,
    `rent_frequency` TEXT NULL,
    `current_tenant` TEXT NULL,
    `contract_no` TEXT NULL,
    `contract_start_date` DATE NULL,
    `contract_end_date` DATE NULL,
    `current_rent` DECIMAL(18, 4) NULL,
    `security_deposit_type` TEXT NULL,
    `security_deposit_amount` DECIMAL(18, 4) NULL,
    `service_charge` DECIMAL(18, 4) NULL,
    `maintenance_responsibility` TEXT NULL,
    `handover_date` DATE NULL,
    `documents_received` TINYINT(1) NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `unit_number` TEXT NULL,
    `floor_number` TEXT NULL,
    `unit_type` TEXT NULL,
    `max_adults` INT NULL DEFAULT 2,
    `max_children` INT NULL DEFAULT 0,
    `total_occupancy` INT NULL DEFAULT 2,
    `base_price_per_night` DECIMAL(18, 4) NULL DEFAULT 0,
    `weekend_price` DECIMAL(18, 4) NULL,
    `holiday_price` DECIMAL(18, 4) NULL,
    `cleaning_fee` DECIMAL(18, 4) NULL DEFAULT 0,
    `security_deposit` DECIMAL(18, 4) NULL DEFAULT 0,
    `pdc_in_hand_code` TEXT NULL,
    `pdc_in_hand_name` TEXT NULL,
    `deposit_code` TEXT NULL,
    `deposit_name` TEXT NULL,
    `receivables_code` TEXT NULL,
    `receivables_name` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================================
-- 2. PRIMARY KEYS
-- =====================================================================
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_pkey` PRIMARY KEY (`id`);
ALTER TABLE `assets` ADD CONSTRAINT `assets_pkey` PRIMARY KEY (`id`);
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_pkey` PRIMARY KEY (`id`);
ALTER TABLE `coa_classes` ADD CONSTRAINT `coa_classes_pkey` PRIMARY KEY (`id`);
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_pkey` PRIMARY KEY (`id`);
ALTER TABLE `coa_groups` ADD CONSTRAINT `coa_groups_pkey` PRIMARY KEY (`id`);
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_pkey` PRIMARY KEY (`id`);
ALTER TABLE `coa_types` ADD CONSTRAINT `coa_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `collection_receipts` ADD CONSTRAINT `collection_receipts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `customers` ADD CONSTRAINT `customers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `departments` ADD CONSTRAINT `departments_pkey` PRIMARY KEY (`id`);
ALTER TABLE `designations` ADD CONSTRAINT `designations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `employees` ADD CONSTRAINT `employees_pkey` PRIMARY KEY (`id`);
ALTER TABLE `erp_chart_of_accounts` ADD CONSTRAINT `erp_chart_of_accounts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `erp_journal_entries_pkey` PRIMARY KEY (`id`);
ALTER TABLE `erp_vouchers` ADD CONSTRAINT `erp_vouchers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_account_mappings` ADD CONSTRAINT `fin_account_mappings_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_accounting_event_lines` ADD CONSTRAINT `fin_accounting_event_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_accounting_events` ADD CONSTRAINT `fin_accounting_events_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_bank_accounts` ADD CONSTRAINT `fin_bank_accounts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_bank_reconciliations` ADD CONSTRAINT `fin_bank_reconciliations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_banks` ADD CONSTRAINT `fin_banks_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_coa_accounts` ADD CONSTRAINT `fin_coa_accounts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_contracts` ADD CONSTRAINT `fin_contracts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_cost_centers` ADD CONSTRAINT `fin_cost_centers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_customers` ADD CONSTRAINT `fin_customers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_deposits` ADD CONSTRAINT `fin_deposits_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_financial_years` ADD CONSTRAINT `fin_financial_years_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_legal_receivables` ADD CONSTRAINT `fin_legal_receivables_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_payment_allocations` ADD CONSTRAINT `fin_payment_allocations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_payroll_syncs` ADD CONSTRAINT `fin_payroll_syncs_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_pdc_register` ADD CONSTRAINT `fin_pdc_register_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_posting_periods` ADD CONSTRAINT `fin_posting_periods_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_regions` ADD CONSTRAINT `fin_regions_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_transaction_account_rules` ADD CONSTRAINT `fin_transaction_account_rules_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_unit_sl_accounts` ADD CONSTRAINT `fin_unit_sl_accounts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_vendors` ADD CONSTRAINT `fin_vendors_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_voucher_lines` ADD CONSTRAINT `fin_voucher_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fin_vouchers` ADD CONSTRAINT `fin_vouchers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_announcements` ADD CONSTRAINT `hrms_announcements_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_appraisal_cycles` ADD CONSTRAINT `hrms_appraisal_cycles_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_asset_allocations` ADD CONSTRAINT `hrms_asset_allocations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_attendance_daily` ADD CONSTRAINT `hrms_attendance_daily_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_attendance_raw_events` ADD CONSTRAINT `hrms_attendance_raw_events_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_attendance_regularizations` ADD CONSTRAINT `hrms_attendance_regularizations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_branches` ADD CONSTRAINT `hrms_branches_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_business_units` ADD CONSTRAINT `hrms_business_units_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_companies` ADD CONSTRAINT `hrms_companies_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_employee_documents` ADD CONSTRAINT `hrms_employee_documents_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_employee_fines` ADD CONSTRAINT `hrms_employee_fines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_employee_loans` ADD CONSTRAINT `hrms_employee_loans_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_employee_salaries` ADD CONSTRAINT `hrms_employee_salaries_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_employee_transfers` ADD CONSTRAINT `hrms_employee_transfers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_entities` ADD CONSTRAINT `hrms_entities_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_expense_types` ADD CONSTRAINT `hrms_expense_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_grades` ADD CONSTRAINT `hrms_grades_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_helpdesk_tickets` ADD CONSTRAINT `hrms_helpdesk_tickets_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_kpa_templates` ADD CONSTRAINT `hrms_kpa_templates_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_leave_balances` ADD CONSTRAINT `hrms_leave_balances_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_leave_encashments` ADD CONSTRAINT `hrms_leave_encashments_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_leave_types` ADD CONSTRAINT `hrms_leave_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_overtime_requests` ADD CONSTRAINT `hrms_overtime_requests_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_payroll_cycles` ADD CONSTRAINT `hrms_payroll_cycles_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_payroll_payslips` ADD CONSTRAINT `hrms_payroll_payslips_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_resignations` ADD CONSTRAINT `hrms_resignations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_salary_components` ADD CONSTRAINT `hrms_salary_components_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_salary_structures` ADD CONSTRAINT `hrms_salary_structures_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_shift_allocations` ADD CONSTRAINT `hrms_shift_allocations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_shifts` ADD CONSTRAINT `hrms_shifts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `hrms_sub_departments` ADD CONSTRAINT `hrms_sub_departments_pkey` PRIMARY KEY (`id`);
ALTER TABLE `inspection_reports` ADD CONSTRAINT `inspection_reports_pkey` PRIMARY KEY (`id`);
ALTER TABLE `inventory_parts` ADD CONSTRAINT `inventory_parts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `key_handovers` ADD CONSTRAINT `key_handovers_pkey` PRIMARY KEY (`id`);
ALTER TABLE `leases` ADD CONSTRAINT `leases_pkey` PRIMARY KEY (`id`);
ALTER TABLE `material_usage` ADD CONSTRAINT `material_usage_pkey` PRIMARY KEY (`id`);
ALTER TABLE `modules` ADD CONSTRAINT `modules_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_asset_categories` ADD CONSTRAINT `mst_asset_categories_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_asset_conditions` ADD CONSTRAINT `mst_asset_conditions_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_asset_ownership_types` ADD CONSTRAINT `mst_asset_ownership_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_asset_statuses` ADD CONSTRAINT `mst_asset_statuses_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_asset_subcategories` ADD CONSTRAINT `mst_asset_subcategories_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_departments` ADD CONSTRAINT `mst_departments_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_designations` ADD CONSTRAINT `mst_designations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_employee_statuses` ADD CONSTRAINT `mst_employee_statuses_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_employment_types` ADD CONSTRAINT `mst_employment_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_facilities` ADD CONSTRAINT `mst_facilities_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_furnishing` ADD CONSTRAINT `mst_furnishing_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_genders` ADD CONSTRAINT `mst_genders_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_lease_statuses` ADD CONSTRAINT `mst_lease_statuses_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_maintenance_responsibilities` ADD CONSTRAINT `mst_maintenance_responsibilities_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_ownership_types` ADD CONSTRAINT `mst_ownership_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_payment_modes` ADD CONSTRAINT `mst_payment_modes_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_property_categories` ADD CONSTRAINT `mst_property_categories_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_property_codes` ADD CONSTRAINT `mst_property_codes_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_property_types` ADD CONSTRAINT `mst_property_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_rent_frequencies` ADD CONSTRAINT `mst_rent_frequencies_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_security_deposit_types` ADD CONSTRAINT `mst_security_deposit_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_ticket_categories` ADD CONSTRAINT `mst_ticket_categories_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_unit_codes` ADD CONSTRAINT `mst_unit_codes_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_unit_usages` ADD CONSTRAINT `mst_unit_usages_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_vat_treatments` ADD CONSTRAINT `mst_vat_treatments_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_view_types` ADD CONSTRAINT `mst_view_types_pkey` PRIMARY KEY (`id`);
ALTER TABLE `mst_work_locations` ADD CONSTRAINT `mst_work_locations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `pdcs` ADD CONSTRAINT `pdcs_pkey` PRIMARY KEY (`id`);
ALTER TABLE `platform_subscription_plans` ADD CONSTRAINT `platform_subscription_plans_pkey` PRIMARY KEY (`id`);
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_customs_clearances` ADD CONSTRAINT `proc_customs_clearances_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_document_sequences` ADD CONSTRAINT `proc_document_sequences_pkey` PRIMARY KEY (`document_type`, `fiscal_year`);
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_inwards_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_goods_receipts_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_imports` ADD CONSTRAINT `proc_imports_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_logistics_partners` ADD CONSTRAINT `proc_logistics_partners_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_negotiations` ADD CONSTRAINT `proc_negotiations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_purchase_order_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_purchase_orders_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `proc_purchase_request_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `proc_purchase_requests_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_rfx` ADD CONSTRAINT `proc_rfx_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_rfx_lines` ADD CONSTRAINT `proc_rfx_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_rfx_vendors` ADD CONSTRAINT `proc_rfx_vendors_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipments_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_transports` ADD CONSTRAINT `proc_transports_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_vendor_quote_lines` ADD CONSTRAINT `proc_vendor_quote_lines_pkey` PRIMARY KEY (`id`);
ALTER TABLE `proc_vendor_quotes` ADD CONSTRAINT `proc_vendor_quotes_pkey` PRIMARY KEY (`id`);
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_pkey` PRIMARY KEY (`id`);
ALTER TABLE `properties` ADD CONSTRAINT `properties_pkey` PRIMARY KEY (`id`);
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_pkey` PRIMARY KEY (`property_id`, `amenity_id`);
ALTER TABLE `property_coa_mapping` ADD CONSTRAINT `property_coa_mapping_pkey` PRIMARY KEY (`id`);
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_pkey` PRIMARY KEY (`id`);
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_pkey` PRIMARY KEY (`id`);
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_pkey` PRIMARY KEY (`id`);
ALTER TABLE `security_audit_logs` ADD CONSTRAINT `security_audit_logs_pkey` PRIMARY KEY (`id`);
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `system_notifications` ADD CONSTRAINT `system_notifications_pkey` PRIMARY KEY (`id`);
ALTER TABLE `tenant_organisations` ADD CONSTRAINT `tenant_organisations_pkey` PRIMARY KEY (`id`);
ALTER TABLE `tenant_subscription_invoices` ADD CONSTRAINT `tenant_subscription_invoices_pkey` PRIMARY KEY (`id`);
ALTER TABLE `unit_amenities` ADD CONSTRAINT `unit_amenities_pkey` PRIMARY KEY (`id`);
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_pkey` PRIMARY KEY (`id`);
ALTER TABLE `unit_coas` ADD CONSTRAINT `unit_coas_pkey` PRIMARY KEY (`id`);
ALTER TABLE `unit_rooms` ADD CONSTRAINT `unit_rooms_pkey` PRIMARY KEY (`id`);
ALTER TABLE `units` ADD CONSTRAINT `units_pkey` PRIMARY KEY (`id`);

-- =====================================================================
-- 3. UNIQUE CONSTRAINTS
-- =====================================================================
ALTER TABLE `assets` ADD CONSTRAINT `assets_asset_code_key` UNIQUE (`asset_code`);
ALTER TABLE `coa_classes` ADD CONSTRAINT `coa_classes_code_key` UNIQUE (`code`);
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_code_key` UNIQUE (`code`);
ALTER TABLE `coa_groups` ADD CONSTRAINT `coa_groups_code_key` UNIQUE (`code`);
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_code_key` UNIQUE (`code`);
ALTER TABLE `coa_types` ADD CONSTRAINT `coa_types_code_key` UNIQUE (`code`);
ALTER TABLE `collection_receipts` ADD CONSTRAINT `collection_receipts_receipt_no_key` UNIQUE (`receipt_no`);
ALTER TABLE `departments` ADD CONSTRAINT `departments_name_key` UNIQUE (`name`);
ALTER TABLE `designations` ADD CONSTRAINT `designations_title_key` UNIQUE (`title`);
ALTER TABLE `employees` ADD CONSTRAINT `employees_email_key` UNIQUE (`email`);
ALTER TABLE `employees` ADD CONSTRAINT `employees_employee_id_code_key` UNIQUE (`employee_id_code`);
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_key` UNIQUE (`user_id`);
ALTER TABLE `erp_chart_of_accounts` ADD CONSTRAINT `erp_chart_of_accounts_code_key` UNIQUE (`code`);
ALTER TABLE `erp_vouchers` ADD CONSTRAINT `erp_vouchers_voucher_no_key` UNIQUE (`voucher_no`);
ALTER TABLE `fin_bank_accounts` ADD CONSTRAINT `fin_bank_accounts_account_number_key` UNIQUE (`account_number`);
ALTER TABLE `fin_banks` ADD CONSTRAINT `fin_banks_code_key` UNIQUE (`code`);
ALTER TABLE `fin_coa_accounts` ADD CONSTRAINT `fin_coa_accounts_account_code_key` UNIQUE (`account_code`);
ALTER TABLE `fin_contracts` ADD CONSTRAINT `fin_contracts_contract_number_key` UNIQUE (`contract_number`);
ALTER TABLE `fin_cost_centers` ADD CONSTRAINT `fin_cost_centers_code_key` UNIQUE (`code`);
ALTER TABLE `fin_customers` ADD CONSTRAINT `fin_customers_code_key` UNIQUE (`code`);
ALTER TABLE `fin_financial_years` ADD CONSTRAINT `fin_financial_years_name_key` UNIQUE (`name`);
ALTER TABLE `fin_posting_periods` ADD CONSTRAINT `fin_posting_periods_period_name_key` UNIQUE (`period_name`);
ALTER TABLE `fin_regions` ADD CONSTRAINT `fin_regions_code_key` UNIQUE (`code`);
ALTER TABLE `fin_unit_sl_accounts` ADD CONSTRAINT `fin_unit_sl_code_uq` UNIQUE (`sl_code`);
ALTER TABLE `fin_unit_sl_accounts` ADD CONSTRAINT `fin_unit_sl_unit_gl_uq` UNIQUE (`unit_id`, `gl_code`);
ALTER TABLE `fin_vendors` ADD CONSTRAINT `fin_vendors_code_key` UNIQUE (`code`);
ALTER TABLE `fin_vouchers` ADD CONSTRAINT `fin_vouchers_accounting_event_id_key` UNIQUE (`accounting_event_id`);
ALTER TABLE `fin_vouchers` ADD CONSTRAINT `fin_vouchers_voucher_number_key` UNIQUE (`voucher_number`);
ALTER TABLE `hrms_attendance_daily` ADD CONSTRAINT `hrms_attendance_daily_employee_id_attendance_date_key` UNIQUE (`employee_id`, `attendance_date`);
ALTER TABLE `hrms_companies` ADD CONSTRAINT `hrms_companies_code_key` UNIQUE (`code`);
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_appraisal_cycle_id_employee_id_key` UNIQUE (`appraisal_cycle_id`, `employee_id`);
ALTER TABLE `hrms_entities` ADD CONSTRAINT `hrms_entities_company_id_code_key` UNIQUE (`company_id`, `code`);
ALTER TABLE `hrms_expense_types` ADD CONSTRAINT `hrms_expense_types_name_key` UNIQUE (`name`);
ALTER TABLE `hrms_grades` ADD CONSTRAINT `hrms_grades_code_key` UNIQUE (`code`);
ALTER TABLE `hrms_helpdesk_tickets` ADD CONSTRAINT `hrms_helpdesk_tickets_ticket_number_key` UNIQUE (`ticket_number`);
ALTER TABLE `hrms_leave_balances` ADD CONSTRAINT `hrms_leave_balances_employee_id_leave_type_id_year_key` UNIQUE (`employee_id`, `leave_type_id`, `year`);
ALTER TABLE `hrms_leave_types` ADD CONSTRAINT `hrms_leave_types_code_key` UNIQUE (`code`);
ALTER TABLE `hrms_payroll_cycles` ADD CONSTRAINT `hrms_payroll_cycles_company_id_cycle_month_cycle_year_key` UNIQUE (`company_id`, `cycle_month`, `cycle_year`);
ALTER TABLE `hrms_salary_components` ADD CONSTRAINT `hrms_salary_components_code_key` UNIQUE (`code`);
ALTER TABLE `inventory_parts` ADD CONSTRAINT `inventory_parts_sku_key` UNIQUE (`sku`);
ALTER TABLE `leases` ADD CONSTRAINT `leases_lease_number_key` UNIQUE (`lease_number`);
ALTER TABLE `mst_asset_categories` ADD CONSTRAINT `mst_asset_categories_name_key` UNIQUE (`name`);
ALTER TABLE `mst_asset_conditions` ADD CONSTRAINT `mst_asset_conditions_name_key` UNIQUE (`name`);
ALTER TABLE `mst_asset_ownership_types` ADD CONSTRAINT `mst_asset_ownership_types_name_key` UNIQUE (`name`);
ALTER TABLE `mst_asset_statuses` ADD CONSTRAINT `mst_asset_statuses_name_key` UNIQUE (`name`);
ALTER TABLE `mst_asset_subcategories` ADD CONSTRAINT `mst_asset_subcategories_name_category_id_key` UNIQUE (`name`, `category_id`);
ALTER TABLE `mst_departments` ADD CONSTRAINT `mst_departments_name_key` UNIQUE (`name`);
ALTER TABLE `mst_designations` ADD CONSTRAINT `mst_designations_name_key` UNIQUE (`name`);
ALTER TABLE `mst_employee_statuses` ADD CONSTRAINT `mst_employee_statuses_name_key` UNIQUE (`name`);
ALTER TABLE `mst_employment_types` ADD CONSTRAINT `mst_employment_types_name_key` UNIQUE (`name`);
ALTER TABLE `mst_facilities` ADD CONSTRAINT `mst_facilities_name_key` UNIQUE (`name`);
ALTER TABLE `mst_genders` ADD CONSTRAINT `mst_genders_name_key` UNIQUE (`name`);
ALTER TABLE `mst_payment_modes` ADD CONSTRAINT `mst_payment_modes_code_key` UNIQUE (`code`);
ALTER TABLE `mst_property_codes` ADD CONSTRAINT `mst_property_codes_code_key` UNIQUE (`code`);
ALTER TABLE `mst_ticket_categories` ADD CONSTRAINT `mst_ticket_categories_name_key` UNIQUE (`name`);
ALTER TABLE `mst_unit_codes` ADD CONSTRAINT `mst_unit_codes_code_property_code_id_key` UNIQUE (`code`, `property_code_id`);
ALTER TABLE `mst_work_locations` ADD CONSTRAINT `mst_work_locations_name_key` UNIQUE (`name`);
ALTER TABLE `platform_subscription_plans` ADD CONSTRAINT `platform_subscription_plans_plan_code_key` UNIQUE (`plan_code`);
ALTER TABLE `proc_customs_clearances` ADD CONSTRAINT `proc_customs_clearances_shipment_id_key` UNIQUE (`shipment_id`);
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_inwards_gate_inward_number_key` UNIQUE (`gate_inward_number`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_goods_receipts_grn_number_key` UNIQUE (`grn_number`);
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_unique_no` UNIQUE (`goods_receipt_id`, `line_no`);
ALTER TABLE `proc_imports` ADD CONSTRAINT `proc_imports_import_number_key` UNIQUE (`import_number`);
ALTER TABLE `proc_logistics_partners` ADD CONSTRAINT `ux_proc_logistics_partner_code` UNIQUE (`partner_code`);
ALTER TABLE `proc_negotiations` ADD CONSTRAINT `ux_proc_negotiation_round` UNIQUE (`vendor_quote_id`, `round_no`);
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_unique_no` UNIQUE (`purchase_order_id`, `line_no`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_purchase_orders_doc_number_key` UNIQUE (`doc_number`);
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `ux_proc_pr_line` UNIQUE (`purchase_request_id`, `line_no`);
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `ux_proc_purchase_request_doc` UNIQUE (`doc_number`);
ALTER TABLE `proc_rfx` ADD CONSTRAINT `ux_proc_rfx_doc` UNIQUE (`doc_number`);
ALTER TABLE `proc_rfx_lines` ADD CONSTRAINT `ux_proc_rfx_line` UNIQUE (`rfx_id`, `line_no`);
ALTER TABLE `proc_rfx_vendors` ADD CONSTRAINT `ux_proc_rfx_vendor` UNIQUE (`rfx_id`, `vendor_id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipments_shipment_number_key` UNIQUE (`shipment_number`);
ALTER TABLE `proc_transports` ADD CONSTRAINT `proc_transports_transport_number_key` UNIQUE (`transport_number`);
ALTER TABLE `proc_vendor_quote_lines` ADD CONSTRAINT `ux_proc_quote_line` UNIQUE (`vendor_quote_id`, `line_no`);
ALTER TABLE `proc_vendor_quotes` ADD CONSTRAINT `ux_proc_vendor_quote_number` UNIQUE (`quote_number`);
ALTER TABLE `property_coa_mapping` ADD CONSTRAINT `uq_property_coa_mapping` UNIQUE (`property_id`);
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_name_module_id_tenant_id_key` UNIQUE (`role_name`, `module_id`, `tenant_id`);
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_config_key_key` UNIQUE (`config_key`);
ALTER TABLE `tenant_organisations` ADD CONSTRAINT `tenant_organisations_tenant_key_key` UNIQUE (`tenant_key`);
ALTER TABLE `tenant_subscription_invoices` ADD CONSTRAINT `tenant_subscription_invoices_invoice_number_key` UNIQUE (`invoice_number`);
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `uq_unit_coa_mapping` UNIQUE (`unit_id`);
ALTER TABLE `unit_coas` ADD CONSTRAINT `unit_coas_unit_code_key` UNIQUE (`unit_code`);

-- =====================================================================
-- 4. FOREIGN KEYS
-- =====================================================================
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_employee_id_fkey` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_property_id_fkey` FOREIGN KEY (`assigned_property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL;
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_unit_id_fkey` FOREIGN KEY (`assigned_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;
ALTER TABLE `assets` ADD CONSTRAINT `assets_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_guest_id_fkey` FOREIGN KEY (`guest_id`) REFERENCES `profiles` (`id`) ON DELETE RESTRICT;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_classes` ADD CONSTRAINT `coa_classes_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `coa_groups` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_classes` ADD CONSTRAINT `coa_classes_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `coa_classes` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `coa_groups` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_groups` ADD CONSTRAINT `coa_groups_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `coa_classes` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_gl_id_fkey` FOREIGN KEY (`gl_id`) REFERENCES `coa_gl` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `coa_groups` (`id`) ON DELETE RESTRICT;
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types` (`id`) ON DELETE RESTRICT;
ALTER TABLE `collection_receipts` ADD CONSTRAINT `collection_receipts_original_receipt_id_fkey` FOREIGN KEY (`original_receipt_id`) REFERENCES `collection_receipts` (`id`) ON DELETE SET NULL;
ALTER TABLE `customers` ADD CONSTRAINT `customers_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `departments` ADD CONSTRAINT `departments_business_unit_id_fkey` FOREIGN KEY (`business_unit_id`) REFERENCES `hrms_business_units` (`id`) ON DELETE SET NULL;
ALTER TABLE `departments` ADD CONSTRAINT `departments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE SET NULL;
ALTER TABLE `designations` ADD CONSTRAINT `designations_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `designations` ADD CONSTRAINT `designations_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `hrms_grades` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `hrms_branches` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_business_unit_id_fkey` FOREIGN KEY (`business_unit_id`) REFERENCES `hrms_business_units` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `hrms_grades` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_hr_manager_id_fkey` FOREIGN KEY (`hr_manager_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_sub_department_id_fkey` FOREIGN KEY (`sub_department_id`) REFERENCES `hrms_sub_departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL;
ALTER TABLE `erp_chart_of_accounts` ADD CONSTRAINT `erp_coa_gl_code_fk` FOREIGN KEY (`gl_code`) REFERENCES `erp_chart_of_accounts` (`code`);
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `erp_journal_entries_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `erp_chart_of_accounts` (`id`);
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `erp_journal_entries_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `erp_vouchers` (`id`) ON DELETE CASCADE;
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `fk_erp_journal_entries_accounting_event` FOREIGN KEY (`accounting_event_id`) REFERENCES `fin_accounting_events` (`id`) ON DELETE RESTRICT;
ALTER TABLE `fin_accounting_event_lines` ADD CONSTRAINT `fk_fin_event_lines_account` FOREIGN KEY (`account_id`) REFERENCES `fin_coa_accounts` (`id`) ON DELETE RESTRICT;
ALTER TABLE `fin_accounting_event_lines` ADD CONSTRAINT `fk_fin_event_lines_event` FOREIGN KEY (`event_id`) REFERENCES `fin_accounting_events` (`id`) ON DELETE RESTRICT;
ALTER TABLE `fin_accounting_events` ADD CONSTRAINT `fk_fin_accounting_events_reversal` FOREIGN KEY (`reversal_of_event_id`) REFERENCES `fin_accounting_events` (`id`);
ALTER TABLE `fin_accounting_events` ADD CONSTRAINT `fk_fin_accounting_events_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `fin_vouchers` (`id`) ON DELETE RESTRICT;
ALTER TABLE `fin_bank_accounts` ADD CONSTRAINT `fin_bank_accounts_bank_id_fkey` FOREIGN KEY (`bank_id`) REFERENCES `fin_banks` (`id`) ON DELETE CASCADE;
ALTER TABLE `fin_coa_accounts` ADD CONSTRAINT `fin_coa_accounts_parent_account_id_fkey` FOREIGN KEY (`parent_account_id`) REFERENCES `fin_coa_accounts` (`id`) ON DELETE SET NULL;
ALTER TABLE `fin_coa_accounts` ADD CONSTRAINT `fk_fin_coa_accounts_parent` FOREIGN KEY (`parent_id`) REFERENCES `fin_coa_accounts` (`id`) ON DELETE RESTRICT;
ALTER TABLE `fin_unit_sl_accounts` ADD CONSTRAINT `fin_unit_sl_accounts_coa_account_id_fkey` FOREIGN KEY (`coa_account_id`) REFERENCES `fin_coa_accounts` (`id`) ON DELETE SET NULL;
ALTER TABLE `fin_voucher_lines` ADD CONSTRAINT `fk_fin_voucher_lines_account` FOREIGN KEY (`account_id`) REFERENCES `fin_coa_accounts` (`id`) ON DELETE RESTRICT;
ALTER TABLE `fin_voucher_lines` ADD CONSTRAINT `fk_fin_voucher_lines_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `fin_vouchers` (`id`) ON DELETE CASCADE;
ALTER TABLE `fin_vouchers` ADD CONSTRAINT `fk_fin_vouchers_accounting_event` FOREIGN KEY (`accounting_event_id`) REFERENCES `fin_accounting_events` (`id`) ON DELETE RESTRICT;
ALTER TABLE `hrms_announcements` ADD CONSTRAINT `hrms_announcements_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_announcements` ADD CONSTRAINT `hrms_announcements_target_department_id_fkey` FOREIGN KEY (`target_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_asset_allocations` ADD CONSTRAINT `hrms_asset_allocations_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_asset_allocations` ADD CONSTRAINT `hrms_asset_allocations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_attendance_daily` ADD CONSTRAINT `hrms_attendance_daily_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_attendance_daily` ADD CONSTRAINT `hrms_attendance_daily_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `hrms_shifts` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_attendance_raw_events` ADD CONSTRAINT `hrms_attendance_raw_events_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_attendance_regularizations` ADD CONSTRAINT `hrms_attendance_regularizations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_attendance_regularizations` ADD CONSTRAINT `hrms_attendance_regularizations_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_branches` ADD CONSTRAINT `hrms_branches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_business_units` ADD CONSTRAINT `hrms_business_units_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_appraisal_cycle_id_fkey` FOREIGN KEY (`appraisal_cycle_id`) REFERENCES `hrms_appraisal_cycles` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_employee_documents` ADD CONSTRAINT `hrms_employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_fines` ADD CONSTRAINT `hrms_employee_fines_deducted_in_payroll_id_fkey` FOREIGN KEY (`deducted_in_payroll_id`) REFERENCES `hrms_payroll_cycles` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_employee_fines` ADD CONSTRAINT `hrms_employee_fines_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_loans` ADD CONSTRAINT `hrms_employee_loans_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_salaries` ADD CONSTRAINT `hrms_employee_salaries_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_employee_transfers` ADD CONSTRAINT `hrms_employee_transfers_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_employee_transfers` ADD CONSTRAINT `hrms_employee_transfers_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_entities` ADD CONSTRAINT `hrms_entities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_cleared_by_fkey` FOREIGN KEY (`cleared_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_resignation_id_fkey` FOREIGN KEY (`resignation_id`) REFERENCES `hrms_resignations` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_expense_type_id_fkey` FOREIGN KEY (`expense_type_id`) REFERENCES `hrms_expense_types` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_resignation_id_fkey` FOREIGN KEY (`resignation_id`) REFERENCES `hrms_resignations` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_helpdesk_tickets` ADD CONSTRAINT `hrms_helpdesk_tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_helpdesk_tickets` ADD CONSTRAINT `hrms_helpdesk_tickets_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_kpa_templates` ADD CONSTRAINT `hrms_kpa_templates_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_kpa_templates` ADD CONSTRAINT `hrms_kpa_templates_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `hrms_leave_types` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_leave_balances` ADD CONSTRAINT `hrms_leave_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_leave_balances` ADD CONSTRAINT `hrms_leave_balances_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `hrms_leave_types` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_leave_encashments` ADD CONSTRAINT `hrms_leave_encashments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_leave_encashments` ADD CONSTRAINT `hrms_leave_encashments_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `hrms_leave_types` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_overtime_requests` ADD CONSTRAINT `hrms_overtime_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_overtime_requests` ADD CONSTRAINT `hrms_overtime_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_payroll_cycles` ADD CONSTRAINT `hrms_payroll_cycles_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_payroll_cycles` ADD CONSTRAINT `hrms_payroll_cycles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_payroll_payslips` ADD CONSTRAINT `hrms_payroll_payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_payroll_payslips` ADD CONSTRAINT `hrms_payroll_payslips_payroll_cycle_id_fkey` FOREIGN KEY (`payroll_cycle_id`) REFERENCES `hrms_payroll_cycles` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_resignations` ADD CONSTRAINT `hrms_resignations_accepted_by_fkey` FOREIGN KEY (`accepted_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_resignations` ADD CONSTRAINT `hrms_resignations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_shift_allocations` ADD CONSTRAINT `hrms_shift_allocations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_shift_allocations` ADD CONSTRAINT `hrms_shift_allocations_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `hrms_shifts` (`id`) ON DELETE CASCADE;
ALTER TABLE `hrms_shifts` ADD CONSTRAINT `hrms_shifts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies` (`id`) ON DELETE SET NULL;
ALTER TABLE `hrms_sub_departments` ADD CONSTRAINT `hrms_sub_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE;
ALTER TABLE `inspection_reports` ADD CONSTRAINT `inspection_reports_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `leases` (`id`) ON DELETE CASCADE;
ALTER TABLE `key_handovers` ADD CONSTRAINT `key_handovers_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `leases` (`id`) ON DELETE CASCADE;
ALTER TABLE `key_handovers` ADD CONSTRAINT `key_handovers_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `leases` ADD CONSTRAINT `leases_check_in_report_id_fkey` FOREIGN KEY (`check_in_report_id`) REFERENCES `inspection_reports` (`id`) ON DELETE SET NULL;
ALTER TABLE `leases` ADD CONSTRAINT `leases_check_out_report_id_fkey` FOREIGN KEY (`check_out_report_id`) REFERENCES `inspection_reports` (`id`) ON DELETE SET NULL;
ALTER TABLE `leases` ADD CONSTRAINT `leases_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `leases` ADD CONSTRAINT `leases_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT;
ALTER TABLE `leases` ADD CONSTRAINT `leases_previous_lease_id_fkey` FOREIGN KEY (`previous_lease_id`) REFERENCES `leases` (`id`) ON DELETE SET NULL;
ALTER TABLE `leases` ADD CONSTRAINT `leases_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT;
ALTER TABLE `material_usage` ADD CONSTRAINT `material_usage_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `inventory_parts` (`id`) ON DELETE SET NULL;
ALTER TABLE `mst_asset_subcategories` ADD CONSTRAINT `mst_asset_subcategories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `mst_asset_categories` (`id`) ON DELETE SET NULL;
ALTER TABLE `mst_unit_codes` ADD CONSTRAINT `mst_unit_codes_property_code_id_fkey` FOREIGN KEY (`property_code_id`) REFERENCES `mst_property_codes` (`id`) ON DELETE SET NULL;
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_customs_clearances` ADD CONSTRAINT `proc_customs_cha_fk` FOREIGN KEY (`cha_id`) REFERENCES `proc_logistics_partners` (`id`);
ALTER TABLE `proc_customs_clearances` ADD CONSTRAINT `proc_customs_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders` (`id`);
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_received_by_fk` FOREIGN KEY (`received_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_approved_by_fk` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_gate_fk` FOREIGN KEY (`gate_inward_id`) REFERENCES `proc_gate_inwards` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_inspected_by_fk` FOREIGN KEY (`inspected_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_received_by_fk` FOREIGN KEY (`received_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments` (`id`);
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors` (`id`);
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_grn_fk` FOREIGN KEY (`goods_receipt_id`) REFERENCES `proc_goods_receipts` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_po_line_fk` FOREIGN KEY (`purchase_order_line_id`) REFERENCES `proc_purchase_order_lines` (`id`);
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`);
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`);
ALTER TABLE `proc_imports` ADD CONSTRAINT `proc_import_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_negotiations` ADD CONSTRAINT `fk_proc_negotiation_employee` FOREIGN KEY (`negotiated_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_negotiations` ADD CONSTRAINT `fk_proc_negotiation_quote` FOREIGN KEY (`vendor_quote_id`) REFERENCES `proc_vendor_quotes` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_pr_fk` FOREIGN KEY (`source_pr_line_id`) REFERENCES `proc_purchase_request_lines` (`id`);
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`);
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_quote_fk` FOREIGN KEY (`source_quote_line_id`) REFERENCES `proc_vendor_quote_lines` (`id`);
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_rfx_fk` FOREIGN KEY (`source_rfx_line_id`) REFERENCES `proc_rfx_lines` (`id`);
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_approved_by_fk` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_cost_center_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `fin_cost_centers` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_department_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_pr_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `proc_purchase_requests` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_quote_fk` FOREIGN KEY (`vendor_quote_id`) REFERENCES `proc_vendor_quotes` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`);
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors` (`id`);
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `fk_proc_pr_line_header` FOREIGN KEY (`purchase_request_id`) REFERENCES `proc_purchase_requests` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `fk_proc_pr_line_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `fk_proc_pr_line_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_cost_center` FOREIGN KEY (`cost_center_id`) REFERENCES `fin_cost_centers` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_requester` FOREIGN KEY (`requester_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_cost_center` FOREIGN KEY (`cost_center_id`) REFERENCES `fin_cost_centers` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_pr` FOREIGN KEY (`purchase_request_id`) REFERENCES `proc_purchase_requests` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_rfx_lines` ADD CONSTRAINT `fk_proc_rfx_line_header` FOREIGN KEY (`rfx_id`) REFERENCES `proc_rfx` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_rfx_vendors` ADD CONSTRAINT `fk_proc_rfx_vendor_rfx` FOREIGN KEY (`rfx_id`) REFERENCES `proc_rfx` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_rfx_vendors` ADD CONSTRAINT `fk_proc_rfx_vendor_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors` (`id`) ON DELETE RESTRICT;
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_cha_fk` FOREIGN KEY (`cha_id`) REFERENCES `proc_logistics_partners` (`id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_forwarder_fk` FOREIGN KEY (`forwarder_id`) REFERENCES `proc_logistics_partners` (`id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders` (`id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_transporter_fk` FOREIGN KEY (`transporter_id`) REFERENCES `proc_logistics_partners` (`id`);
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors` (`id`);
ALTER TABLE `proc_transports` ADD CONSTRAINT `proc_transport_partner_fk` FOREIGN KEY (`transporter_id`) REFERENCES `proc_logistics_partners` (`id`);
ALTER TABLE `proc_transports` ADD CONSTRAINT `proc_transport_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments` (`id`);
ALTER TABLE `proc_vendor_quote_lines` ADD CONSTRAINT `fk_proc_quote_line_quote` FOREIGN KEY (`vendor_quote_id`) REFERENCES `proc_vendor_quotes` (`id`) ON DELETE CASCADE;
ALTER TABLE `proc_vendor_quote_lines` ADD CONSTRAINT `fk_proc_quote_line_rfx` FOREIGN KEY (`rfx_line_id`) REFERENCES `proc_rfx_lines` (`id`) ON DELETE SET NULL;
ALTER TABLE `proc_vendor_quotes` ADD CONSTRAINT `fk_proc_quote_rfx` FOREIGN KEY (`rfx_id`) REFERENCES `proc_rfx` (`id`) ON DELETE RESTRICT;
ALTER TABLE `proc_vendor_quotes` ADD CONSTRAINT `fk_proc_quote_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors` (`id`) ON DELETE RESTRICT;
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fkey` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `properties` ADD CONSTRAINT `properties_host_id_fkey` FOREIGN KEY (`host_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities` (`id`) ON DELETE CASCADE;
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE;
ALTER TABLE `property_coa_mapping` ADD CONSTRAINT `property_coa_mapping_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE;
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE;
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_marketing_agent_id_fkey` FOREIGN KEY (`marketing_agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE;
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `system_notifications` ADD CONSTRAINT `system_notifications_target_user_fkey` FOREIGN KEY (`target_user`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `tenant_organisations` ADD CONSTRAINT `tenant_organisations_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `tenant_organisations` ADD CONSTRAINT `tenant_organisations_onboarded_by_fkey` FOREIGN KEY (`onboarded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `tenant_subscription_invoices` ADD CONSTRAINT `tenant_subscription_invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_organisations` (`id`) ON DELETE CASCADE;
ALTER TABLE `unit_amenities` ADD CONSTRAINT `unit_amenities_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `unit_rooms` (`id`) ON DELETE CASCADE;
ALTER TABLE `unit_amenities` ADD CONSTRAINT `unit_amenities_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE;
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_deposit_sl_id_fkey` FOREIGN KEY (`deposit_sl_id`) REFERENCES `coa_sl` (`id`);
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_pdc_sl_id_fkey` FOREIGN KEY (`pdc_sl_id`) REFERENCES `coa_sl` (`id`);
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE;
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_receivable_sl_id_fkey` FOREIGN KEY (`receivable_sl_id`) REFERENCES `coa_sl` (`id`);
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE;
ALTER TABLE `unit_rooms` ADD CONSTRAINT `unit_rooms_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE;
ALTER TABLE `units` ADD CONSTRAINT `units_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE;

-- =====================================================================
-- 5. SECONDARY INDEXES
-- =====================================================================
CREATE INDEX `idx_erp_journal_entries_event` ON `erp_journal_entries` (`accounting_event_id`);
CREATE INDEX `idx_erp_journal_entries_lease` ON `erp_journal_entries` (`lease_id`);
CREATE INDEX `idx_erp_journal_entries_property` ON `erp_journal_entries` (`property_id`);
CREATE INDEX `idx_erp_journal_entries_unit` ON `erp_journal_entries` (`unit_id`);
CREATE INDEX `idx_erp_vouchers_accounting_event` ON `erp_vouchers` (`accounting_event_id`);
CREATE INDEX `idx_erp_vouchers_posting_status` ON `erp_vouchers` (`posting_status`);
CREATE INDEX `idx_erp_vouchers_source` ON `erp_vouchers` (`source_type`, `source_id`);
CREATE INDEX `idx_fin_accounting_events_event_type` ON `fin_accounting_events` (`event_type`);
CREATE INDEX `idx_fin_accounting_events_lease` ON `fin_accounting_events` (`lease_id`);
CREATE INDEX `idx_fin_accounting_events_posting_date` ON `fin_accounting_events` (`posting_date`);
CREATE INDEX `idx_fin_accounting_events_property` ON `fin_accounting_events` (`property_id`);
CREATE INDEX `idx_fin_accounting_events_source` ON `fin_accounting_events` (`source_type`, `source_id`);
CREATE INDEX `idx_fin_accounting_events_status` ON `fin_accounting_events` (`status`);
CREATE INDEX `idx_fin_coa_accounts_active` ON `fin_coa_accounts` (`is_active`);
CREATE INDEX `idx_fin_coa_accounts_code` ON `fin_coa_accounts` (`account_code`);
CREATE INDEX `idx_fin_coa_accounts_parent` ON `fin_coa_accounts` (`parent_id`);
CREATE INDEX `idx_fin_coa_accounts_type` ON `fin_coa_accounts` (`account_type`);
CREATE INDEX `idx_fin_coa_level` ON `fin_coa_accounts` (`account_level`);
CREATE INDEX `idx_fin_coa_parent` ON `fin_coa_accounts` (`parent_account_id`);
CREATE INDEX `idx_fin_event_lines_account_code` ON `fin_accounting_event_lines` (`account_code`);
CREATE INDEX `idx_fin_event_lines_account_id` ON `fin_accounting_event_lines` (`account_id`);
CREATE INDEX `idx_fin_event_lines_event` ON `fin_accounting_event_lines` (`event_id`);
CREATE INDEX `idx_fin_event_lines_lease` ON `fin_accounting_event_lines` (`lease_id`);
CREATE INDEX `idx_fin_event_lines_unit` ON `fin_accounting_event_lines` (`unit_id`);
CREATE INDEX `idx_fin_payment_allocations_event` ON `fin_payment_allocations` (`accounting_event_id`);
CREATE INDEX `idx_fin_payment_allocations_instrument` ON `fin_payment_allocations` (`payment_instrument_type`, `payment_instrument_id`);
CREATE INDEX `idx_fin_payment_allocations_lease` ON `fin_payment_allocations` (`lease_id`);
CREATE INDEX `idx_fin_payment_allocations_receipt` ON `fin_payment_allocations` (`receipt_id`);
CREATE INDEX `idx_fin_unit_sl_gl` ON `fin_unit_sl_accounts` (`gl_code`);
CREATE INDEX `idx_fin_unit_sl_property` ON `fin_unit_sl_accounts` (`property_id`);
CREATE INDEX `idx_fin_unit_sl_unit` ON `fin_unit_sl_accounts` (`unit_id`);
CREATE INDEX `idx_fin_voucher_lines_account` ON `fin_voucher_lines` (`account_id`);
CREATE INDEX `idx_fin_voucher_lines_customer` ON `fin_voucher_lines` (`customer_id`);
CREATE INDEX `idx_fin_voucher_lines_lease` ON `fin_voucher_lines` (`lease_id`);
CREATE INDEX `idx_fin_voucher_lines_property` ON `fin_voucher_lines` (`property_id`);
CREATE INDEX `idx_fin_voucher_lines_source` ON `fin_voucher_lines` (`source_type`, `source_id`);
CREATE INDEX `idx_fin_voucher_lines_tenant` ON `fin_voucher_lines` (`tenant_id`);
CREATE INDEX `idx_fin_voucher_lines_unit` ON `fin_voucher_lines` (`unit_id`);
CREATE INDEX `idx_fin_voucher_lines_voucher` ON `fin_voucher_lines` (`voucher_id`);
CREATE INDEX `idx_fin_vouchers_source` ON `fin_vouchers` (`source_type`, `source_id`);
CREATE INDEX `idx_proc_customs_shipment` ON `proc_customs_clearances` (`shipment_id`);
CREATE INDEX `idx_proc_gate_po` ON `proc_gate_inwards` (`purchase_order_id`);
CREATE INDEX `idx_proc_gate_shipment` ON `proc_gate_inwards` (`shipment_id`);
CREATE INDEX `idx_proc_grn_lines_grn` ON `proc_grn_lines` (`goods_receipt_id`);
CREATE INDEX `idx_proc_grn_lines_po_line` ON `proc_grn_lines` (`purchase_order_line_id`);
CREATE INDEX `idx_proc_grn_po` ON `proc_goods_receipts` (`purchase_order_id`);
CREATE INDEX `idx_proc_grn_status` ON `proc_goods_receipts` (`status`);
CREATE INDEX `idx_proc_grn_vendor` ON `proc_goods_receipts` (`vendor_id`);
CREATE INDEX `idx_proc_imports_shipment` ON `proc_imports` (`shipment_id`);
CREATE INDEX `idx_proc_negotiation_quote` ON `proc_negotiations` (`vendor_quote_id`);
CREATE INDEX `idx_proc_po_cost_center` ON `proc_purchase_orders` (`cost_center_id`);
CREATE INDEX `idx_proc_po_date` ON `proc_purchase_orders` (`po_date`);
CREATE INDEX `idx_proc_po_lines_po` ON `proc_purchase_order_lines` (`purchase_order_id`);
CREATE INDEX `idx_proc_po_lines_pr` ON `proc_purchase_order_lines` (`source_pr_line_id`);
CREATE INDEX `idx_proc_po_lines_quote` ON `proc_purchase_order_lines` (`source_quote_line_id`);
CREATE INDEX `idx_proc_po_lines_rfx` ON `proc_purchase_order_lines` (`source_rfx_line_id`);
CREATE INDEX `idx_proc_po_posting_status` ON `proc_purchase_orders` (`posting_status`);
CREATE INDEX `idx_proc_po_pr` ON `proc_purchase_orders` (`purchase_request_id`);
CREATE INDEX `idx_proc_po_property` ON `proc_purchase_orders` (`property_id`);
CREATE INDEX `idx_proc_po_quote` ON `proc_purchase_orders` (`vendor_quote_id`);
CREATE INDEX `idx_proc_po_status` ON `proc_purchase_orders` (`status`);
CREATE INDEX `idx_proc_po_unit` ON `proc_purchase_orders` (`unit_id`);
CREATE INDEX `idx_proc_po_vendor` ON `proc_purchase_orders` (`vendor_id`);
CREATE INDEX `idx_proc_pr_department` ON `proc_purchase_requests` (`department_id`);
CREATE INDEX `idx_proc_pr_property` ON `proc_purchase_requests` (`property_id`);
CREATE INDEX `idx_proc_pr_requester` ON `proc_purchase_requests` (`requester_id`);
CREATE INDEX `idx_proc_pr_status` ON `proc_purchase_requests` (`status`);
CREATE INDEX `idx_proc_quote_rfx` ON `proc_vendor_quotes` (`rfx_id`);
CREATE INDEX `idx_proc_quote_status` ON `proc_vendor_quotes` (`status`);
CREATE INDEX `idx_proc_quote_vendor` ON `proc_vendor_quotes` (`vendor_id`);
CREATE INDEX `idx_proc_rfx_status` ON `proc_rfx` (`status`);
CREATE INDEX `idx_proc_rfx_type` ON `proc_rfx` (`rfx_type`);
CREATE INDEX `idx_proc_rfx_vendor_vendor` ON `proc_rfx_vendors` (`vendor_id`);
CREATE INDEX `idx_proc_shipments_po` ON `proc_shipments` (`purchase_order_id`);
CREATE INDEX `idx_proc_shipments_status` ON `proc_shipments` (`status`);
CREATE INDEX `idx_proc_shipments_vendor` ON `proc_shipments` (`vendor_id`);
CREATE INDEX `idx_proc_transports_shipment` ON `proc_transports` (`shipment_id`);
CREATE INDEX `idx_security_audit_event_type` ON `security_audit_logs` (`event_type`);
CREATE INDEX `idx_security_audit_timestamp` ON `security_audit_logs` (`timestamp`);
CREATE INDEX `idx_security_audit_user_id` ON `security_audit_logs` (`user_id`);
CREATE INDEX `idx_sub_inv_status` ON `tenant_subscription_invoices` (`status`);
CREATE INDEX `idx_sub_inv_tenant_id` ON `tenant_subscription_invoices` (`tenant_id`);
CREATE INDEX `idx_sys_notif_created` ON `system_notifications` (`created_at`);
CREATE INDEX `idx_sys_notif_target` ON `system_notifications` (`target_role`, `target_user`, `is_read`);
CREATE INDEX `idx_system_configurations_cat` ON `system_configurations` (`category`);
CREATE INDEX `idx_system_configurations_key` ON `system_configurations` (`config_key`);
CREATE INDEX `idx_tenant_orgs_admin_email` ON `tenant_organisations` (`admin_email`);
CREATE INDEX `idx_tenant_orgs_key` ON `tenant_organisations` (`tenant_key`);
CREATE INDEX `idx_tenant_orgs_status` ON `tenant_organisations` (`status`);
CREATE UNIQUE INDEX `fin_transaction_account_rules_active_uniq` ON `fin_transaction_account_rules` (`transaction_type`, `payment_method`, `deposit_type`, `pdc_type`, `is_active`);
CREATE UNIQUE INDEX `fin_txn_rules_uq` ON `fin_transaction_account_rules` (`transaction_type`, `payment_method`, `deposit_type`, `pdc_type`);
CREATE UNIQUE INDEX `ux_fin_account_mappings_global` ON `fin_account_mappings` (`mapping_key`, `is_active`);
CREATE UNIQUE INDEX `ux_fin_account_mappings_property` ON `fin_account_mappings` (`mapping_key`, `property_id`, `is_active`);
CREATE UNIQUE INDEX `ux_fin_account_mappings_unit` ON `fin_account_mappings` (`mapping_key`, `unit_id`, `is_active`);
CREATE UNIQUE INDEX `ux_fin_accounting_event_lines_event_line_number` ON `fin_accounting_event_lines` (`event_id`, `line_number`);
CREATE UNIQUE INDEX `ux_fin_accounting_events_idempotency` ON `fin_accounting_events` (`idempotency_key`);
CREATE UNIQUE INDEX `ux_fin_accounting_events_voucher` ON `fin_accounting_events` (`voucher_id`);
CREATE UNIQUE INDEX `ux_fin_event_lines_event_line` ON `fin_accounting_event_lines` (`event_id`, `line_number`);

-- =====================================================================
-- 6. VIEWS
-- =====================================================================
CREATE OR REPLACE VIEW `v_posting_engine_compliance` AS
SELECT e.id AS event_id,
    e.event_type,
    e.source_type,
    e.status,
    l.line_number,
    l.account_code,
    l.debit,
    l.credit,
    CASE
        WHEN ((l.account_code IS NULL) OR (l.account_code = '')) THEN 'NO_CODE'
        WHEN (c.id IS NULL) THEN 'UNRESOLVED'
        WHEN (c.is_active = 0) THEN 'INACTIVE'
        WHEN (c.account_level = 'GL') THEN 'GL_ONLY'
        ELSE 'OK'
    END AS compliance_status
FROM ((`fin_accounting_events` e
    LEFT JOIN `fin_accounting_event_lines` l ON ((l.event_id = e.id)))
    LEFT JOIN `fin_coa_accounts` c ON (((c.account_code = l.account_code) AND (c.is_active = 1))));

-- =====================================================================
-- 7. COMMIT & RESTORE FOREIGN KEY CHECKS
-- =====================================================================
COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
