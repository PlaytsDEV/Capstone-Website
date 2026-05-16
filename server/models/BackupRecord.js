/**
 * ============================================================================
 * BACKUP RECORD MODEL
 * ============================================================================
 *
 * One document per backup attempt (manual or automatic).
 * Tracks status, file path, size, duration, and who triggered it.
 *
 * ============================================================================
 */

import mongoose from "mongoose";

const backupRecordSchema = new mongoose.Schema(
  {
    /** "manual" | "automatic" */
    type: {
      type: String,
      enum: ["manual", "automatic", "restore"],
      required: true,
    },

    /** "in_progress" | "completed" | "failed" */
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
    },

    /** Relative path to the backup archive on disk (from server root). */
    filePath: {
      type: String,
      default: null,
    },

    /** Archive file name (for display). */
    fileName: {
      type: String,
      default: null,
    },

    /** Size of the archive in bytes. */
    fileSize: {
      type: Number,
      default: 0,
    },

    /** How long the backup took in milliseconds. */
    durationMs: {
      type: Number,
      default: 0,
    },

    /** Number of collections included in the backup. */
    collections: {
      type: Number,
      default: 0,
    },

    /** Total documents restored (used by restore-type records). */
    totalDocuments: {
      type: Number,
      default: 0,
    },

    /** Error message if the backup failed. */
    error: {
      type: String,
      default: null,
    },

    /** Who triggered it (null for automatic backups). */
    triggeredBy: {
      userId: { type: String, default: null },
      email: { type: String, default: "" },
      role: { type: String, default: "" },
    },

    /** When the backup finished (success or failure). */
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

backupRecordSchema.index({ createdAt: -1 });
backupRecordSchema.index({ status: 1 });

const BackupRecord = mongoose.model("BackupRecord", backupRecordSchema);

export default BackupRecord;
