/**
 * ============================================================================
 * BED LOCK CLEANUP UTILITY (COMPATIBILITY PROXY)
 * ============================================================================
 *
 * Proxy module maintaining backward compatibility for legacy imports.
 * Delegates to `server/services/occupancy/bedLockCleanup.js`.
 */

export * from "../services/occupancy/bedLockCleanup.js";
import startBedLockCleanupJob from "../services/occupancy/bedLockCleanup.js";
export default startBedLockCleanupJob;
