// server/lib/money.ts
// Single rounding policy (B11): 2-decimal currency precision using half-away-from-zero EPSILON guard.

export const num = (v: unknown): number => {
  const n = Number(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export const money = (v: unknown): number => {
  const n = num(v);
  return Math.round((n + Number.EPSILON * (n >= 0 ? 1 : -1)) * 100) / 100;
};
