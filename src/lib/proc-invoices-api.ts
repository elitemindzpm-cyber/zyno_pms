import { postVoucherLinesToBackend } from "@/lib/finance/backend-posting";
import { db } from "./db";

export type ProcApInvoice = {
  id: string;
  invoice_number: string;
  vendor_id: string | number;
  vendor_name?: string;
  po_number?: string;
  grn_number?: string;
  invoice_date: string;
  voucher_date?: string;
  due_date?: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid?: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "DISPUTED" | "PARTIAL";
  posting_status?: string;
  remarks?: string;
  payment_method?: string;
  payment_terms?: string;
  settlement_mode?: string;
  payment_reference?: string;
  paid_at?: string;
  created_at?: string;
  receipt_attachment?: string;
  source_type?: "PROCUREMENT" | "MAINTENANCE" | "DIRECT";
  property?: string;
  unit_ref?: string;
  expense_gl_account?: string;
  expense_gl_code?: string;
  /** Expense split of a direct AP invoice: one entry per ledger, each with an optional property and unit. */
  allocations?: Array<{ gl_code: string; gl_name: string; amount: number; property: string; unit: string; note?: string }>;
};

export type PaymentReceipt = {
  id: string;
  receipt_number: string;
  voucher_number: string;
  invoice_number: string;
  po_number?: string;
  grn_number?: string;
  vendor_id: string | number;
  vendor_name?: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  reference_no: string;
  bank_account: string;
  gl_debit_account: string;
  gl_credit_account: string;
  remarks?: string;
  status: "Settled" | "Processing" | "Partial";
  created_at: string;
};

let invoicesCache: ProcApInvoice[] = [];
let receiptsCache: PaymentReceipt[] = [];

