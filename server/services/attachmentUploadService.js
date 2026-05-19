import crypto from "crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import admin from "../config/firebase.js";
import { ROOM_BRANCHES } from "../config/branches.js";
import { isAdminRole, isOwnerRole } from "../config/roles.js";
import {
  BedHistory,
  ChatConversation,
  MaintenanceRequest,
  Reservation,
  Room,
  Stay,
  User,
} from "../models/index.js";
import { AppError } from "../middleware/errorHandler.js";
import { CURRENT_RESIDENT_STATUS_QUERY } from "../utils/lifecycleNaming.js";

export const UPLOAD_BRANCH_ERROR_MESSAGE =
  "Unable to determine the assigned branch for this upload. Please refresh and try again or contact support.";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const VALID_VISIBILITIES = new Set(["tenant_admin", "admin_only"]);
const OWNER_BRANCH_FIELD_NAMES = ["branchId", "branch_id", "branch"];

const toText = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

const normalizeBranch = (value) => {
  const branch = toText(value).toLowerCase();
  return ROOM_BRANCHES.includes(branch) ? branch : "";
};

const getField = (req, names) => {
  const fields = Array.isArray(names) ? names : [names];
  for (const field of fields) {
    const bodyValue = req.body?.[field];
    if (bodyValue !== undefined && bodyValue !== null && toText(bodyValue)) {
      return toText(bodyValue);
    }

    const queryValue = req.query?.[field];
    if (queryValue !== undefined && queryValue !== null && toText(queryValue)) {
      return toText(queryValue);
    }
  }
  return "";
};

const getHeader = (req, name) => {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? toText(value[0]) : toText(value);
};

const isTenantRole = (role) => !isAdminRole(String(role || "").toLowerCase());

const buildMaintenanceIdentifierQuery = (requestId) => {
  const identifier = toText(requestId);
  if (!identifier) return { request_id: "__missing__" };
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return {
      $or: [
        { request_id: identifier },
        { _id: identifier },
      ],
    };
  }
  return { request_id: identifier };
};

const getDbUser = async (req, providedUser = null) => {
  if (providedUser) return providedUser;

  const firebaseUid = req.user?.uid;
  if (!firebaseUid) {
    throw new AppError("User not authenticated", 401, "USER_NOT_AUTHENTICATED");
  }

  const user = await User.findOne({ firebaseUid })
    .select("_id user_id firebaseUid firstName lastName email branch role tenantStatus")
    .lean();

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return user;
};

const getRoomBranch = async (roomId) => {
  if (!roomId) return "";
  if (typeof roomId === "object" && !Array.isArray(roomId)) {
    const directBranch = normalizeBranch(roomId.branch || roomId.branchId);
    if (directBranch) return directBranch;
  }

  const room = await Room.findById(roomId).select("branch").lean().catch(() => null);
  return normalizeBranch(room?.branch);
};

const getReservationBranch = async (reservation) => {
  const directBranch = normalizeBranch(reservation?.branch || reservation?.branchId);
  if (directBranch) return directBranch;
  return getRoomBranch(reservation?.roomId);
};

const loadActiveTenantReservation = async (dbUser) =>
  Reservation.findOne({
    userId: dbUser._id,
    status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
    isArchived: { $ne: true },
  })
    .sort({ moveInDate: -1, createdAt: -1 })
    .populate("roomId", "branch")
    .select("_id branch branchId roomId")
    .lean();

const loadLatestTenantReservation = async (dbUser) =>
  Reservation.findOne({
    userId: dbUser._id,
    isArchived: { $ne: true },
  })
    .sort({ moveInDate: -1, createdAt: -1 })
    .populate("roomId", "branch")
    .select("_id branch branchId roomId")
    .lean();

