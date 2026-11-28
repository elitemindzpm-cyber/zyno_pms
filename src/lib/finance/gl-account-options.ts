// Live chart-of-accounts options for the voucher / journal dropdowns.
// These lists used to be empty module constants, so the General Entry account dropdown showed nothing.
// They are now filled in place (same array references) from fin_coa_accounts once per session.
import { useEffect, useState } from "react";
import { db } from "@/lib/db";

export type GlAccountOption = { code: string; name: string };

/** Every active, postable (leaf) account, labelled "code - name". */
export const COMMON_GL_ACCOUNTS: GlAccountOption[] = [];
/** Bank accounts (GL 12000 family). */
export const BANK_GL_ACCOUNTS: GlAccountOption[] = [];

/** Parties and posting accounts for the Debit / Credit Note forms (these lists used to be empty constants). */
export type PartyOption = { id: string; name: string; agreement: string; agreements: string[]; doc: string };
export const PARTY_VENDORS: PartyOption[] = [];
export const PARTY_CUSTOMERS: PartyOption[] = [];
export const EXPENSE_GL_OPTIONS: Array<{ value: string; label: string }> = [];
export const REVENUE_GL_OPTIONS: Array<{ value: string; label: string }> = [];

let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function replace(target: GlAccountOption[], next: GlAccountOption[]) {
  target.splice(0, target.length, ...next);
}

export function loadGlAccountOptions(force = false): Promise<void> {
  if (loadPromise && !force) return loadPromise;
  loadPromise = (async () => {
    const { data, error } = await db
      .from("fin_coa_accounts")
      .select("id, account_code, account_name, parent_id, parent_account_id, is_active")
      .order("account_code")
      .limit(10000);
    if (error) {
      loadPromise = null; // allow a retry on the next mount
      console.error("[gl-account-options] could not load the chart of accounts:", error.message);
      return;
    }
    const rows = ((data as any[]) || []).filter((r) => r.is_active !== false && r.is_active !== 0);
    if (rows.length === 0) {
      loadPromise = null; // allow retry once authenticated / seeded
      return;
    }
    const parents = new Set(rows.flatMap((r) => [r.parent_id, r.parent_account_id]).filter(Boolean));
    const leaves = rows.filter((r) => !parents.has(r.id));
    const effectiveList = leaves.length > 0 ? leaves : rows;
    const toOption = (r: any): GlAccountOption => ({
      code: String(r.account_code),
      name: `${r.account_code} - ${r.account_name}`,
    });
    replace(COMMON_GL_ACCOUNTS, leaves.map(toOption));
    replace(BANK_GL_ACCOUNTS, leaves.filter((r) => String(r.account_code).startsWith("12000")).map(toOption));
    const toChoice = (r: any) => ({ value: String(r.account_code), label: `${r.account_code} – ${r.account_name}` });
    EXPENSE_GL_OPTIONS.splice(0, EXPENSE_GL_OPTIONS.length, ...effectiveList.filter((r) => String(r.account_code).startsWith("5")).map(toChoice));
    REVENUE_GL_OPTIONS.splice(0, REVENUE_GL_OPTIONS.length, ...effectiveList.filter((r) => String(r.account_code).startsWith("4")).map(toChoice));

    const [vendorRes, customerRes] = await Promise.all([
      db.from("fin_vendors").select("id, name, code, status").order("name").limit(5000),
      db.from("customers").select("id, full_name, display_name").order("full_name").limit(5000),
    ]);
    if (!vendorRes.error) {
      PARTY_VENDORS.splice(0, PARTY_VENDORS.length, ...((vendorRes.data as any[]) || [])
        .filter((v) => String(v.status || "Active").toLowerCase() !== "inactive" && v.name)
        .map((v) => ({ id: String(v.id), name: String(v.name), agreement: "", agreements: [], doc: "" })));
    }
    if (!customerRes.error) {
      PARTY_CUSTOMERS.splice(0, PARTY_CUSTOMERS.length, ...((customerRes.data as any[]) || [])
        .filter((c) => c.full_name || c.display_name)
        .map((c) => ({ id: String(c.id), name: String(c.full_name || c.display_name), agreement: "", agreements: [], doc: "" })));
    }
    listeners.forEach((fn) => fn());
  })();
  return loadPromise;
}

if (typeof window !== "undefined") {
  window.addEventListener("fin_custom_coa_updated", () => {
    void loadGlAccountOptions(true);
  });
}

/** Call at the top of any component that reads the lists above; it re-renders once they load. */
export function useGlAccountOptions() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    void loadGlAccountOptions(COMMON_GL_ACCOUNTS.length === 0);
    return () => { listeners.delete(fn); };
  }, []);
  return { common: COMMON_GL_ACCOUNTS, bank: BANK_GL_ACCOUNTS };
}
