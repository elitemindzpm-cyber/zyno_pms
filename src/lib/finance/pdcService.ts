import { db } from '../db';
import {
  postPdcCollection,
  postPdcDepositToBank,
  postPdcClear,
  postPdcReturn,
  postCashDepositInPlaceOfPdc,
  postPdcCancel,
  postVoucher,
} from './posting-engine';
import { FinPdcRegisterApi } from '../db-finance';
import { resolveAccountingAccounts, normalizeUuid, type PdcType } from './account-resolver';

// ── Typed errors ──────────────────────────────────────────────────────────────

/**
 * Thrown when a PDC lifecycle operation is attempted in an invalid state.
 * `code` lets the UI map to a workflow ('Use dishonour flow' instead of
 * 'PDC return') without parsing the message string.
 */
export class PdcStateError extends Error {
  readonly code:
    | 'PDC_ALREADY_CLEARED'
    | 'PDC_ALREADY_DEPOSITED'
    | 'PDC_NOT_FOUND'
    | 'PDC_ALREADY_RETURNED'
    | 'PDC_ALREADY_CANCELLED';
  readonly pdcId: string | number;
  readonly chequeNumber?: string;
  readonly currentStatus?: string;

  constructor(args: {
    code: PdcStateError['code'];
    pdcId: string | number;
    chequeNumber?: string;
    currentStatus?: string;
    message?: string;
  }) {
    super(
      args.message ??
        `PDC ${args.chequeNumber ?? args.pdcId} cannot proceed in state '${args.currentStatus ?? 'unknown'}'.`,
    );
    this.name = 'PdcStateError';
    this.code = args.code;
    this.pdcId = args.pdcId;
    this.chequeNumber = args.chequeNumber;
    this.currentStatus = args.currentStatus;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIN_PDC_SELECT =
  'id, amount, tenant_id, property_id, unit_id, lease_id, bank_id, cheque_number, status, cheque_date, deposit_date, cleared_date, returned_date, original_pdc_id';

export interface PdcContextHints {
  amount?: number;
  chequeDate?: string;
  maturityDate?: string;
  unitCode?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  finId?: number;
  duplicateFinIds?: number[];
  pdcsId?: string;
  status?: string;
}

export interface ParsedPdcIdentifier {
  finId?: number;
  pdcsId?: string;
  isSyntheticId: boolean;
  raw: string;
}

export interface ResolvedPdcContext {
  amount: number;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  cheque_number: string;
  unitCode?: string;
  pdcType: PdcType;
  status: string;
  maturity_date?: string;
  finId?: number;
  duplicateFinIds: number[];
  pdcId?: string;
  sl_no?: number;
  bank_id?: number;
}

/** Parse numeric, `fin-<id>`, UUID, or synthetic local PDC identifiers. */
export function parsePdcIdentifier(pdcId: string | number): ParsedPdcIdentifier {
  const raw = String(pdcId ?? '').trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n) && n > 0) {
      return { finId: n, isSyntheticId: false, raw };
    }
  }
  const finMatch = /^fin-(\d+)$/i.exec(raw);
  if (finMatch) {
    const n = Number(finMatch[1]);
    if (Number.isSafeInteger(n) && n > 0) {
      return { finId: n, isSyntheticId: false, raw };
    }
  }
  if (UUID_RE.test(raw)) {
    return { pdcsId: raw, isSyntheticId: false, raw };
  }
  return { isSyntheticId: true, raw };
}

/**
 * Resolve the real UUID tenant / property / unit for a PDC so postings hit the
 * unit-level SLs (12413 / 12900 / 21400 [unit SL]) instead of falling back to
 * the GL control accounts. Legacy PDC rows only carry bigint ids or a unit
 * code, so look the UUIDs up via the lease first, then via the unit master.
 */
async function resolveUuidScope(args: {
  leaseId?: string | number | null;
  unitCode?: string | null;
}): Promise<{ tenant_id?: string; property_id?: string; unit_id?: string }> {
  const leaseId = normalizeUuid(args.leaseId as any);
  try {
    if (leaseId) {
      const { data: lease } = await db
        .from('leases')
        .select('customer_id, property_id, unit_id')
        .eq('id', leaseId)
        .maybeSingle();
      if (lease?.unit_id) {
        return {
          tenant_id:   normalizeUuid(lease.customer_id),
          property_id: normalizeUuid(lease.property_id),
          unit_id:     normalizeUuid(lease.unit_id),
        };
      }
    }
    const code = (args.unitCode || '').trim();
    if (code) {
      const { data: unitRows } = await db
        .from('units')
        .select('id, property_id')
        .or(`unit_ref.eq.${code},unit_code.eq.${code},unit_name.eq.${code}`)
        .limit(1);
      const u = unitRows?.[0];
      if (u?.id) {
        return { property_id: normalizeUuid(u.property_id), unit_id: normalizeUuid(u.id) };
      }
    }
  } catch {
    // fall through — caller keeps its placeholder context
  }
  return {};
}

function addPositiveIds(target: Set<number>, ids: Array<number | undefined | null>) {
  for (const id of ids) {
    if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
      target.add(id);
    }
  }
}

function findMatchingPdcsRow(
  rows: any[],
  unitCode?: string,
  amount?: number,
  chequeDate?: string,
): any | null {
  if (!rows.length) return null;
  const normUnit = (unitCode || '').trim().toLowerCase();
  if (normUnit) {
    const byUnit = rows.filter(
      (r) => String(r.unit_name || '').trim().toLowerCase() === normUnit,
    );
    if (byUnit.length === 1) return byUnit[0];
    if (byUnit.length > 1) {
      const exact = byUnit.find(
        (r) =>
          (amount && Number(r.amount) === Number(amount)) &&
          (!chequeDate || String(r.maturity_date || '').slice(0, 10) === chequeDate.slice(0, 10)),
      );
      return exact ?? byUnit[0];
    }
    return null;
  }
  if (rows.length === 1) return rows[0];
  if (amount && Number(amount) > 0 && chequeDate) {
    const exact = rows.filter(
      (r) =>
        Number(r.amount) === Number(amount) &&
        String(r.maturity_date || '').slice(0, 10) === chequeDate.slice(0, 10),
    );
    if (exact.length === 1) return exact[0];
  }
  return null;
}

