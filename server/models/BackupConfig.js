/**
 * ============================================================================
 * BACKUP CONFIGURATION MODEL
 * ============================================================================
 *
 * Singleton-style document that stores the owner's backup preferences.
 * Only one document should exist (enforced by the `key` unique field).
 *
 * ============================================================================
 */

import mongoose from "mongoose";

const backupConfigSchema = new mongoose.Schema(
  {
    /** Unique key — always "global" so only one config doc exists. */
    key: {
      type: String,
      default: "global",
      unique: true,
      immutable: true,
    },

    /** Whether automatic backups are enabled. */
    autoBackupEnabled: {
      type: Boolean,
      default: false,
    },

    /** How often (in days) automatic backups should run. */
    intervalDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 90,
    },

    /** Timestamp of the last automatic backup that completed. */
    lastAutoBackupAt: {
      type: Date,
      default: null,
    },

    /** Who last changed the configuration. */
    updatedBy: {
      userId: { type: String, default: null },
      email: { type: String, default: "" },
      role: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Retrieve (or create) the singleton backup config document.
 */
backupConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne({ key: "global" });
  if (!config) {
    config = await this.create({ key: "global" });
  }
  return config;
};

const BackupConfig = mongoose.model("BackupConfig", backupConfigSchema);

export default BackupConfig;
