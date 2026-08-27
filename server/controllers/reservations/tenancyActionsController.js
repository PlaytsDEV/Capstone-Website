/**
 * ============================================================================
 * TENANCY ACTIONS CONTROLLER
 * ============================================================================
 *
 * Handles administrative tenancy actions: archiving, restoring, contract renewal,
 * tenant move-out/checkout, and room transfers.
 */

import dayjs from "dayjs";
import { Reservation } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
  checkBranchAccess,
  syncReservationUserLifecycle,
} from "../../utils/reservationHelpers.js";
import {
  hasReservationStatus,
  ACTIVE_STAY_STATUS_QUERY,
} from "../../utils/lifecycleNaming.js";
import { updateOccupancyOnReservationChange } from "../../utils/occupancyManager.js";
import { archiveContractForCancelledReservation } from "../../services/contractArchiveService.js";
import {
  renewStayWorkflow,
  moveOutStayWorkflow,
  transferStayWorkflow,
  cancelTransferStayWorkflow,
  cancelMoveOutStayWorkflow,
  executeEarlyTerminationWorkflow,
  executeDirectRoomSwapWorkflow,
  executeAbandonmentProtocolWorkflow,
  validateContractExtensionWorkflow,
  getMonthlyRent,
} from "../../utils/tenantActionService.js";
import { computeLeaseEndDate } from "../../utils/tenantWorkspace.js";
import { resolveArchivedRestoreStatus } from "../../utils/reservationArchive.js";
import {
  POPULATE_USER,
  POPULATE_ROOM,
  findDbUser,
  serializeReservation,
} from "./_helpers.js";
import { getBusinessSettings } from "../../utils/businessSettings.js";
import { resolveAuthoritativeLeasePricing } from "../../services/contractPricingResolver.js";
import { resolveCurrentStayForReservation } from "../../services/tenantContractSelectionService.js";

export const archiveReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { reason = "Archived by admin" } = req.body;
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
      hasReservationStatus(reservation.status, "reserved", "approved_for_payment") ||
      hasReservationStatus(reservation.status, "moveIn")
    ) {
      return res.status(400).json({
        error: "Confirmed reserved bookings cannot be archived directly. Please process a cancellation or move-out workflow first.",
        code: "RESERVED_CANNOT_BE_DELETED",
      });
    }

    const oldData = reservation.toObject();
    const dbUser = await findDbUser(req.user.uid);

    if (hasReservationStatus(reservation.status, ACTIVE_STAY_STATUS_QUERY)) {
      const prevStatus = reservation.status;
      reservation.status = "cancelled";
      await reservation.save();
      try {
        await updateOccupancyOnReservationChange(reservation, {
          ...oldData,
          status: prevStatus,
        });
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Occupancy update during archive failed",
        );
      }
      try {
        await archiveContractForCancelledReservation({ reservationId: reservation._id, actorId: dbUser?._id || null });
      } catch (contractArchiveErr) {
        logger.warn(
          { err: contractArchiveErr, requestId: req.id },
          "Early-stage Contract archive during tenancy archive failed (non-fatal)",
        );
      }
    }

    reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Archived: ${reason}`;
    await reservation.archive(dbUser?._id || null, {
      previousStatus: oldData.status,
      reason,
    });

    await syncReservationUserLifecycle({
      status: "archived",
      previousStatus: oldData.status,
      userId: reservation.userId,
      roomId: reservation.roomId,
      reservationId: reservation._id,
    });

    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Reservation archived: ${reason}`,
    );
    res.json({
      message: "Reservation archived successfully",
      reason,
      reservation,
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Archive reservation error",
    );
    await auditLogger.logError(req, error, "Failed to archive reservation");
    handleReservationError(res, error, "archive");
  }
};

export const restoreReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate(
      "roomId",
      "branch",
    );
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    if (!reservation.isArchived) {
      return res.status(409).json({
        error: "Reservation is not archived.",
        code: "RESERVATION_NOT_ARCHIVED",
      });
    }

    const oldData = reservation.toObject();
    const restoredStatus = resolveArchivedRestoreStatus(reservation);

    reservation.status = restoredStatus;
    reservation.isArchived = false;
    reservation.archivedAt = null;
    reservation.archivedBy = null;
    reservation.archiveReason = "";
    reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Restored from archive`;
    await reservation.save();

    await syncReservationUserLifecycle({
      status: restoredStatus,
      previousStatus: oldData.status || "archived",
      userId: reservation.userId,
      roomId: reservation.roomId,
      reservationId: reservation._id,
      force: true,
    });

    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Reservation restored from archive as ${restoredStatus}`,
    );

    res.json({
      message: "Reservation restored successfully",
      restoredStatus,
      reservation: serializeReservation(reservation),
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Restore reservation error",
    );
    await auditLogger.logError(req, error, "Failed to restore reservation");
    handleReservationError(res, error, "restore");
  }
};

