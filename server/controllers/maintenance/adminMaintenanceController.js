/**
 * ============================================================================
 * ADMIN MAINTENANCE CONTROLLER
 * ============================================================================
 *
 * Handles administrative maintenance management including status changes,
 * branch assignment, provider assignment, archiving, bulk operations, and replies.
 */

import mongoose from "mongoose";
import {
  ADMIN_MAINTENANCE_STATUSES,
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  canAdminTransitionMaintenanceStatus,
  formatMaintenanceStatusLabel,
  isAdminMutableMaintenanceStatus,
  isValidMaintenanceStatus,
  normalizeMaintenanceStatus,
  normalizeMaintenanceType,
  normalizeMaintenanceUrgency,
} from "../../config/maintenance.js";
import { ROOM_BRANCH_LABELS } from "../../config/branches.js";
import { AppError, sendSuccess } from "../../middleware/errorHandler.js";
import { MaintenanceRequest, ServiceProvider, User } from "../../models/index.js";
import {
  USER_SELECT_FIELDS,
  MAINTENANCE_LIMIT_MAX,
  buildActorSnapshot,
  findAccessibleRequest,
  getDbUser,
  ensureAdminAccess,
  serializeTenantSummary,
  serializeMaintenanceRequest,
  toOptionalText,
  parseLimit,
  normalizeAttachments,
  normalizeRoomBranch,
  normalizeProviderSource,
  normalizeTextList,
  sanitizeDigitsOnly,
  parseOptionalAmount,
  providerMatchesMaintenanceRequest,
  getMaintenanceCategoryLabel,
  appendStatusHistory,
  appendConversationEntry,
  getReplyAttachmentsFromBody,
  validateIncomingAttachments,
  validateIncomingWorkLogAttachments,
  resolveAdminBranchFilter,
  loadTenantMap,
  buildMaintenanceReportPayload,
  findOverlappingRoomRequests,
} from "./_helpers.js";
import { notify } from "../../utils/notificationService.js";

const resolveArchiveFilter = (value) => {
  const archive = String(value || "active").trim().toLowerCase();
  if (["active", "archived", "all"].includes(archive)) return archive;
  return "active";
};

const normalizeAdminUpdatePayload = (payload = {}, attachmentMetadata = {}) => {
  const hasAssignedField = Object.prototype.hasOwnProperty.call(payload, "assigned_to");
  const rawWorkLogAttachments =
    payload.work_log_attachments !== undefined
      ? payload.work_log_attachments
      : payload.workLogAttachments;
  const workLogAttachments = normalizeAttachments(
    rawWorkLogAttachments,
    attachmentMetadata,
  );

  return {
    nextStatus: normalizeMaintenanceStatus(payload.status),
    nextNotes: payload.notes !== undefined ? toOptionalText(payload.notes) : undefined,
    nextAssignedTo: hasAssignedField ? toOptionalText(payload.assigned_to) : undefined,
    hasAssignedField,
    workLogNote: toOptionalText(
      payload.work_log_note !== undefined ? payload.work_log_note : payload.workLogNote,
    ),
    workLogAttachmentErrors: validateIncomingWorkLogAttachments(rawWorkLogAttachments),
    workLogAttachments,
  };
};

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

