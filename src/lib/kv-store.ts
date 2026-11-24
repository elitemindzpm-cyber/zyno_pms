// src/lib/kv-store.ts
// Drop-in replacement for window.localStorage / sessionStorage.
// Data lives in the API (app_kv_store table), scoped to the tenant. The browser only keeps an
// in-memory cache for the current page session; nothing is written to local/session storage.
import { request } from './api-client';

const cache = new Map<string, string>();
const inFlight = new Set<Promise<unknown>>();
let hydrated = false;

function track(job: Promise<unknown>) {
  const p = job.catch((err) => console.error('[kv-store] save failed:', err));
  inFlight.add(p);
  p.finally(() => inFlight.delete(p));
}

/** Load every key for the current tenant from the API. Call after login and on app start. */
export async function hydrateKv(): Promise<void> {
  const res = await request<{ data: Record<string, string> }>('/api/kv');
  cache.clear();
  for (const [k, v] of Object.entries(res.data || {})) cache.set(k, v);
  hydrated = true;
}

/** Forget cached values (used on logout so the next user starts clean). */
export function resetKvCache(): void {
  cache.clear();
  hydrated = false;
}

export function isKvHydrated(): boolean {
  return hydrated;
}

/** Resolves once all pending saves have reached the API. */
export async function flushKv(): Promise<void> {
  await Promise.allSettled([...inFlight]);
}

export const kvStore = {
  getItem(key: string): string | null {
    return cache.has(key) ? (cache.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    const v = String(value);
    cache.set(key, v);
    track(request(`/api/kv/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value: v }) }));
  },
  removeItem(key: string): void {
    cache.delete(key);
    track(request(`/api/kv/${encodeURIComponent(key)}`, { method: 'DELETE' }));
  },
  clear(): void {
    for (const k of [...cache.keys()]) kvStore.removeItem(k);
  },
  key(index: number): string | null {
    return [...cache.keys()][index] ?? null;
  },
  get length(): number {
    return cache.size;
  },
};
