/**
 * ============================================================================
 * RESERVATION LIFECYCLE CONTROLLER
 * ============================================================================
 *
 * Handles reservation status updates (admin and tenant self-service), move-in date extensions,
 * visit management actions, and slot releasing.
 */

import dayjs from "dayjs";
import {
  Reservation,
  Room,
  User,
  UtilityReading,
} from "../../models/index.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
  checkBranchAccess,
  syncReservationUserLifecycle,
  getMoveInBlockers,
} from "../../utils/reservationHelpers.js";
import {
  canTransitionReservationStatus,
  CURRENT_RESIDENT_STATUS_QUERY,
  hasReservationStatus,
  normalizeReservationPayload,
  normalizeReservationStatus,
  readMoveInDate,
  reservationStatusesForQuery,
  utilityEventTypesForQuery,
} from "../../utils/lifecycleNaming.js";
import { updateOccupancyOnReservationChange } from "../../utils/occupancyManager.js";
import {
  sendReservationConfirmedEmail,
  sendVisitApprovedEmail,
  sendPhysicalVisitStatusEmail,
  sendDocumentsRejectedEmail,
} from "../../config/email.js";
import { ensureCurrentCycleRentBill } from "../../utils/rentGenerator.js";
import { emitToUser, emitToAdmins } from "../../utils/socket.js";
import { validateVisitSelection } from "../../utils/visitAvailability.js";
import {
  runReservationDocumentPrecheck,
} from "../../services/reservationDocumentPrecheckService.js";
import {
  DOCUMENT_PRECHECK_TYPES,
  DOCUMENT_PRECHECK_LABELS,
  LEGACY_VISIT_STATUSES,
  MAX_APPLICATION_REVIEW_REASON_LENGTH,
  MAX_REMOTE_VIEWING_QUESTION_LENGTH,
  ROOM_SELECTION_UPDATE_FIELDS,
  CLIENT_PRICING_FIELDS,
  APPLICATION_DRAFT_LOCKING_STATUSES,
  VIEWING_PREFERENCE_LOCKED_MESSAGE,
  BED_UNAVAILABLE_MESSAGE,
  POPULATE_USER,
  POPULATE_ROOM,
  findDbUser,
  normalizeViewingPreferenceInput,
  deriveViewingPreference,
  deriveViewingType,
  isApplicantRoomSelectionLocked,
  buildReservationPricing,
  isViewingPreferenceLocked,
  buildEmptyDocumentPrecheck,
  getDocumentPrecheckStatus,
  shouldBlockDocumentSubmission,
  shouldAllowPaymentAccess,
  buildUserUpdatePayload,
  getForbiddenTenantUpdateFields,
  isVisitApplicationUnlocked,
  getEffectiveVisitStatusKey,
  isAllowedReservationDocumentUrl,
  validateDirectVisitUpdate,
  validateVisitManagementAction,
  normalizeVisitManagementNote,
  hasPhysicalVisitPreference,
  applyVisitOutcome,
  appendVisitHistoryEntry,
  buildVisitEmailContext,
  ensureRoomReservationCapacity,
  isActiveBedAssignmentDuplicateError,
  validateSelectedBedForReservation,
  combineLifecycleDateTime,
  serializeReservation,
  buildActorDisplayName,
} from "./_helpers.js";
import { cancelReservationByUser } from "./cancellationController.js";

