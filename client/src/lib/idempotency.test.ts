import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock sessionStorage for Node test environment
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  const storage = new MemoryStorage();
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("window", { sessionStorage: storage });
  vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000000" });
});

describe("getPersistentIdempotencyKey", () => {
  it("returns the same key on repeated calls for the same loan + method", async () => {
    const { getPersistentIdempotencyKey } = await import("./idempotency");
    const a = getPersistentIdempotencyKey(15, "card");
    const b = getPersistentIdempotencyKey(15, "card");
    expect(a).toBe(b);
  });

  it("returns different keys for different methods on the same loan", async () => {
    const { getPersistentIdempotencyKey } = await import("./idempotency");
    // Force unique UUIDs per call so we can distinguish
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `key-${++n}` });
    const card = getPersistentIdempotencyKey(15, "card");
    const crypto = getPersistentIdempotencyKey(15, "crypto");
    const wire = getPersistentIdempotencyKey(15, "wire");
    expect(new Set([card, crypto, wire]).size).toBe(3);
  });

  it("returns different keys for different loans on the same method", async () => {
    const { getPersistentIdempotencyKey } = await import("./idempotency");
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `key-${++n}` });
    const a = getPersistentIdempotencyKey(15, "card");
    const b = getPersistentIdempotencyKey(16, "card");
    expect(a).not.toBe(b);
  });

  it("clearPersistentIdempotencyKey forces a fresh key on next get", async () => {
    const { getPersistentIdempotencyKey, clearPersistentIdempotencyKey } = await import("./idempotency");
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `key-${++n}` });
    const a = getPersistentIdempotencyKey(15, "card");
    clearPersistentIdempotencyKey(15, "card");
    const b = getPersistentIdempotencyKey(15, "card");
    expect(a).not.toBe(b);
  });

  it("falls back to ephemeral UUID when sessionStorage throws", async () => {
    const { getPersistentIdempotencyKey } = await import("./idempotency");
    const broken = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => {},
    };
    vi.stubGlobal("sessionStorage", broken);
    vi.stubGlobal("window", { sessionStorage: broken });
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `eph-${++n}` });
    const a = getPersistentIdempotencyKey(15, "card");
    const b = getPersistentIdempotencyKey(15, "card");
    expect(a).not.toBe(b); // each call gets a fresh ephemeral key
  });
});
