/**
 * ============================================================================
 * TENANT WORKSPACE CONTROLLER
 * ============================================================================
 *
 * Controller for tenant workspace queries, active resident status, and action context.
 */

import { Reservation, Room } from "../../models/index.js";
import { ROOM_BRANCHES } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import { sendSuccess, sendError, AppError } from "../../middleware/errorHandler.js";
import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
  reconcileTenantUsersForScope,
} from "../../utils/reservationHelpers.js";
import {
  CURRENT_RESIDENT_STATUS_QUERY,
} from "../../utils/lifecycleNaming.js";
import {
  buildTenantWorkspaceStats,
} from "../../utils/tenantWorkspace.js";
import { getTenantActionContext as loadTenantActionContext } from "../../utils/tenantActionService.js";
import {
  CURRENT_RESIDENT_FIELDS,
  CURRENT_RESIDENT_USER,
  CURRENT_RESIDENT_ROOM,
  TENANT_WORKSPACE_FIELDS,
  TENANT_WORKSPACE_USER,
  TENANT_WORKSPACE_ROOM,
  findDbUser,
  mapCurrentResident,
  buildResidentStats,
  buildWorkspaceRoomQuery,
  getTenantWorkspaceReservations,
  buildWorkspaceEntries,
  buildTenantWorkspaceEntry,
} from "./_helpers.js";

export const getCurrentResidents = async (req, res) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const requestedBranch = req.query.branch;
    if (
      requestedBranch &&
      requestedBranch !== "all" &&
      !ROOM_BRANCHES.includes(requestedBranch)
    ) {
      return res.status(400).json({
        error: `Invalid branch. Must be one of: ${ROOM_BRANCHES.join(", ")}`,
        code: "INVALID_BRANCH",
      });
    }

    let roomQuery = {};
    if (dbUser.role === "branch_admin") {
      roomQuery.branch = dbUser.branch;
    } else if (requestedBranch && requestedBranch !== "all") {
      roomQuery.branch = requestedBranch;
    }

    await reconcileTenantUsersForScope({
      branch: roomQuery.branch || null,
    });

    const roomIds = await Room.find(roomQuery).distinct("_id");
    const reservations = await Reservation.find({
      status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
      roomId: { $in: roomIds },
      isArchived: { $ne: true },
    })
      .select(CURRENT_RESIDENT_FIELDS)
      .populate(...CURRENT_RESIDENT_USER)
      .populate(...CURRENT_RESIDENT_ROOM)
      .sort({ moveInDate: -1 })
      .lean();

    const now = new Date();
    const residents = reservations.map((reservation) =>
      mapCurrentResident(reservation, now),
    );

    return sendSuccess(res, {
      residents,
      stats: buildResidentStats(residents),
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Fetch current residents error",
    );
    return handleReservationError(res, error, "fetch");
  }
};

export const getTenantWorkspace = async (req, res) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const roomQuery = await buildWorkspaceRoomQuery({
      dbUser,
      requestedBranch: req.query.branch,
    });

    await reconcileTenantUsersForScope({
      branch: roomQuery.branch || null,
    });

    const reservations = await getTenantWorkspaceReservations({ roomQuery });
    const tenants = await buildWorkspaceEntries(reservations, new Date());

    return sendSuccess(res, {
      tenants,
      stats: buildTenantWorkspaceStats(tenants),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(
        res,
        error.message,
        error.statusCode,
        error.code,
        error.details,
      );
    }
    logger.error(
      { err: error, requestId: req.id },
      "Fetch tenant workspace error",
    );
    return handleReservationError(res, error, "fetch");
  }
};

export const getTenantWorkspaceById = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const reservation = await Reservation.findById(reservationId)
      .select(TENANT_WORKSPACE_FIELDS)
      .populate(...TENANT_WORKSPACE_USER)
      .populate(...TENANT_WORKSPACE_ROOM)
      .lean();
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (
      dbUser.role === "branch_admin" &&
      reservation.roomId?.branch !== dbUser.branch
    ) {
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    const { Bill, BedHistory, Stay } = await import("../../models/index.js");
    const [bills, bedHistoryRecords, stayHistory, branchRooms] = await Promise.all([
      Bill.find({
        reservationId: reservation._id,
        isArchived: { $ne: true },
      }).lean(),
      BedHistory.find({
        $or: [
          { reservationId: reservation._id },
          { tenantId: reservation.userId?._id || reservation.userId },
        ],
      })
        .populate("roomId", "name branch")
        .sort({ moveInDate: -1 })
        .lean(),
      Stay.find({ reservationId: reservation._id })
        .sort({ leaseStartDate: -1, createdAt: -1 })
        .lean(),
      Room.find({
        branch: reservation.roomId?.branch || "",
        isArchived: { $ne: true },
      })
        .select("_id beds")
        .lean(),
    ]);
    const currentStay =
      stayHistory.find((stay) => stay.status === "active") ||
      stayHistory[0] ||
      null;
    const hasAvailableBedsInBranch = branchRooms.some((room) => {
      const availableBeds = (room.beds || [])
        .filter((bed) => bed.status === "available")
        .map((bed) => bed.id || String(bed._id));
      return (
        availableBeds.length > 0 &&
        (String(room._id) !== String(currentStay?.roomId || reservation.roomId?._id || "") ||
          availableBeds.some((bedId) => String(bedId) !== String(currentStay?.bedId || reservation.selectedBed?.id || "")))
      );
    });

    const tenant = buildTenantWorkspaceEntry({
      reservation,
      currentStay,
      stayHistory,
      bills,
      bedHistoryRecords,
      tenantStatus: reservation.userId?.tenantStatus || "applicant",
      hasAvailableBedsInBranch,
      now: new Date(),
    });

    return sendSuccess(res, tenant);
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(
        res,
        error.message,
        error.statusCode,
        error.code,
        error.details,
      );
    }
    logger.error(
      { err: error, requestId: req.id },
      "Fetch tenant workspace detail error",
    );
    return handleReservationError(res, error, "fetch");
  }
};

export const getTenantActionContext = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }
    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const context = await loadTenantActionContext(reservationId);
    if (!context) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }
    if (dbUser.role === "branch_admin" && context.currentStay.branch !== dbUser.branch) {
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    return sendSuccess(res, context);
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Fetch tenant action context error");
    return handleReservationError(res, error, "fetch");
  }
};
