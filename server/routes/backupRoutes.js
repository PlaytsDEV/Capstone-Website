/**
 * ============================================================================
 * BACKUP ROUTES
 * ============================================================================
 *
 * Owner-only routes for database backup management.
 *
 * The download endpoint accepts the token as a query parameter (?token=...)
 * since browser-initiated downloads cannot set Authorization headers.
 *
 * ============================================================================
 */

import express from "express";
import path from "path";
import multer from "multer";
import { verifyToken, verifyOwner } from "../middleware/auth.js";
import {
  getBackupConfig,
  updateBackupConfig,
  triggerManualBackup,
  getBackupHistory,
  downloadBackup,
  deleteBackup,
  restoreBackup,
  uploadAndRestore,
} from "../controllers/backupController.js";

const router = express.Router();

/**
 * Multer configuration for backup file uploads.
 * Files are stored temporarily in backups/tmp/ before validation.
 */
const uploadDir = path.resolve(process.cwd(), "backups", "tmp");
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

/**
 * Middleware that promotes a `?token=` query parameter to the Authorization
 * header so that verifyToken can pick it up. This is required for direct
 * browser downloads (e.g. <a href="...">) which cannot set custom headers.
 */
const tokenFromQuery = (req, _res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

// Download route — needs query-param token support (must be registered BEFORE the router.use guard)
router.get("/:id/download", tokenFromQuery, verifyToken, verifyOwner, downloadBackup);

// All other backup routes require owner privileges via header-based auth
router.use(verifyToken, verifyOwner);

router.get("/config", getBackupConfig);
router.patch("/config", updateBackupConfig);
router.post("/trigger", triggerManualBackup);
router.get("/history", getBackupHistory);
router.post("/upload-restore", upload.single("backupFile"), uploadAndRestore);
router.delete("/:id", deleteBackup);
router.post("/:id/restore", restoreBackup);

export default router;
