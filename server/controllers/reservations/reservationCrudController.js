/**
 * ============================================================================
 * RESERVATION CRUD CONTROLLER
 * ============================================================================
 *
 * Handles creation, retrieval, deletion, and tenant contract queries.
 */

import dayjs from "dayjs";
import { Reservation, Room, User } from "../../models/index.js";
import { isOwnerRole, isAdminRole } from "../../config/roles.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
  validateMoveInDate,
  syncReservationUserLifecycle,
} from "../../utils/reservationHelpers.js";
import { updateOccupancyOnReservationChange } from "../../utils/occupancyManager.js";
import {
  CURRENT_RESIDENT_STATUS_QUERY,
  normalizeReservationPayload,
  reservationStatusesForQuery,
  serializeReservation,
  serializeReservations,
  readMoveInDate,
} from "../../utils/lifecycleNaming.js";
import {
  HEAVY_FIELDS,
  ADMIN_LIST_FIELDS,
  POPULATE_USER,
  POPULATE_ROOM,
  BED_UNAVAILABLE_MESSAGE,
  APPLICANT_CREATE_ALLOWED_FIELDS,
  findDbUser,
  pickAllowedFields,
  deriveViewingPreference,
  deriveViewingType,
  buildReservationPricing,
  loadReservableRoom,
  ensureRoomReservationCapacity,
  isActiveBedAssignmentDuplicateError,
  isActiveUserReservationDuplicateError,
  validateSelectedBedForReservation,
} from "./_helpers.js";
import { releaseOrphanedBeds } from "../../services/occupancy/occupancyManager.js";
import { buildPricingDisplay } from "../../services/contractPricingResolver.js";
import { getBusinessSettings } from "../../utils/businessSettings.js";

const attachPricingDisplay = (serializedReservation, rawReservation, settings) => {
  if (!serializedReservation) return serializedReservation;
  serializedReservation.pricingDisplay = buildPricingDisplay({
    reservation: rawReservation,
    room: rawReservation?.roomId,
    settings,
  });
  return serializedReservation;
};

export const getReservations = async (req, res) => {
  try {
    const isAdminListView = req.query.view === "admin-list";
    const archiveFilter = String(req.query.archive || "active").toLowerCase();
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const archiveQuery =
      isAdminListView && archiveFilter === "archived"
        ? { isArchived: true }
        : isAdminListView && archiveFilter === "all"
          ? {}
          : { isArchived: { $ne: true } };

    let query;
    if (isOwnerRole(dbUser.role)) {
      query = { ...archiveQuery };
    } else if (dbUser.role === "branch_admin") {
      const roomIds = (
        await Room.find({ branch: dbUser.branch }).select("_id")
      ).map((r) => r._id);
      query = { roomId: { $in: roomIds }, ...archiveQuery };
    } else {
      query = { userId: dbUser._id, isArchived: { $ne: true } };
    }

    let reservationsQuery = Reservation.find(query)
      .populate(
        ...(isAdminListView ? ["userId", "firstName lastName email phone"] : POPULATE_USER),
      )
      .populate(
        ...(isAdminListView ? ["roomId", "name branch type"] : POPULATE_ROOM),
      )
      .sort({ createdAt: -1 });

    if (isAdminListView) {
      reservationsQuery = reservationsQuery
        .populate("archivedBy", "firstName lastName email role")
        .populate("cancelledBy", "firstName lastName email role")
        .populate("cancellationRequestedBy", "firstName lastName email role")
        .populate("cancellationReviewedBy", "firstName lastName email role")
        .select(ADMIN_LIST_FIELDS)
        .lean();
    } else {
      reservationsQuery = reservationsQuery.select(HEAVY_FIELDS);
    }

    const reservations = await reservationsQuery;
    const serialized = serializeReservations(reservations);

    if (!isAdminListView) {
      const settings = await getBusinessSettings();
      serialized.forEach((entry, index) =>
        attachPricingDisplay(entry, reservations[index], settings),
      );
    }

    res.json(serialized);
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Fetch reservations error");
    handleReservationError(res, error, "fetch");
  }
};

