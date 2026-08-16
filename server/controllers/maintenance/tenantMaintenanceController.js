/**
 * ============================================================================
 * TENANT MAINTENANCE CONTROLLER
 * ============================================================================
 *
 * Handles tenant-initiated maintenance request creation, updates, cancellations,
 * reopening, listing, and tenant conversation replies.
 */

import crypto from "crypto";
import {
  MIN_MAINTENANCE_DESCRIPTION_LENGTH,
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  REOPENABLE_MAINTENANCE_STATUSES,
  OPEN_MAINTENANCE_STATUSES,
  normalizeMaintenanceStatus,
  normalizeMaintenanceType,
  normalizeMaintenanceUrgency,
} from "../../config/maintenance.js";
import { AppError, sendSuccess } from "../../middleware/errorHandler.js";
import { MaintenanceRequest, Reservation, Room, User } from "../../models/index.js";
import {
  buildActorSnapshot,
  buildMaintenanceRequestId,
  findAccessibleRequest,
  getDbUser,
  ensureTenantAccess,
  serializeTenantSummary,
  serializeMaintenanceRequest,
  toOptionalText,
  parseLimit,
  normalizeAttachments,
  appendStatusHistory,
  appendConversationEntry,
  getReplyAttachmentsFromBody,
  validateIncomingAttachments,
} from "./_helpers.js";
import { buildLegacyDescription } from "../../utils/maintenanceMigration.js";
import { notify } from "../../utils/notificationService.js";
import { resolveUploadBranch } from "../../services/attachmentUploadService.js";
import auditLogger from "../../utils/auditLogger.js";

const DUPLICATE_REQUEST_WINDOW_HOURS = 12;

const ensureMinimumDescriptionLength = (description) =>
  String(description || "").trim().length >= MIN_MAINTENANCE_DESCRIPTION_LENGTH;

const buildMaintenanceDocument = ({
  dbUser,
  branch,
  reservationId = null,
  roomId = null,
  requestId = null,
  requestType,
  description,
  urgency,
  attachments,
  occupancyContext = {},
}) =>
  new MaintenanceRequest({
    request_id: requestId,
    user_id: dbUser.user_id,
    userId: dbUser._id,
    branch,
    request_type: requestType,
    description,
    urgency,
    attachments,
    reservationId,
    roomId,
    occupancyContext,
    statusHistory: [
      {
        event: "submitted",
        status: "pending",
        ...buildActorSnapshot(dbUser),
        note: null,
        timestamp: new Date(),
      },
    ],
  });


/**
 * GET /api/m/maintenance/me
 * GET /api/maintenance/my-requests (compat)
 */