const applyAdminUpdateToRequest = ({ request, adminUser, payload }) => {
  if (normalizeMaintenanceStatus(request.status) === "closed") {
    throw new AppError(
      "Closed maintenance requests cannot be updated",
      409,
      "REQUEST_CLOSED",
    );
  }

  const {
    nextStatus,
    nextNotes,
    nextAssignedTo,
    hasAssignedField,
    workLogNote,
    workLogAttachmentErrors,
    workLogAttachments,
  } = normalizeAdminUpdatePayload(payload, {
    context: "maintenance_internal_note",
    visibility: "admin_only",
    branchId: request.branch,
    uploadedBy: adminUser?.user_id,
    senderRole: adminUser?.role || "admin",
    relatedId: request.request_id,
  });

  if (workLogAttachmentErrors.length > 0) {
    throw new AppError(
      "Some required information is missing or invalid. Please review the highlighted fields.",
      400,
      "VALIDATION_ERROR",
      workLogAttachmentErrors,
    );
  }

  if (hasAssignedField && nextAssignedTo && nextAssignedTo.length < 2) {
    throw new AppError("Assigned service provider name is too short", 400, "INVALID_ASSIGNEE", [
      {
        field: "assigned_to",
        message: "Assigned service provider must be at least 2 characters.",
      },
    ]);
  }

  if (
    nextStatus === "in_progress" &&
    !nextAssignedTo &&
    !request.assigned_to &&
    !request.assignedProviderName
  ) {
    throw new AppError(
      "Please assign a service provider before marking this request as In Progress.",
      400,
      "ASSIGNEE_REQUIRED",
      [
        {
          field: "assigned_to",
          message: "Please assign a service provider before marking this request as In Progress.",
        },
      ],
    );
  }

  if (!canAdminTransitionMaintenanceStatus(request.status, nextStatus)) {
    throw new AppError(
      `Invalid maintenance status transition: ${request.status} -> ${nextStatus}`,
      409,
      "INVALID_STATUS_TRANSITION",
      [
        {
          field: "status",
          message: "This status change is not available for the current request.",
        },
      ],
    );
  }

  const requiresResolutionNote = ["resolved", "completed"].includes(nextStatus);
  if (requiresResolutionNote && !nextNotes && !workLogNote) {
    throw new AppError(
      "Please add resolution notes or a completion work log before marking this request as Resolved.",
      400,
      "RESOLUTION_NOTE_REQUIRED",
      [
        {
          field: "notes",
          message: "Please add resolution notes or a completion work log before marking this request as Resolved.",
        },
      ],
    );
  }

  const statusChanged = request.status !== nextStatus;
  const isSameStatusUpdate =
    normalizeMaintenanceStatus(request.status) === nextStatus;

  if (
    !nextStatus ||
    (!isAdminMutableMaintenanceStatus(nextStatus) && !isSameStatusUpdate)
  ) {
    throw new AppError(
      `Status must be one of: ${ADMIN_MAINTENANCE_STATUSES.join(", ")}`,
      400,
      "INVALID_ADMIN_STATUS",
      [
        {
          field: "status",
          message: "Please choose a valid status for this request.",
        },
      ],
    );
  }

  let assignmentChanged =
    hasAssignedField && request.assigned_to !== nextAssignedTo;
  const notesChanged = nextNotes !== undefined && request.notes !== nextNotes;
  const eventTimestamp = new Date();

  request.status = nextStatus;

  if (statusChanged) {
    request.slaBreachNotified = false;
  }

  if (nextNotes !== undefined) {
    request.notes = nextNotes;
  }
  if (hasAssignedField) {
    request.assigned_to = nextAssignedTo;
    request.assigned_at = nextAssignedTo ? eventTimestamp : null;
  }

  if (statusChanged && nextStatus === "in_progress" && !request.work_started_at) {
    request.work_started_at = eventTimestamp;
  }

  if (statusChanged && ["resolved", "completed", "closed"].includes(nextStatus)) {
    request.resolved_at = eventTimestamp;
    request.resolution_note = nextNotes ?? request.notes ?? null;
    if (nextStatus === "closed") {
      request.closed_at = eventTimestamp;
    }
  }

  if (statusChanged && ["pending", "viewed", "in_progress", "waiting_tenant"].includes(nextStatus)) {
    request.cancelled_at = null;
    request.closed_at = null;
    if (!["resolved", "completed"].includes(nextStatus)) {
      request.resolved_at = null;
      request.resolution_note = null;
    }
  }

  if (statusChanged && nextStatus === "rejected") {
    request.resolved_at = eventTimestamp;
    request.resolution_note = nextNotes ?? request.notes ?? null;
  }

  if (statusChanged || assignmentChanged || notesChanged) {
    appendStatusHistory(request, {
      event: statusChanged
        ? "status_changed"
        : assignmentChanged
          ? "assignment_updated"
          : "note_updated",
      status: request.status,
      ...buildActorSnapshot(adminUser),
      note: nextNotes ?? workLogNote ?? null,
      timestamp: eventTimestamp,
    });
  }

  if (workLogNote || workLogAttachments.length > 0) {
    request.work_log = [
      ...(Array.isArray(request.work_log) ? request.work_log : []),
      {
        note: workLogNote || "Progress attachment added.",
        attachments: workLogAttachments,
        ...buildActorSnapshot(adminUser),
        logged_at: eventTimestamp,
      },
    ];
  }

  return {
    statusChanged,
    notesChanged,
    hasTenantVisibleUpdate: statusChanged,
  };
};