/** Fetch amount, tenant_id, property_id, unit_id and DB row IDs for a PDC from any source */
async function resolveGlContext(
  pdcId: string | number,
  chequeNo?: string,
  hints?: PdcContextHints,
): Promise<ResolvedPdcContext> {
  const parsed = parsePdcIdentifier(pdcId);
  const rawChq = String(chequeNo ?? (parsed.isSyntheticId ? '' : '')).trim() || String(chequeNo ?? pdcId);
  const targetFinId = parsed.finId ?? (hints?.finId && hints.finId > 0 ? hints.finId : undefined);
  const targetPdcsId =
    parsed.pdcsId ?? (hints?.pdcsId && UUID_RE.test(hints.pdcsId) ? hints.pdcsId : undefined);

  let finRow: any = null;
  let pdcRow: any = null;
  const finIdSet = new Set<number>();
  addPositiveIds(finIdSet, [targetFinId, ...(hints?.duplicateFinIds ?? [])]);

  // 1. Direct lookup on fin_pdc_register when we have a numeric or `fin-<id>` identifier
  if (targetFinId) {
    try {
      const { data } = await db
        .from('fin_pdc_register')
        .select(FIN_PDC_SELECT)
        .eq('id', targetFinId)
        .maybeSingle();
      if (data) finRow = data;
    } catch {
      // fall through
    }
  }

  // 2. Direct lookup on pdcs strictly using UUID ids (never pass `fin-...` or `pdc-local-...` into UUID eq)
  if (targetPdcsId) {
    try {
      const { data } = await db
        .from('pdcs')
        .select('id, sl_no, amount, unit_name, cheque_number, status, status_pdc, maturity_date, property_code, tenant_name, lease_id')
        .eq('id', targetPdcsId)
        .maybeSingle();
      if (data) pdcRow = data;
    } catch {
      // fall through
    }
  }

  // 3. Cross-resolve pdcs via finRow.original_pdc_id -> pdcs.sl_no, or cheque_number + disambiguator
  if (!pdcRow && finRow?.original_pdc_id != null) {
    try {
      const { data } = await db
        .from('pdcs')
        .select('id, sl_no, amount, unit_name, cheque_number, status, status_pdc, maturity_date, property_code, tenant_name, lease_id')
        .eq('sl_no', Number(finRow.original_pdc_id))
        .maybeSingle();
      if (data) pdcRow = data;
    } catch {
      // fall through
    }
  }

  const lookupChq = String(finRow?.cheque_number || pdcRow?.cheque_number || chequeNo || '').trim();
  const hintDate = hints?.chequeDate || hints?.maturityDate || finRow?.cheque_date;
  const hintAmt = finRow?.amount ? Number(finRow.amount) : hints?.amount;

  if (!pdcRow && lookupChq) {
    try {
      const { data: candidates } = await db
        .from('pdcs')
        .select('id, sl_no, amount, unit_name, cheque_number, status, status_pdc, maturity_date, property_code, tenant_name, lease_id')
        .eq('cheque_number', lookupChq)
        .limit(20);
      if (candidates?.length) {
        pdcRow = findMatchingPdcsRow(candidates, hints?.unitCode, hintAmt, hintDate);
      }
    } catch {
      // fall through
    }
  }

  // 4. Cross-resolve fin_pdc_register rows (by original_pdc_id or exact cheque_number + date + amount + unlinked scope)
  if (!finRow && pdcRow?.sl_no != null) {
    try {
      const { data } = await db
        .from('fin_pdc_register')
        .select(FIN_PDC_SELECT)
        .eq('original_pdc_id', Number(pdcRow.sl_no))
        .order('id', { ascending: true })
        .limit(10);
      if (data?.length) {
        finRow = data[0];
        addPositiveIds(finIdSet, data.map((r: any) => Number(r.id)));
      }
    } catch {
      // fall through
    }
  }

  if (lookupChq) {
    const matchAmt = Number(finRow?.amount || pdcRow?.amount || hints?.amount || 0);
    const matchDate = String(
      finRow?.cheque_date || pdcRow?.maturity_date || hints?.chequeDate || hints?.maturityDate || '',
    ).slice(0, 10);
    const finIsUnlinked =
      finRow &&
      finRow.tenant_id == null &&
      finRow.property_id == null &&
      finRow.unit_id == null &&
      finRow.original_pdc_id == null;

    if (!finRow || finIsUnlinked) {
      try {
        let q = db
          .from('fin_pdc_register')
          .select(FIN_PDC_SELECT)
          .eq('cheque_number', lookupChq);
        if (matchAmt > 0) q = q.eq('amount', matchAmt);
        if (matchDate) q = q.eq('cheque_date', matchDate);
        const { data: finMatches } = await q.order('id', { ascending: true }).limit(20);
        if (finMatches?.length) {
          const unlinkedMatches = finMatches.filter(
            (r: any) =>
              r.tenant_id == null &&
              r.property_id == null &&
              r.unit_id == null &&
              r.original_pdc_id == null,
          );
          if (!finRow) {
            const scopedPool =
              pdcRow?.sl_no != null
                ? finMatches.filter((r: any) => Number(r.original_pdc_id) === Number(pdcRow.sl_no))
                : unlinkedMatches;
            if (scopedPool.length) {
              finRow = scopedPool[0];
              addPositiveIds(finIdSet, scopedPool.map((r: any) => Number(r.id)));
            }
          } else if (finIsUnlinked && unlinkedMatches.length) {
            addPositiveIds(finIdSet, unlinkedMatches.map((r: any) => Number(r.id)));
          }
        }
      } catch {
        // fall through
      }
    }
  }

  if (finRow?.id) addPositiveIds(finIdSet, [Number(finRow.id)]);

  const effectiveChq =
    finRow?.cheque_number || pdcRow?.cheque_number || (chequeNo ? String(chequeNo) : rawChq);
  const derivedUnit =
    pdcRow?.unit_name ||
    hints?.unitCode ||
    (effectiveChq.includes('Flat') ? effectiveChq.split('-')[1] : undefined);

  const scope = await resolveUuidScope({
    leaseId: hints?.leaseId ?? pdcRow?.lease_id ?? finRow?.lease_id,
    unitCode: derivedUnit,
  });

  const resolvedAmount = Number(finRow?.amount || pdcRow?.amount || hints?.amount || 0);
  const resolvedMaturity =
    finRow?.cheque_date ||
    pdcRow?.maturity_date ||
    hints?.chequeDate ||
    hints?.maturityDate ||
    undefined;

  return {
    amount:        resolvedAmount,
    tenant_id:     normalizeUuid(hints?.tenantId)   || scope.tenant_id   || normalizeUuid(finRow?.tenant_id as any)   || '00000000-0000-0000-0000-000000000003',
    property_id:   normalizeUuid(hints?.propertyId) || scope.property_id || normalizeUuid(finRow?.property_id as any) || '00000000-0000-0000-0000-000000000001',
    unit_id:       normalizeUuid(hints?.unitId)     || scope.unit_id     || normalizeUuid(finRow?.unit_id as any)     || '00000000-0000-0000-0000-000000000002',
    cheque_number: effectiveChq,
    unitCode:      derivedUnit,
    pdcType:       'RENT_PDC' as PdcType,
    status:        finRow?.status || pdcRow?.status_pdc || pdcRow?.status || hints?.status || 'In Hand',
    maturity_date: resolvedMaturity,
    finId:         finRow?.id != null ? Number(finRow.id) : targetFinId,
    duplicateFinIds: Array.from(finIdSet),
    pdcId:         pdcRow?.id || targetPdcsId,
    sl_no:
      finRow?.original_pdc_id != null
        ? Number(finRow.original_pdc_id)
        : pdcRow?.sl_no != null
          ? Number(pdcRow.sl_no)
          : undefined,
    bank_id: finRow?.bank_id != null ? Number(finRow.bank_id) : undefined,
  };
}

