import { fetchUnitLedgerContext, createUnitLedgers, type UnitLedgerContext } from '../../db';
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
 * Unit ledgers bulk upload: one row per unit, creating its three sub-ledgers in one go.
 *   PDC In Hand      -> GL 12900
 *   Deposit          -> GL 21500
 *   Receivables      -> GL 12413
 * Each row is saved through POST /api/accounting/unit-ledgers, which writes coa_sl, fin_coa_accounts,
 * fin_unit_sl_accounts (what posting reads) and unit_coa_mapping in one transaction per unit.
 * The GL parents must already exist (upload the Chart of Accounts first). CREATE only.
 */
export const UNIT_LEDGER_GLS = { pdc: '12900', deposit: '21500', receivable: '12413' } as const;
const UNIT_LEDGER_GL_CODES: string[] = Object.values(UNIT_LEDGER_GLS);

export const UNIT_LEDGER_COLUMNS: ColumnDefinition[] = [
  { key: 'property_code', label: 'Property Code', type: 'string', required: true, sampleValue: 'AAA', description: 'Property Code from the Property master' },
  { key: 'unit_code', label: 'Unit Code', type: 'string', required: true, sampleValue: 'OS40-GF1', description: 'Unit Code / No. under that property. Unit must already exist' },
  { key: 'pdc_sl_code', label: 'PDC In Hand SL Code', type: 'string', required: true, unique: true, sampleValue: '12900999', description: 'New SL under GL 12900 (PDC In Hand). Must not be used anywhere in the chart' },
  { key: 'pdc_sl_name', label: 'PDC In Hand SL Name', type: 'string', required: true, sampleValue: 'PDC In Hand - OS40-GF1', description: 'Name of the PDC In Hand sub-ledger' },
  { key: 'deposit_sl_code', label: 'Deposit SL Code', type: 'string', required: true, unique: true, sampleValue: '21500999', description: 'New SL under GL 21500 (Deposits). Must not be used anywhere in the chart' },
  { key: 'deposit_sl_name', label: 'Deposit SL Name', type: 'string', required: true, sampleValue: 'Deposit - OS40-GF1', description: 'Name of the deposit sub-ledger' },
  { key: 'receivable_sl_code', label: 'Receivables SL Code', type: 'string', required: true, unique: true, sampleValue: '12413999', description: 'New SL under GL 12413 (Tenant Receivables). Must not be used anywhere in the chart' },
  { key: 'receivable_sl_name', label: 'Receivables SL Name', type: 'string', required: true, sampleValue: 'Receivables - OS40-GF1', description: 'Name of the receivables sub-ledger' },
];

const LEDGER_SPECS = [
  { kind: 'pdc' as const, label: 'PDC In Hand', codeKey: 'pdc_sl_code', nameKey: 'pdc_sl_name' },
  { kind: 'deposit' as const, label: 'Deposit', codeKey: 'deposit_sl_code', nameKey: 'deposit_sl_name' },
  { kind: 'receivable' as const, label: 'Receivables', codeKey: 'receivable_sl_code', nameKey: 'receivable_sl_name' },
];

type UnitIndexEntry = {
  id: string;
  property_id: string;
  unit_code: string;
  unit_name: string;
};

type LedgerState = {
  /** Upper-case "PROPERTY_CODE::UNIT_CODE" -> unit */
  units: Map<string, UnitIndexEntry>;
  /** Upper-case property code -> property id */
  properties: Map<string, string>;
  /** Unit ids that already have a PDC / deposit / receivable ledger or a unit mapping */
  unitsWithLedgers: Set<string>;
  /** Upper-case codes already used anywhere in the chart (GL, SL, posting accounts) */
  takenCodes: Set<string>;
  /** GL parents that exist in the chart */
  glCodes: Set<string>;
  /** SL codes accepted earlier in this file */
  batchSlCodes: Set<string>;
};

let state: LedgerState | null = null;

const up = (s: string) => String(s ?? '').trim().toUpperCase();
const keyOf = (propertyCode: string, unitCode: string) => `${up(propertyCode)}::${up(unitCode)}`;

