import crypto from "crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import admin from "../config/firebase.js";
import { ROOM_BRANCH_LABELS, ROOM_BRANCHES } from "../config/branches.js";
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
export const MAINTENANCE_UPLOAD_BRANCH_ERROR_MESSAGE =
  "This maintenance request has no branch assigned. Please check the tenant’s room or branch details before uploading.";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
]);
const ATTACHMENT_EXTENSION_MIME_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".pdf", "application/pdf"],
]);
export const ATTACHMENT_TYPE_ERROR_MESSAGE =
  "This file type is not supported. Please upload a JPEG, PNG, WebP, HEIC, HEIF, or PDF file.";

const VALID_VISIBILITIES = new Set(["tenant_admin", "admin_only"]);
const TENANT_VISIBLE_VISIBILITIES = new Set([
  "tenant_visible",
  "tenant-visible",
  "tenant_admin",
  "tenant-admin",
  "public",
]);
const OWNER_BRANCH_FIELD_NAMES = ["branchId", "branch_id", "branch"];

const toText = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

export const isAllowedAttachmentFile = (file = {}) => {
  const mimeType = toText(file.mimetype).toLowerCase();
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) return true;

  const extension = path.extname(toText(file.originalname)).toLowerCase();
  return (!mimeType || mimeType === "application/octet-stream") &&
    ALLOWED_ATTACHMENT_EXTENSIONS.has(extension);
};

export const resolveAttachmentMimeType = (file = {}) => {
  const mimeType = toText(file.mimetype).toLowerCase();
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) return mimeType;

  const extension = path.extname(toText(file.originalname)).toLowerCase();
  return ATTACHMENT_EXTENSION_MIME_TYPES.get(extension) ||
    mimeType ||
    "application/octet-stream";
};

const normalizeBranch = (value) => {
  const raw = toText(value);
  const branch = raw
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (ROOM_BRANCHES.includes(branch)) return branch;

  const compactBranch = branch.replace(/-/g, "");
  for (const knownBranch of ROOM_BRANCHES) {
    const label = ROOM_BRANCH_LABELS[knownBranch] || knownBranch;
    const compactKnownBranch = knownBranch.replace(/-/g, "");
    const compactLabel = label
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      compactBranch === compactKnownBranch ||
      compactBranch === compactLabel ||
      compactBranch.includes(compactKnownBranch) ||
      compactBranch.includes(compactLabel)
    ) {
      return knownBranch;
    }
  }

  return "";
};

const normalizeBranchFromValue = (value) => {
  if (!value) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    return (
      normalizeBranch(value.branchId) ||
      normalizeBranch(value.branch_id) ||
      normalizeBranch(value.branch) ||
      normalizeBranch(value.branchName) ||
      normalizeBranch(value.branch_name) ||
      normalizeBranch(value.slug) ||
      normalizeBranch(value.code) ||
      normalizeBranch(value.value) ||
      normalizeBranch(value.name) ||
      normalizeBranch(value.label) ||
      normalizeBranch(value._id) ||
      normalizeBranch(value.id)
    );
  }
  return normalizeBranch(value);
};

const firstBranch = (...values) => {
  for (const value of values) {
    const branch = normalizeBranchFromValue(value);
    if (branch) return branch;
  }
  return "";
};

const inferContextFromDocumentType = (documentType) => {
  const normalized = toText(documentType);
  if (normalized === "maintenance-reply-attachment") return "maintenance_reply";
  if (normalized === "maintenance-attachment") return "maintenance_request";
  return "";
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
  const aliases = [
    { request_id: identifier },
    { requestId: identifier },
    { ticketId: identifier },
    { maintenanceId: identifier },
  ];
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return {
      $or: [
        { _id: identifier },
        ...aliases,
      ],
    };
  }
  return { $or: aliases };
};

const canQueryObjectId = (value) => {
  if (!value) return false;
  if (typeof value === "object") return true;
  return mongoose.Types.ObjectId.isValid(toText(value));
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
    const directBranch = firstBranch(roomId, roomId.branch, roomId.branchId);
    if (directBranch) return directBranch;
  }

  const room = await Room.findById(roomId)
    .select("branch branchId branch_id branchName")
    .lean()
    .catch(() => null);
  return firstBranch(room);
};