export const getMyRequests = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const status = normalizeMaintenanceStatus(req.query.status);
    const limit = parseLimit(req.query.limit, 100);

    const query = {
      user_id: dbUser.user_id,
      isArchived: false,
    };

    if (status) {
      query.status = status;
    }

    const requests = await MaintenanceRequest.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    sendSuccess(res, {
      count: requests.length,
      requests: requests.map((request) =>
        serializeMaintenanceRequest(
          request,
          serializeTenantSummary(dbUser, request),
          { includeInternal: false },
        ),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance
 * POST /api/maintenance/requests (compat)
 */
export const createRequest = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid })
      .select("_id user_id role branch firstName lastName email phone")
      .lean();

    if (!dbUser) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const requestType = normalizeMaintenanceType(req.body.request_type);
    const description = toOptionalText(req.body.description);
    const urgency = normalizeMaintenanceUrgency(req.body.urgency || "normal") || "normal";

    if (!requestType || !MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
      throw new AppError("Invalid maintenance request type", 400, "INVALID_REQUEST_TYPE");
    }
    if (!description) {
      throw new AppError("Description is required", 400, "MISSING_DESCRIPTION");
    }
    if (!ensureMinimumDescriptionLength(description)) {
      throw new AppError(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters`,
        400,
        "DESCRIPTION_TOO_SHORT",
      );
    }
    if (!MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
      throw new AppError("Invalid maintenance urgency", 400, "INVALID_URGENCY");
    }

    const duplicateCutoff = new Date(
      Date.now() - DUPLICATE_REQUEST_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const existingRequest = await MaintenanceRequest.findOne({
      user_id: dbUser.user_id,
      request_type: requestType,
      description,
      status: { $in: OPEN_MAINTENANCE_STATUSES },
      created_at: { $gte: duplicateCutoff },
      isArchived: false,
    })
      .sort({ created_at: -1 })
      .lean();

    if (existingRequest) {
      return res.status(409).json({
        error: "A similar maintenance request is already open.",
        code: "DUPLICATE_REQUEST",
        request: serializeMaintenanceRequest(
          existingRequest,
          serializeTenantSummary(dbUser, existingRequest),
          { includeInternal: false },
        ),
      });
    }

    const branchResolution = await resolveUploadBranch(req, {
      dbUser,
      context: "maintenance_request",
    });

    let occupancyContext = {
      unitNumber: null,
      bedNumber: null,
      floor: null,
    };
    if (branchResolution.roomId) {
      try {
        const roomDoc = await Room.findById(branchResolution.roomId)
          .select("roomNumber name floor")
          .lean();
        if (roomDoc) {
          occupancyContext.unitNumber = roomDoc.roomNumber || roomDoc.name || null;
          occupancyContext.floor = typeof roomDoc.floor === "number" ? roomDoc.floor : null;
        }
      } catch {
        // non-fatal
      }
    }
    if (branchResolution.reservationId) {
      try {
        const resDoc = await Reservation.findById(branchResolution.reservationId)
          .select("bedNumber bed")
          .lean();
        if (resDoc) {
          occupancyContext.bedNumber = resDoc.bedNumber || resDoc.bed || null;
        }
      } catch {
        // non-fatal
      }
    }

    const requestId = buildMaintenanceRequestId();
    const attachments = normalizeAttachments(req.body.attachments, {
      context: "maintenance_request",
      visibility: "tenant_admin",
      branchId: branchResolution.branch,
      uploadedBy: dbUser.user_id,
      senderRole: dbUser.role || "tenant",
      relatedId: requestId,
    });

    const deduplicationHash = crypto
      .createHash("md5")
      .update(`${dbUser.user_id}_${requestType}_${description.toLowerCase().trim()}`)
      .digest("hex");

    const request = buildMaintenanceDocument({
      dbUser,
      branch: branchResolution.branch,
      reservationId: branchResolution.reservationId || null,
      roomId: branchResolution.roomId || null,
      requestId,
      requestType,
      description,
      urgency,
      attachments,
      occupancyContext,
    });
    request.deduplicationHash = deduplicationHash;

    await request.save();

    await auditLogger.logModification(
      req,
      "maintenance",
      request._id,
      null,
      request.toObject(),
      `Submitted Maintenance Request (${request.request_type || requestType} - ${request.urgency || urgency})`,
      `Tenant submitted maintenance request #${request.request_id || request._id}: ${request.description?.slice(0, 80)}`,
    );

    try {
      const tenantName = `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() || dbUser.email;
      notify
        .newMaintenanceTicket(
          branchResolution.branch,
          tenantName,
          "",
          urgency,
          requestType,
          request.request_id || request._id,
        )
        .catch((e) => logger.warn({ err: e }, "Maintenance admin notification failed (non-fatal)"));
    } catch (notifErr) {
      // non-fatal
    }

    sendSuccess(
      res,
      {
        request: serializeMaintenanceRequest(
          request.toObject(),
          serializeTenantSummary(dbUser, request),
          { includeInternal: false },
        ),
      },
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const createRequestCompat = async (req, res, next) => {
  req.body = {
    request_type: normalizeMaintenanceType(req.body.category || "other"),
    description: buildLegacyDescription(req.body.title, req.body.description),
    urgency: normalizeMaintenanceUrgency(req.body.urgency || "normal") || "normal",
    attachments: req.body.attachments,
  };
  return createRequest(req, res, next);
};

/**
 * PUT /api/m/maintenance/:requestId
 */
export const updateMyRequest = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (request.status !== "pending") {
      throw new AppError(
        "Only pending maintenance requests can be edited",
        409,
        "REQUEST_NOT_EDITABLE",
      );
    }

    const requestType =
      req.body.request_type !== undefined
        ? normalizeMaintenanceType(req.body.request_type)
        : request.request_type;
    const description =
      req.body.description !== undefined
        ? toOptionalText(req.body.description)
        : request.description;
    const urgency =
      req.body.urgency !== undefined
        ? normalizeMaintenanceUrgency(req.body.urgency)
        : request.urgency;

    if (!requestType || !MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
      throw new AppError("Invalid maintenance request type", 400, "INVALID_REQUEST_TYPE");
    }
    if (!description) {
      throw new AppError("Description is required", 400, "MISSING_DESCRIPTION");
    }
    if (!ensureMinimumDescriptionLength(description)) {
      throw new AppError(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters`,
        400,
        "DESCRIPTION_TOO_SHORT",
      );
    }
    if (!urgency || !MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
      throw new AppError("Invalid maintenance urgency", 400, "INVALID_URGENCY");
    }

    request.request_type = requestType;
    request.description = description;
    request.urgency = urgency;

    if (req.body.attachments !== undefined) {
      request.attachments = normalizeAttachments(req.body.attachments, {
        context: "maintenance_request",
        visibility: "tenant_admin",
        branchId: request.branch,
        uploadedBy: dbUser.user_id,
        senderRole: dbUser.role || "tenant",
        relatedId: request.request_id,
      });
    }

    await request.save();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/:requestId/cancel
 */
export const cancelMyRequest = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (request.status !== "pending") {
      throw new AppError(
        "Only pending maintenance requests can be cancelled",
        409,
        "REQUEST_NOT_CANCELLABLE",
      );
    }

    request.status = "cancelled";
    request.cancelled_at = new Date();
    appendStatusHistory(request, {
      event: "cancelled",
      status: "cancelled",
      ...buildActorSnapshot(dbUser),
      note: null,
      timestamp: request.cancelled_at,
    });
    await request.save();

    await auditLogger.logModification(
      req,
      "maintenance",
      request._id,
      { status: "pending" },
      { status: "cancelled" },
      "Cancelled Maintenance Request",
      `Tenant cancelled maintenance request #${request.request_id || request._id}`,
    );

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/:requestId/reopen
 */
export const reopenMyRequest = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (!REOPENABLE_MAINTENANCE_STATUSES.includes(request.status)) {
      throw new AppError(
        "Only resolved or completed maintenance requests can be reopened",
        409,
        "REQUEST_NOT_REOPENABLE",
      );
    }

    const note = toOptionalText(req.body.note || req.body.reopen_note);
    const reopenedAt = new Date();

    request.reopen_note = note;
    request.reopened_at = reopenedAt;
    request.reopenCount = (request.reopenCount || 0) + 1;
    request.reopen_history = [
      ...(request.reopen_history || []),
      {
        reopened_at: reopenedAt,
        previous_status: request.status,
        note,
      },
    ];
    request.status = "pending";
    request.resolved_at = null;
    request.work_started_at = null;
    request.resolution_note = null;
    appendStatusHistory(request, {
      event: "reopened",
      status: "pending",
      ...buildActorSnapshot(dbUser),
      note,
      timestamp: reopenedAt,
    });

    await request.save();

    try {
      const tenantName = `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() || dbUser.email;
      notify
        .maintenanceReopened(
          request.branch,
          tenantName,
          request.request_id || request._id,
        )
        .catch((e) => logger.warn({ err: e }, "Maintenance reopen notification failed (non-fatal)"));
    } catch (notifErr) {
      // non-fatal
    }

    try {
      const { emitToAdmins } = await import("../../utils/socket.js");
      emitToAdmins("ticket:updated", {
        requestId: String(request._id),
        status: request.status,
        reopenCount: request.reopenCount,
      });
    } catch {
      // non-fatal
    }

    sendSuccess(res, {
      message: "Maintenance request has been reopened.",
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/maintenance/:requestId/confirm
 * PATCH /api/maintenance/:requestId/confirm-resolved
 * POST /api/v1/tenant/maintenance/:id/confirm
 */
export const confirmResolution = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    const action = String(req.body?.action || "").trim().toLowerCase();
    const isConfirmed = req.body?.confirmed === true || action === "confirm" || action === "resolved" || action === "yes";

    if (!REOPENABLE_MAINTENANCE_STATUSES.includes(request.status) && request.status !== "closed") {
      throw new AppError(
        "Only completed or resolved maintenance requests can receive resolution confirmation.",
        409,
        "INVALID_CONFIRMATION_STATE",
      );
    }

    if (isConfirmed) {
      const confirmedAt = new Date();
      const feedback = toOptionalText(req.body?.feedback || req.body?.notes || req.body?.note);
      request.resolutionConfirmation = {
        confirmedAt,
        tenantFeedback: feedback,
      };
      appendStatusHistory(request, {
        event: "tenant_confirmed_resolved",
        status: request.status,
        ...buildActorSnapshot(dbUser),
        note: feedback || "Tenant confirmed issue resolution.",
        timestamp: confirmedAt,
      });

      await request.save();

      try {
        const { emitToAdmins } = await import("../../utils/socket.js");
        emitToAdmins("ticket:updated", {
          requestId: String(request._id),
          status: request.status,
          resolutionConfirmed: true,
        });
      } catch {
        // non-fatal
      }

      sendSuccess(res, {
        message: "Thank you! Issue resolution confirmed.",
        request: serializeMaintenanceRequest(
          request.toObject(),
          serializeTenantSummary(dbUser, request),
          { includeInternal: false },
        ),
      });
    } else {
      return reopenMyRequest(req, res, next);
    }
  } catch (error) {
    next(error);
  }
};

export const confirmMaintenanceResolved = confirmResolution;


/**
 * POST /api/m/maintenance/:requestId/reply
 * Allows a tenant to reply to an active maintenance ticket.
 */
export const sendTenantReply = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot receive new messages.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const message = toOptionalText(req.body.message || req.body.reply || req.body.text || req.body.body);
    const rawAttachments = getReplyAttachmentsFromBody(req.body);
    const attachmentErrors = validateIncomingAttachments(rawAttachments, {
      fieldPrefix: "attachments",
      noun: "Attachments",
    });

    if (attachmentErrors.length > 0) {
      throw new AppError(
        "Some required information is missing or invalid. Please review the highlighted fields.",
        400,
        "VALIDATION_ERROR",
        attachmentErrors,
      );
    }

    const attachments = normalizeAttachments(rawAttachments, {
      context: "maintenance_reply",
      visibility: "tenant_admin",
      branchId: request.branch,
      uploadedBy: dbUser.user_id,
      senderRole: dbUser.role || "tenant",
      relatedId: request.request_id,
    });

    if (!message && attachments.length === 0) {
      throw new AppError(
        "Please enter a message or upload an attachment to reply.",
        400,
        "REPLY_CONTENT_REQUIRED",
        [{ field: "message", message: "Please enter a message or upload an attachment to reply." }],
      );
    }

    const replyEntry = {
      message,
      attachments,
      sender_side: "tenant",
      sender_role: dbUser.role || "tenant",
      sender_name: `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() || dbUser.email || dbUser.user_id,
      sender_user_id: dbUser.user_id,
      actor_id: dbUser.user_id,
      actor_name: `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() || dbUser.email || dbUser.user_id,
      actor_role: dbUser.role || "tenant",
      created_at: new Date(),
    };

    appendConversationEntry(request, replyEntry);

    if (request.status === "waiting_tenant") {
      request.status = "in_progress";
      appendStatusHistory(request, {
        event: "status_changed",
        status: "in_progress",
        ...buildActorSnapshot(dbUser),
        note: "Tenant replied; status resumed to in_progress.",
        timestamp: new Date(),
      });
    }

    await request.save();

    try {
      const tenantName = `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() || dbUser.email;
      notify
        .maintenanceTenantReply(
          request.branch,
          tenantName,
          request.request_id || request._id,
        )
        .catch((e) => logger.warn({ err: e }, "Maintenance tenant reply notification failed (non-fatal)"));
    } catch (notifErr) {
      // non-fatal
    }

    sendSuccess(res, {
      message: "Reply sent successfully.",
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });

    try {
      const { emitToAdmins } = await import("../../utils/socket.js");
      emitToAdmins("ticket:updated", {
        requestId: String(request._id),
        status: request.status,
      });
    } catch {
      // non-fatal
    }
  } catch (error) {
    next(error);
  }
};
