import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import { ROOM_BRANCHES } from "../config/branches.js";
import { resolveMaintenanceRequestStorageBranch } from "../services/attachmentUploadService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const shouldWrite = process.argv.includes("--write");

if (!MONGODB_URI) {
  console.error("[repair-maintenance-branches] MONGODB_URI or MONGO_URI is required.");
  process.exit(1);
}

const branchlessQuery = {
  $or: [
    { branch: { $exists: false } },
    { branch: null },
    { branch: "" },
    { branch: { $nin: ROOM_BRANCHES } },
  ],
};

const formatRequestKey = (request) =>
  request.request_id || request._id?.toString?.() || String(request._id);

const main = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`[repair-maintenance-branches] Connected to ${mongoose.connection.name}`);
  console.log(
    `[repair-maintenance-branches] Mode: ${shouldWrite ? "WRITE" : "DRY-RUN"}`,
  );

  const candidates = await MaintenanceRequest.find(branchlessQuery)
    .sort({ created_at: -1, createdAt: -1 })
    .lean();

  console.log(
    `[repair-maintenance-branches] Found ${candidates.length} maintenance request(s) with missing or invalid branch.`,
  );

  let fixedCount = 0;
  const unresolved = [];

  for (const request of candidates) {
    const requestKey = formatRequestKey(request);
    const resolution = await resolveMaintenanceRequestStorageBranch(request);

    if (!resolution.branch) {
      unresolved.push({
        requestId: requestKey,
        userId: request.user_id || request.userId || null,
        roomId: request.roomId || null,
        reservationId: request.reservationId || null,
      });
      console.log(`[repair-maintenance-branches] unresolved: ${requestKey}`);
      continue;
    }

    const update = { branch: resolution.branch };
    if (!request.roomId && resolution.roomId) {
      update.roomId = resolution.roomId;
    }
    if (!request.reservationId && resolution.reservationId) {
      update.reservationId = resolution.reservationId;
    }

    console.log(
      `[repair-maintenance-branches] ${shouldWrite ? "repairing" : "would repair"}: ${requestKey} -> ${resolution.branch} (${resolution.source})`,
    );

    if (shouldWrite) {
      const result = await MaintenanceRequest.updateOne(
        { _id: request._id },
        { $set: update },
      );
      if (result.modifiedCount > 0) {
        fixedCount += 1;
      }
    } else {
      fixedCount += 1;
    }
  }

  if (unresolved.length > 0) {
    console.log("[repair-maintenance-branches] Unresolved records:");
    for (const item of unresolved) {
      console.log(
        `  - requestId=${item.requestId} userId=${item.userId || "missing"} roomId=${item.roomId || "missing"} reservationId=${item.reservationId || "missing"}`,
      );
    }
  }

  console.log(
    `[repair-maintenance-branches] Summary: ${fixedCount} ${shouldWrite ? "repaired" : "repairable"}, ${unresolved.length} unresolved.`,
  );

  if (!shouldWrite) {
    console.log("[repair-maintenance-branches] Dry run complete. Re-run with --write to save resolved branches.");
  }
};

main()
  .catch((error) => {
    console.error("[repair-maintenance-branches] ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