// ── PDC Lifecycle Functions ───────────────────────────────────────────────────

/**
 * Event 1 — Cheque Receipt / Collection
 * Persists to fin_pdc_register + posts GL:
 *   RENT_PDC:    Dr 12900001 PDC In Hand          / Cr 21400[unit SL] PDC Received
 *   DEPOSIT_PDC: Dr 12900002 Deposit-PDC In Hand  / Cr 21500[unit SL] Deposit
 */
export async function receivePdc(payload: {
  cheque_number:  string;
  cheque_date:    string;
  amount:         number;
  tenant_id:      string | number;
  property_id:    string | number;
  unit_id:        string | number;
  bank_id?:       string | number;
  unitCode?:      string;
  lease_id?:      string | number;
  original_pdc_id?: number;
  /** Whether this PDC is for rent or a deposit. Defaults to 'RENT_PDC'. */
  pdcType?:       PdcType;
  /** When true, a failed register insert or GL posting throws instead of only logging a warning. */
  strict?:        boolean;
}) {
  // Helper to ensure values inserted into bigint columns of fin_pdc_register are purely numeric
  const toBigintOrUndefined = (val: string | number | undefined | null): string | undefined => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim();
    return /^\d+$/.test(s) ? s : undefined;
  };

  const targetBankId = toBigintOrUndefined(payload.bank_id);
  const targetUnitId = toBigintOrUndefined(payload.unit_id);

  // Deduplicate active fin_pdc_register entries so re-saving/renewing does not spawn duplicates
  try {
    const { data: existingRows } = await db
      .from('fin_pdc_register')
      .select(FIN_PDC_SELECT)
      .eq('cheque_number', payload.cheque_number)
      .eq('cheque_date', payload.cheque_date)
      .eq('amount', payload.amount)
      .order('id', { ascending: true })
      .limit(10);

    const activeExisting = (existingRows || []).find((r: any) => {
      const st = String(r.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'returned') return false;
      // Same cheque on a different lease is a different PDC, even when the amount and date match.
      if (payload.lease_id != null && r.lease_id != null && String(r.lease_id) !== String(payload.lease_id)) return false;
      if (payload.original_pdc_id != null && r.original_pdc_id != null) {
        return Number(r.original_pdc_id) === Number(payload.original_pdc_id);
      }
      if (targetUnitId && r.unit_id != null && String(r.unit_id) !== targetUnitId) {
        return false;
      }
      if (!targetUnitId && payload.original_pdc_id == null && r.original_pdc_id != null) {
        return false;
      }
      return true;
    });

    if (activeExisting) {
      if (targetBankId && activeExisting.bank_id == null) {
        await db
          .from('fin_pdc_register')
          .update({ bank_id: Number(targetBankId) })
          .eq('id', activeExisting.id);
        activeExisting.bank_id = Number(targetBankId);
      }
      return activeExisting;
    }
  } catch (dedupErr: any) {
    console.warn('[receivePdc] dedup check notice:', dedupErr?.message || dedupErr);
  }

  // 1. Persist to PDC Register (fin_pdc_register uses bigint foreign keys; omit lease_id absent from schema)
  let pdc: any = null;
  try {
    pdc = await FinPdcRegisterApi.create({
      cheque_number: payload.cheque_number,
      cheque_date:   payload.cheque_date,
      amount:        payload.amount,
      tenant_id:     toBigintOrUndefined(payload.tenant_id),
      property_id:   toBigintOrUndefined(payload.property_id),
      unit_id:       targetUnitId,
      bank_id:       targetBankId,
      lease_id:      payload.lease_id != null ? String(payload.lease_id) : undefined,
      status:        'In Hand',
      ...(payload.original_pdc_id != null ? { original_pdc_id: payload.original_pdc_id } : {}),
    });
  } catch (err: any) {
    if (payload.strict) throw err;
    console.warn('[receivePdc] fin_pdc_register insert notice:', err?.message || err);
  }

  // 2. Post GL entry with correct SL codes (accepts UUID and string names)
  try {
    await postPdcCollection(
      payload.amount,
      payload.tenant_id as any,
      payload.property_id as any,
      payload.unit_id as any,
      payload.cheque_number,
      payload.unitCode,
      (payload as any).pdcType || 'RENT',
      payload.lease_id,
    );
  } catch (err: any) {
    if (payload.strict) throw err;
    console.warn('[receivePdc] GL posting notice:', err?.message || err);
  }

  return pdc;
}

interface FinRegisterStatusUpdate {
  status: string;
  deposit_date?: string;
  cleared_date?: string;
  returned_date?: string;
  bank_id?: number;
}

async function findFallbackFinIds(ctx: ResolvedPdcContext): Promise<number[]> {
  try {
    if (ctx.sl_no != null) {
      const { data } = await db
        .from('fin_pdc_register')
        .select('id')
        .eq('original_pdc_id', ctx.sl_no)
        .limit(10);
      if (data?.length) return data.map((r: any) => Number(r.id)).filter((n: any) => n > 0);
    }
    if (ctx.cheque_number && ctx.amount > 0) {
      let q = db
        .from('fin_pdc_register')
        .select('id, tenant_id, property_id, unit_id, original_pdc_id')
        .eq('cheque_number', ctx.cheque_number)
        .eq('amount', ctx.amount);
      if (ctx.maturity_date) {
        q = q.eq('cheque_date', String(ctx.maturity_date).slice(0, 10));
      }
      const { data } = await q.limit(10);
      if (data?.length) {
        const unlinked = data.filter(
          (r: any) =>
            r.tenant_id == null &&
            r.property_id == null &&
            r.unit_id == null &&
            r.original_pdc_id == null,
        );
        const target = unlinked.length ? unlinked : data.length === 1 ? data : [];
        return target.map((r: any) => Number(r.id)).filter((n: any) => n > 0);
      }
    }
  } catch {
    // fall through
  }
  return [];
}

/**
 * Update a single `fin_pdc_register` row using the transactional
 * `fin_manual_pdc_status_update` RPC (so `app.pdc_manual_clear` runs inside
 * the same DB transaction for `Cleared`), falling back strictly when the RPC
 * is not deployed yet and verifying the resulting status was not reverted.
 */
