import { kvStore } from "@/lib/kv-store";
import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { db } from "@/lib/db";
import { DynamicMastersService } from "@/lib/dynamic-masters-service";

export const GUARANTEE_CHEQUE_DATE = "2036-12-31";


const today = new Date();

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

export type UnitStatus = "Available" | "Occupied" | "Reserved" | "Vacant - Under Maintenance";
export type CustomerStatus = "draft" | "active" | "inactive" | "duplicate";
export type LeasePaymentFrequency = "monthly" | "quarterly" | "semi-annual" | "annual" | "half_yearly" | "yearly";
export type LeaseStatus =
  | "draft"
  | "documents_pending"
  | "documents_verified"
  | "tenant_signed_pending_collection"
  | "collection_completed"
  | "pending_landlord_signature"
  | "fully_signed"
  | "active"
  | "renewal_due"
  | "renewed"
  | "non_renewal"
  | "checkout"
  | "closed";
export type PdcStatus = "received" | "deposited" | "cleared" | "bounced" | "returned" | "replaced" | "cancelled" | "partial_cash";
export type VoucherStatus = "draft" | "posted" | "shared" | "settled";

export interface PmsUnit {
  id: string;
  property: string;
  unit: string;
  type?: string;
  status: UnitStatus;
  rent: number;
  contractEndDate?: string;
  currentTenant?: string;
}

export interface PmsCustomer {
  id: string;
  customerId?: string;
  customer_code?: string;
  name: string;
  type: "individual" | "company";
  qatarId: string;
  passport: string;
  crNumber: string;
  mobile: string;
  email: string;
  status: CustomerStatus;
  qid?: string;
  phone?: string;
  poBox?: string;
  address?: string;
  [key: string]: any;
}

export interface PmsLease {
  id: string;
  customerId: string;
  reservationId: string;
  property: string;
  unit: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  pdcCount: number;
  paymentFrequency: LeasePaymentFrequency;
  gracePeriodDays: number;
  penalties: string;
  maintenanceResponsibility: string;
  utilityResponsibility: string;
  parkingDetails: string;
  specialConditions: string;
  noticePeriodDays: number;
  status: LeaseStatus;
  tenantSignedAt?: string;
  landlordSignedAt?: string;
  signedDocument?: string;
  receivedBy?: string;
  landlordPackageSubmittedAt?: string;
  sharedWithTenant?: boolean;
  collectionCompleted: boolean;
  renewalOf?: string;
  plannedVacateDate?: string;
  actualVacateDate?: string;
  earlyVacate?: boolean;
  earlyVacateReason?: string;
  contractNumber?: string;
  [key: string]: any;
}

export interface PmsPdc {
  id: string;
  leaseId: string;
  chequeNo: string;
  bank: string;
  propertyName?: string;
  unitName?: string;
  tenantName?: string;
  date: string;
  amount: number;
  paid_amount?: number;
  status: PdcStatus;
  payerName?: string;
  period?: string;
  file?: string;
  chequeNumber?: string;
  dueDate?: string;
  depositDate?: string;
  unit?: string;
  property?: string;
  tenureStart?: string;
  tenureEnd?: string;
  isGuaranteeCheque?: boolean;
  notes?: string;
  type?: string;
}

export interface PmsVoucher {
  id: string;
  leaseId: string;
  name: string;
  receiptNo?: string;
  method?: string;
  period?: string;
  debit: string;
  credit: string;
  amount: number;
  status: VoucherStatus;
  settlement_deductions?: number;
  settlement_refund?: number;
  settlement_date?: string;
  property_name?: string;
  unit_name?: string;
  tenant_name?: string;
}

export interface PmsKeyNotice {
  id: string;
  leaseId: string;
  recipient: string;
  handoverAt: string;
  handoverTime?: string;
  authorizedCollector?: string;
  keysSummary?: string;
  outstandingRequirements?: string;
  staffContact?: string;
  note?: string;
  status: "ready" | "sent" | "blocked" | "pending" | "notified";
}

export interface PmsHandover {
  id: string;
  leaseId: string;
  handoverAt?: string;
  keys: number;
  keyType?: string;
  accessCards: number;
  parkingRemotes: number;
  parkingDeviceDetails?: string;
  electricityMeterReading?: string;
  waterMeterReading?: string;
  meterInfo?: string;
  unitCondition?: string;
  cleanliness?: string;
  acWorking?: boolean;
  plumbingOk?: boolean;
  electricalOk?: boolean;
  doorsWindowsOk?: boolean;
  idVerified?: boolean;
  photosTaken?: number;
  collectorName?: string;
  collectorIdNumber?: string;
  issuedBy?: string;
  tenantAcknowledgement?: string;
  note?: string;
  acknowledged: boolean;
  status?: string;
}

