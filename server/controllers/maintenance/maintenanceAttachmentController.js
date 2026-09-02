/**
 * ============================================================================
 * MAINTENANCE ATTACHMENT CONTROLLER
 * ============================================================================
 *
 * Handles attachment file uploads, admin-only proof saving, and attachment removals.
 */

import { AppError, sendSuccess } from "../../middleware/errorHandler.js";
import { User } from "../../models/index.js";
import { MAX_MAINTENANCE_ATTACHMENTS } from "../../config/maintenance.js";
import {
  USER_SELECT_FIELDS,
  buildActorSnapshot,
  findAccessibleRequest,
  getDbUser,
  ensureAdminAccess,
  serializeTenantSummary,
  serializeMaintenanceRequest,
  toOptionalText,
  normalizeAttachments,
  normalizeRemovalScope,
  getAttachmentUri,
  appendStatusHistory,
  appendWorkLogEntry,
  validateIncomingWorkLogAttachments,
  serializeUploadedMaintenanceAttachment,
} from "./_helpers.js";
import {
  MAINTENANCE_UPLOAD_BRANCH_ERROR_MESSAGE,
  resolveMaintenanceRequestBranch,
  resolveMaintenanceRequestStorageBranch,
  uploadMaintenanceRequestAttachmentFile,
} from "../../services/attachmentUploadService.js";
import { notify } from "../../utils/notificationService.js";

const emitMaintenanceUpdated = async (request) => {
  try {
    const { emitToAdmins } = await import("../../utils/socket.js");
    emitToAdmins("ticket:updated", {
      requestId: String(request._id),
      status: request.status,
      isArchived: Boolean(request.isArchived),
    });
  } catch {
    // non-fatal; HTTP update already succeeded
  }
};

const getAttachmentBuckets = (request) => {
  const buckets = [
    {
      source: "request",
      label: "request attachments",
      attachments: request.attachments,
    },
  ];

  (request.conversation || []).forEach((entry, entryIndex) => {
    buckets.push({
      source: "conversation",
      label: "tenant conversation",
      entry,
      entryIndex,
      attachments: entry.attachments,
    });
  });

  (request.work_log || []).forEach((entry, entryIndex) => {
    buckets.push({
      source: "work_log",
      label: "admin work log",
      entry,
      entryIndex,
      attachments: entry.attachments,
    });
  });

  return buckets;
};

const findAttachmentTarget = (request, target = {}) => {
  const source = toOptionalText(target.source || target.collection);
  const entryIndex =
    target.entryIndex === undefined || target.entryIndex === null
      ? null
      : Number(target.entryIndex);
  const attachmentIndex =
    target.attachmentIndex === undefined || target.attachmentIndex === null
      ? null
      : Number(target.attachmentIndex);
  const targetId = toOptionalText(target.attachmentId || target.id);
  const targetUri = toOptionalText(target.uri || target.url || target.downloadUrl);

  for (const bucket of getAttachmentBuckets(request)) {
    if (source && bucket.source !== source) continue;
    if (
      bucket.source !== "request" &&
      Number.isInteger(entryIndex) &&
      bucket.entryIndex !== entryIndex
    ) {
      continue;
    }

    const attachments = Array.isArray(bucket.attachments) ? bucket.attachments : [];
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      const attachmentUri = getAttachmentUri(attachment);
      const attachmentId = toOptionalText(
        attachment?.id || attachment?.attachmentId || attachment?.storagePath,
      );
      const indexMatches =
        Number.isInteger(attachmentIndex) && attachmentIndex === index;
      const idMatches = targetId && attachmentId && targetId === attachmentId;
      const uriMatches = targetUri && attachmentUri && targetUri === attachmentUri;

      if (indexMatches || idMatches || uriMatches) {
        return {
          ...bucket,
          attachment,
          attachmentIndex: index,
        };
      }
    }
  }

  return null;
};

/**
 * POST /api/m/maintenance/admin/:requestId/attachments
 */
