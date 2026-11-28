-- CreateTable
CREATE TABLE `amenities` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NOT NULL,
    `icon` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `purchase_cost` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `warranty_expiry_date` DATE NULL,
    `warranty_status` TEXT NULL,
    `department_id` VARCHAR(36) NULL,
    `assigned_property_id` VARCHAR(36) NULL,
    `assigned_unit_id` VARCHAR(36) NULL,
    `assigned_employee_id` VARCHAR(36) NULL,
    `assignment_date` DATE NULL,
    `asset_condition` TEXT NULL,
    `asset_status` TEXT NULL DEFAULT 'Available',
    `life_of_asset` INTEGER NULL,
    `opening_cost` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `last_service_date` DATE NULL,
    `next_service_date` DATE NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `assigned_property_code` TEXT NULL,
    `assigned_unit_code` TEXT NULL,
    `assigned_employee_name` TEXT NULL,
    `addition_during_year` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_asset_value` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `disposal_value` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `opening_accumulated_depreciation` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `current_year_depreciation` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `closing_accumulated_depreciation` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `net_book_value` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `return_date` DATE NULL,
    `disposal_date` DATE NULL,
    `department` TEXT NULL,
    `depreciation_method` TEXT NULL,
    `depreciation_rate` DECIMAL(18, 4) NULL,
    `salvage_value` DECIMAL(18, 4) NULL DEFAULT 0.0000,

    UNIQUE INDEX `assets_asset_code_key`(`asset_code`),
    INDEX `assets_assigned_employee_id_fkey`(`assigned_employee_id`),
    INDEX `assets_assigned_property_id_fkey`(`assigned_property_id`),
    INDEX `assets_assigned_unit_id_fkey`(`assigned_unit_id`),
    INDEX `assets_department_id_fkey`(`department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `property_id` VARCHAR(36) NULL,
    `guest_id` VARCHAR(36) NULL,
    `check_in` DATE NOT NULL,
    `check_out` DATE NOT NULL,
    `guests_count` INTEGER NOT NULL,
    `total_price` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'PENDING',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `bookings_guest_id_fkey`(`guest_id`),
    INDEX `bookings_property_id_fkey`(`property_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coa_classes` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `group_id` VARCHAR(36) NOT NULL,
    `type_id` VARCHAR(36) NOT NULL,
    `group_code` TEXT NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `coa_classes_code_key`(`code`),
    INDEX `coa_classes_group_id_fkey`(`group_id`),
    INDEX `coa_classes_type_id_fkey`(`type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coa_gl` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `class_id` VARCHAR(36) NOT NULL,
    `group_id` VARCHAR(36) NOT NULL,
    `type_id` VARCHAR(36) NOT NULL,
    `class_code` TEXT NOT NULL,
    `group_code` TEXT NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `normal_balance` TEXT NOT NULL,
    `is_control_account` BOOLEAN NOT NULL DEFAULT false,
    `is_posting_account` BOOLEAN NOT NULL DEFAULT true,
    `allows_direct_posting` BOOLEAN NOT NULL DEFAULT true,
    `requires_property` BOOLEAN NOT NULL DEFAULT false,
    `requires_unit` BOOLEAN NOT NULL DEFAULT false,
    `requires_tenant` BOOLEAN NOT NULL DEFAULT false,
    `requires_vendor` BOOLEAN NOT NULL DEFAULT false,
    `requires_employee` BOOLEAN NOT NULL DEFAULT false,
    `requires_asset` BOOLEAN NOT NULL DEFAULT false,
    `requires_inventory` BOOLEAN NOT NULL DEFAULT false,
    `requires_security_deposit` BOOLEAN NOT NULL DEFAULT false,
    `requires_pdc` BOOLEAN NOT NULL DEFAULT false,
    `requires_lease` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `coa_gl_code_key`(`code`),
    INDEX `coa_gl_class_id_fkey`(`class_id`),
    INDEX `coa_gl_group_id_fkey`(`group_id`),
    INDEX `coa_gl_type_id_fkey`(`type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coa_groups` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `type_id` VARCHAR(36) NOT NULL,
    `type_code` TEXT NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `coa_groups_code_key`(`code`),
    INDEX `coa_groups_type_id_fkey`(`type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coa_sl` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `is_control_account` BOOLEAN NOT NULL DEFAULT false,
    `is_posting_account` BOOLEAN NOT NULL DEFAULT true,
    `allows_direct_posting` BOOLEAN NOT NULL DEFAULT true,
    `requires_property` BOOLEAN NOT NULL DEFAULT false,
    `requires_unit` BOOLEAN NOT NULL DEFAULT false,
    `requires_tenant` BOOLEAN NOT NULL DEFAULT false,
    `requires_vendor` BOOLEAN NOT NULL DEFAULT false,
    `requires_employee` BOOLEAN NOT NULL DEFAULT false,
    `requires_asset` BOOLEAN NOT NULL DEFAULT false,
    `requires_inventory` BOOLEAN NOT NULL DEFAULT false,
    `requires_security_deposit` BOOLEAN NOT NULL DEFAULT false,
    `requires_pdc` BOOLEAN NOT NULL DEFAULT false,
    `requires_lease` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `coa_sl_code_key`(`code`),
    INDEX `coa_sl_class_id_fkey`(`class_id`),
    INDEX `coa_sl_gl_id_fkey`(`gl_id`),
    INDEX `coa_sl_group_id_fkey`(`group_id`),
    INDEX `coa_sl_type_id_fkey`(`type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coa_types` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `normal_balance` TEXT NOT NULL,
    `report_type` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `coa_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_receipts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `lease_collection_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `receipt_no` VARCHAR(255) NOT NULL,
    `receipt_date` DATE NOT NULL DEFAULT (curdate()),
    `tenant_name` TEXT NOT NULL,
    `property_unit` TEXT NOT NULL,
    `payment_type` TEXT NOT NULL,
    `payment_method` TEXT NOT NULL,
    `transaction_reference` TEXT NULL,
    `amount` DECIMAL(18, 4) NULL,
    `collection_period` TEXT NULL,
    `cashier_name` TEXT NULL,
    `print_count` INTEGER NOT NULL DEFAULT 0,
    `emailed_at` DATETIME(6) NULL,
    `shared_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `original_receipt_id` VARCHAR(36) NULL,
    `version` INTEGER NULL DEFAULT 1,
    `cancellation_reason` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'active',

    UNIQUE INDEX `collection_receipts_receipt_no_key`(`receipt_no`),
    INDEX `collection_receipts_original_receipt_id_fkey`(`original_receipt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
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
    `contact_email` TEXT NULL,
    `customer_code` VARCHAR(50) NULL,

    UNIQUE INDEX `uq_customers_qatar_id`(`qatar_id`(64)),
    UNIQUE INDEX `uq_customers_tax_id`(`tax_identification_no`(64)),
    UNIQUE INDEX `uq_customers_customer_code`(`customer_code`),
    INDEX `customers_verified_by_fkey`(`verified_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `code` VARCHAR(255) NULL,
    `company_id` VARCHAR(36) NULL,
    `business_unit_id` VARCHAR(36) NULL,
    `department_head_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `departments_name_key`(`name`),
    INDEX `departments_business_unit_id_fkey`(`business_unit_id`),
    INDEX `departments_company_id_fkey`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `department_id` VARCHAR(36) NULL,
    `level` INTEGER NULL DEFAULT 1,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `code` VARCHAR(255) NULL,
    `grade_id` VARCHAR(36) NULL,
    `job_level` INTEGER NULL DEFAULT 1,
    `is_active` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `designations_title_key`(`title`),
    INDEX `designations_department_id_fkey`(`department_id`),
    INDEX `designations_grade_id_fkey`(`grade_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `basic_salary` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `hra` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `tra` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `other_allowances` DECIMAL(18, 4) NULL DEFAULT 0.0000,
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
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
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
    `notice_period_days` INTEGER NULL DEFAULT 30,
    `date_of_exit` DATE NULL,
    `exit_reason` TEXT NULL,
    `rehire_eligible` BOOLEAN NULL DEFAULT true,
    `device_user_id` TEXT NULL,
    `bank_account_holder` TEXT NULL,
    `bank_account_type` TEXT NULL DEFAULT 'Checking',
    `swift_code` TEXT NULL,
    `emergency_contacts` LONGTEXT NULL DEFAULT '[]',
    `qualifications` LONGTEXT NULL DEFAULT '[]',
    `previous_experience` LONGTEXT NULL DEFAULT '[]',
    `approval_limit` DECIMAL(18, 4) NULL,

    UNIQUE INDEX `employees_employee_id_code_key`(`employee_id_code`),
    UNIQUE INDEX `employees_user_id_key`(`user_id`),
    UNIQUE INDEX `employees_email_key`(`email`),
    INDEX `employees_branch_id_fkey`(`branch_id`),
    INDEX `employees_business_unit_id_fkey`(`business_unit_id`),
    INDEX `employees_company_id_fkey`(`company_id`),
    INDEX `employees_department_id_fkey`(`department_id`),
    INDEX `employees_designation_id_fkey`(`designation_id`),
    INDEX `employees_grade_id_fkey`(`grade_id`),
    INDEX `employees_hr_manager_id_fkey`(`hr_manager_id`),
    INDEX `employees_reporting_manager_id_fkey`(`reporting_manager_id`),
    INDEX `employees_sub_department_id_fkey`(`sub_department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `erp_chart_of_accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `sl_name` TEXT NULL,

    UNIQUE INDEX `erp_chart_of_accounts_code_key`(`code`),
    INDEX `erp_coa_gl_code_fk`(`gl_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `erp_chart_of_accounts_backup_20260823` (
    `id` VARCHAR(36) NOT NULL,
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
    `sl_name` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `erp_journal_entries` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `voucher_id` VARCHAR(36) NULL,
    `account_id` VARCHAR(36) NULL,
    `account_name` TEXT NULL,
    `debit` DECIMAL(18, 4) NULL,
    `credit` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `accounting_event_id` VARCHAR(36) NULL,
    `line_number` INTEGER NULL,
    `description` TEXT NULL,
    `lease_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,

    INDEX `erp_journal_entries_account_id_fkey`(`account_id`),
    INDEX `erp_journal_entries_voucher_id_fkey`(`voucher_id`),
    INDEX `idx_erp_journal_entries_event`(`accounting_event_id`),
    INDEX `idx_erp_journal_entries_lease`(`lease_id`),
    INDEX `idx_erp_journal_entries_property`(`property_id`),
    INDEX `idx_erp_journal_entries_unit`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `erp_vouchers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `voucher_no` VARCHAR(255) NOT NULL,
    `voucher_type` TEXT NOT NULL,
    `voucher_date` DATE NOT NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `accounting_event_id` VARCHAR(36) NULL,
    `source_type` VARCHAR(255) NULL,
    `source_id` VARCHAR(36) NULL,
    `posting_status` VARCHAR(255) NOT NULL DEFAULT 'POSTED',
    `reversal_of_voucher_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NULL,

    UNIQUE INDEX `erp_vouchers_voucher_no_key`(`voucher_no`),
    INDEX `idx_erp_vouchers_accounting_event`(`accounting_event_id`),
    INDEX `idx_erp_vouchers_posting_status`(`posting_status`),
    INDEX `idx_erp_vouchers_source`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_account_mappings` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `mapping_key` VARCHAR(255) NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `account_code` TEXT NULL,
    `account_name` TEXT NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `company_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `effective_from` DATE NOT NULL DEFAULT (curdate()),
    `effective_to` DATE NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_fin_account_mappings_global`(`mapping_key`, `is_active`),
    UNIQUE INDEX `ux_fin_account_mappings_property`(`mapping_key`, `property_id`, `is_active`),
    UNIQUE INDEX `ux_fin_account_mappings_unit`(`mapping_key`, `unit_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_accounting_event_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `event_id` VARCHAR(36) NOT NULL,
    `line_number` INTEGER NOT NULL,
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
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_fin_event_lines_account_code`(`account_code`),
    INDEX `idx_fin_event_lines_account_id`(`account_id`),
    INDEX `idx_fin_event_lines_event`(`event_id`),
    INDEX `idx_fin_event_lines_lease`(`lease_id`),
    INDEX `idx_fin_event_lines_unit`(`unit_id`),
    UNIQUE INDEX `ux_fin_accounting_event_lines_event_line_number`(`event_id`, `line_number`),
    UNIQUE INDEX `ux_fin_event_lines_event_line`(`event_id`, `line_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_accounting_events` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `event_type` ENUM('RENT_RECEIVABLE', 'RENT_COLLECTION', 'RENT_ADJUSTMENT', 'SECURITY_DEPOSIT_RECEIVED', 'SECURITY_DEPOSIT_TRANSFERRED', 'SECURITY_DEPOSIT_ADJUSTED', 'SECURITY_DEPOSIT_REFUNDED', 'PDC_RECEIVED', 'PDC_DEPOSITED', 'PDC_CLEARED', 'PDC_BOUNCED', 'PDC_CANCELLED', 'PDC_RETURNED', 'PDC_REPLACED', 'RECEIPT_CREATED', 'RECEIPT_CANCELLED', 'REFUND_CREATED', 'REFUND_CANCELLED', 'MANUAL_JOURNAL', 'ADJUSTMENT') NOT NULL,
    `status` ENUM('DRAFT', 'POSTING', 'POSTED', 'REVERSED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `event_date` DATE NOT NULL DEFAULT (curdate()),
    `posting_date` DATE NOT NULL DEFAULT (curdate()),
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
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `created_by` VARCHAR(36) NULL,
    `posted_by` VARCHAR(36) NULL,
    `reversed_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `posted_at` DATETIME(6) NULL,
    `reversed_at` DATETIME(6) NULL,
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_fin_accounting_events_idempotency`(`idempotency_key`),
    UNIQUE INDEX `ux_fin_accounting_events_voucher`(`voucher_id`),
    INDEX `fk_fin_accounting_events_reversal`(`reversal_of_event_id`),
    INDEX `idx_fin_accounting_events_event_type`(`event_type`),
    INDEX `idx_fin_accounting_events_lease`(`lease_id`),
    INDEX `idx_fin_accounting_events_posting_date`(`posting_date`),
    INDEX `idx_fin_accounting_events_property`(`property_id`),
    INDEX `idx_fin_accounting_events_source`(`source_type`, `source_id`),
    INDEX `idx_fin_accounting_events_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_bank_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bank_id` INTEGER NULL,
    `account_number` VARCHAR(255) NOT NULL,
    `account_title` TEXT NOT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `opening_balance` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `gl_code` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',

    UNIQUE INDEX `fin_bank_accounts_account_number_key`(`account_number`),
    UNIQUE INDEX `uq_fin_bank_accounts_gl_code`(`gl_code`),
    INDEX `fin_bank_accounts_bank_id_fkey`(`bank_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_bank_reconciliations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_number` TEXT NOT NULL,
    `statement_date` DATE NOT NULL,
    `statement_balance` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `book_balance` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_banks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `swift_code` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',

    UNIQUE INDEX `fin_banks_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_coa_accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `account_code` VARCHAR(255) NOT NULL,
    `account_name` TEXT NOT NULL,
    `account_type` VARCHAR(255) NOT NULL,
    `parent_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `parent_account_id` VARCHAR(36) NULL,
    `group_name` TEXT NULL,
    `class_name` TEXT NULL,
    `account_level` VARCHAR(255) NOT NULL DEFAULT 'GL',

    UNIQUE INDEX `fin_coa_accounts_account_code_key`(`account_code`),
    INDEX `idx_fin_coa_accounts_active`(`is_active`),
    INDEX `idx_fin_coa_accounts_code`(`account_code`),
    INDEX `idx_fin_coa_accounts_parent`(`parent_id`),
    INDEX `idx_fin_coa_accounts_type`(`account_type`),
    INDEX `idx_fin_coa_level`(`account_level`),
    INDEX `idx_fin_coa_parent`(`parent_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contract_number` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `party_name` TEXT NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `total_value` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active',

    UNIQUE INDEX `fin_contracts_contract_number_key`(`contract_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_cost_centers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `manager` TEXT NULL,

    UNIQUE INDEX `fin_cost_centers_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NULL DEFAULT 'Individual',
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(255) NULL,
    `credit_limit` DECIMAL(18, 4) NULL DEFAULT 0.0000,

    UNIQUE INDEX `fin_customers_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_deposits` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `deposit_type` TEXT NOT NULL,
    `coa_account_code` TEXT NOT NULL,
    `amount` DECIMAL(18, 4) NULL,
    `tenant_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Held',
    `receipt_ref` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `payment_mode` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_financial_years` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active',

    UNIQUE INDEX `fin_financial_years_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_legal_receivables` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(36) NOT NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `original_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `outstanding_balance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `escalation_date` DATE NOT NULL,
    `reason` TEXT NULL,
    `legal_case_id` TEXT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_payment_allocations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `allocation_date` DATE NOT NULL DEFAULT (curdate()),
    `status` VARCHAR(255) NOT NULL DEFAULT 'ALLOCATED',
    `reversal_of_allocation_id` VARCHAR(36) NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_fin_payment_allocations_event`(`accounting_event_id`),
    INDEX `idx_fin_payment_allocations_instrument`(`payment_instrument_type`, `payment_instrument_id`),
    INDEX `idx_fin_payment_allocations_lease`(`lease_id`),
    INDEX `idx_fin_payment_allocations_receipt`(`receipt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_payroll_syncs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `payroll_run_id` TEXT NOT NULL,
    `period` TEXT NOT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Pending',
    `total_amount` DECIMAL(18, 4) NULL,
    `error_details` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_pdc_register` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `cheque_number` TEXT NOT NULL,
    `bank_id` BIGINT NULL,
    `cheque_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `tenant_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'In Hand',
    `deposit_date` DATE NULL,
    `cleared_date` DATE NULL,
    `returned_date` DATE NULL,
    `original_pdc_id` BIGINT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `lease_id` VARCHAR(36) NULL,

    INDEX `idx_fin_pdc_register_lease`(`lease_id`),
    INDEX `idx_fin_pdc_register_property`(`property_id`),
    INDEX `idx_fin_pdc_register_status`(`status`),
    INDEX `idx_fin_pdc_register_tenant`(`tenant_id`),
    INDEX `idx_fin_pdc_register_unit`(`unit_id`),
    UNIQUE INDEX `uq_fin_pdc_lease_cheque`(`lease_id`, `cheque_number`(100)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_posting_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `period_name` VARCHAR(255) NOT NULL,
    `year` TEXT NOT NULL,
    `month` INTEGER NOT NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Open',

    UNIQUE INDEX `fin_posting_periods_period_name_key`(`period_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_regions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',

    UNIQUE INDEX `fin_regions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_transaction_account_rules` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `transaction_type` VARCHAR(255) NOT NULL,
    `payment_method` VARCHAR(255) NULL,
    `deposit_type` VARCHAR(255) NULL,
    `pdc_type` VARCHAR(255) NULL,
    `debit_gl_code` TEXT NOT NULL,
    `debit_sl_code` TEXT NULL,
    `credit_gl_code` TEXT NOT NULL,
    `credit_sl_code` TEXT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `fin_transaction_account_rules_active_uniq`(`transaction_type`, `payment_method`, `deposit_type`, `pdc_type`, `is_active`),
    UNIQUE INDEX `fin_txn_rules_uq`(`transaction_type`, `payment_method`, `deposit_type`, `pdc_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_unit_sl_accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NOT NULL,
    `property_id` VARCHAR(36) NOT NULL,
    `gl_code` VARCHAR(255) NOT NULL,
    `sl_code` VARCHAR(255) NOT NULL,
    `sl_name` TEXT NOT NULL,
    `coa_account_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `fin_unit_sl_code_uq`(`sl_code`),
    INDEX `fin_unit_sl_accounts_coa_account_id_fkey`(`coa_account_id`),
    INDEX `idx_fin_unit_sl_gl`(`gl_code`),
    INDEX `idx_fin_unit_sl_property`(`property_id`),
    INDEX `idx_fin_unit_sl_unit`(`unit_id`),
    UNIQUE INDEX `fin_unit_sl_unit_gl_uq`(`unit_id`, `gl_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
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
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `fin_vendors_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_voucher_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `voucher_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NOT NULL,
    `account_code` TEXT NULL,
    `account_name` TEXT NULL,
    `debit_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `credit_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `description` TEXT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `cost_center_id` VARCHAR(36) NULL,
    `source_type` VARCHAR(255) NULL,
    `source_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_fin_voucher_lines_account`(`account_id`),
    INDEX `idx_fin_voucher_lines_customer`(`customer_id`),
    INDEX `idx_fin_voucher_lines_lease`(`lease_id`),
    INDEX `idx_fin_voucher_lines_property`(`property_id`),
    INDEX `idx_fin_voucher_lines_source`(`source_type`, `source_id`),
    INDEX `idx_fin_voucher_lines_tenant`(`tenant_id`),
    INDEX `idx_fin_voucher_lines_unit`(`unit_id`),
    INDEX `idx_fin_voucher_lines_voucher`(`voucher_id`),
    INDEX `idx_fin_voucher_lines_code`(`account_code`(50)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_vouchers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `voucher_number` VARCHAR(255) NOT NULL,
    `voucher_date` DATE NOT NULL,
    `voucher_type` TEXT NOT NULL,
    `reference_no` TEXT NULL,
    `description` TEXT NULL,
    `total_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `status` VARCHAR(255) NOT NULL DEFAULT 'DRAFT',
    `accounting_event_id` VARCHAR(36) NULL,
    `posted_by` VARCHAR(36) NULL,
    `posted_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_type` VARCHAR(255) NULL,
    `source_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NULL,

    UNIQUE INDEX `fin_vouchers_voucher_number_key`(`voucher_number`),
    UNIQUE INDEX `fin_vouchers_accounting_event_id_key`(`accounting_event_id`),
    INDEX `idx_fin_vouchers_source`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fixed_assets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_announcements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `priority` TEXT NULL DEFAULT 'Normal',
    `target_department_id` VARCHAR(36) NULL,
    `posted_by` VARCHAR(36) NULL,
    `is_published` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_announcements_posted_by_fkey`(`posted_by`),
    INDEX `hrms_announcements_target_department_id_fkey`(`target_department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_appraisal_cycles` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `interval_type` TEXT NULL DEFAULT 'Annual',
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_asset_allocations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `asset_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `allocated_date` DATE NOT NULL,
    `expected_return_date` DATE NULL,
    `returned_date` DATE NULL,
    `condition_at_allocation` TEXT NULL DEFAULT 'Good',
    `condition_at_return` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Allocated',
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_asset_allocations_asset_id_fkey`(`asset_id`),
    INDEX `hrms_asset_allocations_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_attendance_daily` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `attendance_date` DATE NOT NULL,
    `shift_id` VARCHAR(36) NULL,
    `first_in` DATETIME(6) NULL,
    `last_out` DATETIME(6) NULL,
    `total_working_hours` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `break_hours` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `late_minutes` INTEGER NULL DEFAULT 0,
    `early_minutes` INTEGER NULL DEFAULT 0,
    `overtime_minutes` INTEGER NULL DEFAULT 0,
    `status` VARCHAR(255) NOT NULL DEFAULT 'PRESENT',
    `is_regularized` BOOLEAN NULL DEFAULT false,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_attendance_daily_shift_id_fkey`(`shift_id`),
    UNIQUE INDEX `hrms_attendance_daily_employee_id_attendance_date_key`(`employee_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_attendance_raw_events` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `device_id` TEXT NULL,
    `device_user_id` TEXT NULL,
    `event_time` DATETIME(6) NOT NULL,
    `direction` TEXT NOT NULL,
    `source` TEXT NULL DEFAULT 'Web',
    `location` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_attendance_raw_events_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_attendance_regularizations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `attendance_date` DATE NOT NULL,
    `requested_in` DATETIME(6) NULL,
    `requested_out` DATETIME(6) NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `reviewed_by` VARCHAR(36) NULL,
    `reviewed_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_attendance_regularizations_employee_id_fkey`(`employee_id`),
    INDEX `hrms_attendance_regularizations_reviewed_by_fkey`(`reviewed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_branches` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `company_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `region` TEXT NULL,
    `timezone` TEXT NULL DEFAULT 'Asia/Qatar',
    `address` TEXT NULL,
    `contact_number` TEXT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_branches_company_id_fkey`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_business_units` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `company_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `head_employee_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_business_units_company_id_fkey`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_companies` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `legal_name` TEXT NULL,
    `registration_no` TEXT NULL,
    `tax_id` TEXT NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `financial_year_start` DATE NULL DEFAULT ('2026-01-01'),
    `country` VARCHAR(255) NULL DEFAULT 'Qatar',
    `state` VARCHAR(255) NULL,
    `city` VARCHAR(255) NULL DEFAULT 'Doha',
    `address` TEXT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_companies_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_employee_appraisals` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `appraisal_cycle_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `manager_id` VARCHAR(36) NULL,
    `self_score` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `manager_score` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `peer_score` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `final_score` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `self_remarks` TEXT NULL,
    `manager_remarks` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Initiated',
    `completed_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_employee_appraisals_employee_id_fkey`(`employee_id`),
    INDEX `hrms_employee_appraisals_manager_id_fkey`(`manager_id`),
    UNIQUE INDEX `hrms_employee_appraisals_appraisal_cycle_id_employee_id_key`(`appraisal_cycle_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_employee_documents` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `document_type` VARCHAR(255) NOT NULL,
    `document_name` TEXT NOT NULL,
    `document_url` TEXT NOT NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `verification_status` TEXT NULL DEFAULT 'Verified',
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_employee_documents_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_employee_fines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `incident_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `deducted_in_payroll_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_employee_fines_deducted_in_payroll_id_fkey`(`deducted_in_payroll_id`),
    INDEX `hrms_employee_fines_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_employee_loans` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `loan_amount` DECIMAL(18, 4) NOT NULL,
    `disbursed_date` DATE NOT NULL,
    `tenure_months` INTEGER NOT NULL,
    `monthly_emi` DECIMAL(18, 4) NOT NULL,
    `total_repaid` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `remaining_balance` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_employee_loans_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_employee_salaries` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `basic_salary` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `hra` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `transport_allowance` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `other_allowance` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `gross_salary` DECIMAL(18, 4) NULL,
    `components` LONGTEXT NULL DEFAULT '[]',
    `is_current` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_employee_salaries_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_employee_transfers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `effective_date` DATE NOT NULL,
    `transfer_type` TEXT NOT NULL,
    `from_details` LONGTEXT NOT NULL,
    `to_details` LONGTEXT NOT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Approved',
    `approved_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_employee_transfers_approved_by_fkey`(`approved_by`),
    INDEX `hrms_employee_transfers_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_entities` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `company_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_entities_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_exit_clearances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `resignation_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `department_name` TEXT NOT NULL,
    `cleared_by` VARCHAR(36) NULL,
    `is_cleared` BOOLEAN NULL DEFAULT false,
    `cleared_at` DATETIME(6) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_exit_clearances_cleared_by_fkey`(`cleared_by`),
    INDEX `hrms_exit_clearances_employee_id_fkey`(`employee_id`),
    INDEX `hrms_exit_clearances_resignation_id_fkey`(`resignation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_expense_claims` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_expense_claims_approved_by_fkey`(`approved_by`),
    INDEX `hrms_expense_claims_employee_id_fkey`(`employee_id`),
    INDEX `hrms_expense_claims_expense_type_id_fkey`(`expense_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_expense_types` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(255) NOT NULL,
    `max_limit` DECIMAL(18, 4) NULL DEFAULT 5000.0000,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_expense_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_fnf_settlements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `resignation_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `settlement_date` DATE NOT NULL,
    `last_working_date` DATE NOT NULL,
    `unpaid_salary` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `leave_encashment` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `gratuity_amount` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `notice_pay_adjustment` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `other_earnings` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_gross_settlement` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `loan_deduction` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `asset_recovery_deduction` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `other_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `net_payable` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `status` VARCHAR(255) NULL DEFAULT 'Draft',
    `approved_by` VARCHAR(36) NULL,
    `disbursed_at` DATETIME(6) NULL,
    `payment_reference` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_fnf_settlements_approved_by_fkey`(`approved_by`),
    INDEX `hrms_fnf_settlements_employee_id_fkey`(`employee_id`),
    INDEX `hrms_fnf_settlements_resignation_id_fkey`(`resignation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_grades` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `level` INTEGER NULL DEFAULT 1,
    `min_salary` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `max_salary` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `benefits` LONGTEXT NULL DEFAULT '[]',
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_grades_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_helpdesk_tickets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_helpdesk_tickets_ticket_number_key`(`ticket_number`),
    INDEX `hrms_helpdesk_tickets_assigned_to_fkey`(`assigned_to`),
    INDEX `hrms_helpdesk_tickets_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_kpa_templates` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `department_id` VARCHAR(36) NULL,
    `designation_id` VARCHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `weightage` INTEGER NULL DEFAULT 100,
    `metrics` LONGTEXT NULL DEFAULT '[]',
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_kpa_templates_department_id_fkey`(`department_id`),
    INDEX `hrms_kpa_templates_designation_id_fkey`(`designation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_leave_applications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `review_notes` TEXT NULL,

    INDEX `hrms_leave_applications_employee_id_fkey`(`employee_id`),
    INDEX `hrms_leave_applications_leave_type_id_fkey`(`leave_type_id`),
    INDEX `hrms_leave_applications_reviewed_by_fkey`(`reviewed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_leave_balances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `leave_type_id` VARCHAR(36) NULL,
    `year` INTEGER NOT NULL,
    `total_entitled` DECIMAL(18, 4) NULL DEFAULT 30.0000,
    `used` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `pending` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `encashed` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `balance` DECIMAL(18, 4) NULL,
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_leave_balances_leave_type_id_fkey`(`leave_type_id`),
    UNIQUE INDEX `hrms_leave_balances_employee_id_leave_type_id_year_key`(`employee_id`, `leave_type_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_leave_encashments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `leave_type_id` VARCHAR(36) NULL,
    `days_encashed` DECIMAL(18, 4) NOT NULL,
    `calculated_amount` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_leave_encashments_employee_id_fkey`(`employee_id`),
    INDEX `hrms_leave_encashments_leave_type_id_fkey`(`leave_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_leave_types` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `annual_allowance` INTEGER NULL DEFAULT 30,
    `is_paid` BOOLEAN NULL DEFAULT true,
    `is_encashable` BOOLEAN NULL DEFAULT true,
    `carry_forward_limit` INTEGER NULL DEFAULT 10,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_leave_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_overtime_requests` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `overtime_date` DATE NOT NULL,
    `overtime_hours` DECIMAL(18, 4) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Pending',
    `approved_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_overtime_requests_approved_by_fkey`(`approved_by`),
    INDEX `hrms_overtime_requests_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_payroll_cycles` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `company_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `cycle_month` INTEGER NOT NULL,
    `cycle_year` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Draft',
    `total_gross` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_net` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_employees` INTEGER NULL DEFAULT 0,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_payroll_cycles_approved_by_fkey`(`approved_by`),
    UNIQUE INDEX `hrms_payroll_cycles_company_id_cycle_month_cycle_year_key`(`company_id`, `cycle_month`, `cycle_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_payroll_payslips` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `payroll_cycle_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NULL,
    `working_days` DECIMAL(18, 4) NULL DEFAULT 30.0000,
    `present_days` DECIMAL(18, 4) NULL DEFAULT 30.0000,
    `paid_leaves` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `unpaid_leaves` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `overtime_hours` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `basic_pay` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `allowances` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `overtime_pay` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `incentives` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `gross_earnings` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `statutory_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `loan_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `fines_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `total_deductions` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `net_salary` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `status` VARCHAR(255) NULL DEFAULT 'Generated',
    `payment_mode` TEXT NULL DEFAULT 'Bank Transfer',
    `payment_reference` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_payroll_payslips_employee_id_fkey`(`employee_id`),
    INDEX `hrms_payroll_payslips_payroll_cycle_id_fkey`(`payroll_cycle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_resignations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `resignation_date` DATE NOT NULL,
    `requested_last_working_date` DATE NOT NULL,
    `approved_last_working_date` DATE NULL,
    `notice_period_served_days` INTEGER NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Submitted',
    `accepted_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_resignations_accepted_by_fkey`(`accepted_by`),
    INDEX `hrms_resignations_employee_id_fkey`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_salary_components` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `is_statutory` BOOLEAN NULL DEFAULT false,
    `is_taxable` BOOLEAN NULL DEFAULT true,
    `calculation_type` TEXT NULL DEFAULT 'Fixed',
    `default_amount` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `hrms_salary_components_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_salary_structures` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_shift_allocations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `employee_id` VARCHAR(36) NULL,
    `shift_id` VARCHAR(36) NULL,
    `from_date` DATE NOT NULL,
    `to_date` DATE NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_shift_allocations_employee_id_fkey`(`employee_id`),
    INDEX `hrms_shift_allocations_shift_id_fkey`(`shift_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_shifts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `company_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `start_time` TIME(6) NOT NULL,
    `end_time` TIME(6) NOT NULL,
    `break_duration_minutes` INTEGER NULL DEFAULT 60,
    `grace_period_minutes` INTEGER NULL DEFAULT 15,
    `is_night_shift` BOOLEAN NULL DEFAULT false,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_shifts_company_id_fkey`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_sub_departments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `department_id` VARCHAR(36) NULL,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `hrms_sub_departments_department_id_fkey`(`department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inspection_reports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `lease_id` VARCHAR(36) NULL,
    `inspection_type` TEXT NOT NULL,
    `inspection_date` DATETIME(6) NOT NULL,
    `unit_condition` LONGTEXT NULL DEFAULT '{}',
    `furniture` LONGTEXT NULL DEFAULT '{}',
    `appliances` LONGTEXT NULL DEFAULT '{}',
    `fixtures` LONGTEXT NULL DEFAULT '{}',
    `meter_readings` LONGTEXT NULL DEFAULT '{}',
    `keys_access` LONGTEXT NULL DEFAULT '{}',
    `photos` LONGTEXT NULL DEFAULT '[]',
    `damages` LONGTEXT NULL DEFAULT '[]',
    `pending_work` LONGTEXT NULL DEFAULT '[]',
    `inspector_name` TEXT NOT NULL,
    `tenant_acknowledged` BOOLEAN NULL DEFAULT false,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `inspection_reports_lease_id_fkey`(`lease_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_parts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(255) NULL,
    `quantity_on_hand` INTEGER NOT NULL DEFAULT 0,
    `unit_cost` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `inventory_parts_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `key_handovers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `lease_id` VARCHAR(36) NULL,
    `handover_date` DATETIME(6) NOT NULL,
    `keys_issued` LONGTEXT NULL DEFAULT '[]',
    `access_cards_issued` LONGTEXT NULL DEFAULT '[]',
    `parking_remotes` LONGTEXT NULL DEFAULT '[]',
    `meter_readings` LONGTEXT NULL DEFAULT '{}',
    `staff_name` TEXT NOT NULL,
    `staff_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `key_handovers_lease_id_fkey`(`lease_id`),
    INDEX `key_handovers_staff_id_fkey`(`staff_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leases` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `lease_number` VARCHAR(255) NOT NULL,
    `lease_status` TEXT NULL DEFAULT 'DRAFT',
    `commencement_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `lease_period_months` INTEGER NOT NULL,
    `rental_amount` DECIMAL(18, 4) NOT NULL,
    `payment_frequency` TEXT NULL DEFAULT 'Monthly',
    `security_deposit` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `security_deposit_status` TEXT NULL DEFAULT 'Pending',
    `grace_period_days` INTEGER NULL DEFAULT 5,
    `late_penalty_percentage` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `late_penalty_fixed` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `renewal_terms` TEXT NULL,
    `notice_period_days` INTEGER NULL DEFAULT 60,
    `maintenance_responsibility` TEXT NULL DEFAULT 'Landlord',
    `utility_responsibility` TEXT NULL DEFAULT 'Tenant',
    `parking_details` TEXT NULL,
    `special_conditions` TEXT NULL,
    `number_of_pdc` INTEGER NULL DEFAULT 0,
    `tenant_signed_doc_url` TEXT NULL,
    `landlord_signed_doc_url` TEXT NULL,
    `tenant_signature_date` DATE NULL,
    `landlord_signature_date` DATE NULL,
    `signed_by_receiver` TEXT NULL,
    `key_handover_date` DATE NULL,
    `previous_lease_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `deleted_at` DATETIME(6) NULL,
    `check_in_report_id` VARCHAR(36) NULL,
    `check_out_report_id` VARCHAR(36) NULL,
    `collection_status` VARCHAR(32) NULL,

    UNIQUE INDEX `leases_lease_number_key`(`lease_number`),
    INDEX `leases_check_in_report_id_fkey`(`check_in_report_id`),
    INDEX `leases_check_out_report_id_fkey`(`check_out_report_id`),
    INDEX `leases_created_by_fkey`(`created_by`),
    INDEX `leases_customer_id_fkey`(`customer_id`),
    INDEX `leases_previous_lease_id_fkey`(`previous_lease_id`),
    INDEX `leases_property_id_fkey`(`property_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_usage` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `ticket_id` VARCHAR(36) NULL,
    `part_id` VARCHAR(36) NULL,
    `quantity` INTEGER NOT NULL,
    `cost` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `material_usage_part_id_fkey`(`part_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modules` (
    `id` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_asset_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_asset_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_asset_conditions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_asset_conditions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_asset_ownership_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_asset_ownership_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_asset_statuses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_asset_statuses_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_asset_subcategories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `category_id` INTEGER NULL,

    INDEX `mst_asset_subcategories_category_id_fkey`(`category_id`),
    UNIQUE INDEX `mst_asset_subcategories_name_category_id_key`(`name`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_departments_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_designations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_designations_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_employee_statuses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_employee_statuses_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_employment_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_employment_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_facilities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `paid` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `mst_facilities_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_furnishing` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_genders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,

    UNIQUE INDEX `mst_genders_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_lease_statuses` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_maintenance_responsibilities` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_ownership_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_payment_modes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `mst_payment_modes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_property_categories` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_property_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_property_codes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_property_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_rent_frequencies` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_security_deposit_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_ticket_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `sla_hours` INTEGER NOT NULL DEFAULT 24,
    `priority` TEXT NOT NULL DEFAULT 'medium',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `mst_ticket_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_unit_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NOT NULL,
    `property_code_id` INTEGER NULL,

    INDEX `mst_unit_codes_property_code_id_fkey`(`property_code_id`),
    UNIQUE INDEX `mst_unit_codes_code_property_code_id_key`(`code`, `property_code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_unit_usages` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_vat_treatments` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_view_types` (
    `id` VARCHAR(255) NOT NULL,
    `label` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mst_work_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `mst_work_locations_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdcs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `sl_no` INTEGER NULL,
    `status_pdc` TEXT NULL DEFAULT 'In Hand',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_subscription_plans` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `plan_code` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `price_monthly_qar` DECIMAL(18, 4) NULL,
    `price_annual_qar` DECIMAL(18, 4) NULL,
    `currency` VARCHAR(255) NOT NULL DEFAULT 'QAR',
    `max_properties` INTEGER NOT NULL DEFAULT 30,
    `max_units` INTEGER NOT NULL DEFAULT 500,
    `max_staff_users` INTEGER NOT NULL DEFAULT 20,
    `max_storage_gb` INTEGER NOT NULL DEFAULT 50,
    `enabled_modules` LONGTEXT NULL DEFAULT '["Property CRUD"]',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `platform_subscription_plans_plan_code_key`(`plan_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pricing_rules` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NULL,
    `rule_type` TEXT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `adjustment_type` TEXT NOT NULL DEFAULT 'percentage',
    `value` DECIMAL(18, 4) NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `pricing_rules_unit_id_fkey`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_customs_clearances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `proc_customs_clearances_shipment_id_key`(`shipment_id`),
    INDEX `idx_proc_customs_shipment`(`shipment_id`),
    INDEX `proc_customs_cha_fk`(`cha_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_document_sequences` (
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `document_type` VARCHAR(255) NOT NULL,
    `prefix` VARCHAR(255) NOT NULL,
    `current_number` BIGINT NOT NULL DEFAULT 0,
    `padding_length` INTEGER NOT NULL DEFAULT 6,
    `fiscal_year` INTEGER NOT NULL,

    PRIMARY KEY (`document_type`, `fiscal_year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_gate_inwards` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `gate_inward_number` VARCHAR(255) NOT NULL,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `shipment_id` VARCHAR(36) NULL,
    `inward_date` DATE NOT NULL DEFAULT (curdate()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `proc_gate_inwards_gate_inward_number_key`(`gate_inward_number`),
    INDEX `idx_proc_gate_po`(`purchase_order_id`),
    INDEX `idx_proc_gate_shipment`(`shipment_id`),
    INDEX `proc_gate_received_by_fk`(`received_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_goods_receipts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `grn_number` VARCHAR(255) NOT NULL,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `gate_inward_id` VARCHAR(36) NULL,
    `shipment_id` VARCHAR(36) NULL,
    `vendor_id` INTEGER NOT NULL,
    `grn_date` DATE NOT NULL DEFAULT (curdate()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(6) NULL,

    UNIQUE INDEX `proc_goods_receipts_grn_number_key`(`grn_number`),
    INDEX `idx_proc_grn_po`(`purchase_order_id`),
    INDEX `idx_proc_grn_status`(`status`),
    INDEX `idx_proc_grn_vendor`(`vendor_id`),
    INDEX `proc_grn_approved_by_fk`(`approved_by`),
    INDEX `proc_grn_gate_fk`(`gate_inward_id`),
    INDEX `proc_grn_inspected_by_fk`(`inspected_by`),
    INDEX `proc_grn_received_by_fk`(`received_by`),
    INDEX `proc_grn_shipment_fk`(`shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_grn_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `goods_receipt_id` VARCHAR(36) NOT NULL,
    `purchase_order_line_id` VARCHAR(36) NOT NULL,
    `line_no` INTEGER NOT NULL,
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_proc_grn_lines_grn`(`goods_receipt_id`),
    INDEX `idx_proc_grn_lines_po_line`(`purchase_order_line_id`),
    INDEX `proc_grn_line_property_fk`(`property_id`),
    INDEX `proc_grn_line_unit_fk`(`unit_id`),
    UNIQUE INDEX `proc_grn_line_unique_no`(`goods_receipt_id`, `line_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_imports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `proc_imports_import_number_key`(`import_number`),
    INDEX `idx_proc_imports_shipment`(`shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_logistics_partners` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_proc_logistics_partner_code`(`partner_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_negotiations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `vendor_quote_id` VARCHAR(36) NOT NULL,
    `round_no` INTEGER NOT NULL,
    `negotiation_date` DATE NOT NULL DEFAULT (curdate()),
    `vendor_amount` DECIMAL(18, 4) NULL,
    `counter_amount` DECIMAL(18, 4) NULL,
    `payment_terms` TEXT NULL,
    `delivery_terms` TEXT NULL,
    `outcome` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
    `negotiated_by` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `fk_proc_negotiation_employee`(`negotiated_by`),
    INDEX `idx_proc_negotiation_quote`(`vendor_quote_id`),
    UNIQUE INDEX `ux_proc_negotiation_round`(`vendor_quote_id`, `round_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_purchase_order_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `line_no` INTEGER NOT NULL,
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_proc_po_lines_po`(`purchase_order_id`),
    INDEX `idx_proc_po_lines_pr`(`source_pr_line_id`),
    INDEX `idx_proc_po_lines_quote`(`source_quote_line_id`),
    INDEX `idx_proc_po_lines_rfx`(`source_rfx_line_id`),
    INDEX `proc_po_line_property_fk`(`property_id`),
    INDEX `proc_po_line_unit_fk`(`unit_id`),
    UNIQUE INDEX `proc_po_line_unique_no`(`purchase_order_id`, `line_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_purchase_orders` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `doc_number` VARCHAR(255) NOT NULL,
    `po_date` DATE NOT NULL DEFAULT (curdate()),
    `vendor_id` INTEGER NOT NULL,
    `purchase_request_id` VARCHAR(36) NULL,
    `vendor_quote_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `cost_center_id` INTEGER NULL,
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `proc_purchase_orders_doc_number_key`(`doc_number`),
    INDEX `idx_proc_po_cost_center`(`cost_center_id`),
    INDEX `idx_proc_po_date`(`po_date`),
    INDEX `idx_proc_po_posting_status`(`posting_status`),
    INDEX `idx_proc_po_pr`(`purchase_request_id`),
    INDEX `idx_proc_po_property`(`property_id`),
    INDEX `idx_proc_po_quote`(`vendor_quote_id`),
    INDEX `idx_proc_po_status`(`status`),
    INDEX `idx_proc_po_unit`(`unit_id`),
    INDEX `idx_proc_po_vendor`(`vendor_id`),
    INDEX `proc_po_approved_by_fk`(`approved_by`),
    INDEX `proc_po_created_by_fk`(`created_by`),
    INDEX `proc_po_department_fk`(`department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_purchase_request_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `purchase_request_id` VARCHAR(36) NOT NULL,
    `line_no` INTEGER NOT NULL,
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `fk_proc_pr_line_property`(`property_id`),
    INDEX `fk_proc_pr_line_unit`(`unit_id`),
    UNIQUE INDEX `ux_proc_pr_line`(`purchase_request_id`, `line_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_purchase_requests` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `doc_number` VARCHAR(255) NOT NULL,
    `request_date` DATE NOT NULL DEFAULT (curdate()),
    `requester_id` VARCHAR(36) NULL,
    `department_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `cost_center_id` INTEGER NULL,
    `required_date` DATE NULL,
    `priority` TEXT NULL DEFAULT 'NORMAL',
    `purpose` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `posting_status` ENUM('UNPOSTED', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'UNPOSTED',
    `accounting_event_id` VARCHAR(36) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_proc_purchase_request_doc`(`doc_number`),
    INDEX `fk_proc_pr_cost_center`(`cost_center_id`),
    INDEX `fk_proc_pr_unit`(`unit_id`),
    INDEX `idx_proc_pr_department`(`department_id`),
    INDEX `idx_proc_pr_property`(`property_id`),
    INDEX `idx_proc_pr_requester`(`requester_id`),
    INDEX `idx_proc_pr_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_rfx` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `doc_number` VARCHAR(255) NOT NULL,
    `rfx_type` ENUM('RFI', 'RFQ', 'RFP') NOT NULL,
    `purchase_request_id` VARCHAR(36) NULL,
    `issue_date` DATE NOT NULL DEFAULT (curdate()),
    `submission_deadline` DATE NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `property_id` VARCHAR(36) NULL,
    `cost_center_id` INTEGER NULL,
    `total_estimated_amount` DECIMAL(18, 4) NULL,
    `created_by` VARCHAR(36) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_proc_rfx_doc`(`doc_number`),
    INDEX `fk_proc_rfx_cost_center`(`cost_center_id`),
    INDEX `fk_proc_rfx_created_by`(`created_by`),
    INDEX `fk_proc_rfx_pr`(`purchase_request_id`),
    INDEX `fk_proc_rfx_property`(`property_id`),
    INDEX `idx_proc_rfx_status`(`status`),
    INDEX `idx_proc_rfx_type`(`rfx_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_rfx_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `rfx_id` VARCHAR(36) NOT NULL,
    `line_no` INTEGER NOT NULL,
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_proc_rfx_line`(`rfx_id`, `line_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_rfx_vendors` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `rfx_id` VARCHAR(36) NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `invited_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `response_received` BOOLEAN NOT NULL DEFAULT false,
    `response_date` DATETIME(6) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_proc_rfx_vendor_vendor`(`vendor_id`),
    UNIQUE INDEX `ux_proc_rfx_vendor`(`rfx_id`, `vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_shipments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `shipment_number` VARCHAR(255) NOT NULL,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `vendor_id` INTEGER NOT NULL,
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `proc_shipments_shipment_number_key`(`shipment_number`),
    INDEX `idx_proc_shipments_po`(`purchase_order_id`),
    INDEX `idx_proc_shipments_status`(`status`),
    INDEX `idx_proc_shipments_vendor`(`vendor_id`),
    INDEX `proc_shipment_cha_fk`(`cha_id`),
    INDEX `proc_shipment_created_by_fk`(`created_by`),
    INDEX `proc_shipment_forwarder_fk`(`forwarder_id`),
    INDEX `proc_shipment_transporter_fk`(`transporter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_transports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `proc_transports_transport_number_key`(`transport_number`),
    INDEX `idx_proc_transports_shipment`(`shipment_id`),
    INDEX `proc_transport_partner_fk`(`transporter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_vendor_quote_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `vendor_quote_id` VARCHAR(36) NOT NULL,
    `line_no` INTEGER NOT NULL,
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
    `delivery_days` INTEGER NULL,
    `expense_account_code` TEXT NULL,
    `asset_category` TEXT NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `fk_proc_quote_line_rfx`(`rfx_line_id`),
    UNIQUE INDEX `ux_proc_quote_line`(`vendor_quote_id`, `line_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_vendor_quotes` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `quote_number` VARCHAR(255) NOT NULL,
    `rfx_id` VARCHAR(36) NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `quote_date` DATE NOT NULL DEFAULT (curdate()),
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
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ux_proc_vendor_quote_number`(`quote_number`),
    INDEX `idx_proc_quote_rfx`(`rfx_id`),
    INDEX `idx_proc_quote_status`(`status`),
    INDEX `idx_proc_quote_vendor`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `id` VARCHAR(36) NOT NULL,
    `role` VARCHAR(255) NULL DEFAULT 'GUEST',
    `full_name` TEXT NOT NULL,
    `avatar_url` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `properties` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `host_id` VARCHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `property_type` TEXT NOT NULL,
    `address` TEXT NOT NULL,
    `city` VARCHAR(255) NOT NULL,
    `country` VARCHAR(255) NOT NULL,
    `location` point NULL,
    `max_guests` INTEGER NOT NULL DEFAULT 1,
    `bedrooms` INTEGER NOT NULL DEFAULT 1,
    `beds` INTEGER NOT NULL DEFAULT 1,
    `bathrooms` DECIMAL(18, 4) NOT NULL DEFAULT 1.0000,
    `base_price_per_night` DECIMAL(18, 4) NOT NULL,
    `cleaning_fee` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
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
    `no_of_floors` INTEGER NULL,
    `no_of_units` INTEGER NULL,
    `total_built_up_area_sqm` DECIMAL(18, 4) NULL,
    `common_area_sqm` DECIMAL(18, 4) NULL,
    `parking_count` INTEGER NULL,
    `no_of_elevators` INTEGER NULL,
    `completion_date` DATE NULL,
    `handover_date` DATE NULL,
    `documents_received` BOOLEAN NULL DEFAULT false,
    `remarks` TEXT NULL,
    `year_built` INTEGER NULL,
    `total_floors` INTEGER NULL,
    `total_units` INTEGER NULL,
    `property_status` TEXT NULL DEFAULT 'Active',
    `contact_person` TEXT NULL,
    `mobile_number` TEXT NULL,
    `email` VARCHAR(255) NULL,
    `alternate_contact` TEXT NULL,
    `postal_code` VARCHAR(255) NULL,
    `landmark` TEXT NULL,

    INDEX `properties_host_id_fkey`(`host_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_amenities` (
    `property_id` VARCHAR(36) NOT NULL,
    `amenity_id` VARCHAR(255) NOT NULL,

    INDEX `property_amenities_amenity_id_fkey`(`amenity_id`),
    PRIMARY KEY (`property_id`, `amenity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_coa_mapping` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_property_coa_mapping`(`property_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_images` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `property_id` VARCHAR(36) NULL,
    `image_url` TEXT NOT NULL,
    `is_primary` BOOLEAN NULL DEFAULT false,
    `display_order` INTEGER NULL DEFAULT 0,
    `category` VARCHAR(255) NULL DEFAULT 'Exterior',

    INDEX `property_images_property_id_fkey`(`property_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NULL,
    `prospect_name` TEXT NOT NULL,
    `prospect_contact` TEXT NOT NULL,
    `prospect_id_type` TEXT NULL,
    `prospect_id_number` TEXT NULL,
    `marketing_agent_id` VARCHAR(36) NULL,
    `proposed_lease_period` INTEGER NULL,
    `expected_start_date` DATE NULL,
    `proposed_rental_amount` DECIMAL(18, 4) NULL,
    `reservation_validity` DATETIME(6) NULL,
    `special_conditions` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `reservations_marketing_agent_id_fkey`(`marketing_agent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `booking_id` VARCHAR(36) NULL,
    `author_id` VARCHAR(36) NULL,
    `target_id` VARCHAR(36) NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `reviews_author_id_fkey`(`author_id`),
    INDEX `reviews_booking_id_fkey`(`booking_id`),
    INDEX `reviews_target_id_fkey`(`target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `role_name` VARCHAR(255) NOT NULL,
    `module_id` VARCHAR(255) NULL,
    `has_access` BOOLEAN NULL DEFAULT false,
    `tenant_id` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `role_permissions_module_id_fkey`(`module_id`),
    UNIQUE INDEX `role_permissions_role_name_module_id_tenant_id_key`(`role_name`, `module_id`, `tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_audit_logs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `event_type` VARCHAR(255) NOT NULL,
    `severity` TEXT NOT NULL DEFAULT 'info',
    `user_id` VARCHAR(36) NULL,
    `user_role` TEXT NULL,
    `resource` TEXT NULL,
    `action` VARCHAR(255) NULL,
    `details` LONGTEXT NULL,
    `ip_address` TEXT NULL,
    `user_agent` TEXT NULL,
    `timestamp` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_security_audit_event_type`(`event_type`),
    INDEX `idx_security_audit_timestamp`(`timestamp`),
    INDEX `idx_security_audit_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configurations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `config_key` VARCHAR(255) NOT NULL,
    `config_value` LONGTEXT NOT NULL DEFAULT '{}',
    `category` VARCHAR(255) NOT NULL DEFAULT 'general',
    `description` TEXT NULL,
    `is_encrypted` BOOLEAN NOT NULL DEFAULT false,
    `updated_by` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `system_configurations_config_key_key`(`config_key`),
    INDEX `idx_system_configurations_cat`(`category`),
    INDEX `idx_system_configurations_key`(`config_key`),
    INDEX `system_configurations_updated_by_fkey`(`updated_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_notifications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(255) NOT NULL DEFAULT 'info',
    `target_role` VARCHAR(255) NULL DEFAULT 'ALL',
    `target_user` VARCHAR(36) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `action_url` TEXT NULL,
    `metadata` LONGTEXT NULL DEFAULT '{}',
    `expires_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `schedule_type` TEXT NOT NULL DEFAULT 'instant',
    `scheduled_for` DATETIME(6) NULL,
    `recurring_cron` TEXT NULL,
    `engagement_count` INTEGER NOT NULL DEFAULT 0,
    `click_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(255) NOT NULL DEFAULT 'sent',

    INDEX `idx_sys_notif_created`(`created_at`),
    INDEX `idx_sys_notif_target`(`target_role`, `target_user`, `is_read`),
    INDEX `system_notifications_target_user_fkey`(`target_user`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_organisations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `max_properties` INTEGER NOT NULL DEFAULT 10,
    `max_units` INTEGER NOT NULL DEFAULT 100,
    `max_staff_users` INTEGER NOT NULL DEFAULT 5,
    `max_storage_gb` INTEGER NOT NULL DEFAULT 10,
    `enabled_modules` LONGTEXT NULL DEFAULT '["Property CRUD"]',
    `custom_subdomain` TEXT NULL,
    `brand_primary_color` TEXT NULL DEFAULT '#0f766e',
    `onboarded_by` VARCHAR(36) NULL,
    `trial_ends_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `subscription_amount` DECIMAL(18, 4) NULL,
    `currency` VARCHAR(255) NULL DEFAULT 'QAR',
    `payment_method` TEXT NULL DEFAULT 'credit_card',
    `payment_status` TEXT NULL DEFAULT 'Paid',
    `transaction_ref` TEXT NULL,
    `bank_name` TEXT NULL,
    `cheque_number` TEXT NULL,
    `next_billing_date` DATE NULL DEFAULT (curdate()),
    `auto_renew` BOOLEAN NULL DEFAULT true,
    `discount_code` TEXT NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `total_paid` DECIMAL(18, 4) NULL,

    UNIQUE INDEX `tenant_organisations_tenant_key_key`(`tenant_key`),
    INDEX `idx_tenant_orgs_admin_email`(`admin_email`),
    INDEX `idx_tenant_orgs_key`(`tenant_key`),
    INDEX `idx_tenant_orgs_status`(`status`),
    INDEX `tenant_organisations_admin_user_id_fkey`(`admin_user_id`),
    INDEX `tenant_organisations_onboarded_by_fkey`(`onboarded_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_subscription_invoices` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `issue_date` DATE NOT NULL DEFAULT (curdate()),
    `due_date` DATE NOT NULL DEFAULT (curdate()),
    `payment_date` DATETIME(6) NULL,
    `payment_method` TEXT NOT NULL DEFAULT 'credit_card',
    `transaction_ref` TEXT NULL,
    `invoice_pdf_url` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `tenant_subscription_invoices_invoice_number_key`(`invoice_number`),
    INDEX `idx_sub_inv_status`(`status`),
    INDEX `idx_sub_inv_tenant_id`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_amenities` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NULL,
    `room_id` VARCHAR(36) NULL,
    `amenity_id` TEXT NOT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `unit_amenities_room_id_fkey`(`room_id`),
    INDEX `unit_amenities_unit_id_fkey`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_coa_mapping` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
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
    `effective_from` DATE NULL DEFAULT (curdate()),
    `effective_to` DATE NULL,
    `status` VARCHAR(255) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_unit_coa_mapping`(`unit_id`),
    INDEX `unit_coa_mapping_deposit_sl_id_fkey`(`deposit_sl_id`),
    INDEX `unit_coa_mapping_pdc_sl_id_fkey`(`pdc_sl_id`),
    INDEX `unit_coa_mapping_property_id_fkey`(`property_id`),
    INDEX `unit_coa_mapping_receivable_sl_id_fkey`(`receivable_sl_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_coas` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `property_name` TEXT NULL,
    `unit_code` VARCHAR(255) NOT NULL,
    `pdc_in_hand_code` TEXT NULL,
    `pdc_in_hand_name` TEXT NULL,
    `deposit_code` TEXT NULL,
    `deposit_name` TEXT NULL,
    `receivables_code` TEXT NULL,
    `receivables_name` TEXT NULL,
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `unit_coas_unit_code_key`(`unit_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_rooms` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NULL,
    `room_type` TEXT NOT NULL,
    `name` VARCHAR(255) NULL,
    `length` DECIMAL(18, 4) NULL,
    `width` DECIMAL(18, 4) NULL,
    `area` DECIMAL(18, 4) NULL,
    `capacity` INTEGER NULL,
    `details` LONGTEXT NULL DEFAULT '{}',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `unit_rooms_unit_id_fkey`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `property_id` VARCHAR(36) NULL,
    `unit_ref` TEXT NOT NULL,
    `room_type` TEXT NULL,
    `bedrooms` INTEGER NULL,
    `bathrooms` DECIMAL(18, 4) NULL,
    `area` TEXT NULL,
    `price` DECIMAL(18, 4) NULL,
    `status` VARCHAR(255) NULL DEFAULT 'AVAILABLE',
    `municipality_details` LONGTEXT NULL DEFAULT '{}',
    `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
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
    `documents_received` BOOLEAN NULL DEFAULT false,
    `remarks` TEXT NULL,
    `unit_number` TEXT NULL,
    `floor_number` TEXT NULL,
    `unit_type` TEXT NULL,
    `max_adults` INTEGER NULL DEFAULT 2,
    `max_children` INTEGER NULL DEFAULT 0,
    `total_occupancy` INTEGER NULL DEFAULT 2,
    `base_price_per_night` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `weekend_price` DECIMAL(18, 4) NULL,
    `holiday_price` DECIMAL(18, 4) NULL,
    `cleaning_fee` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `security_deposit` DECIMAL(18, 4) NULL DEFAULT 0.0000,
    `pdc_in_hand_code` TEXT NULL,
    `pdc_in_hand_name` TEXT NULL,
    `deposit_code` TEXT NULL,
    `deposit_name` TEXT NULL,
    `receivables_code` TEXT NULL,
    `receivables_name` TEXT NULL,
    `market_rent` DECIMAL(18, 4) NULL,

    UNIQUE INDEX `uq_units_property_unit`(`property_id`, `unit_number`(100)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NULL,
    `role` VARCHAR(50) NULL DEFAULT 'USER',
    `raw_user_meta_data` LONGTEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_users_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_tickets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `tenant_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_ref` VARCHAR(255) NULL,
    `title` TEXT NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(255) NOT NULL DEFAULT 'General',
    `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(30) NOT NULL DEFAULT 'new',
    `assignee` VARCHAR(255) NULL,
    `host_id` VARCHAR(36) NULL,
    `reported_by` VARCHAR(255) NULL,
    `resolved_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_maintenance_tickets_tenant`(`tenant_id`),
    INDEX `idx_maintenance_tickets_property`(`property_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_requests` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `target_record_id` VARCHAR(36) NULL,
    `target_table` VARCHAR(255) NULL,
    `requested_by` VARCHAR(255) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_steps` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `request_id` VARCHAR(36) NULL,
    `step_order` INTEGER NULL,
    `approver_id` VARCHAR(255) NULL,
    `status` VARCHAR(20) NULL,
    `decision_at` DATETIME(6) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ar_ledgers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `customer_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `reference` VARCHAR(255) NULL,
    `type` VARCHAR(30) NULL,
    `date` DATE NULL,
    `amount` DECIMAL(18, 4) NULL,
    `balance` DECIMAL(18, 4) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_assignments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `asset_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `assigned_date` DATE NULL,
    `return_date` DATE NULL,
    `condition_on_handover` TEXT NULL,
    `condition_on_return` TEXT NULL,
    `handover_notes` TEXT NULL,
    `return_notes` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'assigned',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_transaction_receipts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `receipt_no` VARCHAR(100) NULL,
    `acknowledgement_no` VARCHAR(100) NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `voucher_id` VARCHAR(36) NULL,
    `receipt_date` DATE NULL,
    `receipt_category` VARCHAR(100) NULL,
    `direction` VARCHAR(10) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `currency_code` VARCHAR(10) NULL,
    `source_type` VARCHAR(100) NULL,
    `source_id` VARCHAR(255) NULL,
    `reference_no` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `unit_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `payment_method` VARCHAR(100) NULL,
    `instrument_reference` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    `issued_at` DATETIME(6) NOT NULL,
    `receipt_payload` LONGTEXT NULL,
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_payroll_overrides` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `payroll_cycle_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `basic_pay` DECIMAL(18, 4) NULL,
    `allowances` DECIMAL(18, 4) NULL,
    `incentives` DECIMAL(18, 4) NULL,
    `other_deductions` DECIMAL(18, 4) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_hrms_payroll_overrides`(`payroll_cycle_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `je_no` VARCHAR(100) NULL,
    `posting_date` DATE NULL,
    `period` VARCHAR(7) NULL,
    `source_module` VARCHAR(100) NULL,
    `source_id` VARCHAR(255) NULL,
    `narration` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `tenant_id` VARCHAR(36) NULL,
    `property_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lease_reservations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `unit_id` VARCHAR(36) NULL,
    `prospect_name` VARCHAR(255) NULL,
    `prospect_contact` VARCHAR(255) NULL,
    `prospect_id_type` VARCHAR(100) NULL,
    `prospect_id_number` VARCHAR(100) NULL,
    `marketing_agent_id` VARCHAR(36) NULL,
    `proposed_lease_period` INTEGER NULL,
    `expected_start_date` DATE NULL,
    `proposed_rental_amount` DECIMAL(18, 4) NULL,
    `reservation_validity` VARCHAR(100) NULL,
    `valid_until` DATE NULL,
    `special_conditions` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `tenant_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `payment_method` VARCHAR(50) NULL,
    `payment_status` VARCHAR(30) NULL,
    `payment_date` DATE NULL,
    `reference_no` VARCHAR(100) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pms_app_state` (
    `id` VARCHAR(255) NOT NULL,
    `data` LONGTEXT NULL,
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_ap_invoices` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `invoice_number` VARCHAR(100) NULL,
    `vendor_id` VARCHAR(64) NULL,
    `po_number` VARCHAR(100) NULL,
    `grn_number` VARCHAR(100) NULL,
    `invoice_date` DATE NULL,
    `due_date` DATE NULL,
    `amount` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_landed_costs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `doc_number` VARCHAR(100) NULL,
    `purchase_order_id` VARCHAR(36) NULL,
    `goods_receipt_id` VARCHAR(36) NULL,
    `cost_type` VARCHAR(100) NULL,
    `vendor_id` VARCHAR(64) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `posting_status` VARCHAR(30) NOT NULL DEFAULT 'UNPOSTED',
    `allocation_basis` VARCHAR(100) NULL,
    `remarks` TEXT NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_payable_invoice_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `payable_invoice_id` VARCHAR(36) NULL,
    `line_no` INTEGER NULL,
    `source_line_id` VARCHAR(36) NULL,
    `description` TEXT NULL,
    `item_type` VARCHAR(100) NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `unit_rate` DECIMAL(18, 4) NULL,
    `line_total` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `expense_account_code` VARCHAR(100) NULL,
    `asset_category` VARCHAR(100) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_payable_invoices` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `doc_number` VARCHAR(100) NULL,
    `vendor_id` VARCHAR(64) NULL,
    `purchase_order_id` VARCHAR(36) NULL,
    `goods_receipt_id` VARCHAR(36) NULL,
    `invoice_date` DATE NULL,
    `due_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `posting_status` VARCHAR(30) NOT NULL DEFAULT 'UNPOSTED',
    `invoice_type` VARCHAR(30) NULL,
    `subtotal` DECIMAL(18, 4) NULL,
    `tax_amount` DECIMAL(18, 4) NULL,
    `discount_amount` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `paid_amount` DECIMAL(18, 4) NULL,
    `outstanding_amount` DECIMAL(18, 4) NULL,
    `payment_status` VARCHAR(30) NULL,
    `remarks` TEXT NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_po_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `purchase_order_id` VARCHAR(36) NULL,
    `line_no` INTEGER NULL,
    `description` TEXT NULL,
    `item_type` VARCHAR(100) NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `unit_rate` DECIMAL(18, 4) NULL,
    `line_total` DECIMAL(18, 4) NULL,
    `expense_account_code` VARCHAR(100) NULL,
    `asset_category` VARCHAR(100) NULL,
    `uom` VARCHAR(30) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_purchase_lines` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `purchase_id` VARCHAR(36) NULL,
    `line_no` INTEGER NULL,
    `grn_line_id` VARCHAR(36) NULL,
    `description` TEXT NULL,
    `item_type` VARCHAR(100) NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `unit_rate` DECIMAL(18, 4) NULL,
    `base_amount` DECIMAL(18, 4) NULL,
    `landed_cost_amount` DECIMAL(18, 4) NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `asset_category` VARCHAR(100) NULL,
    `expense_account_code` VARCHAR(100) NULL,
    `account_code` VARCHAR(100) NULL,
    `account_name` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_purchases` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `doc_number` VARCHAR(100) NULL,
    `purchase_order_id` VARCHAR(36) NULL,
    `goods_receipt_id` VARCHAR(36) NULL,
    `payable_invoice_id` VARCHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `posting_status` VARCHAR(30) NOT NULL DEFAULT 'UNPOSTED',
    `property_id` VARCHAR(36) NULL,
    `cost_center_id` VARCHAR(36) NULL,
    `purchase_date` DATE NULL,
    `total_amount` DECIMAL(18, 4) NULL,
    `capitalized_amount` DECIMAL(18, 4) NULL,
    `accounting_event_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_three_way_matches` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `payable_invoice_id` VARCHAR(36) NULL,
    `purchase_order_id` VARCHAR(36) NULL,
    `goods_receipt_id` VARCHAR(36) NULL,
    `match_status` VARCHAR(30) NULL,
    `quantity_variance` DECIMAL(18, 4) NULL,
    `amount_variance` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proc_trade_categories` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(255) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_approval_delegations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `policy_version_id` VARCHAR(36) NULL,
    `source_role` VARCHAR(100) NULL,
    `delegate_role` VARCHAR(100) NULL,
    `source_user_id` VARCHAR(255) NULL,
    `delegate_user_id` VARCHAR(255) NULL,
    `max_amount` DECIMAL(18, 4) NULL,
    `effective_from` DATETIME(6) NULL,
    `effective_to` DATETIME(6) NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_items` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `item_code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NULL,
    `category` VARCHAR(100) NULL,
    `item_type` VARCHAR(100) NULL,
    `budget_type` VARCHAR(100) NULL,
    `budget_head` VARCHAR(100) NULL,
    `unit_price` DECIMAL(18, 4) NULL,
    `unit_of_measure` VARCHAR(30) NULL,
    `reorder_level` DECIMAL(18, 4) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_procurement_items`(`item_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_policy_rules` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `policy_version_id` VARCHAR(36) NULL,
    `document_type` VARCHAR(30) NULL,
    `min_amount` DECIMAL(18, 4) NULL,
    `max_amount` DECIMAL(18, 4) NULL,
    `required_role` VARCHAR(100) NULL,
    `approval_sequence` INTEGER NULL,
    `sla_hours` INTEGER NULL,
    `escalation_role` VARCHAR(100) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_policy_versions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `policy_code` VARCHAR(100) NULL,
    `version_no` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `enforcement_mode` VARCHAR(30) NULL,
    `effective_from` DATETIME(6) NULL,
    `effective_to` DATETIME(6) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provisions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(255) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `period` VARCHAR(7) NULL,
    `gl_account_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `lease_id` VARCHAR(36) NULL,
    `receipt_no` VARCHAR(100) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rent_schedules` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `lease_id` VARCHAR(36) NULL,
    `due_date` DATE NULL,
    `amount` DECIMAL(18, 4) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revenue_recognition_logs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `closing_month` VARCHAR(7) NULL,
    `run_by` VARCHAR(255) NULL,
    `total_leases_processed` INTEGER NULL,
    `total_revenue_recognized` DECIMAL(18, 4) NULL,
    `journal_voucher_id` VARCHAR(36) NULL,
    `status` VARCHAR(30) NULL,
    `details` LONGTEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_bank_details` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `vendor_id` VARCHAR(64) NULL,
    `bank_name` VARCHAR(255) NULL,
    `account_name` VARCHAR(255) NULL,
    `account_number` VARCHAR(100) NULL,
    `iban` VARCHAR(100) NULL,
    `swift_code` VARCHAR(50) NULL,
    `currency` VARCHAR(10) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_contacts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `vendor_id` VARCHAR(64) NULL,
    `name` VARCHAR(255) NULL,
    `role` VARCHAR(100) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `is_primary` BOOLEAN NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_qualifications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `vendor_id` VARCHAR(64) NULL,
    `category` VARCHAR(100) NULL,
    `certification` VARCHAR(255) NULL,
    `expiry_date` DATE NULL,
    `status` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hrms_master_items` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `category` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(64) NULL,
    `description` TEXT NULL,
    `extra` LONGTEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_hrms_master_items_category`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_kv_store` (
    `tenant_id` VARCHAR(36) NOT NULL,
    `k` VARCHAR(255) NOT NULL,
    `v` LONGTEXT NOT NULL,
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`tenant_id`, `k`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_sequences` (
    `name` VARCHAR(64) NOT NULL,
    `current_value` BIGINT NOT NULL DEFAULT 0,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_ar_invoices` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `invoice_no` VARCHAR(100) NOT NULL,
    `tenant` VARCHAR(255) NULL,
    `property` VARCHAR(255) NULL,
    `unit` VARCHAR(100) NULL,
    `customer_id` VARCHAR(36) NULL,
    `lease_id` VARCHAR(36) NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NULL,
    `stream` VARCHAR(100) NULL,
    `account_code` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `paid_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Pending',
    `billing_period` VARCHAR(7) NULL,
    `notes` TEXT NULL,
    `voucher_number` VARCHAR(255) NULL,
    `receipt_voucher_number` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_fin_ar_invoices_no`(`invoice_no`),
    INDEX `idx_fin_ar_invoices_unit_period`(`unit`, `billing_period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_ap_invoices` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `invoice_no` VARCHAR(100) NOT NULL,
    `vendor` VARCHAR(255) NULL,
    `property` VARCHAR(255) NULL,
    `invoice_date` DATE NOT NULL,
    `voucher_date` DATE NULL,
    `due_date` DATE NULL,
    `account` VARCHAR(255) NULL,
    `account_code` VARCHAR(50) NOT NULL,
    `stream` VARCHAR(100) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `paid_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Unpaid',
    `lines_json` LONGTEXT NULL,
    `voucher_number` VARCHAR(255) NULL,
    `payment_voucher_number` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_fin_ap_invoices_no`(`invoice_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_legal_cases` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `legal_case_id` VARCHAR(100) NOT NULL,
    `tenant_name` VARCHAR(255) NULL,
    `property_name` VARCHAR(255) NULL,
    `unit_ref` VARCHAR(100) NULL,
    `original_amount` DECIMAL(18, 4) NOT NULL,
    `outstanding_balance` DECIMAL(18, 4) NOT NULL,
    `escalation_date` DATE NOT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Legal Notice Sent',
    `voucher_number` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_fin_legal_cases_no`(`legal_case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_payroll_runs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `payroll_run_id` VARCHAR(100) NOT NULL,
    `period` VARCHAR(50) NULL,
    `department` VARCHAR(255) NULL,
    `account_code` VARCHAR(50) NULL,
    `basic_salary` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `allowances` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `overtime` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `deductions` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `total_amount` DECIMAL(18, 4) NOT NULL,
    `bank_account` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Posted',
    `error_details` TEXT NULL,
    `voucher_number` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `uq_fin_payroll_runs_no`(`payroll_run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_bank_clearances` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `ref` VARCHAR(100) NOT NULL,
    `bank` VARCHAR(255) NULL,
    `type` VARCHAR(100) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `clearance_date` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Pending Clearance',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_bank_recon_records` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `account_number` VARCHAR(255) NOT NULL,
    `statement_date` DATE NOT NULL,
    `book_balance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `statement_balance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `difference` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Reconciled',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fin_recon_statements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `period` VARCHAR(50) NULL,
    `balance` VARCHAR(100) NULL,
    `auditor` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_bak_fin_legal_receivables` (
    `id` BIGINT NOT NULL DEFAULT 0,
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
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_bak_fin_pdc_register` (
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
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `lease_id` VARCHAR(36) NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_employee_id_fkey` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_property_id_fkey` FOREIGN KEY (`assigned_property_id`) REFERENCES `properties`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_unit_id_fkey` FOREIGN KEY (`assigned_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_guest_id_fkey` FOREIGN KEY (`guest_id`) REFERENCES `profiles`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_classes` ADD CONSTRAINT `coa_classes_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `coa_groups`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_classes` ADD CONSTRAINT `coa_classes_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `coa_classes`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `coa_groups`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_gl` ADD CONSTRAINT `coa_gl_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_groups` ADD CONSTRAINT `coa_groups_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `coa_classes`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_gl_id_fkey` FOREIGN KEY (`gl_id`) REFERENCES `coa_gl`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `coa_groups`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `coa_sl` ADD CONSTRAINT `coa_sl_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `coa_types`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `collection_receipts` ADD CONSTRAINT `collection_receipts_original_receipt_id_fkey` FOREIGN KEY (`original_receipt_id`) REFERENCES `collection_receipts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_business_unit_id_fkey` FOREIGN KEY (`business_unit_id`) REFERENCES `hrms_business_units`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `hrms_grades`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `hrms_branches`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_business_unit_id_fkey` FOREIGN KEY (`business_unit_id`) REFERENCES `hrms_business_units`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `hrms_grades`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_hr_manager_id_fkey` FOREIGN KEY (`hr_manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_sub_department_id_fkey` FOREIGN KEY (`sub_department_id`) REFERENCES `hrms_sub_departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `erp_chart_of_accounts` ADD CONSTRAINT `erp_coa_gl_code_fk` FOREIGN KEY (`gl_code`) REFERENCES `erp_chart_of_accounts`(`code`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `erp_journal_entries_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `erp_chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `erp_journal_entries_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `erp_vouchers`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `erp_journal_entries` ADD CONSTRAINT `fk_erp_journal_entries_accounting_event` FOREIGN KEY (`accounting_event_id`) REFERENCES `fin_accounting_events`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_accounting_event_lines` ADD CONSTRAINT `fk_fin_event_lines_account` FOREIGN KEY (`account_id`) REFERENCES `fin_coa_accounts`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_accounting_event_lines` ADD CONSTRAINT `fk_fin_event_lines_event` FOREIGN KEY (`event_id`) REFERENCES `fin_accounting_events`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_accounting_events` ADD CONSTRAINT `fk_fin_accounting_events_reversal` FOREIGN KEY (`reversal_of_event_id`) REFERENCES `fin_accounting_events`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_accounting_events` ADD CONSTRAINT `fk_fin_accounting_events_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `fin_vouchers`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_bank_accounts` ADD CONSTRAINT `fin_bank_accounts_bank_id_fkey` FOREIGN KEY (`bank_id`) REFERENCES `fin_banks`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_coa_accounts` ADD CONSTRAINT `fin_coa_accounts_parent_account_id_fkey` FOREIGN KEY (`parent_account_id`) REFERENCES `fin_coa_accounts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_coa_accounts` ADD CONSTRAINT `fk_fin_coa_accounts_parent` FOREIGN KEY (`parent_id`) REFERENCES `fin_coa_accounts`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_unit_sl_accounts` ADD CONSTRAINT `fin_unit_sl_accounts_coa_account_id_fkey` FOREIGN KEY (`coa_account_id`) REFERENCES `fin_coa_accounts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_voucher_lines` ADD CONSTRAINT `fk_fin_voucher_lines_account` FOREIGN KEY (`account_id`) REFERENCES `fin_coa_accounts`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_voucher_lines` ADD CONSTRAINT `fk_fin_voucher_lines_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `fin_vouchers`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fin_vouchers` ADD CONSTRAINT `fk_fin_vouchers_accounting_event` FOREIGN KEY (`accounting_event_id`) REFERENCES `fin_accounting_events`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_announcements` ADD CONSTRAINT `hrms_announcements_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_announcements` ADD CONSTRAINT `hrms_announcements_target_department_id_fkey` FOREIGN KEY (`target_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_asset_allocations` ADD CONSTRAINT `hrms_asset_allocations_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_asset_allocations` ADD CONSTRAINT `hrms_asset_allocations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_attendance_daily` ADD CONSTRAINT `hrms_attendance_daily_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_attendance_daily` ADD CONSTRAINT `hrms_attendance_daily_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `hrms_shifts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_attendance_raw_events` ADD CONSTRAINT `hrms_attendance_raw_events_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_attendance_regularizations` ADD CONSTRAINT `hrms_attendance_regularizations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_attendance_regularizations` ADD CONSTRAINT `hrms_attendance_regularizations_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_branches` ADD CONSTRAINT `hrms_branches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_business_units` ADD CONSTRAINT `hrms_business_units_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_appraisal_cycle_id_fkey` FOREIGN KEY (`appraisal_cycle_id`) REFERENCES `hrms_appraisal_cycles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_appraisals` ADD CONSTRAINT `hrms_employee_appraisals_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_documents` ADD CONSTRAINT `hrms_employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_fines` ADD CONSTRAINT `hrms_employee_fines_deducted_in_payroll_id_fkey` FOREIGN KEY (`deducted_in_payroll_id`) REFERENCES `hrms_payroll_cycles`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_fines` ADD CONSTRAINT `hrms_employee_fines_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_loans` ADD CONSTRAINT `hrms_employee_loans_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_salaries` ADD CONSTRAINT `hrms_employee_salaries_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_transfers` ADD CONSTRAINT `hrms_employee_transfers_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_employee_transfers` ADD CONSTRAINT `hrms_employee_transfers_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_entities` ADD CONSTRAINT `hrms_entities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_cleared_by_fkey` FOREIGN KEY (`cleared_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_exit_clearances` ADD CONSTRAINT `hrms_exit_clearances_resignation_id_fkey` FOREIGN KEY (`resignation_id`) REFERENCES `hrms_resignations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_expense_claims` ADD CONSTRAINT `hrms_expense_claims_expense_type_id_fkey` FOREIGN KEY (`expense_type_id`) REFERENCES `hrms_expense_types`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_fnf_settlements` ADD CONSTRAINT `hrms_fnf_settlements_resignation_id_fkey` FOREIGN KEY (`resignation_id`) REFERENCES `hrms_resignations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_helpdesk_tickets` ADD CONSTRAINT `hrms_helpdesk_tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_helpdesk_tickets` ADD CONSTRAINT `hrms_helpdesk_tickets_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_kpa_templates` ADD CONSTRAINT `hrms_kpa_templates_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_kpa_templates` ADD CONSTRAINT `hrms_kpa_templates_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `hrms_leave_types`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_applications` ADD CONSTRAINT `hrms_leave_applications_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_balances` ADD CONSTRAINT `hrms_leave_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_balances` ADD CONSTRAINT `hrms_leave_balances_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `hrms_leave_types`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_encashments` ADD CONSTRAINT `hrms_leave_encashments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_leave_encashments` ADD CONSTRAINT `hrms_leave_encashments_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `hrms_leave_types`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_overtime_requests` ADD CONSTRAINT `hrms_overtime_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_overtime_requests` ADD CONSTRAINT `hrms_overtime_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_payroll_cycles` ADD CONSTRAINT `hrms_payroll_cycles_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_payroll_cycles` ADD CONSTRAINT `hrms_payroll_cycles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_payroll_payslips` ADD CONSTRAINT `hrms_payroll_payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_payroll_payslips` ADD CONSTRAINT `hrms_payroll_payslips_payroll_cycle_id_fkey` FOREIGN KEY (`payroll_cycle_id`) REFERENCES `hrms_payroll_cycles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_resignations` ADD CONSTRAINT `hrms_resignations_accepted_by_fkey` FOREIGN KEY (`accepted_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_resignations` ADD CONSTRAINT `hrms_resignations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_shift_allocations` ADD CONSTRAINT `hrms_shift_allocations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_shift_allocations` ADD CONSTRAINT `hrms_shift_allocations_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `hrms_shifts`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_shifts` ADD CONSTRAINT `hrms_shifts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `hrms_companies`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hrms_sub_departments` ADD CONSTRAINT `hrms_sub_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inspection_reports` ADD CONSTRAINT `inspection_reports_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `key_handovers` ADD CONSTRAINT `key_handovers_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `key_handovers` ADD CONSTRAINT `key_handovers_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leases` ADD CONSTRAINT `leases_check_in_report_id_fkey` FOREIGN KEY (`check_in_report_id`) REFERENCES `inspection_reports`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leases` ADD CONSTRAINT `leases_check_out_report_id_fkey` FOREIGN KEY (`check_out_report_id`) REFERENCES `inspection_reports`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leases` ADD CONSTRAINT `leases_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leases` ADD CONSTRAINT `leases_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leases` ADD CONSTRAINT `leases_previous_lease_id_fkey` FOREIGN KEY (`previous_lease_id`) REFERENCES `leases`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `leases` ADD CONSTRAINT `leases_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `material_usage` ADD CONSTRAINT `material_usage_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `inventory_parts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `mst_asset_subcategories` ADD CONSTRAINT `mst_asset_subcategories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `mst_asset_categories`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `mst_unit_codes` ADD CONSTRAINT `mst_unit_codes_property_code_id_fkey` FOREIGN KEY (`property_code_id`) REFERENCES `mst_property_codes`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_customs_clearances` ADD CONSTRAINT `proc_customs_cha_fk` FOREIGN KEY (`cha_id`) REFERENCES `proc_logistics_partners`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_customs_clearances` ADD CONSTRAINT `proc_customs_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_received_by_fk` FOREIGN KEY (`received_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_gate_inwards` ADD CONSTRAINT `proc_gate_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_approved_by_fk` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_gate_fk` FOREIGN KEY (`gate_inward_id`) REFERENCES `proc_gate_inwards`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_inspected_by_fk` FOREIGN KEY (`inspected_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_received_by_fk` FOREIGN KEY (`received_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_goods_receipts` ADD CONSTRAINT `proc_grn_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_grn_fk` FOREIGN KEY (`goods_receipt_id`) REFERENCES `proc_goods_receipts`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_po_line_fk` FOREIGN KEY (`purchase_order_line_id`) REFERENCES `proc_purchase_order_lines`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_grn_lines` ADD CONSTRAINT `proc_grn_line_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_imports` ADD CONSTRAINT `proc_import_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_negotiations` ADD CONSTRAINT `fk_proc_negotiation_employee` FOREIGN KEY (`negotiated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_negotiations` ADD CONSTRAINT `fk_proc_negotiation_quote` FOREIGN KEY (`vendor_quote_id`) REFERENCES `proc_vendor_quotes`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_pr_fk` FOREIGN KEY (`source_pr_line_id`) REFERENCES `proc_purchase_request_lines`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_quote_fk` FOREIGN KEY (`source_quote_line_id`) REFERENCES `proc_vendor_quote_lines`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_rfx_fk` FOREIGN KEY (`source_rfx_line_id`) REFERENCES `proc_rfx_lines`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_order_lines` ADD CONSTRAINT `proc_po_line_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_approved_by_fk` FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_cost_center_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `fin_cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_department_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_pr_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `proc_purchase_requests`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_quote_fk` FOREIGN KEY (`vendor_quote_id`) REFERENCES `proc_vendor_quotes`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_orders` ADD CONSTRAINT `proc_po_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `fk_proc_pr_line_header` FOREIGN KEY (`purchase_request_id`) REFERENCES `proc_purchase_requests`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `fk_proc_pr_line_property` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_request_lines` ADD CONSTRAINT `fk_proc_pr_line_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_cost_center` FOREIGN KEY (`cost_center_id`) REFERENCES `fin_cost_centers`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_property` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_requester` FOREIGN KEY (`requester_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_purchase_requests` ADD CONSTRAINT `fk_proc_pr_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_cost_center` FOREIGN KEY (`cost_center_id`) REFERENCES `fin_cost_centers`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_pr` FOREIGN KEY (`purchase_request_id`) REFERENCES `proc_purchase_requests`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx` ADD CONSTRAINT `fk_proc_rfx_property` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx_lines` ADD CONSTRAINT `fk_proc_rfx_line_header` FOREIGN KEY (`rfx_id`) REFERENCES `proc_rfx`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx_vendors` ADD CONSTRAINT `fk_proc_rfx_vendor_rfx` FOREIGN KEY (`rfx_id`) REFERENCES `proc_rfx`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_rfx_vendors` ADD CONSTRAINT `fk_proc_rfx_vendor_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_cha_fk` FOREIGN KEY (`cha_id`) REFERENCES `proc_logistics_partners`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_forwarder_fk` FOREIGN KEY (`forwarder_id`) REFERENCES `proc_logistics_partners`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_po_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `proc_purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_transporter_fk` FOREIGN KEY (`transporter_id`) REFERENCES `proc_logistics_partners`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_shipments` ADD CONSTRAINT `proc_shipment_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_transports` ADD CONSTRAINT `proc_transport_partner_fk` FOREIGN KEY (`transporter_id`) REFERENCES `proc_logistics_partners`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_transports` ADD CONSTRAINT `proc_transport_shipment_fk` FOREIGN KEY (`shipment_id`) REFERENCES `proc_shipments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_vendor_quote_lines` ADD CONSTRAINT `fk_proc_quote_line_quote` FOREIGN KEY (`vendor_quote_id`) REFERENCES `proc_vendor_quotes`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_vendor_quote_lines` ADD CONSTRAINT `fk_proc_quote_line_rfx` FOREIGN KEY (`rfx_line_id`) REFERENCES `proc_rfx_lines`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_vendor_quotes` ADD CONSTRAINT `fk_proc_quote_rfx` FOREIGN KEY (`rfx_id`) REFERENCES `proc_rfx`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `proc_vendor_quotes` ADD CONSTRAINT `fk_proc_quote_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `fin_vendors`(`id`) ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fkey` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_host_id_fkey` FOREIGN KEY (`host_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `property_coa_mapping` ADD CONSTRAINT `property_coa_mapping_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_marketing_agent_id_fkey` FOREIGN KEY (`marketing_agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `system_notifications` ADD CONSTRAINT `system_notifications_target_user_fkey` FOREIGN KEY (`target_user`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tenant_organisations` ADD CONSTRAINT `tenant_organisations_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tenant_organisations` ADD CONSTRAINT `tenant_organisations_onboarded_by_fkey` FOREIGN KEY (`onboarded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tenant_subscription_invoices` ADD CONSTRAINT `tenant_subscription_invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_organisations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_amenities` ADD CONSTRAINT `unit_amenities_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `unit_rooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_amenities` ADD CONSTRAINT `unit_amenities_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_deposit_sl_id_fkey` FOREIGN KEY (`deposit_sl_id`) REFERENCES `coa_sl`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_pdc_sl_id_fkey` FOREIGN KEY (`pdc_sl_id`) REFERENCES `coa_sl`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_receivable_sl_id_fkey` FOREIGN KEY (`receivable_sl_id`) REFERENCES `coa_sl`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_coa_mapping` ADD CONSTRAINT `unit_coa_mapping_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `unit_rooms` ADD CONSTRAINT `unit_rooms_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_property_id_fkey` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

