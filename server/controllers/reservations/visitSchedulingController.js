/**
 * ============================================================================
 * VISIT SCHEDULING CONTROLLER
 * ============================================================================
 *
 * Handles viewing preference selection and physical visit scheduling by tenants.
 */

import { Reservation, Room } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
} from "../../utils/reservationHelpers.js";
import {
  hasReservationStatus,
} from "../../utils/lifecycleNaming.js";
import { notify } from "../../utils/notificationService.js";
import { sendPhysicalVisitStatusEmail } from "../../config/email.js";
import { validateVisitSelection } from "../../utils/visitAvailability.js";
import {
  LEGACY_VISIT_STATUSES,
  MAX_REMOTE_VIEWING_QUESTION_LENGTH,
  VIEWING_PREFERENCE_LOCKED_MESSAGE,
  findDbUser,
  normalizeViewingPreferenceInput,
  deriveViewingPreference,
  deriveViewingType,
  isViewingPreferenceLocked,
  buildVisitEmailContext,
  serializeReservation,
} from "./_helpers.js";

export const updateVisitPreferenceAndSchedule = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
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
        error: "Access denied. You can only update your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const hasBodyField = (field) =>
      Object.prototype.hasOwnProperty.call(req.body, field);

    const rawViewingPreference = hasBodyField("viewingPreference")
      ? req.body.viewingPreference
      : hasBodyField("viewingType")
        ? req.body.viewingType
        : undefined;

    let normalizedViewingPreference = null;
    if (rawViewingPreference !== undefined) {
      normalizedViewingPreference =
        normalizeViewingPreferenceInput(rawViewingPreference);
      if (!normalizedViewingPreference) {
        return res.status(400).json({
          error:
            "Invalid viewing preference. Please choose Physical Visit, 2D Remote Viewing, or Urgent Move-in Review.",
          code: "INVALID_VIEWING_PREFERENCE",
        });
      }
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

    const updates = {};
    const unsetFields = {};

    if (normalizedViewingPreference) {
      updates.viewingPreference = normalizedViewingPreference;
      updates.viewingType = deriveViewingType(normalizedViewingPreference);
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

    if (hasBodyField("visitDate")) {
      updates.visitDate = req.body.visitDate ? new Date(req.body.visitDate) : null;
    }

    if (hasBodyField("visitTime")) {
      updates.visitTime = req.body.visitTime || "";
    }

    if (hasBodyField("remoteViewingAcknowledged")) {
      updates.remoteViewingAcknowledged =
        req.body.remoteViewingAcknowledged === true;
    }

    const effectiveViewingPreference = deriveViewingPreference(
      reservation,
      updates,
    );

    if (
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
    } else {
      updates.isUrgentMoveIn = false;
    }

    if (effectiveViewingPreference !== "remote_2d_viewing") {
      updates.remoteViewingAcknowledged = false;
      if (!hasBodyField("remoteViewingQuestions")) {
        updates.remoteViewingQuestions = "";
      }
    }

    const effectiveRemoteViewingAcknowledged =
      updates.remoteViewingAcknowledged ?? reservation.remoteViewingAcknowledged;
    const effectiveVisitDate = updates.visitDate ?? reservation.visitDate;
    const effectiveVisitTime = updates.visitTime ?? reservation.visitTime;

    if (effectiveViewingPreference === "physical_visit") {
      if (!effectiveVisitDate || !effectiveVisitTime) {
        return res.status(422).json({
          error:
            "Preferred visit date and time slot are required when scheduling a physical visit.",
          code: "PHYSICAL_VISIT_DETAILS_REQUIRED",
        });
      }
    }

    if (effectiveViewingPreference === "remote_2d_viewing") {
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
      if (!reservation.visitCode) {
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
          visitCode ||
          "VIS-" + Date.now().toString(36).toUpperCase().slice(-6);
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
      const room = await Room.findById(reservation.roomId)
        .select("branch")
        .lean();
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
          error:
            "Visit date cannot be in the past. Please select a future date.",
          code: "VISIT_DATE_IN_PAST",
        });
      }
    }

    const effectiveAgreedToPrivacy =
      req.body.agreedToPrivacy ?? reservation.agreedToPrivacy;

    if (
      effectiveViewingPreference === "physical_visit" &&
      updates.visitDate &&
      effectiveAgreedToPrivacy &&
      reservation.scheduleRejected
    ) {
      updates.scheduleRejected = false;
      updates.scheduleRejectionReason = null;
      updates.scheduleRejectedAt = null;
      if (
        hasReservationStatus(
          reservation.status,
          LEGACY_VISIT_STATUSES,
          "pending",
        )
      ) {
        updates.status = "visit_pending";
      }
    }

    const submittedPhysicalVisitSchedule =
      effectiveViewingPreference === "physical_visit" &&
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
      hasReservationStatus(reservation.status, "pending")
    ) {
      updates.status = "viewing_preference_selected";
    }

    if (
      effectiveViewingPreference === "physical_visit" &&
      updates.visitDate &&
      effectiveAgreedToPrivacy &&
      hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES)
    ) {
      updates.status = "visit_approved";
    }

    const updateOperation = { $set: updates };
    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      updateOperation,
      { new: true, runValidators: true },
    )
      .populate("userId", "firstName lastName email phone")
      .populate("roomId", "name roomNumber branch type price floor");

    res.json({
      message: "Visit preference and schedule updated successfully",
      reservation: serializeReservation(updatedReservation),
    });

    if (updatedReservation.userId?._id) {
      try {
        if (effectiveViewingPreference === "physical_visit") {
          const visitDateLabel = updatedReservation.visitDate
            ? new Date(updatedReservation.visitDate).toLocaleDateString(
                "en-PH",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                },
              )
            : "your preferred date";
          const visitTimeLabel =
            updatedReservation.visitTime || "your preferred time slot";
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
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Visit preference update error",
    );
    handleReservationError(res, error, "update visit preference");
  }
};