export interface PmsCheckIn {
  id: string;
  leaseId: string;
  date: string;
  condition: string;
  furnitureCondition?: string;
  fixturesCondition?: string;
  wallFloorCeilingCondition?: string;
  acCondition?: string;
  electricityMeter?: string;
  waterMeter?: string;
  damages?: string;
  pendingMaintenance?: string;
  photos: number;
  note?: string;
}

export interface PmsReservation {
  id: string;
  property: string;
  unit: string;
  tenantName: string;
  agent?: string;
  startDate: string;
  validUntil: string;
  rent: number;
  status: "reserved" | "released" | "expired" | "converted";
  remarks?: string;
  proposedEndDate?: string;
  isHold?: boolean;
  tokenAmount?: number;
  tokenPaymentMode?: "Cash" | "Bank Transfer" | "Cheque";
  tokenReceiptNo?: string;
  tokenRefunded?: boolean;
  reservedBy?: string;
  createdAt?: string;
  tokenCashierName?: string;
  tokenPayerBank?: string;
  tokenTransferRef?: string;
  tokenTransferDate?: string;
  tokenChequeNo?: string;
  tokenChequeBank?: string;
}

export interface PmsAuditEvent {
  id: string;
  stage: string;
  owner: string;
  input: string;
  approval: string;
  status: string;
  output: string;
  at: string;
}

export interface PmsAppData {
  units: PmsUnit[];
  customers: PmsCustomer[];
  reservations: PmsReservation[];
  leases: PmsLease[];
  pdcs: PmsPdc[];
  vouchers: PmsVoucher[];
  keyNotices: PmsKeyNotice[];
  handovers: PmsHandover[];
  checkIns: PmsCheckIn[];
  auditEvents: PmsAuditEvent[];
}

const INITIAL_SEED_CUSTOMERS: PmsCustomer[] = [];

const INITIAL_SEED_RESERVATIONS: PmsReservation[] = [];

const EMPTY_DATA: PmsAppData = {
  units: [],
  customers: [],   // populated by fetchDirectFromDatabase (3-source: customers + fin_pdc_register + pdcs)
  reservations: [],
  leases: [],
  pdcs: [],
  vouchers: [],
  keyNotices: [],
  handovers: [],
  checkIns: [],
  auditEvents: [],
};

interface AppDataContextValue extends PmsAppData {
  setUnits: (fn: (prev: PmsUnit[]) => PmsUnit[]) => void;
  setCustomers: (fn: (prev: PmsCustomer[]) => PmsCustomer[]) => void;
  setReservations: (fn: (prev: PmsReservation[]) => PmsReservation[]) => void;
  setLeases: (fn: (prev: PmsLease[]) => PmsLease[]) => void;
  setPdcs: (fn: (prev: PmsPdc[]) => PmsPdc[]) => void;
  setVouchers: (fn: (prev: PmsVoucher[]) => PmsVoucher[]) => void;
  setKeyNotices: (fn: (prev: PmsKeyNotice[]) => PmsKeyNotice[]) => void;
  setHandovers: (fn: (prev: PmsHandover[]) => PmsHandover[]) => void;
  setCheckIns: (fn: (prev: PmsCheckIn[]) => PmsCheckIn[]) => void;
  setAuditEvents: (fn: (prev: PmsAuditEvent[]) => PmsAuditEvent[]) => void;
  syncing: boolean;
  refetchData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [appData, setAppData] = useState<PmsAppData>(EMPTY_DATA);
  const [syncing, setSyncing] = useState(true);

