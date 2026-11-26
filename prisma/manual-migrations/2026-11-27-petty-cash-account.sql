-- Petty Cash sub-ledger account (SL 12100002) under Cash In Hand (GL 12100), cloned from Cash In Hand SL 12100001.
INSERT INTO coa_sl (id, gl_id, class_id, group_id, type_id, gl_code, class_code, group_code, type_code, code, name, normal_balance,
  is_control_account, is_posting_account, allows_direct_posting, requires_property, requires_unit, requires_tenant, requires_vendor,
  requires_employee, requires_asset, requires_inventory, requires_security_deposit, requires_pdc, requires_lease, is_active, created_at, updated_at)
SELECT UUID(), gl_id, class_id, group_id, type_id, gl_code, class_code, group_code, type_code, '12100002', 'Petty Cash', normal_balance,
  is_control_account, is_posting_account, allows_direct_posting, requires_property, requires_unit, requires_tenant, requires_vendor,
  requires_employee, requires_asset, requires_inventory, requires_security_deposit, requires_pdc, requires_lease, is_active, NOW(6), NOW(6)
FROM coa_sl WHERE code = '12100001' AND NOT EXISTS (SELECT 1 FROM coa_sl WHERE code = '12100002');

INSERT INTO fin_coa_accounts (id, account_code, account_name, account_type, parent_id, parent_account_id, is_active, group_name, class_name, account_level, created_at, updated_at)
SELECT UUID(), '12100002', 'Petty Cash', account_type, parent_id, parent_account_id, is_active, group_name, class_name, account_level, NOW(6), NOW(6)
FROM fin_coa_accounts WHERE account_code = '12100001' AND NOT EXISTS (SELECT 1 FROM fin_coa_accounts WHERE account_code = '12100002');
-- Rollback: DELETE FROM fin_coa_accounts WHERE account_code = '12100002'; DELETE FROM coa_sl WHERE code = '12100002';