const resolveTenantBranch = async (dbUser) => {
  const activeStay = await Stay.findOne({
    tenantId: dbUser._id,
    status: { $in: ["active", "ending_soon"] },
  })
    .sort({ leaseStartDate: -1, createdAt: -1 })
    .select("branch roomId reservationId")
    .lean()
    .catch(() => null);

  const stayBranch = normalizeBranch(activeStay?.branch) || (await getRoomBranch(activeStay?.roomId));
  if (stayBranch) {
    return {
      branch: stayBranch,
      source: "active_stay",
      reservationId: activeStay?.reservationId || null,
      roomId: activeStay?.roomId || null,
    };
  }

  const activeReservation = await loadActiveTenantReservation(dbUser).catch(() => null);
  const activeReservationBranch = await getReservationBranch(activeReservation);
  if (activeReservationBranch) {
    return {
      branch: activeReservationBranch,
      source: "active_reservation",
      reservationId: activeReservation?._id || null,
      roomId: activeReservation?.roomId?._id || activeReservation?.roomId || null,
    };
  }

  const bedHistory = await BedHistory.findOne({
    tenantId: dbUser._id,
    status: "active",
  })
    .sort({ moveInDate: -1, effectiveStartDate: -1 })
    .select("branch roomId reservationId")
    .lean()
    .catch(() => null);

  const bedHistoryBranch = normalizeBranch(bedHistory?.branch) || (await getRoomBranch(bedHistory?.roomId));
  if (bedHistoryBranch) {
    return {
      branch: bedHistoryBranch,
      source: "bed_history",
      reservationId: bedHistory?.reservationId || null,
      roomId: bedHistory?.roomId || null,
    };
  }

  const userBranch = normalizeBranch(dbUser?.branch);
  if (userBranch) {
    return { branch: userBranch, source: "user_profile" };
  }

  const latestReservation = await loadLatestTenantReservation(dbUser).catch(() => null);
  const latestReservationBranch = await getReservationBranch(latestReservation);
  if (latestReservationBranch) {
    return {
      branch: latestReservationBranch,
      source: "latest_reservation",
      reservationId: latestReservation?._id || null,
      roomId: latestReservation?.roomId?._id || latestReservation?.roomId || null,
    };
  }

  return { branch: "", source: "unresolved" };
};

const userOwnsMaintenanceRequest = (dbUser, request) =>
  String(request?.user_id || "") === String(dbUser?.user_id || "") ||
  (request?.userId && String(request.userId) === String(dbUser?._id));

const assertMaintenanceAccess = (dbUser, request, branch) => {
  const role = String(dbUser?.role || "").toLowerCase();

  if (isOwnerRole(role)) return;

  if (isAdminRole(role)) {
    if (normalizeBranch(dbUser?.branch) === branch) return;
    throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
  }

  if (userOwnsMaintenanceRequest(dbUser, request)) return;

  throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
};

const resolveBranchFromMaintenanceRequest = async (dbUser, request) => {
  let branch = normalizeBranch(request?.branch || request?.branchId);
  if (!branch) {
    branch = await getRoomBranch(request?.roomId);
  }

  if (!branch) {
    throw new AppError(
      UPLOAD_BRANCH_ERROR_MESSAGE,
      400,
      "UPLOAD_BRANCH_UNRESOLVED",
    );
  }

  assertMaintenanceAccess(dbUser, request, branch);

  return {
    branch,
    source: "maintenance_request",
    relatedId: request?.request_id || String(request?._id || ""),
    maintenanceRequest: request,
    reservationId: request?.reservationId || null,
    roomId: request?.roomId || null,
  };
};

