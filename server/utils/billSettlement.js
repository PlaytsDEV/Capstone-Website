/**
 * ============================================================================
 * BILL SETTLEMENT UTILITY (COMPATIBILITY PROXY)
 * ============================================================================
 *
 * Proxy module maintaining backward compatibility for legacy imports.
 * Delegates to `server/services/billing/billSettlement.js`.
 */

export * from "../services/billing/billSettlement.js";
import billSettlement from "../services/billing/billSettlement.js";
export default billSettlement;