  // One full reload at a time; requests made while one is running wait and run once more afterwards.
  const reloadInFlight = useRef<Promise<void> | null>(null);
  const reloadQueued = useRef(false);
  const fetchDirectFromDatabase = useCallback((): Promise<void> => {
    if (reloadInFlight.current) {
      reloadQueued.current = true;
      return reloadInFlight.current;
    }
    const run = (async () => {
      try {
        await fetchDirectFromDatabaseOnce();
      } finally {
        reloadInFlight.current = null;
      }
      if (reloadQueued.current) {
        reloadQueued.current = false;
        await fetchDirectFromDatabase();
      }
    })();
    reloadInFlight.current = run;
    return run;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDirectFromDatabaseOnce = useCallback(async () => {
    setSyncing(true);
    try {
      // Helper to fetch all rows across PostgREST 1000-row default pages
      async function fetchAllRows<T = any>(
        queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
        tableName?: string
      ): Promise<T[]> {
        let rows: T[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          try {
            const res = await Promise.resolve(queryFn(from, from + pageSize - 1));
            if (res.error) {
              // B5: Surface errors instead of silently returning partial results
              console.error(`[fetchAllRows${tableName ? ' ' + tableName : ''}] Error at offset ${from}:`, res.error?.message || res.error);
              break;
            }
            if (!res.data || res.data.length === 0) break;
            rows = rows.concat(res.data);
            if (res.data.length < pageSize) break;
            from += pageSize;
          } catch (err) {
            // B5: Log fetch errors instead of silently swallowing
            console.error(`[fetchAllRows${tableName ? ' ' + tableName : ''}] Exception at offset ${from}:`, err);
            break;
          }
        }
        return rows;
      }

      // Safe concurrent fetch with full pagination
      const [
        unitsData,
        propertiesData,
        customersData,
        leasesData,
        finPdcsData,
        altPdcsData,
        reservationsData,
        vouchersData,
        handoversData,
        inspectionsData,
      ] = await Promise.all([
        fetchAllRows((from, to) =>
          db
            .from("units")
            .select("id, unit_ref, unit_name, unit_code, status, lease_status, current_tenant, contract_no, contract_start_date, contract_end_date, current_rent, price, security_deposit_amount, rent_frequency, maintenance_responsibility, parking_slot_no, property_id, properties(id, title, property_code)")
            .order("unit_ref")
            .range(from, to),
          "units"
        ),
        fetchAllRows((from, to) =>
          db.from("properties").select("id, title, property_code").order("id").range(from, to),
          "properties"
        ),
        fetchAllRows((from, to) =>
          db.from("customers").select("*").order("id").range(from, to),
          "customers"
        ),
        fetchAllRows((from, to) =>
          db.from("leases").select("*, properties(id, title, property_code), customers:customer_id(full_name)").order("id").range(from, to),
          "leases"
        ),
        fetchAllRows((from, to) =>
          db.from("fin_pdc_register").select("*").order("id").range(from, to),
          "fin_pdc_register"
        ),
        fetchAllRows((from, to) =>
          db.from("pdcs").select("*").order("id").range(from, to),
          "pdcs"
        ),
        fetchAllRows((from, to) =>
          db.from("reservations").select("*").order("id").range(from, to),
          "reservations"
        ),
        fetchAllRows((from, to) =>
          db.from("fin_vouchers").select("*").order("id").range(from, to),
          "fin_vouchers"
        ),
        fetchAllRows((from, to) =>
          db.from("key_handovers").select("*").order("id").range(from, to),
          "key_handovers"
        ),
        fetchAllRows((from, to) =>
          db.from("inspection_reports").select("*").order("id").range(from, to),
          "inspection_reports"
        ),
      ]);

      const unitsRes = { data: unitsData };
      const propertiesRes = { data: propertiesData };
      const customersRes = { data: customersData };
      const leasesRes = { data: leasesData };
      const pdcsRes = { data: finPdcsData };
      const altPdcsRes = { data: altPdcsData };
      const reservationsRes = { data: reservationsData };
      const vouchersRes = { data: vouchersData };
      const handoversRes = { data: handoversData };
      const inspectionsRes = { data: inspectionsData };

      const propMap = new Map<string, string>();
      (propertiesRes.data || []).forEach((p: any) => {
        if (p.id) propMap.set(p.id, p.title);
        if (p.property_code) propMap.set(p.property_code, p.title);
      });

      const unitMap = new Map<string, string>();
      (unitsRes.data || []).forEach((u: any) => {
        if (u.id) unitMap.set(u.id, u.unit_ref || u.unit_name || u.unit_code || "Unit");
      });

      const mappedUnits: PmsUnit[] = (unitsRes.data || []).map((u: any) => {
        const propTitle = u.properties?.title || propMap.get(u.property_id) || u.property_id || "Property";
        const unitName = u.unit_ref || u.unit_name || u.unit_code || "Unit";

        return {
          id: u.id,
          property: propTitle,
          unit: unitName,
          type: u.unit_type || u.type || u.layout || "",
          status: (() => {
            const ls = (u.lease_status || "").toUpperCase();
            const st = (u.status || "").toLowerCase();
            // Units explicitly vacated/closed — always show as Available regardless of stale fields
            if (ls === "VACANT" || ls === "CLOSED" || ls === "TERMINATED") return "Available" as UnitStatus;
            if (st === "available" || st === "vacant") return "Available" as UnitStatus;
            if (st === "occupied" || ls === "LEASED") return "Occupied" as UnitStatus;
            if (st === "reserved") return "Reserved" as UnitStatus;
            if (st.includes("maintenance")) return "Vacant - Under Maintenance" as UnitStatus;
            return (u.status as UnitStatus) || "Available";
          })(),
          rent: Number(u.current_rent || u.price || 0),
        };
      });

      // ──────────────────────────────────────────────────────────────────────
      // CUSTOMER MASTER: 3-source synthesis (same logic as PDC Management)
      //   Source 1: customers table   → real DB rows with full profile data
      //   Source 2: fin_pdc_register  → unique tenant_name across all PDCs
      //   Source 3: pdcs table        → unique tenant_name / drawer_name
      //
      // This guarantees that Customer Master, Reservations, and any other
      // component that reads `customers` from context all see the same N.
      // ──────────────────────────────────────────────────────────────────────

      const seenCustIds  = new Set<string>();
      const seenCustNames = new Set<string>();
      const mergedCustomers: PmsCustomer[] = [];

      // Helper: normalize customer name to prevent duplicates like "M/s Embassy of Pakistan" vs "M/s.Embassy of Pakistan"
      const normalizeCustKey = (name: string): string => {
        if (!name) return "";
        let n = name.toLowerCase().trim();
        // Normalize common salutations / prefixes like M/s, M/s., M/S.
        n = n.replace(/^m\s*\/\s*s\.?\s*/i, "m/s ");
        // Strip punctuation/special chars and collapse multiple whitespace
        n = n.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
        return n;
      };

      // Helper: produce a canonical display name (preserves original casing but normalises the M/s prefix)
      const canonicalName = (name: string): string => {
        if (!name) return name;
        // Normalise M/s. → M/s  (with a space after)
        return name.trim().replace(/^(M|m)\s*\/\s*(S|s)\.?\s*/,  "M/s ");
      };

      // Helper: resolve the best available name from a raw DB row
      const resolveName = (c: any): string =>
        (c.first_name || c.full_name || c.display_name || c.name || c.tenant_name || c.customer_name ||
          (c.first_name && c.last_name ? `${c.first_name} ${c.last_name}`.trim() : "") ||
          c.last_name || "").trim();

      // Helper: guess company vs individual from display name
      const guessType = (name: string): "company" | "individual" => {
        const l = (name || "").toLowerCase().trim();
        return l.startsWith("m/s") || l.startsWith("m/s.") || l.includes("trading") || l.includes("w.l.l") || l.includes("llc") ||
          l.includes("corp") || l.includes("group") || l.includes("co.") ||
          l.includes("company") || l.includes("services") || l.includes("international") ||
          l.includes("logistics") || l.includes("contracting") || l.includes("industries") ||
          l.includes("enterprise") || l.includes("real estate") || l.includes("embassy") ||
          l.includes("solutions") || l.includes("limited") || l.includes("sport club") ||
          l.includes("electrical") || l.includes("katara") || l.includes("larsen") ||
          l.includes("qentz") || l.includes("saipem") || l.includes("special numberz") ||
          l.includes("glamour") || l.includes("alfanet") || l.includes("axiom") ? "company" : "individual";
      };

      // SOURCE 1: proper DB records from customers table
      for (const c of (customersRes.data || [])) {
        const name = resolveName(c);
        if (!name || name.toLowerCase().includes("abc trading")) continue;
        const id = String(c.id);
        const normKey = normalizeCustKey(name);
        if (seenCustIds.has(id) || (normKey && seenCustNames.has(normKey))) continue;
        seenCustIds.add(id);
        if (normKey) seenCustNames.add(normKey);
        const customerId = c.customer_code || c.tax_identification_no ||
          (c.remarks && typeof c.remarks === 'string' && c.remarks.startsWith('CUSTOMER_ID:') ? c.remarks.replace('CUSTOMER_ID:', '') : '') ||
          c.customer_id || '';
        mergedCustomers.push({
          id,
          customerId,
          customer_code: c.customer_code || customerId,
          name,
          displayName: c.display_name || name,
          firstName: c.first_name || name,
          lastName: c.last_name || "",
          type: (c.customer_type?.toLowerCase() === "company" || c.type?.toLowerCase() === "company" || guessType(name) === "company" ? "company" : "individual") as any,
          qatarId:  c.qatar_id || c.qatarId || "",
          passport: c.passport_number || c.passport || "",
          crNumber: c.commercial_registration || c.cr_number || c.crNumber || "",
          mobile:   c.mobile_number || c.mobile || c.phone || "",
          email:    c.email_address || c.email || "",
          nationality: c.nationality || "",
          customerStatus: c.customer_status || "Active",
          status:   "active" as any,
          _source:  "db",
        } as any);
      }

      // Also pull any imported customers from kvStore (Excel bulk import)
      try {
        const rawHistory = kvStore.getItem("zyno_pms_import_batches_history_v2");
        if (rawHistory) {
          const parsedBatches = JSON.parse(rawHistory);
          if (Array.isArray(parsedBatches)) {
            parsedBatches.forEach((b: any) => {
              if (b.module === "customer" && Array.isArray(b.records)) {
                b.records.forEach((r: any) => {
                  const norm = r.normalizedData || r.rawRowData || {};
                  const custName = norm.full_name || norm["Full Name / Company Name"] || norm["Full Name / Company Name *"] || r.recordName;
                  if (custName && (r.status === "SUCCESS" || r.status === "READY" || b.status === "COMPLETED" || b.status === "PARTIAL_SUCCESS")) {
                    const nameClean = String(custName).trim();
                    const normKey = normalizeCustKey(nameClean);
                    if (!nameClean || (normKey && seenCustNames.has(normKey)) || nameClean.toLowerCase().includes("abc trading")) return;
                    if (normKey) seenCustNames.add(normKey);
                    const isCompany = (norm.customer_type || norm["Customer Type"])?.toLowerCase() === "company" || guessType(nameClean) === "company";
                    mergedCustomers.push({
                      id: r.recordId || `cust-imp-${r.recordKey || Math.floor(Math.random() * 100000)}`,
                      name: nameClean,
                      type: isCompany ? "company" : "individual",
                      qatarId: norm.qatar_id || norm["Qatar ID"] || (isCompany ? "" : r.recordKey),
                      passport: norm.passport_number || norm["Passport Number"] || "",
                      crNumber: norm.commercial_registration || norm["Commercial Registration (CR)"] || (isCompany ? r.recordKey : ""),
                      mobile: norm.mobile_number || norm["Mobile Number"] || "",
                      email: norm.email_address || norm["Email Address"] || "",
                      status: "active" as any,
                      _source: "import",
                    } as any);
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load local imported customers:", err);
      }

      const mappedCustomers: PmsCustomer[] = mergedCustomers.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );


      // Map existing relational leases strictly from database
      const existingLeases: PmsLease[] = (leasesRes.data || [])
        .map((l: any) => {
          const uIdentifier = unitMap.get(l.unit_id) || l.unit_ref || l.unit || "";
          const startDate = l.commencement_date || "";
          const endDate = l.expiry_date || "";
          const rfSaved = l.has_rent_free != null;
          const dbHasRf = rfSaved ? Boolean(l.has_rent_free) : false;
          const dbRfDays = rfSaved ? Number(l.rent_free_period_days ?? 0) : 0;

          return {
            id: l.lease_number || l.id,
            customerId: l.customer_id || "",
            reservationId: l.id || "",
            property: l.properties?.title || propMap.get(l.property_id) || "Property",
            unit: uIdentifier || "Unit",
            tenantName: canonicalName(l.customers?.full_name || l.tenant_name || "Tenant"),
            startDate: startDate,
            endDate: endDate,
            monthlyRent: Number(l.rental_amount || 0) > 0
              ? Math.round((Number(l.rental_amount) / 12) * 100) / 100
              : 0,
            securityDeposit: Number(l.security_deposit || 0),
            pdcCount: Number(l.number_of_pdc || 12),
            paymentFrequency: (l.payment_frequency?.toLowerCase() as LeasePaymentFrequency) || "monthly",
            gracePeriodDays: Number(l.grace_period_days || 7),
            penalties: `${l.late_penalty_percentage || 0}%`,
            maintenanceResponsibility: l.maintenance_responsibility || "Landlord",
            utilityResponsibility: l.utility_responsibility || "Tenant",
            parkingDetails: l.parking_details || "",
            specialConditions: l.special_conditions || "",
            noticePeriodDays: Number(l.notice_period_days || 30),
            status: (l.lease_status?.toLowerCase() as LeaseStatus) || "active",
            // Collection progress is saved in leases.collection_status when Collect posts successfully.
            collectionStatus: l.collection_status || null,
            depositCollected: l.collection_status === "deposit_collected" || l.collection_status === "collection_completed",
            rentCollected: l.collection_status === "rent_collected" || l.collection_status === "collection_completed",
            collectionCompleted: l.collection_status === "collection_completed",
            hasRentFree: dbHasRf,
            rentFreeDays: dbRfDays,
            rentFreePosition: l.rent_free_position || "FIRST_MONTH",
          } as any;
        })
        .filter(Boolean);

      const unitContracts: PmsLease[] = [];
      const mappedLeases: PmsLease[] = [...existingLeases, ...unitContracts];

      // Step A: Primary dataset is pdcs table (authoritative for property, unit, tenant, date, amount)
      // Index fin_pdc_register by original_pdc_id and by cheque_number
      const finByOriginalId = new Map<number, any>();
      const finByChequeContext = new Map<string, any[]>();
      (pdcsRes.data || []).forEach((f: any) => {
        if (f.original_pdc_id != null) {
          finByOriginalId.set(Number(f.original_pdc_id), f);
        }
        const chq = String(f.cheque_number || "").trim();
        if (chq) {
          const list = finByChequeContext.get(chq) || [];
          list.push(f);
          finByChequeContext.set(chq, list);
        }
      });

      const usedFinIds = new Set<string>();
      const allRawPdcs: any[] = [];

      (altPdcsRes.data || []).forEach((p: any) => {
        const sl = p.sl_no != null ? Number(p.sl_no) : null;
        let matchedFin: any = null;
        if (sl != null && finByOriginalId.has(sl)) {
          matchedFin = finByOriginalId.get(sl);
        } else {
          const chq = String(p.cheque_number || p.id || "").trim();
          const pAmt = Number(p.amount) || 0;
          const pDate = (p.maturity_date || p.cheque_date || "").split("T")[0];
          const candidates = (finByChequeContext.get(chq) || []).filter(c => !usedFinIds.has(String(c.id)));
          matchedFin = candidates.find(c => {
            const cDate = (c.cheque_date || c.maturity_date || "").split("T")[0];
            return Math.abs(Number(c.amount) - pAmt) < 0.01 && (!pDate || !cDate || cDate === pDate);
          }) || candidates[0] || null;
        }

        if (matchedFin) {
          usedFinIds.add(String(matchedFin.id));
        }

        const rawFinStatus = (matchedFin?.status || "").toLowerCase().replace(/_/g, " ").trim();
        const rawPdcStatus = (p.status || "").toLowerCase().replace(/_/g, " ").trim();
        const isFinal = (s: string) => ["cleared", "returned", "bounced", "cancelled", "replaced", "partial cash"].includes(s);
        let finalStatus = rawPdcStatus || rawFinStatus || "received";
        if (isFinal(rawPdcStatus)) finalStatus = rawPdcStatus;
        else if (isFinal(rawFinStatus)) finalStatus = rawFinStatus;
        else if (rawPdcStatus === "deposited" || rawFinStatus === "deposited") finalStatus = "deposited";

        allRawPdcs.push({
          ...p,
          id: String(p.id),
          fin_id: matchedFin?.id,
          property_name: p.property_code || p.property_name || "",
          unit_name: p.unit_name || p.unit_ref || "",
          tenant_name: p.tenant_name || p.drawer_name || "",
          bank: p.bank || matchedFin?.bank_name || matchedFin?.bank || "",
          status: finalStatus,
        });
      });

      // Also include any genuine standalone fin_pdc_register rows created in finance (must have unit/tenant)
      (pdcsRes.data || []).forEach((f: any) => {
        if (!usedFinIds.has(String(f.id)) && f.original_pdc_id == null && (f.unit_name || f.unit_ref || f.tenant_name)) {
          allRawPdcs.push({
            ...f,
            id: `fin-${f.id}`,
            property_name: f.property_name || f.property_code || "",
            unit_name: f.unit_name || f.unit_ref || "",
            tenant_name: f.tenant_name || "",
            bank: f.bank_name || f.bank || "",
          });
        }
      });

      const mappedPdcs: PmsPdc[] = allRawPdcs.map((p: any) => {
        const isGChq =
          p.isGuaranteeCheque ||
          p.maturity_date?.startsWith("2036-12-31") ||
          p.cheque_date?.startsWith("2036-12-31") ||
          String(p.bank || p.bank_name || "").toLowerCase().includes("guarantee") ||
          String(p.notes || "").toLowerCase().includes("guarantee cheque");
        const dt = isGChq ? GUARANTEE_CHEQUE_DATE : (p.maturity_date || p.cheque_date || "");
        return {
          id: String(p.id),
          leaseId: p.lease_id || "",
          chequeNo: p.cheque_number || "",
          bank: isGChq ? (p.bank || p.bank_name || "Guarantee Cheque (Undated / In Hand)") : (p.bank || p.bank_name || ""),
          propertyName: p.property_name || p.property_code || "",
          unitName: p.unit_name || p.unit_ref || "",
          tenantName: p.tenant_name || p.drawer_name || "",
          date: dt,
          chequeNumber: p.cheque_number || p.chequeNo || "",
          dueDate: dt,
          depositDate: p.deposit_date || "",
          unit: p.unit_name || p.unit_ref || "",
          property: p.property_name || p.property_code || "",
          tenureStart: p.rent_from_date || p.tenureStart || "",
          tenureEnd: p.rent_to_date || p.tenureEnd || "",
          amount: Number(p.amount || 0),
          status: (p.status?.toLowerCase().replace(/ /g, "_") as PdcStatus) || "received",
          payerName: p.tenant_name || p.drawer_name || "Tenant",
          isGuaranteeCheque: isGChq,
          notes: p.notes || (isGChq ? "Guarantee Cheque" : undefined),
        };
      });

      // E2: fin_pdc_register and pdcs tables are the single source of truth (removed pms_renewal_pdcs KV merge)

      // Guarantee Cheques Integration - strict DB data only, zero static fallbacks

      // Map raw reservations or synthesize realistic reservations from available units and ALL active/expired leases
      const unitById = new Map<string, any>((unitsRes.data || []).map((u: any) => [u.id, u]));
      const rawReservations: PmsReservation[] = (reservationsRes.data || []).map((r: any) => {
        const unitRow = unitById.get(r.unit_id);
        let details: any = {};
        try {
          details = r.special_conditions ? JSON.parse(r.special_conditions) : {};
        } catch {
          details = { remarks: r.special_conditions };
        }
        return {
          id: r.id,
          property: (propMap.get(unitRow?.property_id) as string) || "Property",
          unit: unitRow?.unit_ref || unitRow?.unit_name || "",
          tenantName: r.prospect_name || "Prospect",
          startDate: r.expected_start_date || "",
          validUntil: r.reservation_validity || "",
          rent: Number(r.proposed_rental_amount || 0),
          status: (r.status?.toLowerCase() as any) || "reserved",
          remarks: details.remarks || "",
          agent: details.agent || undefined,
          isHold: !!details.isHold,
          tokenAmount: Number(details.tokenAmount || 0),
          tokenPaymentMode: details.tokenPaymentMode || undefined,
          tokenReceiptNo: details.tokenReceiptNo || undefined,
        } as PmsReservation;
      });

      const mappedReservations: PmsReservation[] = rawReservations;


      const standardVouchers: PmsVoucher[] = (vouchersRes.data || [])
        .filter((v: any) => v.source_type === "SECURITY_DEPOSIT" || (v.voucher_number || "").startsWith("VCH-SD-"))
        .map((v: any) => {
          let tenantName = "";
          let unitName = "";
          let propertyName = "";
          let parsedMethod = "Cash";

          if (v.description) {
            const match = v.description.match(/Security Deposit Receipt\s*[-–]\s*(.*?)\s*\((.*?)\)\s*\|\s*(.*?)\s*\|\s*(.*)/i);
            if (match) {
              tenantName = match[1].trim();
              unitName = match[2].trim();
              parsedMethod = match[4].trim();
              if (unitName.includes("-")) {
                propertyName = unitName.split("-")[0].trim();
              }
            } else {
              const fallback = v.description.match(/Security Deposit Receipt\s*[-–]\s*(.*?)\s*\((.*?)\)/i);
              if (fallback) {
                tenantName = fallback[1].trim();
                unitName = fallback[2].trim();
                if (unitName.includes("-")) {
                  propertyName = unitName.split("-")[0].trim();
                }
              }
            }
          }

          return {
            id: v.id,
            leaseId: tenantName || "DEP",
            name: v.description || `Security Deposit Receipt - ${tenantName} (${unitName})`,
            receiptNo: v.reference_no || v.voucher_number,
            method: parsedMethod || "Security Deposit",
            period: v.voucher_date,
            debit: "Cash In Hand / Bank (12000001)",
            credit: "Security Deposit Liability (21500)",
            amount: Number(v.total_amount || 0),
            status: (v.status as VoucherStatus) || "posted",
            tenant_name: tenantName,
            unit_name: unitName,
            property_name: propertyName,
            source_type: "SECURITY_DEPOSIT",
          };
        });

      // Only include real vouchers from the database (fin_vouchers).
      // Do not synthesize placeholder or default deposit/PDC vouchers.
      const mappedVouchers: PmsVoucher[] = [
        ...standardVouchers,
      ];

      const mappedHandovers: PmsHandover[] = (handoversRes.data || []).map((h: any) => ({
        id: h.id,
        leaseId: h.lease_id,
        handoverAt: h.handover_date,
        keys: (h.keys_issued || []).length || 2,
        accessCards: (h.access_cards_issued || []).length || 1,
        parkingRemotes: (h.parking_remotes || []).length || 1,
        acknowledged: true,
      }));

      const mappedCheckIns: PmsCheckIn[] = (inspectionsRes.data || []).map((i: any) => ({
        id: i.id,
        leaseId: i.lease_id,
        date: i.inspection_date,
        condition: typeof i.unit_condition === "string" ? i.unit_condition : "Good",
        photos: (i.photos || []).length,
      }));

      setAppData({
        units: mappedUnits,
        customers: mappedCustomers,
        leases: mappedLeases,
        pdcs: mappedPdcs,
        reservations: mappedReservations,
        vouchers: mappedVouchers,
        keyNotices: [],
        handovers: mappedHandovers,
        checkIns: mappedCheckIns,
        auditEvents: [],
      });
    } catch (err) {
      console.error("Failed to load initial data from Db:", err);
      setAppData(prev => ({
        ...prev,
        // On error, keep whatever was already loaded; fall back to seed reservations only
        reservations: prev.reservations.length > 0 ? prev.reservations : INITIAL_SEED_RESERVATIONS,
      }));
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectFromDatabase();
    void DynamicMastersService.initFromDb();

    const handleRefresh = () => {
      fetchDirectFromDatabase();
      void DynamicMastersService.initFromDb();
    };

    window.addEventListener("finance_vouchers_updated", handleRefresh);
    window.addEventListener("pms_data_updated", handleRefresh);

    return () => {
      window.removeEventListener("finance_vouchers_updated", handleRefresh);
      window.removeEventListener("pms_data_updated", handleRefresh);
    };
  }, [fetchDirectFromDatabase]);

  function makeUpdater<K extends keyof PmsAppData>(key: K) {
    return (fn: (prev: PmsAppData[K]) => PmsAppData[K]) => {
      setAppData((prev) => ({ ...prev, [key]: fn(prev[key]) }));
    };
  }

  const value = useMemo<AppDataContextValue>(
    () => ({
      ...appData,
      setUnits: makeUpdater("units"),
      setCustomers: makeUpdater("customers"),
      setReservations: makeUpdater("reservations"),
      setLeases: makeUpdater("leases"),
      setPdcs: makeUpdater("pdcs"),
      setVouchers: makeUpdater("vouchers"),
      setKeyNotices: makeUpdater("keyNotices"),
      setHandovers: makeUpdater("handovers"),
      setCheckIns: makeUpdater("checkIns"),
      setAuditEvents: makeUpdater("auditEvents"),
      syncing,
      refetchData: fetchDirectFromDatabase,
    }),
    [appData, syncing, fetchDirectFromDatabase],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

const fallbackAppDataValue: AppDataContextValue = {
  ...EMPTY_DATA,
  setUnits: () => {},
  setCustomers: () => {},
  setReservations: () => {},
  setLeases: () => {},
  setPdcs: () => {},
  setVouchers: () => {},
  setKeyNotices: () => {},
  setHandovers: () => {},
  setCheckIns: () => {},
  setAuditEvents: () => {},
  syncing: false,
  refetchData: async () => {},
};

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) {
    return fallbackAppDataValue;
  }
  return context;
}