const resolveBranchFromConversation = async (dbUser, conversationId) => {
  const conversation = await ChatConversation.findById(conversationId).lean();
  const branch = normalizeBranch(conversation?.branch);
  if (!conversation || !branch) {
    throw new AppError(
      UPLOAD_BRANCH_ERROR_MESSAGE,
      400,
      "UPLOAD_BRANCH_UNRESOLVED",
    );
  }

  const role = String(dbUser?.role || "").toLowerCase();
  if (isOwnerRole(role)) {
    return { branch, source: "conversation", relatedId: String(conversation._id), conversation };
  }

  if (isAdminRole(role)) {
    if (normalizeBranch(dbUser?.branch) !== branch) {
      throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
    }
    return { branch, source: "conversation", relatedId: String(conversation._id), conversation };
  }

  if (String(conversation.tenantId) !== String(dbUser?._id)) {
    throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
  }

  return { branch, source: "conversation", relatedId: String(conversation._id), conversation };
};

const getExplicitBranch = (req) => {
  for (const field of OWNER_BRANCH_FIELD_NAMES) {
    const branch = normalizeBranch(getField(req, field));
    if (branch) return branch;
  }

  return (
    normalizeBranch(getHeader(req, "x-branch-id")) ||
    normalizeBranch(getHeader(req, "x-branch"))
  );
};

export const resolveUploadBranch = async (req, options = {}) => {
  const dbUser = await getDbUser(req, options.dbUser);
  const context = toText(options.context || getField(req, "context")) || "attachment";
  const maintenanceRequestId =
    toText(options.maintenanceRequestId) ||
    getField(req, ["maintenanceRequestId", "maintenance_request_id", "requestId", "request_id"]) ||
    (context.startsWith("maintenance")
      ? toText(options.relatedId || getField(req, ["relatedId", "related_id"]))
      : "");
  const conversationId =
    toText(options.conversationId) ||
    getField(req, ["conversationId", "conversation_id"]) ||
    (context.includes("chat")
      ? toText(options.relatedId || getField(req, ["relatedId", "related_id"]))
      : "");

  if (options.maintenanceRequest) {
    return {
      dbUser,
      context,
      ...(await resolveBranchFromMaintenanceRequest(dbUser, options.maintenanceRequest)),
    };
  }

  if (maintenanceRequestId) {
    const request = await MaintenanceRequest.findOne(
      buildMaintenanceIdentifierQuery(maintenanceRequestId),
    ).lean();

    if (!request || request.isArchived) {
      throw new AppError("Maintenance request not found", 404, "REQUEST_NOT_FOUND");
    }

    return {
      dbUser,
      context,
      ...(await resolveBranchFromMaintenanceRequest(dbUser, request)),
    };
  }

  if (conversationId) {
    return {
      dbUser,
      context,
      ...(await resolveBranchFromConversation(dbUser, conversationId)),
    };
  }

  const role = String(dbUser?.role || "").toLowerCase();
  if (isTenantRole(role)) {
    const tenantResolution = await resolveTenantBranch(dbUser);
    if (tenantResolution.branch) {
      const explicitBranch = getExplicitBranch(req);
      if (explicitBranch && explicitBranch !== tenantResolution.branch) {
        throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
      }

      return {
        dbUser,
        context,
        ...tenantResolution,
      };
    }
  } else if (isOwnerRole(role)) {
    const explicitBranch = getExplicitBranch(req);
    if (explicitBranch) {
      return {
        dbUser,
        context,
        branch: explicitBranch,
        source: "owner_selected_branch",
      };
    }
  } else {
    const adminBranch = normalizeBranch(dbUser?.branch);
    if (adminBranch) {
      const explicitBranch = getExplicitBranch(req);
      if (explicitBranch && explicitBranch !== adminBranch) {
        throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
      }

      return {
        dbUser,
        context,
        branch: adminBranch,
        source: "admin_profile",
      };
    }
  }

  throw new AppError(
    UPLOAD_BRANCH_ERROR_MESSAGE,
    400,
    "UPLOAD_BRANCH_UNRESOLVED",
  );
};

export const resolveAttachmentVisibility = (context, rawVisibility) => {
  const requestedVisibility = toText(rawVisibility).toLowerCase();
  if (VALID_VISIBILITIES.has(requestedVisibility)) {
    return requestedVisibility;
  }

  return context === "maintenance_internal_note" ? "admin_only" : "tenant_admin";
};

