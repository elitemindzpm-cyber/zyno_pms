import { db, createCoaAccount, fetchCoaHierarchyTree, fetchERPChartOfAccounts } from '../../db';
import {
  type EntityImportAdapter,
  type ColumnDefinition,
  type ImportErrorDetail,
  type FieldComparison,
  type DependencyCheckItem,
  type ImportOperation,
  getCellValue,
} from '../types';

/**
 * Chart of Accounts bulk upload - 5-tier structure:
 *   TYPE (L1) -> GROUP (L2) -> CLASS (L3) -> GL (L4, control) -> SL (L5, posting account)
 *
 * Each row describes one SL (posting) account. Its parent TYPE / GROUP / CLASS / GL are created
 * when they do not exist yet and reused when they do. Rows are persisted through the same
 * POST /api/accounting/coa endpoint used by the single "Add Account" form, so the server's
 * transactional hierarchy and ERP / financial sync logic is shared.
 */
export const COA_COLUMNS: ColumnDefinition[] = [
  { key: 'type_code', label: 'TYPE Code', type: 'string', required: true, sampleValue: '1', description: 'Level 1 - Account type code (e.g. 1 = Assets, 2 = Liabilities, 3 = Capital, 4 = Revenue, 5 = Expenditure)' },
  { key: 'type_name', label: 'TYPE Name', type: 'string', required: true, sampleValue: 'Assets', description: 'Level 1 - Account type name' },
  { key: 'group_code', label: 'GROUP Code', type: 'string', required: true, sampleValue: '11', description: 'Level 2 - Group code. Must belong to the same TYPE wherever it is used' },
  { key: 'group_name', label: 'GROUP Name', type: 'string', required: true, sampleValue: 'Non-Current Assets', description: 'Level 2 - Group name' },
  { key: 'class_code', label: 'CLASS Code', type: 'string', required: true, sampleValue: '110', description: 'Level 3 - Class code. Must belong to the same GROUP wherever it is used' },
  { key: 'class_name', label: 'CLASS Name', type: 'string', required: true, sampleValue: 'Property, Plant & Equipment', description: 'Level 3 - Class name' },
  { key: 'gl_code', label: 'GL Code', type: 'string', required: true, sampleValue: '11000', description: 'Level 4 - General Ledger control account. Must belong to the same CLASS wherever it is used' },
  { key: 'gl_name', label: 'GL Name', type: 'string', required: true, sampleValue: 'PPE Land Cost', description: 'Level 4 - GL account name' },
  { key: 'sl_code', label: 'SL Code', type: 'string', required: true, unique: true, sampleValue: '11000-001', description: 'Level 5 - Sub-ledger (posting) account code. Primary key of the import; must be unique' },
  { key: 'sl_name', label: 'SL Name', type: 'string', required: true, sampleValue: 'Land - Building 12', description: 'Level 5 - Sub-ledger (posting) account name' },
];

const COA_LEVEL_LABELS = { sl: 'SL', gl: 'GL' } as const;

type HierarchyIndex = {
  types: Map<string, { name: string }>;
  groups: Map<string, { type_code: string; name: string }>;
  classes: Map<string, { group_code: string; type_code: string; name: string }>;
  gls: Map<string, { class_code: string; group_code: string; type_code: string; name: string }>;
  /** Existing sub-ledger (SL) codes */
  sls: Set<string>;
  /** Every GL / SL code already present in the ERP or COA master (used to detect code collisions) */
  erpCodes: Set<string>;
};

const emptyIndex = (): HierarchyIndex => ({
  types: new Map(),
  groups: new Map(),
  classes: new Map(),
  gls: new Map(),
  sls: new Set(),
  erpCodes: new Set(),
});

// Rebuilt by fetchExistingRecords, which the engine calls before validating any rows.
let dbIndex: HierarchyIndex = emptyIndex();
// Rows accepted so far in the current upload, so later rows are checked against earlier ones.
let batchIndex: HierarchyIndex = emptyIndex();

const up = (s: string) => String(s ?? '').trim().toUpperCase();
const norm = (s: string | undefined | null) => String(s ?? '').trim().toLowerCase();

