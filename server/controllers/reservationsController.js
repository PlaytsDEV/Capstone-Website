/**
 * ============================================================================
 * RESERVATIONS CONTROLLER (DEPRECATED MONOLITH PROXY)
 * ============================================================================
 *
 * All logic has been decomposed into domain-specific sub-controllers under
 * `server/controllers/reservations/`.
 *
 * This barrel proxy maintains full backward compatibility for legacy imports.
 */

export * from "./reservations/index.js";