const sanitizeStorageSegment = (value, fallback) => {
  const segment = toText(value)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return segment || fallback;
};

const getPublicBaseUrl = (req) => {
  const configured =
    process.env.PUBLIC_API_URL ||
    process.env.SERVER_PUBLIC_URL ||
    process.env.API_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
};

const storeLocally = async ({ file, storagePath, req }) => {
  const uploadRoot = path.resolve(__dirname, "..", "uploads");
  const relativePath = storagePath.replace(/^uploads\//, "");
  const absolutePath = path.join(uploadRoot, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return {
    provider: "local",
    storagePath,
    downloadUrl: `${getPublicBaseUrl(req)}/${storagePath.split(path.sep).join("/")}`,
  };
};

const storeInFirebase = async ({ file, storagePath, metadata }) => {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.GCLOUD_STORAGE_BUCKET ||
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

  if (!admin.apps.length || !bucketName) {
    return null;
  }

  const bucket = admin.storage().bucket(bucketName);
  const token = crypto.randomUUID();
  const firebasePath = storagePath.replace(/^uploads\//, "");

  await bucket.file(firebasePath).save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype,
      metadata: {
        firebaseStorageDownloadTokens: token,
        ...Object.fromEntries(
          Object.entries(metadata)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)]),
        ),
      },
    },
  });

  return {
    provider: "firebase-storage",
    storagePath: firebasePath,
    downloadUrl:
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
      `${encodeURIComponent(firebasePath)}?alt=media&token=${token}`,
  };
};

export const uploadAttachmentFile = async ({ req, file, options = {} }) => {
  if (!file) {
    throw new AppError("Please choose a photo or PDF to upload.", 400, "FILE_REQUIRED");
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AppError("File is too large. Maximum size is 5 MB.", 400, "FILE_TOO_LARGE");
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      "This file type is not supported. Please upload a photo or PDF.",
      400,
      "UNSUPPORTED_FILE_TYPE",
    );
  }

  const resolution = await resolveUploadBranch(req, options);
  const context = resolution.context;
  const visibility = resolveAttachmentVisibility(
    context,
    options.visibility || getField(req, "visibility"),
  );
  const relatedId =
    toText(options.relatedId) ||
    getField(req, ["relatedId", "related_id"]) ||
    resolution.relatedId ||
    null;
  const senderRole =
    toText(options.senderRole) ||
    toText(resolution.dbUser?.role) ||
    "user";
  const uploadedBy =
    toText(options.uploadedBy) ||
    toText(resolution.dbUser?.user_id) ||
    String(resolution.dbUser?._id || "");

  const safeName = sanitizeStorageSegment(file.originalname, "attachment");
  const storagePath = [
    "uploads",
    "attachments",
    resolution.branch,
    sanitizeStorageSegment(context, "attachment"),
    relatedId ? sanitizeStorageSegment(relatedId, "related") : "unlinked",
    `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
  ].join("/");

  const baseMetadata = {
    context,
    visibility,
    branchId: resolution.branch,
    branch: resolution.branch,
    uploadedBy,
    senderRole,
    relatedId,
  };

  const firebaseResult =
    String(process.env.ATTACHMENT_STORAGE_DRIVER || "").toLowerCase() === "firebase"
      ? await storeInFirebase({ file, storagePath, metadata: baseMetadata })
      : null;
  const stored = firebaseResult || (await storeLocally({ file, storagePath, req }));

  return {
    ...baseMetadata,
    name: file.originalname,
    filename: file.originalname,
    originalName: file.originalname,
    type: file.mimetype,
    mimeType: file.mimetype,
    size: file.size,
    uri: stored.downloadUrl,
    url: stored.downloadUrl,
    downloadUrl: stored.downloadUrl,
    storagePath: stored.storagePath,
    provider: stored.provider,
    uploadedAt: new Date().toISOString(),
  };
};