async function updateSingleFinRegisterRow(
  finId: number,
  finUpdates: FinRegisterStatusUpdate,
  chequeNumber: string,
) {
  const { data: rpcRow, error: rpcErr } = await db.rpc('fin_manual_pdc_status_update', {
    p_pdc_id:        finId,
    p_status:        finUpdates.status,
    p_deposit_date:  finUpdates.deposit_date ?? null,
    p_cleared_date:  finUpdates.cleared_date ?? null,
    p_returned_date: finUpdates.returned_date ?? null,
    p_bank_id:       finUpdates.bank_id ?? null,
  });

  if (!rpcErr) {
    const savedStatus = String((rpcRow as any)?.status || '').toLowerCase();
    if (finUpdates.status.toLowerCase() === 'cleared' && savedStatus !== 'cleared') {
      throw new Error(`Cheque ${chequeNumber} status update to Cleared was reverted by database guard.`);
    }
    return;
  }

  const errMsg = String(rpcErr.message || '');
  const isMissingRpc =
    (rpcErr as any).code === 'PGRST202' ||
    /fin_manual_pdc_status_update|schema cache|Could not find the function/i.test(errMsg);

  if (!isMissingRpc) {
    throw new Error(`Failed to update fin_pdc_register #${finId} (${chequeNumber}): ${errMsg}`);
  }

  const directPayload: Record<string, any> = { status: finUpdates.status };
  if (finUpdates.deposit_date !== undefined) directPayload.deposit_date = finUpdates.deposit_date;
  if (finUpdates.cleared_date !== undefined) directPayload.cleared_date = finUpdates.cleared_date;
  if (finUpdates.returned_date !== undefined) directPayload.returned_date = finUpdates.returned_date;
  if (finUpdates.bank_id !== undefined) directPayload.bank_id = finUpdates.bank_id;

  const { data: updatedRow, error: updErr } = await db
    .from('fin_pdc_register')
    .update(directPayload)
    .eq('id', finId)
    .select('id, status')
    .maybeSingle();

  if (updErr) {
    throw new Error(`Failed to update fin_pdc_register #${finId} (${chequeNumber}): ${updErr.message}`);
  }
  if (!updatedRow) {
    throw new Error(`PDC register row #${finId} (${chequeNumber}) could not be updated in fin_pdc_register.`);
  }
  if (
    finUpdates.status.toLowerCase() === 'cleared' &&
    String(updatedRow.status || '').toLowerCase() !== 'cleared'
  ) {
    throw new Error(
      `Manual clear for cheque ${chequeNumber} was reverted by DB trigger trg_fin_guard_pdc_auto_clear. Apply migration 20261112000000_fix_pdc_manual_clear_and_os41_06.sql to enable fin_manual_pdc_status_update.`,
    );
  }
}

/** Persist PDC status transitions across resolved `fin_pdc_register` rows and UUID `pdcs` row. */
async function persistPdcStatusUpdate(args: {
  ctx: ResolvedPdcContext;
  pdcId: number | string;
  finUpdates: FinRegisterStatusUpdate;
  legacyUpdates: Record<string, any>;
}) {
  const { ctx, pdcId, finUpdates, legacyUpdates } = args;
  const parsed = parsePdcIdentifier(pdcId);
  const finIdSet = new Set<number>(ctx.duplicateFinIds ?? []);
  if (ctx.finId) finIdSet.add(ctx.finId);
  if (parsed.finId) finIdSet.add(parsed.finId);

  const finIdsToUpdate = finIdSet.size > 0 ? Array.from(finIdSet) : await findFallbackFinIds(ctx);
  for (const fid of finIdsToUpdate) {
    await updateSingleFinRegisterRow(fid, finUpdates, ctx.cheque_number);
  }

  const targetPdcsId =
    parsed.pdcsId || (ctx.pdcId && UUID_RE.test(ctx.pdcId) ? ctx.pdcId : undefined);
  if (targetPdcsId) {
    const { error: legacyErr } = await db
      .from('pdcs')
      .update(legacyUpdates)
      .eq('id', targetPdcsId);
    if (legacyErr) {
      throw new Error(`Failed to update pdcs row ${targetPdcsId} (${ctx.cheque_number}): ${legacyErr.message}`);
    }
  }
}

/**
 * Event 2 — Cheque Deposit to Bank
 * Updates status to Deposited + posts two GL entries:
 *   Entry A: Dr 12000001 Bank / Cr 12900001 PDC In Hand
 *   Entry B: Dr 21400[unit SL] PDC Received / Cr 12413[unit SL] Tenant Receivable
 */
export interface DepositPdcOptions extends PdcContextHints {
  bankAccountId?: string;
  bankAccountName?: string;
  bankAccountCode?: string;
  depositDate?: string;
  depositSlipNo?: string;
}

export async function depositPdc(
  pdcId: number | string,
  chequeNo?: string,
  options?: DepositPdcOptions,
) {
  const today = options?.depositDate || new Date().toISOString().split('T')[0];
  const ctx = await resolveGlContext(pdcId, chequeNo, options);
  const status = (ctx.status || '').toLowerCase();

  if (!ctx.amount) throw new Error(`PDC ${ctx.cheque_number} has no valid amount.`);
  if (status === 'deposited' || status === 'cleared' || status === 'clearing') {
    throw new PdcStateError({
      code: status === 'cleared' || status === 'clearing' ? 'PDC_ALREADY_CLEARED' : 'PDC_ALREADY_DEPOSITED',
      pdcId, chequeNumber: ctx.cheque_number, currentStatus: ctx.status,
      message: `PDC ${ctx.cheque_number} is already ${ctx.status}.`,
    });
  }
  if (status === 'cancelled') {
    throw new PdcStateError({
      code: 'PDC_ALREADY_CANCELLED',
      pdcId, chequeNumber: ctx.cheque_number, currentStatus: ctx.status,
      message: `PDC ${ctx.cheque_number} is in terminal state '${ctx.status}'.`,
    });
  }

  // Accounting GL posting (non-blocking if trigger/RLS notice occurs)
  try {
    // Entry A ONLY at deposit time: Dr Bank / Cr Rent PDC In Hand.
    // Entry B (Dr PDC Received [unit SL] / Cr Tenant Receivable [unit SL]) is posted at clearPdc time.
    await postPdcDepositToBank(
      ctx.amount, ctx.tenant_id, ctx.property_id, ctx.unit_id,
      ctx.cheque_number, ctx.unitCode, ctx.pdcType,
      options?.bankAccountCode ? {
        code: options.bankAccountCode,
        name: options.bankAccountName || 'Bank Operating Account',
        id: options.bankAccountId,
      } : undefined,
    );
  } catch (glErr: any) {
    console.warn('[depositPdc] GL deposit notice:', glErr?.message || glErr);
  }

  const finBankId =
    options?.bankAccountId && /^\d+$/.test(String(options.bankAccountId))
      ? Number(options.bankAccountId)
      : ctx.bank_id;

  const legacyUpdate: Record<string, any> = {
    status: 'deposited',
    status_pdc: 'deposited',
    deposit_date: today,
  };
  if (options?.bankAccountName) {
    legacyUpdate.bank = options.bankAccountName;
  }

  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: {
      status: 'Deposited',
      deposit_date: today,
      ...(finBankId != null ? { bank_id: finBankId } : {}),
    },
    legacyUpdates: legacyUpdate,
  });
}

