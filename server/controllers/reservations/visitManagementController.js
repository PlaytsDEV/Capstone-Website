/**
 * ============================================================================
 * VISIT MANAGEMENT CONTROLLER
 * ============================================================================
 *
 * Handles physical visit scheduling, availability rules, visit outcomes, and document prechecks.
 */

import {
  Reservation,
  Room,
  VisitAvailabilityHistory,
  VisitConflictLog,
} from "../../models/index.js";
import { reservationStatusesForQuery } from "../../utils/lifecycleNaming.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import { sendSuccess } from "../../middleware/errorHandler.js";
import {
  isValidObjectId,
  invalidIdResponse,
} from "../../utils/reservationHelpers.js";
import {
  buildVisitAvailability,
  getDateRangeForKey,
  getVisitAvailabilitySettings,
  serializeVisitAvailabilitySettings,
  updateVisitAvailabilitySettings,
} from "../../utils/visitAvailability.js";
import {
  computeAvailabilityDiff,
  isDiffEmpty,
} from "../../utils/visitAvailabilityDiff.js";
import {
  isAllowedReservationDocumentUrl,
  runReservationDocumentPrecheck,
} from "../../services/reservationDocumentPrecheckService.js";
import { detectVisitConflicts } from "../../services/visitConflictDetectionService.js";
import {
  DOCUMENT_PRECHECK_TYPES,
  findDbUser,
  resolveVisitAvailabilityBranch,
  buildVisitAvailabilityActor,
  normalizeDocumentPrecheckType,
  mapAiStatusToLegacyValidationStatus,
} from "./_helpers.js";

export const getVisitAvailability = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const availability = await buildVisitAvailability({
      branch: branchResult.branch,
      from: req.query.from,
      days: req.query.days,
      roomId: req.query.roomId || null,
      excludeReservationId: req.query.reservationId || null,
    });

    return sendSuccess(res, availability);
  } catch (error) {
    next(error);
  }
};

export const getVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const settings = await getVisitAvailabilitySettings(branchResult.branch);
    return sendSuccess(res, serializeVisitAvailabilitySettings(settings));
  } catch (error) {
    next(error);
  }
};

export const preflightVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const currentSettings = await getVisitAvailabilitySettings(branchResult.branch);
    const currentPayload = serializeVisitAvailabilitySettings(currentSettings);
    const proposedPayload = req.body || {};

    const report = await detectVisitConflicts(
      branchResult.branch,
      proposedPayload,
      currentPayload,
    );

    return sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
};

