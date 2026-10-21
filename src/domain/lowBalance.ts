// "Balance is getting low" alert for a student's wallet.
//
// The threshold is the parent's own (SpendingLimit.alertThreshold) or, when they
// set none, the school default (setting "lowBalanceAlert"). The alert goes out once,
// on the purchase that takes the balance below it — not on every purchase after —
// and comes back by itself once a top-up lifts the balance above it again.

export function readLowBalanceDefault(value: unknown): number | null {
  const v = (value && typeof value === 'object' ? value : {}) as { defaultThreshold?: unknown };
  const n = Number(v.defaultThreshold);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function effectiveThreshold(studentThreshold: unknown, schoolDefault: number | null): number | null {
  const own = studentThreshold == null ? NaN : Number(studentThreshold);
  if (Number.isFinite(own) && own > 0) return own;
  return schoolDefault;
}

/** True only on the purchase that crosses from at-or-above the threshold to below it. */
export function crossedLowBalance(balanceBefore: number, balanceAfter: number, threshold: number | null): boolean {
  return threshold != null && threshold > 0 && balanceBefore >= threshold && balanceAfter < threshold;
}