export interface ClearPdcOptions extends PdcContextHints {
  bankAccountId?: string;
  bankAccountName?: string;
  bankAccountCode?: string;
  depositDate?: string;
  clearedDate?: string;
}

/**
 * Event 3 — Cheque Cleared by Bank
 * Updates status to Cleared + posts GL:
 *   Dr 21400[unit SL] PDC Received / Cr 12413[unit SL] Tenant Receivable
 */
export async function clearPdc(
  pdcId: number | string,
  chequeNo?: string,
  options?: ClearPdcOptions,
) {
  const clearDate = options?.clearedDate || new Date().toISOString().split('T')[0];
  const depositDate = options?.depositDate || clearDate;
  const ctx = await resolveGlContext(pdcId, chequeNo, options);
  const status = (ctx.status || '').toLowerCase();

  if (!ctx.amount) throw new Error(`PDC ${ctx.cheque_number} has no valid amount.`);
  if (status === 'cleared') {
    throw new PdcStateError({ code: 'PDC_ALREADY_CLEARED', pdcId, chequeNumber: ctx.cheque_number, currentStatus: ctx.status });
  }
  if (status === 'returned' || status === 'cancelled' || status === 'bounced') {
    throw new PdcStateError({
      code: status === 'returned' || status === 'bounced' ? 'PDC_ALREADY_RETURNED' : 'PDC_ALREADY_CANCELLED',
      pdcId, chequeNumber: ctx.cheque_number, currentStatus: ctx.status,
      message: `PDC ${ctx.cheque_number} is in terminal state '${ctx.status}' and cannot be cleared.`,
    });
  }

  const finBankId =
    options?.bankAccountId && /^\d+$/.test(String(options.bankAccountId))
      ? Number(options.bankAccountId)
      : ctx.bank_id;

  // If cheque is still "In Hand" or "Received", post the deposit-to-bank GL leg first.
  if (status !== 'deposited' && status !== 'clearing') {
    try {
      await postPdcDepositToBank(
        ctx.amount, ctx.tenant_id, ctx.property_id, ctx.unit_id,
        ctx.cheque_number, ctx.unitCode, ctx.pdcType,
        options?.bankAccountCode ? {
          code: options.bankAccountCode,
          name: options.bankAccountName || 'Bank Operating Account',
          id: options.bankAccountId,
        } : undefined,
      );
    } catch (glErr: any) {
      console.warn('[clearPdc] GL deposit notice:', glErr?.message || glErr);
    }

    await persistPdcStatusUpdate({
      ctx,
      pdcId,
      finUpdates: {
        status: 'Deposited',
        deposit_date: depositDate,
        ...(finBankId != null ? { bank_id: finBankId } : {}),
      },
      legacyUpdates: {
        status: 'deposited',
        status_pdc: 'deposited',
        deposit_date: depositDate,
        ...(options?.bankAccountName ? { bank: options.bankAccountName } : {}),
      },
    });
  }

  try {
    await postPdcClear(
      ctx.amount, ctx.tenant_id, ctx.property_id, ctx.unit_id,
      ctx.cheque_number, ctx.unitCode, ctx.pdcType,
    );
  } catch (glErr: any) {
    console.warn('[clearPdc] GL clear notice:', glErr?.message || glErr);
  }

  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: {
      status: 'Cleared',
      cleared_date: clearDate,
      ...(status !== 'deposited' && status !== 'clearing' ? { deposit_date: depositDate } : {}),
      ...(finBankId != null ? { bank_id: finBankId } : {}),
    },
    legacyUpdates: {
      status: 'cleared',
      status_pdc: 'cleared',
      ...(options?.bankAccountName ? { bank: options.bankAccountName } : {}),
    },
  });
}

/**
 * Event 6A — Cheque Return (unpresented PDC returned to tenant)
 * Applicable ONLY when PDC is in physical custody (IN_HAND / RECEIVED).
 * Posts GL:
 *   Dr 21400[unit SL] PDC Received / Cr 12900001 PDC In Hand
 *
 * Strict custody check: throws PdcStateError if the PDC has been Deposited
 * or Cleared. In that case, callers must route through bouncePdc() so the
 * bank leg + AR reclass are posted correctly.
 */
export async function returnPdc(
  pdcId: number | string,
  chequeNo?: string,
  options?: PdcContextHints,
) {
  const today = new Date().toISOString().split('T')[0];

  // 1. Resolve GL context first to validate existence & status
  const ctx = await resolveGlContext(pdcId, chequeNo, options);

  // 2. Strict status guard. Only PDC still in physical custody may be returned
  //    via this path. Any later state must go through bouncePdc() so that the
  //    bank clawback and AR reclassification lines are posted.
  const normalizedStatus = (ctx.status || '').toLowerCase();
  if (normalizedStatus === 'deposited' || normalizedStatus === 'cleared' || normalizedStatus === 'clearing') {
    throw new PdcStateError({
      code: normalizedStatus === 'cleared' || normalizedStatus === 'clearing'
        ? 'PDC_ALREADY_CLEARED'
        : 'PDC_ALREADY_DEPOSITED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message:
        `Cannot execute physical PDC return for cheque ${ctx.cheque_number} ` +
        `because status is '${ctx.status}'. Use bouncePdc() for the bank-dishonour flow.`,
    });
  }
  if (normalizedStatus === 'returned') {
    throw new PdcStateError({
      code: 'PDC_ALREADY_RETURNED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message: `Cheque ${ctx.cheque_number} has already been returned.`,
    });
  }
  if (normalizedStatus === 'cancelled') {
    throw new PdcStateError({
      code: 'PDC_ALREADY_CANCELLED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message: `Cheque ${ctx.cheque_number} has already been cancelled.`,
    });
  }

  // 2. Perform GL posting
  if (ctx.amount > 0) {
    try {
      await postPdcReturn(
        ctx.amount,
        ctx.tenant_id,
        ctx.property_id,
        ctx.unit_id,
        ctx.cheque_number,
        ctx.unitCode,
        ctx.pdcType,
      );
    } catch (e: any) {
      console.warn('[returnPdc] GL notice:', e?.message || e);
    }
  }

  // 3. Update status to Returned (NOT bounced) across resolved register & legacy PDC rows
  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: { status: 'Returned', returned_date: today },
    legacyUpdates: { status: 'returned', status_pdc: 'returned' },
  });
}

