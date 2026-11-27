-- Legal cases, payroll runs, bank clearances, bank reconciliation records and statements, previously kept only in browser state.
CREATE TABLE IF NOT EXISTS fin_legal_cases (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  legal_case_id VARCHAR(100) NOT NULL,
  tenant_name VARCHAR(255) NULL,
  property_name VARCHAR(255) NULL,
  unit_ref VARCHAR(100) NULL,
  original_amount DECIMAL(18,4) NOT NULL,
  outstanding_balance DECIMAL(18,4) NOT NULL,
  escalation_date DATE NOT NULL,
  reason TEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Legal Notice Sent',
  voucher_number VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fin_legal_cases_no (legal_case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fin_payroll_runs (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  payroll_run_id VARCHAR(100) NOT NULL,
  period VARCHAR(50) NULL,
  department VARCHAR(255) NULL,
  account_code VARCHAR(50) NULL,
  basic_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
  overtime DECIMAL(18,4) NOT NULL DEFAULT 0,
  deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(18,4) NOT NULL,
  bank_account VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Posted',
  error_details TEXT NULL,
  voucher_number VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fin_payroll_runs_no (payroll_run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fin_bank_clearances (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  ref VARCHAR(100) NOT NULL,
  bank VARCHAR(255) NULL,
  type VARCHAR(100) NULL,
  amount DECIMAL(18,4) NOT NULL,
  clearance_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending Clearance',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fin_bank_recon_records (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  account_number VARCHAR(255) NOT NULL,
  statement_date DATE NOT NULL,
  book_balance DECIMAL(18,4) NOT NULL DEFAULT 0,
  statement_balance DECIMAL(18,4) NOT NULL DEFAULT 0,
  difference DECIMAL(18,4) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Reconciled',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fin_recon_statements (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  period VARCHAR(50) NULL,
  balance VARCHAR(100) NULL,
  auditor VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- Rollback: DROP TABLE fin_recon_statements; DROP TABLE fin_bank_recon_records; DROP TABLE fin_bank_clearances; DROP TABLE fin_payroll_runs; DROP TABLE fin_legal_cases;