function readCell(row: Record<string, any>, key: string): string {
  const col = UNIT_LEDGER_COLUMNS.find(c => c.key === key)!;
  const v = getCellValue(row, col.label, col.label + ' *', col.key);
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function buildState(ctx: UnitLedgerContext): LedgerState {
  const propertyById = new Map<string, string>();
  const properties = new Map<string, string>();
  for (const p of ctx.properties) {
    if (!p.property_code) continue;
    propertyById.set(p.id, p.property_code);
    properties.set(up(p.property_code), p.id);
  }

  const units = new Map<string, UnitIndexEntry>();
  for (const u of ctx.units) {
    const propertyCode = u.property_id ? propertyById.get(u.property_id) : undefined;
    if (!propertyCode || !u.unit_code) continue;
    units.set(keyOf(propertyCode, u.unit_code), {
      id: u.id,
      property_id: u.property_id as string,
      unit_code: u.unit_code,
      unit_name: u.unit_name || u.unit_code,
    });
  }

  return {
    units,
    properties,
    unitsWithLedgers: new Set(ctx.unitsWithLedgers),
    takenCodes: new Set(ctx.takenCodes.map(up)),
    glCodes: new Set(Object.keys(ctx.gls)),
    batchSlCodes: new Set(),
  };
}

export const unitLedgerAdapter: EntityImportAdapter = {
  module: 'unit_ledger' as any,
  label: 'Unit Ledgers',
  primaryKeyLabel: 'Property Code + Unit Code',
  primaryKeyField: 'unit_code',
  columns: UNIT_LEDGER_COLUMNS,

  getTemplateColumns(_operation: ImportOperation): ColumnDefinition[] {
    return UNIT_LEDGER_COLUMNS;
  },

  resolveRecordKey(row: Record<string, any>): string {
    const propertyCode = readCell(row, 'property_code');
    const unitCode = readCell(row, 'unit_code');
    if (!propertyCode && !unitCode) return '';
    return keyOf(propertyCode, unitCode);
  },

  async fetchExistingRecords(_keys: string[]): Promise<Map<string, Record<string, any>>> {
    // Errors are not swallowed: without this data no row can be validated safely.
    const ctx = await fetchUnitLedgerContext();
    state = buildState(ctx);

    const map = new Map<string, Record<string, any>>();
    for (const [key, unit] of state.units) {
      map.set(key, { ...unit, has_ledgers: state.unitsWithLedgers.has(unit.id) });
    }
    return map;
  },

  async validateRow(row, operation, context) {
    const errors: ImportErrorDetail[] = [];
    const warnings: ImportErrorDetail[] = [];
    const changes: FieldComparison[] = [];
    const dependencies: DependencyCheckItem[] = [];
    const normalized: Record<string, any> = {};
    const result = () => ({ errors, warnings, normalized, changes, dependencies });

    const err = (field: string, code: string, message: string) =>
      errors.push({ row: context.rowNumber, field, code, message, severity: 'ERROR' });
    const warn = (field: string, code: string, message: string) =>
      warnings.push({ row: context.rowNumber, field, code, message, severity: 'WARNING' });

    if (operation !== 'CREATE') {
      err('Operation', 'LED_001', 'Unit ledger upload supports CREATE only.');
      return result();
    }
    if (!state) {
      err('Operation', 'SYS_002', 'Property, unit and GL data was not loaded. Close the import and try again.');
      return result();
    }

    for (const col of UNIT_LEDGER_COLUMNS) {
      const val = readCell(row, col.key);
      if (!val) {
        err(col.label, 'VAL_001', `${col.label} is required.`);
      } else {
        normalized[col.key] = val;
      }
    }
    if (errors.length > 0) return result();

    const propertyCode: string = normalized.property_code;
    const unitCode: string = normalized.unit_code;
    const key = keyOf(propertyCode, unitCode);

    if (!state.properties.has(up(propertyCode))) {
      err('Property Code', 'REF_001', `Property Code "${propertyCode}" was not found in the Property master.`);
      return result();
    }

    const unit = state.units.get(key);
    if (!unit) {
      err('Unit Code', 'REF_002', `Unit "${unitCode}" was not found under property "${propertyCode}".`);
      return result();
    }

    if (context.inBatchKeys.has(key)) {
      err('Unit Code', 'DUP_002', `Unit "${unitCode}" under "${propertyCode}" appears more than once in this file.`);
    }
    if (state.unitsWithLedgers.has(unit.id)) {
      err('Unit Code', 'DUP_001', `Unit "${unitCode}" already has PDC, deposit or receivable ledgers. Remove it from this file.`);
    }

    normalized.unit_id = unit.id;
    normalized.property_id = unit.property_id;
    normalized.unit_name = unit.unit_name;

    const codes: string[] = [];
    for (const spec of LEDGER_SPECS) {
      const code: string = normalized[spec.codeKey];
      const glCode = UNIT_LEDGER_GLS[spec.kind];
      const field = `${spec.label} SL Code`;
      const uc = up(code);

      if (!state.glCodes.has(glCode)) {
        err(field, 'GL_001', `GL ${glCode} (${spec.label}) is not in the Chart of Accounts. Upload the chart first.`);
      } else if (UNIT_LEDGER_GL_CODES.includes(uc)) {
        err(field, 'COA_012', `SL code "${code}" is a GL code. Choose a sub-ledger code.`);
      } else if (state.takenCodes.has(uc)) {
        err(field, 'DUP_001', `SL code "${code}" is already used in the Chart of Accounts.`);
      } else if (state.batchSlCodes.has(uc)) {
        err(field, 'DUP_003', `SL code "${code}" appears more than once in this file.`);
      }

      if (!code.startsWith(glCode)) {
        warn(field, 'SL_001', `SL code "${code}" does not start with GL ${glCode}. Existing unit codes do, so confirm this code.`);
      }
      codes.push(uc);
    }

    if (new Set(codes).size !== codes.length) {
      err('SL Code', 'DUP_004', 'The PDC, deposit and receivable SL codes must be different from each other.');
    }

    if (errors.length === 0) {
      for (const c of codes) state.batchSlCodes.add(c);
    }

    return result();
  },

  async executeRecord(record, operation, _user) {
    if (operation !== 'CREATE') {
      return { success: false, resultText: 'Unsupported operation', error: 'Unit ledgers support CREATE only' };
    }
    const d = record.normalizedData;
    try {
      const created = await createUnitLedgers({
        unit_id: d.unit_id,
        property_id: d.property_id,
        pdc: { code: d.pdc_sl_code, name: d.pdc_sl_name },
        deposit: { code: d.deposit_sl_code, name: d.deposit_sl_name },
        receivable: { code: d.receivable_sl_code, name: d.receivable_sl_name },
      });
      return {
        success: true,
        createdId: created.unit_id,
        resultText: `Unit ${d.unit_code}: PDC In Hand ${d.pdc_sl_code}, Deposit ${d.deposit_sl_code}, Receivables ${d.receivable_sl_code} created.`,
      };
    } catch (err: any) {
      return {
        success: false,
        resultText: 'Failed to create unit ledgers',
        error: err?.message || 'Database error occurred',
      };
    }
  },
};