/**
 * Event 6B — Cheque Bounce / Dishonour (after bank presentation/clearance)
 * Updates status to Bounced + posts the workflow-segregated dishonour voucher:
 *
 *   Pre-clearance dishonour (status = Deposited):
 *     Entry 1: Dr 12900 PDC In Hand        / Cr 12000 Bank           (reverse the
 *              pending deposit — the cheque never reached AR)
 *     Entry 2: Dr 12413 Tenant AR [unit SL]/ Cr 21400 PDC Received    (restore
 *              the tenant receivable that PDC collection had parked)
 *
 *   Post-clearance dishonour (status = Cleared):
 *     Entry 1: Dr 12413 Tenant AR [unit SL]/ Cr 12000 Bank            (PDC is
 *              already gone from 21400 and the bank credited us — we now
 *              claw the bank back AND re-establish tenant AR directly)
 *     Separate dishonour recovery / expense lines are posted by
 *     postDishonourFee() if the operator chooses tenant-recoverable or
 *     company-borne treatment for the bank charge.
 *
 * State guard: throws PdcStateError if PDC is still in physical custody (In Hand /
 * Received). In that case the caller must use returnPdc() instead.
 */
export async function bouncePdc(
  pdcId: number | string,
  chequeNo?: string,
  reason?: string,
  options?: PdcContextHints,
) {
  const today = new Date().toISOString().split('T')[0];

  const ctx = await resolveGlContext(pdcId, chequeNo, options);

  // ── State guard ──────────────────────────────────────────────────────────
  // Bounce is only valid for cheques that have left physical custody (Deposited /
  // Cleared / Clearing). A cheque still in custody must be returned via returnPdc().
  const normalizedStatus = (ctx.status || '').toLowerCase();
  if (normalizedStatus === 'in hand' || normalizedStatus === 'received') {
    throw new PdcStateError({
      code: 'PDC_NOT_FOUND',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message:
        `Cannot bounce cheque ${ctx.cheque_number} in custody state '${ctx.status}'. ` +
        `Use returnPdc() for the physical-custody return path.`,
    });
  }
  if (normalizedStatus === 'returned' || normalizedStatus === 'bounced') {
    throw new PdcStateError({
      code: 'PDC_ALREADY_RETURNED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message: `Cheque ${ctx.cheque_number} has already been ${ctx.status}.`,
    });
  }
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'replaced') {
    throw new PdcStateError({
      code: 'PDC_ALREADY_CANCELLED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message: `Cheque ${ctx.cheque_number} is in terminal state '${ctx.status}'.`,
    });
  }

  const isPostClearance =
    normalizedStatus === 'cleared' || normalizedStatus === 'clearing';

  if (ctx.amount > 0) {
    if (!isPostClearance) {
      // ── Pre-clearance: PDC still parked in 21400 — bank deposited but didn't
      //    clear. Reverse both legs to restore the tenant receivable.
      const { debit: pdcHandAcct, credit: bankAcct } = await resolveAccountingAccounts({
        transactionType: 'CHEQUE_RETURN_BANK_REVERSAL',
        pdcType: ctx.pdcType,
        paymentMethod: 'BANK',
        propertyId: String(ctx.property_id),
        unitId: ctx.unit_id ? String(ctx.unit_id) : undefined,
        tenantId: ctx.tenant_id ? String(ctx.tenant_id) : undefined,
        unitName: ctx.unitCode,
      });

      const { debit: arAcct, credit: custPdcAcct } = await resolveAccountingAccounts({
        transactionType: 'CHEQUE_RETURN_AR_RECLASS',
        pdcType: ctx.pdcType,
        propertyId: String(ctx.property_id),
        unitId: ctx.unit_id ? String(ctx.unit_id) : undefined,
        tenantId: ctx.tenant_id ? String(ctx.tenant_id) : undefined,
        unitName: ctx.unitCode,
      });

      await postVoucher({
        voucher_date: today,
        voucher_type: 'Journal',
        description:
          `PDC Pre-Clearance Dishonour – ${ctx.cheque_number}` +
          `${reason ? ` (${reason})` : ''}`,
        reference_no: `RET-${ctx.cheque_number}`,
        tenant_id: ctx.tenant_id,
        property_id: ctx.property_id,
        unit_id: ctx.unit_id,
        lines: [
          // Entry 1 — Reverse the bank deposit (Dr PDC In Hand / Cr Bank)
          { account_code: pdcHandAcct.slCode, account_name: `${pdcHandAcct.glName} / ${pdcHandAcct.slName}`, debit: ctx.amount, credit: 0, description: `PDC In Hand – ${pdcHandAcct.slName}` },
          { account_code: bankAcct.slCode, account_name: `${bankAcct.glName} / ${bankAcct.slName}`, debit: 0, credit: ctx.amount, description: `Bank Account – ${bankAcct.slName}` },
          // Entry 2 — Restore tenant receivable (Dr AR / Cr PDC Received)
          { account_code: arAcct.slCode, account_name: `${arAcct.glName} / ${arAcct.slName}`, debit: ctx.amount, credit: 0, description: `Receivable - Unit Account – ${arAcct.slName}` },
          { account_code: custPdcAcct.slCode, account_name: `${custPdcAcct.glName} / ${custPdcAcct.slName}`, debit: 0, credit: ctx.amount, description: `Customer(PDC) - Unit Account – ${custPdcAcct.slName}` },
        ],
      });
    } else {
      // ── Post-clearance: PDC is gone from 21400 (cleared into AR reduction /
      //    bank credit). Bank clawback goes directly to Tenant AR (Dr 12413 /
      //    Cr 12000). The PDC Received (21400) leg is intentionally absent —
      //    it was already zeroed by the original clear entry.
      const { debit: arAcct, credit: bankAcct } = await resolveAccountingAccounts({
        transactionType: 'CHEQUE_RETURN_AR_RECLASS',
        pdcType: ctx.pdcType,
        paymentMethod: 'BANK',
        propertyId: String(ctx.property_id),
        unitId: ctx.unit_id ? String(ctx.unit_id) : undefined,
        tenantId: ctx.tenant_id ? String(ctx.tenant_id) : undefined,
        unitName: ctx.unitCode,
      });

      await postVoucher({
        voucher_date: today,
        voucher_type: 'Journal',
        description:
          `PDC Post-Clearance Dishonour – ${ctx.cheque_number}` +
          `${reason ? ` (${reason})` : ''}`,
        reference_no: `RET-PC-${ctx.cheque_number}`,
        tenant_id: ctx.tenant_id,
        property_id: ctx.property_id,
        unit_id: ctx.unit_id,
        lines: [
          // Single entry — restore AR and claw back the bank credit
          { account_code: arAcct.slCode, account_name: `${arAcct.glName} / ${arAcct.slName}`, debit: ctx.amount, credit: 0, description: `Receivable - Unit Account – ${arAcct.slName}` },
          { account_code: bankAcct.slCode, account_name: `${bankAcct.glName} / ${bankAcct.slName}`, debit: 0, credit: ctx.amount, description: `Bank Account – ${bankAcct.slName}` },
        ],
      });
    }
  }

  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: { status: 'Bounced', returned_date: today },
    legacyUpdates: { status: 'bounced', status_pdc: 'bounced' },
  });
}

/**
 * Event 4 — Cash Deposit in place of PDC
 * Marks the cheque as replaced by cash + posts GL:
 *   Dr Bank Account (12000), Cr Cash In Hand (12100)
 */
