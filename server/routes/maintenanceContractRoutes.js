/**
 * ============================================================================
 * MAINTENANCE CONTRACT ROUTES
 * ============================================================================
 *
 * Canonical contract routes:
 * - Tenant: /api/m/maintenance/*
 * - Admin:  /api/m/maintenance/admin/*
 *
 * This router also exposes temporary compatibility aliases so the same
 * implementation can be mounted under /api/maintenance during rollout.
 *
 * ============================================================================
 */

import express from "express";
import multer from "multer";
import * as maintenanceController from "../controllers/maintenanceController.js";
import {
    verifyAdmin,
    verifyApplicant,
    verifyToken,
} from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  ATTACHMENT_TYPE_ERROR_MESSAGE,
  isAllowedAttachmentFile,
} from "../services/attachmentUploadService.js";

const router = express.Router();
const maintenanceAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAttachmentFile(file)) {
      cb(null, true);
      return;
    }

    const error = new Error(ATTACHMENT_TYPE_ERROR_MESSAGE);
    error.statusCode = 400;
    error.code = "UNSUPPORTED_FILE_TYPE";
    cb(error);
  },
});

router.use(verifyToken);

// Canonical tenant routes
router.get("/me", verifyApplicant, maintenanceController.getMyRequests);
router.post("/", verifyApplicant, maintenanceController.createRequest);
router.put("/:requestId", verifyApplicant, maintenanceController.updateMyRequest);
router.patch(
  "/:requestId/cancel",
  verifyApplicant,
  maintenanceController.cancelMyRequest,
);
router.patch(
  "/:requestId/reopen",
  verifyApplicant,
  maintenanceController.reopenMyRequest,
);
router.post(
  "/:requestId/reply",
  verifyApplicant,
  maintenanceController.sendTenantReply,
);

// Canonical admin routes
router.get(
  "/admin/all",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getAdminAll,
);
router.get(
  "/admin/analytics",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getAdminMaintenanceAnalytics,
);
router.get(
  "/admin/reports/branch",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getAdminMaintenanceBranchReport,
);
router.get(
  "/admin/reports/providers",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getAdminMaintenanceProviderReport,
);
router.patch(
  "/admin/:requestId/status",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.updateAdminRequestStatus,
);
router.post(
  "/admin/:requestId/assign-provider",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.assignAdminMaintenanceProvider,
);
router.patch(
  "/admin/:requestId/branch",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.assignAdminMaintenanceBranch,
);
router.post(
  "/admin/:requestId/generate-update",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.generateAdminMaintenanceUpdate,
);
router.post(
  "/admin/:requestId/generate-report",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.generateAdminMaintenanceReport,
);
router.post(
  "/admin/:requestId/send-tenant-summary",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.sendAdminTenantSummary,
);
router.post(
  "/admin/:requestId/suggest-provider",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.suggestAdminMaintenanceProvider,
);
router.post(
  "/admin/:requestId/attachments",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceAttachmentUpload.single("file"),
  maintenanceController.uploadAdminMaintenanceAttachment,
);
router.post(
  "/admin/:requestId/proof",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.saveAdminMaintenanceProof,
);
router.patch(
  "/admin/:requestId/attachments/remove",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.removeAdminMaintenanceAttachment,
);
router.post(
  "/admin/:requestId/reply",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.sendAdminReply,
);
router.patch(
  "/admin/:requestId/archive",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.archiveAdminMaintenanceRequest,
);
router.patch(
  "/admin/:requestId/restore",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.restoreAdminMaintenanceRequest,
);
router.patch(
  "/admin/bulk",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.updateAdminBulkRequests,
);

// Compatibility aliases for legacy repo callers
router.get("/my-requests", verifyApplicant, maintenanceController.getMyRequests);
router.post("/requests", verifyApplicant, maintenanceController.createRequestCompat);
router.post("/requests/:requestId/reply", verifyApplicant, maintenanceController.sendTenantReply);
router.get(
  "/branch",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getByBranch,
);
router.patch(
  "/requests/:requestId",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.updateRequest,
);
router.get(
  "/stats/completion",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getCompletionStats,
);
router.get(
  "/stats/issue-frequency",
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
  maintenanceController.getIssueFrequency,
);

// Shared detail routes
router.get("/requests/:requestId", maintenanceController.getRequestById);
router.get("/:requestId", maintenanceController.getRequestById);

export default router;