export const updateReservation = async (req, res, next) => {
  try {
    req.body = normalizeReservationPayload(req.body);
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dedicatedSettlementFields = [
      "paymentStatus",
      "paymentDate",
      "paymongoPaymentId",
      "paymongoSessionId",
      "paymentAmount",
      "paidAmount",
      "paymentVerifiedAt",
      "paymentVerifiedBy",
      "paymentApprovedAt",
      "paymentApprovedBy",
      "proofOfPaymentUrl",
    ];
    const attemptedSettlementFields = dedicatedSettlementFields.filter(
      (field) => req.body[field] !== undefined,
    );
    if (
      attemptedSettlementFields.length > 0 ||
      hasReservationStatus(req.body.status, "reserved")
    ) {
      return res.status(422).json({
        code: "PAYMENT_SETTLEMENT_REQUIRES_DEDICATED_ENDPOINT",
        message:
          "Reservation payment confirmation must use the dedicated payment settlement workflow.",
        error:
          "Reservation payment confirmation must use the dedicated payment settlement workflow.",
        details: { fields: attemptedSettlementFields },
      });
    }

    const existingReservation = await Reservation.findById(
      reservationId,
    ).populate("roomId", "branch");
    if (!existingReservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    const oldData = existingReservation.toObject();
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      existingReservation.roomId?.branch,
    );
    if (denied) return;

    const rawApplicationReviewReason =
      req.body.applicationReviewReason ??
      req.body.documentRejectionReason ??
      req.body.notes;
    const normalizedApplicationReviewReason =
      rawApplicationReviewReason == null
        ? ""
        : String(rawApplicationReviewReason).trim();
    if (
      normalizedApplicationReviewReason &&
      normalizedApplicationReviewReason.length > MAX_APPLICATION_REVIEW_REASON_LENGTH
    ) {
      return res.status(400).json({
        error: `Review notes must be ${MAX_APPLICATION_REVIEW_REASON_LENGTH} characters or fewer.`,
        code: "APPLICATION_REVIEW_REASON_TOO_LONG",
      });
    }

    if (req.body.documentsApproved === true && req.body.status === undefined) {
      req.body.status = "approved_for_payment";
    }
    if (
      req.body.documentsApproved === false &&
      req.body.status === undefined &&
      normalizedApplicationReviewReason
    ) {
      req.body.status = "needs_revision";
    }
    if (
      req.body.applicationReviewReason === undefined &&
      normalizedApplicationReviewReason
    ) {
      req.body.applicationReviewReason = normalizedApplicationReviewReason;
    }

    const isMoveInTransition =
      req.body.status === "moveIn" &&
      !hasReservationStatus(existingReservation.status, "moveIn");

    if (
      req.body.status !== undefined &&
      !canTransitionReservationStatus(existingReservation.status, req.body.status)
    ) {
      return res.status(400).json({
        error: `Invalid reservation status transition from "${normalizeReservationStatus(existingReservation.status)}" to "${normalizeReservationStatus(req.body.status)}".`,
        code: "INVALID_RESERVATION_STATUS_TRANSITION",
      });
    }

    const directVisitValidation = validateDirectVisitUpdate(
      existingReservation,
      req.body,
    );
    if (!directVisitValidation.ok) {
      return res.status(directVisitValidation.status).json({
        error: directVisitValidation.error,
        code: directVisitValidation.code,
      });
    }

    if (req.body.visitDate || req.body.visitTime) {
      const room = await Room.findById(existingReservation.roomId).select("branch").lean();
      if (!room?.branch) {
        return res.status(400).json({
          error: "Unable to resolve room branch for visit date validation.",
          code: "ROOM_BRANCH_REQUIRED",
        });
      }

      const validation = await validateVisitSelection({
        branch: room.branch,
        visitDate: req.body.visitDate || existingReservation.visitDate,
        visitTime: req.body.visitTime || existingReservation.visitTime,
        roomId: existingReservation.roomId,
        excludeReservationId: reservationId,
      });

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          code: validation.code,
        });
      }

      if (req.body.visitDate) {
        req.body.visitDate = validation.date;
      }
    }

    if (
      req.body.status === "approved_for_payment" &&
      !hasReservationStatus(existingReservation.status, "approved_for_payment")
    ) {
      const blockedDocs = Object.entries(DOCUMENT_PRECHECK_TYPES)
        .filter(([, config]) => Boolean(existingReservation[config.reservationField]))
        .filter(([, config]) =>
          shouldBlockDocumentSubmission(
            existingReservation.documentPrechecks?.[config.precheckField],
          ),
        )
        .map(([docKey, config]) => {
          const precheck = existingReservation.documentPrechecks?.[config.precheckField] || {};
          const label = DOCUMENT_PRECHECK_LABELS[docKey] || docKey;
          return {
            key: docKey,
            label,
            precheckStatus: precheck.precheckStatus || "needs_reupload",
            readabilityStatus: precheck.readabilityStatus || "unknown",
            documentTypeStatus: precheck.documentTypeStatus || "unknown",
            message:
              precheck.applicantMessage ||
              precheck.summaryMessage ||
              `${label} needs a clearer upload before this application can be approved.`,
          };
        });

      const isPrecheckOverridden =
        req.body.adminOverridePrecheck === true ||
        req.body.overridePrecheck === true;

      if (blockedDocs.length > 0 && !isPrecheckOverridden) {
        return res.status(422).json({
          error: `Cannot approve: ${blockedDocs.length} document(s) must be re-uploaded before this application can be approved. Use "Request Revision" to notify the applicant or pass adminOverridePrecheck to bypass.`,
          code: "DOCUMENT_PRECHECK_BLOCKS_APPROVAL",
          blockedDocuments: blockedDocs,
        });
      }

      if (existingReservation.isOutOfTown && !existingReservation.isOutOfTownApproved) {
        req.body.isOutOfTownApproved = true;
      }

      req.body.applicationReviewedAt = new Date();
      req.body.applicationReviewedBy = req.adminId || null;
      req.body.approvedForPaymentAt = new Date();
      req.body.paymentExpiresAt = dayjs().add(24, "hour").toDate();
      req.body.applicationReviewReason = null;
    }

    if (
      hasReservationStatus(req.body.status, "needs_revision", "rejected")
    ) {
      if (!normalizedApplicationReviewReason) {
        return res.status(422).json({
          error: "A reason is required when requesting revision or rejecting an application.",
          code: "APPLICATION_REVIEW_REASON_REQUIRED",
        });
      }
      req.body.applicationReviewedAt = new Date();
      req.body.applicationReviewedBy = req.adminId || null;
      req.body.approvedForPaymentAt = null;
      req.body.applicationReviewReason = normalizedApplicationReviewReason;
    }

    if (isMoveInTransition) {
      const blockers = getMoveInBlockers(existingReservation);
      if (blockers.length > 0) {
        return res.status(400).json({
          error:
            "Move-in prerequisites not met. Please resolve the following before moving in the tenant.",
          code: "MOVEIN_PREREQUISITES_NOT_MET",
          missing: blockers,
        });
      }

      if (
        req.body.meterReading == null ||
        isNaN(Number(req.body.meterReading))
      ) {
        return res.status(400).json({
          error: "A meter reading (kWh) is required when moving in a tenant.",
          code: "METER_READING_REQUIRED",
        });
      }

      // Meter reading continuity check against previous room reading
      const previousReadingDoc = await UtilityReading.findOne({
        roomId: existingReservation.roomId?._id || existingReservation.roomId,
        isArchived: false,
      })
        .sort({ date: -1, createdAt: -1 })
        .lean();

      if (
        previousReadingDoc &&
        Number.isFinite(previousReadingDoc.reading) &&
        Number(req.body.meterReading) < previousReadingDoc.reading
      ) {
        return res.status(400).json({
          error: `Initial meter reading (${req.body.meterReading} kWh) cannot be lower than the room's previous reading (${previousReadingDoc.reading} kWh).`,
          code: "METER_READING_CONTINUITY_ERROR",
          previousReading: previousReadingDoc.reading,
        });
      }

      const moveInDate = combineLifecycleDateTime({
        dateInput: req.body.actualMoveInDate || req.body.confirmedMoveInDate || req.body.moveInDate || null,
        timeInput: req.body.moveInTime || null,
        fallbackDate: new Date(),
      });
      if (!moveInDate) {
        return res.status(400).json({
          error:
            "Invalid move-in date/time. Use a valid date and HH:mm format.",
          code: "INVALID_MOVEIN_DATETIME",
        });
      }

      const duplicateMoveIn = await UtilityReading.findOne({
        utilityType: "electricity",
        roomId: existingReservation.roomId?._id || existingReservation.roomId,
        tenantId: existingReservation.userId?._id || existingReservation.userId,
        eventType: { $in: utilityEventTypesForQuery("moveIn") },
        date: moveInDate,
        isArchived: false,
      })
        .select("_id")
        .lean();
      if (duplicateMoveIn) {
        return res.status(409).json({
          error:
            "A move-in reading already exists for this tenant at the same date/time. Use a different time.",
          code: "DUPLICATE_LIFECYCLE_READING",
        });
      }

      req.body.moveInDate = moveInDate;
      req.body.confirmedMoveInDate = moveInDate;
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    const ADMIN_ALLOWED = [
      "status",
      "notes",
      "moveInDate",
      "moveOutDate",
      "approvedDate",
      "reservedAt",
      "visitApproved",
      "scheduleApproved",
      "applicationReviewReason",
      "applicationReviewedAt",
      "applicationReviewedBy",
      "approvedForPaymentAt",
      "paymentExpiresAt",
      "documentsApproved",
      "documentRejectionReason",
      "nbiApproved",
      "nbiRejectionReason",
      "companyIDApproved",
      "companyIDRejectionReason",
      "scheduleRejected",
      "scheduleRejectionReason",
      "visitStatus",
    ];

    if (req.body.removeVisitHistoryIndex !== undefined) {
      const idx = Number(req.body.removeVisitHistoryIndex);
      const history = reservation.visitHistory || [];
      if (idx >= 0 && idx < history.length) {
        history.splice(idx, 1);
        reservation.visitHistory = history;
        reservation.markModified("visitHistory");
      }
    }

    if (
      req.body.scheduleRejected === true &&
      !existingReservation.scheduleRejected
    ) {
      reservation.scheduleRejectedAt = new Date();
      reservation.scheduleRejectedBy = req.adminId || null;
      reservation.visitApproved = false;
      if (hasReservationStatus(existingReservation.status, LEGACY_VISIT_STATUSES, "pending")) {
        reservation.status = "visit_pending";
      }

      if (existingReservation.visitDate) {
        if (!reservation.visitHistory) reservation.visitHistory = [];
        const attemptNumber = reservation.visitHistory.length + 1;
        reservation.visitHistory.push({
          visitDate: existingReservation.visitDate,
          visitTime: existingReservation.visitTime,
          viewingType: existingReservation.viewingType || "inperson",
          status: "rejected",
          rejectionReason: req.body.scheduleRejectionReason || "",
          scheduledAt:
            existingReservation.visitScheduledAt ||
            existingReservation.createdAt,
          rejectedAt: new Date(),
          rejectedBy: req.adminId || null,
          attemptNumber,
        });
      }
    }

    if (req.body.visitApproved === true && !existingReservation.visitApproved) {
      if (hasReservationStatus(existingReservation.status, LEGACY_VISIT_STATUSES, "pending")) {
        reservation.status = "visit_approved";
      }
      if (hasPhysicalVisitPreference(existingReservation)) {
        reservation.scheduleApproved = true;
        reservation.visitStatus = "visit_completed";
      }
      reservation.scheduleApprovedAt = new Date();

      if (existingReservation.visitDate) {
        if (!reservation.visitHistory) reservation.visitHistory = [];
        const attemptNumber = reservation.visitHistory.length + 1;
        reservation.visitHistory.push({
          visitDate: existingReservation.visitDate,
          visitTime: existingReservation.visitTime,
          viewingType: existingReservation.viewingType || "inperson",
          status: "approved",
          scheduledAt:
            existingReservation.visitScheduledAt ||
            existingReservation.createdAt,
          approvedAt: new Date(),
          attemptNumber,
        });
      }
    }

    for (const key of ADMIN_ALLOWED) {
      if (req.body[key] !== undefined) reservation[key] = req.body[key];
    }
    // Existing Reservations may contain legacy values on unrelated fields.
    // Application review must validate the fields changed by this action without
    // allowing stale, untouched data to turn a valid approval into an HTTP 500.
    const updatedReservation = await reservation.save({
      validateModifiedOnly: true,
    });

    if (
      req.body.status === "moveIn" &&
      !hasReservationStatus(oldData.status, "moveIn") &&
      req.body.meterReading != null &&
      !isNaN(Number(req.body.meterReading))
    ) {
      try {
        const roomId =
          updatedReservation.roomId?._id || updatedReservation.roomId;
        const roomDoc = await Room.findById(roomId).lean();
        const adminUser = await User.findOne({
          firebaseUid: req.user.uid,
        }).lean();
        const recordedBy = req.adminId || adminUser?._id;
        const meterValue = Number(req.body.meterReading);
        const moveInDate = new Date(
          readMoveInDate(updatedReservation) || new Date(),
        );

        if (roomDoc && recordedBy) {
          const tenantUserId =
            updatedReservation.userId?._id || updatedReservation.userId;

          const checkedInRes = await Reservation.find({
            roomId: roomId,
            status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
            isArchived: { $ne: true },
          })
            .select("userId")
            .lean();
          const activeTenantIds = checkedInRes
            .map((r) => r.userId)
            .filter(Boolean);

          const moveInReading = new UtilityReading({
            roomId: roomId,
            branch: roomDoc.branch,
            utilityType: "electricity",
            reading: meterValue,
            previousReading: meterValue,
            consumption: 0,
            date: moveInDate,
            eventType: "move_in",
            tenantId: tenantUserId,
            activeTenantIdsAtReading: activeTenantIds,
            activeTenantCount: activeTenantIds.length || 1,
            splitRatio: 1,
            isCalculated: true,
            isBilled: false,
            notes: `Initial move-in meter reading for ${updatedReservation.reservationCode || "tenant"}`,
            recordedBy: recordedBy,
          });

          await moveInReading.save();
          logger.info(
            {
              readingId: moveInReading._id,
              roomId: roomId,
              tenantId: tenantUserId,
              meterValue,
            },
            "Recorded move-in utility reading during status transition to moveIn",
          );
        }
      } catch (readingErr) {
        logger.error(
          { err: readingErr, requestId: req.id },
          "Failed to auto-record move-in utility reading during status update (non-fatal)",
        );
      }
    }

    if (req.body.status !== undefined && req.body.status !== oldData.status) {
      await syncReservationUserLifecycle({
        status: req.body.status,
        previousStatus: oldData.status,
        userId: updatedReservation.userId,
        roomId: updatedReservation.roomId,
        reservationId: updatedReservation._id,
      });

      if (req.body.status === "moveIn") {
        try {
          const tenantId =
            updatedReservation.userId?._id || updatedReservation.userId;
          const rentBillResult = await ensureCurrentCycleRentBill({
            reservation: updatedReservation,
            tenantId,
            actorId: req.adminId || null,
          });

          if (rentBillResult?.bill) {
            logger.info(
              {
                billId: rentBillResult.bill._id,
                created: rentBillResult.created,
                reservationId: updatedReservation._id,
              },
              "Ensured current cycle rent bill during moveIn status update",
            );
          }
        } catch (rentErr) {
          logger.error(
            { err: rentErr, requestId: req.id },
            "Failed to ensure rent bill during moveIn (non-fatal)",
          );
        }
      }
    }

    try {
      await updateOccupancyOnReservationChange(updatedReservation, oldData);
    } catch (occupancyErr) {
      logger.warn(
        { err: occupancyErr, requestId: req.id },
        "Occupancy update during status update failed",
      );
    }

    await updatedReservation.populate(...POPULATE_USER);
    await updatedReservation.populate(...POPULATE_ROOM);

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      updatedReservation.toObject(),
      `Admin updated reservation status to ${updatedReservation.status}`,
    );

    if (
      req.body.visitApproved === true &&
      !oldData.visitApproved &&
      updatedReservation.userId?.email
    ) {
      try {
        await sendVisitApprovedEmail({
          to: updatedReservation.userId.email,
          tenantName: `${updatedReservation.userId.firstName || ""} ${updatedReservation.userId.lastName || ""}`.trim(),
          roomName: updatedReservation.roomId?.name || "your room",
          visitDate: updatedReservation.visitDate,
          visitTime: updatedReservation.visitTime,
        });
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Visit approved email failed",
        );
      }
    }

    if (
      req.body.documentsApproved === false &&
      oldData.documentsApproved !== false &&
      updatedReservation.userId?.email
    ) {
      try {
        await sendDocumentsRejectedEmail({
          to: updatedReservation.userId.email,
          tenantName: `${updatedReservation.userId.firstName || ""} ${updatedReservation.userId.lastName || ""}`.trim(),
          rejectionReason:
            updatedReservation.applicationReviewReason ||
            updatedReservation.documentRejectionReason ||
            "Please review your uploaded documents and resubmit.",
        });
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Documents rejected email failed",
        );
      }
    }

    if (
      req.body.status === "reserved" &&
      !hasReservationStatus(oldData.status, "reserved") &&
      updatedReservation.userId?.email
    ) {
      try {
        await sendReservationConfirmedEmail({
          to: updatedReservation.userId.email,
          tenantName: `${updatedReservation.userId.firstName || ""} ${updatedReservation.userId.lastName || ""}`.trim(),
          reservationCode: updatedReservation.reservationCode,
          roomName: updatedReservation.roomId?.name || "your room",
          moveInDate: updatedReservation.moveInDate,
          totalPrice: updatedReservation.totalPrice,
        });
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Reservation confirmed email failed",
        );
      }
    }

    res.json({
      message: "Reservation updated successfully",
      reservation: serializeReservation(updatedReservation),
    });

    try {
      const recipientUserId = updatedReservation.userId?._id;
      if (recipientUserId) {
        const socketPayload = {
          reservationId: String(updatedReservation._id),
          status: updatedReservation.status,
          paymentStatus: updatedReservation.paymentStatus,
        };
        emitToUser(recipientUserId, "reservation:updated", socketPayload);
        emitToAdmins("reservation:updated", socketPayload);
      }
    } catch (socketErr) {
      logger.warn(
        { err: socketErr, requestId: req.id },
        "Socket emit failed after admin reservation update (non-fatal)",
      );
    }
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Update reservation error");
    try {
      await auditLogger.logError(req, error, "Failed to update reservation");
    } catch (auditError) {
      logger.error(
        { err: auditError, requestId: req.id },
        "Failed to record Reservation update error audit",
      );
    }
    return handleReservationError(res, error, "update");
  }
};

