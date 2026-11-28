import { db } from "@/lib/db";

export interface CachedPostingPeriod {
  period_name: string;
  status: string;
  is_closed?: boolean;
}

let cachedPeriods: CachedPostingPeriod[] | null = null;
let inflightRefresh: Promise<CachedPostingPeriod[] | null> | null = null;

export function setPostingPeriodsCache(list: CachedPostingPeriod[]): void {
  cachedPeriods = Array.isArray(list) ? list : [];
}

export async function refreshPostingPeriodsCache(): Promise<CachedPostingPeriod[] | null> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const { data, error } = await db
        .from("fin_posting_periods")
        .select("period_name, status")
        .limit(200);
      if (!error && Array.isArray(data)) {
        cachedPeriods = data as CachedPostingPeriod[];
        return cachedPeriods;
      }
    } catch {
      // Keep existing cache on network failure; backend RPC still enforces closed periods.
    } finally {
      inflightRefresh = null;
    }
    return cachedPeriods;
  })();
  return inflightRefresh;
}

export async function ensurePostingPeriodsLoaded(): Promise<void> {
  if (cachedPeriods === null) {
    await refreshPostingPeriodsCache();
  }
}

/**
 * Checks whether `dateStr` falls inside a closed (or unseeded, when periods exist) posting period.
 * Matches server-side fail-closed behaviour once periods are loaded in memory.
 */
export function checkPostingPeriodClosed(dateStr?: string): { closed: boolean; periodName?: string } {
  if (!dateStr || cachedPeriods === null) return { closed: false };
  const ym = dateStr.split("T")[0].slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return { closed: false };
  const found = cachedPeriods.find((p) => p.period_name === ym);
  if (cachedPeriods.length > 0 && (!found || found.status === "Closed" || found.is_closed)) {
    return { closed: true, periodName: ym };
  }
  return { closed: false };
}
