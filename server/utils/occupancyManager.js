/**
 * ============================================================================
 * OCCUPANCY MANAGER UTILITY (COMPATIBILITY PROXY)
 * ============================================================================
 *
 * Proxy module maintaining backward compatibility for legacy imports.
 * Delegates to `server/services/occupancy/occupancyManager.js`.
 */

export {
  deriveRoomOccupancyState,
  updateOccupancyOnReservationChange,
  recalculateRoomOccupancy,
  getRoomOccupancyStatus,
  getBranchOccupancyStats,
  releaseOrphanedBeds,
} from "../services/occupancy/occupancyManager.js";
import occupancyManager from "../services/occupancy/occupancyManager.js";
export default occupancyManager;