function readCell(row: Record<string, any>, key: string): string {
  const col = COA_COLUMNS.find(c => c.key === key)!;
  const v = getCellValue(row, col.label, col.label + ' *', col.key);
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

export const coaAdapter: EntityImportAdapter = {
  module: 'coa' as any,
  label: 'Chart of Accounts',
  primaryKeyLabel: 'SL Code',
  primaryKeyField: 'sl_code',
  columns: COA_COLUMNS,

  getTemplateColumns(_operation: ImportOperation): ColumnDefinition[] {
    return COA_COLUMNS;
  },

  resolveRecordKey(row: Record<string, any>): string {
    return readCell(row, 'sl_code');
  },

  async fetchExistingRecords(keys: string[]): Promise<Map<string, Record<string, any>>> {
    const map = new Map<string, Record<string, any>>();
    const index = emptyIndex();

    try {
      const [hierarchy, erpRows, slRes] = await Promise.all([
        fetchCoaHierarchyTree(),
        fetchERPChartOfAccounts().catch(() => []),
        keys.length > 0
          ? db.from('coa_sl').select('*').in('code', keys)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      for (const t of hierarchy.types) index.types.set(up(t.code), { name: t.name });
      for (const g of hierarchy.groups) index.groups.set(up(g.code), { type_code: up(g.type_code), name: g.name });
      for (const c of hierarchy.classes) index.classes.set(up(c.code), { group_code: up(c.group_code), type_code: up(c.type_code), name: c.name });
      for (const gl of hierarchy.gls) {
        index.gls.set(up(gl.code), { class_code: up(gl.class_code), group_code: up(gl.group_code), type_code: up(gl.type_code), name: gl.name });
        index.erpCodes.add(up(gl.code));
      }
      for (const e of erpRows as any[]) if (e?.code) index.erpCodes.add(up(e.code));

      const { data: slData, error: slErr } = (slRes as any) || {};
      if (slErr) throw slErr;
      for (const sl of (slData || []) as any[]) {
        if (!sl?.code) continue;
        index.sls.add(up(sl.code));
        index.erpCodes.add(up(sl.code));
        map.set(up(sl.code), sl);
      }
    } catch (e) {
      console.error('Error loading Chart of Accounts for import:', e);
    }

    dbIndex = index;
    batchIndex = emptyIndex();
    return map;
  },

  async validateRow(row, operation, context) {
    const errors: ImportErrorDetail[] = [];
    const warnings: ImportErrorDetail[] = [];
    const changes: FieldComparison[] = [];
    const dependencies: DependencyCheckItem[] = [];
    const normalized: Record<string, any> = {};

    const err = (field: string, code: string, message: string) =>
      errors.push({ row: context.rowNumber, field, code, message, severity: 'ERROR' });
    const warn = (field: string, code: string, message: string) =>
      warnings.push({ row: context.rowNumber, field, code, message, severity: 'WARNING' });

    if (operation !== 'CREATE') {
      err('Operation', 'COA_001', 'Chart of Accounts bulk upload supports CREATE only. Edit or remove accounts from the COA screen.');
      return { errors, warnings, normalized, changes, dependencies };
    }

    // 1. Required fields (same rules as the single "Add Account" form)
    for (const col of COA_COLUMNS) {
      const val = readCell(row, col.key);
      if (!val) {
        err(col.label, 'VAL_001', `${col.label} is required.`);
      } else {
        normalized[col.key] = val;
      }
    }

    if (!normalized.sl_code) {
      return { errors, warnings, normalized, changes, dependencies };
    }

    const type = { code: up(normalized.type_code), name: normalized.type_name as string };
    const group = { code: up(normalized.group_code), name: normalized.group_name as string };
    const cls = { code: up(normalized.class_code), name: normalized.class_name as string };
    const gl = { code: up(normalized.gl_code), name: normalized.gl_name as string };
    const sl = { code: up(normalized.sl_code), name: normalized.sl_name as string };

    // 2. Look-ups across the database and earlier rows of this file
    const lookup = <T>(pick: (i: HierarchyIndex) => Map<string, T>, code: string): T | undefined =>
      pick(dbIndex).get(code) ?? pick(batchIndex).get(code);
    const isSl = (code: string) => dbIndex.sls.has(code) || batchIndex.sls.has(code);
    const isErpCode = (code: string) => dbIndex.erpCodes.has(code) || batchIndex.erpCodes.has(code);

    // 3. SL (posting account) must be new and unique
    if (dbIndex.sls.has(sl.code)) {
      err('SL Code', 'DUP_001', `SL code "${normalized.sl_code}" already exists in the Chart of Accounts. It cannot be created again.`);
    }
    if (context.inBatchKeys.has(sl.code)) {
      err('SL Code', 'DUP_002', `Duplicate SL code "${normalized.sl_code}" appears more than once in this file.`);
    }

    // 4. Posting codes share one namespace (GL and SL both post to the ledger)
    if (!isSl(sl.code) && isErpCode(sl.code)) {
      err('SL Code', 'COA_010', `SL code "${normalized.sl_code}" is already used by an existing GL / ledger account. Choose a different SL code.`);
    }
    if (isSl(gl.code)) {
      err('GL Code', 'COA_011', `GL code "${normalized.gl_code}" is already used as a sub-ledger (SL) code. Choose a different GL code.`);
    }
    if (gl.code === sl.code) {
      err('SL Code', 'COA_012', 'SL code must differ from its GL code.');
    }

    // 5. Hierarchy consistency: an existing code must sit under the parent it already has
    const existingType = lookup(i => i.types, type.code);
    if (existingType && norm(existingType.name) !== norm(type.name)) {
      warn('TYPE Name', 'COA_020', `TYPE "${normalized.type_code}" already exists as "${existingType.name}". The existing name will be kept.`);
    }

    const existingGroup = lookup(i => i.groups, group.code);
    if (existingGroup) {
      if (existingGroup.type_code !== type.code) {
        err('GROUP Code', 'COA_021', `GROUP "${normalized.group_code}" already exists under TYPE "${existingGroup.type_code}", not "${normalized.type_code}".`);
      }
      if (norm(existingGroup.name) !== norm(group.name)) {
        warn('GROUP Name', 'COA_022', `GROUP "${normalized.group_code}" already exists as "${existingGroup.name}". The existing name will be kept.`);
      }
    }

    const existingClass = lookup(i => i.classes, cls.code);
    if (existingClass) {
      if (existingClass.group_code !== group.code || existingClass.type_code !== type.code) {
        err('CLASS Code', 'COA_023', `CLASS "${normalized.class_code}" already exists under GROUP "${existingClass.group_code}", not "${normalized.group_code}".`);
      }
      if (norm(existingClass.name) !== norm(cls.name)) {
        warn('CLASS Name', 'COA_024', `CLASS "${normalized.class_code}" already exists as "${existingClass.name}". The existing name will be kept.`);
      }
    }

    const existingGl = lookup(i => i.gls, gl.code);
    if (existingGl) {
      if (existingGl.class_code !== cls.code || existingGl.group_code !== group.code || existingGl.type_code !== type.code) {
        err('GL Code', 'COA_025', `GL "${normalized.gl_code}" already exists under CLASS "${existingGl.class_code}", not "${normalized.class_code}".`);
      }
      if (norm(existingGl.name) !== norm(gl.name)) {
        warn('GL Name', 'COA_026', `GL "${normalized.gl_code}" already exists as "${existingGl.name}". The existing name will be kept.`);
      }
    } else if (dbIndex.erpCodes.has(gl.code) && !dbIndex.sls.has(gl.code)) {
      warn('GL Code', 'COA_027', `GL "${normalized.gl_code}" already exists in the legacy ERP chart. The existing account will be linked into this hierarchy.`);
    }

    // 6. Register accepted rows so later rows in this file are checked against them
    if (errors.length === 0) {
      if (!existingType) batchIndex.types.set(type.code, { name: type.name });
      if (!existingGroup) batchIndex.groups.set(group.code, { type_code: type.code, name: group.name });
      if (!existingClass) batchIndex.classes.set(cls.code, { group_code: group.code, type_code: type.code, name: cls.name });
      if (!existingGl) batchIndex.gls.set(gl.code, { class_code: cls.code, group_code: group.code, type_code: type.code, name: gl.name });
      batchIndex.sls.add(sl.code);
      batchIndex.erpCodes.add(gl.code);
      batchIndex.erpCodes.add(sl.code);
    }

    return { errors, warnings, normalized, changes, dependencies };
  },

  async executeRecord(record, operation, _user) {
    if (operation !== 'CREATE') {
      return { success: false, resultText: 'Unsupported operation', error: 'Chart of Accounts supports CREATE only' };
    }
    try {
      const d = record.normalizedData;
      const created = await createCoaAccount({
        type_code: d.type_code,
        type_name: d.type_name,
        group_code: d.group_code,
        group_name: d.group_name,
        class_code: d.class_code,
        class_name: d.class_name,
        gl_code: d.gl_code,
        gl_name: d.gl_name,
        sl_code: d.sl_code,
        sl_name: d.sl_name,
      });

      return {
        success: true,
        createdId: created?.erpAccount?.id,
        resultText: `${COA_LEVEL_LABELS.sl} ${d.sl_code} - ${d.sl_name} created under ${COA_LEVEL_LABELS.gl} ${d.gl_code} (${d.type_name} > ${d.group_name} > ${d.class_name}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        resultText: 'Failed to create Chart of Account',
        error: err?.message || 'Database error occurred',
      };
    }
  },
};
