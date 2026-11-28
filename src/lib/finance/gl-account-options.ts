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
      .select("id, account_code, account_name, parent_id, is_active")
      .order("account_code")
      .limit(10000);
    if (error) {
      loadPromise = null; // allow a retry on the next mount
      console.error("[gl-account-options] could not load the chart of accounts:", error.message);
      return;
    }
    const rows = ((data as any[]) || []).filter((r) => r.is_active !== false && r.is_active !== 0);
    const parents = new Set(rows.map((r) => r.parent_id).filter(Boolean));
    const leaves = rows.filter((r) => !parents.has(r.id));
    const toOption = (r: any): GlAccountOption => ({
      code: String(r.account_code),
      name: `${r.account_code} - ${r.account_name}`,
    });
    replace(COMMON_GL_ACCOUNTS, leaves.map(toOption));
    replace(BANK_GL_ACCOUNTS, leaves.filter((r) => String(r.account_code).startsWith("12000")).map(toOption));
    listeners.forEach((fn) => fn());
  })();
  return loadPromise;
}

/** Call at the top of any component that reads the lists above; it re-renders once they load. */
export function useGlAccountOptions() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    void loadGlAccountOptions();
    return () => { listeners.delete(fn); };
  }, []);
  return { common: COMMON_GL_ACCOUNTS, bank: BANK_GL_ACCOUNTS };
}
