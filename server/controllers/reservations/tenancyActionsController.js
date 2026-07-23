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
import {
  renewStayWorkflow,
  moveOutStayWorkflow,
  transferStayWorkflow,
} from "../../utils/tenantActionService.js";
import { resolveArchivedRestoreStatus } from "../../utils/reservationArchive.js";
import {
  POPULATE_USER,
  POPULATE_ROOM,
  findDbUser,
  serializeReservation,
} from "./_helpers.js";

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

    const { Stay } = await import("../../models/index.js");
    const actor = await findDbUser(req.user.uid);
    const previousStaySnapshot = await Stay.findOne({
      reservationId,
      status: "active",
    }).lean();
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
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Transfer error");
    await auditLogger.logError(req, error, "Failed to transfer tenant");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || "TRANSFER_FAILED" });
    }
    handleReservationError(res, error, "transfer");
  }
};