export const getReservationById = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId)
      .populate(...POPULATE_USER)
      .populate(...POPULATE_ROOM)
      .populate("archivedBy", "firstName lastName email role")
      .populate("cancelledBy", "firstName lastName email role")
      .populate("cancellationRequestedBy", "firstName lastName email role")
      .populate("cancellationReviewedBy", "firstName lastName email role");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    if (
      !isAdminRole(dbUser.role) &&
      String(reservation.userId?._id) !== String(dbUser._id)
    ) {
      return res.status(403).json({
        error: "Access denied. You can only view your own reservations.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    if (
      isAdminRole(dbUser.role) &&
      !isOwnerRole(dbUser.role) &&
      reservation.roomId?.branch !== dbUser.branch
    ) {
      return res.status(403).json({
        error: `Access denied. You can only view reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    if (isAdminRole(dbUser.role) && !reservation.isViewedByAdmin) {
      reservation.isViewedByAdmin = true;
      reservation.adminViewedAt = new Date();
      await reservation.save().catch((err) => {
        logger.warn({ err, reservationId }, "Failed to update isViewedByAdmin on reservation view");
      });
    }

    const settings = await getBusinessSettings();
    res.json(attachPricingDisplay(serializeReservation(reservation), reservation, settings));
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Fetch reservation error");
    handleReservationError(res, error, "fetch");
  }
};

export const createReservation = async (req, res) => {
  try {
    const payload = normalizeReservationPayload(
      pickAllowedFields(req.body, APPLICANT_CREATE_ALLOWED_FIELDS),
    );
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res.status(404).json({
        error:
          "User not found in database. Please complete registration first.",
        code: "USER_NOT_FOUND",
      });

    const existingActive = await Reservation.findOne({
      userId: dbUser._id,
      status: {
        $nin: reservationStatusesForQuery("cancelled", "archived", "moveOut", "rejected"),
      },
      isArchived: { $ne: true },
    });
    if (existingActive)
      return res.status(400).json({
        error:
          "You already have an active reservation. Please complete or cancel it before creating a new one.",
        code: "RESERVATION_ALREADY_EXISTS",
        existingReservationId: existingActive._id,
        existingStatus: existingActive.status,
      });

    const { roomId, roomName, roomNumber, moveInDate } = payload;
    if ((!roomId && !roomNumber && !roomName) || !moveInDate)
      return res.status(400).json({
        error:
          "Missing required fields: roomId, roomNumber, or roomName plus moveInDate are required",
        code: "MISSING_REQUIRED_FIELDS",
      });

    if (!validateMoveInDate(moveInDate))
      return res.status(400).json({
        error: "Move-in date must be within 3 months from today.",
        code: "MOVEIN_DATE_OUT_OF_RANGE",
      });

    if (dayjs(moveInDate).isBefore(dayjs().add(3, "day").startOf("day")))
      return res.status(400).json({
        error: "Move-in date must be at least 3 days from today.",
        code: "MOVEIN_DATE_TOO_SOON",
      });

    let room = null;
    try {
      room = await loadReservableRoom({ roomId, roomNumber, roomName });
    } catch (error) {
      if (error?.code === "AMBIGUOUS_ROOM_REFERENCE") {
        return res.status(error.statusCode || 400).json({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
    if (!room)
      return res
        .status(404)
        .json({ error: "Room not found", code: "ROOM_NOT_FOUND" });
    if (room.isArchived)
      return res.status(400).json({
        error: "Room is not available for reservation",
        code: "ROOM_NOT_AVAILABLE",
      });

    const activeReservationCount = await ensureRoomReservationCapacity({
      roomId: room._id,
    });
    if (activeReservationCount >= room.capacity) {
      return res.status(400).json({
        error: "Room is fully booked. Please choose a different room.",
        code: "ROOM_UNAVAILABLE",
      });
    }

    if (!room.available && activeReservationCount < room.capacity) {
      await Room.findByIdAndUpdate(room._id, {
        currentOccupancy: activeReservationCount,
        available: true,
      });
      logger.info(
        { roomId: room._id, activeReservationCount },
        "Auto-healed stale room.available flag during reservation creation",
      );
    }

    let selectedBed = null;
    try {
      selectedBed = await validateSelectedBedForReservation({
        room,
        submittedBed: payload.selectedBed,
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

    const pricing = await buildReservationPricing({
      room,
      leaseDuration: payload.leaseDuration,
      selectedAppliances: payload.selectedAppliances,
    });

    const b = payload;
    const viewingPreference = deriveViewingPreference(null, b);
    const reservation = new Reservation({
      userId: dbUser._id,
      roomId: room._id,
      selectedBed,
      // intendedMoveInDate = canonical field for tenant's desired move-in date (Step 1).
      // targetMoveInDate kept for backward compat with older records.
      intendedMoveInDate: b.moveInDate
        ? new Date(b.moveInDate)
        : b.targetMoveInDate
          ? new Date(b.targetMoveInDate)
          : null,
      targetMoveInDate: b.targetMoveInDate
        ? new Date(b.targetMoveInDate)
        : null,
      leaseDuration: b.leaseDuration || null,
      billingEmail: (() => {
        const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const raw = (b.billingEmail || "").toLowerCase().trim();
        // Fall back silently to user email if submitted billingEmail is malformed.
        const resolved = (raw && BASIC_EMAIL_RE.test(raw)) ? raw : (dbUser.email ?? "").toLowerCase().trim();
        return resolved || null;
      })(),
      roomConfirmed: b.roomConfirmed === true,
      viewingPreference,
      viewingType: deriveViewingType(viewingPreference) || b.viewingType || null,
      isOutOfTown: b.isOutOfTown || false,
      currentLocation: b.currentLocation || null,
      remoteViewingAcknowledged: b.remoteViewingAcknowledged === true,
      remoteViewingQuestions: b.remoteViewingQuestions || "",
      isUrgentMoveIn: b.isUrgentMoveIn === true,
      visitApproved: false,
      selfiePhotoUrl: b.selfiePhotoUrl || null,
      firstName: b.firstName || null,
      lastName: b.lastName || null,
      middleName: b.middleName || null,
      nickname: b.nickname || null,
      mobileNumber: b.mobileNumber || null,
      birthday: b.birthday ? new Date(b.birthday) : null,
      gender: b.gender || null,
      maritalStatus: b.maritalStatus || null,
      nationality: b.nationality || null,
      educationLevel: b.educationLevel || null,
      address: {
        region: b.addressRegion || null,
        unitHouseNo: b.addressUnitHouseNo || null,
        street: b.addressStreet || null,
        barangay: b.addressBarangay || null,
        city: b.addressCity || null,
        province: b.addressProvince || null,
      },
      validIDFrontUrl: b.validIDFrontUrl || null,
      validIDBackUrl: b.validIDBackUrl || null,
      validIDType: b.validIDType || null,
      idType: b.idType || b.validIDType || null,
      nbiClearanceUrl: b.nbiClearanceUrl || null,
      nbiReason: b.nbiReason || null,
      companyIDUrl: b.companyIDUrl || null,
      companyIDReason: b.companyIDReason || null,
      emergencyContact: {
        name: b.emergencyContactName || null,
        relationship: b.emergencyRelationship || null,
        contactNumber: b.emergencyContactNumber || null,
      },
      healthConcerns: b.healthConcerns || null,
      employment: {
        employerSchool: b.employerSchool || null,
        employerAddress: b.employerAddress || null,
        employerContact: b.employerContact || null,
        startDate: b.startDate ? new Date(b.startDate) : null,
        occupation: b.occupation || null,
        previousEmployment: b.previousEmployment || null,
      },
      preferredRoomType: b.roomType || null,
      preferredRoomNumber: b.preferredRoomNumber || null,
      referralSource: b.referralSource || null,
      referrerName: b.referrerName || null,
      estimatedMoveInTime: b.estimatedMoveInTime || null,
      workSchedule: b.workSchedule || null,
      workScheduleOther: b.workScheduleOther || null,
      agreedToPrivacy: b.agreedToPrivacy || false,
      agreedToCertification: b.agreedToCertification || false,
      proofOfPaymentUrl: null,
      reservationFeeAmount: pricing.reservationFeeAmount,
      monthlyRent: pricing.monthlyRent,
      selectedAppliances: pricing.selectedAppliances,
      applianceFees: pricing.applianceFees,
      moveInDate: b.moveInDate,
      moveOutDate: null,
      totalPrice: pricing.totalPrice,
      notes: b.notes || "",
      status: "pending",
      paymentStatus: "pending",
    });

    await reservation.save();
    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);

    try {
      await updateOccupancyOnReservationChange(reservation, null);
    } catch (occupancyErr) {
      logger.warn(
        { err: occupancyErr, reservationId: reservation._id },
        "Occupancy sync on reservation creation failed (non-fatal)",
      );
    }

    await auditLogger.logModification(
      req,
      "reservation",
      reservation._id,
      null,
      reservation.toObject(),
      `Created reservation for room: ${room.name}`,
    );
    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: reservation._id,
      reservationCode: reservation.reservationCode,
      reservation: serializeReservation(reservation),
      pricing: pricing.breakdown,
    });
  } catch (error) {
    if (isActiveBedAssignmentDuplicateError(error)) {
      return res.status(409).json({
        error: BED_UNAVAILABLE_MESSAGE,
        code: "BED_UNAVAILABLE",
      });
    }
    if (isActiveUserReservationDuplicateError(error)) {
      const existingActive = await Reservation.findOne({
        userId: dbUser._id,
        status: {
          $nin: reservationStatusesForQuery("cancelled", "archived", "moveOut", "rejected"),
        },
        isArchived: { $ne: true },
      }).select("_id status").lean();
      return res.status(400).json({
        error: "You already have an active reservation. Please complete or cancel it before creating a new one.",
        code: "RESERVATION_ALREADY_EXISTS",
        existingReservationId: existingActive?._id,
        existingStatus: existingActive?.status,
      });
    }
    logger.error({ err: error, requestId: req.id }, "Create reservation error");
    await auditLogger.logError(req, error, "Failed to create reservation");
    handleReservationError(res, error, "create");
  }
};

export const deleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const isHardDelete = String(req.query?.hardDelete || "").toLowerCase() === "true";
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const reservation =
      await Reservation.findById(reservationId).populate("roomId");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    const isAdmin = isAdminRole(dbUser.role);
    if (!isAdmin)
      return res.status(403).json({
        error: "Access denied. Admin privileges are required to archive or delete reservations.",
        code: "ADMIN_REQUIRED",
      });
    if (
      dbUser.role === "branch_admin" &&
      reservation.roomId?.branch !== dbUser.branch
    ) {
      return res.status(403).json({
        error: `Access denied. You can only delete reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    if (isHardDelete) {
      if (!isOwnerRole(dbUser.role)) {
        return res.status(403).json({
          error: "Access denied. Hard delete is restricted to system owners.",
          code: "OWNER_REQUIRED",
        });
      }

      // Release the bed BEFORE deleting the reservation document so we still have
      // the reservation ID to reference in Room.beds[].occupiedBy.reservationId
      await releaseOrphanedBeds([], [reservationId]).catch((err) =>
        logger.warn(
          { err, reservationId },
          "Hard-delete: bed release failed (non-fatal)",
        )
      );

      await Reservation.findByIdAndDelete(reservationId);
      await auditLogger.logModification(
        req,
        "reservation",
        reservationId,
        reservation.toObject(),
        null,
        "Permanently deleted reservation",
      );

      return res.json({
        message: "Reservation permanently deleted",
        reservationId,
        hardDeleted: true,
      });
    }

    const oldData = reservation.toObject();
    reservation.status = "cancelled";
    reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Soft deleted by admin`;
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
        "Occupancy update during delete failed",
      );
    }

    await reservation.populate(...POPULATE_USER);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      "Reservation soft-deleted (cancelled)",
    );
    res.json({ message: "Reservation deleted successfully", reservation });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Delete reservation error");
    await auditLogger.logError(req, error, "Failed to delete reservation");
    handleReservationError(res, error, "delete");
  }
};

export const getMyContract = async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const user = await findDbUser(firebaseUid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "tenant" || user.tenantStatus !== "active") {
      return res.status(404).json({ error: "No active contract found" });
    }

    const reservation = await Reservation.findOne({
      userId: user._id,
      status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
      isArchived: false,
    }).populate("roomId", "name branch type price floor");

    if (!reservation) {
      return res.status(404).json({ error: "No active contract found" });
    }

    const moveInDate = readMoveInDate(reservation);
    if (!moveInDate) {
      return res.status(404).json({ error: "No active contract found" });
    }

    const now = dayjs();
    const leaseStart = dayjs(moveInDate);
    const leaseDuration = reservation.leaseDuration || 12;
    const leaseEnd = leaseStart.add(leaseDuration, "month");
    const monthsCompleted = Math.min(
      now.diff(leaseStart, "month"),
      leaseDuration,
    );
    const daysRemaining = Math.max(leaseEnd.diff(now, "day"), 0);
    const totalDays = leaseEnd.diff(leaseStart, "day");
    const daysElapsed = now.diff(leaseStart, "day");
    const progressPercent = Math.min(
      Math.round((daysElapsed / totalDays) * 100),
      100,
    );

    let contractStatus = "active";
    if (daysRemaining <= 0) contractStatus = "expired";
    else if (daysRemaining <= 30) contractStatus = "expiring";

    const monthlyRent =
      reservation.monthlyRent ||
      reservation.totalPrice ||
      reservation.roomId?.price ||
      0;

    res.json({
      contractStatus,
      room: reservation.roomId?.name || "N/A",
      bed: reservation.selectedBed?.position || "N/A",
      branch: reservation.roomId?.branch || "N/A",
      roomType: reservation.roomId?.type || "N/A",
      floor: reservation.roomId?.floor || 1,
      monthlyRent,
      leaseStart: leaseStart.format("MMMM D, YYYY"),
      leaseEnd: leaseEnd.format("MMMM D, YYYY"),
      leaseDuration,
      monthsCompleted,
      daysRemaining,
      progressPercent,
      reservationId: reservation._id,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Get contract error");
    res.status(500).json({ error: "Failed to fetch contract" });
  }
};