export const updateVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const beforeSettings = await getVisitAvailabilitySettings(branchResult.branch);
    const beforePayload = serializeVisitAvailabilitySettings(beforeSettings);
    
    // Check conflicts before persisting updates
    const conflictReport = await detectVisitConflicts(
      branchResult.branch,
      req.body || {},
      beforePayload,
    );

    const actor = buildVisitAvailabilityActor(req, dbUser);

    const settings = await updateVisitAvailabilitySettings(
      branchResult.branch,
      req.body || {},
      actor,
    );
    const afterPayload = serializeVisitAvailabilitySettings(settings);

    await auditLogger.logModification(
      req,
      "visit_availability",
      branchResult.branch,
      beforePayload,
      afterPayload,
      "Updated visit availability rules",
    );

    // ── Write history snapshot (skip if nothing actually changed) ──────────
    let historyRecord = null;
    const diff = computeAvailabilityDiff(beforePayload, afterPayload);
    if (!isDiffEmpty(diff)) {
      historyRecord = await VisitAvailabilityHistory.create({
        branch: branchResult.branch,
        snapshot: {
          enabledWeekdays: afterPayload.enabledWeekdays ?? [],
          slots: afterPayload.slots ?? [],
          blackoutDates: afterPayload.blackoutDates ?? [],
          dayOverrides: afterPayload.dayOverrides ?? {},
        },
        changedBy: actor,
        changedAt: new Date(),
        changeDescription: String(req.body?.changeDescription || "").trim(),
        diff,
      });
    }

    // ── Log conflict events if conflicts were detected upon saving ──────────
    if (conflictReport.hasConflicts) {
      const adminNote = String(req.body?.adminNote || "").trim();
      for (const conflict of conflictReport.conflicts) {
        await VisitConflictLog.create({
          branch: branchResult.branch,
          ruleChangeType: conflict.type,
          trigger: conflict.trigger,
          affectedReservations: conflict.reservations || [],
          affectedCount: conflict.affectedCount || 0,
          acknowledgedBy: actor,
          acknowledgedAt: new Date(),
          adminNote,
          resolved: false,
          historyId: historyRecord ? historyRecord._id : null,
        });
      }
    }

    return sendSuccess(res, {
      ...afterPayload,
      conflictReport,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reservations/visit-availability/history?branch=&page=1&limit=20
 *
 * Returns paginated audit history for availability rules changes for a branch.
 * Branch admins are automatically scoped to their own branch via filterByBranch middleware.
 */
export const getVisitAvailabilityHistory = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { branch: branchResult.branch };

    const [records, total] = await Promise.all([
      VisitAvailabilityHistory.find(filter)
        .sort({ changedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VisitAvailabilityHistory.countDocuments(filter),
    ]);

    return sendSuccess(res, { records, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const getVisitConflictHistory = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { branch: branchResult.branch };
    if (req.query.resolved === "true") {
      filter.resolved = true;
    } else if (req.query.resolved === "false") {
      filter.resolved = false;
    }

    const [records, total] = await Promise.all([
      VisitConflictLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VisitConflictLog.countDocuments(filter),
    ]);

    return sendSuccess(res, { records, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const toggleResolveVisitConflict = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const { conflictId } = req.params;
    if (!isValidObjectId(conflictId)) return invalidIdResponse(res);

    const conflictLog = await VisitConflictLog.findOne({
      _id: conflictId,
      branch: branchResult.branch,
    });

    if (!conflictLog) {
      return res.status(404).json({
        error: "Conflict log entry not found",
        code: "CONFLICT_LOG_NOT_FOUND",
      });
    }

    const resolved = typeof req.body.resolved === "boolean" ? req.body.resolved : !conflictLog.resolved;
    const actor = buildVisitAvailabilityActor(req, dbUser);

    conflictLog.resolved = resolved;
    conflictLog.resolvedBy = resolved ? actor : null;
    conflictLog.resolvedAt = resolved ? new Date() : null;

    await conflictLog.save();

    return sendSuccess(res, conflictLog);
  } catch (error) {
    next(error);
  }
};

export const getVisitSlotVisitors = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const dateKey = String(req.query.date || "").trim();
    const slotLabel = String(req.query.slot || "").trim();

    if (!dateKey || !slotLabel) {
      return res.status(400).json({
        error: "Date and slot query parameters are required.",
        code: "INVALID_SLOT_VISITOR_QUERY",
      });
    }

    const range = getDateRangeForKey(dateKey);
    if (!range) {
      return res.status(400).json({
        error: "Invalid date format. Expected YYYY-MM-DD.",
        code: "INVALID_DATE_FORMAT",
      });
    }

    const roomIds = await Room.find({ branch: branchResult.branch }).distinct("_id");
    const branchFilter =
      roomIds.length > 0
        ? { $or: [{ branch: branchResult.branch }, { roomId: { $in: roomIds } }] }
        : { branch: branchResult.branch };

    const ACTIVE_VISIT_STATUSES = reservationStatusesForQuery(
      "pending",
      "viewing_preference_selected",
      "visit_pending",
      "visit_approved",
    );

    const query = {
      ...branchFilter,
      visitDate: { $gte: range.start, $lt: range.end },
      $or: [{ visitTime: slotLabel }, { visitSlot: slotLabel }],
      status: { $in: ACTIVE_VISIT_STATUSES },
      scheduleRejected: { $ne: true },
      visitStatus: { $nin: ["rejected", "cancelled", "visit_cancelled", "no_show"] },
      isArchived: { $ne: true },
    };

    const reservations = await Reservation.find(query)
      .populate("roomId", "roomNumber name branch")
      .select(
        "_id tenantName fullName email userEmail phone userPhone visitDate visitTime visitSlot status viewingType viewingPreference createdAt roomId",
      )
      .sort({ createdAt: 1 })
      .lean();

    const visitors = reservations.map((r) => ({
      reservationId: r._id,
      tenantName: r.tenantName || r.fullName || "Applicant",
      email: r.email || r.userEmail || "",
      phone: r.phone || r.userPhone || "",
      visitDate: dateKey,
      visitSlot: r.visitTime || r.visitSlot || slotLabel,
      status: r.status || "pending",
      viewingType: r.viewingPreference || r.viewingType || "inperson",
      roomNumber: r.roomId?.roomNumber || r.roomId?.name || "N/A",
      createdAt: r.createdAt,
    }));

    return sendSuccess(res, {
      branch: branchResult.branch,
      date: dateKey,
      slot: slotLabel,
      totalBooked: visitors.length,
      visitors,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reservations/visit-availability/scheduled-users
 *
 * Returns paginated history and details of users who scheduled visits for a branch.
 * Supports filtering by status and search by name, email, phone, visit code, or room.
 */
export const getVisitScheduledUsersHistory = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();
    const searchQuery = String(req.query.search || "").trim();

    const roomIds = await Room.find({ branch: branchResult.branch }).distinct("_id");
    const branchFilter =
      roomIds.length > 0
        ? { $or: [{ branch: branchResult.branch }, { roomId: { $in: roomIds } }] }
        : { branch: branchResult.branch };

    // Base filter: reservations for this branch that have had visit scheduling activity
    const baseFilter = {
      ...branchFilter,
      isArchived: { $ne: true },
      $or: [
        { visitDate: { $exists: true, $ne: null } },
        { visitScheduledAt: { $exists: true, $ne: null } },
        {
          viewingPreference: {
            $in: [
              "physical_visit",
              "remote_2d_viewing",
              "urgent_move_in_review",
            ],
          },
        },
        { "visitHistory.0": { $exists: true } },
      ],
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const filter = { ...baseFilter };

    if (statusFilter === "upcoming") {
      filter.visitDate = { $gte: todayStart };
      filter.visitStatus = {
        $nin: ["cancelled", "visit_cancelled", "rejected", "completed", "visit_completed", "no_show"],
      };
      filter.scheduleRejected = { $ne: true };
    } else if (statusFilter === "completed") {
      filter.visitStatus = { $in: ["completed", "visit_completed"] };
    } else if (statusFilter === "cancelled") {
      filter.$or = [
        { visitStatus: { $in: ["cancelled", "visit_cancelled", "rejected"] } },
        { scheduleRejected: true },
      ];
    } else if (statusFilter === "no_show") {
      filter.visitStatus = "no_show";
    } else if (statusFilter === "pending") {
      filter.visitStatus = { $in: ["pending", "physical_visit_scheduled"] };
      filter.scheduleRejected = { $ne: true };
    }

    if (searchQuery) {
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      
      // Also find rooms matching searchQuery in roomNumber
      const matchingRooms = await Room.find({
        branch: branchResult.branch,
        roomNumber: regex,
      }).distinct("_id");

      const searchConditions = [
        { tenantName: regex },
        { fullName: regex },
        { email: regex },
        { userEmail: regex },
        { phone: regex },
        { userPhone: regex },
        { visitCode: regex },
      ];

      if (matchingRooms.length > 0) {
        searchConditions.push({ roomId: { $in: matchingRooms } });
      }

      filter.$and = filter.$and || [];
      filter.$and.push({ $or: searchConditions });
    }

    const [records, total, upcomingCount, completedCount, cancelledCount] = await Promise.all([
      Reservation.find(filter)
        .populate("roomId", "roomNumber name branch roomType")
        .select(
          "_id tenantName fullName email userEmail phone userPhone visitDate visitTime visitSlot visitCode visitStatus viewingType viewingPreference status scheduleApproved scheduleApprovedAt scheduleRejected scheduleRejectedAt scheduleRejectionReason visitOutcomeNotes visitOutcomeUpdatedAt visitOutcomeUpdatedByName visitHistory visitScheduledAt createdAt roomId branch",
        )
        .sort({ visitDate: -1, visitScheduledAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
      Reservation.countDocuments({
        ...baseFilter,
        visitDate: { $gte: todayStart },
        visitStatus: {
          $nin: ["cancelled", "visit_cancelled", "rejected", "completed", "visit_completed", "no_show"],
        },
        scheduleRejected: { $ne: true },
      }),
      Reservation.countDocuments({
        ...baseFilter,
        visitStatus: { $in: ["completed", "visit_completed"] },
      }),
      Reservation.countDocuments({
        ...baseFilter,
        $or: [
          { visitStatus: { $in: ["cancelled", "visit_cancelled", "rejected"] } },
          { scheduleRejected: true },
        ],
      }),
    ]);

    const formattedRecords = records.map((r) => {
      const visitDateFormatted = r.visitDate
        ? new Date(r.visitDate).toISOString().split("T")[0]
        : null;

      let normalizedStatus = r.visitStatus || "pending";
      if (r.scheduleRejected) {
        normalizedStatus = "rejected";
      }

      return {
        _id: r._id,
        reservationId: r._id,
        tenantName: r.tenantName || r.fullName || "Applicant",
        email: r.email || r.userEmail || "",
        phone: r.phone || r.userPhone || "",
        roomNumber: r.roomId?.roomNumber || r.roomId?.name || "N/A",
        roomType: r.roomId?.roomType || "Standard",
        branch: r.branch || r.roomId?.branch || branchResult.branch,
        viewingPreference: r.viewingPreference || r.viewingType || "physical_visit",
        visitDate: visitDateFormatted,
        visitDateRaw: r.visitDate,
        visitSlot: r.visitTime || r.visitSlot || "N/A",
        visitCode: r.visitCode || null,
        visitStatus: normalizedStatus,
        reservationStatus: r.status || "pending",
        scheduleApproved: Boolean(r.scheduleApproved),
        scheduleApprovedAt: r.scheduleApprovedAt || null,
        scheduleRejected: Boolean(r.scheduleRejected),
        scheduleRejectedAt: r.scheduleRejectedAt || null,
        scheduleRejectionReason: r.scheduleRejectionReason || "",
        visitOutcomeNotes: r.visitOutcomeNotes || "",
        visitOutcomeUpdatedAt: r.visitOutcomeUpdatedAt || null,
        visitOutcomeUpdatedByName: r.visitOutcomeUpdatedByName || "",
        visitHistory: Array.isArray(r.visitHistory) ? r.visitHistory : [],
        visitScheduledAt: r.visitScheduledAt || r.createdAt,
        createdAt: r.createdAt,
      };
    });

    return sendSuccess(res, {
      branch: branchResult.branch,
      records: formattedRecords,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: {
        totalScheduled: total,
        upcomingCount,
        completedCount,
        cancelledCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const precheckReservationDocument = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (String(reservation.userId) !== String(dbUser._id)) {
      return res.status(403).json({
        error:
          "Access denied. You can only pre-check your own reservation documents.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const documentType = normalizeDocumentPrecheckType(
      req.body.documentType || req.body.type || "valid_id_front",
    );
    if (!documentType) {
      return res.status(400).json({
        error: "Unsupported document type for document pre-check.",
        code: "INVALID_DOCUMENT_PRECHECK_TYPE",
      });
    }

    const config = DOCUMENT_PRECHECK_TYPES[documentType];
    const documentUrl =
      req.body.documentUrl || reservation[config.reservationField] || "";
    const idType =
      req.body.idType || reservation.idType || reservation.validIDType || "";

    if (!documentUrl) {
      return res.status(422).json({
        error: "Document URL is required before running the pre-check.",
        code: "DOCUMENT_URL_REQUIRED",
      });
    }
    if (!isAllowedReservationDocumentUrl(documentUrl)) {
      return res.status(400).json({
        error: "Please upload the document through the portal before running the pre-check.",
        code: "INVALID_DOCUMENT_URL",
      });
    }

    if (config.requiresIdType && !String(idType || "").trim()) {
      return res.status(422).json({
        error: "Please select the ID type before running the document pre-check.",
        code: "DOCUMENT_ID_TYPE_REQUIRED",
      });
    }

    const result = await runReservationDocumentPrecheck({
      documentType,
      documentUrl,
      idType,
    });

    reservation.set(config.reservationField, documentUrl);
    if (config.requiresIdType && String(idType || "").trim()) {
      reservation.idType = idType;
      reservation.validIDType = idType;
    }
    reservation.set(`documentPrechecks.${config.precheckField}`, result);
    await reservation.save();

    return res.json({
      documentType,
      ...result,
      message:
        result.applicantMessage ||
        result.summaryMessage ||
        "Document pre-check completed. Admin will still review the upload.",
      validationStatus: mapAiStatusToLegacyValidationStatus(result),
      warnings: result.aiCheckWarnings,
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Reservation document pre-check error",
    );
    return next(error);
  }
};