export const uploadAdminMaintenanceAttachment = async (req, res, next) => {
  try {
    const requestId = toOptionalText(req.params.requestId || req.body?.maintenanceRequestId);
    if (!requestId) {
      throw new AppError(
        "Maintenance request ID is required.",
        400,
        "REQUEST_ID_REQUIRED",
      );
    }

    const request = await findAccessibleRequest(requestId);
    const branchResolution = await resolveMaintenanceRequestStorageBranch(
      request,
    );
    const branch = branchResolution.branch;
    if (!branch) {
      throw new AppError(
        MAINTENANCE_UPLOAD_BRANCH_ERROR_MESSAGE,
        400,
        "MAINTENANCE_REQUEST_BRANCH_REQUIRED",
      );
    }
    if (!req.isOwner && req.branchFilter !== branch) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }

    const storedBranch = resolveMaintenanceRequestBranch(request);
    if (storedBranch !== branch) {
      request.branch = branch;
      if (!request.roomId && branchResolution.roomId) {
        request.roomId = branchResolution.roomId;
      }
      if (!request.reservationId && branchResolution.reservationId) {
        request.reservationId = branchResolution.reservationId;
      }
      await request.save({ validateModifiedOnly: true });
    }

    const adminUser = await getDbUser(req.user.uid);
    const rawVisibility = toOptionalText(req.body?.visibility || req.body?.type) || "tenant_visible";
    const isInternal = ["admin_only", "admin-only", "internal"].includes(rawVisibility);
    const attachment = await uploadMaintenanceRequestAttachmentFile({
      req,
      file: req.file,
      maintenanceRequest: request,
      visibility: isInternal ? "admin_only" : "tenant_visible",
      context: isInternal ? "maintenance_internal_note" : "maintenance_reply",
      uploadedBy: adminUser?.user_id || String(adminUser?._id || ""),
      senderRole: adminUser?.role || "admin",
    });

    sendSuccess(
      res,
      {
        attachment: serializeUploadedMaintenanceAttachment(attachment),
      },
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/proof
 */
export const saveAdminMaintenanceProof = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);

    if (request.isArchived) {
      throw new AppError(
        "Archived maintenance requests cannot be updated.",
        409,
        "REQUEST_ARCHIVED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const note = toOptionalText(req.body?.note || req.body?.work_log_note);
    const rawAttachments =
      req.body?.attachments !== undefined
        ? req.body.attachments
        : req.body?.work_log_attachments;
    if (Array.isArray(rawAttachments) && rawAttachments.length > MAX_MAINTENANCE_ATTACHMENTS) {
      throw new AppError(
        `You can upload a maximum of ${MAX_MAINTENANCE_ATTACHMENTS} resolution proof photos.`,
        400,
        "MAX_ATTACHMENTS_EXCEEDED",
      );
    }
    const attachmentErrors = validateIncomingWorkLogAttachments(rawAttachments);
    const attachments = normalizeAttachments(rawAttachments, {
      context: "maintenance_resolution_proof",
      visibility: "tenant_admin",
      branchId: request.branch,
      uploadedBy: adminUser?.user_id,
      senderRole: adminUser?.role || "admin",
      relatedId: request.request_id,
    });

    if (attachmentErrors.length > 0) {
      throw new AppError(
        attachmentErrors[0]?.message || "Invalid attachment format.",
        400,
        "VALIDATION_ERROR",
        attachmentErrors,
      );
    }

    if (attachments.length === 0) {
      throw new AppError(
        "Please upload a proof attachment before saving.",
        400,
        "PROOF_ATTACHMENT_REQUIRED",
      );
    }

    const eventTimestamp = new Date();
    appendWorkLogEntry(request, {
      note: note || "Resolution proof verified and uploaded.",
      attachments,
      ...buildActorSnapshot(adminUser),
      logged_at: eventTimestamp,
      entry_type: "admin_proof",
      visibility: "tenant_admin",
    });

    const targetStatus = "resolved";
    const statusChanged = request.status !== targetStatus;

    // Automatically transition lifecycle status to resolved from any non-terminal active status
    if (!["resolved", "completed", "closed", "cancelled", "rejected"].includes(request.status)) {
      request.status = targetStatus;
      request.resolved_at = eventTimestamp;
      request.resolution_note = note || request.resolution_note || "Resolution proof verified and uploaded.";
      request.closed_at = null;
      request.resolutionConfirmation = {
        confirmedAt: null,
        tenantFeedback: null,
        rating: null,
        action: null,
      };
    }

    appendStatusHistory(request, {
      event: "resolution_proof_uploaded",
      status: request.status,
      ...buildActorSnapshot(adminUser),
      note: note || null,
      timestamp: eventTimestamp,
    });

    await request.save();

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    if (tenantUser?._id) {
      try {
        await notify.maintenanceUpdated(
          tenantUser._id,
          request.request_type,
          request.status,
          request.request_id,
          {
            statusChanged,
            hasAdminNote: true,
            hasProgressEntry: true,
            hasProgressAttachments: attachments.length > 0,
            eventId: `resolution-proof:${eventTimestamp.toISOString()}`,
          },
        );
      } catch {
        // non-fatal
      }
    }

    await emitMaintenanceUpdated(request);

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/attachments/remove
 */
export const removeAdminMaintenanceAttachment = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);
    const scope = normalizeRemovalScope(req.body?.scope || req.body?.removedScope);

    if (request.isArchived) {
      throw new AppError(
        "Archived maintenance requests cannot be updated.",
        409,
        "REQUEST_ARCHIVED",
      );
    }

    if (!scope) {
      throw new AppError(
        "Please choose how to remove this attachment.",
        400,
        "INVALID_REMOVAL_SCOPE",
      );
    }

    const target = findAttachmentTarget(request, req.body || {});
    if (!target?.attachment) {
      throw new AppError(
        "Attachment not found.",
        404,
        "ATTACHMENT_NOT_FOUND",
      );
    }

    const eventTimestamp = new Date();
    const reason = toOptionalText(req.body?.reason || req.body?.removedReason);
    if (!reason || reason.toLowerCase() === "other") {
      throw new AppError(
        "Please provide a reason for removing this attachment.",
        400,
        "REMOVAL_REASON_REQUIRED",
      );
    }

    const actor = buildActorSnapshot(adminUser);
    target.attachment.isRemoved = true;
    target.attachment.removedAt = eventTimestamp;
    target.attachment.removedBy = actor.actor_id;
    target.attachment.removedByRole = actor.actor_role;
    target.attachment.removedByName = actor.actor_name;
    target.attachment.removedReason = reason;
    target.attachment.removedScope = scope;

    appendStatusHistory(request, {
      event:
        scope === "tenant_only"
          ? "attachment_removed_tenant"
          : "attachment_removed_request",
      status: request.status,
      ...actor,
      note: reason || getAttachmentUri(target.attachment) || target.attachment.name || null,
      timestamp: eventTimestamp,
      attachmentName: target.attachment.name || target.attachment.filename || null,
      attachmentId:
        target.attachment.id ||
        target.attachment.attachmentId ||
        target.attachment.storagePath ||
        null,
      removedScope: scope,
      source: target.source,
    });

    request.markModified(target.source === "request" ? "attachments" : target.source);
    if (target.source === "conversation") request.markModified("conversation");
    if (target.source === "work_log") request.markModified("work_log");

    await request.save();
    await emitMaintenanceUpdated(request);

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};