export const renewContract = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate("roomId", "branch");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const actor = await findDbUser(req.user.uid);
    const previousStaySnapshot = await resolveCurrentStayForReservation(reservationId).lean();
    const result = await renewStayWorkflow({
      reservationId,
      payload: req.body,
      actorId: actor?._id || null,
    });

    const { notify } = await import("../../utils/notificationService.js");
    const roomName = result.reservation.roomId?.name || "your room";
    notify.general(
      result.reservation.userId?._id || result.reservation.userId,
      "Contract Renewed",
      `Your lease for ${roomName} has been renewed through ${dayjs(result.stay.leaseEndDate).format("MMM D, YYYY")}.`,
      { entityType: "stay" },
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      { reservation: reservation.toObject(), stay: previousStaySnapshot },
      { reservation: result.reservation.toObject(), stay: result.stay },
      "Tenant stay renewed",
    );

    res.json({
      message: "Lease renewed successfully",
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Renew contract error");
    await auditLogger.logError(req, error, "Failed to renew contract");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || "RENEW_FAILED" });
    }
    handleReservationError(res, error, "renew");
  }
};

/**
 * Resolve the canonical room-type + duration renewal pricing for a
 * Reservation — the SAME resolution used both to preview an offer before
 * creation and to actually persist it, so the two can never disagree.
 * Returns null when the room type/duration cannot be canonically resolved
 * (unsupported room type, invalid duration) — callers fall back to legacy
 * behavior in that case.
 */
async function resolveCanonicalRenewalPricing(reservation, leaseDurationMonths) {
  try {
    const settings = await getBusinessSettings();
    return resolveAuthoritativeLeasePricing({
      room: reservation.roomId,
      roomType: reservation.roomId?.type,
      branch: reservation.roomId?.branch,
      leaseDurationMonths,
      settings,
    });
  } catch {
    return null;
  }
}

/**
 * Preview the canonical renewal pricing for a chosen duration BEFORE an
 * offer is created (read-only — no Reservation mutation, no notification).
 * Lets the admin UI show/confirm the exact rate the offer (and later the
 * successor Contract) will use, instead of guessing client-side.
 */
export const previewRenewalPricing = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const months = Number(req.query.months) || 6;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate("roomId", "name roomNumber branch type");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }

    const denied = checkBranchAccess(res, req.branchFilter, reservation.roomId?.branch);
    if (denied) return;

    const canonicalPricing = await resolveCanonicalRenewalPricing(reservation, months);
    if (!canonicalPricing) {
      return res.status(422).json({
        error: "Pricing cannot be resolved for this room type/duration.",
        code: "PRICING_UNAVAILABLE",
      });
    }

    res.json({
      months,
      roomType: canonicalPricing.roomType,
      pricingTier: canonicalPricing.leaseType,
      regularMonthlyRate: canonicalPricing.regularMonthlyRate,
      discountPercentage: canonicalPricing.discountPercentage,
      discountAmount: canonicalPricing.discountAmount,
      finalMonthlyRate: canonicalPricing.finalMonthlyRate,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Preview renewal pricing error");
    handleReservationError(res, error, "preview renewal pricing");
  }
};

/**
 * Create a contract renewal offer (Admin action)
 */
