/**
 * Zero-dependency In-Process Bounded LRU Cache with TTL.
 * Prevents memory leaks by capping total entries and evicting least recently used entries.
 */
export class BoundedLruCache {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxEntries=100] Maximum number of items in cache
   * @param {number} [options.defaultTtlMs=30000] Default TTL in milliseconds
   */
  constructor({ maxEntries = 100, defaultTtlMs = 30_000 } = {}) {
    this.maxEntries = Math.max(1, maxEntries);
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
  }

  /**
   * Retrieve a value from the cache. Returns null if not found or expired.
   * Promotes the entry to most recently used.
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order by re-inserting at the end of Map iteration order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /**
   * Insert or update a value in the cache with an optional TTL.
   * If capacity is reached, evicts the least recently used entry.
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs] Custom TTL in milliseconds (defaults to defaultTtlMs)
   */
  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict the first (oldest / LRU) key in Map iteration order
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Delete a key from the cache.
   * @param {string} key
   * @returns {boolean} True if an element in the Map existed and has been removed
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current number of cached entries.
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

export default BoundedLruCache;
