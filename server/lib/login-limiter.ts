// server/lib/login-limiter.ts
// Sign-in throttling. An account that fails 5 times within 15 minutes is locked for 30 minutes.
// A single address that fails 30 times within 15 minutes is locked for 30 minutes.
// State is kept in memory: it resets when the server restarts. Multiple server instances need a shared store.
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 30 * 60_000;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_ADDRESS = 30;

type Record = { failures: number[]; lockedUntil: number };
const records = new Map<string, Record>();

const accountKey = (email: string) => `account:${email.toLowerCase()}`;
const addressKey = (ip: string) => `address:${ip}`;

function lockSecondsLeft(key: string, now: number): number {
  const rec = records.get(key);
  if (!rec || rec.lockedUntil <= now) return 0;
  return Math.ceil((rec.lockedUntil - now) / 1000);
}

function recordFailure(key: string, now: number, max: number) {
  const rec = records.get(key) ?? { failures: [], lockedUntil: 0 };
  rec.failures = rec.failures.filter((t) => now - t < WINDOW_MS);
  rec.failures.push(now);
  if (rec.failures.length >= max) {
    rec.lockedUntil = now + LOCK_MS;
    rec.failures = [];
  }
  records.set(key, rec);
}

/** Seconds until sign-in is allowed again for this account and address, or 0 if allowed now. */
export function signInBlockedFor(email: string, ip: string): number {
  const now = Date.now();
  return Math.max(lockSecondsLeft(accountKey(email), now), lockSecondsLeft(addressKey(ip), now));
}

export function recordSignInFailure(email: string, ip: string) {
  const now = Date.now();
  recordFailure(accountKey(email), now, MAX_FAILURES_PER_ACCOUNT);
  recordFailure(addressKey(ip), now, MAX_FAILURES_PER_ADDRESS);
}

/** A successful sign-in clears the account's failure history. */
export function clearSignInFailures(email: string) {
  records.delete(accountKey(email));
}
