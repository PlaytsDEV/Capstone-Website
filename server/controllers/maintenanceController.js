/**
 * ============================================================================
 * MAINTENANCE CONTROLLER FACADE / RE-EXPORTER
 * ============================================================================
 *
 * Proxy module that re-exports functions from specialized subcontrollers in
 * `./maintenance/` to ensure full backward compatibility across the codebase.
 */

export * from "./maintenance/_helpers.js";
export * from "./maintenance/tenantMaintenanceController.js";
export * from "./maintenance/adminMaintenanceController.js";
export * from "./maintenance/maintenanceAiController.js";
export * from "./maintenance/maintenanceAttachmentController.js";
export * from "./maintenance/maintenanceAnalyticsController.js";
