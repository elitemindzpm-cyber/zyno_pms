-- Ledger names requested in "Entries.xlsx". Names only: no codes, balances or postings change.
-- Idempotent and safe to re-run. NOT applied automatically.
UPDATE fin_coa_accounts SET account_name = 'PDC In Hand Liability', updated_at = NOW(6) WHERE account_code = '21400001' AND account_name <> 'PDC In Hand Liability';
UPDATE fin_coa_accounts SET account_name = 'Tenant Receivables',    updated_at = NOW(6) WHERE account_code = '12413001' AND account_name <> 'Tenant Receivables';
UPDATE fin_coa_accounts SET account_name = 'Deposits - Leasing Customers', updated_at = NOW(6) WHERE account_code = '21500001' AND account_name <> 'Deposits - Leasing Customers';