export const createRenewalOffer = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { months = 6, proposedRent, notes = "", expiresAt } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("roomId", "name roomNumber branch type")
      .populate("userId", "firstName lastName email phone");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }

    const denied = checkBranchAccess(res, req.branchFilter, reservation.roomId?.branch);
    if (denied) return;

    if (!hasReservationStatus(reservation.status, "moveIn")) {
      return res.status(400).json({ error: "Only active moved-in tenants can receive renewal offers.", code: "INVALID_STATUS" });
    }

    const hasPending = (reservation.renewalOffers || []).some((o) => o.status === "pending");
    if (hasPending) {
      return res.status(409).json({ error: "A pending renewal offer already exists for this tenant.", code: "PENDING_OFFER_EXISTS" });
    }

    const actor = await findDbUser(req.user.uid);
    const offerId = `OFFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const leaseDurationMonths = Number(months) || 6;

    // The offer must present the SAME room-type + duration canonical rate
    // that the renewal successor Contract will later snapshot — never the
    // tenant's current/old rent or the Room's raw list price. Custom/
    // negotiated renewal pricing is not a supported, audited business
    // feature anywhere else in this codebase (Reservation.pricingSnapshot's
    // customRateReason is a dead placeholder, never set) — so a
    // client-submitted proposedRent is not treated as authoritative; it is
    // only used as a legacy/unsupported-room-type fallback below.
    const canonicalPricing = await resolveCanonicalRenewalPricing(reservation, leaseDurationMonths);

    const newOffer = canonicalPricing
      ? {
          offerId,
          months: leaseDurationMonths,
          proposedRent: canonicalPricing.finalMonthlyRate,
          regularMonthlyRate: canonicalPricing.regularMonthlyRate,
          discountPercentage: canonicalPricing.discountPercentage,
          pricingTier: canonicalPricing.leaseType,
          pricingSource: "canonical_resolver",
          notes: String(notes || "").trim(),
          status: "pending",
          expiresAt: expiresAt ? new Date(expiresAt) : dayjs().add(14, "day").toDate(),
          createdAt: new Date(),
          createdBy: actor?._id || null,
        }
      : {
          offerId,
          months: leaseDurationMonths,
          proposedRent: proposedRent ? Number(proposedRent) : null,
          pricingSource: "legacy_manual",
          notes: String(notes || "").trim(),
          status: "pending",
          expiresAt: expiresAt ? new Date(expiresAt) : dayjs().add(14, "day").toDate(),
          createdAt: new Date(),
          createdBy: actor?._id || null,
        };

    // Atomic, authoritative guard: only push the new offer if no pending
    // offer exists at the moment MongoDB applies this single-document
    // update. This closes the race where two concurrent creates both read
    // hasPending=false from separately-fetched documents above (that read
    // is kept only as a cheap early-exit before the pricing resolution
    // work) and both would otherwise push a pending offer.
    const withOffer = await Reservation.findOneAndUpdate(
      {
        _id: reservationId,
        renewalOffers: { $not: { $elemMatch: { status: "pending" } } },
      },
      { $push: { renewalOffers: newOffer } },
      { new: true },
    )
      .populate("roomId", "name roomNumber branch type")
      .populate("userId", "firstName lastName email phone");

    if (!withOffer) {
      const stillExists = await Reservation.exists({ _id: reservationId });
      if (!stillExists) {
        return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
      }
      return res.status(409).json({ error: "A pending renewal offer already exists for this tenant.", code: "PENDING_OFFER_EXISTS" });
    }

    const { notify } = await import("../../utils/notificationService.js");
    const tenantId = withOffer.userId?._id || withOffer.userId;
    if (tenantId) {
      await notify.general(
        tenantId,
        "Lease Renewal Offer",
        `You received a ${months}-month lease renewal offer for ${withOffer.roomId?.name || "your room"}. Please respond before ${dayjs(newOffer.expiresAt).format("MMM D, YYYY")}.`,
        { entityType: "reservation", entityId: withOffer._id, action: "renewal_offer" }
      );
    }

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      { offer: newOffer },
      `Created lease renewal offer (${months} months)`
    );

    res.status(201).json({
      message: "Renewal offer sent to tenant successfully",
      offer: newOffer,
      reservation: serializeReservation(withOffer),
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Create renewal offer error");
    await auditLogger.logError(req, error, "Failed to create renewal offer");
    handleReservationError(res, error, "create renewal offer");
  }
};

/**
 * Cancel a pending renewal offer (Admin action)
 */
export const cancelRenewalOffer = async (req, res, next) => {
  try {
    const { reservationId, offerId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate("roomId", "branch");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }

    const denied = checkBranchAccess(res, req.branchFilter, reservation.roomId?.branch);
    if (denied) return;

    const offer = (reservation.renewalOffers || []).find((o) => o.offerId === offerId);
    if (!offer) {
      return res.status(404).json({ error: "Renewal offer not found", code: "OFFER_NOT_FOUND" });
    }
    if (offer.status !== "pending") {
      return res.status(400).json({ error: `Cannot cancel an offer with status '${offer.status}'`, code: "INVALID_OFFER_STATUS" });
    }

    offer.status = "cancelled";
    offer.respondedAt = new Date();
    await reservation.save();

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      { offerId },
      "Cancelled lease renewal offer"
    );

    res.json({
      message: "Renewal offer cancelled",
      reservation: serializeReservation(reservation),
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Cancel renewal offer error");
    await auditLogger.logError(req, error, "Failed to cancel renewal offer");
    handleReservationError(res, error, "cancel renewal offer");
  }
};

/**
 * Respond to a renewal offer (Tenant or Admin action)
 */
export const respondToRenewalOffer = async (req, res, next) => {
  try {
    const { reservationId, offerId } = req.params;
    const { action, tenantResponseReason = "" } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'accept' or 'decline'", code: "INVALID_ACTION" });
    }

    const populateReservation = (query) =>
      query
        .populate("roomId", "name roomNumber branch monthlyPrice price")
        .populate("userId", "firstName lastName email");

    // Read-only pre-check purely for a fast, cheap 404/400 before touching
    // the offer array. The authoritative state transition happens below via
    // an atomic, conditional findOneAndUpdate — this pre-check is NOT relied
    // on for correctness, since a concurrent request could change offer
    // status between this read and the write.
    const precheck = await populateReservation(Reservation.findById(reservationId));
    if (!precheck) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }
    if (!(precheck.renewalOffers || []).some((o) => o.offerId === offerId)) {
      return res.status(404).json({ error: "Renewal offer not found", code: "OFFER_NOT_FOUND" });
    }

    const actor = await findDbUser(req.user.uid);

    // Resolves what to tell the caller when the atomic CAS below finds the
    // offer already left the "pending" state — either because a concurrent
    // request just won the race (idempotent success) or because it was
    // already resolved earlier (a real client error).
    const respondNotPending = async () => {
      const current = await populateReservation(Reservation.findById(reservationId));
      if (!current) {
        return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
      }
      const existingOffer = (current.renewalOffers || []).find((o) => o.offerId === offerId);
      if (!existingOffer) {
        return res.status(404).json({ error: "Renewal offer not found", code: "OFFER_NOT_FOUND" });
      }
      if (action === "accept" && existingOffer.status === "accepted") {
        // Another concurrent/duplicate request (double-click, retry,
        // duplicate mobile request) already accepted this exact offer and
        // extended the lease. Treat this as a safe no-op success instead of
        // erroring or extending the lease a second time.
        const { Stay } = await import("../../models/index.js");
        const currentStay = await Stay.findOne({ reservationId, status: "active" }).sort({ createdAt: -1 });
        return res.status(200).json({
          message: "Renewal offer already accepted",
          alreadyProcessed: true,
          reservation: serializeReservation(current),
          stay: currentStay,
        });
      }
      if (action === "decline" && existingOffer.status === "declined") {
        return res.status(200).json({
          message: "Renewal offer already declined",
          alreadyProcessed: true,
          reservation: serializeReservation(current),
        });
      }
      return res.status(400).json({ error: `Offer is no longer pending (current status: ${existingOffer.status})`, code: "OFFER_EXPIRED_OR_RESOLVED" });
    };

    if (action === "decline") {
      // Atomic, authoritative transition: pending -> declined only if the
      // offer is still pending at write time. Replaces the prior
      // read-then-save pattern, which could let two concurrent requests
      // both pass a status check performed on separately-fetched documents.
      const declined = await populateReservation(
        Reservation.findOneAndUpdate(
          { _id: reservationId, renewalOffers: { $elemMatch: { offerId, status: "pending" } } },
          {
            $set: {
              "renewalOffers.$[offer].status": "declined",
              "renewalOffers.$[offer].respondedAt": new Date(),
              "renewalOffers.$[offer].tenantResponseReason": String(tenantResponseReason || "").trim(),
            },
          },
          { arrayFilters: [{ "offer.offerId": offerId }], new: true },
        ),
      );

      if (!declined) return respondNotPending();

      const { notify } = await import("../../utils/notificationService.js");
      await notify.general(
        declined.userId?._id || declined.userId,
        "Renewal Declined",
        `You declined the lease renewal offer for ${declined.roomId?.name || "your room"}.`,
        { entityType: "reservation", entityId: declined._id }
      );

      await auditLogger.logModification(
        req,
        "reservation",
        reservationId,
        {},
        { offerId, action: "decline", reason: tenantResponseReason },
        `Tenant declined renewal offer: ${tenantResponseReason}`
      );

      return res.json({
        message: "Renewal offer declined",
        reservation: serializeReservation(declined),
      });
    }

    // Accept path. Step 1: atomically CLAIM the pending -> accepted
    // transition. This is the concurrency boundary — MongoDB guarantees
    // only one concurrent findOneAndUpdate can match a given document's
    // "still pending" condition and apply the $set; every other concurrent
    // request gets null back and must NOT proceed to extend the lease.
    const claimed = await populateReservation(
      Reservation.findOneAndUpdate(
        { _id: reservationId, renewalOffers: { $elemMatch: { offerId, status: "pending" } } },
        {
          $set: {
            "renewalOffers.$[offer].status": "accepted",
            "renewalOffers.$[offer].respondedAt": new Date(),
            "renewalOffers.$[offer].tenantResponseReason": String(tenantResponseReason || "").trim(),
          },
        },
        { arrayFilters: [{ "offer.offerId": offerId }], new: true },
      ),
    );

    if (!claimed) return respondNotPending();

    const offer = claimed.renewalOffers.find((o) => o.offerId === offerId);

    const activeStay = await resolveCurrentStayForReservation(claimed._id);

    let currentEndDate = activeStay?.leaseEndDate || computeLeaseEndDate(claimed) || new Date();
    const newStartDate = dayjs(currentEndDate).add(1, "day").toDate();
    const newEndDate = dayjs(newStartDate).add(offer.months, "month").subtract(1, "day").toDate();

    const renewPayload = {
      confirm: true,
      newLeaseStartDate: newStartDate,
      newLeaseEndDate: newEndDate,
      monthlyRent: offer.proposedRent || getMonthlyRent(claimed),
      renewalOfferId: offer.offerId,
      notes: `Accepted Renewal Offer (${offer.months} months). ${offer.notes || ""}`.trim(),
    };

    let result;
    try {
      result = await renewStayWorkflow({
        reservationId,
        payload: renewPayload,
        actorId: actor?._id || null,
      });
    } catch (workflowErr) {
      // Compensate: this request won the claim above but the actual lease
      // extension failed (validation error, overlap, etc). Release the
      // claim back to "pending" so the tenant/admin can legitimately retry,
      // but only if the offer is still in the exact state we just set —
      // never clobber a newer legitimate transition.
      await Reservation.updateOne(
        { _id: reservationId, renewalOffers: { $elemMatch: { offerId, status: "accepted" } } },
        {
          $set: {
            "renewalOffers.$[offer].status": "pending",
            "renewalOffers.$[offer].respondedAt": null,
            "renewalOffers.$[offer].tenantResponseReason": "",
          },
        },
        { arrayFilters: [{ "offer.offerId": offerId }] },
      );
      throw workflowErr;
    }

    // Offer status was already transitioned atomically above (step 1) —
    // no further write to the offer is needed or performed here.

    const { notify } = await import("../../utils/notificationService.js");
    const roomName = claimed.roomId?.name || "your room";

    await notify.general(
      claimed.userId?._id || claimed.userId,
      "Lease Renewed!",
      `Your lease renewal for ${roomName} has been processed! Extended by ${offer.months} months through ${dayjs(newEndDate).format("MMM D, YYYY")}.`,
      { entityType: "stay" }
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      { offerId, action: "accept", newEndDate },
      `Tenant accepted renewal offer (${offer.months} months)`
    );

    res.json({
      message: "Renewal offer accepted and lease extended successfully!",
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Respond to renewal offer error");
    await auditLogger.logError(req, error, "Failed to respond to renewal offer");
    handleReservationError(res, error, "respond to renewal offer");
  }
};

/**
 * Get active renewal offers for logged-in tenant
 */
export const getMyRenewalOffers = async (req, res, next) => {
  try {
    const actor = await findDbUser(req.user.uid);
    if (!actor) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const reservations = await Reservation.find({
      userId: actor._id,
      isArchived: { $ne: true },
      "renewalOffers.0": { $exists: true },
    })
      .populate("roomId", "name roomNumber branch monthlyPrice price")
      .lean();

    const offers = [];
    for (const resItem of reservations) {
      for (const offer of resItem.renewalOffers || []) {
        offers.push({
          ...offer,
          reservationId: String(resItem._id),
          roomName: resItem.roomId?.name || resItem.roomId?.roomNumber || "Room",
          branch: resItem.roomId?.branch || "",
        });
      }
    }

    res.json({ offers });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Get my renewal offers error");
    handleReservationError(res, error, "get renewal offers");
  }
};

export const moveOutReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { meterReading, finalUtilityReading } = req.body || {};
    const resolvedReading = finalUtilityReading ?? meterReading;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("roomId")
      .populate("userId", "firstName lastName email");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    if (!hasReservationStatus(reservation.status, "moveIn")) {
      return res.status(400).json({
        error: "Only moved-in tenants can be moved out.",
        code: "INVALID_STATUS_FOR_MOVEOUT",
      });
    }

    if (resolvedReading == null || isNaN(Number(resolvedReading))) {
      return res.status(400).json({
        error: "A meter reading (kWh) is required when moving out a tenant.",
        code: "METER_READING_REQUIRED",
      });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const actor = await findDbUser(req.user.uid);
    const oldData = reservation.toObject();
    const result = await moveOutStayWorkflow({
      reservationId,
      payload: { ...req.body, finalUtilityReading: Number(resolvedReading) },
      actorId: actor?._id || null,
    });

    const { notify } = await import("../../utils/notificationService.js");
    const roomName = result.reservation.roomId?.name || "your room";
    await notify.moveOutComplete(
      result.reservation.userId?._id || result.reservation.userId,
      roomName,
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      {
        reservation: result.reservation.toObject(),
        stay: result.stay,
        billingSummary: result.billingSummary,
      },
      `Tenant moved out from ${roomName}`,
    );

    res.json({
      message: "Tenant moved out successfully",
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
      finalBillingSummary: result.billingSummary,
      depositSettlement: result.depositSettlement,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Move-out error");
    await auditLogger.logError(req, error, "Failed to move out reservation");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code || "MOVEOUT_FAILED",
        ...(error.outstandingBalance !== undefined && {
          outstandingBalance: error.outstandingBalance,
          paymentStatus: error.paymentStatus,
        }),
      });
    }
    handleReservationError(res, error, "move out");
  }
};

export const checkoutReservation = moveOutReservation;

export const transferTenant = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("roomId")
      .populate("userId", "firstName lastName email");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    if (!hasReservationStatus(reservation.status, "moveIn")) {
      return res.status(400).json({
        error: "Only moved-in tenants can be transferred.",
        code: "INVALID_STATUS_FOR_TRANSFER",
      });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const oldData = reservation.toObject();
    const actor = await findDbUser(req.user.uid);
    const result = await transferStayWorkflow({
      reservationId,
      payload: {
        ...req.body,
        targetRoomId: req.body.targetRoomId || req.body.newRoomId,
        targetBedId: req.body.targetBedId || req.body.newBedId,
        forceOverride: Boolean(req.body.forceOverride),
      },
      actorId: actor?._id || null,
    });

    const { notify } = await import("../../utils/notificationService.js");
    notify.general(
      result.reservation.userId?._id || result.reservation.userId,
      "Room Transfer",
      `You have been transferred from ${result.fromRoomName} to ${result.toRoomName}.`,
      { entityType: "stay" },
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      { reservation: result.reservation.toObject(), stay: result.stay },
      `Tenant transferred: ${result.fromRoomName} → ${result.toRoomName}`,
    );

    res.json({
      message: `Tenant transferred from ${result.fromRoomName} to ${result.toRoomName}`,
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
      fromRoomDetails: result.fromRoomDetails || null,
      toRoomDetails: result.toRoomDetails || null,
      billingSnapshot: result.billingSnapshot || null,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Transfer error");
    await auditLogger.logError(req, error, "Failed to transfer tenant");
    if (error?.code === "OUTSTANDING_BILLS_BLOCKING_TRANSFER") {
      return res.status(409).json({
        error: error.message,
        code: error.code,
        outstandingBalance: error.outstandingBalance,
        paymentStatus: error.paymentStatus,
      });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || "TRANSFER_FAILED" });
    }
    handleReservationError(res, error, "transfer");
  }
};

// Prepares the legal paperwork for a room transfer WITHOUT touching any
// physical state (Room/Bed/Stay/Reservation) — reuses the existing,
// unmodified autoGenerateTransferContract pipeline directly. This exists
// because transferStayWorkflow now REQUIRES a final, wet-signed replacement
// Contract to already exist before it will physically move a tenant (see
// its "legal readiness gate"); previously Contract generation only ever
// happened automatically after the physical transfer, which would make
// transfer permanently unusable once that gate exists without this
// separate preparation step.
export const prepareRoomTransferContract = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate("roomId");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }
    if (!hasReservationStatus(reservation.status, "moveIn")) {
      return res.status(400).json({
        error: "Only moved-in tenants can have a room-transfer Contract prepared.",
        code: "INVALID_STATUS_FOR_TRANSFER",
      });
    }
    const denied = checkBranchAccess(res, req.branchFilter, reservation.roomId?.branch);
    if (denied) return;

    const targetRoomId = req.body.targetRoomId || req.body.newRoomId;
    const targetBedId = req.body.targetBedId || req.body.newBedId;
    if (!targetRoomId || !targetBedId) {
      return res.status(400).json({ error: "Target room and bed are required.", code: "MISSING_TRANSFER_FIELDS" });
    }

    const { Room } = await import("../../models/index.js");
    const targetRoomDoc = await Room.findById(targetRoomId).lean();
    if (!targetRoomDoc) {
      return res.status(404).json({ error: "Target room not found.", code: "TARGET_ROOM_NOT_FOUND" });
    }
    if (String(targetRoomDoc.branch) !== String(reservation.roomId?.branch || "")) {
      return res.status(400).json({
        error: "Transfers are limited to rooms within the same branch.",
        code: "CROSS_BRANCH_TRANSFER_NOT_ALLOWED",
      });
    }
    const targetBed = (targetRoomDoc.beds || []).find(
      (bed) => String(bed.id) === String(targetBedId) || String(bed._id) === String(targetBedId),
    );
    if (!targetBed) {
      return res.status(404).json({ error: "Target bed not found.", code: "TARGET_BED_NOT_FOUND" });
    }

    const activeStay = await resolveCurrentStayForReservation(reservation._id);
    if (!activeStay) {
      return res.status(400).json({ error: "No active stay found for this reservation.", code: "NO_ACTIVE_STAY" });
    }

    const actor = await findDbUser(req.user.uid);
    const { autoGenerateTransferContract } = await import("../../services/autoContractOrchestratorService.js");
    const generation = await autoGenerateTransferContract({
      reservationId,
      activeStay,
      targetRoom: targetRoomDoc,
      targetBed: { id: targetBed.id || String(targetBed._id), label: targetBed.position || "" },
      effectiveTransferDate: req.body.effectiveTransferDate ? new Date(req.body.effectiveTransferDate) : new Date(),
      actorId: actor?._id || null,
    });

    if (!generation.success) {
      return res.status(422).json({
        error: generation.error || "Failed to prepare the room-transfer replacement Contract.",
        code: generation.code || "TRANSFER_CONTRACT_PREPARATION_FAILED",
      });
    }

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      { replacementContractId: generation.replacementContractId },
      `Room-transfer replacement Contract prepared for Room ${targetRoomDoc.roomNumber || targetRoomDoc.name}`,
    );

    res.status(201).json({
      message: "Room-transfer replacement Contract prepared.",
      contractId: generation.replacementContractId,
      contractNumber: generation.contractNumber,
      incomplete: Boolean(generation.incomplete),
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Prepare room transfer contract error");
    await auditLogger.logError(req, error, "Failed to prepare room transfer contract");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || "TRANSFER_CONTRACT_PREPARATION_FAILED" });
    }
    handleReservationError(res, error, "prepare room transfer contract");
  }
};

export const processDepositRefund = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { status = "processed", reference = "", notes = "" } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate("roomId", "branch");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }

    const denied = checkBranchAccess(res, req.branchFilter, reservation.roomId?.branch);
    if (denied) return;

    const actor = await findDbUser(req.user.uid);
    const oldData = reservation.toObject();

    reservation.depositRefundStatus = status;
    reservation.depositRefundReference = String(reference || "").trim();
    reservation.depositRefundProcessedAt = new Date();
    reservation.depositRefundProcessedBy = actor?._id || null;
    if (notes) {
      reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Deposit payout (${status}): ${notes}`;
    }
    await reservation.save();

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Processed deposit refund status to '${status}' with reference '${reference}'`,
    );

    res.json({
      message: `Deposit refund marked as ${status}`,
      reservation: serializeReservation(reservation),
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Process deposit refund error");
    await auditLogger.logError(req, error, "Failed to process deposit refund");
    handleReservationError(res, error, "process deposit refund");
  }
};

/**
 * SCENARIO 1 - Case 1: Post-Approval Transfer Cancellation
 */
export const cancelTransferAction = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const actor = await findDbUser(req.user.uid);
    const result = await cancelTransferStayWorkflow(reservationId, actor?._id);

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      result.reservation.toObject(),
      "Cancelled approved room transfer and released target room lock"
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Cancel transfer error");
    handleReservationError(res, error, "cancel transfer");
  }
};

/**
 * SCENARIO 1 - Case 2: Post-Approval Move-Out Cancellation Conflict Check
 */
export const cancelMoveOutAction = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const actor = await findDbUser(req.user.uid);
    const result = await cancelMoveOutStayWorkflow(reservationId, actor?._id);

    if (result.conflict) {
      return res.status(409).json(result);
    }

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      result.reservation.toObject(),
      "Cancelled move-out request and restored active stay status"
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Cancel move-out error");
    handleReservationError(res, error, "cancel move-out");
  }
};

/**
 * SCENARIO 1 - Case 3: Early Contract Termination
 */
export const earlyTerminationAction = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const {
      penaltyFee = 0,
      forfeitureReason = "early_termination",
      moveOutDate,
      actualVacateTime,
      finalUtilityReading,
      finalNotes,
      keyReturned,
      damageDeductions,
      forceOverride,
    } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const actor = await findDbUser(req.user.uid);
    const result = await executeEarlyTerminationWorkflow(
      reservationId,
      {
        penaltyFee,
        forfeitureReason,
        moveOutDate,
        actualVacateTime,
        finalUtilityReading,
        finalNotes,
        keyReturned,
        damageDeductions,
        forceOverride,
      },
      actor?._id,
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      result.reservation.toObject(),
      `Executed early contract termination with penalty fee PHP ${penaltyFee}`
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Early termination error");
    handleReservationError(res, error, "execute early termination");
  }
};

/**
 * SCENARIO 1 - Case 4: Direct Tenant Room Swap
 */
export const swapRoomsAction = async (req, res, next) => {
  try {
    const { reservationAId, reservationBId } = req.body;
    if (!isValidObjectId(reservationAId) || !isValidObjectId(reservationBId)) {
      return res.status(400).json({ error: "Invalid reservation IDs provided for room swap", code: "INVALID_INPUT" });
    }

    const actor = await findDbUser(req.user.uid);
    const result = await executeDirectRoomSwapWorkflow(
      reservationAId,
      reservationBId,
      actor?._id,
      req.branchFilter,
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationAId,
      {},
      result,
      `Executed direct room swap between reservation ${reservationAId} and ${reservationBId}`
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Direct room swap error");
    handleReservationError(res, error, "execute room swap");
  }
};

/**
 * SCENARIO 1 - Case 5: Abandonment Protocol Trigger
 */
export const triggerAbandonmentAction = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const actor = await findDbUser(req.user.uid);
    const result = await executeAbandonmentProtocolWorkflow(reservationId, req.body, actor?._id);

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      {},
      result.reservation.toObject(),
      "Triggered unannounced tenant abandonment protocol"
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Abandonment protocol error");
    handleReservationError(res, error, "trigger abandonment protocol");
  }
};

/**
 * SCENARIO 1 - Case 6: Validate Extension Conflict
 */
export const checkExtensionConflictAction = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { requestedEndDate } = req.query;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);
    if (!requestedEndDate) {
      return res.status(400).json({ error: "requestedEndDate parameter is required", code: "INVALID_INPUT" });
    }

    const result = await validateContractExtensionWorkflow(reservationId, requestedEndDate);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Extension conflict check error");
    handleReservationError(res, error, "check contract extension conflict");
  }
};