export const updateReservationByUser = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    if (String(reservation.userId) !== String(dbUser._id))
      return res.status(403).json({
        error: "Access denied. You can only update your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });

    const forbiddenFields = getForbiddenTenantUpdateFields(req.body);
    if (forbiddenFields.length > 0) {
      return res.status(400).json({
        error: `Tenant updates cannot set protected reservation fields: ${forbiddenFields.join(", ")}.`,
        code: "TENANT_FIELD_NOT_ALLOWED",
        fields: forbiddenFields,
      });
    }

    const updates = buildUserUpdatePayload(req.body);
    const unsetFields = {};
    let appliedPricing = null;
    let roomAvailabilityWasRevalidated = false;
    const hasBodyField = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
    const applicationDraftSaveRequested =
      req.body.applicationDraftAutosave === true;

    if (applicationDraftSaveRequested) {
      if (req.body.submitApplication === true) {
        return res.status(400).json({
          error: "Draft auto-save cannot submit an application.",
          code: "APPLICATION_DRAFT_SUBMIT_NOT_ALLOWED",
        });
      }

      const currentStatus = normalizeReservationStatus(reservation.status);
      const draftLocked =
        hasReservationStatus(currentStatus, APPLICATION_DRAFT_LOCKING_STATUSES) ||
        (Boolean(reservation.applicationSubmittedAt) &&
          !hasReservationStatus(currentStatus, "needs_revision")) ||
        Boolean(reservation.paymentDate || reservation.proofOfPaymentUrl);

      if (draftLocked) {
        return res.status(409).json({
          error:
            "Application draft is locked because this application is already submitted or under review.",
          code: "APPLICATION_DRAFT_LOCKED",
        });
      }
    }

    // Deprecation guard: application submission and payment upload must go through dedicated endpoints in production.
    if (process.env.NODE_ENV !== "test") {
      if (req.body.submitApplication === true) {
        return res.status(400).json({
          error:
            "Application submission must use POST /reservations/:id/application/submit.",
          code: "USE_DEDICATED_SUBMIT_ENDPOINT",
        });
      }

      if (req.body.proofOfPaymentUrl) {
        return res.status(400).json({
          error:
            "Proof of payment upload must use POST /reservations/:id/payment.",
          code: "USE_DEDICATED_PAYMENT_ENDPOINT",
        });
      }
    }

    if (req.body.cancelReservation === true) {
      req.params.reservationId = reservationId;
      return cancelReservationByUser(req, res, next);
    }

    const roomSelectionUpdateRequested = ROOM_SELECTION_UPDATE_FIELDS.some(
      (field) => hasBodyField(field),
    );
    if (
      roomSelectionUpdateRequested &&
      isApplicantRoomSelectionLocked(reservation)
    ) {
      return res.status(423).json({
        error: "Room selection is locked while your reservation is under review.",
        code: "RESERVATION_ROOM_SELECTION_LOCKED",
      });
    }

    const requestedRoomId = updates.roomId || reservation.roomId;
    const shouldRevalidateBedSelection =
      req.body.roomId !== undefined ||
      req.body.selectedBed !== undefined ||
      req.body.selectedAppliances !== undefined ||
      req.body.leaseDuration !== undefined ||
      CLIENT_PRICING_FIELDS.some((field) => req.body[field] !== undefined);

    if (shouldRevalidateBedSelection) {
      const room = await Room.findById(requestedRoomId);
      if (!room) {
        return res.status(404).json({
          error: "Room not found",
          code: "ROOM_NOT_FOUND",
        });
      }
      if (room.isArchived) {
        return res.status(400).json({
          error: "Room is not available for reservation",
          code: "ROOM_NOT_AVAILABLE",
        });
      }

      const activeReservationCount = await ensureRoomReservationCapacity({
        roomId: room._id,
        excludeReservationId: reservationId,
      });
      if (activeReservationCount >= room.capacity) {
        return res.status(400).json({
          error: "Room is fully booked. Please choose a different room.",
          code: "ROOM_UNAVAILABLE",
        });
      }

      try {
        const submittedBed =
          req.body.selectedBed !== undefined
            ? req.body.selectedBed
            : reservation.selectedBed;
        updates.selectedBed = await validateSelectedBedForReservation({
          room,
          submittedBed,
          excludeReservationId: reservationId,
        });
        roomAvailabilityWasRevalidated = true;
      } catch (error) {
        if (error?.code === "BED_SELECTION_REQUIRED") {
          return res.status(400).json({
            error: error.message,
            code: error.code,
          });
        }
        if (error?.code === "BED_NOT_FOUND" || error?.code === "BED_UNAVAILABLE") {
          return res.status(409).json({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }

      appliedPricing = await buildReservationPricing({
        room,
        leaseDuration: updates.leaseDuration ?? reservation.leaseDuration,
        selectedAppliances:
          req.body.selectedAppliances !== undefined
            ? req.body.selectedAppliances
            : reservation.selectedAppliances,
      });
      updates.roomId = room._id;
      updates.monthlyRent = appliedPricing.monthlyRent;
      updates.selectedAppliances = appliedPricing.selectedAppliances;
      updates.applianceFees = appliedPricing.applianceFees;
      updates.totalPrice = appliedPricing.totalPrice;
      updates.reservationFeeAmount = appliedPricing.reservationFeeAmount;
    }

    const rawViewingPreference = hasBodyField("viewingPreference")
      ? req.body.viewingPreference
      : hasBodyField("viewingType")
        ? req.body.viewingType
        : undefined;
    let normalizedViewingPreference = null;

    if (rawViewingPreference !== undefined) {
      normalizedViewingPreference = normalizeViewingPreferenceInput(rawViewingPreference);
      if (!normalizedViewingPreference) {
        return res.status(400).json({
          error:
            "Invalid viewing preference. Please choose Physical Visit, 2D Remote Viewing, or Urgent Move-in Review.",
          code: "INVALID_VIEWING_PREFERENCE",
        });
      }
      updates.viewingPreference = normalizedViewingPreference;
      updates.viewingType = deriveViewingType(normalizedViewingPreference);
    }

    const requestedPreferenceSignals = new Set();
    if (normalizedViewingPreference) {
      requestedPreferenceSignals.add(normalizedViewingPreference);
    }
    if (
      (hasBodyField("visitDate") && req.body.visitDate) ||
      (hasBodyField("visitTime") && req.body.visitTime)
    ) {
      requestedPreferenceSignals.add("physical_visit");
    }
    if (
      (hasBodyField("remoteViewingAcknowledged") &&
        req.body.remoteViewingAcknowledged === true) ||
      (hasBodyField("remoteViewingQuestions") &&
        String(req.body.remoteViewingQuestions || "").trim())
    ) {
      requestedPreferenceSignals.add("remote_2d_viewing");
    }
    if (hasBodyField("isUrgentMoveIn") && req.body.isUrgentMoveIn === true) {
      requestedPreferenceSignals.add("urgent_move_in_review");
    }

    if (requestedPreferenceSignals.size > 1) {
      return res.status(400).json({
        error:
          "Only one viewing preference can be active for a reservation. Please choose Physical Visit, 2D Remote Viewing, or Urgent Move-in Review.",
        code: "CONFLICTING_VIEWING_PREFERENCE_PAYLOAD",
      });
    }

    if (hasBodyField("remoteViewingQuestions")) {
      const normalizedQuestions =
        typeof req.body.remoteViewingQuestions === "string"
          ? req.body.remoteViewingQuestions.trim()
          : "";
      if (normalizedQuestions.length > MAX_REMOTE_VIEWING_QUESTION_LENGTH) {
        return res.status(400).json({
          error: `Remote viewing questions must be ${MAX_REMOTE_VIEWING_QUESTION_LENGTH} characters or fewer.`,
          code: "REMOTE_VIEWING_QUESTIONS_TOO_LONG",
        });
      }
      updates.remoteViewingQuestions = normalizedQuestions;
    }

    if (hasBodyField("visitTime") && req.body.visitTime == null) {
      updates.visitTime = "";
    }

    const effectiveViewingPreference = deriveViewingPreference(reservation, updates);
    const preferenceRelatedUpdate =
      rawViewingPreference !== undefined ||
      hasBodyField("visitDate") ||
      hasBodyField("visitTime") ||
      hasBodyField("remoteViewingAcknowledged") ||
      hasBodyField("remoteViewingQuestions") ||
      hasBodyField("isUrgentMoveIn");

    if (
      preferenceRelatedUpdate &&
      isViewingPreferenceLocked(
        reservation,
        normalizedViewingPreference || effectiveViewingPreference,
      )
    ) {
      return res.status(409).json({
        error: VIEWING_PREFERENCE_LOCKED_MESSAGE,
        code: "VIEWING_PREFERENCE_LOCKED",
      });
    }

    if (effectiveViewingPreference) {
      updates.viewingPreference = effectiveViewingPreference;
      updates.viewingType = deriveViewingType(effectiveViewingPreference);
    }

    if (effectiveViewingPreference === "urgent_move_in_review") {
      updates.isUrgentMoveIn = true;
    } else if (preferenceRelatedUpdate || hasBodyField("isUrgentMoveIn")) {
      updates.isUrgentMoveIn = false;
    }

    if (
      effectiveViewingPreference !== "remote_2d_viewing" &&
      (rawViewingPreference !== undefined || hasBodyField("remoteViewingAcknowledged"))
    ) {
      updates.remoteViewingAcknowledged = false;
    }

    if (
      effectiveViewingPreference !== "remote_2d_viewing" &&
      rawViewingPreference !== undefined &&
      !hasBodyField("remoteViewingQuestions")
    ) {
      updates.remoteViewingQuestions = "";
    }

    const effectiveRemoteViewingAcknowledged =
      updates.remoteViewingAcknowledged ?? reservation.remoteViewingAcknowledged;
    const effectiveVisitDate = updates.visitDate ?? reservation.visitDate;
    const effectiveVisitTime = updates.visitTime ?? reservation.visitTime;
    const resetDocumentPrecheck = (bodyField, precheckField) => {
      if (!hasBodyField(bodyField)) return;
      const nextUrl = updates[bodyField] ?? req.body[bodyField] ?? "";
      const currentUrl = reservation[bodyField] ?? "";
      if (String(nextUrl || "") === String(currentUrl || "")) return;
      updates[`documentPrechecks.${precheckField}`] = buildEmptyDocumentPrecheck();
    };

    resetDocumentPrecheck("validIDFrontUrl", "validIDFront");
    resetDocumentPrecheck("validIDBackUrl", "validIDBack");
    resetDocumentPrecheck("nbiClearanceUrl", "nbiClearance");
    resetDocumentPrecheck("companyIDUrl", "companyID");

    if (
      effectiveViewingPreference === "physical_visit" &&
      (rawViewingPreference !== undefined || hasBodyField("visitDate") || hasBodyField("visitTime"))
    ) {
      if (!effectiveVisitDate || !effectiveVisitTime) {
        return res.status(422).json({
          error:
            "Preferred visit date and time slot are required when scheduling a physical visit.",
          code: "PHYSICAL_VISIT_DETAILS_REQUIRED",
        });
      }
    }

    if (
      effectiveViewingPreference === "remote_2d_viewing" &&
      (rawViewingPreference !== undefined ||
        hasBodyField("remoteViewingAcknowledged") ||
        hasBodyField("remoteViewingQuestions"))
    ) {
      if (effectiveRemoteViewingAcknowledged !== true) {
        return res.status(422).json({
          error:
            "Please confirm the photo-based 2D remote viewing acknowledgement before continuing.",
          code: "REMOTE_VIEWING_ACKNOWLEDGEMENT_REQUIRED",
        });
      }
    }

    if (
      rawViewingPreference !== undefined &&
      effectiveViewingPreference !== "physical_visit"
    ) {
      updates.visitDate = null;
      updates.visitTime = "";
      delete updates.visitCode;
      unsetFields.visitCode = "";
      updates.visitScheduledAt = null;
      updates.visitApproved = false;
      updates.scheduleApproved = false;
      updates.scheduleApprovedAt = null;
      updates.scheduleRejected = false;
      updates.scheduleRejectedAt = null;
      updates.scheduleRejectedBy = null;
      updates.scheduleRejectionReason = null;
      updates.visitStatus = null;
      updates.visitOutcomeNotes = "";
      updates.visitOutcomeUpdatedAt = null;
      updates.visitOutcomeUpdatedBy = null;
      updates.visitOutcomeUpdatedByName = "";
    }

    if (effectiveViewingPreference === "physical_visit" && updates.visitDate) {
      const existingForCode = await Reservation.findById(reservationId)
        .select("visitCode visitScheduledAt")
        .lean();
      if (!existingForCode?.visitCode) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let visitCode = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          let code = "VIS-";
          for (let i = 0; i < 6; i++)
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          const taken = await Reservation.findOne({ visitCode: code })
            .select("_id")
            .lean();
          if (!taken) {
            visitCode = code;
            break;
          }
        }
        updates.visitCode =
          visitCode || "VIS-" + Date.now().toString(36).toUpperCase().slice(-6);
      }
      updates.visitScheduledAt = new Date();
      updates.scheduleApproved = true;
      updates.scheduleApprovedAt = new Date();
      updates.visitStatus = "schedule_approved";
      updates.visitOutcomeNotes = "";
      updates.visitOutcomeUpdatedAt = null;
      updates.visitOutcomeUpdatedBy = null;
      updates.visitOutcomeUpdatedByName = "";
    }

    if (
      effectiveViewingPreference === "physical_visit" &&
      (updates.visitDate || updates.visitTime)
    ) {
      const targetVisitDate = updates.visitDate || reservation.visitDate;
      const targetVisitTime = updates.visitTime || reservation.visitTime;
      const room = await Room.findById(reservation.roomId).select("branch").lean();
      if (!room?.branch) {
        return res.status(400).json({
          error: "Unable to resolve the room branch for this visit.",
          code: "ROOM_BRANCH_REQUIRED",
        });
      }

      const validation = await validateVisitSelection({
        branch: room.branch,
        visitDate: targetVisitDate,
        visitTime: targetVisitTime,
        roomId: reservation.roomId,
        excludeReservationId: reservationId,
      });

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          code: validation.code,
        });
      }

      if (updates.visitDate) {
        updates.visitDate = validation.date;
      }
    }

    if (effectiveViewingPreference === "physical_visit" && updates.visitDate) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (new Date(updates.visitDate) < todayStart) {
        return res.status(400).json({
          error: "Visit date cannot be in the past. Please select a future date.",
          code: "VISIT_DATE_IN_PAST",
        });
      }
    }

    if (effectiveViewingPreference === "physical_visit" && updates.visitDate) {
      const targetVisitTime = updates.visitTime || reservation.visitTime;

      const conflicting = await Reservation.findOne({
        _id: { $ne: reservationId },
        roomId: reservation.roomId,
        visitDate: updates.visitDate,
        visitTime: targetVisitTime,
        status: {
          $in: reservationStatusesForQuery("visit_pending", "visit_approved"),
        },
        isArchived: { $ne: true },
      })
        .select("_id visitDate visitTime")
        .lean();

      if (conflicting) {
        return res.status(409).json({
          error:
            "This time slot is already taken. Please choose a different date or time.",
          code: "VISIT_SLOT_CONFLICT",
          conflict: {
            visitDate: conflicting.visitDate,
            visitTime: conflicting.visitTime,
          },
        });
      }
    }

    if (
      effectiveViewingPreference === "physical_visit" &&
      updates.visitDate &&
      updates.agreedToPrivacy &&
      reservation.scheduleRejected
    ) {
      updates.scheduleRejected = false;
      updates.scheduleRejectionReason = null;
      updates.scheduleRejectedAt = null;
      if (hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES, "pending")) {
        updates.status = "visit_pending";
      }
    }

    const effectiveAgreedToPrivacy =
      updates.agreedToPrivacy ?? reservation.agreedToPrivacy;
    const submittedPhysicalVisitSchedule =
      effectiveViewingPreference === "physical_visit" &&
      preferenceRelatedUpdate &&
      Boolean(effectiveVisitDate && effectiveVisitTime) &&
      effectiveAgreedToPrivacy === true;

    if (
      submittedPhysicalVisitSchedule &&
      hasReservationStatus(
        reservation.status,
        "pending",
        "viewing_preference_selected",
        LEGACY_VISIT_STATUSES,
      )
    ) {
      updates.status = "visit_approved";
    } else if (
      effectiveViewingPreference &&
      preferenceRelatedUpdate &&
      hasReservationStatus(reservation.status, "pending")
    ) {
      updates.status = "viewing_preference_selected";
    }
    if (
      effectiveViewingPreference === "physical_visit" &&
      updates.visitDate &&
      updates.agreedToPrivacy &&
      hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES)
    ) {
      updates.status = "visit_approved";
    }

    const isApplicationSubmission = req.body.submitApplication === true;

    if (isApplicationSubmission) {
      const previouslySubmittedApplication = Boolean(reservation.applicationSubmittedAt);
      const effectiveVisitStatus = getEffectiveVisitStatusKey({
        visitStatus: updates.visitStatus ?? reservation.visitStatus,
        visitApproved: reservation.visitApproved,
        scheduleRejected: reservation.scheduleRejected,
        scheduleApproved: reservation.scheduleApproved,
        viewingPreference: reservation.viewingPreference,
        viewingType: reservation.viewingType,
        visitDate: reservation.visitDate,
      });

      if (
        effectiveViewingPreference === "physical_visit" &&
        !previouslySubmittedApplication &&
        !isVisitApplicationUnlocked(effectiveVisitStatus)
      ) {
        return res.status(403).json({
          error:
            "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
          code: "PHYSICAL_VISIT_APPLICATION_LOCKED",
          visitStatus: effectiveVisitStatus || "physical_visit_scheduled",
        });
      }

      const effectiveValidIDFrontUrl =
        updates.validIDFrontUrl ?? reservation.validIDFrontUrl ?? "";
      const effectiveValidIDBackUrl =
        updates.validIDBackUrl ?? reservation.validIDBackUrl ?? "";
      const effectiveNbiUrl = updates.nbiClearanceUrl ?? reservation.nbiClearanceUrl ?? "";
      const effectiveCompanyUrl = updates.companyIDUrl ?? reservation.companyIDUrl ?? "";
      const submittedIdType =
        updates.idType ?? updates.validIDType ?? reservation.idType ?? reservation.validIDType ?? "";

      const documentUrlFields = [
        { key: "selfiePhotoUrl", label: "profile photo", url: updates.selfiePhotoUrl ?? reservation.selfiePhotoUrl },
        { key: "validIDFrontUrl", label: "valid ID (front)", url: effectiveValidIDFrontUrl },
        { key: "validIDBackUrl", label: "valid ID (back)", url: effectiveValidIDBackUrl },
        { key: "nbiClearanceUrl", label: "NBI clearance", url: effectiveNbiUrl },
        { key: "companyIDUrl", label: "company ID", url: effectiveCompanyUrl },
      ];
      const invalidUrls = documentUrlFields
        .filter((item) => item.url && !isAllowedReservationDocumentUrl(item.url))
        .map((item) => ({ key: item.key, label: item.label, message: `${item.label} has an invalid document URL.` }));

      if (invalidUrls.length > 0) {
        return res.status(422).json({
          error: `Please upload valid documents before submitting: ${invalidUrls.map((i) => i.label).join(", ")}.`,
          code: "INVALID_DOCUMENT_URLS",
          documentIssues: invalidUrls,
        });
      }

      const missingRequired = [];
      const hasVal = (v) => v != null && String(v).trim().length > 0;
      const isValidPHPhone = (v) => v != null && /^09\d{9}$/.test(String(v));

      const effectiveFirstName = updates.firstName ?? reservation.firstName;
      const effectiveLastName = updates.lastName ?? reservation.lastName;
      const effectiveMobileNumber = updates.mobileNumber ?? reservation.mobileNumber;
      const effectiveBirthday = updates.birthday ?? reservation.birthday;
      const effectiveMaritalStatus = updates.maritalStatus ?? reservation.maritalStatus;
      const effectiveNationality = updates.nationality ?? reservation.nationality;
      const effectiveEducationLevel = updates.educationLevel ?? reservation.educationLevel;
      const effectiveAddressUnit = updates["address.unitHouseNo"] ?? reservation.address?.unitHouseNo;
      const effectiveAddressStreet = updates["address.street"] ?? reservation.address?.street;
      const effectiveAddressRegion = updates["address.region"] ?? reservation.address?.region;
      const effectiveAddressProvince = updates["address.province"] ?? reservation.address?.province;
      const effectiveAddressCity = updates["address.city"] ?? reservation.address?.city;
      const effectiveAddressBarangay = updates["address.barangay"] ?? reservation.address?.barangay;
      const effectiveEmergencyName = updates["emergencyContact.name"] ?? reservation.emergencyContact?.name;
      const effectiveEmergencyRelationship = updates["emergencyContact.relationship"] ?? reservation.emergencyContact?.relationship;
      const effectiveEmergencyPhone = updates["emergencyContact.contactNumber"] ?? reservation.emergencyContact?.contactNumber;
      const effectiveHealthConcerns = updates.healthConcerns ?? reservation.healthConcerns;
      const effectiveEmployerSchool = updates["employment.employerSchool"] ?? reservation.employment?.employerSchool;
      const effectiveEmployerAddress = updates["employment.employerAddress"] ?? reservation.employment?.employerAddress;
      const effectiveOccupation = updates["employment.occupation"] ?? reservation.employment?.occupation;
      const effectiveReferralSource = updates.referralSource ?? reservation.referralSource;
      const effectiveTargetMoveInDate = updates.targetMoveInDate ?? reservation.targetMoveInDate;
      const effectiveEstimatedMoveInTime = updates.estimatedMoveInTime ?? reservation.estimatedMoveInTime;
      const effectiveLeaseDuration = updates.leaseDuration ?? reservation.leaseDuration;
      const effectiveWorkSchedule = updates.workSchedule ?? reservation.workSchedule;
      const effectiveWorkScheduleOther = updates.workScheduleOther ?? reservation.workScheduleOther;
      const submittedPrivacyAgreement = hasBodyField("agreedToPrivacy") && req.body.agreedToPrivacy === true;
      const submittedCertificationAgreement = hasBodyField("agreedToCertification") && req.body.agreedToCertification === true;

      if (!hasVal(effectiveViewingPreference)) missingRequired.push("viewing / move-in preference");
      if (!hasVal(effectiveFirstName)) missingRequired.push("first name");
      if (!hasVal(effectiveLastName)) missingRequired.push("last name");
      if (!isValidPHPhone(effectiveMobileNumber)) missingRequired.push("mobile number");
      if (!hasVal(effectiveBirthday)) missingRequired.push("birthday (applicant must be at least 18)");
      if (!hasVal(effectiveMaritalStatus)) missingRequired.push("marital status");
      if (!hasVal(effectiveNationality)) missingRequired.push("nationality");
      if (!hasVal(effectiveEducationLevel)) missingRequired.push("educational attainment");
      if (!hasVal(effectiveAddressUnit)) missingRequired.push("unit / house no.");
      if (!hasVal(effectiveAddressStreet)) missingRequired.push("street");
      if (!hasVal(effectiveAddressRegion)) missingRequired.push("region");
      if (!hasVal(effectiveAddressProvince)) missingRequired.push("province");
      if (!hasVal(effectiveAddressCity)) missingRequired.push("city / municipality");
      if (!hasVal(effectiveAddressBarangay)) missingRequired.push("barangay");
      if (!hasVal(updates.selfiePhotoUrl || reservation.selfiePhotoUrl)) missingRequired.push("profile photo");
      if (!hasVal(effectiveEmergencyName)) missingRequired.push("emergency contact name");
      if (!hasVal(effectiveEmergencyRelationship)) missingRequired.push("emergency contact relationship");
      if (!isValidPHPhone(effectiveEmergencyPhone)) missingRequired.push("emergency contact phone");
      if (!hasVal(effectiveHealthConcerns)) missingRequired.push("health concerns");
      if (!hasVal(effectiveEmployerSchool)) missingRequired.push("current employer / school");
      if (!hasVal(effectiveEmployerAddress)) missingRequired.push("employer address");
      if (!hasVal(effectiveOccupation)) missingRequired.push("occupation");
      if (!hasVal(effectiveReferralSource)) missingRequired.push("referral source");
      if (!hasVal(effectiveTargetMoveInDate)) missingRequired.push("target move-in date");
      if (!hasVal(effectiveEstimatedMoveInTime)) missingRequired.push("estimated move-in time");
      if (!Number.isFinite(Number(effectiveLeaseDuration)) || Number(effectiveLeaseDuration) <= 0) missingRequired.push("duration of lease");
      if (!hasVal(effectiveWorkSchedule)) missingRequired.push("work schedule");
      if (effectiveWorkSchedule === "others" && !hasVal(effectiveWorkScheduleOther)) missingRequired.push("work schedule details");
      if (!effectiveValidIDFrontUrl) missingRequired.push("valid ID (front)");
      if (!effectiveValidIDBackUrl) missingRequired.push("valid ID (back)");
      if (!submittedIdType) missingRequired.push("valid ID type");
      if (!submittedPrivacyAgreement) missingRequired.push("privacy policy agreement");
      if (!submittedCertificationAgreement) missingRequired.push("certification agreement");

      if (missingRequired.length > 0) {
        return res.status(422).json({
          error: `Application incomplete. Missing required fields: ${missingRequired.join(", ")}.`,
          code: "APPLICATION_INCOMPLETE",
          missingFields: missingRequired,
        });
      }

      if (!roomAvailabilityWasRevalidated) {
        const submissionRoomId = updates.roomId || reservation.roomId?._id || reservation.roomId;
        const room = await Room.findById(submissionRoomId);
        if (!room) {
          return res.status(404).json({
            error: "Room not found",
            code: "ROOM_NOT_FOUND",
          });
        }
        if (room.isArchived) {
          return res.status(400).json({
            error: "Room is not available for reservation",
            code: "ROOM_NOT_AVAILABLE",
          });
        }

        const activeReservationCount = await ensureRoomReservationCapacity({
          roomId: room._id,
          excludeReservationId: reservationId,
        });
        if (activeReservationCount >= room.capacity) {
          return res.status(400).json({
            error: "Room is fully booked. Please choose a different room.",
            code: "ROOM_UNAVAILABLE",
          });
        }

        const submittedBed =
          updates.selectedBed !== undefined ? updates.selectedBed : reservation.selectedBed;
        try {
          updates.selectedBed = await validateSelectedBedForReservation({
            room,
            submittedBed,
            excludeReservationId: reservationId,
          });
        } catch (error) {
          if (error?.code === "BED_SELECTION_REQUIRED") {
            return res.status(400).json({ error: error.message, code: error.code });
          }
          if (error?.code === "BED_NOT_FOUND" || error?.code === "BED_UNAVAILABLE") {
            return res.status(409).json({ error: error.message, code: error.code });
          }
          throw error;
        }
      }

      const runRequiredDocumentPrecheck = async ({
        key,
        documentType,
        documentUrl,
        idType,
      }) => {
        const config = DOCUMENT_PRECHECK_TYPES[documentType];
        const nextUrl = String(documentUrl || "").trim();
        const previousUrl = String(reservation[config.reservationField] || "").trim();
        const urlChanged = nextUrl !== previousUrl;

        let precheck =
          updates[`documentPrechecks.${config.precheckField}`] ||
          reservation.documentPrechecks?.[config.precheckField] ||
          buildEmptyDocumentPrecheck();
        const status = getDocumentPrecheckStatus(precheck);
        const urlAllowed = isAllowedReservationDocumentUrl(nextUrl);

        if (
          !urlAllowed ||
          urlChanged ||
          status === "not_checked" ||
          status === "checking"
        ) {
          precheck = await runReservationDocumentPrecheck({
            documentType,
            documentUrl: nextUrl,
            idType,
          });
          updates[`documentPrechecks.${config.precheckField}`] = precheck;
        }

        return precheck;
      };

      const requiredDocumentPrechecks = [
        {
          key: "validIDFront",
          label: "Valid ID (Front)",
          documentType: "valid_id_front",
          documentUrl: effectiveValidIDFrontUrl,
          idType: submittedIdType,
        },
        {
          key: "validIDBack",
          label: "Valid ID (Back)",
          documentType: "valid_id_back",
          documentUrl: effectiveValidIDBackUrl,
          idType: submittedIdType,
        },
        effectiveNbiUrl
          ? {
              key: "nbiClearance",
              label: "NBI Clearance",
              documentType: "nbi_clearance",
              documentUrl: effectiveNbiUrl,
            }
          : null,
        effectiveCompanyUrl
          ? {
              key: "companyID",
              label: "Company ID",
              documentType: "company_id",
              documentUrl: effectiveCompanyUrl,
            }
          : null,
      ].filter(Boolean);

      const documentIssues = [];
      for (const target of requiredDocumentPrechecks) {
        const precheck = await runRequiredDocumentPrecheck(target);
        if (shouldBlockDocumentSubmission(precheck)) {
          documentIssues.push({
            key: target.key,
            label: target.label,
            precheckStatus: precheck?.precheckStatus || "needs_reupload",
            readabilityStatus: precheck?.readabilityStatus || "unknown",
            documentTypeStatus: precheck?.documentTypeStatus || "unknown",
            message:
              precheck?.applicantMessage ||
              precheck?.summaryMessage ||
              `${target.label} needs a clearer upload before submission.`,
          });
        }
      }

      if (documentIssues.length > 0) {
        return res.status(422).json({
          error: `Please fix the following document before submitting: ${documentIssues
            .map((issue) => `${issue.label} - ${issue.message}`)
            .join("; ")}`,
          code: "DOCUMENT_PRECHECK_BLOCKED",
          documentIssues,
        });
      }

      if (submittedIdType) {
        updates.idType = submittedIdType;
        updates.validIDType = submittedIdType;
      }

      updates.status = "pending_application_review";
      updates.applicationSubmittedAt = new Date();
      if (previouslySubmittedApplication) {
        updates.applicationResubmittedAt = new Date();
      }
      updates.applicationReviewReason = null;
      updates.applicationReviewedAt = null;
      updates.applicationReviewedBy = null;
      updates.approvedForPaymentAt = null;
    }

    if (req.body.proofOfPaymentUrl) {
      const effectiveStatusForPayment = normalizeReservationStatus(
        updates.status ?? reservation.status,
      );
      if (!shouldAllowPaymentAccess(effectiveStatusForPayment)) {
        return res.status(403).json({
          error:
            "Payment is still locked. It will only be available after your application and documents are approved.",
          code: "PAYMENT_LOCKED_PENDING_APPLICATION_REVIEW",
        });
      }
      // "partial" = proof uploaded, awaiting admin confirmation.
      // "pending" is reserved for "not yet uploaded" state.
      updates.paymentStatus = "partial";
      updates.paymentDate = new Date();
      updates.status = "payment_pending";
      const existing = await Reservation.findById(reservationId);
      if (!existing.paymentReference) {
        // Collision-safe generation — mirrors reservationCode retry pattern.
        const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let ref = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          let candidate = "PAY-";
          for (let i = 0; i < 6; i++)
            candidate += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
          const taken = await Reservation.findOne({ paymentReference: candidate })
            .select("_id")
            .lean();
          if (!taken) {
            ref = candidate;
            break;
          }
        }
        // Timestamp fallback — non-fatal; sparse unique index still protects the DB.
        updates.paymentReference =
          ref || "PAY-" + Date.now().toString(36).toUpperCase().slice(-6);
      }
    }

    if (
      updates.status !== undefined &&
      !canTransitionReservationStatus(reservation.status, updates.status)
    ) {
      return res.status(400).json({
        error: `Invalid reservation status transition from "${normalizeReservationStatus(reservation.status)}" to "${normalizeReservationStatus(updates.status)}".`,
        code: "INVALID_RESERVATION_STATUS_TRANSITION",
      });
    }

    const updateOperation = { $set: updates };
    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
    }

    let updatedReservation;
    // If status transitions to "reserved", use document .save() so schema pre-save hooks
    // (such as generateUniqueReservationCode) fire canonically.
    if (updates.status === "reserved") {
      const docToSave = await Reservation.findById(reservationId);
      if (!docToSave) {
        return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
      }
      Object.assign(docToSave, updates);
      if (Object.keys(unsetFields).length > 0) {
        for (const field of Object.keys(unsetFields)) {
          docToSave.set(field, undefined);
        }
      }
      updatedReservation = await docToSave.save();
      await updatedReservation.populate(...POPULATE_USER);
      await updatedReservation.populate(...POPULATE_ROOM);
    } else {
      const updateFilter = { _id: reservationId };
      if (isApplicationSubmission && !previouslySubmittedApplication) {
        updateFilter.applicationSubmittedAt = null;
        updateFilter.status = {
          $nin: [
            "pending_application_review",
            "approved_for_payment",
            "payment_pending",
            "reserved",
            "moveIn",
          ],
        };
      }

      updatedReservation = await Reservation.findOneAndUpdate(
        updateFilter,
        updateOperation,
        { new: true, runValidators: true },
      )
        .populate(...POPULATE_USER)
        .populate(...POPULATE_ROOM);

      if (!updatedReservation && isApplicationSubmission) {
        return res.status(409).json({
          error: "Application has already been submitted and is currently under review.",
          code: "APPLICATION_ALREADY_SUBMITTED",
        });
      }
    }

    res.json({
      message: "Reservation updated successfully",
      reservation: updatedReservation,
      ...(appliedPricing ? { pricing: appliedPricing.breakdown } : {}),
    });

    if (updatedReservation.userId?._id) {
      if (isApplicationSubmission) {
        try {
          await notify.general(
            updatedReservation.userId._id,
            "Application Pending Review",
            "Your application is pending review. Payment will be available once your application and documents are approved.",
            {
              entityType: "reservation",
              entityId: String(updatedReservation._id),
              actionUrl: "/applicant/reservation",
            },
          );
        } catch (notifyErr) {
          logger.warn(
            { err: notifyErr, requestId: req.id },
            "Pending-review notification failed (non-fatal)",
          );
        }
      } else if (
        preferenceRelatedUpdate &&
        effectiveViewingPreference &&
        !req.body.proofOfPaymentUrl
      ) {
        try {
          if (effectiveViewingPreference === "physical_visit") {
            const visitDateLabel = updatedReservation.visitDate
              ? new Date(updatedReservation.visitDate).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "your preferred date";
            const visitTimeLabel = updatedReservation.visitTime || "your preferred time slot";
            await notify.general(
              updatedReservation.userId._id,
              "Physical Visit Preference Saved",
              `Your preferred visit schedule for ${visitDateLabel} at ${visitTimeLabel} was recorded. Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.`,
              {
                entityType: "reservation",
                entityId: String(updatedReservation._id),
                actionUrl: "/applicant/reservation",
              },
            );
            if (updatedReservation.userId?.email) {
              await sendPhysicalVisitStatusEmail(
                buildVisitEmailContext({
                  reservation: updatedReservation,
                  status: "scheduled",
                }),
              );
            }
          } else if (effectiveViewingPreference === "remote_2d_viewing") {
            await notify.general(
              updatedReservation.userId._id,
              "2D Remote Viewing Request Submitted",
              "Your photo-based viewing preference was saved. Payment will only be available after your application and documents are approved.",
              {
                entityType: "reservation",
                entityId: String(updatedReservation._id),
                actionUrl: "/applicant/reservation",
              },
            );
          } else if (effectiveViewingPreference === "urgent_move_in_review") {
            await notify.general(
              updatedReservation.userId._id,
              "Urgent Move-in Review Requested",
              "Your urgent move-in request was recorded for admin review. Payment will only be available after your application and documents are approved.",
              {
                entityType: "reservation",
                entityId: String(updatedReservation._id),
                actionUrl: "/applicant/reservation",
              },
            );
          }
        } catch (notifyErr) {
          logger.warn(
            { err: notifyErr, requestId: req.id },
            "Viewing preference notification failed (non-fatal)",
          );
        }
      }
    }

    if (req.body.proofOfPaymentUrl) {
      try {
        emitToAdmins("payment:updated", {
          reservationId: String(updatedReservation._id),
          paymentStatus: updatedReservation.paymentStatus,
        });
      } catch (socketErr) {
        logger.warn({ err: socketErr }, "Socket emit failed after tenant proof upload (non-fatal)");
      }
    }
  } catch (error) {
    if (isActiveBedAssignmentDuplicateError(error)) {
      return res.status(409).json({
        error: BED_UNAVAILABLE_MESSAGE,
        code: "BED_UNAVAILABLE",
      });
    }
    logger.error(
      { err: error, requestId: req.id },
      "User reservation update error",
    );
    handleReservationError(res, error, "update");
  }
};