const getReservationBranch = async (reservation) => {
  const directBranch = firstBranch(
    reservation,
    reservation?.branch,
    reservation?.branchId,
    reservation?.branch_id,
    reservation?.branchName,
  );
  if (directBranch) return directBranch;
  return getRoomBranch(reservation?.roomId);
};

const getReservationBranchById = async (reservationId) => {
  if (!reservationId) return "";
  const reservation = await Reservation.findOne({ _id: reservationId })
    .populate("roomId", "branch branchId branch_id branchName")
    .select("_id branch branchId branch_id branchName roomId")
    .lean()
    .catch(() => null);
  return getReservationBranch(reservation);
};

const buildMaintenanceTenantFilters = (request) => {
  const filters = [];
  if (request?.user_id) filters.push({ user_id: request.user_id });
  if (canQueryObjectId(request?.userId)) filters.push({ _id: request.userId });
  if (canQueryObjectId(request?.tenantId)) filters.push({ _id: request.tenantId });
  if (canQueryObjectId(request?.tenant?._id)) filters.push({ _id: request.tenant._id });
  if (request?.tenant?.user_id) filters.push({ user_id: request.tenant.user_id });
  return filters;
};

const getMaintenanceTenant = async (request) => {
  const filters = buildMaintenanceTenantFilters(request);
  if (filters.length === 0) return "";

  return User.findOne(filters.length === 1 ? filters[0] : { $or: filters })
    .select("_id user_id branch branchId branch_id branchName role")
    .lean()
    .catch(() => null);
};

const getMaintenanceTenantBranch = async (request) => {
  const tenant = await getMaintenanceTenant(request);

  return firstBranch(
    tenant,
    tenant?.branch,
    tenant?.branchId,
    tenant?.branch_id,
    tenant?.branchName,
  );
};

const resolveMaintenanceTenantBranch = async (request) => {
  const tenant = await getMaintenanceTenant(request);
  const profileBranch = firstBranch(
    tenant,
    tenant?.branch,
    tenant?.branchId,
    tenant?.branch_id,
    tenant?.branchName,
  );

  if (profileBranch) {
    return {
      branch: profileBranch,
      source: "maintenance_tenant_profile",
      reservationId: request?.reservationId || null,
      roomId: request?.roomId || null,
    };
  }

  const tenantId =
    tenant?._id ||
    request?.userId ||
    request?.tenantId ||
    request?.tenant?._id ||
    null;

  if (!canQueryObjectId(tenantId)) {
    return {
      branch: "",
      source: "unresolved",
      reservationId: request?.reservationId || null,
      roomId: request?.roomId || null,
    };
  }

  const tenantLike = {
    ...(tenant || {}),
    _id: tenantId,
    user_id: tenant?.user_id || request?.user_id || request?.tenant?.user_id || null,
    branch: "",
  };

  const activeStay = await Stay.findOne({
    tenantId: tenantLike._id,
    status: { $in: ["active", "ending_soon"] },
  })
    .sort({ leaseStartDate: -1, createdAt: -1 })
    .select("branch roomId reservationId")
    .lean()
    .catch(() => null);

  const stayBranch =
    normalizeBranch(activeStay?.branch) ||
    (await getRoomBranch(activeStay?.roomId));
  if (stayBranch) {
    return {
      branch: stayBranch,
      source: "maintenance_active_stay",
      reservationId: activeStay?.reservationId || request?.reservationId || null,
      roomId: activeStay?.roomId || request?.roomId || null,
    };
  }

  const activeReservation = await loadActiveTenantReservation(tenantLike).catch(() => null);
  const activeReservationBranch = await getReservationBranch(activeReservation);
  if (activeReservationBranch) {
    return {
      branch: activeReservationBranch,
      source: "maintenance_active_reservation",
      reservationId: activeReservation?._id || request?.reservationId || null,
      roomId: activeReservation?.roomId?._id || activeReservation?.roomId || request?.roomId || null,
    };
  }

  const bedHistory = await BedHistory.findOne({
    tenantId: tenantLike._id,
    status: "active",
  })
    .sort({ moveInDate: -1, effectiveStartDate: -1 })
    .select("branch roomId reservationId")
    .lean()
    .catch(() => null);

  const bedHistoryBranch =
    normalizeBranch(bedHistory?.branch) ||
    (await getRoomBranch(bedHistory?.roomId));
  if (bedHistoryBranch) {
    return {
      branch: bedHistoryBranch,
      source: "maintenance_bed_history",
      reservationId: bedHistory?.reservationId || request?.reservationId || null,
      roomId: bedHistory?.roomId || request?.roomId || null,
    };
  }

  return {
    branch: "",
    source: "unresolved",
    reservationId: request?.reservationId || null,
    roomId: request?.roomId || null,
  };
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
    if (normalizeBranchFromValue(dbUser?.branch) === branch) return;
    throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
  }

  if (userOwnsMaintenanceRequest(dbUser, request)) return;

  throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
};