export interface CashSettlementPayload {
  pdcId: string | number;
  chequeNo?: string;
  confirmedAmount?: number;
  notes?: string;
  settlementDate?: string;
  collectorName?: string;
}

/**
 * Event 4 — Cash Settlement in Place of PDC
 * 1. Returns the held PDC: Dr 21400[unit SL] / Cr 12900001
 * 2. Receives Cash against AR: Dr 12100[unit SL] / Cr 12413[unit SL]
 */
export async function cashDepositInPlaceOfPdc(
  pdcId: string | number,
  chequeNo?: string,
  confirmedAmount?: number,
  notes?: string,
  settlementDate?: string,
  collectorName?: string,
  options?: PdcContextHints,
) {
  const dateStr = settlementDate || new Date().toISOString().split('T')[0];
  const newStatus = 'replaced';

  // 1. Resolve context
  const ctx = await resolveGlContext(pdcId, chequeNo, options);
  const finalAmt = (confirmedAmount !== undefined && confirmedAmount > 0) ? confirmedAmount : ctx.amount;

  // 2. Perform financial postings
  if (finalAmt > 0) {
    // Step 1: Cash In Hand (Debit) / Receivable - Unit Account (Credit)
    const { debit: cashAcct, credit: arAcct } = await resolveAccountingAccounts({
      transactionType: 'RENT_RECEIPT',
      paymentMethod: 'CASH',
      propertyId: String(ctx.property_id),
      unitId: ctx.unit_id ? String(ctx.unit_id) : undefined,
      tenantId: ctx.tenant_id ? String(ctx.tenant_id) : undefined,
      unitName: ctx.unitCode,
    });

    await postVoucher({
      voucher_date: dateStr,
      voucher_type: 'Receipt',
      description: `Cash received at counter for Unit AR in place of PDC ${ctx.cheque_number}${notes ? ` – ${notes}` : ''}`,
      reference_no: `CSH-REC-${ctx.cheque_number}`,
      tenant_id: ctx.tenant_id,
      property_id: ctx.property_id,
      unit_id: ctx.unit_id,
      lines: [
        { account_code: cashAcct.slCode, account_name: `${cashAcct.glName} / ${cashAcct.slName}`, debit: finalAmt, credit: 0, description: `Cash In Hand – ${cashAcct.slName}` },
        { account_code: arAcct.slCode, account_name: `${arAcct.glName} / ${arAcct.slName}`, debit: 0, credit: finalAmt, description: `Receivable- Unit Account – ${arAcct.slName}` },
      ],
    });

    // Step 2: Customer(PDC) - Unit Account (Debit) / PDC In Hand (Credit)
    await postPdcReturn(
      finalAmt,
      ctx.tenant_id,
      ctx.property_id,
      ctx.unit_id,
      ctx.cheque_number,
      ctx.unitCode,
      ctx.pdcType,
    );
    // Note: Cash collected in place of a cancelled PDC remains in Cash In Hand (12100001)
    // and is deposited to the bank separately when cash till deposits are made.
  }

  // 3. Update registers across resolved fin_pdc_register & pdcs rows
  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: { status: 'Replaced', deposit_date: dateStr },
    legacyUpdates: { status: newStatus, status_pdc: newStatus, deposit_date: dateStr },
  });
}

/**
 * Event 4b — Bank Transfer Settlement in Place of PDC
 * 1. Direct Bank Receipt against AR: Dr [Bank Account GL] / Cr 12413[unit SL]
 * 2. Returns the cancelled PDC from custody: Dr 21400[unit SL] / Cr 12900001
 * 3. Updates register statuses and transaction metadata
 */
export async function bankTransferInPlaceOfPdc(
  pdcId: string | number,
  chequeNo?: string,
  confirmedAmount?: number,
  notes?: string,
  settlementDate?: string,
  bankDetails?: {
    bankAccountId?: string;
    bankName?: string;
    accountTitle?: string;
    accountNumber?: string;
    iban?: string;
    glCode?: string;
    glName?: string;
    transferRef?: string;
    remittingBank?: string;
  },
  options?: PdcContextHints,
) {
  const dateStr = settlementDate || new Date().toISOString().split('T')[0];
  const newStatus = 'replaced';

  // 1. Resolve context
  const ctx = await resolveGlContext(pdcId, chequeNo, options);
  const finalAmt = (confirmedAmount !== undefined && confirmedAmount > 0) ? confirmedAmount : ctx.amount;

  // 2. Perform financial postings
  if (finalAmt > 0) {
    const { credit: arAcct } = await resolveAccountingAccounts({
      transactionType: 'RENT_RECEIPT',
      paymentMethod: 'BANK',
      propertyId: String(ctx.property_id),
      unitId: ctx.unit_id ? String(ctx.unit_id) : undefined,
      tenantId: ctx.tenant_id ? String(ctx.tenant_id) : undefined,
      unitName: ctx.unitCode,
    });

    const bankGlCode = bankDetails?.glCode || '12000001';
    const bankGlName = bankDetails?.accountTitle || bankDetails?.glName || 'Commercial Bank of Qatar (CBQ)';

    // Step 1: Direct Bank Receipt (Debit: Selected Bank / Credit: Receivable Unit Account)
    await postVoucher({
      voucher_date: dateStr,
      voucher_type: 'Receipt',
      description: `Bank transfer received for Unit AR in place of PDC ${ctx.cheque_number} into ${bankGlName}${bankDetails?.transferRef ? ` [Ref: ${bankDetails.transferRef}]` : ''}${notes ? ` – ${notes}` : ''}`,
      reference_no: bankDetails?.transferRef || `TRF-REC-${ctx.cheque_number}`,
      tenant_id: ctx.tenant_id,
      property_id: ctx.property_id,
      unit_id: ctx.unit_id,
      lines: [
        { account_code: bankGlCode, account_name: bankGlName, debit: finalAmt, credit: 0, description: `Bank Transfer Received – ${bankGlName}` },
        { account_code: arAcct.slCode, account_name: `${arAcct.glName} / ${arAcct.slName}`, debit: 0, credit: finalAmt, description: `Receivable - Unit Account – ${arAcct.slName}` },
      ],
    });

    // Step 2: Cancel PDC Custody (Debit: Customer PDC Liability / Credit: PDC In Hand)
    await postPdcReturn(
      finalAmt,
      ctx.tenant_id,
      ctx.property_id,
      ctx.unit_id,
      ctx.cheque_number,
      ctx.unitCode,
      ctx.pdcType,
    );
  }

  // 3. Update registers across resolved fin_pdc_register & pdcs rows
  const finBankId =
    bankDetails?.bankAccountId && /^\d+$/.test(String(bankDetails.bankAccountId))
      ? Number(bankDetails.bankAccountId)
      : ctx.bank_id;

  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: {
      status: 'Replaced',
      deposit_date: dateStr,
      ...(finBankId != null ? { bank_id: finBankId } : {}),
    },
    legacyUpdates: {
      status: newStatus,
      status_pdc: newStatus,
      deposit_date: dateStr,
      ...(bankDetails?.bankName ? { bank: bankDetails.bankName } : {}),
    },
  });
}

