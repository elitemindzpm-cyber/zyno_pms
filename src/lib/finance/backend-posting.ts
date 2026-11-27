import { request } from "@/lib/api-client";
import { toast } from "sonner";

/** Posts accounting entries and invoices through the backend, so they are stored in the database and ledger. */
function announce() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("finance_vouchers_updated"));
    window.dispatchEvent(new Event("ap_invoices_updated"));
  }
}

export async function postJournalToBackend(entry: {
  je_no: string;
  posting_date: string;
  reference?: string;
  narration: string;
  dr_code: string;
  cr_code: string;
  amount: number;
}): Promise<boolean> {
  try {
    await request("/api/accounting/post-voucher", {
      method: "POST",
      body: JSON.stringify({
        voucher_date: entry.posting_date,
        voucher_type: "Journal",
        reference_no: entry.je_no,
        description: entry.narration || entry.reference,
        lines: [
          { account_code: entry.dr_code, debit: entry.amount, credit: 0, description: entry.narration },
          { account_code: entry.cr_code, debit: 0, credit: entry.amount, description: entry.narration },
        ],
      }),
    });
    announce();
    return true;
  } catch (e: any) {
    console.warn("[backend-posting] journal not posted:", e?.message || e);
    toast.error(`Journal not posted: ${e?.message || "the entry was rejected"}`);
    return false;
  }
}

export async function createApInvoiceOnBackend(inv: {
  invoice_no: string;
  vendor: string;
  date: string;
  due_date?: string;
  account?: string;
  account_code: string;
  amount: number;
  property?: string;
}): Promise<boolean> {
  try {
    await request("/api/accounting/ap-invoices", { method: "POST", body: JSON.stringify(inv) });
    announce();
    return true;
  } catch (e: any) {
    console.warn("[backend-posting] AP invoice not posted:", e?.message || e);
    toast.error(`AP invoice not posted: ${e?.message || "the invoice was rejected"}`);
    return false;
  }
}

export async function createArInvoiceOnBackend(inv: {
  invoice_no: string;
  tenant: string;
  property?: string;
  unit?: string;
  date: string;
  due_date?: string;
  stream?: string;
  account_code: string;
  amount: number;
}): Promise<boolean> {
  try {
    await request("/api/accounting/ar-invoices", { method: "POST", body: JSON.stringify({ invoices: [inv] }) });
    announce();
    return true;
  } catch (e: any) {
    console.warn("[backend-posting] AR invoice not posted:", e?.message || e);
    toast.error(`AR invoice not posted: ${e?.message || "the invoice was rejected"}`);
    return false;
  }
}

/** A balanced payment / receipt voucher posted through the backend. */
export async function postVoucherLinesToBackend(v: {
  type: "Journal" | "Receipt" | "Payment" | "Contra";
  date: string;
  reference?: string;
  description?: string;
  lines: Array<{ account_code: string; debit?: number; credit?: number; description?: string }>;
}): Promise<boolean> {
  try {
    await request("/api/accounting/post-voucher", {
      method: "POST",
      body: JSON.stringify({ voucher_date: v.date, voucher_type: v.type, reference_no: v.reference, description: v.description, lines: v.lines }),
    });
    announce();
    return true;
  } catch (e: any) {
    console.warn("[backend-posting] voucher not posted:", e?.message || e);
    toast.error(`Voucher not posted: ${e?.message || "the entry was rejected"}`);
    return false;
  }
}
