import { describe, it, expect } from "@jest/globals";
import { BoundedLruCache } from "../utils/BoundedLruCache.js";

describe("Heap Memory Allocation & Leak Benchmark", () => {
  it("maintains bounded memory usage across 10,000 rapid cache operations", () => {
    const cache = new BoundedLruCache({ maxEntries: 50, defaultTtlMs: 30_000 });
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10_000; i++) {
      cache.set(`branch_${i % 100}:range_${i % 5}`, {
        occupancyStats: {
          occupied: i % 20,
          total: 20,
          rate: ((i % 20) / 20) * 100,
        },
        payload: Array.from({ length: 25 }, (_, idx) => ({
          id: `item-${i}-${idx}`,
          metric: idx * 10,
        })),
      });

      if (i % 3 === 0) {
        cache.get(`branch_${(i + 7) % 100}:range_${i % 5}`);
      }
    }

    expect(cache.size()).toBeLessThanOrEqual(50);
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

    // Bounded cache with 50 items must strictly constrain memory growth well below 25MB
    expect(memoryGrowthMB).toBeLessThan(25);
  });
});
