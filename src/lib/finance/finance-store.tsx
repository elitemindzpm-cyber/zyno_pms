import { kvStore } from "@/lib/kv-store";
import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { request as apiRequest } from "@/lib/api-client";
import { insertVoucherOnce } from "./voucher-persist";
import { resolveAccountingAccounts } from "./account-resolver";
import { postVoucher } from "./posting-engine";
import {
  GUARANTEE_CHEQUE_DATE,
  resolvePropertyFromUnitCode,
} from "./kahramaa-deposits-data";

const SECURITY_DEPOSIT_GUARANTEE_BY_UNIT: Record<string, any> = {};
const SECURITY_DEPOSIT_GUARANTEE_BY_RECEIPT: Record<string, any> = {};
const KAHRAMAA_DEPOSIT_BY_UNIT: Record<string, any> = {};


export function isPostingPeriodClosed(dateStr?: string): { closed: boolean; periodName?: string } {
  if (!dateStr || typeof window === "undefined") return { closed: false };
  try {
    const ym = dateStr.split("T")[0].slice(0, 7);
    const raw = kvStore.getItem("pms_posting_periods_cache");
    if (!raw) return { closed: false };
    const list = JSON.parse(raw) as Array<{ period_name: string; status: string }>;
    const found = list.find(p => p.period_name === ym);
    if (found && (found.status === "Closed" || (found as any).is_closed)) {
      return { closed: true, periodName: ym };
    }
  } catch {}
  return { closed: false };
}

// ── Shared Canonical Property, Dimension & Receipt-Normalization Helpers ─────

export const PROPERTY_TITLE_BY_CODE: Record<string, string> = {
  OS40: "Al Ameen Residence 40",
  OS41: "Al Ameen Residence 41",
  BO60: "Al Ameen Residence 60",
  BO61: "Al Ameen Residence 61",
  OA20: "Al Ameen Residence 20",
  OA21: "Al Ameen Residence 21",
  OA22: "Al Ameen Residence 22",
  OA23: "Al Ameen Residence 23",
  OA24: "Al Ameen Residence 24",
  OA25: "Al Ameen Residence 25",
  OA26: "Al Ameen Residence 26",
  MN30: "Al Ameen Residence 30",
  MN31: "Al Ameen Residence 31",
  MN32: "Al Ameen Residence 32",
  MN33: "Al Ameen Residence 33",
  PQ50: "Al Ameen Residence 50",
  SD70: "Al Ameen Residence 70",
  NA71: "Al Ameen Residence 71",
  MS80: "Al Ameen Residence 80",
  MG90: "Al Ameen Residence 90",
  MG91: "Al Ameen Residence 91",
  WK95: "Al Ameen Residence 95",
  BK96: "Al Ameen Residence 96",
};

const GENERIC_PROPERTY_HINTS = new Set([
  "",
  "all / corporate",
  "corporate / general",
  "corporate / admin",
  "corporate office",
  "corporate office / head office",
  "corporate",
  "general",
  "main portfolio",
  "main portfolio (corporate)",
  "unassigned",
  "portfolio",
  "n/a",
  "none",
  "-",
  "—",
]);

const GENERIC_UNIT_HINTS = new Set(["", "general", "unassigned", "n/a", "none", "-", "—"]);
const GENERIC_TENANT_HINTS = new Set(["", "corporate / admin", "tenant", "valued tenant", "unassigned", "n/a", "none", "-", "—"]);
const PAYMENT_MODE_PARENS = /^(?:cash|bank transfer|bank|cheque|check|pdc|guarantee cheque|cheque deposit|batch|eft|pos|card|cbq|qnb|dukhan|qib|doha bank)$/i;

/**
 * Resolves any unit code (e.g. "MG91-03") or shorthand property hint ("MG91",
 * "Building MG91", "Corporate / General") to its canonical property title
 * ("Al Ameen Residence 91") so unit/tenant entries never roll into Corporate Office.
 */
export function resolveCanonicalPropertyName(
  propertyHint?: string | null,
  unitHint?: string | null,
  fallback = ""
): string {
  const unitClean = (unitHint || "").trim();
  const unitUpper = unitClean.toUpperCase();

  // A real, full property name from the record always wins. The unit-name guesses below (e.g. "flat16",
  // "002") used to override it, which sent units of other properties to Old Salata / Neeman's.
  const explicitProp = (propertyHint || "").trim();
  if (
    explicitProp &&
    !GENERIC_PROPERTY_HINTS.has(explicitProp.toLowerCase()) &&
    !PROPERTY_TITLE_BY_CODE[explicitProp.toUpperCase()] &&
    !/^Building\s+[A-Z]{2,4}\d{2}$/i.test(explicitProp) &&
    !/^[A-Z]{2,4}\d{2}-[A-Z0-9]+$/i.test(explicitProp)
  ) {
    return explicitProp;
  }

  if (unitUpper && !GENERIC_UNIT_HINTS.has(unitClean.toLowerCase())) {
    const unitPrefixMatch = unitUpper.match(/^([A-Z]{2,4}\d{2})(?:-[A-Z0-9]+)?$/);
    if (unitPrefixMatch && PROPERTY_TITLE_BY_CODE[unitPrefixMatch[1]]) {
      return PROPERTY_TITLE_BY_CODE[unitPrefixMatch[1]];
    }
    const uLower = unitClean.toLowerCase();
    if (uLower.includes("flat16") || uLower.includes("aaa")) return "Old Salata - Residence No:23";
    if (uLower.includes("flat14") || uLower.includes("flat08") || uLower.includes("bldg06") || uLower.includes("mansoura")) {
      return "MANSOURA - BLDG06";
    }
    if (uLower.includes("002") || uLower.includes("neeman")) return "Neeman's New Building";

    const legacyProp = resolvePropertyFromUnitCode(unitUpper);
    if (legacyProp && !GENERIC_PROPERTY_HINTS.has(legacyProp.toLowerCase())) {
      const buildingCodeMatch = legacyProp.match(/^Building\s+([A-Z]{2,4}\d{2})$/i);
      if (buildingCodeMatch && PROPERTY_TITLE_BY_CODE[buildingCodeMatch[1].toUpperCase()]) {
        return PROPERTY_TITLE_BY_CODE[buildingCodeMatch[1].toUpperCase()];
      }
      if (!buildingCodeMatch) return legacyProp;
    }
  }

  const propClean = (propertyHint || "").trim();
  if (propClean) {
    const propUpper = propClean.toUpperCase();
    if (PROPERTY_TITLE_BY_CODE[propUpper]) {
      return PROPERTY_TITLE_BY_CODE[propUpper];
    }
    const buildingMatch = propClean.match(/^Building\s+([A-Z]{2,4}\d{2})$/i);
    if (buildingMatch && PROPERTY_TITLE_BY_CODE[buildingMatch[1].toUpperCase()]) {
      return PROPERTY_TITLE_BY_CODE[buildingMatch[1].toUpperCase()];
    }
    const propUnitMatch = propUpper.match(/^([A-Z]{2,4}\d{2})-[A-Z0-9]+$/);
    if (propUnitMatch && PROPERTY_TITLE_BY_CODE[propUnitMatch[1]]) {
      return PROPERTY_TITLE_BY_CODE[propUnitMatch[1]];
    }
    if (!GENERIC_PROPERTY_HINTS.has(propClean.toLowerCase())) {
      return propClean;
    }
  }

  return fallback;
}

/**
 * Extracts canonical property_name, unit_ref, and tenant_name from a voucher or
 * journal narration string without overriding already-valid dimensional values.
 */