/**
 * Event 7 — Voluntary PDC Cancellation
 * Marks the cheque as Cancelled + posts GL reversal:
 *   Dr 21400[unit SL] PDC Received / Cr 12900001 PDC In Hand
 *
 * State guard: throws PdcStateError if PDC has already been deposited/cleared.
 * In that case, cancellation is not valid — use returnPdc() (if still in custody)
 * or bouncePdc() (if at bank).
 */
export async function cancelPdc(
  pdcId: number | string,
  chequeNo?: string,
  reason?: string,
  options?: PdcContextHints,
) {
  // 0. State guard — cancellation is only valid for physical-custody PDCs.
  const ctx = await resolveGlContext(pdcId, chequeNo, options);
  const normalizedStatus = (ctx.status || '').toLowerCase();
  if (
    normalizedStatus === 'deposited' ||
    normalizedStatus === 'cleared' ||
    normalizedStatus === 'clearing'
  ) {
    throw new PdcStateError({
      code:
        normalizedStatus === 'cleared' || normalizedStatus === 'clearing'
          ? 'PDC_ALREADY_CLEARED'
          : 'PDC_ALREADY_DEPOSITED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message:
        `Cannot cancel cheque ${ctx.cheque_number} in state '${ctx.status}'. ` +
        `Use bouncePdc() for the bank-dishonour flow or returnPdc() for physical return.`,
    });
  }
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'returned' || normalizedStatus === 'bounced' || normalizedStatus === 'replaced') {
    throw new PdcStateError({
      code:
        normalizedStatus === 'cancelled' || normalizedStatus === 'replaced'
          ? 'PDC_ALREADY_CANCELLED'
          : 'PDC_ALREADY_RETURNED',
      pdcId,
      chequeNumber: ctx.cheque_number,
      currentStatus: ctx.status,
      message: `Cheque ${ctx.cheque_number} is already in terminal state '${ctx.status}'.`,
    });
  }

  await persistPdcStatusUpdate({
    ctx,
    pdcId,
    finUpdates: { status: 'Cancelled' },
    legacyUpdates: { status: 'cancelled', status_pdc: 'cancelled' },
  });

  // ── GL posting ───────────────────────────────────────────────────────────
  try {
    // Reuse ctx resolved at the top for the state guard.
    if (ctx.amount > 0) {
      await postPdcCancel(
        ctx.amount,
        ctx.tenant_id,
        ctx.property_id,
        ctx.unit_id,
        ctx.cheque_number,
        reason,
        ctx.unitCode,
        ctx.pdcType,
      );
    }
  } catch (err) {
    console.error('[cancelPdc] GL posting failed:', err);
  }
}

/**
 * Event 7 — Post Bank Dishonour Fee / Charges
 * Absorbed by Company: Dr 51105001 Bank Charges / Cr 12000001 Bank
 * Recovered from Tenant: Dr 12413[unit SL] Tenant AR / Cr 41201007 Dishonour Recovery
 */
export async function postDishonourFee(payload: {
  feeAmount: number;
  borneBy: 'COMPANY' | 'TENANT';
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  chequeNumber: string;
  unitCode?: string;
}) {
  if (payload.feeAmount <= 0) return;
  const today = new Date().toISOString().split('T')[0];

  if (payload.borneBy === 'COMPANY') {
    const { debit: expAcct, credit: bankAcct } = await resolveAccountingAccounts({
      transactionType: 'DISHONOUR_CHARGE_COMPANY',
      paymentMethod: 'BANK',
      propertyId: payload.propertyId,
    });

    await postVoucher({
      voucher_date: today,
      voucher_type: 'Payment',
      description: `Bank Dishonour Charge (Company Borne) – Cheque ${payload.chequeNumber}`,
      reference_no: `BNK-CHG-${payload.chequeNumber}`,
      property_id: payload.propertyId,
      lines: [
        { account_code: expAcct.slCode, account_name: `${expAcct.glName} / ${expAcct.slName}`, debit: payload.feeAmount, credit: 0, description: expAcct.slName },
        { account_code: bankAcct.slCode, account_name: `${bankAcct.glName} / ${bankAcct.slName}`, debit: 0, credit: payload.feeAmount, description: bankAcct.slName },
      ],
    });
  } else {
    const { debit: arAcct, credit: revAcct } = await resolveAccountingAccounts({
      transactionType: 'DISHONOUR_CHARGE_TENANT',
      propertyId: payload.propertyId,
      unitId: payload.unitId,
      tenantId: payload.tenantId,
      unitName: payload.unitCode,
    });

    await postVoucher({
      voucher_date: today,
      voucher_type: 'Journal',
      description: `Bank Dishonour Fee Recovery Billed to Tenant – Cheque ${payload.chequeNumber}`,
      reference_no: `DS-REC-${payload.chequeNumber}`,
      property_id: payload.propertyId,
      unit_id: payload.unitId,
      tenant_id: payload.tenantId,
      lines: [
        { account_code: arAcct.slCode, account_name: `${arAcct.glName} / ${arAcct.slName}`, debit: payload.feeAmount, credit: 0, description: `Dishonour Fee – ${arAcct.slName}` },
        { account_code: revAcct.slCode, account_name: `${revAcct.glName} / ${revAcct.slName}`, debit: 0, credit: payload.feeAmount, description: revAcct.slName },
      ],
    });
  }
}

/**
 * Event 8 — Cash Till Deposit into Operating Bank
 * Dr 12000001 Bank / Cr 12100001 Cash in Hand
 */
export async function depositCashTillToBank(payload: {
  amount: number;
  propertyId: string;
  referenceNo?: string;
  notes?: string;
}) {
  if (payload.amount <= 0) return;
  const today = new Date().toISOString().split('T')[0];

  const { debit: bankAcct, credit: cashAcct } = await resolveAccountingAccounts({
    transactionType: 'CASH_BANK_DEPOSIT',
    propertyId: payload.propertyId,
  });

  return postVoucher({
    voucher_date: today,
    voucher_type: 'Contra',
    description: `Cash Till Deposit into Bank${payload.notes ? ` – ${payload.notes}` : ''}`,
    reference_no: payload.referenceNo || `TILL-DEP-${today}`,
    property_id: payload.propertyId,
    lines: [
      { account_code: bankAcct.slCode, account_name: `${bankAcct.glName} / ${bankAcct.slName}`, debit: payload.amount, credit: 0, description: bankAcct.slName },
      { account_code: cashAcct.slCode, account_name: `${cashAcct.glName} / ${cashAcct.slName}`, debit: 0, credit: payload.amount, description: cashAcct.slName },
    ],
  });
}

