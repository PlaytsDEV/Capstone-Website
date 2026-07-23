/**
 * ============================================================================
 * TENANT BILLING CONTROLLER (DEPRECATED MONOLITH PROXY)
 * ============================================================================
 *
 * Decomposed into domain-specific sub-controllers under `server/controllers/billing/`.
 * Maintains 100% backward compatibility.
 */
export * from "./billing/index.js";
import billingController from "./billing/index.js";
export default billingController;