export const extendReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const extensionDays = parseInt(req.body.extensionDays || "7", 10);
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate(
      "roomId",
      "branch",
    );
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    if (
      !hasReservationStatus(
        reservation.status,
        "reserved",
        "pending",
        "visit_pending",
        "visit_approved",
      )
    )
      return res.status(400).json({
        error: "Only reserved/pending reservations can be extended",
        code: "INVALID_STATUS_FOR_EXTENSION",
      });

    const { Bill } = await import("../../models/index.js");
    const { buildBillingSummary } = await import("../../utils/tenantWorkspace.js");
    const moveOutBills = await Bill.find({
      reservationId,
      isArchived: { $ne: true },
    }).lean();
    const moveOutBilling = buildBillingSummary(moveOutBills, new Date());
    if (
      moveOutBilling.hasOutstanding ||
      moveOutBilling.hasPendingVerification
    ) {
      return res.status(409).json({
        error:
          "Move-out is blocked until the tenant's billing is fully settled.",
        code: "UNSETTLED_BILLING",
        billing: {
          currentBalance: moveOutBilling.currentBalance,
          pendingVerification: moveOutBilling.hasPendingVerification,
          paymentStatus: moveOutBilling.paymentStatus,
        },
      });
    }

    const oldData = reservation.toObject();
    const newMoveIn = new Date(
      readMoveInDate(reservation) || reservation.finalMoveInDate,
    );
    newMoveIn.setDate(newMoveIn.getDate() + extensionDays);

    reservation.moveInDate = newMoveIn;
    reservation.finalMoveInDate = newMoveIn;
    reservation.moveInExtendedTo = newMoveIn;
    if (reservation.status !== "reserved") {
      reservation.status =
        reservation.paymentStatus === "paid" ? "reserved" : "pending";
    }

    await reservation.save();
    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Extended move-in date by ${extensionDays} days`,
    );
    res.json({
      message: `Reservation extended by ${extensionDays} days`,
      newMoveInDate: newMoveIn,
      reservation: serializeReservation(reservation),
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Extend reservation error");
    await auditLogger.logError(req, error, "Failed to extend reservation");
    handleReservationError(res, error, "extend");
  }
};

export const releaseSlot = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { reason = "No-show after move-in date" } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation =
      await Reservation.findById(reservationId).populate("roomId");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const oldData = reservation.toObject();
    reservation.status = "cancelled";
    reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Released: ${reason}`;
    await reservation.save();

    await syncReservationUserLifecycle({
      status: "cancelled",
      previousStatus: oldData.status,
      userId: reservation.userId,
      roomId: reservation.roomId,
      reservationId: reservation._id,
    });

    try {
      await updateOccupancyOnReservationChange(
        {
          ...reservation.toObject(),
          roomId: reservation.roomId?._id || reservation.roomId,
        },
        oldData,
      );
    } catch (occupancyErr) {
      logger.warn(
        { err: occupancyErr, requestId: req.id },
        "Occupancy update during slot release failed",
      );
    }

    await reservation.populate(...POPULATE_USER);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Slot released: ${reason}`,
    );
    res.json({
      message: "Reservation slot released successfully",
      reason,
      reservation,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Release slot error");
    await auditLogger.logError(
      req,
      error,
      "Failed to release reservation slot",
    );
    handleReservationError(res, error, "release slot");
  }
};

export const manageReservationVisit = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const action = String(req.body?.action || "")
      .trim()
      .toLowerCase();
    const note = normalizeVisitManagementNote(req.body?.notes || req.body?.note || "");
    const now = new Date();

    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("userId", "firstName lastName email phone role tenantStatus branch")
      .populate("roomId", "name roomNumber branch type price floor");

    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    const branch = reservation.roomId?.branch || reservation.branch || "";
    const roomId = reservation.roomId?._id || reservation.roomId;
    const denied = checkBranchAccess(res, req.branchFilter, branch);
    if (denied) return;

    const previousSnapshot = reservation.toObject();
    const previousVisitDate = reservation.visitDate;
    const previousVisitTime = reservation.visitTime;
    const actorUser = await findDbUser(req.user?.uid);
    const actorId = actorUser?._id || null;
    const actorName = buildActorDisplayName(actorUser, req.user?.email || "");

    const actionValidation = validateVisitManagementAction(reservation, action);
    if (!actionValidation.ok) {
      return res.status(actionValidation.status).json({
        error: actionValidation.error,
        code: actionValidation.code,
      });
    }

    let applicantNotificationTitle = "";
    let applicantNotificationMessage = "";
    let applicantEmailStatus = null;

    if (action === "approve_schedule") {
      reservation.scheduleApproved = true;
      reservation.scheduleApprovedAt = now;
      reservation.scheduleRejected = false;
      reservation.scheduleRejectedAt = null;
      reservation.scheduleRejectedBy = null;
      reservation.scheduleRejectionReason = null;
      reservation.visitApproved = false;
      applyVisitOutcome({
        reservation,
        status: "schedule_approved",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
        )
      ) {
        reservation.status = "visit_approved";
      }
      applicantNotificationTitle = "Visit Schedule Approved";
      applicantNotificationMessage = `Your room visit for ${
        reservation.visitDate
          ? new Date(reservation.visitDate).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "your scheduled date"
      }${reservation.visitTime ? ` at ${reservation.visitTime}` : ""} has been confirmed. Please be on time.`;
      applicantEmailStatus = "approved";
    }

    if (action === "reject_schedule") {
      if (reservation.scheduleRejected) {
        return res.status(409).json({
          error: "Visit schedule has already been rejected.",
          code: "SCHEDULE_ALREADY_REJECTED",
        });
      }
      reservation.scheduleRejected = true;
      reservation.scheduleRejectedAt = now;
      reservation.scheduleRejectedBy = actorId || null;
      reservation.scheduleRejectionReason = note || "";
      reservation.visitApproved = false;
      reservation.scheduleApproved = false;
      reservation.scheduleApprovedAt = null;
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
          "approved",
        )
      ) {
        reservation.status = "visit_pending";
      }
      applyVisitOutcome({
        reservation,
        status: "visit_cancelled",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (reservation.visitDate) {
        appendVisitHistoryEntry({
          reservation,
          status: "rejected",
          actorId,
          actorName,
          note,
          updatedAt: now,
        });
      }
      applicantNotificationTitle = "Visit Schedule Rejected";
      applicantNotificationMessage = note
        ? `Your scheduled visit was rejected: ${note} Please reschedule.`
        : "Your scheduled visit was rejected. Please choose a new date and time.";
      applicantEmailStatus = "rejected";
    }

    if (action === "reschedule") {
      const nextVisitDate = req.body?.visitDate;
      const nextVisitTime =
        typeof req.body?.visitTime === "string" ? req.body.visitTime.trim() : "";

      if (!nextVisitDate || !nextVisitTime) {
        return res.status(422).json({
          error: "A new visit date and time slot are required when rescheduling a physical visit.",
          code: "VISIT_RESCHEDULE_DETAILS_REQUIRED",
        });
      }

      const validation = await validateVisitSelection({
        branch,
        visitDate: nextVisitDate,
        visitTime: nextVisitTime,
        roomId,
        excludeReservationId: reservationId,
      });

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          code: validation.code,
        });
      }

      if (reservation.visitDate || reservation.visitTime) {
        appendVisitHistoryEntry({
          reservation,
          status: "rescheduled",
          actorId,
          actorName,
          note,
          updatedAt: now,
          visitDate: reservation.visitDate,
          visitTime: reservation.visitTime,
          rescheduledToDate: validation.date,
          rescheduledToTime: nextVisitTime,
        });
      }

      reservation.visitDate = validation.date;
      reservation.visitTime = nextVisitTime;
      reservation.visitScheduledAt = now;
      reservation.scheduleApproved = true;
      reservation.scheduleApprovedAt = now;
      reservation.visitApproved = false;
      reservation.scheduleRejected = false;
      reservation.scheduleRejectedAt = null;
      reservation.scheduleRejectedBy = null;
      reservation.scheduleRejectionReason = null;
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
        )
      ) {
        reservation.status = "visit_approved";
      }
      applyVisitOutcome({
        reservation,
        status: "rescheduled",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "Physical Visit Rescheduled";
      applicantNotificationMessage = `Your physical visit was rescheduled to ${
        validation.date
          ? new Date(validation.date).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "a new date"
      }${nextVisitTime ? ` at ${nextVisitTime}` : ""}. Your tenant application will stay locked until the visit is completed or admin allows you to proceed.`;
      applicantEmailStatus = "rescheduled";
    }

    if (action === "mark_visited") {
      reservation.scheduleApproved = true;
      reservation.scheduleApprovedAt = reservation.scheduleApprovedAt || now;
      reservation.visitApproved = true;
      appendVisitHistoryEntry({
        reservation,
        status: "completed",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applyVisitOutcome({
        reservation,
        status: "visit_completed",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
        )
      ) {
        reservation.status = "visit_approved";
      }
      applicantNotificationTitle = "Physical Visit Completed";
      applicantNotificationMessage =
        "Your physical visit has been recorded. You may now continue to your tenant application. Payment remains locked until your application and required documents are approved.";
      applicantEmailStatus = "visit_completed";
    }

    if (action === "mark_no_show") {
      reservation.scheduleApproved = false;
      reservation.visitApproved = false;
      appendVisitHistoryEntry({
        reservation,
        status: "no_show",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applyVisitOutcome({
        reservation,
        status: "no_show",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
        )
      ) {
        reservation.status = "visit_pending";
      }
      applicantNotificationTitle = "Missed Physical Visit";
      applicantNotificationMessage =
        "You missed your scheduled visit. Please reschedule your visit or contact admin before continuing. Your tenant application remains locked.";
      applicantEmailStatus = "no_show";
    }

    if (action === "cancel_visit") {
      if (reservation.visitDate || reservation.visitTime) {
        appendVisitHistoryEntry({
          reservation,
          status: "visit_cancelled",
          actorId,
          actorName,
          note,
          updatedAt: now,
        });
      }

      reservation.visitDate = null;
      reservation.visitTime = "";
      reservation.visitCode = null;
      reservation.visitScheduledAt = null;
      reservation.scheduleApproved = false;
      reservation.scheduleApprovedAt = null;
      reservation.visitApproved = false;
      reservation.scheduleRejected = false;
      reservation.scheduleRejectedAt = null;
      reservation.scheduleRejectedBy = null;
      reservation.scheduleRejectionReason = null;
      applyVisitOutcome({
        reservation,
        status: "visit_cancelled",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
        )
      ) {
        reservation.status = "visit_pending";
      }
      applicantNotificationTitle = "Physical Visit Cancelled";
      applicantNotificationMessage =
        "Your physical visit schedule was cancelled. Your reservation is still active, but your tenant application remains locked unless admin separately allows you to proceed without a visit.";
      applicantEmailStatus = "visit_cancelled";
    }

    if (action === "allow_without_visit") {
      appendVisitHistoryEntry({
        reservation,
        status: "allowed_without_visit",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      reservation.scheduleApproved = false;
      reservation.visitApproved = false;
      applyVisitOutcome({
        reservation,
        status: "allowed_without_visit",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
          "viewing_preference_selected",
        )
      ) {
        reservation.status = "visit_approved";
      }
      applicantNotificationTitle = "You May Continue Your Tenant Application";
      applicantNotificationMessage =
        "Admin has allowed you to continue your tenant application without a completed physical visit. Payment remains locked until your application and required documents are approved.";
      applicantEmailStatus = "allowed_without_visit";
    }

    await reservation.save();
    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);

    const successMessage =
      action === "approve_schedule"
        ? "Visit schedule approved. Tenant has been notified."
        : action === "reject_schedule"
          ? "Visit schedule rejected. Tenant has been notified."
          : action === "mark_visited"
            ? "Visit marked as completed"
            : action === "mark_no_show"
              ? "Visit marked as no-show"
              : action === "reschedule"
                ? "Visit schedule updated"
                : action === "allow_without_visit"
                  ? "Applicant may proceed without a completed visit"
                  : "Visit schedule cancelled";

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      previousSnapshot,
      reservation.toObject(),
      `Visit management action: ${action}`,
    );

    let emailWarning = "";

    if (reservation.userId?._id && applicantNotificationTitle && applicantNotificationMessage) {
      try {
        const { notify: notifySvc } = await import("../../utils/notificationService.js");
        await notifySvc.general(
          reservation.userId._id,
          applicantNotificationTitle,
          applicantNotificationMessage,
          {
            entityType: "reservation",
            entityId: String(reservation._id),
            actionUrl: "/applicant/reservation",
          },
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Visit management notification failed (non-fatal)",
        );
      }
    }

    if (reservation.userId?.email && applicantEmailStatus) {
      try {
        const emailResult = await sendPhysicalVisitStatusEmail(
          buildVisitEmailContext({
            reservation,
            status: applicantEmailStatus,
            previousVisitDate,
            previousVisitTime,
            note,
          }),
        );
        if (!emailResult?.success) {
          emailWarning = "Visit status updated, but email notification could not be sent.";
        }
      } catch (emailErr) {
        logger.warn(
          { err: emailErr, requestId: req.id },
          "Visit management email failed (non-fatal)",
        );
        emailWarning = "Visit status updated, but email notification could not be sent.";
      }
    }

    res.json({
      message: successMessage,
      reservation: serializeReservation(reservation),
      ...(emailWarning ? { emailWarning } : {}),
    });

    try {
      emitToAdmins("reservation:updated", {
        reservationId: String(reservation._id),
        status: reservation.status,
        paymentStatus: reservation.paymentStatus,
      });
    } catch (socketErr) {
      logger.warn(
        { err: socketErr, requestId: req.id },
        "Socket emit failed after visit management update (non-fatal)",
      );
    }
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Manage visit error");
    await auditLogger.logError(req, error, "Failed to manage reservation visit");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code || "VISIT_MANAGEMENT_FAILED",
      });
    }
    handleReservationError(res, error, "manage visit");
  }
};
