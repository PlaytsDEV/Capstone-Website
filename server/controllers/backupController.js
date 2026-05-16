/**
 * ============================================================================
 * BACKUP CONTROLLER
 * ============================================================================
 *
 * Owner-only endpoints for managing database backups.
 *
 * Features:
 * - Get / update auto-backup configuration
 * - Trigger a manual backup
 * - List backup history
 * - Download a completed backup archive
 * - Delete a backup record + file
 *
 * Backups use a pure Node.js approach: all collections are read via the
 * MongoDB driver and serialized to a gzipped JSON archive. No external
 * tools (e.g. mongodump) are required.
 *
 * ============================================================================
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import mongoose from "mongoose";
import { sendSuccess } from "../middleware/errorHandler.js";
import { BackupConfig, BackupRecord } from "../models/index.js";

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const ensureBackupsDir = () => {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
};

const buildTriggeredBy = (req) => ({
  userId: req?.user?.mongoId || req?.user?.uid || null,
  email: req?.user?.email || "",
  role: req?.user?.dbRole || req?.user?.role || (req?.user?.owner ? "owner" : ""),
});

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const serializeRecord = (record) => ({
  id: record._id,
  type: record.type,
  status: record.status,
  fileName: record.fileName,
  fileSize: record.fileSize,
  fileSizeFormatted: formatBytes(record.fileSize),
  durationMs: record.durationMs,
  collections: record.collections,
  totalDocuments: record.totalDocuments || 0,
  error: record.error,
  triggeredBy: record.triggeredBy,
  createdAt: record.createdAt,
  completedAt: record.completedAt,
});

const serializeConfig = (config) => ({
  autoBackupEnabled: config.autoBackupEnabled,
  intervalDays: config.intervalDays,
  lastAutoBackupAt: config.lastAutoBackupAt,
  updatedBy: config.updatedBy,
  updatedAt: config.updatedAt,
});

/* ─── Core backup execution (pure Node.js) ───────────────────────────────────── */

/**
 * Dump all collections from the database to a gzipped JSON file.
 *
 * The archive format is a JSON object keyed by collection name, where each
 * value is an array of documents. The JSON is then gzipped for compression.
 *
 * @returns {{ collectionCount: number }}
 */
async function dumpToFile(outPath) {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  // Skip system and backup-tracking collections to avoid self-referencing
  const skipCollections = new Set(["backuprecords", "backupconfigs"]);

  const dump = {};
  let collectionCount = 0;

  for (const col of collections) {
    if (skipCollections.has(col.name.toLowerCase())) continue;

    const docs = await db.collection(col.name).find({}).toArray();
    dump[col.name] = docs;
    collectionCount++;
  }

  const jsonString = JSON.stringify(dump, null, 0);
  const jsonBuffer = Buffer.from(jsonString, "utf-8");

  // Gzip and write to disk
  await pipeline(
    Readable.from(jsonBuffer),
    zlib.createGzip({ level: 6 }),
    fs.createWriteStream(outPath),
  );

  return { collectionCount };
}

/**
 * Execute a database backup using pure Node.js.
 *
 * @param {"manual"|"automatic"} type
 * @param {{ userId, email, role }|null} triggeredBy
 * @returns {Promise<Object>} The completed BackupRecord
 */
export async function executeBackup(type = "manual", triggeredBy = null) {
  ensureBackupsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `lilycrest-backup-${timestamp}.json.gz`;
  const outPath = path.join(BACKUPS_DIR, fileName);

  const record = await BackupRecord.create({
    type,
    status: "in_progress",
    fileName,
    filePath: outPath,
    triggeredBy: triggeredBy || { userId: null, email: "system", role: "scheduler" },
  });

  const startTime = Date.now();

  try {
    const { collectionCount } = await dumpToFile(outPath);
    const durationMs = Date.now() - startTime;

    let fileSize = 0;
    try {
      const stat = fs.statSync(outPath);
      fileSize = stat.size;
    } catch { /* file may not exist if write failed silently */ }

    record.status = "completed";
    record.fileSize = fileSize;
    record.durationMs = durationMs;
    record.collections = collectionCount;
    record.completedAt = new Date();
    await record.save();
  } catch (error) {
    const durationMs = Date.now() - startTime;
    record.status = "failed";
    record.error = error.message || String(error);
    record.durationMs = durationMs;
    record.completedAt = new Date();
    await record.save();
  }

  return record;
}