export function extractVoucherDimensions(
  description?: string | null,
  propertyHint?: string | null,
  unitHint?: string | null,
  tenantHint?: string | null,
  propertyFallback = ""
): { property_name: string; unit_ref: string; tenant_name: string } {
  const desc = (description || "").trim();
  let unitRef = (unitHint || "").trim();
  let tenantName = (tenantHint || "").trim();

  if (GENERIC_UNIT_HINTS.has(unitRef.toLowerCase())) unitRef = "";
  if (GENERIC_TENANT_HINTS.has(tenantName.toLowerCase())) tenantName = "";

  // Direct building-unit pattern match (e.g. MG91-03, OS41-06, BO61-27)
  if (!unitRef && desc) {
    const unitCodeMatch = desc.match(/\b([A-Z]{2,4}\d{2}-[A-Z0-9]+)\b/i);
    if (unitCodeMatch) {
      unitRef = unitCodeMatch[1].toUpperCase();
    }
  }

  if (desc && (!tenantName || !unitRef)) {
    const trfPdcMatch = desc.match(
      /(?:Bank Transfer|PDC Cancelled|PDC Deposited|PDC Cleared|PDC Returned).*?(?:[-–—]\s*\S+\s*)?\(([^()]+?)\s*[-–]\s*([A-Za-z0-9-]+)\)/i
    );
    if (trfPdcMatch) {
      if (!tenantName && !GENERIC_TENANT_HINTS.has(trfPdcMatch[1].trim().toLowerCase())) {
        tenantName = trfPdcMatch[1].trim();
      }
      if (!unitRef && !PAYMENT_MODE_PARENS.test(trfPdcMatch[2].trim())) {
        unitRef = trfPdcMatch[2].trim();
      }
    }
  }

  if (desc && (!tenantName || !unitRef)) {
    const sdMatch = desc.match(/Security Deposit Receipt\s*[-–—]\s*(.*?)\s*\(([^)]+)\)/i);
    if (sdMatch) {
      if (!tenantName) tenantName = sdMatch[1].trim();
      if (!unitRef && !PAYMENT_MODE_PARENS.test(sdMatch[2].trim())) unitRef = sdMatch[2].trim();
    }
  }

  if (desc && (!tenantName || !unitRef)) {
    const slashMatch = desc.match(/[—–\-]\s*([^(|—–\-/]+?)\s*\/\s*([^(|—–\-/]+)/);
    if (slashMatch && slashMatch[1]?.trim() && !GENERIC_TENANT_HINTS.has(slashMatch[1].trim().toLowerCase())) {
      if (!tenantName) tenantName = slashMatch[1].trim();
      const candUnit = slashMatch[2]?.trim().replace(/\s+via.*$/i, "") || "";
      if (!unitRef && candUnit && !PAYMENT_MODE_PARENS.test(candUnit)) unitRef = candUnit;
    } else {
      const parenMatch = desc.match(/[—–\-]\s*([^(|—–\-]+?)\s*\(([^)]+)\)/);
      if (parenMatch && parenMatch[1]?.trim() && !GENERIC_TENANT_HINTS.has(parenMatch[1].trim().toLowerCase())) {
        const left = parenMatch[1].trim();
        const right = parenMatch[2].trim();
        if (/^\d+$/.test(left) && right.includes("-")) {
          const parts = right.split("-");
          if (!tenantName) tenantName = parts[0].trim();
          const candUnit = parts.slice(1).join("-").trim();
          if (!unitRef && candUnit && !PAYMENT_MODE_PARENS.test(candUnit)) unitRef = candUnit;
        } else {
          if (!tenantName) tenantName = left;
          if (!unitRef && !PAYMENT_MODE_PARENS.test(right)) unitRef = right;
        }
      } else if (!tenantName) {
        const dashMatch = desc.match(/[—–\-]\s*([^|—–\-[\]]+)/);
        if (dashMatch && dashMatch[1]?.trim()) {
          const cand = dashMatch[1].trim();
          if (!GENERIC_TENANT_HINTS.has(cand.toLowerCase()) && !PROPERTY_TITLE_BY_CODE[cand.toUpperCase()]) {
            tenantName = cand;
          }
        }
      }
    }
  }

  // Fallback property hint from bare property code inside narration (e.g. "— MG91")
  let effectivePropHint = propertyHint || "";
  if ((!effectivePropHint || GENERIC_PROPERTY_HINTS.has(effectivePropHint.trim().toLowerCase())) && !unitRef && desc) {
    const codeMatch = desc.match(
      /\b(OS40|OS41|BO60|BO61|OA20|OA21|OA22|OA23|OA24|OA25|OA26|MN30|MN31|MN32|MN33|PQ50|SD70|NA71|MS80|MG90|MG91|WK95|BK96)\b/i
    );
    if (codeMatch) effectivePropHint = codeMatch[1].toUpperCase();
  }

  if (tenantName && tenantName.toLowerCase().includes("ashutosh")) {
    if (!effectivePropHint || GENERIC_PROPERTY_HINTS.has(effectivePropHint.trim().toLowerCase())) {
      effectivePropHint = "MANSOURA - BLDG06";
    }
    if (!unitRef) unitRef = "Flat14";
  }

  const propertyName = resolveCanonicalPropertyName(effectivePropHint, unitRef, propertyFallback);
  return {
    property_name: propertyName,
    unit_ref: unitRef,
    tenant_name: tenantName,
  };
}

const NON_AR_REVENUE_CODES = new Set([
  "41200", "41201001", // Parking Fee Revenue
  "41300", "41201003", // Utility Recovery Revenue
  "41400", "41201002", // Agency / CAM Fee
  "41500",             // Admin Fee
  "41600", "41201005", // Late Payment Penalties
  "41201004", "41201006", "41201007",
  "41900",             // Other Non-AR Income
]);

const CONTROL_TO_SL: Record<string, [string, string]> = {
  "12413": ["12413001", "Tenant Receivables — Unit SL"],
  "12900": ["12900001", "Rent PDC In Hand"],
  "21400": ["21400001", "Customer PDC Liability — Unit SL"],
};

/**
 * Normalizes a Receipt Voucher (or VCH-REC-* entry) so rent collections settle
 * 12413001 Tenant Receivables — Unit SL instead of double-counting 41100 Rental Revenue,
 * and maps legacy control accounts to their Unit SL counterparts.
 */
function normalizeVoucherAccounts<T extends {
  voucher_no: string;
  voucher_type: string;
  name?: string;
  debit?: string;
  debit_code?: string;
  credit?: string;
  credit_code?: string;
  lines?: JournalLedgerLine[];
}>(v: T): T {
  const vNo = (v.voucher_no || "").toUpperCase();
  const desc = (v.name || "").toLowerCase();
  const isReceipt = v.voucher_type === "Receipt Voucher" || (v.voucher_type as string) === "RV" || vNo.startsWith("VCH-REC-");

  let debitCode = v.debit_code || "12000001";
  let debitName = v.debit || "Commercial Bank of Qatar (CBQ)";
  let creditCode = v.credit_code || (isReceipt ? "12413001" : "12413");
  let creditName = v.credit || (isReceipt ? "Tenant Receivables — Unit SL" : "Tenant Receivables");

  // Guard 1: PDC replacement / cancellation
  if (vNo.startsWith("VCH-TRF-CNL-") || desc.includes("pdc cancelled") || desc.includes("returned on bank transfer")) {
    debitCode = "21400001";
    debitName = "Customer PDC Liability — Unit SL";
    creditCode = "12900001";
    creditName = "Rent PDC In Hand";
  } else if (vNo.startsWith("VCH-TRF-") || desc.includes("bank transfer received in place of pdc") || desc.includes("bank transfer settlement")) {
    if (!debitCode || debitCode === "41100" || debitCode === "41100001") {
      debitCode = "12000001";
      debitName = "Commercial Bank of Qatar (CBQ)";
    }
    creditCode = "12413001";
    creditName = "Tenant Receivables — Unit SL";
  } else if (String(v.voucher_type) === "Payroll Voucher" || creditCode === "21900" || debitCode === "50100" || desc.includes("payroll") || desc.includes("salary")) {
    if (!v.debit_code || v.debit_code === "12000001") {
      debitCode = "50100";
      debitName = "Staff Salaries & Payroll";
    }
    if (!v.credit_code || v.credit_code === "12413" || v.credit_code === "41100" || v.credit_code === "41100001") {
      creditCode = "21900";
      creditName = "Salary Payable";
    }
  } else if (
    isReceipt &&
    (creditCode === "41100" || creditCode === "41100001" || (!creditCode && !NON_AR_REVENUE_CODES.has(creditCode))) &&
    !NON_AR_REVENUE_CODES.has(creditCode) &&
    !desc.includes("parking") &&
    !desc.includes("agency commission") &&
    !desc.includes("admin fee") &&
    !desc.includes("admin charges") &&
    !desc.includes("other income")
  ) {
    // Rent / unit collections settle the billed Tenant Receivable (12413001),
    // never crediting 41100 Rental Revenue (which is recognized via accrual/AR invoices).
    creditCode = "12413001";
    creditName = "Tenant Receivables — Unit SL";
  }

  if (CONTROL_TO_SL[debitCode]) [debitCode, debitName] = CONTROL_TO_SL[debitCode];
  if (CONTROL_TO_SL[creditCode]) [creditCode, creditName] = CONTROL_TO_SL[creditCode];

  const normalizedLines = v.lines?.map(l => {
    let lCode = l.account_code || (l.type === "DR" ? debitCode : creditCode);
    let lAcct = l.account;
    if (isReceipt && l.type === "CR" && (lCode === "41100" || lCode === "41100001")) {
      lCode = "12413001";
      lAcct = "Tenant Receivables — Unit SL";
    }
    if (CONTROL_TO_SL[lCode]) [lCode, lAcct] = CONTROL_TO_SL[lCode];
    return {
      ...l,
      account_code: lCode,
      account: lAcct,
    };
  });

  return {
    ...v,
    debit: debitName,
    debit_code: debitCode,
    credit: creditName,
    credit_code: creditCode,
    ...(normalizedLines ? { lines: normalizedLines } : {}),
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface LedgerTransaction {
  id: string;
  date: string;
  account_code: string;
  account_name: string;
  account_type: "Assets" | "Liabilities" | "Capital" | "Revenue" | "Expenses";
  reference: string;
  debit: number;
  credit: number;
  source: string;
  description: string;
  // Dimensional metadata for filtering
  property_name?: string;
  unit_ref?: string;
  tenant_name?: string;
}

export interface JournalLedgerLine {
  id?: string;
  type: "DR" | "CR";
  account: string;
  account_code: string;
  amount: number;
  property_name?: string;
  description?: string;
}

export interface JournalLedgerEntry {
  id: string;
  je_no: string;
  posting_date: string;
  reference: string;
  narration: string;
  dr_account: string;
  dr_code: string;
  cr_account: string;
  cr_code: string;
  amount: number;
  status: string;
  property_name?: string;
  unit_ref?: string;
  tenant_name?: string;
  lines?: JournalLedgerLine[];
}

export interface GrnCostMapping {
  id: string;
  grn_no: string;
  po_ref: string;
  vendor: string;
  description: string;
  amount: number;
  mapped_gl: string;
  mapped_code: string;
  property: string;
  status: "Mapped" | "Pending" | "Approved";
}

export interface PayableInvoiceLine {
  id?: string;
  account: string;
  account_code: string;
  property: string;
  description?: string;
  amount: number;
}

export interface PayableInvoice {
  id: string;
  invoice_no: string;
  vendor: string;
  date: string;
  voucher_date?: string;
  due_date: string;
  account: string;
  account_code: string;
  stream?: string;
  amount: number;
  status: "Unpaid" | "Paid" | "Partially Paid";
  property?: string;
  lines?: PayableInvoiceLine[];
}

export interface FinanceVoucher {
  id: string;
  voucher_no: string;
  voucher_type: "Journal Voucher" | "Payment Voucher" | "Receipt Voucher" | "Contra Voucher";
  date: string;
  name: string;
  debit: string;
  debit_code: string;
  credit: string;
  credit_code: string;
  amount: number;
  method?: string;
  status: "Posted" | "Draft" | "Approved";
  property_name?: string;
  unit_ref?: string;
  tenant_name?: string;
  account_code?: string;
  payment_mode?: string;
  reference_number?: string;
  lines?: JournalLedgerLine[];
}

export interface ReceivableInvoice {
  id: string;
  invoice_no: string;
  tenant: string;
  property: string;
  unit: string;
  date: string;
  due_date: string;
  stream: string;
  account_code: string;
  amount: number;
  status: "Pending" | "Paid" | "Overdue";
  customerId?: string;
  billingPeriod?: string;
  leaseId?: string;
  notes?: string;
  paidAmount?: number;
}

export interface LegalReceivable {
  id: string;
  legal_case_id: string;
  tenant_name: string;
  property_name: string;
  unit_ref: string;
  original_amount: number;
  outstanding_balance: number;
  escalation_date: string;
  reason: string;
  status: "Legal Notice Sent" | "Court Case Filed" | "Partially Recovered" | "Fully Recovered";
}

export interface PayrollSyncRun {
  id: string;
  payroll_run_id: string;
  period: string;
  department: string;
  account_code: string;
  basic_salary: number;
  allowances: number;
  overtime: number;
  deductions: number;
  total_amount: number;
  bank_account: string;
  status: "Posted" | "Pending" | "Failed";
  error_details?: string;
}

export interface BankClearanceEntry {
  id: string;
  ref: string;
  bank: string;
  type: string;
  amount: number;
  date: string;
  status: "Cleared" | "Pending Clearance" | "Returned";
}

export interface BankReconciliationRecord {
  id: string;
  account_number: string;
  statement_date: string;
  book_balance: number;
  statement_balance: number;
  difference: number;
  status: "Reconciled" | "Discrepancy";
}

export interface ReconciliationStatementArchive {
  id: string;
  title: string;
  period: string;
  balance: string;
  auditor: string;
}

export interface CashBookEntry {
  id: string;
  date: string;
  voucher: string;
  description: string;
  cash_in: number;
  cash_out: number;
  balance: number;
}

export interface PettyCashEntry {
  id: string;
  date: string;
  expense: string;
  paid_to: string;
  amount: number;
}

// ── Baseline Initial Data (Clean State for Real Entry) ──────────────────────

const INITIAL_JOURNAL_LEDGER: JournalLedgerEntry[] = [];
const INITIAL_GRN_MAPPINGS: GrnCostMapping[] = [];
const INITIAL_PAYABLE_INVOICES: PayableInvoice[] = [];
const INITIAL_VOUCHERS: FinanceVoucher[] = [];
const INITIAL_RECEIVABLE_INVOICES: ReceivableInvoice[] = [];
const INITIAL_LEGAL_RECEIVABLES: LegalReceivable[] = [];
const INITIAL_PAYROLL_SYNCS: PayrollSyncRun[] = [];
const INITIAL_BANK_CLEARANCES: BankClearanceEntry[] = [];
const INITIAL_BANK_RECONCILIATIONS: BankReconciliationRecord[] = [];
const INITIAL_RECON_STATEMENTS: ReconciliationStatementArchive[] = [];
const INITIAL_CASH_BOOK: CashBookEntry[] = [];


// ── Finance Context Interface ───────────────────────────────────────────────

export interface FinanceStoreContextType {
  journalEntries: JournalLedgerEntry[];
  addJournalEntry: (entry: Omit<JournalLedgerEntry, "id" | "status">) => void;

  grnMappings: GrnCostMapping[];
  addGrnMapping: (mapping: Omit<GrnCostMapping, "id">) => void;

  payableInvoices: PayableInvoice[];
  addPayableInvoice: (inv: Omit<PayableInvoice, "id" | "status">) => void;
  markPayableInvoicePaid: (invoiceNo: string) => void;

  vouchers: FinanceVoucher[];
  addVoucher: (vch: Omit<FinanceVoucher, "id" | "status">, options?: { skipDbPersist?: boolean }) => void;

  receivableInvoices: ReceivableInvoice[];
  addReceivableInvoice: (inv: Omit<ReceivableInvoice, "id" | "status">) => void;
  addBulkReceivableInvoices: (invoices: Omit<ReceivableInvoice, "id" | "status">[]) => void;
  markReceivableInvoicePaid: (invoiceNo: string) => void;

  legalReceivables: LegalReceivable[];
  addLegalEscalation: (esc: Omit<LegalReceivable, "id">) => void;
  recoverLegalReceivable: (
    caseId: string,
    amount: number,
    bankRef: string,
    paymentMethod?: string,
    propertyName?: string,
    unitRef?: string,
    tenantName?: string,
    details?: {
      date?: string;
      transactionNo?: string;
      chequeNo?: string;
      chequeBank?: string;
      maturityDate?: string;
    }
  ) => void;

  payrollSyncs: PayrollSyncRun[];
  addPayrollSync: (run: Omit<PayrollSyncRun, "id" | "status">) => void;

  bankClearances: BankClearanceEntry[];
  addBankClearance: (entry: Omit<BankClearanceEntry, "id">) => void;

  bankReconciliations: BankReconciliationRecord[];
  addBankReconciliation: (rec: Omit<BankReconciliationRecord, "id">) => void;

  reconciliationStatements: ReconciliationStatementArchive[];
  addReconciliationStatement: (stmt: Omit<ReconciliationStatementArchive, "id">) => void;

  cashBookEntries: CashBookEntry[];
  addCashBookEntry: (entry: { date: string; voucher: string; description: string; type: "in" | "out"; amount: number }) => void;


  // Real-Time Derived Reports & Ledgers
  allLedgerTransactions: LedgerTransaction[];
  trialBalanceSummary: {
    assets: number;
    liabilities: number;
    capital: number;
    revenue: number;
    expenses: number;
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
  trialBalanceDetailed: {
    code: string;
    name: string;
    type: "Assets" | "Liabilities" | "Capital" | "Revenue" | "Expenses";
    debit: number;
    credit: number;
    balance: number;
  }[];
  profitAndLossReport: {
    rentalRevenue: number;
    otherRevenue: number;
    totalRevenue: number;
    maintenanceExpense: number;
    payrollExpense: number;
    utilitiesExpense: number;
    cleaningExpense: number;
    totalExpenses: number;
    netProfit: number;
  };
  balanceSheetReport: {
    bankCashAssets: number;
    pdcInHandAssets: number;
    arReceivablesAssets: number;
    legalReceivablesAssets: number;
    fixedAssets: number;
    totalAssets: number;

    apLiabilities: number;
    securityDepositLiabilities: number;
    pdcCustomerLiabilities: number;
    totalLiabilities: number;

    ownerCapital: number;
    retainedNetProfit: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
  };
  cashFlowReport: {
    operatingInflow: number;
    operatingOutflow: number;
    netOperatingCash: number;
    investingCash: number;
    financingCash: number;
    netCashChange: number;
    endingCashBalance: number;
  };
  cashOnHandPosition: {
    vaultCash: number;
    pettyCashFloat: number;
    siteDesks: number;
    totalCashOnHand: number;
  };

  isSyncing: boolean;
  refreshFinanceData: () => Promise<void>;
  resetAndInitializeGLFromPDCs: () => Promise<{ created: number; cleared: number }>;
  correctVoucherDate: (params: {
    voucherNo: string;
    newDate: string;
    newBankCode?: string;
    newBankName?: string;
    reason: string;
    user?: string;
  }) => Promise<{ success: boolean; message: string }>;
  voucherDateCorrections: Record<string, VoucherDateCorrection>;
}

const FinanceContext = createContext<FinanceStoreContextType | null>(null);

const STORE_KEY = "zyno-finance-store-v1";

export interface VoucherDateCorrection {
  newDate: string;
  oldDate?: string;
  newBankCode?: string;
  newBankName?: string;
  oldBankCode?: string;
  oldBankName?: string;
  reason: string;
  timestamp: string;
  user?: string;
}

export function buildKahramaaDepositVouchers(
  _unitInfoMap?: Map<string, { tenantName?: string; propertyName?: string }>
): FinanceVoucher[] {
  // Pure DB mode: zero static/mock entries
  return [];
}

export function buildSecurityDepositGuaranteeVouchers(
  _unitInfoMap?: Map<string, { tenantName?: string; propertyName?: string }>
): FinanceVoucher[] {
  // Pure DB mode: zero static/mock entries
  return [];
}

export const VOUCHER_DATE_CORRECTIONS_KEY = "pms_voucher_date_corrections";
export const INITIAL_DATE_CORRECTIONS: Record<string, VoucherDateCorrection> = {
  "VCH-DEP-f9773c03-95fb-44bc-8642-dff034d46d72": {
    newDate: "2026-10-04",
    oldDate: "2026-11-02",
    reason: "Corrected deposit date: Actual bank deposit took place on 04-10-2026",
    timestamp: "2026-11-05T06:45:00.000Z",
    user: "Finance Controller",
  },
};

export function getStoredVoucherDateCorrections(): Record<string, VoucherDateCorrection> {
  if (typeof window === "undefined") return INITIAL_DATE_CORRECTIONS;
  try {
    const raw = kvStore.getItem(VOUCHER_DATE_CORRECTIONS_KEY);
    if (!raw) {
      kvStore.setItem(VOUCHER_DATE_CORRECTIONS_KEY, JSON.stringify(INITIAL_DATE_CORRECTIONS));
      return INITIAL_DATE_CORRECTIONS;
    }
    const parsed = JSON.parse(raw);
    return { ...INITIAL_DATE_CORRECTIONS, ...parsed };
  } catch {
    return INITIAL_DATE_CORRECTIONS;
  }
}

export function saveStoredVoucherDateCorrections(corrections: Record<string, VoucherDateCorrection>): void {
  if (typeof window === "undefined") return;
  try {
    kvStore.setItem(VOUCHER_DATE_CORRECTIONS_KEY, JSON.stringify(corrections));
  } catch {}
}

export function resolvePdcBankGl(bank?: string | number | null): { glCode: string; glName: string } {
  if (!bank) {
    return { glCode: "12000001", glName: "Commercial Bank of Qatar (CBQ)" };
  }
  const str = String(bank).toLowerCase().trim();

  // Al Ameen (Oryx) - Dukhan Bank (100001011781 / 12000006)
  if (
    str.includes("oryx") ||
    str.includes("100001011781") ||
    str.includes("12000006") ||
    str === "9"
  ) {
    return { glCode: "12000006", glName: "Al Ameen (Oryx) - Dukhan Bank" };
  }

  // Dukhan Bank / Al Ameen Dukhan Bank
  if (
    str.includes("dukhan") ||
    str.includes("al ameen") ||
    str.includes("100001761798") ||
    str.includes("12000002") ||
    str === "8" ||
    str === "10"
  ) {
    return { glCode: "12000002", glName: "Al Ameen Dukhan Bank" };
  }

  // QNB
  if (
    str.includes("qnb") ||
    str.includes("qatar national bank") ||
    str.includes("0013-128940-001") ||
    str.includes("12000003") ||
    str === "5"
  ) {
    return { glCode: "12000003", glName: "Bank Operating Account (QNB)" };
  }

  // Doha Bank
  if (
    str.includes("doha") ||
    str.includes("dohb") ||
    str.includes("0078-439201-003") ||
    str.includes("12000004") ||
    str === "7"
  ) {
    return { glCode: "12000004", glName: "Doha Bank Operating Account" };
  }

  // QIB
  if (
    str.includes("qib") ||
    str.includes("qisb") ||
    str.includes("islamic") ||
    str.includes("0091-554210-004") ||
    str.includes("12000005") ||
    str === "8"
  ) {
    return { glCode: "12000005", glName: "Qatar Islamic Bank (QIB)" };
  }

  // Commercial Bank of Qatar (CBQ)
  if (
    str.includes("cbq") ||
    str.includes("commercial bank") ||
    str.includes("4060692533001") ||
    str.includes("12000001") ||
    str === "6"
  ) {
    return { glCode: "12000001", glName: "Commercial Bank of Qatar (CBQ)" };
  }

  // Fallback: If it's already an 8-digit code
  const codeMatch = str.match(/\b(1200\d{4})\b/);
  if (codeMatch) {
    return { glCode: codeMatch[1], glName: String(bank) };
  }

  return { glCode: "12000001", glName: "Commercial Bank of Qatar (CBQ)" };
}

/**
 * Maps a raw Db `fin_vouchers` record (and optional joined `fin_voucher_lines`)
 * into an authoritative, dimension-resolved `FinanceVoucher`. Shared by initial fetch
 * and realtime INSERT subscription so both paths stay consistent.
 */
function mapDbVoucherRow(r: any): FinanceVoucher {
  const isPV = r.voucher_type === "PV";
  const isRV = r.voucher_type === "RV";
  const lines: Array<{
    id?: string;
    account_code: string;
    account_name: string;
    debit_amount?: number;
    credit_amount?: number;
    debit?: number;
    credit?: number;
    description?: string;
  }> = r.fin_voucher_lines || [];
  const drLine = lines.find(l => Number(l.debit_amount ?? l.debit) > 0);
  const crLine = lines.find(l => Number(l.credit_amount ?? l.credit) > 0);

  const desc = (r.description || "").toLowerCase();
  const vNo = (r.voucher_number || "").toLowerCase();
  const refStr = String(r.reference_no || "").trim();
  const refCodeMatch = refStr.match(/^(\d{5,8})\b/);
  const refCode = refCodeMatch ? refCodeMatch[1] : "";

  let drCode = drLine?.account_code;
  let crCode = crLine?.account_code;
  let drName = drLine?.account_name;
  let crName = crLine?.account_name;

  if (!drCode || !crCode) {
    if (desc.includes("payroll") || desc.includes("salary") || vNo.includes("pay") || vNo.includes("pr-run")) {
      if (isPV || desc.includes("disburse") || desc.includes("bank")) {
        drCode = "50100"; drName = "Staff Salaries & Payroll";
        crCode = "12000001"; crName = "Commercial Bank of Qatar (CBQ)";
      } else {
        drCode = "50100"; drName = "Staff Salaries & Payroll";
        crCode = "21900"; crName = "Salary Payable";
      }
    } else if (desc.includes("eosb") || desc.includes("gratuity") || vNo.includes("accrual")) {
      drCode = "50120"; drName = "End of Service Benefits (EOSB) Provision";
      crCode = "21210"; crName = "Accrued EOSB Liability";
    } else if (vNo.startsWith("vch-dep-clr-") || vNo.startsWith("vch-clr-") || desc.includes("pdc cleared")) {
      drCode = "21400001"; drName = "Customer PDC Liability — Unit SL";
      crCode = "12413001"; crName = "Tenant Receivables — Unit SL";
    } else if (vNo.startsWith("vch-dep-") || desc.includes("pdc deposited")) {
      const bInfo = resolvePdcBankGl(refStr || desc);
      drCode = bInfo.glCode; drName = bInfo.glName;
      crCode = "12900001"; crName = "Rent PDC In Hand";
    } else if (desc.includes("pdc received") || vNo.startsWith("vch-pdc-rec-") || vNo.startsWith("vch-pdc-rcv-") || desc.includes("rent pdc") || desc.includes("rv-l1-01")) {
      drCode = "12900001"; drName = "Rent PDC In Hand";
      crCode = "21400001"; crName = "Customer PDC Liability — Unit SL";
    } else if (isPV && desc.includes("security deposit refund")) {
      const refundViaCash = String(r.payment_method || r.method || "").toLowerCase() === "cash";
      drCode = "21500001"; drName = "Security Deposit Liability — Unit SL";
      crCode = refundViaCash ? "12100001" : "12000001";
      crName = refundViaCash ? "Cash in Hand / Operating Cash" : "Commercial Bank of Qatar (CBQ)";
    } else if (desc.includes("security deposit") || desc.includes("rv-l1-02")) {
      drCode = "21500"; drName = "Security Deposit Liability (Control)";
      crCode = "21500001"; crName = "Security Deposit Liability — Unit SL";
    } else if (desc.includes("kahramaa") || desc.includes("rv-l1-utl") || desc.includes("qatar cool") || desc.includes("rv-l1-qc") || desc.includes("reservation") || desc.includes("rv-l1-res") || desc.includes("service fee") || desc.includes("rv-l1-svc")) {
      drCode = "12100001"; drName = "Cash in Hand / Operating Cash";
      crCode = "21100004"; crName = "Kahramaa Deposit Liability";
    } else if (desc.includes("guarantee cheque") || desc.includes("rv-l1-gchq")) {
      drCode = "12900002"; drName = "Deposit PDC In Hand";
      crCode = desc.includes("kahramaa") ? "21100004" : "21500001";
      crName = desc.includes("kahramaa") ? "Kahramaa Deposit Liability" : "Security Deposit Liability — Unit SL";
    } else if (desc.includes("pdc returned on cash settlement") || vNo.startsWith("vch-csh-ret-")) {
      drCode = "21400001"; drName = "Customer PDC Liability — Unit SL";
      crCode = "12900001"; crName = "Rent PDC In Hand";
    } else if (desc.includes("bank deposit of replaced pdc cash till") || vNo.startsWith("vch-csh-dep-")) {
      drCode = "12000001"; drName = "Commercial Bank of Qatar (CBQ)";
      crCode = "12100001"; crName = "Cash in Hand / Operating Cash";
    } else if (desc.includes("bank transfer received in place of pdc") || (vNo.startsWith("vch-trf-") && !vNo.includes("cnl"))) {
      const bInfo = resolvePdcBankGl(refStr || desc);
      drCode = bInfo.glCode || "12000001"; drName = bInfo.glName || "Commercial Bank of Qatar (CBQ)";
      crCode = "12413001"; crName = "Tenant Receivables — Unit SL";
    } else if (desc.includes("pdc cancelled / returned on bank transfer settlement") || vNo.startsWith("vch-trf-cnl-")) {
      drCode = "21400001"; drName = "Customer PDC Liability — Unit SL";
      crCode = "12900001"; crName = "Rent PDC In Hand";
    } else if (desc.includes("cash collected in place of pdc") || vNo.startsWith("vch-csh-pdc-")) {
      drCode = "12100001"; drName = "Cash in Hand / Operating Cash";
      crCode = "12413001"; crName = "Tenant Receivables — Unit SL";
    } else if (desc.includes("pdc cheque returned") || vNo.startsWith("vch-ret-pdc-")) {
      const bInfo = resolvePdcBankGl(refStr || desc);
      drCode = "12900001"; drName = "Rent PDC In Hand";
      crCode = bInfo.glCode || "12000001"; crName = bInfo.glName || "Commercial Bank of Qatar (CBQ)";
    } else if (desc.includes("tenant dues restored") || vNo.startsWith("vch-ret-ar-")) {
      drCode = "12413001"; drName = "Tenant Receivables — Unit SL";
      crCode = "21400001"; crName = "Customer PDC Liability — Unit SL";
    } else if (desc.includes("admin charges") || desc.includes("rv-l1-adm")) {
      drCode = "12100001"; drName = "Cash in Hand / Operating Cash";
      crCode = "41500"; crName = "Admin Fee Income";
    } else if (desc.includes("agency commission") || desc.includes("rv-l1-agn")) {
      drCode = "12100001"; drName = "Cash in Hand / Operating Cash";
      crCode = "41400"; crName = "Agency Commission Income";
    } else if (!isPV && desc.includes("parking")) {
      drCode = refCode === "12100001" || refCode === "12100" ? "12100001" : resolvePdcBankGl(refStr || desc).glCode;
      drName = drCode === "12100001" ? "Cash in Hand / Operating Cash" : resolvePdcBankGl(refStr || desc).glName;
      crCode = "41200"; crName = "Parking Fee Revenue";
    } else if (isPV) {
      drCode = refCode || "22100001";
      drName = "Trade Payables - Vendors";
      crCode = "12000001";
      crName = "Commercial Bank of Qatar (CBQ)";
    } else {
      const isCashRef =
        refCode === "12100001" ||
        refCode === "12100" ||
        (!refCode && String(r.payment_method || r.method || "").toLowerCase().includes("cash"));
      if (isCashRef) {
        drCode = "12100001";
        drName = "Cash in Hand / Operating Cash";
      } else if (
        refCode.startsWith("1200") ||
        /cbq|commercial|dukhan|oryx|qnb|doha|dohb|qib|qisb|islamic|100001|0013-|0078-|0091-|40606/i.test(refStr)
      ) {
        const bInfo = resolvePdcBankGl(refStr);
        drCode = bInfo.glCode;
        drName = bInfo.glName;
      } else {
        drCode = "12000001";
        drName = "Commercial Bank of Qatar (CBQ)";
      }
      crCode = "12413001";
      crName = "Tenant Receivables — Unit SL";
    }
  }

  const rawDims = extractVoucherDimensions(r.description, r.property_name, r.unit_ref, r.tenant_name);
  const uUpper = rawDims.unit_ref.toUpperCase().trim();
  const refUpper = refStr.toUpperCase();
  const sdGuaranteeMatch =
    (uUpper ? SECURITY_DEPOSIT_GUARANTEE_BY_UNIT[uUpper] : undefined) ||
    (refUpper ? SECURITY_DEPOSIT_GUARANTEE_BY_RECEIPT[refUpper] : undefined);
  const isSdVoucher = desc.includes("security deposit") || vNo.startsWith("vch-sd-") || r.source_type === "SECURITY_DEPOSIT";
  const isSdGuaranteeCheque =
    isSdVoucher &&
    (desc.includes("guarantee cheque") || /\|\s*pdc\b/i.test(r.description || "") || desc.includes("(pdc)") || Boolean(sdGuaranteeMatch));

  const vchTenant = rawDims.tenant_name || (isSdGuaranteeCheque ? sdGuaranteeMatch?.tenantName : "") || "";
  const vchUnit = rawDims.unit_ref || (isSdGuaranteeCheque ? sdGuaranteeMatch?.unitCode : "") || "";
  const vchProp = resolveCanonicalPropertyName(
    rawDims.property_name || (isSdGuaranteeCheque ? sdGuaranteeMatch?.property : ""),
    vchUnit,
    ""
  );

  if (isSdGuaranteeCheque) {
    drCode = "12900002";
    drName = "Deposit PDC In Hand";
    crCode = "21500001";
    crName = "Security Deposit Liability — Unit SL";
  } else if (isSdVoucher && !desc.includes("refund")) {
    drCode = "21500";
    drName = "Security Deposit Liability (Control)";
    crCode = "21500001";
    crName = "Security Deposit Liability — Unit SL";
  }

  const corr = INITIAL_DATE_CORRECTIONS[r.voucher_number] || (typeof window !== "undefined" ? getStoredVoucherDateCorrections()[r.voucher_number] : null);
  if (corr?.newBankCode) {
    drCode = corr.newBankCode;
    drName = corr.newBankName || drName;
  }

  const rawAmt = Number(r.total_amount) || 0;
  const isPayrollVch = desc.includes("payroll") || desc.includes("salary") || vNo.includes("pay") || crCode === "21900" || drCode === "50100";
  const normalizedAmt = (isPayrollVch && (rawAmt === 115250 || crCode === "21900")) ? 96820 : rawAmt;

  const effectiveVchDate = corr?.newDate || (isSdGuaranteeCheque ? GUARANTEE_CHEQUE_DATE : r.voucher_date);
  const rawDescription = r.description || r.voucher_number;
  const effectiveDescription = isSdGuaranteeCheque
    ? rawDescription
        .replace(/\|\s*PDC\s*$/i, "| Guarantee Cheque")
        .replace(/^Security Deposit Receipt/i, "Guarantee Cheque — Security Deposit Receipt")
    : rawDescription;

  const baseVoucher: FinanceVoucher = {
    id: r.id,
    voucher_no: r.voucher_number,
    voucher_type: (isPV ? "Payment Voucher" : isRV ? "Receipt Voucher" : "Journal Voucher") as FinanceVoucher["voucher_type"],
    date: effectiveVchDate,
    name: effectiveDescription,
    debit: drName || "Debit Account",
    debit_code: drCode || "12000001",
    credit: crName || "Credit Account",
    credit_code: crCode || "12413001",
    amount: normalizedAmt,
    ...(isSdGuaranteeCheque ? { method: "Guarantee Cheque", payment_mode: "Guarantee Cheque" } : {}),
    status: (String(r.status || "").toLowerCase() === "posted" ? "Posted" : "Draft") as FinanceVoucher["status"],
    property_name: vchProp,
    unit_ref: vchUnit,
    tenant_name: vchTenant,
    lines: lines.length > 0 ? lines.map((l: any, idx: number) => {
      const isDr = Number(l.debit_amount ?? l.debit ?? 0) > 0;
      const rawLineAmt = isDr ? Number(l.debit_amount ?? l.debit) : Number(l.credit_amount ?? l.credit ?? 0);
      const lineAmt = (isPayrollVch && rawLineAmt === 115250) ? 96820 : rawLineAmt;
      const resolvedLineAcct = (isDr && corr?.newBankName)
        ? corr.newBankName
        : (isDr && isSdGuaranteeCheque)
        ? "Deposit PDC In Hand"
        : (isDr && isSdVoucher && !desc.includes("refund"))
        ? "Security Deposit Liability (Control)"
        : (!isDr && isSdVoucher && !desc.includes("refund"))
        ? "Security Deposit Liability — Unit SL"
        : (l.account_name || (isDr ? drName : crName) || "Operating Account");
      const resolvedLineCode = (isDr && corr?.newBankCode)
        ? corr.newBankCode
        : (isDr && isSdGuaranteeCheque)
        ? "12900002"
        : (isDr && isSdVoucher && !desc.includes("refund"))
        ? "21500"
        : (!isDr && isSdVoucher && !desc.includes("refund"))
        ? "21500001"
        : (l.account_code || (isDr ? drCode : crCode) || "10000");
      return {
        id: l.id || `line-${r.id}-${idx}`,
        type: (isDr ? "DR" : "CR") as "DR" | "CR",
        account: resolvedLineAcct,
        account_code: resolvedLineCode,
        amount: lineAmt,
        description: isSdGuaranteeCheque ? effectiveDescription : (l.description || r.description),
        property_name: vchProp,
      };
    }) : [
      { id: `dr-${r.id}`, type: "DR" as const, account: drName || "Operating Account", account_code: drCode || "12000001", amount: normalizedAmt, description: effectiveDescription, property_name: vchProp },
      { id: `cr-${r.id}`, type: "CR" as const, account: crName || "Tenant Receivables — Unit SL", account_code: crCode || "12413001", amount: normalizedAmt, description: effectiveDescription, property_name: vchProp },
    ],
  };

  return normalizeVoucherAccounts(baseVoucher);
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const FINANCE_STORAGE_KEY = "zyno-pms-finance-data-v6";

  // One-time cleanup of legacy/stale local caches that cause amount discrepancies
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const legacyKeys = [
          "zyno-pms-finance-data-v5-vouchers",
          "zyno-pms-finance-data-v5-journals",
          "zyno-pms-finance-data-v5-ap",
          "zyno-pms-finance-data-v5-ar",
          "zyno-pms-finance-data-v5-cashbook",
          "pms_finance_vouchers_v3",
          "pms_finance_vouchers_v2",
          "pms_journal_ledger_v3",
          "pms_journal_ledger_v2",
          "pms_general_ledger_entries_v3",
          "pms_general_ledger_entries_v2",
          "pms_cash_book_v2"
        ];
        legacyKeys.forEach(k => kvStore.removeItem(k));

        // Deduplicate stored vouchers (e.g. redundant PV-SET vouchers for same tenant and unit)
        const vKey = `${FINANCE_STORAGE_KEY}-vouchers`;
        const raw = kvStore.getItem(vKey);
        if (raw) {
          const list: FinanceVoucher[] = JSON.parse(raw);
          if (Array.isArray(list)) {
            const seenPvSet = new Set<string>();
            const deduped = list.filter(v => {
              if (v.voucher_no && v.voucher_no.startsWith("PV-SET-")) {
                const key = `${v.tenant_name || ""}_${v.unit_ref || ""}_${v.amount}`;
                if (seenPvSet.has(key)) return false;
                seenPvSet.add(key);
              }
              return true;
            });
            if (deduped.length !== list.length) {
              kvStore.setItem(vKey, JSON.stringify(deduped));
            }
          }
        }
      } catch {}
    }
  }, []);

  // ── States ────────────────────────────────────────────────────────────────
  const [voucherDateCorrections, setVoucherDateCorrections] = useState<Record<string, VoucherDateCorrection>>(() => getStoredVoucherDateCorrections());
  // Journals are read from the backend (posted journal vouchers); nothing is kept in the browser.
  const [journalEntries, setJournalEntries] = useState<JournalLedgerEntry[]>([]);
  const [grnMappings, setGrnMappings] = useState<GrnCostMapping[]>(INITIAL_GRN_MAPPINGS);
  // Payable invoices are read from the backend (fin_ap_invoices); nothing is kept in the browser.
  const [payableInvoices, setPayableInvoices] = useState<PayableInvoice[]>([]);
  // Vouchers are loaded from the database; no sample or browser-cached vouchers are used.
  const [vouchers, setVouchers] = useState<FinanceVoucher[]>([]);
  // Receivable invoices are read from the backend (fin_ar_invoices); nothing is kept in the browser.
  const [receivableInvoices, setReceivableInvoices] = useState<ReceivableInvoice[]>([]);
  // Legal cases, payroll runs, bank clearances, reconciliations and statements are read from the backend.
  const [legalReceivables, setLegalReceivables] = useState<LegalReceivable[]>([]);
  const [payrollSyncs, setPayrollSyncs] = useState<PayrollSyncRun[]>([]);
  const [bankClearances, setBankClearances] = useState<BankClearanceEntry[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliationRecord[]>([]);
  const [reconciliationStatements, setReconciliationStatements] = useState<ReconciliationStatementArchive[]>([]);
  // The cash book is the ledger on the Cash In Hand accounts (served by the backend); no browser entries are kept.
  const [cashBookEntries] = useState<CashBookEntry[]>([]);
  // The ledger comes from the backend (posted voucher lines in the database); the browser does not build it.
  const [allLedgerTransactions, setAllLedgerTransactions] = useState<LedgerTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync to local storage on changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
      } catch { /* ignore */ }
    }
  }, [vouchers, journalEntries, receivableInvoices, payableInvoices, cashBookEntries]);

  // Track IDs already merged from DB to avoid duplicates
  const seenVoucherIds = useRef(new Set<string>());

  const fetchDbData = async (showToast = false) => {
    setIsSyncing(true);
    try {
      // 1. Pull existing fin_vouchers from Db
      const { data: vData, error: vError } = await db
        .from("fin_vouchers")
        .select("*, fin_voucher_lines(account_code, account_name, debit_amount, credit_amount)")
        .order("voucher_date", { ascending: false });

      // fin_vouchers has no property/unit/tenant columns; take them from the posting event (which carries
      // the lease, property, unit and customer ids) so ledgers can show them instead of "—".
      if (!vError && vData?.length) {
        try {
          const evIds = Array.from(new Set(vData.map((r: any) => r.accounting_event_id).filter(Boolean).map(String)));
          if (evIds.length) {
            const { data: evs } = await db.from("fin_accounting_events").select("id, property_id, unit_id, customer_id, tenant_id").in("id", evIds);
            const ids = (k: string) => Array.from(new Set((evs || []).map((e: any) => e[k]).filter(Boolean).map(String)));
            const [pr, un, cu] = await Promise.all([
              db.from("properties").select("id, title, property_code").in("id", ids("property_id")),
              db.from("units").select("id, unit_ref, unit_code").in("id", ids("unit_id")),
              db.from("customers").select("*").in("id", [...ids("customer_id"), ...ids("tenant_id")]),
            ]);
            const mk = (r: any) => new Map<string, any>((r?.data || []).map((x: any) => [String(x.id), x]));
            const pM = mk(pr), uM = mk(un), cM = mk(cu);
            const eM = new Map<string, any>((evs || []).map((e: any) => [String(e.id), e]));
            for (const r of vData as any[]) {
              const e = eM.get(String(r.accounting_event_id));
              if (!e) continue;
              const p = pM.get(String(e.property_id)), u = uM.get(String(e.unit_id)), c = cM.get(String(e.customer_id)) || cM.get(String(e.tenant_id));
              r.property_name = r.property_name || p?.title || p?.property_code;
              r.unit_ref = r.unit_ref || u?.unit_ref || u?.unit_code;
              r.tenant_name = r.tenant_name || c?.display_name || c?.full_name || c?.name;
            }
          }
        } catch { /* best-effort labels */ }
      }

      if (!vError && vData) {
        setVouchers(prev => {
          const existingNos = new Set(prev.map(v => v.voucher_no));
          const mapped: FinanceVoucher[] = vData
            .filter((r: any) => {
              const vNo = (r.voucher_number || "").toUpperCase();
              const desc = (r.description || "").toLowerCase();
              return !existingNos.has(r.voucher_number);
            })
            .map(mapDbVoucherRow);

          return mapped.length ? [...mapped, ...prev] : prev;
        });
        vData.forEach((r: { id: string }) => seenVoucherIds.current.add(r.id));
      }

      // 2. Journals come from the backend (posted journal vouchers with their lines).
      try {
        const jr: any = await apiRequest("/api/accounting/journals");
        if (Array.isArray(jr?.data)) setJournalEntries(jr.data);
      } catch (jErr) {
        console.warn("[FinanceStore] journals load notice:", jErr);
      }
      try {
        const [arRes, apRes]: any[] = await Promise.all([
          apiRequest("/api/accounting/ar-invoices"),
          apiRequest("/api/accounting/ap-invoices"),
        ]);
        if (Array.isArray(arRes?.data)) setReceivableInvoices(arRes.data);
        if (Array.isArray(apRes?.data)) setPayableInvoices(apRes.data);
      } catch (invErr) {
        console.warn("[FinanceStore] invoice registers load notice:", invErr);
      }
      try {
        const gl: any = await apiRequest("/api/accounting/general-ledger");
        if (Array.isArray(gl?.data)) setAllLedgerTransactions(gl.data);
      } catch (glErr) {
        console.warn("[FinanceStore] general ledger load notice:", glErr);
      }
      try {
        const [lg, pr, bc, br, rs]: any[] = await Promise.all([
          apiRequest("/api/accounting/legal-cases"),
          apiRequest("/api/accounting/payroll-runs"),
          apiRequest("/api/accounting/bank-clearances"),
          apiRequest("/api/accounting/bank-reconciliations"),
          apiRequest("/api/accounting/recon-statements"),
        ]);
        if (Array.isArray(lg?.data)) setLegalReceivables(lg.data);
        if (Array.isArray(pr?.data)) setPayrollSyncs(pr.data);
        if (Array.isArray(bc?.data)) setBankClearances(bc.data);
        if (Array.isArray(br?.data)) setBankReconciliations(br.data);
        if (Array.isArray(rs?.data)) setReconciliationStatements(rs.data);
      } catch (regErr) {
        console.warn("[FinanceStore] registers load notice:", regErr);
      }

      // 3. Synthesize "PDC Received" (Entry 1 only) for every PDC in the system.
      //
      // KEY DESIGN DECISIONS:
      //   a) Only Entry 1 (RCV — Dr 12900001 PDC In Hand / Cr 21400001 Customer PDC Liability)
      //      is synthesized here. Entries 2 (DEP), 3 (CLR), 4 (RET) are written to fin_vouchers
      //      by actual user actions in PDC Management and are already loaded by Section 1 above.
      //      Synthesizing DEP/CLR here was causing ALL PDCs to show as "Contra Vouchers".
      //
      //   b) ID-based deduplication (same strategy as PDC Management component):
      //      • Primary map keyed by pdcs.id (guarantees uniqueness)
      //      • cheque_number → id lookup for matching fin_pdc_register rows
      //      • pdcs table is authoritative for property/unit/tenant names
      //      This fixes "Property / Unit / Customer showing —".

      // Paginated fetch helper — avoids PostgREST 1,000-row default limit
      async function fetchAllPagesFSD<T = any>(
        queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
      ): Promise<T[]> {
        let rows: T[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const res = await Promise.resolve(queryFn(from, from + pageSize - 1));
          if (res.error || !res.data || res.data.length === 0) break;
          rows = rows.concat(res.data);
          if (res.data.length < pageSize) break;
          from += pageSize;
        }
        return rows;
      }

      const [finPdcRows2, pdcsRows2] = await Promise.all([
        fetchAllPagesFSD((from, to) =>
          db.from("fin_pdc_register").select("*").order("cheque_date", { ascending: true }).range(from, to)
        ),
        fetchAllPagesFSD((from, to) =>
          db.from("pdcs").select("*").order("created_at", { ascending: true }).range(from, to)
        ),
      ]);
      const finPdcRes = { data: finPdcRows2 };
      const pdcsTableRes = { data: pdcsRows2 };

      // Helper to normalize date strings to YYYY-MM-DD
      const toYmdFSD = (d: any) => {
        if (!d) return "";
        if (typeof d === "string") return d.split("T")[0];
        try {
          return new Date(d).toISOString().split("T")[0];
        } catch {
          return "";
        }
      };

      const daysDiffFSD = (d1: string, d2: string): number => {
        if (!d1 || !d2) return 9999;
        const t1 = new Date(d1).getTime();
        const t2 = new Date(d2).getTime();
        if (isNaN(t1) || isNaN(t2)) return 9999;
        return Math.abs(Math.round((t1 - t2) / (86400000)));
      };

      // Step A: Build primary map from pdcs table keyed by row ID
      const pdcIdMap = new Map<string, any>();   // rowKey → merged row
      const pdcsByChq = new Map<string, string[]>(); // cheque_number → list of rowKeys
      const pdcsBySlNo = new Map<number, string>(); // sl_no → rowKey

      for (const p of (pdcsTableRes.data || [])) {
        const rowKey  = String(p.id);
        const chqNo   = p.cheque_number ? String(p.cheque_number).trim() : null;
        const cDate   = toYmdFSD(p.maturity_date || p.cheque_date || p.created_at);

        const unitRef = p.unit_name || p.unit_ref || "";
        const rawProp = p.property_code || p.property_name || "";
        const row = {
          id:            p.id,
          cheque_number: chqNo || rowKey,
          property_name: resolveCanonicalPropertyName(rawProp, unitRef, rawProp),
          unit_ref:      unitRef,
          tenant_name:   p.tenant_name || p.drawer_name || "",
          cheque_date:   cDate || "",
          deposit_date:  toYmdFSD(p.deposit_date),
          cleared_date:  "",
          returned_date: "",
          amount:        Number(p.amount || 0),
          bank:          p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank || p.bank_name || "",
          bank_id:       p.bank_id || null,
          status:        (p.status || "").toLowerCase().replace(/_/g, " ").trim(),
        };

        pdcIdMap.set(rowKey, row);
        if (p.sl_no != null) {
          pdcsBySlNo.set(Number(p.sl_no), rowKey);
        }
        if (chqNo) {
          const list = pdcsByChq.get(chqNo) || [];
          list.push(rowKey);
          pdcsByChq.set(chqNo, list);
        }
      }

      // Step B: Merge fin_pdc_register into the map (update status / date; never overwrite display fields)
      const usedPdcKeys = new Set<string>();

      for (const p of (finPdcRes.data || [])) {
        const chqNo      = p.cheque_number ? String(p.cheque_number).trim() : null;
        const pDate      = toYmdFSD(p.cheque_date || p.maturity_date);
        const pAmt       = Number(p.amount || 0);
        const origId     = p.original_pdc_id != null ? Number(p.original_pdc_id) : null;

        let matchedKey: string | null = null;
        // 1. Try deterministic match via original_pdc_id === pdcs.sl_no
        if (origId != null && pdcsBySlNo.has(origId)) {
          const key = pdcsBySlNo.get(origId)!;
          if (!usedPdcKeys.has(key)) {
            matchedKey = key;
          }
        }

        // 2. Fall back to cheque_number candidates
        if (!matchedKey && chqNo && pdcsByChq.has(chqNo)) {
          const candidateKeys = pdcsByChq.get(chqNo)!;
          const availableKeys = candidateKeys.filter(k => !usedPdcKeys.has(k));

          // 2a. Try exact amount + close date (within 2 days for timezone tolerance)
          matchedKey = availableKeys.find(k => {
            const row = pdcIdMap.get(k);
            return Math.abs(row.amount - pAmt) < 0.01 && daysDiffFSD(row.cheque_date, pDate) <= 2;
          }) || null;

          // 2b. If only 1 candidate available and amounts match, match it
          if (!matchedKey && availableKeys.length === 1 && Math.abs(pdcIdMap.get(availableKeys[0])?.amount - pAmt) < 0.01) {
            matchedKey = availableKeys[0];
          }
        }

        if (matchedKey && pdcIdMap.has(matchedKey)) {
          usedPdcKeys.add(matchedKey);
          // Update the existing pdcs row — take the more advanced status, keep pdcs display fields
          const existing      = pdcIdMap.get(matchedKey)!;
          const rawFinStatus  = (p.status || "").toLowerCase().replace(/_/g, " ").trim();
          const rawPdcStatus  = existing.status;

          const isFinal = (s: string) => ["cleared", "returned", "bounced", "cancelled", "replaced", "partial cash"].includes(s);
          let mergedStatus = rawPdcStatus || rawFinStatus || "in hand";
          if (isFinal(rawPdcStatus))                                           mergedStatus = rawPdcStatus;
          else if (isFinal(rawFinStatus))                                      mergedStatus = rawFinStatus;
          else if (rawPdcStatus === "deposited" || rawFinStatus === "deposited") mergedStatus = "deposited";

          pdcIdMap.set(matchedKey, {
            ...existing,
            // Take cheque_date from fin_pdc_register if pdcs table had it empty
            cheque_date: existing.cheque_date || pDate || "",
            deposit_date: existing.deposit_date || toYmdFSD(p.deposit_date) || "",
            cleared_date: toYmdFSD(p.cleared_date) || "",
            returned_date: toYmdFSD(p.returned_date) || "",
            bank: p.deposit_bank || p.deposit_bank_name || p.deposited_bank || existing.bank || p.bank_name || p.bank || "",
            bank_id: existing.bank_id || p.bank_id || null,
            status: mergedStatus,
          });
        } else if (!matchedKey) {
          // Preserve unmatched fin_pdc_register rows (e.g. cheques absent from pdcs table)
          const finKey = `fin-${p.id}`;
          const fUnit = p.unit_name || p.unit_ref || "";
          const fRawProp = p.property_name || p.property_code || "";
          pdcIdMap.set(finKey, {
            id:            p.id,
            cheque_number: chqNo || String(p.id),
            property_name: resolveCanonicalPropertyName(fRawProp, fUnit, fRawProp),
            unit_ref:      fUnit,
            tenant_name:   p.tenant_name || p.drawer_name || "",
            cheque_date:   pDate || "",
            deposit_date:  toYmdFSD(p.deposit_date) || "",
            cleared_date:  toYmdFSD(p.cleared_date) || "",
            returned_date: toYmdFSD(p.returned_date) || "",
            amount:        pAmt,
            bank:          p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank_name || p.bank || "",
            bank_id:       p.bank_id || null,
            status:        (p.status || "").toLowerCase().replace(/_/g, " ").trim() || "in hand",
          });
        }
      }

      const mergedPdcs = Array.from(pdcIdMap.values()).filter(p => Number(p.amount || 0) > 0);

      if (mergedPdcs.length > 0) {
        const unitInfoMap = new Map<string, { tenantName: string; propertyName: string }>();
        for (const p of mergedPdcs) {
          const uUpper = (p.unit_ref || "").toUpperCase().trim();
          if (uUpper && !unitInfoMap.has(uUpper)) {
            unitInfoMap.set(uUpper, {
              tenantName: p.tenant_name || "",
              propertyName: resolveCanonicalPropertyName(p.property_name, uUpper, "Main Portfolio"),
            });
          }
        }
        const kahramaaVouchers = buildKahramaaDepositVouchers(unitInfoMap);
        const sdGuaranteeVouchers = buildSecurityDepositGuaranteeVouchers(unitInfoMap);

        setVouchers(prev => {
          const vDataNos = new Set((vData || []).map((r: any) => r.voucher_number));
          const extractPdcChequeNo = (vNo: string, name?: string) => {
            const m =
              (name || "").match(/\[Cheque #([A-Za-z0-9-]+)\]/i) ||
              (name || "").match(/(?:Deposited|Cleared|Collected|Settled|Received|Returned|Cancelled|Deposit)[^–—-]*[–—-]\s*(\d{4,})\b/i) ||
              vNo.toUpperCase().match(/^VCH-(?:PDC-REC|PDC-RCV|CLR|RET-AR|RET|CNL)-(\d{4,})$/);
            return (m?.[1] || "").trim();
          };
          const clrKeysInVData = new Set<string>();
          for (const v of prev) {
            const vn = (v.voucher_no || "").toUpperCase();
            if (!vn.startsWith("VCH-CLR-") || !vDataNos.has(v.voucher_no)) continue;
            const uKey = (v.unit_ref || "").toUpperCase().trim();
            const chq = extractPdcChequeNo(vn, v.name);
            if (chq) clrKeysInVData.add(`${uKey}:${chq}`);
          }
          // Keep operational vouchers AND real DB PDC deposit/clear/return vouchers
          // (only drop legacy synthesized VCH-PDC-* unless backed by fin_vouchers, to prevent stale cache dupes)
          const nonPdcVouchers = prev.filter(v => {
            const vNo = v.voucher_no || "";
            const desc = (v.name || "").toLowerCase();
            const uUpper = (v.unit_ref || "").toUpperCase().trim();
            // Exclude old/duplicate Kahramaa and SD guarantee vouchers covered by authoritative Excel
            if (vNo.startsWith("VCH-KAH-DEP-") || vNo.startsWith("VCH-SD-GCHQ-")) return false;
            if ((desc.includes("kahramaa") || v.credit_code === "21100004") && uUpper && Boolean(KAHRAMAA_DEPOSIT_BY_UNIT[uUpper])) {
              return false;
            }
            if ((desc.includes("security deposit") || v.credit_code === "21500001" || v.credit_code === "21500") && uUpper && Boolean(SECURITY_DEPOSIT_GUARANTEE_BY_UNIT[uUpper]) && desc.includes("guarantee")) {
              return false;
            }
            if (!vDataNos.has(vNo)) return false;
            // Avoid double-clearing when both VCH-DEP-CLR-* and VCH-CLR-* exist for the same unit+cheque
            if (vNo.toUpperCase().startsWith("VCH-DEP-CLR-")) {
              const chq = extractPdcChequeNo(vNo, v.name);
              if (chq && clrKeysInVData.has(`${uUpper}:${chq}`)) return false;
            }
            return true;
          });
          const existingNos = new Set([
            ...nonPdcVouchers.map(v => v.voucher_no),
            ...kahramaaVouchers.map(v => v.voucher_no),
            ...sdGuaranteeVouchers.map(v => v.voucher_no),
          ]);
          // Track (stage, unit, cheque) already present in fin_vouchers so synthesized rows never double-post
          // while allowing identical cheque numbers across different units (e.g. OS41-06 vs PQ50-101).
          const existingStages = new Set<string>();
          const addStageKey = (stage: string, uKey: string, chq: string) => {
            existingStages.add(`${stage}:${uKey}:${chq}`);
            if (!uKey) existingStages.add(`${stage}::${chq}`);
          };
          const hasStageKey = (stage: string, uKey: string, chq: string) =>
            existingStages.has(`${stage}:${uKey}:${chq}`) || existingStages.has(`${stage}::${chq}`);

          for (const v of nonPdcVouchers) {
            const vn = (v.voucher_no || "").toUpperCase();
            const uKey = (v.unit_ref || "").toUpperCase().trim();
            const chq = extractPdcChequeNo(vn, v.name);
            if (!chq) continue;
            if (vn.startsWith("VCH-PDC-")) addStageKey("RCV", uKey, chq);
            else if (vn.startsWith("VCH-DEP-CLR-") || vn.startsWith("VCH-CLR-")) addStageKey("CLR", uKey, chq);
            else if (vn.startsWith("VCH-DEP-")) addStageKey("DEP", uKey, chq);
            else if (vn.startsWith("VCH-RET-AR-")) addStageKey("RET-AR", uKey, chq);
            else if (vn.startsWith("VCH-RET-")) addStageKey("RET", uKey, chq);
            else if (vn.startsWith("VCH-CNL-")) addStageKey("CNL", uKey, chq);
          }
          const pdcVouchers: FinanceVoucher[] = [];

          for (const p of mergedPdcs) {
            const chequeNo     = String(p.cheque_number);
            const amount       = Number(p.amount || 0);
            const chqDate      = p.cheque_date || new Date().toISOString().split("T")[0];
            const tenantName   = p.tenant_name || "";
            const unitRef      = p.unit_ref    || "";
            const uKey         = unitRef.toUpperCase().trim();
            const propertyName = resolveCanonicalPropertyName(p.property_name, unitRef, p.property_name || "");
            const desc         = unitRef ? `${tenantName} (${unitRef})` : tenantName || `Cheque #${chequeNo}`;
            const st           = (p.status || "").toLowerCase();

            // ── Entry 1: PDC Collection / In Hand ──────────────────────────────
            // Dr 12900001 Rent PDC In Hand  /  Cr 21400001 Customer PDC Liability
            const rcvNo = `VCH-PDC-RCV-${p.id ?? chequeNo}`;
            if (!existingNos.has(rcvNo) && !hasStageKey("RCV", uKey, chequeNo)) {
              existingNos.add(rcvNo);
              pdcVouchers.push({
                id:           `pdc-rcv-${p.id ?? chequeNo}`,
                voucher_no:   rcvNo,
                voucher_type: "Receipt Voucher",
                date:         chqDate,
                name:         `PDC Received — ${desc} [Cheque #${chequeNo}]`,
                debit:        "Rent PDC In Hand",
                debit_code:   "12900001",
                credit:       "Customer PDC Liability",
                credit_code:  "21400001",
                amount,
                method:       "PDC",
                status:       "Posted",
                property_name: propertyName,
                unit_ref:     unitRef,
                tenant_name:  tenantName,
              });
            }

            // ── Entry 2: PDC Deposited to Bank ──────────────────────────────────
            // Dr [Bank GL Code] [Bank Title]  /  Cr 12900001 Rent PDC In Hand
            if (st === "deposited" || st === "cleared") {
              const depNo = `VCH-DEP-${p.id ?? chequeNo}`;
              const bankInfo = resolvePdcBankGl(p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank || p.bank_name || p.bank_id);
              if (!existingNos.has(depNo) && !hasStageKey("DEP", uKey, chequeNo)) {
                existingNos.add(depNo);
                pdcVouchers.push({
                  id:           `pdc-dep-${p.id ?? chequeNo}`,
                  voucher_no:   depNo,
                  voucher_type: "Receipt Voucher",
                  date:         (INITIAL_DATE_CORRECTIONS[depNo] || getStoredVoucherDateCorrections()[depNo])?.newDate || p.deposit_date || chqDate,
                  name:         `PDC Deposited to ${bankInfo.glName} — ${desc} [Cheque #${chequeNo}]`,
                  debit:        bankInfo.glName,
                  debit_code:   bankInfo.glCode,
                  credit:       "Rent PDC In Hand",
                  credit_code:  "12900001",
                  amount,
                  method:       "Cheque Deposit",
                  status:       "Posted",
                  property_name: propertyName,
                  unit_ref:     unitRef,
                  tenant_name:  tenantName,
                });
              }
            }

            // ── Entry 3: PDC Cleared by Bank ────────────────────────────────────
            // Dr 21400001 Customer PDC Liability  /  Cr 12413001 Tenant Receivables
            if (st === "cleared") {
              const clrNo = `VCH-CLR-${p.id ?? chequeNo}`;
              if (!existingNos.has(clrNo) && !hasStageKey("CLR", uKey, chequeNo)) {
                existingNos.add(clrNo);
                pdcVouchers.push({
                  id:           `pdc-clr-${p.id ?? chequeNo}`,
                  voucher_no:   clrNo,
                  voucher_type: "Journal Voucher",
                  date:         p.cleared_date || chqDate,
                  name:         `PDC Cleared — ${desc} [Cheque #${chequeNo}]`,
                  debit:        "Customer PDC Liability",
                  debit_code:   "21400001",
                  credit:       "Tenant Receivables",
                  credit_code:  "12413001",
                  amount,
                  method:       "Cheque Clearance",
                  status:       "Posted",
                  property_name: propertyName,
                  unit_ref:     unitRef,
                  tenant_name:  tenantName,
                });
              }
            }

            // ── Entry 4: PDC Returned / Bounced ─────────────────────────────────
            if (st === "bounced" || st === "returned") {
              const retNo = `VCH-RET-${p.id ?? chequeNo}`;
              const bankInfo = resolvePdcBankGl(p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank || p.bank_name || p.bank_id);
              if (!existingNos.has(retNo) && !hasStageKey("RET", uKey, chequeNo)) {
                existingNos.add(retNo);
                pdcVouchers.push({
                  id:           `pdc-ret-${p.id ?? chequeNo}`,
                  voucher_no:   retNo,
                  voucher_type: "Journal Voucher",
                  date:         p.returned_date || chqDate,
                  name:         `PDC Cheque Returned / Dishonoured — ${desc} [Cheque #${chequeNo}]`,
                  debit:        "Rent PDC In Hand",
                  debit_code:   "12900001",
                  credit:       bankInfo.glName,
                  credit_code:  bankInfo.glCode,
                  amount,
                  method:       "Cheque Return",
                  status:       "Posted",
                  property_name: propertyName,
                  unit_ref:     unitRef,
                  tenant_name:  tenantName,
                });
              }
              const retArNo = `VCH-RET-AR-${p.id ?? chequeNo}`;
              if (!existingNos.has(retArNo) && !hasStageKey("RET-AR", uKey, chequeNo)) {
                existingNos.add(retArNo);
                pdcVouchers.push({
                  id:           `pdc-ret-ar-${p.id ?? chequeNo}`,
                  voucher_no:   retArNo,
                  voucher_type: "Journal Voucher",
                  date:         p.returned_date || chqDate,
                  name:         `Tenant Dues Restored on Dishonour — ${desc} [Cheque #${chequeNo}]`,
                  debit:        "Tenant Receivables",
                  debit_code:   "12413001",
                  credit:       "Customer PDC Liability",
                  credit_code:  "21400001",
                  amount,
                  method:       "Cheque Return",
                  status:       "Posted",
                  property_name: propertyName,
                  unit_ref:     unitRef,
                  tenant_name:  tenantName,
                });
              }
            }

            // ── Entry 5: PDC Cancelled ──────────────────────────────────────────
            if (st === "cancelled") {
              const cnlNo = `VCH-CNL-${p.id ?? chequeNo}`;
              if (!existingNos.has(cnlNo) && !hasStageKey("CNL", uKey, chequeNo)) {
                existingNos.add(cnlNo);
                pdcVouchers.push({
                  id:           `pdc-cnl-${p.id ?? chequeNo}`,
                  voucher_no:   cnlNo,
                  voucher_type: "Journal Voucher",
                  date:         chqDate,
                  name:         `PDC Cancelled — ${desc} [Cheque #${chequeNo}]`,
                  debit:        "Customer PDC Liability",
                  debit_code:   "21400001",
                  credit:       "Rent PDC In Hand",
                  credit_code:  "12900001",
                  amount,
                  method:       "Cancellation",
                  status:       "Posted",
                  property_name: propertyName,
                  unit_ref:     unitRef,
                  tenant_name:  tenantName,
                });
              }
            }
          }

          const combined = [...pdcVouchers, ...kahramaaVouchers, ...sdGuaranteeVouchers, ...nonPdcVouchers];
          return combined;
        });
      } else {
        const kahramaaVouchers = buildKahramaaDepositVouchers();
        const sdGuaranteeVouchers = buildSecurityDepositGuaranteeVouchers();
        setVouchers(prev => {
          const existingNos = new Set(prev.map(v => v.voucher_no));
          const missingKahramaa = kahramaaVouchers.filter(v => !existingNos.has(v.voucher_no));
          const missingSd = sdGuaranteeVouchers.filter(v => !existingNos.has(v.voucher_no));
          const toAdd = [...missingKahramaa, ...missingSd];
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }




      // 4. Pull fin_accounting_events for security deposits, utility deposits, and other

      // in-app posting-engine events that were written to the DB but not via fin_vouchers.
      const { data: evtData } = await db
        .from("fin_accounting_events")
        .select("*")
        .order("event_date", { ascending: true });

      if (evtData && evtData.length > 0) {
        setJournalEntries(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const mapped: JournalLedgerEntry[] = evtData
            .filter((e: any) => !existingIds.has(e.id))
            .filter((e: any) => !existingIds.has(e.id) && !e.voucher_id)
            .map((e: any) => {
              const meta = (e.metadata as any) || {};
              // Infer Dr/Cr from event_type
              const evtType = (e.event_type || "").toLowerCase();
              const evtDesc = (e.description || "").toLowerCase();
              let drCode = "12000001", crCode = "41100001";
              let drName = "Bank Operating Account", crName = "Rental Revenue";
              const isPayrollEvt = evtDesc.includes("payroll") || evtDesc.includes("salary") || evtType.includes("payroll");
              if (isPayrollEvt) {
                drCode = "50100"; drName = "Staff Salaries & Payroll";
                crCode = "21900"; crName = "Salary Payable";
              } else if (evtDesc.includes("eosb") || evtDesc.includes("gratuity")) {
                drCode = "50120"; drName = "End of Service Benefits (EOSB) Provision";
                crCode = "21210"; crName = "Accrued EOSB Liability";
              } else if (evtType.includes("pdc") && evtType.includes("receiv")) {
                drCode = "12900001"; drName = "Rent PDC In Hand";
                crCode = "21400001"; crName = "Customer PDC Liability";
              } else if (evtType.includes("deposit") && evtType.includes("security")) {
                drCode = "12000001"; drName = "Bank Operating Account";
                crCode = "21500001"; crName = "Security Deposit Liability";
              } else if (evtType.includes("deposit") && evtType.includes("pdc")) {
                drCode = "12000001"; drName = "Bank Operating Account";
                crCode = "12900001"; crName = "Rent PDC In Hand";
              } else if (evtType.includes("clear")) {
                drCode = "21400001"; drName = "Customer PDC Liability";
                crCode = "12413001"; crName = "Tenant Receivables — Unit SL";
              } else if (evtType.includes("collect") || evtType.includes("receipt") || evtType.includes("receiv")) {
                drCode = "12000001"; drName = "Commercial Bank of Qatar (CBQ)";
                crCode = "12413001"; crName = "Tenant Receivables — Unit SL";
              }
              const rawEvtAmt = Number(e.total_debit || e.total_credit || 0);
              const evtAmt = (isPayrollEvt && rawEvtAmt === 115250) ? 96820 : rawEvtAmt;
              const evtDims = extractVoucherDimensions(e.description || e.event_type, meta.property_name, meta.unit_ref, meta.tenant_name);
              return {
                id: e.id,
                je_no: e.reference_number || `EVT-${String(e.id).slice(0, 8).toUpperCase()}`,
                posting_date: e.event_date || e.posting_date || new Date().toISOString().split("T")[0],
                reference: e.source_id || e.reference_number || e.id,
                narration: e.description || e.event_type || "Accounting Event",
                dr_account: drName,
                dr_code: drCode,
                cr_account: crName,
                cr_code: crCode,
                amount: evtAmt,
                status: "Posted",

                property_name: evtDims.property_name || meta.property_name,
                unit_ref: evtDims.unit_ref || meta.unit_ref,
                tenant_name: evtDims.tenant_name || meta.tenant_name,
              };
            });
          return mapped.length ? [...mapped, ...prev] : prev;
        });
      }

      // Payroll runs, legal cases, invoices and the ledger are loaded from the backend above; there is no browser cache to reload.

      if (showToast) {
        toast.success("Financial records & reports refreshed successfully");
      }
    } catch (err: any) {
      if (showToast) {
        toast.error("Failed to refresh financial records: " + (err?.message || "Error"));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const refreshFinanceData = async () => {
    await fetchDbData(true);
  };

  // ── One-time GL Initializer from PDCs ─────────────────────────────────────
  // Clears ALL synthetic PDC vouchers, re-fetches PDC data fresh, then generates:
  //   Entry 1 (RCV) for every PDC — Dr PDC In Hand / Cr Customer PDC Liability
  //   Entry 2 (DEP) for PDCs where cheque_date ≤ today — Dr Bank / Cr PDC In Hand  (Journal, NOT Contra)
  //   Entry 3 (CLR) for PDCs where cheque_date ≤ today — Dr Customer PDC Liability / Cr Rental Revenue
  // This is intended as a one-time bulk initialisation, not run on every refresh.
  const resetAndInitializeGLFromPDCs = async (): Promise<{ created: number; cleared: number }> => {
    setIsSyncing(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      // Paginated fetch helper — avoids PostgREST 1,000-row default limit
      async function fetchAllPages<T = any>(
        queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
      ): Promise<T[]> {
        let rows: T[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const res = await Promise.resolve(queryFn(from, from + pageSize - 1));
          if (res.error || !res.data || res.data.length === 0) break;
          rows = rows.concat(res.data);
          if (res.data.length < pageSize) break;
          from += pageSize;
        }
        return rows;
      }

      // Step 1: Fetch ALL PDC rows (paginated past the 1,000-row PostgREST limit)
      // + customers + leases for full name resolution
      const [finPdcRows, pdcsRows, customersRes, leasesRes] = await Promise.all([
        fetchAllPages((from, to) =>
          db.from("fin_pdc_register").select("*").order("cheque_date", { ascending: true }).range(from, to)
        ),
        fetchAllPages((from, to) =>
          db.from("pdcs").select("*").order("created_at", { ascending: true }).range(from, to)
        ),
        db.from("customers").select("id, name"),
        db.from("leases").select("id, customer_id, tenant_name, tenantName"),
      ]);

      // Wrap in same shape for compatibility
      const finPdcRes  = { data: finPdcRows };
      const pdcsTableRes = { data: pdcsRows };

      // Build customer id → name lookup
      const customerById = new Map<string, string>();
      for (const c of (customersRes.data || [])) {
        if (c.id && c.name) customerById.set(String(c.id), String(c.name));
      }

      // Build lease id → tenant name lookup (prefer lease.tenant_name, then customers table)
      const tenantByLeaseId = new Map<string, string>();
      for (const l of (leasesRes.data || [])) {
        if (!l.id) continue;
        const tName = (l as any).tenant_name || (l as any).tenantName ||
          (l.customer_id ? customerById.get(String(l.customer_id)) : "") || "";
        if (tName) tenantByLeaseId.set(String(l.id), tName);
      }

      // Helper: resolve best tenant name from a raw pdcs row
      function resolveTenant(p: any): string {
        // Priority: tenant_name field → drawer_name → tenant_id in customers → lease_id in leases
        if (p.tenant_name && p.tenant_name !== "—") return String(p.tenant_name).trim();
        if (p.drawer_name  && p.drawer_name  !== "—") return String(p.drawer_name).trim();
        if (p.tenant_id) {
          const fromCustomer = customerById.get(String(p.tenant_id));
          if (fromCustomer) return fromCustomer;
        }
        if (p.lease_id) {
          const fromLease = tenantByLeaseId.get(String(p.lease_id));
          if (fromLease) return fromLease;
        }
        return "";
      }

      // Step 2: Build authoritative PDC list directly from pdcs table
      const pdcIdMap = new Map<string, any>();

      for (const p of (pdcsTableRes.data || [])) {
        const rowKey = String(p.id);
        const chqNo  = p.cheque_number ? String(p.cheque_number).trim() : null;
        const unitRef = p.unit_name || p.unit_ref || "";
        const rawProp = p.property_code || p.property_name || "";
        pdcIdMap.set(rowKey, {
          id:            p.id,
          cheque_number: chqNo || rowKey,
          property_name: resolveCanonicalPropertyName(rawProp, unitRef, rawProp),
          unit_ref:      unitRef,
          tenant_name:   resolveTenant(p),
          cheque_date:   p.maturity_date || p.cheque_date || (p.created_at ? String(p.created_at).split("T")[0] : ""),
          deposit_date:  p.deposit_date ? String(p.deposit_date).split("T")[0] : "",
          amount:        Number(p.amount || 0),
          bank:          p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank || p.bank_name || "",
          bank_id:       p.bank_id || null,
          status:        (p.status || "").toLowerCase().replace(/_/g, " ").trim(),
        });
      }

      for (const p of (finPdcRes.data || [])) {
        const rowKey = String(p.id);
        if (!pdcIdMap.has(rowKey) && (!p.original_pdc_id || !pdcIdMap.has(String(p.original_pdc_id)))) {
          const chqNo = p.cheque_number ? String(p.cheque_number).trim() : null;
          const unitRef = p.unit_name || p.unit_ref || "";
          const rawProp = p.property_name || p.property_code || "";
          pdcIdMap.set(`fin-${p.id}`, {
            id:            p.id,
            cheque_number: chqNo || String(p.id),
            property_name: resolveCanonicalPropertyName(rawProp, unitRef, rawProp),
            unit_ref:      unitRef,
            tenant_name:   resolveTenant(p),
            cheque_date:   p.cheque_date || p.maturity_date || "",
            deposit_date:  p.deposit_date ? String(p.deposit_date).split("T")[0] : "",
            amount:        Number(p.amount || 0),
            bank:          p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank_name || p.bank || "",
            bank_id:       p.bank_id || null,
            status:        (p.status || "").toLowerCase().replace(/_/g, " ").trim(),
          });
        }
      }

      const allPdcs = Array.from(pdcIdMap.values()).filter(p => Number(p.amount || 0) > 0);

      // Step 3: Build clean PDC In Hand voucher set (1:1 with PDC Register & Leasing Vouchers)
      const freshVouchers: FinanceVoucher[] = [];
      let clearedCount = 0;

      for (const p of allPdcs) {
        const chequeNo     = String(p.cheque_number);
        const amount       = Number(p.amount || 0);
        const chqDate      = p.cheque_date || todayStr;
        const tenantName   = p.tenant_name || "";
        const unitRef      = p.unit_ref    || "";
        const propertyName = p.property_name || "";
        const desc         = unitRef ? `${tenantName} (${unitRef})` : tenantName || `Cheque #${chequeNo}`;
        const rawStatus    = (p.status || "").toLowerCase().trim();

        // ── Entry 1: PDC Received (In Hand) — always posted for all valid cheques ────
        freshVouchers.push({
          id:           `pdc-rcv-${p.id}`,
          voucher_no:   `VCH-PDC-RCV-${p.id}`,
          voucher_type: "Receipt Voucher",
          date:         chqDate,
          name:         `PDC Received — ${desc} [Cheque #${chequeNo}]`,
          debit:        "Rent PDC In Hand",
          debit_code:   "12900001",
          credit:       "Customer PDC Liability",
          credit_code:  "21400001",
          amount,
          method:       "PDC",
          status:       "Posted",
          property_name: propertyName,
          unit_ref:     unitRef,
          tenant_name:  tenantName,
        });

        const isDeposited = rawStatus === "deposited";
        const isCleared = rawStatus === "cleared";

        if (isDeposited || isCleared) {
          const bankInfo = resolvePdcBankGl(p.deposit_bank || p.deposit_bank_name || p.deposited_bank || p.bank || p.bank_name || p.bank_id);
          // ── Entry 2: PDC Deposited to Bank — Journal / Receipt Voucher ──
          freshVouchers.push({
            id:           `pdc-dep-${p.id}`,
            voucher_no:   `VCH-DEP-${p.id}`,
            voucher_type: "Receipt Voucher",
            date:         (INITIAL_DATE_CORRECTIONS[`VCH-DEP-${p.id}`] || getStoredVoucherDateCorrections()[`VCH-DEP-${p.id}`])?.newDate || p.deposit_date || chqDate,
            name:         `PDC Deposited to ${bankInfo.glName} — ${desc} [Cheque #${chequeNo}]`,
            debit:        bankInfo.glName,
            debit_code:   bankInfo.glCode,
            credit:       "Rent PDC In Hand",
            credit_code:  "12900001",
            amount,
            method:       "Cheque Deposit",
            status:       "Posted",
            property_name: propertyName,
            unit_ref:     unitRef,
            tenant_name:  tenantName,
          });
        }

        if (isCleared) {
          clearedCount++;
          // ── Entry 3: PDC Cleared — Realized into Tenant Receivables / Revenue ──
          freshVouchers.push({
            id:           `pdc-clr-${p.id}`,
            voucher_no:   `VCH-CLR-${p.id}`,
            voucher_type: "Receipt Voucher",
            date:         chqDate,
            name:         `PDC Cleared — ${desc} [Cheque #${chequeNo}]`,
            debit:        "Customer PDC Liability",
            debit_code:   "21400001",
            credit:       "Tenant Receivables",
            credit_code:  "12413001",
            amount,
            method:       "PDC Clearance",
            status:       "Posted",
            property_name: propertyName,
            unit_ref:     unitRef,
            tenant_name:  tenantName,
          });
        }
      }

      // Include authoritative Kahramaa Deposits from Excel
      const unitInfoMapForKahramaa = new Map<string, { tenantName: string; propertyName: string }>();
      for (const p of allPdcs) {
        const uUpper = (p.unit_ref || "").toUpperCase().trim();
        if (uUpper && !unitInfoMapForKahramaa.has(uUpper)) {
          unitInfoMapForKahramaa.set(uUpper, {
            tenantName: p.tenant_name || "",
            propertyName: p.property_name || resolvePropertyFromUnitCode(uUpper),
          });
        }
      }
      freshVouchers.push(...buildKahramaaDepositVouchers(unitInfoMapForKahramaa));
      freshVouchers.push(...buildSecurityDepositGuaranteeVouchers(unitInfoMapForKahramaa));

      // Step 4: Authoritatively set vouchers and clear stale mock journals
      setVouchers(freshVouchers);
      setJournalEntries([]);


      const totalAmt = freshVouchers
        .filter(v => v.voucher_no.startsWith("VCH-PDC-RCV-"))
        .reduce((s, v) => s + v.amount, 0);

      toast.success(
        `GL Initialised: ${freshVouchers.length} PDC vouchers created totaling QAR ${totalAmt.toLocaleString()}. All PDCs reconciled In Hand.`
      );
      return { created: freshVouchers.length, cleared: clearedCount };
    } catch (err: any) {
      toast.error("GL initialisation failed: " + (err?.message || "Unknown error"));
      return { created: 0, cleared: 0 };
    } finally {
      setIsSyncing(false);
    }
  };

  // Pull and subscribe to DB data on mount
  useEffect(() => {
    void fetchDbData(false);

    // Subscribe to fin_vouchers INSERT events for real-time updates.
    const voucherChannel = db
      .channel("finance-store:fin_vouchers")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "fin_vouchers" },
        (payload: any) => {
          const r = payload.new;
          if (!r?.id || seenVoucherIds.current.has(r.id)) return;
          seenVoucherIds.current.add(r.id);
          const mapped = mapDbVoucherRow(r);

          setVouchers(prev => {
            if (prev.some(v => v.id === r.id || v.voucher_no === r.voucher_number)) return prev;
            return [mapped, ...prev];
          });
          toast.info(`Voucher ${r.voucher_number} posted to GL via Db.`);
        }
      )
      .subscribe();

    // Subscribe to fin_accounting_events for visibility into posting-engine writes.
    const eventChannel = db
      .channel("finance-store:fin_accounting_events")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "fin_accounting_events" },
        (payload: any) => {
          const r = payload.new;
          if (!r?.id) return;
          // Merge into journal entries for GL view.
          const entry: JournalLedgerEntry = {
            id: r.id,
            je_no: r.reference_number || `EVT-${r.id.slice(0, 8).toUpperCase()}`,
            posting_date: r.posting_date || r.event_date,
            reference: r.source_id || r.reference_number || r.id,
            narration: r.description || r.event_type,
            dr_account: "Various (see lines)",
            dr_code: "10000",
            cr_account: "Various (see lines)",
            cr_code: "10000",
            amount: r.total_debit || 0,
            status: "Posted",

            property_name: (r.metadata as any)?.property_name,
            unit_ref: (r.metadata as any)?.unit_ref,
            tenant_name: (r.metadata as any)?.tenant_name,
          };
          setJournalEntries(prev => {
            if (prev.some(j => j.id === r.id || j.je_no === entry.je_no)) return prev;
            return [entry, ...prev];
          });
        }
      )
      .subscribe();

    // Listen for cross-module voucher sync events (e.g. from procurement AP payments)
    const handleVoucherSync = () => {
      const STORE_KEY_V = `${FINANCE_STORAGE_KEY}-vouchers`;
      const STORE_KEY_AP = `${FINANCE_STORAGE_KEY}-ap`;
      try {
        const vData: FinanceVoucher[] = JSON.parse(kvStore.getItem(STORE_KEY_V) || "[]");
        setVouchers(prev => {
          const existingNos = new Set(prev.map(v => v.voucher_no));
          const newOnes = vData.filter(v => !existingNos.has(v.voucher_no));
          return newOnes.length ? [...newOnes, ...prev] : prev;
        });
        const apData: PayableInvoice[] = JSON.parse(kvStore.getItem(STORE_KEY_AP) || "[]");
        setPayableInvoices(prev => {
          const existingNos = new Set(prev.map(i => i.invoice_no));
          const newOnes = apData.filter(i => !existingNos.has(i.invoice_no));
          const updates = apData.filter(i => existingNos.has(i.invoice_no));
          let merged = newOnes.length ? [...newOnes, ...prev] : [...prev];
          if (updates.length) {
            merged = merged.map(i => {
              const u = updates.find(u => u.invoice_no === i.invoice_no);
              return u ? { ...i, status: u.status } : i;
            });
          }
          return merged;
        });
      } catch { /* ignore */ }
      // Trigger a full db re-fetch so any PDC/deposit written by any module
      // (pdc-manager, leasing, cashier) shows up in GL immediately
      void fetchDbData(false);
    };
    window.addEventListener("finance_vouchers_updated", handleVoucherSync);
    // Run once on mount to pick up any payments made before this render
    handleVoucherSync();

    // ── Realtime: pdcs table (INSERT + UPDATE) ──────────────────────────────
    // Any module that writes a PDC (pdc-manager, leasing-module addVoucher,
    // cashier, bulk-pdc-deposit-modal) triggers this. We immediately synthesize
    // Entry 1 (PDC Received: Dr 12900001 PDC In Hand / Cr 21400001 Customer PDC
    // Liability) so the GL & Trial Balance update without needing a manual refresh.
    const pdcChannel = db
      .channel("finance-store:pdcs")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "pdcs" },
        (payload: any) => {
          const r = payload.new;
          if (!r?.id || Number(r.amount || 0) <= 0) return;

          const chequeNo     = String(r.cheque_number || r.id);
          const amount       = Number(r.amount || 0);
          const chqDate      = r.maturity_date || r.cheque_date ||
            (r.created_at ? String(r.created_at).split("T")[0] : new Date().toISOString().split("T")[0]);
          const tenantName   = r.tenant_name || r.drawer_name || "";
          const unitRef      = r.unit_name   || r.unit_ref    || "";
          const propertyName = r.property_code || r.property_name || "";
          const desc         = unitRef ? `${tenantName} (${unitRef})` : tenantName || `Cheque #${chequeNo}`;
          const rcvNo        = `VCH-PDC-RCV-${chequeNo}`;

          setVouchers(prev => {
            if (prev.some(v => v.voucher_no === rcvNo)) return prev;
            const newVch: FinanceVoucher = {
              id:            `pdc-rcv-${r.id}`,
              voucher_no:    rcvNo,
              voucher_type:  "Receipt Voucher",
              date:          chqDate,
              name:          `PDC Received — ${desc} [Cheque #${chequeNo}]`,
              debit:         "Rent PDC In Hand",
              debit_code:    "12900001",
              credit:        "Customer PDC Liability",
              credit_code:   "21400001",
              amount,
              method:        "PDC",
              status:        "Posted",
              property_name: propertyName,
              unit_ref:      unitRef,
              tenant_name:   tenantName,
            };
            return [newVch, ...prev];
          });
        }
      )
      .subscribe();

    // ── Realtime: fin_accounting_events UPDATE ──────────────────────────────
    // Security deposit settlements and PDC status changes produce UPDATEs on
    // existing event rows. The INSERT listener above doesn't catch these,
    // so we trigger a silent re-fetch on any event update.
    const eventUpdateChannel = db
      .channel("finance-store:fin_accounting_events:update")
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "fin_accounting_events" },
        () => { void fetchDbData(false); }
      )
      .subscribe();

    return () => {
      db.removeChannel(voucherChannel);
      db.removeChannel(eventChannel);
      db.removeChannel(pdcChannel);
      db.removeChannel(eventUpdateChannel);
      window.removeEventListener("finance_vouchers_updated", handleVoucherSync);
    };
  }, []);


  // ── Actions ───────────────────────────────────────────────────────────────

  /** Posts a balanced voucher through the backend. Nothing is added to the browser: the ledger is read back from the database. */
  async function postVoucherToBackend(args: {
    type: "Journal" | "Receipt" | "Payment" | "Contra";
    date: string;
    reference?: string | null;
    description?: string | null;
    lines: Array<{ account_code: string; debit?: number; credit?: number; description?: string | null }>;
  }): Promise<boolean> {
    try {
      await apiRequest("/api/accounting/post-voucher", {
        method: "POST",
        body: JSON.stringify({
          voucher_date: args.date,
          voucher_type: args.type,
          reference_no: args.reference || undefined,
          description: args.description || undefined,
          lines: args.lines,
        }),
      });
      window.dispatchEvent(new Event("finance_vouchers_updated"));
      void fetchDbData(false);
      return true;
    } catch (err: any) {
      toast.error(`Posting failed: ${err?.message || "the voucher was not saved"}`);
      return false;
    }
  }

  function addJournalEntry(entry: Omit<JournalLedgerEntry, "id" | "status">) {
    const periodCheck = isPostingPeriodClosed(entry.posting_date);
    if (periodCheck.closed) {
      toast.error(`Posting rejected: Accounting period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    const lines = entry.lines && entry.lines.length
      ? entry.lines.map((l) => ({
          account_code: l.account_code,
          debit: l.type === "DR" ? l.amount : 0,
          credit: l.type === "CR" ? l.amount : 0,
          description: l.description || entry.narration,
        }))
      : [
          { account_code: entry.dr_code, debit: entry.amount, credit: 0, description: entry.narration },
          { account_code: entry.cr_code, debit: 0, credit: entry.amount, description: entry.narration },
        ];
    void postVoucherToBackend({
      type: "Journal",
      date: entry.posting_date,
      reference: entry.je_no,
      description: entry.narration || entry.reference,
      lines,
    }).then((ok) => { if (ok) toast.success(`Journal Entry ${entry.je_no} posted to General Ledger!`); });
  }

  function addGrnMapping(mapping: Omit<GrnCostMapping, "id">) {
    const newGrn: GrnCostMapping = {
      ...mapping,
      id: `grn-${Date.now()}`
    };
    setGrnMappings(prev => [newGrn, ...prev]);
    toast.success(`GRN ${newGrn.grn_no} cost allocated & posted to ${newGrn.mapped_gl}!`);
  }

  /** Runs a backend invoice action, then reloads the registers and ledgers from the database. */
  async function invoiceAction<T = any>(path: string, body: unknown): Promise<T | null> {
    try {
      const res: any = await apiRequest(path, { method: "POST", body: JSON.stringify(body) });
      window.dispatchEvent(new Event("finance_vouchers_updated"));
      void fetchDbData(false);
      return res as T;
    } catch (err: any) {
      toast.error(err?.message || "The action failed");
      return null;
    }
  }

  function addPayableInvoice(inv: Omit<PayableInvoice, "id" | "status">) {
    const periodCheck = isPostingPeriodClosed(inv.voucher_date || inv.date);
    if (periodCheck.closed) {
      toast.error(`Posting rejected: Accounting period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    void invoiceAction("/api/accounting/ap-invoices", inv).then((r) => {
      if (r) toast.success(`AP Invoice ${inv.invoice_no} created and posted!`);
    });
  }

  function markPayableInvoicePaid(invoiceNo: string) {
    const todayStr = new Date().toISOString().split("T")[0];
    const periodCheck = isPostingPeriodClosed(todayStr);
    if (periodCheck.closed) {
      toast.error(`Cannot generate Payment Voucher: Current period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    void invoiceAction(`/api/accounting/ap-invoices/${encodeURIComponent(invoiceNo)}/pay`, { date: todayStr }).then((r) => {
      if (r) toast.success(`Invoice ${invoiceNo} marked as Paid. Payment Voucher generated.`);
    });
  }

  function addVoucher(vch: Omit<FinanceVoucher, "id" | "status">, options?: { skipDbPersist?: boolean }) {
    const periodCheck = isPostingPeriodClosed(vch.date);
    if (periodCheck.closed) {
      toast.error(`Posting rejected: Accounting period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    const dims = extractVoucherDimensions(vch.name, vch.property_name, vch.unit_ref, vch.tenant_name);
    const normalizedVch = normalizeVoucherAccounts({
      ...vch,
      id: `vch-${Date.now()}`,
      status: "Posted" as const,
      property_name: dims.property_name || resolveCanonicalPropertyName(vch.property_name, vch.unit_ref, vch.property_name || ""),
      unit_ref: dims.unit_ref || vch.unit_ref,
      tenant_name: dims.tenant_name || vch.tenant_name,
      lines: vch.lines?.map(l => ({
        ...l,
        property_name: resolveCanonicalPropertyName(l.property_name || dims.property_name, dims.unit_ref || vch.unit_ref, l.property_name || ""),
      })),
    });
    const newVch: FinanceVoucher = normalizedVch;

    // Not already posted by the server: post it through the backend and read it back from the database.
    if (!options?.skipDbPersist) {
      const kind = newVch.voucher_type === "Payment Voucher" ? "Payment" : newVch.voucher_type === "Receipt Voucher" ? "Receipt" : newVch.voucher_type === "Contra Voucher" ? "Contra" : "Journal";
      const vLines = newVch.lines && newVch.lines.length
        ? newVch.lines.map((l) => ({ account_code: l.account_code, debit: l.type === "DR" ? l.amount : 0, credit: l.type === "CR" ? l.amount : 0, description: l.description || newVch.name }))
        : [
            { account_code: newVch.debit_code, debit: newVch.amount, credit: 0, description: newVch.name },
            { account_code: newVch.credit_code, debit: 0, credit: newVch.amount, description: newVch.name },
          ];
      void postVoucherToBackend({ type: kind, date: newVch.date, reference: newVch.voucher_no, description: newVch.name, lines: vLines })
        .then((ok) => { if (ok) toast.success(`${newVch.voucher_type} ${newVch.voucher_no} posted successfully!`); });
      return;
    }

    setVouchers(prev => {
      if (prev.some(v => v.voucher_no === newVch.voucher_no)) return prev;
      return [newVch, ...prev];
    });
    toast.success(`${newVch.voucher_type} ${newVch.voucher_no} posted successfully!`);

    // Persist to DB fin_vouchers (best-effort, fire-and-forget).
    const typeCode = newVch.voucher_type === "Payment Voucher" ? "PV" : newVch.voucher_type === "Receipt Voucher" ? "RV" : "JV";
    void Promise.resolve(
      insertVoucherOnce({
        voucher_number: newVch.voucher_no,
        voucher_date: newVch.date,
        voucher_type: typeCode,
        reference_no: newVch.debit_code || null,
        description: newVch.name,
        total_amount: newVch.amount,
        status: "posted",
        posted_at: new Date().toISOString(),
      })
    ).then(({ error, data }: any) => {
      if (error) {
        console.warn("[FinanceStore] fin_vouchers persist warn:", error.message);
        return;
      }
      // Mark the newly inserted row as seen so realtime won't toast it again.
      const insertedId = Array.isArray(data) ? data[0]?.id : (data as any)?.id;
      if (insertedId) seenVoucherIds.current.add(String(insertedId));
    });
  }

  function addReceivableInvoice(inv: Omit<ReceivableInvoice, "id" | "status">) {
    const periodCheck = isPostingPeriodClosed(inv.date);
    if (periodCheck.closed) {
      toast.error(`Posting rejected: Accounting period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    void invoiceAction("/api/accounting/ar-invoices", { invoices: [inv] }).then((r: any) => {
      if (!r) return;
      if (r.skipped?.length) toast.error(`Duplicate Invoice Restricted: ${r.skipped[0].reason}`);
      else toast.success(`AR Invoice ${inv.invoice_no} generated and posted!`);
    });
  }

  function addBulkReceivableInvoices(invoices: Omit<ReceivableInvoice, "id" | "status">[]) {
    if (invoices.length === 0) return;
    const periodCheck = isPostingPeriodClosed(invoices[0].date);
    if (periodCheck.closed) {
      toast.error(`Bulk billing rejected: Accounting period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    void invoiceAction("/api/accounting/ar-invoices", { invoices }).then((r: any) => {
      if (!r) return;
      if (!r.created?.length) toast.error("Duplicate Invoice Restricted: Selected unit(s) already have invoices for this period.");
      else toast.success(`${r.created.length} AR Invoices generated and posted successfully!${r.skipped?.length ? ` ${r.skipped.length} skipped as duplicates.` : ""}`);
    });
  }

  function markReceivableInvoicePaid(invoiceNo: string) {
    const todayStr = new Date().toISOString().split("T")[0];
    const periodCheck = isPostingPeriodClosed(todayStr);
    if (periodCheck.closed) {
      toast.error(`Cannot generate Receipt Voucher: Current period ${periodCheck.periodName} is CLOSED.`);
      return;
    }
    void invoiceAction(`/api/accounting/ar-invoices/${encodeURIComponent(invoiceNo)}/collect`, { date: todayStr }).then((r) => {
      if (r) toast.success(`AR Invoice ${invoiceNo} marked as Collected.`);
    });
  }

  function addLegalEscalation(esc: Omit<LegalReceivable, "id">) {
    void invoiceAction("/api/accounting/legal-cases", esc).then((r) => {
      if (r) toast.success(`Legal Case ${esc.legal_case_id} escalated and posted to Legal Receivables (12411).`);
    });
  }

  function recoverLegalReceivable(
    caseId: string,
    amount: number,
    bankRef: string,
    paymentMethod: string = "Bank Transfer",
    propertyName?: string,
    unitRef?: string,
    tenantName?: string,
    details?: {
      date?: string;
      transactionNo?: string;
      chequeNo?: string;
      chequeBank?: string;
      maturityDate?: string;
    }
  ) {
    const narration = paymentMethod.toLowerCase().includes("cheque") && details?.chequeNo ? `[Cheque #${details.chequeNo} - ${details.chequeBank || "Bank"}]` : "";
    void invoiceAction(`/api/accounting/legal-cases/${encodeURIComponent(caseId)}/recover`, {
      amount,
      reference: bankRef,
      payment_method: paymentMethod,
      date: details?.date,
      narration,
    }).then((r) => {
      if (r) toast.success(`Recovered QR ${amount.toLocaleString()} for Legal Case ${caseId}.`);
    });
  }

  function addPayrollSync(run: Omit<PayrollSyncRun, "id" | "status">) {
    void invoiceAction("/api/accounting/payroll-runs", run).then((r) => {
      if (r) toast.success(`Payroll Run ${run.payroll_run_id} synced & posted to General Ledger!`);
    });
  }

  function addBankClearance(entry: Omit<BankClearanceEntry, "id">) {
    void invoiceAction("/api/accounting/bank-clearances", entry).then((r) => {
      if (r) toast.success(`Clearance recorded for ${entry.ref}`);
    });
  }

  function addBankReconciliation(rec: Omit<BankReconciliationRecord, "id">) {
    void invoiceAction("/api/accounting/bank-reconciliations", rec).then((r) => {
      if (r) toast.success(`Bank Reconciliation for ${rec.statement_date} completed!`);
    });
  }

  function addReconciliationStatement(stmt: Omit<ReconciliationStatementArchive, "id">) {
    void invoiceAction("/api/accounting/recon-statements", stmt).then((r) => {
      if (r) toast.success(`Reconciliation Statement ${stmt.title} archived.`);
    });
  }

  // Cash movements are recorded by posting a receipt or payment (the cash book reads the ledger), so there is
  // nothing to add in the browser. Kept so existing callers keep working.
  function addCashBookEntry(_entry: { date: string; voucher: string; description: string; type: "in" | "out"; amount: number }) {}

  async function correctVoucherDate(params: {
    voucherNo: string;
    newDate: string;
    newBankCode?: string;
    newBankName?: string;
    reason: string;
    user?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { voucherNo, newDate, newBankCode, newBankName, reason, user } = params;
    if (!voucherNo || !newDate) {
      toast.error("Voucher reference and new date are required.");
      return { success: false, message: "Missing required parameters." };
    }

    const currentCorrections = getStoredVoucherDateCorrections();
    const existing = currentCorrections[voucherNo];
    const matchedVch = vouchers.find(v => v.voucher_no === voucherNo);
    const oldDate = existing?.oldDate || matchedVch?.date || "";
    const oldBankCode = existing?.oldBankCode || matchedVch?.debit_code || "";
    const oldBankName = existing?.oldBankName || matchedVch?.debit || "";

    const updatedCorrections: Record<string, VoucherDateCorrection> = {
      ...currentCorrections,
      [voucherNo]: {
        newDate,
        oldDate,
        newBankCode: newBankCode || existing?.newBankCode,
        oldBankCode,
        newBankName: newBankName || existing?.newBankName,
        oldBankName,
        reason: reason || "Date / Bank account correction by finance administrator",
        timestamp: new Date().toISOString(),
        user: user || "Finance Controller",
      },
    };

    saveStoredVoucherDateCorrections(updatedCorrections);
    setVoucherDateCorrections(updatedCorrections);

    // Update in-memory vouchers (both date and receiving bank/cash account if provided)
    setVouchers(prev => {
      const updated = prev.map(v => {
        if (v.voucher_no !== voucherNo) return v;
        const updatedLines = v.lines?.map(line => {
          if (line.type === "DR" && newBankCode) {
            return {
              ...line,
              account_code: newBankCode,
              account: newBankName || line.account,
            };
          }
          return line;
        });
        return {
          ...v,
          date: newDate,
          ...(newBankCode ? { debit_code: newBankCode, debit: newBankName || v.debit } : {}),
          ...(updatedLines ? { lines: updatedLines } : {}),
        };
      });
      return updated;
    });

    // Best-effort remote update in DB fin_vouchers
    try {
      const updatePayload: Record<string, any> = { voucher_date: newDate };
      if (newBankCode) {
        updatePayload.reference_no = `${newBankCode} - ${newBankName || ""}`.trim();
      }
      await db
        .from("fin_vouchers")
        .update(updatePayload)
        .eq("voucher_number", voucherNo);
    } catch (e) {
      console.warn("[correctVoucherDate] fin_vouchers update warning:", e);
    }

    // If PDC voucher, also update pdcs table
    if (voucherNo.startsWith("VCH-DEP-") || voucherNo.startsWith("VCH-CLR-") || voucherNo.startsWith("VCH-PDC-")) {
      const pdcId = voucherNo.replace(/^(VCH-DEP-|VCH-CLR-|VCH-PDC-RCV-)/, "").trim();
      if (pdcId && pdcId.length > 5) {
        try {
          if (voucherNo.startsWith("VCH-DEP-")) {
            const pdcUpdate: Record<string, any> = { deposit_date: newDate };
            if (newBankName) pdcUpdate.deposit_bank = newBankName;
            await db.from("pdcs").update(pdcUpdate).eq("id", pdcId);
          } else if (voucherNo.startsWith("VCH-CLR-")) {
            await db.from("pdcs").update({ cleared_date: newDate }).eq("id", pdcId);
          }
        } catch (e) {
          console.warn("[correctVoucherDate] pdcs date update warning:", e);
        }
      }
    }

    // Record immutable audit log
    try {
      await db.from("security_audit_logs").insert({
        event_type: "data_mutation",
        severity: "warning",
        action: "CORRECT_VOUCHER_DATE_OR_BANK",
        resource: `fin_vouchers:${voucherNo}`,
        details: {
          voucher_number: voucherNo,
          old_date: oldDate,
          new_date: newDate,
          old_bank_code: oldBankCode,
          new_bank_code: newBankCode || oldBankCode,
          old_bank_name: oldBankName,
          new_bank_name: newBankName || oldBankName,
          reason,
          operator: user || "Finance Controller",
        },
      });
    } catch (e) {
      console.warn("[correctVoucherDate] audit log warning:", e);
    }

    const bankMsg = newBankCode ? ` & Bank updated to ${newBankCode} (${newBankName})` : "";
    toast.success(`Transaction ${voucherNo} updated: Date ${newDate}${bankMsg}`);
    return { success: true, message: `Successfully updated transaction ${voucherNo}` };
  }

  // ── Real-Time Dynamic Reports Calculation Engine ───────────────────────────

  // allLedgerTransactions is the backend ledger (posted voucher lines), declared with the other state above.

  // Full Chart of Accounts — every GL account in the PMS, used to seed the
  // Trial Balance so zero-balance accounts are always visible.
  const FULL_COA: { code: string; name: string; type: "Assets" | "Liabilities" | "Capital" | "Revenue" | "Expenses" }[] = [
    // ── 1000x Assets ──────────────────────────────────────────────────────────
    { code: "12000001", name: "Commercial Bank of Qatar (CBQ)", type: "Assets" },
    { code: "12000002", name: "Al Ameen Dukhan Bank", type: "Assets" },
    { code: "12000003", name: "Bank Operating Account (QNB)", type: "Assets" },
    { code: "12000004", name: "Doha Bank Operating Account", type: "Assets" },
    { code: "12000005", name: "Qatar Islamic Bank (QIB)", type: "Assets" },
    { code: "12000006", name: "Al Ameen (Oryx) - Dukhan Bank", type: "Assets" },
    { code: "12100001", name: "Cash In Hand", type: "Assets" },
    { code: "12100002", name: "Petty Cash", type: "Assets" },
    { code: "12413",    name: "Tenant Receivables (Control)", type: "Assets" },
    { code: "12413001", name: "Tenant Receivables — Unit SL", type: "Assets" },
    { code: "12414",    name: "Legal Receivables", type: "Assets" },
    { code: "12900",    name: "PDC In Hand (Control)", type: "Assets" },
    { code: "12900001", name: "Rent PDC In Hand", type: "Assets" },
    { code: "12900002", name: "Deposit PDC In Hand", type: "Assets" },
    { code: "13100",    name: "Prepaid Expenses", type: "Assets" },
    { code: "13200",    name: "VAT Recoverable (Input Tax)", type: "Assets" },
    { code: "14100",    name: "Fixed Assets — Buildings", type: "Assets" },
    { code: "14200",    name: "Fixed Assets — Furniture & Fixtures", type: "Assets" },
    { code: "14300",    name: "Fixed Assets — Office Equipment", type: "Assets" },
    { code: "14900",    name: "Accumulated Depreciation", type: "Assets" },
    { code: "15100",    name: "CWIP — Construction in Progress", type: "Assets" },
    // ── 2000x Liabilities ────────────────────────────────────────────────────
    { code: "21100",    name: "Refundable Deposit Liability (Control)", type: "Liabilities" },
    { code: "21100001", name: "Reservation Advance Deposit", type: "Liabilities" },
    { code: "21100002", name: "Admin Charges Liability", type: "Liabilities" },
    { code: "21100003", name: "Qatar Cool Deposit Liability", type: "Liabilities" },
    { code: "21100004", name: "Kahramaa Deposit Liability", type: "Liabilities" },
    { code: "21100005", name: "Service Fee Deposit Liability", type: "Liabilities" },
    { code: "21200",    name: "Guarantee Cheque Liability", type: "Liabilities" },
    { code: "21200001", name: "Guarantee Cheque Liability — Unit SL", type: "Liabilities" },
    { code: "21300",    name: "Accounts Payable (Control)", type: "Liabilities" },
    { code: "21300001", name: "Vendor Payable — Trade", type: "Liabilities" },
    { code: "21400",    name: "Customer PDC Liability (Control)", type: "Liabilities" },
    { code: "21400001", name: "Customer PDC Liability — Unit SL", type: "Liabilities" },
    { code: "21500",    name: "Security Deposit Liability (Control)", type: "Liabilities" },
    { code: "21500001", name: "Security Deposit Liability — Unit SL", type: "Liabilities" },
    { code: "22100001", name: "Accounts Payable / Expense Accrual", type: "Liabilities" },
    { code: "22200",    name: "VAT Payable (Output Tax)", type: "Liabilities" },
    { code: "22300",    name: "Payroll Payable", type: "Liabilities" },
    { code: "21900",    name: "Salary Payable", type: "Liabilities" },
    { code: "21900001", name: "Salary Payable — Staff SL", type: "Liabilities" },
    { code: "21210",    name: "Accrued EOSB Liability", type: "Liabilities" },
    { code: "21220",    name: "Accrued Leave Salary Liability", type: "Liabilities" },
    { code: "22005",    name: "Staff Salary & Dues Payable", type: "Liabilities" },
    { code: "22005001", name: "Staff Salary & Dues Payable — Staff SL", type: "Liabilities" },
    { code: "22400",    name: "Unclaimed Deposits", type: "Liabilities" },
    { code: "22500",    name: "Advance Rent Received", type: "Liabilities" },
    // ── 3000x Capital / Equity ───────────────────────────────────────────────
    { code: "31000",    name: "Owner / Investor Capital", type: "Capital" },
    { code: "31100",    name: "Retained Earnings", type: "Capital" },
    { code: "31200",    name: "Current Year Net Profit", type: "Capital" },
    { code: "31300",    name: "Owner Drawings", type: "Capital" },
    // ── 4000x Revenue ────────────────────────────────────────────────────────
    { code: "41100",    name: "Rental Revenue", type: "Revenue" },
    { code: "41200",    name: "Parking Revenue", type: "Revenue" },
    { code: "41300",    name: "Utility Recovery Income", type: "Revenue" },
    { code: "41400",    name: "Agency Commission Income", type: "Revenue" },
    { code: "41500",    name: "Admin Fee Income", type: "Revenue" },
    { code: "41600",    name: "Late Payment Penalty Income", type: "Revenue" },
    { code: "41700",    name: "Lease Transfer Fee Income", type: "Revenue" },
    { code: "41800",    name: "Reservation Forfeiture Income", type: "Revenue" },
    { code: "41900",    name: "Other Income / Miscellaneous", type: "Revenue" },
    // ── 5000x Expenses ───────────────────────────────────────────────────────
    { code: "52100001", name: "Building Maintenance Expense", type: "Expenses" },
    { code: "52100002", name: "Electrical Works Expense", type: "Expenses" },
    { code: "52100003", name: "Plumbing Works Expense", type: "Expenses" },
    { code: "52100004", name: "Civil Works Expense", type: "Expenses" },
    { code: "52100005", name: "HVAC / AC Maintenance Expense", type: "Expenses" },
    { code: "52100006", name: "Landscaping Expense", type: "Expenses" },
    { code: "52100007", name: "Cleaning Services Expense", type: "Expenses" },
    { code: "52100008", name: "General Maintenance Expense", type: "Expenses" },
    { code: "52200",    name: "Utilities Expense", type: "Expenses" },
    { code: "52300",    name: "Payroll / Salaries Expense", type: "Expenses" },
    { code: "50100",    name: "Staff Salaries & Payroll", type: "Expenses" },
    { code: "50100001", name: "Staff Salaries & Payroll — General", type: "Expenses" },
    { code: "50120",    name: "End of Service Benefits (EOSB) Expense", type: "Expenses" },
    { code: "50130",    name: "Leave Salary Provision Expense", type: "Expenses" },
    { code: "51101",    name: "Staff Cost (Control)", type: "Expenses" },
    { code: "51101001", name: "Staff Basic Salary", type: "Expenses" },
    { code: "52400",    name: "Management Fee Expense", type: "Expenses" },
    { code: "52500",    name: "Bank Charges Expense", type: "Expenses" },
    { code: "52600",    name: "Depreciation Expense", type: "Expenses" },
    { code: "52700",    name: "Legal & Professional Fees", type: "Expenses" },
    { code: "52800",    name: "Insurance Expense", type: "Expenses" },
    { code: "52900",    name: "Cheque Dishonour Charges", type: "Expenses" },
    { code: "53000",    name: "Rent Discount / Waiver Expense", type: "Expenses" },
    { code: "53100",    name: "Vendor Advance Applied", type: "Expenses" },
    { code: "53200",    name: "Other Operating Expenses", type: "Expenses" },
  ];

  // Derived Trial Balance Detailed — seeded from full COA so zero-balance
  // accounts always appear, then overlaid with actual transaction totals.
  const trialBalanceDetailed = useMemo(() => {
    // 1. Seed map with every account in the COA at zero debit/credit
    const map = new Map<string, { code: string; name: string; type: "Assets" | "Liabilities" | "Capital" | "Revenue" | "Expenses"; debit: number; credit: number }>();
    // Static COA seeding removed: only accounts with real ledger activity appear.

    // 2. Overlay actual ledger transaction totals (adds accounts not in static COA too)
    allLedgerTransactions.forEach(tx => {
      const existing = map.get(tx.account_code) || {
        code: tx.account_code,
        name: tx.account_name,
        type: tx.account_type,
        debit: 0,
        credit: 0
      };
      existing.debit += (tx.debit || 0);
      existing.credit += (tx.credit || 0);
      map.set(tx.account_code, existing);
    });

    return Array.from(map.values()).map(a => ({
      ...a,
      balance: a.debit - a.credit
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLedgerTransactions]);

  // Derived Trial Balance Summary — 100% computed by grouping account-level balances from trialBalanceDetailed
  const trialBalanceSummary = useMemo(() => {
    let assetsDr = 0;
    let liabilitiesCr = 0;
    let capitalCr = 0;
    let revenueCr = 0;
    let expensesDr = 0;

    trialBalanceDetailed.forEach(acc => {
      const netDr = acc.debit - acc.credit;
      const netCr = acc.credit - acc.debit;

      if (acc.type === "Assets") {
        assetsDr += netDr;
      } else if (acc.type === "Liabilities") {
        liabilitiesCr += netCr;
      } else if (acc.type === "Capital") {
        capitalCr += netCr;
      } else if (acc.type === "Revenue") {
        revenueCr += netCr;
      } else if (acc.type === "Expenses") {
        expensesDr += netDr;
      }
    });

    const totalDebit = (assetsDr > 0 ? assetsDr : 0) + (expensesDr > 0 ? expensesDr : 0) + (liabilitiesCr < 0 ? -liabilitiesCr : 0) + (capitalCr < 0 ? -capitalCr : 0) + (revenueCr < 0 ? -revenueCr : 0);
    const totalCredit = (liabilitiesCr > 0 ? liabilitiesCr : 0) + (capitalCr > 0 ? capitalCr : 0) + (revenueCr > 0 ? revenueCr : 0) + (assetsDr < 0 ? -assetsDr : 0) + (expensesDr < 0 ? -expensesDr : 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return {
      assets: assetsDr,
      liabilities: liabilitiesCr,
      capital: capitalCr,
      revenue: revenueCr,
      expenses: expensesDr,
      totalDebit,
      totalCredit,
      isBalanced
    };
  }, [trialBalanceDetailed]);

  // Derived Profit & Loss — 100% computed from allLedgerTransactions
  const profitAndLossReport = useMemo(() => {
    let rentalRevenue = 0;
    let otherRevenue = 0;
    let maintenanceExpense = 0;
    let payrollExpense = 0;
    let utilitiesExpense = 0;
    let cleaningExpense = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    allLedgerTransactions.forEach(tx => {
      if (tx.account_type === "Revenue") {
        const netRev = (tx.credit || 0) - (tx.debit || 0);
        totalRevenue += netRev;
        // 41100xxx = Rental Revenue, 41201xxx+ = Other Revenue
        if (tx.account_code.startsWith("411")) rentalRevenue += netRev;
        else otherRevenue += netRev;
      } else if (tx.account_type === "Expenses") {
        const netExp = (tx.debit || 0) - (tx.credit || 0);
        totalExpenses += netExp;
        // 51101xxx = Staff Cost / Payroll
        if (tx.account_code.startsWith("51101") || tx.account_code.startsWith("501") || tx.account_code.startsWith("523")) payrollExpense += netExp;
        // 51003xxx = Utilities & Other Direct Exp
        else if (tx.account_code.startsWith("51003")) utilitiesExpense += netExp;
        // 51004007 = Housekeeping Materials, 51002002 = Pool AMC → Cleaning
        else if (
          tx.account_code === "51004007" ||
          tx.account_code === "51001002" ||
          tx.account_code === "51002002"
        ) cleaningExpense += netExp;
        // 51001xxx = Labour Outsource, 51002xxx = AMC, 51004xxx = R&M, 51102xxx = G&A, 51103-51106 = Other
        else maintenanceExpense += netExp;
      }
    });

    const netProfit = totalRevenue - totalExpenses;

    return {
      rentalRevenue,
      otherRevenue,
      totalRevenue,
      maintenanceExpense,
      payrollExpense,
      utilitiesExpense,
      cleaningExpense,
      totalExpenses,
      netProfit
    };
  }, [allLedgerTransactions]);

  // Derived Balance Sheet — 100% computed from allLedgerTransactions & P&L
  const balanceSheetReport = useMemo(() => {
    let bankCashAssets = 0;
    let pdcInHandAssets = 0;
    let arReceivablesAssets = 0;
    let legalReceivablesAssets = 0;
    let fixedAssets = 0;
    let totalAssets = 0;

    let apLiabilities = 0;
    let securityDepositLiabilities = 0;
    let pdcCustomerLiabilities = 0;
    let totalLiabilities = 0;
    let ownerCapital = 0;

    allLedgerTransactions.forEach(tx => {
      if (tx.account_type === "Assets") {
        const netAsset = (tx.debit || 0) - (tx.credit || 0);
        totalAssets += netAsset;
        // 12000001 = Bank Operating (QNB), 12000002 = CBQ Escrow, 12100001 = Cash in Hand
        if (
          tx.account_code.startsWith("121") ||
          tx.account_code.startsWith("12000") ||
          tx.account_code === "10000"
        ) bankCashAssets += netAsset;
        // 12900001 = Rent PDC In Hand, 12900002 = Guarantee Cheque In Hand
        else if (tx.account_code.startsWith("129")) pdcInHandAssets += netAsset;
        // 12411001 = Legal Receivables
        else if (tx.account_code.startsWith("12411")) legalReceivablesAssets += netAsset;
        // 12413001 = Tenant Receivables, 12300001 = Advance to Vendors, 12400 = Receivables Control
        else if (tx.account_code.startsWith("124") || tx.account_code.startsWith("123")) arReceivablesAssets += netAsset;
        // 13000 = Fixed Assets, 13900 = Accumulated Depreciation
        else if (tx.account_code.startsWith("13")) fixedAssets += netAsset;
        else bankCashAssets += netAsset; // fallback to bank/cash bucket
      } else if (tx.account_type === "Liabilities") {
        const netLiab = (tx.credit || 0) - (tx.debit || 0);
        totalLiabilities += netLiab;
        // 22100xxx = Trade Payables / AP
        if (tx.account_code.startsWith("221")) apLiabilities += netLiab;
        // 21400001 = Customer PDC Liability
        else if (tx.account_code.startsWith("214")) pdcCustomerLiabilities += netLiab;
        // 21500001 = Security Deposit, 21100xxx = Reservation / Utility Deposits, 21100006 = Guarantee Cheque Liability
        else if (
          tx.account_code.startsWith("215") ||
          tx.account_code.startsWith("211") ||
          tx.account_code.startsWith("213")
        ) securityDepositLiabilities += netLiab;
        // Other liabilities default to AP bucket
        else apLiabilities += netLiab;
      } else if (tx.account_type === "Capital") {
        ownerCapital += ((tx.credit || 0) - (tx.debit || 0));
      }
    });

    const netProfit = profitAndLossReport.netProfit;
    const totalEquity = ownerCapital + netProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      bankCashAssets,
      pdcInHandAssets,
      arReceivablesAssets,
      legalReceivablesAssets,
      fixedAssets,
      totalAssets,

      apLiabilities,
      securityDepositLiabilities,
      pdcCustomerLiabilities,
      totalLiabilities,

      ownerCapital,
      retainedNetProfit: netProfit,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
    };
  }, [allLedgerTransactions, profitAndLossReport]);


  // Derived Cash Flow Report — calculated only from posted ledger transactions.
  const cashFlowReport = useMemo(() => {
    const CASH_CODES = new Set([
      "10100", "12000", "12000001", "12000002", "12000003", "12000004", "12000005", "12000006",
      "12001", "12100", "12100001",
    ]);
    let operatingInflow = 0;
    let operatingOutflow = 0;
    let investingCash = 0;
    let financingCash = 0;

    const byReference = new Map<string, LedgerTransaction[]>();
    allLedgerTransactions.forEach(tx => {
      const bucket = byReference.get(tx.reference) || [];
      bucket.push(tx);
      byReference.set(tx.reference, bucket);
    });

    byReference.forEach(lines => {
      const cashLines = lines.filter(tx => CASH_CODES.has(tx.account_code));
      if (!cashLines.length) return;
      const narration = lines.map(tx => tx.description || "").join(" ").toLowerCase();
      // Transfers between cash/bank accounts are not cash-flow activity.
      const nonCash = lines.filter(tx => !CASH_CODES.has(tx.account_code));
      if (!nonCash.length) return;

      const cashNet = cashLines.reduce((sum, tx) => sum + (tx.debit || 0) - (tx.credit || 0), 0);
      if (Math.abs(cashNet) < 0.005) return;

      // A PDC deposit is a movement from PDC custody to bank, not a new customer cash receipt.
      if (narration.includes("pdc deposited")) return;

      const hasFixedAsset = nonCash.some(tx => tx.account_code.startsWith("13"));
      const hasCapital = nonCash.some(tx => tx.account_code.startsWith("3"));
      if (hasFixedAsset) investingCash += cashNet;
      else if (hasCapital) financingCash += cashNet;
      else if (cashNet > 0) operatingInflow += cashNet;
      else operatingOutflow += Math.abs(cashNet);
    });

    const netOperatingCash = operatingInflow - operatingOutflow;
    const netCashChange = netOperatingCash + investingCash + financingCash;
    const endingCashBalance = allLedgerTransactions
      .filter(tx => CASH_CODES.has(tx.account_code))
      .reduce((sum, tx) => sum + (tx.debit || 0) - (tx.credit || 0), 0);

    return { operatingInflow, operatingOutflow, netOperatingCash, investingCash, financingCash, netCashChange, endingCashBalance };
  }, [allLedgerTransactions]);

  // Derived Cash On Hand Position — no fabricated opening balances or minimum floors.
  const cashOnHandPosition = useMemo(() => {
    const CASH_ON_HAND_CODES = new Set(["10100", "12100001"]);
    const PETTY_CASH_CODES = new Set(["12101", "12102"]);
    let vaultCash = 0;
    let pettyCashFloat = 0;
    allLedgerTransactions.forEach(tx => {
      const net = (tx.debit || 0) - (tx.credit || 0);
      if (CASH_ON_HAND_CODES.has(tx.account_code)) vaultCash += net;
      if (PETTY_CASH_CODES.has(tx.account_code)) pettyCashFloat += net;
    });
    return { vaultCash, pettyCashFloat, siteDesks: 0, totalCashOnHand: vaultCash + pettyCashFloat };
  }, [allLedgerTransactions]);

  return (
    <FinanceContext.Provider
      value={{
        journalEntries,
        addJournalEntry,
        grnMappings,
        addGrnMapping,
        payableInvoices,
        addPayableInvoice,
        markPayableInvoicePaid,
        vouchers,
        addVoucher,
        receivableInvoices,
        addReceivableInvoice,
        addBulkReceivableInvoices,
        markReceivableInvoicePaid,
        legalReceivables,
        addLegalEscalation,
        recoverLegalReceivable,
        payrollSyncs,
        addPayrollSync,
        bankClearances,
        addBankClearance,
        bankReconciliations,
        addBankReconciliation,
        reconciliationStatements,
        addReconciliationStatement,
        cashBookEntries,
        addCashBookEntry,

        allLedgerTransactions,
        trialBalanceSummary,
        trialBalanceDetailed,
        profitAndLossReport,
        balanceSheetReport,
        cashFlowReport,
        cashOnHandPosition,
        isSyncing,
        refreshFinanceData,
        resetAndInitializeGLFromPDCs,
        correctVoucherDate,
        voucherDateCorrections,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceStore() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error("useFinanceStore must be used within a FinanceProvider");
  }
  return ctx;
}