function mapDbReceipt(row: any): PaymentReceipt {
  const method = String(row.payment_method || "Bank Wire / QNB Corporate");
  return {
    id: String(row.id),
    receipt_number: String(row.receipt_number),
    voucher_number: String(row.voucher_number),
    invoice_number: String(row.invoice_number),
    po_number: row.po_number || undefined,
    grn_number: row.grn_number || undefined,
    vendor_id: row.vendor_id || "",
    vendor_name: row.vendor_name || undefined,
    amount_paid: Number(row.amount_paid || 0),
    payment_date: String(row.payment_date || "").slice(0, 10),
    payment_method: method,
    reference_no: String(row.reference_no || ""),
    bank_account: String(row.bank_account || "Qatar National Bank (QNB) - Main Operating"),
    gl_debit_account: "22100001 - Trade Payables - Vendors",
    gl_credit_account: method.includes("Cash")
      ? "12100001 - Cash in Hand / Operating Cash"
      : "12000001 - Bank Operating Account (QNB)",
    remarks: row.remarks || undefined,
    status: (row.status || "Settled") as PaymentReceipt["status"],
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

async function loadReceiptsFromDb(): Promise<PaymentReceipt[]> {
  try {
    const { data, error } = await db
      .from("fin_payment_receipts")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      receiptsCache = data.map(mapDbReceipt);
    }
  } catch {
    // Keep last loaded cache if backend request fails transiently.
  }
  return receiptsCache;
}

// Helper to push payment settlement voucher into Backend Ledger
async function postFinancePaymentVoucher(invoice: ProcApInvoice, receiptNum: string, pvNum: string) {
  const paidDate = invoice.paid_at || new Date().toISOString().slice(0, 10);
  await postVoucherLinesToBackend({
    type: "Payment",
    date: paidDate,
    reference: pvNum,
    description: `Vendor Payment: ${invoice.invoice_number} | PO: ${invoice.po_number || "N/A"} | GRN: ${invoice.grn_number || "N/A"} | Rcpt: ${receiptNum}`,
    lines: [
      { account_code: "21000", debit: Number(invoice.total_amount) || 0, credit: 0 },
      { account_code: "12000001", debit: 0, credit: Number(invoice.total_amount) || 0 },
    ],
  });
}

export const ApInvoicesApi = {
  fetchAll: async (): Promise<ProcApInvoice[]> => {
    let invoices: ProcApInvoice[] = [];

    // 1. Fetch persisted AP invoices & payment receipts from MariaDB in parallel
    try {
      const [invRes] = await Promise.all([
        db.from("proc_ap_invoices").select("*").order("created_at", { ascending: false }),
        loadReceiptsFromDb(),
      ]);
      if (!invRes.error && Array.isArray(invRes.data)) {
        invoices = invRes.data;
      }
    } catch {
      invoices = [...invoicesCache];
    }

    // 2. Auto-synthesize missing AP invoices directly from proc_goods_receipts (GRNs) and persist to DB
    try {
      const [grnRes, poRes] = await Promise.all([
        db.from("proc_goods_receipts").select("*").order("created_at", { ascending: false }),
        db.from("proc_purchase_orders").select("*"),
      ]);

      const grns = grnRes.data || [];
      const pos = poRes.data || [];
      const poMap = new Map<string, any>(pos.map((p: any) => [p.id, p] as [string, any]));

      const existingGrnNumbers = new Set(invoices.map((i) => i.grn_number).filter(Boolean));
      const existingInvNumbers = new Set(invoices.map((i) => i.invoice_number).filter(Boolean));

      for (const grn of grns) {
        if (!grn.grn_number || existingGrnNumbers.has(grn.grn_number)) continue;
        const po = poMap.get(grn.purchase_order_id);
        const grnSuffix = grn.grn_number.replace(/^GRN-/, "");
        const invNumber = `APINV-${grnSuffix}`;
        if (existingInvNumbers.has(invNumber)) continue;

        const payload = {
          invoice_number: invNumber,
          vendor_id: String(grn.vendor_id || po?.vendor_id || "1"),
          po_number: po?.doc_number || "—",
          grn_number: grn.grn_number,
          invoice_date: grn.grn_date || new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          amount: Number(grn.total_amount || 0),
          tax_amount: 0,
          total_amount: Number(grn.total_amount || 0),
          status: "DRAFT",
          remarks: `Auto-generated from GRN ${grn.grn_number} against PO ${po?.doc_number || "N/A"}`,
        };

        try {
          const { data: inserted } = await db.from("proc_ap_invoices").insert(payload).select().single();
          invoices.push(inserted || { ...payload, id: `inv-auto-${grn.id || grnSuffix}` } as ProcApInvoice);
        } catch {
          invoices.push({ ...payload, id: `inv-auto-${grn.id || grnSuffix}` } as ProcApInvoice);
        }
        existingGrnNumbers.add(grn.grn_number);
        existingInvNumbers.add(invNumber);
      }
    } catch (e) {
      console.error("Error auto-synthesizing AP Invoices from GRNs:", e);
    }

    invoicesCache = invoices;
    return invoices;
  },

  create: async (payload: Omit<ProcApInvoice, "id">): Promise<ProcApInvoice> => {
    const { data, error } = await db
      .from("proc_ap_invoices")
      .insert({
        invoice_number: payload.invoice_number,
        vendor_id: payload.vendor_id,
        po_number: payload.po_number || null,
        grn_number: payload.grn_number || null,
        invoice_date: payload.invoice_date,
        due_date: payload.due_date || null,
        amount: payload.amount,
        tax_amount: payload.tax_amount || 0,
        total_amount: payload.total_amount,
        status: payload.status || "DRAFT",
        remarks: payload.remarks || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create AP invoice");
    }

    const newRecord: ProcApInvoice = {
      ...payload,
      ...(data || {}),
      id: String(data?.id || `inv-${Date.now()}`),
      created_at: data?.created_at || new Date().toISOString(),
    };
    invoicesCache = [newRecord, ...invoicesCache.filter((i) => i.invoice_number !== newRecord.invoice_number)];
    window.dispatchEvent(new Event("ap_invoices_updated"));
    return newRecord;
  },

  update: async (id: string, payload: Partial<ProcApInvoice>): Promise<void> => {
    const { error } = await db.from("proc_ap_invoices").update(payload).eq("id", id);
    if (error) {
      throw new Error(error.message || "Failed to update AP invoice");
    }

    let existingInv = invoicesCache.find((i) => i.id === id || i.invoice_number === payload.invoice_number);
    if (!existingInv) {
      const { data } = await db.from("proc_ap_invoices").select("*").eq("id", id).maybeSingle();
      if (data) existingInv = data as ProcApInvoice;
    }

    invoicesCache = invoicesCache.map((i) =>
      i.id === id || i.invoice_number === payload.invoice_number
        ? {
            ...i,
            ...payload,
            paid_at: payload.status === "PAID" ? i.paid_at || new Date().toISOString().slice(0, 10) : i.paid_at,
          }
        : i,
    );
    window.dispatchEvent(new Event("ap_invoices_updated"));

    if ((payload.status === "PAID" || payload.status === "PARTIAL") && existingInv) {
      await loadReceiptsFromDb();
      const suffix = existingInv.invoice_number.replace(/^APINV-/, "");
      const invoiceReceipts = receiptsCache.filter((r) => r.invoice_number === existingInv!.invoice_number);
      const installmentIndex = invoiceReceipts.length + 1;

      const rcptNum =
        invoiceReceipts.length === 0 && payload.status === "PAID"
          ? `RCPT-${suffix}`
          : `RCPT-${suffix}-P${installmentIndex}`;
      const pvNum =
        invoiceReceipts.length === 0 && payload.status === "PAID"
          ? `PV-${suffix}`
          : `PV-${suffix}-P${installmentIndex}`;

      const previouslyPaid = Number(existingInv.amount_paid || 0);
      const runningPaid = Number(payload.amount_paid || existingInv.total_amount);
      const paidAmount =
        runningPaid > previouslyPaid ? Math.round((runningPaid - previouslyPaid) * 100) / 100 : runningPaid;
      const bankAccount = payload.payment_method?.includes("CBQ")
        ? "Commercial Bank of Qatar (CBQ) - Operational (IBAN: QA99CBQA00000000654321)"
        : payload.payment_method?.includes("Cash")
          ? "12100001 - Cash in Hand (Office Cashier Vault)"
          : "Qatar National Bank (QNB) - Main Operating (IBAN: QA42QNBA00000000123456)";
      const receiptRow = {
        receipt_number: rcptNum,
        voucher_number: pvNum,
        invoice_number: existingInv.invoice_number,
        po_number: existingInv.po_number || null,
        grn_number: existingInv.grn_number || null,
        vendor_id: String(existingInv.vendor_id || ""),
        vendor_name: existingInv.vendor_name || null,
        amount_paid: paidAmount,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: payload.payment_method || "Bank Wire / QNB Corporate",
        reference_no: payload.payment_reference || `TXN-${Date.now().toString().slice(-6)}`,
        bank_account: bankAccount,
        remarks: `${payload.status === "PAID" ? "Final Settlement" : `Installment #${installmentIndex}`} for Invoice ${existingInv.invoice_number}`,
        status: payload.status === "PAID" ? "Settled" : "Partial",
      };

      try {
        const { data: insertedRcpt } = await db.from("fin_payment_receipts").insert(receiptRow).select().single();
        const mapped = mapDbReceipt(insertedRcpt || { ...receiptRow, id: `rcpt-${Date.now()}` });
        receiptsCache = [mapped, ...receiptsCache.filter((r) => r.receipt_number !== mapped.receipt_number)];
        window.dispatchEvent(new Event("payment_receipts_updated"));
      } catch (e) {
        console.warn("Failed saving payment receipt to fin_payment_receipts:", e);
      }

      void postFinancePaymentVoucher(
        {
          ...existingInv,
          total_amount: paidAmount,
          payment_method: payload.payment_method || existingInv.payment_method,
        },
        rcptNum,
        pvNum,
      );

      window.dispatchEvent(new Event("finance_vouchers_updated"));
      window.dispatchEvent(new Event("pms_vendor_invoices_updated"));
    }
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await db.from("proc_ap_invoices").delete().eq("id", id);
    if (error) {
      throw new Error(error.message || "Failed to delete AP invoice");
    }
    invoicesCache = invoicesCache.filter((i) => i.id !== id);
    window.dispatchEvent(new Event("ap_invoices_updated"));
  },

  refreshReceipts: loadReceiptsFromDb,

  getAllReceipts: (): PaymentReceipt[] => receiptsCache,

  getReceiptByInvoice: (invoiceNumber: string): PaymentReceipt | undefined =>
    receiptsCache.find((r) => r.invoice_number === invoiceNumber),

  getAllReceiptsForInvoice: (invoiceNumber: string): PaymentReceipt[] =>
    receiptsCache.filter((r) => r.invoice_number === invoiceNumber),

  getReceiptByGrn: (grnNumber: string): PaymentReceipt | undefined =>
    receiptsCache.find((r) => r.grn_number === grnNumber),
};
