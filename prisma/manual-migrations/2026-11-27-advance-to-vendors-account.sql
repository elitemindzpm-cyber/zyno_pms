-- Advance to Vendors: class 123, GL 12300, SL 12300001 (cloned from the Prepaid Expenses structure, class 125 / GL 12500).
INSERT INTO coa_classes (id, code, name, group_id, group_code, type_id, type_code, is_active, created_at, updated_at)
SELECT UUID(), '123', 'Advance to Vendors', group_id, group_code, type_id, type_code, is_active, NOW(6), NOW(6)
FROM coa_classes WHERE code = '125' AND NOT EXISTS (SELECT 1 FROM coa_classes WHERE code = '123');

INSERT INTO coa_gl (id, class_id, group_id, type_id, class_code, group_code, type_code, code, name, normal_balance,
  is_control_account, is_posting_account, allows_direct_posting, requires_property, requires_unit, requires_tenant, requires_vendor,
  requires_employee, requires_asset, requires_inventory, requires_security_deposit, requires_pdc, requires_lease, is_active, created_at, updated_at)
SELECT UUID(), (SELECT id FROM coa_classes WHERE code = '123'), g.group_id, g.type_id, '123', g.group_code, g.type_code, '12300', 'Advance to Vendors', g.normal_balance,
  g.is_control_account, g.is_posting_account, g.allows_direct_posting, g.requires_property, g.requires_unit, g.requires_tenant, g.requires_vendor,
  g.requires_employee, g.requires_asset, g.requires_inventory, g.requires_security_deposit, g.requires_pdc, g.requires_lease, g.is_active, NOW(6), NOW(6)
FROM coa_gl g WHERE g.code = '12500' AND NOT EXISTS (SELECT 1 FROM coa_gl WHERE code = '12300');

INSERT INTO coa_sl (id, gl_id, class_id, group_id, type_id, gl_code, class_code, group_code, type_code, code, name, normal_balance,
  is_control_account, is_posting_account, allows_direct_posting, requires_property, requires_unit, requires_tenant, requires_vendor,
  requires_employee, requires_asset, requires_inventory, requires_security_deposit, requires_pdc, requires_lease, is_active, created_at, updated_at)
SELECT UUID(), (SELECT id FROM coa_gl WHERE code = '12300'), (SELECT id FROM coa_classes WHERE code = '123'), s.group_id, s.type_id, '12300', '123', s.group_code, s.type_code, '12300001', 'Advance to Vendors', s.normal_balance,
  s.is_control_account, s.is_posting_account, s.allows_direct_posting, s.requires_property, s.requires_unit, s.requires_tenant, s.requires_vendor,
  s.requires_employee, s.requires_asset, s.requires_inventory, s.requires_security_deposit, s.requires_pdc, s.requires_lease, s.is_active, NOW(6), NOW(6)
FROM coa_sl s WHERE s.code = '12500001' AND NOT EXISTS (SELECT 1 FROM coa_sl WHERE code = '12300001');

INSERT INTO fin_coa_accounts (id, account_code, account_name, account_type, parent_id, parent_account_id, is_active, group_name, class_name, account_level, created_at, updated_at)
SELECT UUID(), '12300', 'Advance to Vendors', account_type, NULL, NULL, is_active, group_name, 'Advance to Vendors', 'GL', NOW(6), NOW(6)
FROM fin_coa_accounts WHERE account_code = '12500' AND NOT EXISTS (SELECT 1 FROM fin_coa_accounts WHERE account_code = '12300');

INSERT INTO fin_coa_accounts (id, account_code, account_name, account_type, parent_id, parent_account_id, is_active, group_name, class_name, account_level, created_at, updated_at)
SELECT UUID(), '12300001', 'Advance to Vendors', f.account_type, g.id, g.id, f.is_active, f.group_name, 'Advance to Vendors', 'SL', NOW(6), NOW(6)
FROM fin_coa_accounts f JOIN fin_coa_accounts g ON g.account_code = '12300'
WHERE f.account_code = '12500001' AND NOT EXISTS (SELECT 1 FROM fin_coa_accounts WHERE account_code = '12300001');
-- Rollback: DELETE FROM fin_coa_accounts WHERE account_code IN ('12300001','12300'); DELETE FROM coa_sl WHERE code='12300001'; DELETE FROM coa_gl WHERE code='12300'; DELETE FROM coa_classes WHERE code='123';
