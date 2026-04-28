/**
 * Persistent idempotency keys
 *
 * Each (loanApplicationId, paymentMethod) pair gets exactly one idempotency
 * key per browser session. If the user refreshes, navigates back, or opens
 * a duplicate tab, the same key is reused so the server can dedupe.
 *
 * Stored in sessionStorage (cleared when the browser tab closes) so that
 * stale keys don't leak across actually-different transactions.
 */

type PaymentMethod = "card" | "crypto" | "wire";

function genUuid(): string {
  // Fall back to a timestamp+random combo for environments without crypto.randomUUID
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function getPersistentIdempotencyKey(
  loanApplicationId: number,
  paymentMethod: PaymentMethod,
): string {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return genUuid();
  }

  const storageKey = `idempotency:${paymentMethod}:${loanApplicationId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const fresh = genUuid();
    sessionStorage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    // sessionStorage can throw in private modes / quota — fall back to ephemeral
    return genUuid();
  }
}

/**
 * Forget the idempotency key for a (loan, method) pair. Call this AFTER a
 * payment terminally succeeds or fails, so the next attempt can start fresh.
 */
export function clearPersistentIdempotencyKey(
  loanApplicationId: number,
  paymentMethod: PaymentMethod,
): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(`idempotency:${paymentMethod}:${loanApplicationId}`);
  } catch {
    /* ignore */
  }
}
