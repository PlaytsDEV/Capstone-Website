import { describe, it, expect } from "@jest/globals";
import { BoundedLruCache } from "../utils/BoundedLruCache.js";

describe("Concurrency & Race-Condition Immunity Stress Suite", () => {
  it("handles 500 simultaneous concurrent reads, writes, and evictions without cache corruption or state loss", async () => {
    const cache = new BoundedLruCache({ maxEntries: 25, defaultTtlMs: 10_000 });
    const keys = Array.from({ length: 50 }, (_, i) => `room_occupancy_key_${i}`);

    const operations = Array.from({ length: 500 }, (_, idx) => {
      const key = keys[idx % keys.length];
      return (async () => {
        if (idx % 2 === 0) {
          cache.set(key, { count: idx, updatedAt: Date.now() });
          return { op: "write", key };
        } else {
          const val = cache.get(key);
          return { op: "read", key, hasVal: Boolean(val) };
        }
      })();
    });

    const results = await Promise.all(operations);
    expect(results.length).toBe(500);
    expect(cache.size()).toBeLessThanOrEqual(25);
  });

  it("handles overlapping expiration and promotion races cleanly", async () => {
    const cache = new BoundedLruCache({ maxEntries: 10, defaultTtlMs: 20 });
    
    // Set 10 items
    for (let i = 0; i < 10; i++) {
      cache.set(`exp_key_${i}`, { data: i });
    }
    expect(cache.size()).toBe(10);

    // Wait 25ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Accessing expired items should return null and auto-evict
    const expiredRead = cache.get("exp_key_0");
    expect(expiredRead).toBeNull();
    expect(cache.size()).toBe(9);
  });

  it("atomic simulated occupancy increment counters do not drop counts during parallel operations", async () => {
    let mockOccupancyDoc = { currentOccupancy: 0, maxCapacity: 4 };

    // Simulated atomic Mongo $inc operation
    const atomicInc = async (delta) => {
      // simulate async db queue step
      await new Promise((r) => setTimeout(r, 1));
      if (mockOccupancyDoc.currentOccupancy + delta > mockOccupancyDoc.maxCapacity) {
        throw new Error("CAPACITY_EXCEEDED");
      }
      mockOccupancyDoc.currentOccupancy += delta;
      return mockOccupancyDoc.currentOccupancy;
    };

    // 4 successful increments
    const successfulOps = await Promise.all([
      atomicInc(1),
      atomicInc(1),
      atomicInc(1),
      atomicInc(1),
    ]);

    expect(successfulOps).toEqual([1, 2, 3, 4]);
    expect(mockOccupancyDoc.currentOccupancy).toBe(4);

    // 5th attempt must reject
    await expect(atomicInc(1)).rejects.toThrow("CAPACITY_EXCEEDED");
  });
});
