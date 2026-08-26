import { describe, it, expect, beforeEach } from "@jest/globals";
import { BoundedLruCache } from "../utils/BoundedLruCache.js";

describe("BoundedLruCache", () => {
  let cache;

  beforeEach(() => {
    cache = new BoundedLruCache({ maxEntries: 3, defaultTtlMs: 1000 });
  });

  it("stores and retrieves values within TTL", () => {
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("returns null for non-existent keys", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("returns null for expired entries and cleans them up", async () => {
    cache.set("expiring", "data", 15);
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get("expiring")).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("evicts least-recently-used item when capacity is exceeded", () => {
    cache.set("k1", 1);
    cache.set("k2", 2);
    cache.set("k3", 3);
    expect(cache.size()).toBe(3);

    cache.get("k1"); // access k1 so k2 becomes LRU
    cache.set("k4", 4); // should evict k2

    expect(cache.get("k1")).toBe(1);
    expect(cache.get("k2")).toBeNull();
    expect(cache.get("k3")).toBe(3);
    expect(cache.get("k4")).toBe(4);
    expect(cache.size()).toBe(3);
  });

  it("updates existing key without exceeding capacity", () => {
    cache.set("k1", 1);
    cache.set("k2", 2);
    cache.set("k1", 100);

    expect(cache.get("k1")).toBe(100);
    expect(cache.size()).toBe(2);

    // Adding two more should evict k2 first, then old k1 if not accessed
    cache.set("k3", 3);
    cache.set("k4", 4); // should evict k2

    expect(cache.get("k2")).toBeNull();
    expect(cache.get("k1")).toBe(100);
    expect(cache.get("k3")).toBe(3);
    expect(cache.get("k4")).toBe(4);
  });

  it("supports delete and clear", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.delete("a")).toBe(true);
    expect(cache.get("a")).toBeNull();
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("b")).toBeNull();
  });

  it("handles default constructor options", () => {
    const defaultCache = new BoundedLruCache();
    expect(defaultCache.maxEntries).toBe(100);
    expect(defaultCache.defaultTtlMs).toBe(30000);
    expect(defaultCache.size()).toBe(0);
  });
});