const resolveBranchFromMaintenanceRequest = async (dbUser, request, explicitBranch = "") => {
  const role = String(dbUser?.role || "").toLowerCase();
  const providedBranch = normalizeBranchFromValue(explicitBranch);
  let branch = firstBranch(
    request?.branchId,
    request?.branch_id,
    request?.branch,
    request?.branchName,
    request?.branch_name,
    request?.tenant?.branchId,
    request?.tenant?.branch_id,
    request?.tenant?.branch,
    request?.property?.branchId,
    request?.property?.branch,
  );
  if (!branch) {
    branch = await getRoomBranch(
      request?.roomId ||
      request?.room ||
      request?.room_id ||
      request?.assignedRoom,
    );
  }
  if (!branch) {
    branch = await getReservationBranchById(
      request?.reservationId ||
      request?.reservation_id ||
      request?.reservation,
    );
  }
  if (!branch) {
    branch = await getMaintenanceTenantBranch(request);
  }
  if (!branch && providedBranch) {
    branch = providedBranch;
  }
  if (!branch && isAdminRole(role)) {
    branch = normalizeBranchFromValue(dbUser?.branch);
  }

  if (!branch) {
    throw new AppError(
      UPLOAD_BRANCH_ERROR_MESSAGE,
      400,
      "UPLOAD_BRANCH_UNRESOLVED",
    );
  }

  if (providedBranch && providedBranch !== branch) {
    throw new AppError("Access denied", 403, "UPLOAD_BRANCH_FORBIDDEN");
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
  const context =
    toText(options.context || getField(req, "context")) ||
    inferContextFromDocumentType(options.documentType || getField(req, "documentType")) ||
    "attachment";
  const explicitBranch = getExplicitBranch(req);
  const maintenanceRequestIdentifiers = [
    toText(options.maintenanceRequestId) ||
      getField(req, ["maintenanceRequestId", "maintenance_request_id"]),
    toText(options.requestId) ||
      getField(req, ["requestId", "request_id"]),
    context.startsWith("maintenance")
      ? toText(options.relatedId) || getField(req, ["relatedId", "related_id"])
      : "",
  ].filter(Boolean);
  const uniqueMaintenanceRequestIdentifiers = [...new Set(maintenanceRequestIdentifiers)];
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
      ...(await resolveBranchFromMaintenanceRequest(
        dbUser,
        options.maintenanceRequest,
        explicitBranch,
      )),
    };
  }

  if (uniqueMaintenanceRequestIdentifiers.length > 0) {
    let request = null;
    for (const identifier of uniqueMaintenanceRequestIdentifiers) {
      request = await MaintenanceRequest.findOne(
        buildMaintenanceIdentifierQuery(identifier),
      ).lean();
      if (request) break;
    }

    if (!request || request.isArchived) {
      throw new AppError("Maintenance request not found", 404, "REQUEST_NOT_FOUND");
    }

    return {
      dbUser,
      context,
      ...(await resolveBranchFromMaintenanceRequest(dbUser, request, explicitBranch)),
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
    if (explicitBranch) {
      return {
        dbUser,
        context,
        branch: explicitBranch,
        source: "owner_selected_branch",
      };
    }
    const ownerBranch = normalizeBranch(dbUser?.branch);
    if (ownerBranch) {
      return {
        dbUser,
        context,
        branch: ownerBranch,
        source: "owner_profile",
      };
    }
  } else {
    const adminBranch = normalizeBranch(dbUser?.branch);
    if (adminBranch) {
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

export const resolveMaintenanceRequestBranch = (maintenanceRequest = {}) =>
  firstBranch(
    maintenanceRequest?.branchId,
    maintenanceRequest?.branch_id,
    maintenanceRequest?.branch,
    maintenanceRequest?.branchName,
    maintenanceRequest?.branch_name,
  );

export const resolveMaintenanceRequestStorageBranch = async (
  maintenanceRequest = {},
) => {
  const requestBranch = resolveMaintenanceRequestBranch(maintenanceRequest);
  if (requestBranch) {
    return {
      branch: requestBranch,
      source: "maintenance_request",
      reservationId: maintenanceRequest?.reservationId || null,
      roomId: maintenanceRequest?.roomId || null,
    };
  }

  const roomId =
    maintenanceRequest?.roomId ||
    maintenanceRequest?.room ||
    maintenanceRequest?.room_id ||
    maintenanceRequest?.assignedRoom;
  const roomBranch = await getRoomBranch(roomId);
  if (roomBranch) {
    return {
      branch: roomBranch,
      source: "maintenance_room",
      reservationId: maintenanceRequest?.reservationId || null,
      roomId: roomId || null,
    };
  }

  const reservationId =
    maintenanceRequest?.reservationId ||
    maintenanceRequest?.reservation_id ||
    maintenanceRequest?.reservation;
  const reservationBranch = await getReservationBranchById(reservationId);
  if (reservationBranch) {
    return {
      branch: reservationBranch,
      source: "maintenance_reservation",
      reservationId: reservationId || null,
      roomId: maintenanceRequest?.roomId || null,
    };
  }

  const tenantResolution = await resolveMaintenanceTenantBranch(maintenanceRequest);
  if (tenantResolution.branch) {
    return tenantResolution;
  }

  return {
    branch: "",
    source: "unresolved",
    reservationId: maintenanceRequest?.reservationId || null,
    roomId: maintenanceRequest?.roomId || null,
  };
};

const sanitizeStorageSegment = (value, fallback) => {
  const segment = toText(value)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return segment || fallback;
};

const normalizePublicBaseUrl = (value) =>
  toText(value).replace(/\/+$/, "").replace(/\/api$/i, "");

const getPublicBaseUrl = (req) => {
  const configured =
    process.env.PUBLIC_API_URL ||
    process.env.SERVER_PUBLIC_URL ||
    process.env.API_PUBLIC_URL;
  if (configured) return normalizePublicBaseUrl(configured);
  return normalizePublicBaseUrl(`${req.protocol}://${req.get("host")}`);
};

const getFirebaseStorageBucketCandidates = () => {
  const configuredBuckets = [
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.GCLOUD_STORAGE_BUCKET,
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
  ].map(toText);

  const projectId = toText(process.env.FIREBASE_PROJECT_ID);
  const derivedBuckets = projectId
    ? [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`]
    : [];

  return [...new Set([...configuredBuckets, ...derivedBuckets].filter(Boolean))];
};

const isLocalAttachmentOrigin = (value = "") => {
  const origin = normalizePublicBaseUrl(value).toLowerCase();
  return !origin || origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("[::1]");
};

const isHostedAttachmentRuntime = () => {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.RENDER || process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT) return true;

  return [
    process.env.PUBLIC_API_URL,
    process.env.SERVER_PUBLIC_URL,
    process.env.API_PUBLIC_URL,
  ].some((origin) => origin && !isLocalAttachmentOrigin(origin));
};

const getAttachmentStorageDriver = () => {
  const configured = toText(process.env.ATTACHMENT_STORAGE_DRIVER).toLowerCase();
  if (configured) return configured;
  if (admin.apps.length && getFirebaseStorageBucketCandidates().length > 0) {
    return "firebase";
  }
  return isHostedAttachmentRuntime() ? "firebase" : "local";
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

const storeInFirebase = async ({ file, storagePath, metadata, mimeType }) => {
  const bucketCandidates = getFirebaseStorageBucketCandidates();

  if (!admin.apps.length || bucketCandidates.length === 0) {
    return null;
  }

  const token = crypto.randomUUID();
  const firebasePath = storagePath.replace(/^uploads\//, "");

  for (const bucketName of bucketCandidates) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      await bucket.file(firebasePath).save(file.buffer, {
        resumable: false,
        metadata: {
          contentType: mimeType || file.mimetype,
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
    } catch {
      // Try the next known bucket form before reporting storage unavailable.
    }
  }

  return null;
};

const throwAttachmentStorageConfigurationError = () => {
  throw new AppError(
    "Attachment storage is not configured. Please set FIREBASE_STORAGE_BUCKET and Firebase Admin credentials for maintenance uploads.",
    500,
    "ATTACHMENT_STORAGE_NOT_CONFIGURED",
  );
};

const resolveStoredAttachmentFile = async ({
  req,
  file,
  storagePath,
  metadata,
  mimeType,
}) => {
  const storageDriver = getAttachmentStorageDriver();

  if (storageDriver === "firebase") {
    const firebaseResult = await storeInFirebase({
      file,
      storagePath,
      metadata,
      mimeType,
    });
    if (!firebaseResult) {
      throwAttachmentStorageConfigurationError();
    }
    return firebaseResult;
  }

  if (storageDriver === "local") {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "Local attachment storage is not supported in production. Configure Firebase Storage before uploading attachments.",
        500,
        "ATTACHMENT_LOCAL_STORAGE_DISABLED",
      );
    }

    return storeLocally({ file, storagePath, req });
  }

  throw new AppError(
    `Unsupported attachment storage driver: ${storageDriver}`,
    500,
    "ATTACHMENT_STORAGE_DRIVER_INVALID",
  );
};

const assertUploadableAttachmentFile = (file) => {
  if (!file) {
    throw new AppError("Please choose a photo or PDF to upload.", 400, "FILE_REQUIRED");
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AppError("File is too large. Maximum size is 5 MB.", 400, "FILE_TOO_LARGE");
  }

  if (!isAllowedAttachmentFile(file)) {
    throw new AppError(
      ATTACHMENT_TYPE_ERROR_MESSAGE,
      400,
      "UNSUPPORTED_FILE_TYPE",
    );
  }
};

const storeAttachmentFile = async ({
  req,
  file,
  branch,
  context,
  visibility,
  relatedId = null,
  uploadedBy = "",
  senderRole = "user",
}) => {
  const mimeType = resolveAttachmentMimeType(file);
  const safeName = sanitizeStorageSegment(file.originalname, "attachment");
  const storagePath = [
    "uploads",
    "attachments",
    branch,
    sanitizeStorageSegment(context, "attachment"),
    relatedId ? sanitizeStorageSegment(relatedId, "related") : "unlinked",
    `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
  ].join("/");

  const baseMetadata = {
    context,
    visibility,
    branchId: branch,
    branch,
    uploadedBy,
    senderRole,
    relatedId,
  };

  const stored = await resolveStoredAttachmentFile({
    req,
    file,
    storagePath,
    metadata: baseMetadata,
    mimeType,
  });

  return {
    id: crypto.randomUUID(),
    ...baseMetadata,
    name: file.originalname,
    filename: file.originalname,
    originalName: file.originalname,
    type: mimeType,
    mimeType,
    size: file.size,
    uri: stored.downloadUrl,
    url: stored.downloadUrl,
    downloadUrl: stored.downloadUrl,
    storagePath: stored.storagePath,
    provider: stored.provider,
    uploadedAt: new Date().toISOString(),
  };
};

export const uploadAttachmentFile = async ({ req, file, options = {} }) => {
  assertUploadableAttachmentFile(file);

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

  return storeAttachmentFile({
    req,
    file,
    branch: resolution.branch,
    context,
    visibility,
    relatedId,
    uploadedBy,
    senderRole,
  });
};

export const uploadMaintenanceRequestAttachmentFile = async ({
  req,
  file,
  maintenanceRequest,
  visibility = "tenant_visible",
  context = "maintenance_reply",
  uploadedBy = "",
  senderRole = "admin",
}) => {
  assertUploadableAttachmentFile(file);

  const branchResolution = await resolveMaintenanceRequestStorageBranch(
    maintenanceRequest,
  );
  const branch = branchResolution.branch;
  if (!branch) {
    throw new AppError(
      MAINTENANCE_UPLOAD_BRANCH_ERROR_MESSAGE,
      400,
      "MAINTENANCE_REQUEST_BRANCH_REQUIRED",
    );
  }

  const requestedVisibility = toText(visibility).toLowerCase();
  const internalVisibility =
    requestedVisibility === "admin_only" || requestedVisibility === "admin-only"
      ? "admin_only"
      : TENANT_VISIBLE_VISIBILITIES.has(requestedVisibility)
        ? "tenant_admin"
        : resolveAttachmentVisibility(context, visibility);

  return storeAttachmentFile({
    req,
    file,
    branch,
    context,
    visibility: internalVisibility,
    relatedId: maintenanceRequest?.request_id || String(maintenanceRequest?._id || ""),
    uploadedBy,
    senderRole,
  });
};