/**
 * GET /api/m/maintenance/admin/all
 * GET /api/maintenance/branch (compat)
 */
export const getAdminAll = async (req, res, next) => {
  try {
    const archiveFilter = resolveArchiveFilter(
      req.query.archive || req.query.archived || req.query.view,
    );
    const query = {};
    const limit = parseLimit(req.query.limit, MAINTENANCE_LIMIT_MAX);
    const branch = resolveAdminBranchFilter(req);
    const status = normalizeMaintenanceStatus(req.query.status);
    const requestType = normalizeMaintenanceType(
      req.query.request_type || req.query.category,
    );
    const urgency = normalizeMaintenanceUrgency(req.query.urgency);
    const userId = toOptionalText(req.query.user_id);
    const dateFrom = toOptionalText(req.query.date_from);
    const dateTo = toOptionalText(req.query.date_to);

    if (archiveFilter === "active") query.isArchived = false;
    if (archiveFilter === "archived") query.isArchived = true;
    if (branch) query.branch = branch;
    if (status) {
      if (!isValidMaintenanceStatus(status)) {
        throw new AppError("Invalid maintenance status filter", 400, "INVALID_STATUS");
      }
      query.status = status;
    }
    if (requestType) {
      if (!MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
        throw new AppError("Invalid maintenance request type filter", 400, "INVALID_REQUEST_TYPE");
      }
      query.request_type = requestType;
    }
    if (urgency) {
      if (!MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
        throw new AppError("Invalid maintenance urgency filter", 400, "INVALID_URGENCY");
      }
      query.urgency = urgency;
    }
    if (userId) query.user_id = userId;
    if (dateFrom || dateTo) {
      query.created_at = {};
      if (dateFrom) {
        const parsedFrom = new Date(dateFrom);
        if (Number.isNaN(parsedFrom.getTime())) {
          throw new AppError("Invalid date_from value", 400, "INVALID_DATE_RANGE");
        }
        query.created_at.$gte = parsedFrom;
      }
      if (dateTo) {
        const parsedTo = new Date(dateTo);
        if (Number.isNaN(parsedTo.getTime())) {
          throw new AppError("Invalid date_to value", 400, "INVALID_DATE_RANGE");
        }
        parsedTo.setHours(23, 59, 59, 999);
        query.created_at.$lte = parsedTo;
      }
    }

    const requests = await MaintenanceRequest.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    const tenantMap = await loadTenantMap(requests);

    sendSuccess(res, {
      count: requests.length,
      requests: requests.map((request) =>
        serializeMaintenanceRequest(
          request,
          serializeTenantSummary(tenantMap.get(request.user_id), request),
        ),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/m/maintenance/:requestId
 * GET /api/maintenance/requests/:requestId (compat)
 */
export const getRequestById = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const isAdminViewer = dbUser.role === "owner" || dbUser.role === "branch_admin";
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: isAdminViewer,
    });

    if (isAdminViewer) {
      if (dbUser.role !== "owner" && request.branch !== dbUser.branch) {
        throw new AppError("Access denied", 403, "FORBIDDEN");
      }
    } else {
      if (request.user_id !== dbUser.user_id) {
        throw new AppError("Access denied", 403, "FORBIDDEN");
      }
    }

    const tenantUser =
      request.user_id === dbUser.user_id
        ? dbUser
        : await User.findOne({ user_id: request.user_id }).select(USER_SELECT_FIELDS).lean();

    const serializedRequest = serializeMaintenanceRequest(
      request.toObject(),
      serializeTenantSummary(tenantUser, request),
      { includeInternal: isAdminViewer },
    );

    sendSuccess(res, {
      request: serializedRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/status
 * PATCH /api/maintenance/requests/:requestId (compat)
 */
export const updateAdminRequestStatus = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    const { statusChanged, notesChanged, hasTenantVisibleUpdate } = applyAdminUpdateToRequest({
      request,
      adminUser,
      payload: req.body,
    });

    await request.save();

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select("_id user_id firstName lastName email phone branch role")
      .lean();

    if (hasTenantVisibleUpdate && tenantUser?._id) {
      await notify.maintenanceUpdated(
        tenantUser._id,
        request.request_type,
        request.status,
        request.request_id,
        {
          statusChanged,
          hasAdminNote: notesChanged,
          hasProgressEntry: Boolean(req.body.work_log_note || req.body.workLogNote),
          hasProgressAttachments: normalizeAttachments(
            req.body.work_log_attachments !== undefined
              ? req.body.work_log_attachments
              : req.body.workLogAttachments,
          ).length > 0,
        },
      );
    }

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
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

export const updateAdminRequestStatusCompat = async (req, res, next) => {
  req.body = {
    status: normalizeMaintenanceStatus(req.body.status),
    notes:
      req.body.notes !== undefined
        ? req.body.notes
        : req.body.completionNote,
    assigned_to:
      req.body.assigned_to !== undefined
        ? req.body.assigned_to
        : req.body.assignedTo,
  };

  return updateAdminRequestStatus(req, res, next);
};

/**
 * POST /api/m/maintenance/admin/:requestId/assign-provider
 */
export const assignAdminMaintenanceProvider = async (req, res, next) => {
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

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot be updated.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const actor = buildActorSnapshot(adminUser);
    const providerSource = normalizeProviderSource(
      req.body?.providerSource || req.body?.source,
    );
    if (!providerSource) {
      throw new AppError(
        "Please choose a service provider assignment option.",
        400,
        "INVALID_PROVIDER_SOURCE",
        [{ field: "providerSource", message: "Please choose a service provider assignment option." }],
      );
    }

    const previousProviderName = request.assignedProviderName || request.assigned_to || null;
    const eventTimestamp = new Date();
    let nextProvider = null;
    let event = "service_provider_assigned";

    if (providerSource === "none") {
      if (!previousProviderName) {
        const tenantUser = await User.findOne({ user_id: request.user_id })
          .select(USER_SELECT_FIELDS)
          .lean();

        sendSuccess(res, {
          message: "No service provider is assigned yet.",
          request: serializeMaintenanceRequest(
            request.toObject(),
            serializeTenantSummary(tenantUser, request),
          ),
        });
        return;
      }
      event = "service_provider_unassigned";
      request.assignedProviderId = null;
      request.assignedProviderName = null;
      request.assignedProviderContact = null;
      request.assignedProviderCategory = null;
      request.assignedProviderNotes = null;
      request.assignedProviderSource = null;
      request.assignedBy = actor.actor_id;
      request.assignedByName = actor.actor_name;
      request.assignedByRole = actor.actor_role;
      request.assigned_to = null;
      request.assigned_at = null;
    } else if (providerSource === "directory") {
      const providerId = toOptionalText(req.body?.providerId || req.body?.assignedProviderId);
      if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
        throw new AppError("Please select a saved service provider.", 400, "PROVIDER_REQUIRED", [
          { field: "providerId", message: "Please select a saved service provider." },
        ]);
      }

      const provider = await ServiceProvider.findById(providerId).select("+serviceCategoryKeys");
      if (!provider) {
        throw new AppError("Service provider not found.", 404, "SERVICE_PROVIDER_NOT_FOUND");
      }
      if (!providerMatchesMaintenanceRequest(provider, request)) {
        throw new AppError(
          "This provider is not active for the request branch and type.",
          400,
          "PROVIDER_NOT_AVAILABLE",
          [{ field: "providerId", message: "This provider is not active for the request branch and type." }],
        );
      }

      nextProvider = {
        id: provider._id,
        name: provider.providerName,
        contact: provider.contactNumber,
        category: provider.serviceCategories?.[0] || getMaintenanceCategoryLabel(request),
        notes: toOptionalText(req.body?.notes) || provider.notes || null,
        source: "directory",
      };
    } else if (providerSource === "manual") {
      const providerName = toOptionalText(req.body?.providerName);
      const contactNumber = sanitizeDigitsOnly(req.body?.contactNumber);
      const serviceType = toOptionalText(req.body?.serviceType || req.body?.category);
      const notes = toOptionalText(req.body?.notes);
      const minRate = parseOptionalAmount(req.body?.minRate ?? req.body?.minimumRate, "minRate");
      const maxRate = parseOptionalAmount(req.body?.maxRate ?? req.body?.maximumRate, "maxRate");

      const validationErrors = [];
      if (!providerName || providerName.length < 3) validationErrors.push({ field: "providerName", message: "Provider name must be at least 3 characters." });
      if (!/^09\d{9}$/.test(contactNumber)) validationErrors.push({ field: "contactNumber", message: "Enter a valid 11-digit Philippine mobile number starting with 09." });
      if (!serviceType || serviceType.length < 3) validationErrors.push({ field: "serviceType", message: "Service type must be at least 3 characters." });
      if (notes && notes.length < 10) validationErrors.push({ field: "notes", message: "Provider notes must be at least 10 characters." });
      if (minRate !== null && maxRate !== null && maxRate < minRate) validationErrors.push({ field: "maxRate", message: "Enter a valid amount." });
      if (validationErrors.length > 0) {
        throw new AppError(
          "Please complete the manual provider details.",
          400,
          "VALIDATION_ERROR",
          validationErrors,
        );
      }

      let savedProvider = null;
      const saveForFuture = Boolean(req.body?.saveForFuture);
      if (saveForFuture) {
        const branch = request.branch;
        if (!branch) {
          throw new AppError(
            "This request needs a branch before saving a provider for future use.",
            400,
            "PROVIDER_BRANCH_REQUIRED",
            [
              {
                field: "saveForFuture",
                message: "Repair or assign the request branch before saving this provider for future use.",
              },
            ],
          );
        }
        savedProvider = await ServiceProvider.create({
          providerName,
          contactNumber,
          serviceCategories: normalizeTextList([serviceType, getMaintenanceCategoryLabel(request)]),
          branchCoverage: [branch],
          notes,
          minRate,
          maxRate,
          status: "active",
          createdBy: adminUser.user_id || String(adminUser._id || ""),
          updatedBy: adminUser.user_id || String(adminUser._id || ""),
        });
      }

      nextProvider = {
        id: savedProvider?._id || null,
        name: savedProvider?.providerName || providerName,
        contact: savedProvider?.contactNumber || contactNumber,
        category: serviceType,
        notes,
        source: savedProvider ? "directory" : "manual",
      };
    }

    if (nextProvider) {
      event = previousProviderName
        ? previousProviderName === nextProvider.name
          ? "service_provider_assigned"
          : "service_provider_changed"
        : "service_provider_assigned";
      request.assignedProviderId = nextProvider.id || null;
      request.assignedProviderName = nextProvider.name;
      request.assignedProviderContact = nextProvider.contact;
      request.assignedProviderCategory = nextProvider.category;
      request.assignedProviderNotes = nextProvider.notes;
      request.assignedProviderSource = nextProvider.source;
      request.assignedBy = actor.actor_id;
      request.assignedByName = actor.actor_name;
      request.assignedByRole = actor.actor_role;
      request.assigned_to = nextProvider.name;
      request.assigned_at = eventTimestamp;

      // Automatically transition lifecycle status to in_progress if pending or viewed
      if (["pending", "viewed", "submitted"].includes(request.status)) {
        request.status = "in_progress";
        request.in_progress_at = eventTimestamp;
      }
    }

    appendStatusHistory(request, {
      event,
      status: request.status,
      ...actor,
      note: toOptionalText(req.body?.notes) || null,
      timestamp: eventTimestamp,
      providerId: request.assignedProviderId || null,
      providerName: request.assignedProviderName || null,
      previousProviderName,
      providerSource: request.assignedProviderSource || null,
    });

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

/**
 * PATCH /api/m/maintenance/admin/:requestId/branch
 */
export const assignAdminMaintenanceBranch = async (req, res, next) => {
  try {
    if (!req.isOwner) {
      throw new AppError(
        "Only the owner can assign a missing maintenance request branch.",
        403,
        "OWNER_ONLY",
      );
    }

    const branch = normalizeRoomBranch(req.body?.branch);
    if (!branch) {
      throw new AppError("Please select a valid branch.", 400, "INVALID_BRANCH", [
        { field: "branch", message: "Please select Guadalupe or Gil Puyat." },
      ]);
    }

    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    const currentBranch = normalizeRoomBranch(request.branch);
    if (currentBranch) {
      throw new AppError(
        "This maintenance request already has a branch assigned.",
        409,
        "REQUEST_BRANCH_ALREADY_ASSIGNED",
        [{ field: "branch", message: "This request already has a valid branch." }],
      );
    }

    const ownerUser = await getDbUser(req.user.uid);
    const branchLabel = ROOM_BRANCH_LABELS[branch] || branch;
    const assignedAt = new Date();
    const actor = buildActorSnapshot(ownerUser);

    request.branch = branch;
    appendStatusHistory(request, {
      event: "branch_assigned_manually",
      status: request.status,
      ...actor,
      actor_name: "Dormitory Owner",
      note: `Branch: ${branchLabel}`,
      branch,
      timestamp: assignedAt,
    });

    await request.save();
    await emitMaintenanceUpdated(request);

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      message: `Branch assigned manually: ${branchLabel}.`,
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
 * POST /api/m/maintenance/admin/:requestId/send-tenant-summary
 */
export const sendAdminTenantSummary = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot receive new replies.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();
    const requestSnapshot = {
      ...request.toObject(),
      tenant: serializeTenantSummary(tenantUser, request),
    };
    const report = await buildMaintenanceReportPayload({
      request: requestSnapshot,
      tenant: requestSnapshot.tenant,
      adminUser,
      reportType: "tenant",
    });
    const message = toOptionalText(report.summary);

    if (!message) {
      throw new AppError(
        "Tenant summary could not be generated.",
        500,
        "TENANT_SUMMARY_UNAVAILABLE",
      );
    }

    const eventTimestamp = new Date();
    appendConversationEntry(request, {
      type: "tenant_summary",
      kind: "tenant_summary",
      message,
      attachments: [],
      sender_id: adminUser?.user_id || null,
      sender_name:
        `${adminUser?.firstName || ""} ${adminUser?.lastName || ""}`.trim() ||
        adminUser?.email ||
        adminUser?.user_id ||
        null,
      sender_role: adminUser?.role || null,
      sender_side: "admin",
      created_at: eventTimestamp,
    });
    request.updated_at = eventTimestamp;

    await request.save();

    if (tenantUser?._id) {
      await notify.maintenanceUpdated(
        tenantUser._id,
        request.request_type,
        request.status,
        request.request_id,
        {
          statusChanged: false,
          hasAdminNote: true,
          hasProgressEntry: false,
          hasProgressAttachments: false,
        },
      );
    }

    sendSuccess(res, {
      report,
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
 * POST /api/m/maintenance/admin/:requestId/reply
 */
export const sendAdminReply = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot receive new replies.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const rawAttachments = getReplyAttachmentsFromBody(req.body);
    const attachmentErrors = validateIncomingAttachments(rawAttachments, {
      fieldPrefix: "attachments",
      noun: "Reply attachments",
    });
    const attachments = normalizeAttachments(rawAttachments, {
      context: "maintenance_reply",
      visibility: "tenant_admin",
      branchId: request.branch,
      uploadedBy: adminUser?.user_id,
      senderRole: adminUser?.role || "admin",
      relatedId: request.request_id,
    });
    const message = toOptionalText(
      req.body.message ?? req.body.replyMessage ?? req.body.body ?? req.body.reply,
    );

    if (attachmentErrors.length > 0) {
      throw new AppError(
        attachmentErrors[0]?.message || "Invalid attachment format.",
        400,
        "VALIDATION_ERROR",
        attachmentErrors,
      );
    }

    if (!message && attachments.length === 0) {
      throw new AppError(
        "Please enter a message or attach a file before sending.",
        400,
        "REPLY_REQUIRED",
        [
          {
            field: "message",
            message: "Please enter a message or attach a file before sending.",
          },
        ],
      );
    }

    const eventTimestamp = new Date();
    appendConversationEntry(request, {
      message,
      attachments,
      sender_id: adminUser?.user_id || null,
      sender_name:
        `${adminUser?.firstName || ""} ${adminUser?.lastName || ""}`.trim() ||
        adminUser?.email ||
        adminUser?.user_id ||
        null,
      sender_role: adminUser?.role || null,
      sender_side: "admin",
      created_at: eventTimestamp,
    });
    request.updated_at = eventTimestamp;

    await request.save();

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select("_id user_id firstName lastName email phone branch role")
      .lean();

    if (tenantUser?._id) {
      await notify.maintenanceUpdated(
        tenantUser._id,
        request.request_type,
        request.status,
        request.request_id,
        {
          statusChanged: false,
          hasAdminNote: true,
          hasProgressEntry: false,
          hasProgressAttachments: false,
        },
      );
    }

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
 * PATCH /api/m/maintenance/admin/bulk
 */
export const updateAdminBulkRequests = async (req, res, next) => {
  try {
    const adminUser = await getDbUser(req.user.uid);
    const requestIds = Array.isArray(req.body.requestIds)
      ? req.body.requestIds
      : Array.isArray(req.body.requests)
        ? req.body.requests
        : [];
    const payload = {
      status: req.body.status,
      notes: req.body.notes,
      assigned_to: req.body.assigned_to,
      work_log_note: req.body.work_log_note,
      work_log_attachments:
        req.body.work_log_attachments !== undefined
          ? req.body.work_log_attachments
          : req.body.workLogAttachments,
    };

    if (requestIds.length === 0) {
      throw new AppError("No maintenance requests selected", 400, "MISSING_REQUESTS");
    }
    if (requestIds.length > 50) {
      throw new AppError("Bulk updates are limited to 50 requests", 400, "BULK_LIMIT");
    }

    const hasPayload =
      payload.status !== undefined ||
      payload.notes !== undefined ||
      payload.assigned_to !== undefined ||
      payload.work_log_note !== undefined ||
      payload.work_log_attachments !== undefined;
    if (!hasPayload) {
      throw new AppError("No update values provided", 400, "MISSING_UPDATE_VALUES");
    }

    const results = {
      updated: [],
      failed: [],
    };

    for (const requestId of requestIds) {
      try {
        const request = await findAccessibleRequest(requestId);
        ensureAdminAccess(request, req);

        const { statusChanged, notesChanged, hasTenantVisibleUpdate } = applyAdminUpdateToRequest({
          request,
          adminUser,
          payload,
        });

        await request.save();

        if (hasTenantVisibleUpdate) {
          const tenantUser = await User.findOne({ user_id: request.user_id })
            .select("_id")
            .lean();
          if (tenantUser?._id) {
            await notify.maintenanceUpdated(
              tenantUser._id,
              request.request_type,
              request.status,
              request.request_id,
              {
                statusChanged,
                hasAdminNote: notesChanged,
                hasProgressEntry: Boolean(payload.work_log_note || payload.workLogNote),
                hasProgressAttachments: normalizeAttachments(
                  payload.work_log_attachments !== undefined
                    ? payload.work_log_attachments
                    : payload.workLogAttachments,
                ).length > 0,
              },
            );
          }
        }

        results.updated.push(request.request_id);
      } catch (error) {
        results.failed.push({
          requestId,
          error: error?.message || "Update failed",
          code: error?.code || error?.errorCode || "UPDATE_FAILED",
        });
      }
    }

    sendSuccess(res, {
      updatedCount: results.updated.length,
      failedCount: results.failed.length,
      ...results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/archive
 */
export const archiveAdminMaintenanceRequest = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    if (!request.isArchived) {
      const eventTimestamp = new Date();
      request.isArchived = true;
      request.archivedAt = eventTimestamp;
      request.archivedBy = adminUser?.user_id || String(adminUser?._id || "");
      appendStatusHistory(request, {
        event: "archived",
        status: request.status,
        ...buildActorSnapshot(adminUser),
        note: toOptionalText(req.body?.reason) || null,
        timestamp: eventTimestamp,
      });
      await request.save();
      await emitMaintenanceUpdated(request);
    }

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

/**
 * PATCH /api/m/maintenance/admin/:requestId/restore
 */
export const restoreAdminMaintenanceRequest = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    if (request.isArchived) {
      const eventTimestamp = new Date();
      request.isArchived = false;
      request.restoredAt = eventTimestamp;
      request.restoredBy = adminUser?.user_id || String(adminUser?._id || "");
      appendStatusHistory(request, {
        event: "restored",
        status: request.status,
        ...buildActorSnapshot(adminUser),
        note: toOptionalText(req.body?.reason) || null,
        timestamp: eventTimestamp,
      });
      await request.save();
      await emitMaintenanceUpdated(request);
    }

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

/**
 * PATCH /api/maintenance/admin/:requestId/cost
 */
export const updateAdminMaintenanceCost = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    const laborCost = Math.max(0, Number(req.body?.laborCost) || 0);
    const materialsCost = Math.max(0, Number(req.body?.materialsCost) || 0);
    const totalCost = laborCost + materialsCost;
    const isTenantChargeable = Boolean(req.body?.isTenantChargeable);
    const chargeReason = toOptionalText(req.body?.chargeReason);

    request.estimatedCost = totalCost;
    request.actualCost = totalCost;
    request.costBreakdown = {
      laborCost,
      materialsCost,
      totalCost,
      isTenantChargeable,
      chargeReason,
      billId: request.costBreakdown?.billId || null,
    };

    if (isTenantChargeable && !request.chargeableTenantId && request.userId) {
      request.chargeableTenantId = request.userId;
    }

    const eventTimestamp = new Date();
    appendStatusHistory(request, {
      event: "cost_attribution_updated",
      status: request.status,
      ...buildActorSnapshot(adminUser),
      note: `Cost: PHP ${totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })} (${isTenantChargeable ? "Tenant Chargeable" : "Dormitory Absorbed"})`,
      timestamp: eventTimestamp,
    });

    await request.save();
    await emitMaintenanceUpdated(request);

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      message: "Cost breakdown updated successfully.",
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
 * GET /api/maintenance/admin/:requestId/duplicates
 */
export const getAdminMaintenanceDuplicates = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);

    const overlapping = await findOverlappingRoomRequests(request);
    const tenantMap = await loadTenantMap(overlapping);

    sendSuccess(res, {
      count: overlapping.length,
      hasPotentialDuplicates: overlapping.length > 0,
      duplicates: overlapping.map((dup) =>
        serializeMaintenanceRequest(
          dup,
          serializeTenantSummary(tenantMap.get(dup.user_id), dup),
        ),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getByBranch = getAdminAll;
export const getRequest = getRequestById;
export const updateRequest = updateAdminRequestStatusCompat;