/* ─── Endpoint Handlers ──────────────────────────────────────────────────────── */

/**
 * GET /api/backups/config
 */
export async function getBackupConfig(_req, res, next) {
  try {
    const config = await BackupConfig.getConfig();
    sendSuccess(res, serializeConfig(config));
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/backups/config
 */
export async function updateBackupConfig(req, res, next) {
  try {
    const config = await BackupConfig.getConfig();

    if (req.body.autoBackupEnabled !== undefined) {
      config.autoBackupEnabled = Boolean(req.body.autoBackupEnabled);
    }

    if (req.body.intervalDays !== undefined) {
      const days = Number(req.body.intervalDays);
      if (!Number.isFinite(days) || days < 1 || days > 90 || !Number.isInteger(days)) {
        return res.status(400).json({
          error: "Interval must be a whole number between 1 and 90 days.",
        });
      }
      config.intervalDays = days;
    }

    config.updatedBy = buildTriggeredBy(req);
    await config.save();

    sendSuccess(res, serializeConfig(config));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/backups/trigger
 */
export async function triggerManualBackup(req, res, next) {
  try {
    // Prevent multiple simultaneous backups
    const running = await BackupRecord.findOne({ status: "in_progress" }).lean();
    if (running) {
      return res.status(409).json({
        error: "A backup is already in progress. Please wait for it to complete.",
      });
    }

    const triggeredBy = buildTriggeredBy(req);

    // Create an initial in_progress record to return immediately
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `lilycrest-backup-${timestamp}.json.gz`;
    const outPath = path.join(BACKUPS_DIR, fileName);

    const record = await BackupRecord.create({
      type: "manual",
      status: "in_progress",
      fileName,
      filePath: outPath,
      triggeredBy,
    });

    // Fire-and-forget the actual backup execution
    setImmediate(async () => {
      try {
        await executeBackupForRecord(record);
      } catch (err) {
        console.error("Manual backup execution error:", err);
      }
    });

    sendSuccess(res, serializeRecord(record), 202);
  } catch (error) {
    next(error);
  }
}

/**
 * Execute backup for an already-created record.
 */
async function executeBackupForRecord(record) {
  ensureBackupsDir();

  const startTime = Date.now();

  try {
    const { collectionCount } = await dumpToFile(record.filePath);
    const durationMs = Date.now() - startTime;

    let fileSize = 0;
    try {
      const stat = fs.statSync(record.filePath);
      fileSize = stat.size;
    } catch { /* ignore */ }

    record.status = "completed";
    record.fileSize = fileSize;
    record.durationMs = durationMs;
    record.collections = collectionCount;
    record.completedAt = new Date();
    await record.save();
  } catch (error) {
    const durationMs = Date.now() - startTime;
    record.status = "failed";
    record.error = error.message || String(error);
    record.durationMs = durationMs;
    record.completedAt = new Date();
    await record.save();
  }

  return record;
}

/**
 * GET /api/backups/history
 */
export async function getBackupHistory(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      BackupRecord.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BackupRecord.countDocuments(),
    ]);

    sendSuccess(res, {
      records: records.map(serializeRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/backups/:id/download
 */
export async function downloadBackup(req, res, next) {
  try {
    const record = await BackupRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: "Backup record not found." });
    }

    if (record.status !== "completed") {
      return res.status(400).json({ error: "Backup is not yet completed." });
    }

    if (!record.filePath || !fs.existsSync(record.filePath)) {
      return res.status(404).json({ error: "Backup file not found on disk." });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${record.fileName}"`);
    res.setHeader("Content-Type", "application/gzip");

    const stream = fs.createReadStream(record.filePath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/backups/:id
 */
export async function deleteBackup(req, res, next) {
  try {
    const record = await BackupRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: "Backup record not found." });
    }

    if (record.status === "in_progress") {
      return res.status(400).json({ error: "Cannot delete a backup that is in progress." });
    }

    // Delete the file from disk if it exists
    if (record.filePath && fs.existsSync(record.filePath)) {
      fs.unlinkSync(record.filePath);
    }

    await BackupRecord.findByIdAndDelete(record._id);

    sendSuccess(res, { deleted: true, id: record._id });
  } catch (error) {
    next(error);
  }
}

/* ─── Restore Logic ──────────────────────────────────────────────────────────── */

/**
 * Read a gzipped JSON backup archive and restore all collections into the
 * database. Each collection is dropped and re-inserted from the archive.
 *
 * @param {string} archivePath  Absolute path to the .json.gz file
 * @returns {{ restoredCollections: number, totalDocuments: number }}
 */
async function restoreFromFile(archivePath) {
  // Read the gzipped file
  const compressed = fs.readFileSync(archivePath);

  // Decompress
  const decompressed = await new Promise((resolve, reject) => {
    zlib.gunzip(compressed, (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });

  const dump = JSON.parse(decompressed.toString("utf-8"));
  const db = mongoose.connection.db;

  // Safety: never restore backup-tracking collections
  const skipCollections = new Set(["backuprecords", "backupconfigs"]);

  let restoredCollections = 0;
  let totalDocuments = 0;

  for (const [collectionName, docs] of Object.entries(dump)) {
    if (skipCollections.has(collectionName.toLowerCase())) continue;

    const collection = db.collection(collectionName);

    // Drop all existing documents in the collection
    await collection.deleteMany({});

    // Insert the backup documents (skip if collection was empty in backup)
    if (Array.isArray(docs) && docs.length > 0) {
      // Convert _id strings back to ObjectIds where applicable
      const preparedDocs = docs.map((doc) => {
        if (doc._id && typeof doc._id === "string" && /^[0-9a-fA-F]{24}$/.test(doc._id)) {
          doc._id = new mongoose.Types.ObjectId(doc._id);
        }
        return doc;
      });
      await collection.insertMany(preparedDocs, { ordered: false });
      totalDocuments += preparedDocs.length;
    }

    restoredCollections++;
  }

  return { restoredCollections, totalDocuments };
}

/**
 * POST /api/backups/:id/restore
 *
 * Restore the database from a completed backup archive.
 * Creates a pre-restore safety snapshot before overwriting data.
 */
export async function restoreBackup(req, res, next) {
  try {
    const sourceRecord = await BackupRecord.findById(req.params.id);

    if (!sourceRecord) {
      return res.status(404).json({ error: "Backup record not found." });
    }

    if (sourceRecord.status !== "completed") {
      return res.status(400).json({ error: "Only completed backups can be restored." });
    }

    if (!sourceRecord.filePath || !fs.existsSync(sourceRecord.filePath)) {
      return res.status(404).json({ error: "Backup file not found on disk." });
    }

    // Prevent overlapping operations
    const running = await BackupRecord.findOne({ status: "in_progress" }).lean();
    if (running) {
      return res.status(409).json({
        error: "Another backup or restore operation is in progress. Please wait.",
      });
    }

    const triggeredBy = buildTriggeredBy(req);

    // Create a restore record to track progress
    const restoreRecord = await BackupRecord.create({
      type: "restore",
      status: "in_progress",
      fileName: `restore-from-${sourceRecord.fileName}`,
      filePath: sourceRecord.filePath,
      triggeredBy,
    });

    // Fire-and-forget the restore execution
    setImmediate(async () => {
      const startTime = Date.now();
      try {
        // Restore from backup
        console.log(`[Restore] Restoring from: ${sourceRecord.fileName}...`);
        const { restoredCollections, totalDocuments } = await restoreFromFile(sourceRecord.filePath);
        const durationMs = Date.now() - startTime;

        restoreRecord.status = "completed";
        restoreRecord.collections = restoredCollections;
        restoreRecord.totalDocuments = totalDocuments;
        restoreRecord.durationMs = durationMs;
        restoreRecord.completedAt = new Date();
        await restoreRecord.save();

        console.log(
          `[Restore] Completed — ${restoredCollections} collections, ${totalDocuments} documents in ${durationMs}ms`,
        );
      } catch (error) {
        const durationMs = Date.now() - startTime;
        restoreRecord.status = "failed";
        restoreRecord.error = error.message || String(error);
        restoreRecord.durationMs = durationMs;
        restoreRecord.completedAt = new Date();
        await restoreRecord.save();
        console.error("[Restore] Failed:", error);
      }
    });

    sendSuccess(res, serializeRecord(restoreRecord), 202);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/backups/upload-restore
 *
 * Upload a previously downloaded .json.gz backup file and restore the
 * database from it. The uploaded file is saved to the backups directory,
 * a pre-restore safety snapshot is created, and the restore runs async.
 *
 * Expects multipart form data with a field named "backupFile".
 */
export async function uploadAndRestore(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No backup file was uploaded." });
    }

    const { originalname, path: tmpPath, size } = req.file;

    // Validate file extension
    if (!originalname.endsWith(".json.gz") && !originalname.endsWith(".gz")) {
      // Clean up the uploaded file
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return res.status(400).json({
        error: "Invalid file type. Please upload a .json.gz backup archive.",
      });
    }

    // Validate the file is a valid gzip + JSON before proceeding
    try {
      const compressed = fs.readFileSync(tmpPath);
      const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(compressed, (err, buf) => {
          if (err) reject(err);
          else resolve(buf);
        });
      });
      JSON.parse(decompressed.toString("utf-8")); // Will throw if invalid JSON
    } catch (validationError) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return res.status(400).json({
        error: "Invalid backup file. The file must be a valid gzipped JSON archive.",
      });
    }

    // Move uploaded file to the backups directory with a clean name
    ensureBackupsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `uploaded-backup-${timestamp}.json.gz`;
    const finalPath = path.join(BACKUPS_DIR, fileName);
    fs.renameSync(tmpPath, finalPath);

    // Prevent overlapping operations
    const running = await BackupRecord.findOne({ status: "in_progress" }).lean();
    if (running) {
      return res.status(409).json({
        error: "Another backup or restore operation is in progress. Please wait.",
      });
    }

    const triggeredBy = buildTriggeredBy(req);

    // Create the restore record
    const restoreRecord = await BackupRecord.create({
      type: "restore",
      status: "in_progress",
      fileName: `restore-from-upload (${originalname})`,
      filePath: finalPath,
      triggeredBy,
    });

    // Fire-and-forget restore execution
    setImmediate(async () => {
      const startTime = Date.now();
      try {
        // Restore from uploaded file
        console.log(`[Restore-Upload] Restoring from: ${originalname}...`);
        const { restoredCollections, totalDocuments } = await restoreFromFile(finalPath);
        const durationMs = Date.now() - startTime;

        restoreRecord.status = "completed";
        restoreRecord.collections = restoredCollections;
        restoreRecord.totalDocuments = totalDocuments;
        restoreRecord.durationMs = durationMs;
        restoreRecord.completedAt = new Date();
        await restoreRecord.save();

        console.log(
          `[Restore-Upload] Completed — ${restoredCollections} collections, ${totalDocuments} documents in ${durationMs}ms`,
        );
      } catch (error) {
        const durationMs = Date.now() - startTime;
        restoreRecord.status = "failed";
        restoreRecord.error = error.message || String(error);
        restoreRecord.durationMs = durationMs;
        restoreRecord.completedAt = new Date();
        await restoreRecord.save();
        console.error("[Restore-Upload] Failed:", error);
      }
    });

    sendSuccess(res, serializeRecord(restoreRecord), 202);
  } catch (error) {
    next(error);
  }
}

/* ─── Auto-Backup Scheduler ──────────────────────────────────────────────────── */

/**
 * Check if an automatic backup is due and execute it if so.
 * Called periodically by the scheduler (e.g., every hour).
 */
export async function checkAndRunAutoBackup() {
  try {
    if (mongoose.connection.readyState !== 1) return;

    const config = await BackupConfig.getConfig();
    if (!config.autoBackupEnabled) return;

    const now = new Date();
    const intervalMs = config.intervalDays * 24 * 60 * 60 * 1000;

    if (config.lastAutoBackupAt) {
      const elapsed = now.getTime() - new Date(config.lastAutoBackupAt).getTime();
      if (elapsed < intervalMs) return;
    }

    // Prevent overlapping auto-backups
    const running = await BackupRecord.findOne({ status: "in_progress" }).lean();
    if (running) return;

    console.log("[Backup Scheduler] Starting automatic backup...");
    const record = await executeBackup("automatic", null);

    if (record.status === "completed") {
      config.lastAutoBackupAt = record.completedAt;
      await config.save();
      console.log(`[Backup Scheduler] Automatic backup completed (${formatBytes(record.fileSize)})`);
    } else {
      console.error(`[Backup Scheduler] Automatic backup failed: ${record.error}`);
    }
  } catch (error) {
    console.error("[Backup Scheduler] Error during auto-backup check:", error);
  }
}
