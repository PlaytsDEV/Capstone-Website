/**
 * ============================================================================
 * NOTIFICATION SERVICE UTILITY (COMPATIBILITY PROXY)
 * ============================================================================
 *
 * Proxy module maintaining backward compatibility for legacy imports.
 * Delegates to `server/services/notifications/notificationService.js`.
 */

export * from "../services/notifications/notificationService.js";
import notify from "../services/notifications/notificationService.js";
export default notify;
