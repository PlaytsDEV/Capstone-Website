/**
 * ============================================================================
 * AUDIT LOGGER UTILITY (COMPATIBILITY PROXY)
 * ============================================================================
 *
 * Proxy module maintaining backward compatibility for legacy imports.
 * Delegates to `server/services/audit/auditLogger.js`.
 */

import auditLogger from "../services/audit/auditLogger.js";

export default auditLogger;
