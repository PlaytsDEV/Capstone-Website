import mongoose from "mongoose";
import dayjs from "dayjs";
import logger from "../middleware/logger.js";
import {
  AuditLog,
  BedHistory,
  Bill,
  Contract,
  Reservation,
  Room,
  Stay,
  User,
  UtilityPeriod,
  UtilityReading,
} from "../models/index.js";
import {
  buildBillingSummary,
  computeLeaseEndDate,
} from "./tenantWorkspace.js";
import {
  CURRENT_RESIDENT_STATUS_QUERY,
  hasReservationStatus,
  readMoveInDate,
  utilityEventTypesForQuery,
} from "./lifecycleNaming.js";
import { resolveSecurityDeposit } from "./depositUtils.js";
import {
  activateRoomTransferSuccessor,
  resolveRoomTransferSuccessor,
} from "../services/contractRoomTransferActivationService.js";
import { resolveCurrentBillingCycle } from "../services/billing/billingPolicy.js";
import {
  CURRENT_STAY_STATUSES,
  resolveCurrentStayForReservation,
  resolveAuthoritativeCurrentContract,
} from "../services/tenantContractSelectionService.js";
import { calculateRoomTransferRentSettlement } from "../services/billing/roomTransferSettlement.js";
import {
  resolveApplicablePrepaidRentForTransfer,
  resolveSourceEffectiveRentForTransfer,
} from "../services/billing/prepaidRentResolver.js";
import { createNotification } from "../services/notifications/notificationService.js";

const normalizeDate = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
};

const parseDateTime = (dateInput, timeInput = "") => {
  const base = new Date(dateInput || Date.now());
  if (Number.isNaN(base.getTime())) return null;
  if (!timeInput) return base;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(timeInput).trim());
  if (!match) return null;
  base.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return base;
};

export const getMonthlyRent = (reservation) =>
  Number(reservation?.monthlyRent ?? reservation?.roomId?.monthlyPrice ?? reservation?.roomId?.price ?? 0);

async function ensureActiveStay(reservation, actorId = null, session = null) {
  const existingStay = await resolveCurrentStayForReservation(reservation._id, { session });
  if (existingStay) return existingStay;

  const moveInDate = readMoveInDate(reservation);
  const leaseEndDate = computeLeaseEndDate(reservation);
  if (!moveInDate || !leaseEndDate) return null;

  const stay = await Stay.create(
    [
      {
        tenantId: reservation.userId?._id || reservation.userId,
        reservationId: reservation._id,
        branch: reservation.roomId?.branch || "",
        roomId: reservation.roomId?._id || reservation.roomId,
        bedId: reservation.selectedBed?.id || "",
        leaseStartDate: moveInDate,
        leaseEndDate,
        monthlyRent: getMonthlyRent(reservation),
        status: hasReservationStatus(reservation.status, "moveOut") ? "completed" : "active",
        endedAt: hasReservationStatus(reservation.status, "moveOut") ? reservation.moveOutDate || null : null,
        endReason: hasReservationStatus(reservation.status, "moveOut") ? "legacy_move_out" : "",
        createdBy: actorId,
        updatedBy: actorId,
      },
    ],
    { session },
  );

  reservation.currentStayId = stay[0]._id;
  reservation.latestStayStatus = stay[0].status;
  await reservation.save({ session });

  return stay[0];
}

async function getAvailableRoomsForStay(stay, excludeCurrent = false) {
  if (!stay?.branch) return [];
  const rooms = await Room.find({
    branch: stay.branch,
    isArchived: { $ne: true },
    available: true,
  })
    .select("name roomNumber branch beds")
    .lean();

  return rooms
    .map((room) => ({
      id: String(room._id),
      name: room.name || room.roomNumber,
      branch: room.branch,
      beds: (room.beds || [])
        .filter((bed) => bed.status === "available")
        .map((bed) => ({
          id: bed.id || String(bed._id),
          position: bed.position || bed.id || "",
        })),
    }))
    .filter((room) => room.beds.length > 0)
    .filter((room) => !excludeCurrent || String(room.id) !== String(stay.roomId));
}

async function buildActionAvailability({ reservation, stay, billingSummary }) {
  const tenant = await User.findById(reservation.userId).select("tenantStatus").lean();
  const transferRooms = stay ? await getAvailableRoomsForStay(stay, false) : [];
  const hasAvailableBedsInBranch = transferRooms.some((room) =>
    room.beds.some(
      (bed) => String(room.id) !== String(stay?.roomId) || String(bed.id) !== String(stay?.bedId),
    ),
  );
  const activeStay = Boolean(stay && CURRENT_STAY_STATUSES.includes(stay.status));
  const tenantIsInactive = ["inactive", "moved_out"].includes(String(tenant?.tenantStatus || ""));
  const renewalExists = stay
    ? await Stay.exists({
        reservationId: reservation._id,
        previousStayId: stay._id,
        status: { $in: ["active", "ending_soon"] },
      })
    : false;

  const disabled = (reason, blockingCode) => ({
    enabled: false,
    reason,
    blockingCodes: [blockingCode],
  });

  return {
    renew: !activeStay
      ? disabled("Only active stays can be renewed.", "NO_ACTIVE_STAY")
      : tenantIsInactive
        ? disabled("Inactive or moved-out tenants cannot be renewed.", "TENANT_INACTIVE")
        : renewalExists
          ? disabled("A future renewal already exists for this tenant.", "FUTURE_RENEWAL_EXISTS")
          : { enabled: true, reason: "", blockingCodes: [] },
    transfer: !activeStay
      ? { ...disabled("Only active stays can be transferred.", "NO_ACTIVE_STAY"), hasAvailableBedsInBranch }
      : tenantIsInactive
        ? { ...disabled("Inactive or moved-out tenants cannot be transferred.", "TENANT_INACTIVE"), hasAvailableBedsInBranch }
        : hasAvailableBedsInBranch
          ? { enabled: true, reason: "", blockingCodes: [], hasAvailableBedsInBranch }
          : { ...disabled("No available same-branch bed is available for transfer.", "NO_AVAILABLE_BED"), hasAvailableBedsInBranch },
    moveOut: !activeStay
      ? disabled("Only active stays can be moved out.", "NO_ACTIVE_STAY")
      : tenantIsInactive
        ? disabled("Tenant is already inactive or moved out.", "TENANT_INACTIVE")
        : {
            enabled: true,
            reason: billingSummary.hasOutstanding || billingSummary.hasPendingVerification
              ? "Outstanding billing will remain for final settlement after move-out."
              : "",
            blockingCodes: [],
          },
  };
}

export async function getTenantActionContext(reservationId) {
  const reservation = await Reservation.findById(reservationId)
    .populate("roomId", "name roomNumber branch beds monthlyPrice price")
    .populate("userId", "firstName lastName email phone tenantStatus")
    .lean();
  if (!reservation) return null;

  const activeStay =
    (await resolveCurrentStayForReservation(reservationId).lean()) || reservation;

  const stayLike = activeStay._id && activeStay.leaseStartDate
    ? activeStay
    : {
        _id: reservation.currentStayId || null,
        roomId: reservation.roomId?._id || reservation.roomId,
        bedId: reservation.selectedBed?.id || "",
        branch: reservation.roomId?.branch || "",
        leaseStartDate: readMoveInDate(reservation),
        leaseEndDate: computeLeaseEndDate(reservation),
        status: hasReservationStatus(reservation.status, "moveOut") ? "completed" : "active",
      };

  const sourceRoomId = reservation.roomId?._id || reservation.roomId;

  const [bills, renewalHistory, availableRooms, sourceRoomLatestReading, activeUtilityPeriod] = await Promise.all([
    Bill.find({
      reservationId,
      isArchived: { $ne: true },
    }).lean(),
    Stay.find({ reservationId }).sort({ leaseStartDate: -1 }).lean(),
    getAvailableRoomsForStay(stayLike, false),
    // Fetch the latest meter reading for the source room (any tenant) — this is
    // the true billing baseline the engine uses, not restricted to current tenant.
    UtilityReading.findOne({
      roomId: sourceRoomId,
      utilityType: "electricity",
      isArchived: false,
    })
      .sort({ date: -1, createdAt: -1 })
      .lean(),
    // Fetch the active electricity UtilityPeriod for this room to expose ratePerUnit
    // to the frontend for live settlement cost estimation.
    UtilityPeriod.findOne({
      roomId: sourceRoomId,
      utilityType: "electricity",
      status: "open",
    })
      .sort({ startDate: -1 })
      .select("ratePerUnit")
      .lean(),
  ]);

  const billingSummary = buildBillingSummary(bills);
  const allowedActions = await buildActionAvailability({
    reservation,
    stay: stayLike,
    billingSummary,
  });

  return {
    reservationId: String(reservation._id),
    tenantId: String(reservation.userId?._id || reservation.userId || ""),
    tenantName:
      `${reservation.userId?.firstName || reservation.firstName || ""} ${reservation.userId?.lastName || reservation.lastName || ""}`.trim(),
    tenantStatus: reservation.userId?.tenantStatus || "applicant",
    currentStay: {
      id: String(stayLike._id || ""),
      status: stayLike.status || "active",
      leaseStartDate: stayLike.leaseStartDate || readMoveInDate(reservation),
      leaseEndDate: stayLike.leaseEndDate || computeLeaseEndDate(reservation),
      monthlyRent: Number(stayLike.monthlyRent ?? getMonthlyRent(reservation)),
      branch: stayLike.branch || reservation.roomId?.branch || "",
      roomId: String(stayLike.roomId || reservation.roomId?._id || ""),
      room: reservation.roomId?.name || reservation.roomId?.roomNumber || "",
      bedId: stayLike.bedId || reservation.selectedBed?.id || "",
      bed: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
    },
    billingSummary,
    // Renamed from latestUtilityReading — now returns the room-level baseline
    // (not tenant-filtered) so the Transfer modal can pre-fill the source meter.
    sourceRoomLatestReading: sourceRoomLatestReading
      ? {
          reading: sourceRoomLatestReading.reading,
          date: sourceRoomLatestReading.date,
          eventType: sourceRoomLatestReading.eventType,
          roomId: String(sourceRoomId),
        }
      : null,
    // Keep legacy alias so any existing consumers don't break.
    latestUtilityReading: sourceRoomLatestReading
      ? {
          reading: sourceRoomLatestReading.reading,
          date: sourceRoomLatestReading.date,
          eventType: sourceRoomLatestReading.eventType,
        }
      : null,
    // The active ₱/kWh electricity rate for this room — used by the frontend
    // wizard to compute live settlement estimates without a full billing pass.
    electricityRatePerUnit: Number(activeUtilityPeriod?.ratePerUnit ?? 0) || null,
    availableRooms,
    allowedActions,
    renewalHistory: renewalHistory.map((stay) => ({
      id: String(stay._id),
      status: stay.status,
      leaseStartDate: stay.leaseStartDate,
      leaseEndDate: stay.leaseEndDate,
      monthlyRent: stay.monthlyRent,
      previousStayId: stay.previousStayId ? String(stay.previousStayId) : null,
      endedAt: stay.endedAt || null,
    })),
  };
}

export async function renewStayWorkflow({ reservationId, payload, actorId }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const reservation = await Reservation.findById(reservationId)
        .populate("roomId", "name roomNumber branch monthlyPrice price")
        .populate("userId", "firstName lastName email tenantStatus")
        .session(session);
      if (!reservation) {
        throw Object.assign(new Error("Reservation not found"), { statusCode: 404, code: "RESERVATION_NOT_FOUND" });
      }
      if (!hasReservationStatus(reservation.status, "moveIn")) {
        throw Object.assign(new Error("Only active moved-in tenants can be renewed."), { statusCode: 400, code: "INVALID_STATUS_FOR_RENEWAL" });
      }

      const activeStay = await ensureActiveStay(reservation, actorId, session);
      if (!activeStay || !CURRENT_STAY_STATUSES.includes(activeStay.status)) {
        throw Object.assign(new Error("No active stay found for renewal."), { statusCode: 400, code: "NO_ACTIVE_STAY" });
      }
      if (["inactive", "moved_out"].includes(String(reservation.userId?.tenantStatus || ""))) {
        throw Object.assign(new Error("Inactive or moved-out tenants cannot be renewed."), { statusCode: 400, code: "TENANT_INACTIVE" });
      }
      if (!payload?.confirm) {
        throw Object.assign(new Error("Renewal confirmation is required."), { statusCode: 400, code: "CONFIRM_REQUIRED" });
      }

      const newLeaseStartDate = normalizeDate(payload.newLeaseStartDate);
      const newLeaseEndDate = normalizeDate(payload.newLeaseEndDate, true);
      if (!newLeaseStartDate || !newLeaseEndDate || newLeaseEndDate <= newLeaseStartDate) {
        throw Object.assign(new Error("Valid renewal start and end dates are required."), { statusCode: 400, code: "INVALID_RENEWAL_DATES" });
      }
      if (!dayjs(newLeaseStartDate).isAfter(dayjs(activeStay.leaseEndDate), "day")) {
        throw Object.assign(new Error("Renewal start date must be after the current lease end date."), { statusCode: 400, code: "RENEWAL_START_OVERLAP" });
      }

      const overlap = await Stay.findOne({
        tenantId: reservation.userId?._id || reservation.userId,
        _id: { $ne: activeStay._id },
        leaseStartDate: { $lte: newLeaseEndDate },
        leaseEndDate: { $gte: newLeaseStartDate },
      }).session(session);
      if (overlap) {
        throw Object.assign(new Error("The renewal dates overlap an existing stay record."), { statusCode: 409, code: "STAY_DATE_OVERLAP" });
      }

      const existingFutureRenewal = await Stay.findOne({
        reservationId: reservation._id,
        previousStayId: activeStay._id,
      }).session(session);
      if (existingFutureRenewal) {
        throw Object.assign(new Error("A future renewal already exists for this tenant."), { statusCode: 409, code: "FUTURE_RENEWAL_EXISTS" });
      }

      activeStay.status = "renewed";
      activeStay.endedAt = newLeaseStartDate;
      activeStay.endReason = "renewed";
      activeStay.renewalNotes = payload.notes || "";
      activeStay.updatedBy = actorId;
      await activeStay.save({ session });

      const [newStay] = await Stay.create(
        [
          {
            tenantId: reservation.userId?._id || reservation.userId,
            reservationId: reservation._id,
            branch: reservation.roomId?.branch || "",
            roomId: reservation.roomId?._id || reservation.roomId,
            bedId: reservation.selectedBed?.id || "",
            leaseStartDate: newLeaseStartDate,
            leaseEndDate: newLeaseEndDate,
            monthlyRent: Number(payload.monthlyRent ?? getMonthlyRent(reservation)),
            status: "active",
            previousStayId: activeStay._id,
            renewalOfferId: payload.renewalOfferId || null,
            renewalNotes: payload.notes || "",
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        { session },
      );

      const activeHistory = await BedHistory.findOne({
        reservationId: reservation._id,
        tenantId: reservation.userId?._id || reservation.userId,
        status: "active",
      })
        .sort({ moveInDate: -1 })
        .session(session);
      if (activeHistory && !activeHistory.stayId) {
        activeHistory.stayId = newStay._id;
        await activeHistory.save({ session });
      }

      reservation.currentStayId = newStay._id;
      reservation.latestStayStatus = "active";
      // Deliberately NOT updating reservation.monthlyRent here — it remains
      // the billing source of truth for the CURRENT (pre-renewal) period.
      // rentGenerator.resolveReservationRentAmount reads it live at bill
      // generation time, which can happen up to RENT_GENERATION_LEAD_DAYS
      // before a cycle even starts, so writing the new rate immediately at
      // acceptance (often weeks before newLeaseStartDate) would let it leak
      // into current-period bills. The approved new rate is already
      // durably captured on the renewal successor Contract's
      // approvedMonthlyRate (createSuccessorContractForRenewal /
      // autoGenerateRenewalContract, triggered below) and is applied to
      // reservation.monthlyRent exactly once, atomically, by
      // contractRenewalActivationService.activateDueRenewalContracts at the
      // successor's actual leaseStartDate.
      await reservation.save({ session });

      result = {
        reservation,
        previousStay: activeStay.toObject(),
        stay: newStay.toObject(),
      };
    });
  } finally {
    await session.endSession();
  }

  // ── Automated Renewal Successor Contract Generation ──────────────────────
  // Fire-and-forget, mirrors transferStayWorkflow's post-transaction contract
  // trigger below. Never touches the old Contract's status/isCurrent — see
  // createSuccessorContractForRenewal's comment (contractService.js).
  if (result) {
    try {
      const oldContract = await resolveAuthoritativeCurrentContract({
        reservationId: result.reservation._id,
        tenantId: result.reservation.userId?._id || result.reservation.userId,
      });
      if (oldContract) {
        const { autoGenerateRenewalContract } = await import("../services/autoContractOrchestratorService.js");
        autoGenerateRenewalContract({
          reservationId: result.reservation._id,
          oldContract,
          newStay: result.stay,
          actorId,
        }).catch((err) => {
          logger.warn({ err, reservationId }, "[RenewalWorkflow] Background successor contract auto-generation failed (non-fatal)");
        });
      } else {
        logger.warn({ reservationId }, "[RenewalWorkflow] Renewal successor contract skipped: no current Contract found");
      }
    } catch (contractImportErr) {
      logger.warn({ err: contractImportErr }, "[RenewalWorkflow] Auto contract orchestrator invocation error");
    }
  }

  return result;
}

export async function transferStayWorkflow({ reservationId, payload, actorId }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const reservation = await Reservation.findById(reservationId)
        .populate("roomId", "name roomNumber branch beds currentOccupancy capacity")
        .populate("userId", "firstName lastName email tenantStatus")
        .session(session);
      if (!reservation) {
        throw Object.assign(new Error("Reservation not found"), { statusCode: 404, code: "RESERVATION_NOT_FOUND" });
      }
      if (!hasReservationStatus(reservation.status, "moveIn")) {
        throw Object.assign(new Error("Only active moved-in tenants can be transferred."), { statusCode: 400, code: "INVALID_STATUS_FOR_TRANSFER" });
      }
      if (!payload?.confirm) {
        throw Object.assign(new Error("Transfer confirmation is required."), { statusCode: 400, code: "CONFIRM_REQUIRED" });
      }

      // ── Outstanding Balance Guard ─────────────────────────────────────────
      // Block the transfer if the tenant has unpaid bills unless the admin
      // explicitly acknowledges and sets forceOverride: true.
      const bills = await Bill.find({
        reservationId: reservation._id,
        isArchived: { $ne: true },
      }).session(session).lean();
      const billingSummary = buildBillingSummary(bills);
      if (billingSummary.hasOutstanding && !payload.forceOverride) {
        const formattedBalance = Number(billingSummary.currentBalance).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        throw Object.assign(
          new Error(
            `Tenant has ₱${formattedBalance} in outstanding balance. Settle before transfer, or acknowledge and force-proceed.`,
          ),
          {
            statusCode: 409,
            code: "OUTSTANDING_BILLS_BLOCKING_TRANSFER",
            outstandingBalance: billingSummary.currentBalance,
            paymentStatus: billingSummary.paymentStatus,
          },
        );
      }

      const activeStay = await ensureActiveStay(reservation, actorId, session);
      const effectiveTransferDate = normalizeDate(payload.effectiveTransferDate) || new Date();
      if (!activeStay || !CURRENT_STAY_STATUSES.includes(activeStay.status)) {
        throw Object.assign(new Error("No active stay found for transfer."), { statusCode: 400, code: "NO_ACTIVE_STAY" });
      }

      if (!payload.targetRoomId || !payload.targetBedId) {
        throw Object.assign(new Error("Target room and bed are required."), { statusCode: 400, code: "MISSING_TRANSFER_FIELDS" });
      }
      if (
        String(activeStay.roomId) === String(payload.targetRoomId) &&
        String(activeStay.bedId) === String(payload.targetBedId)
      ) {
        throw Object.assign(new Error("Transfer target must differ from the current room and bed."), { statusCode: 400, code: "SAME_TRANSFER_TARGET" });
      }

      const targetRoom = await Room.findById(payload.targetRoomId).session(session);
      if (!targetRoom) {
        throw Object.assign(new Error("Target room not found."), { statusCode: 404, code: "TARGET_ROOM_NOT_FOUND" });
      }
      if (String(targetRoom.branch) !== String(reservation.roomId?.branch || "")) {
        throw Object.assign(new Error("Transfers are limited to rooms within the same branch."), { statusCode: 400, code: "CROSS_BRANCH_TRANSFER_NOT_ALLOWED" });
      }

      const targetBed = targetRoom.beds.find(
        (bed) => String(bed.id) === String(payload.targetBedId) || String(bed._id) === String(payload.targetBedId),
      );
      if (!targetBed || targetBed.status !== "available") {
        throw Object.assign(new Error("Selected target bed is not available."), { statusCode: 409, code: "BED_NOT_AVAILABLE" });
      }

      // ── Legal readiness gate — resolved and validated BEFORE any physical
      // mutation below. A room transfer may only physically execute once a
      // prepared, wet-signed replacement Contract already exists for the
      // exact destination room; see contractRoomTransferActivationService.js
      // for the canonical resolver/activator this reuses (no duplicated
      // Contract transition logic here).
      const predecessorContract = await resolveAuthoritativeCurrentContract({
        reservationId: reservation._id,
        tenantId: reservation.userId?._id || reservation.userId,
        session,
      });
      if (!predecessorContract || predecessorContract.status !== "active") {
        throw Object.assign(
          new Error("The tenant's current Contract is not active — room transfer cannot proceed."),
          { statusCode: 409, code: "ROOM_TRANSFER_PREDECESSOR_NOT_ACTIVE" },
        );
      }
      const successorContract = await resolveRoomTransferSuccessor({
        predecessorContractId: predecessorContract._id,
        session,
      });
      if (String(successorContract.roomId) !== String(targetRoom._id)) {
        throw Object.assign(
          new Error("The prepared replacement Contract does not match the selected destination room."),
          { statusCode: 409, code: "ROOM_TRANSFER_CONTRACT_ROOM_MISMATCH" },
        );
      }
      if (successorContract.status !== "published" || !successorContract.finalDocument) {
        throw Object.assign(
          new Error(
            "The replacement Contract for this room transfer is not yet finalized — upload the " +
            "wet-signed Contract before executing the transfer.",
          ),
          { statusCode: 422, code: "ROOM_TRANSFER_CONTRACT_NOT_FINAL" },
        );
      }

      const currentRoom = await Room.findById(activeStay.roomId).session(session);
      if (!currentRoom) {
        throw Object.assign(new Error("Current room not found."), { statusCode: 404, code: "CURRENT_ROOM_NOT_FOUND" });
      }
      // Vacate current bed immediately — bed is available for the next tenant
      currentRoom.vacateBed(activeStay.bedId);
      currentRoom.currentOccupancy = Math.max(0, Number(currentRoom.currentOccupancy || 0) - 1);
      currentRoom.updateAvailability();
      await currentRoom.save({ session });

      targetRoom.occupyBed(targetBed.id || String(targetBed._id), reservation.userId?._id || reservation.userId, reservation._id);
      targetRoom.currentOccupancy = Math.min(
        Number(targetRoom.capacity || 0),
        Number(targetRoom.currentOccupancy || 0) + 1,
      );
      targetRoom.updateAvailability();
      await targetRoom.save({ session });

      const sourceMeterReading = payload.sourceRoomMeterReading ?? payload.meterReading;
      const targetMeterReading = payload.targetRoomMeterReading ?? payload.newRoomMeterReading;

      // -----------------------------------------------------------------------
      // Billing Continuity Safety Net
      // Always anchor a UtilityReading snapshot at the transfer date for BOTH
      // rooms. If the admin supplied an explicit reading, use it. Otherwise fall
      // back to the latest recorded reading from DB history so the billing
      // engine never has a gap at the transfer boundary.
      // -----------------------------------------------------------------------

      // -- Source room: departing moveOut snapshot --
      if (sourceMeterReading != null && !Number.isNaN(Number(sourceMeterReading))) {
        // Admin provided an explicit reading — use it.
        await UtilityReading.create(
          [
            {
              utilityType: "electricity",
              roomId: currentRoom._id,
              branch: currentRoom.branch || "",
              reading: Number(sourceMeterReading),
              date: effectiveTransferDate,
              eventType: "moveOut",
              tenantId: reservation.userId?._id || reservation.userId,
              recordedBy: actorId,
            },
          ],
          { session },
        );
      } else {
        // Admin left blank — fallback: carry the last recorded reading forward
        // so we always have a timestamped anchor on the transfer date.
        const latestSourceReading = await UtilityReading.findOne({
          roomId: currentRoom._id,
          utilityType: "electricity",
          isArchived: false,
        })
          .sort({ date: -1, createdAt: -1 })
          .session(session)
          .lean();
        if (latestSourceReading) {
          await UtilityReading.create(
            [
              {
                utilityType: "electricity",
                roomId: currentRoom._id,
                branch: currentRoom.branch || "",
                reading: latestSourceReading.reading,
                date: effectiveTransferDate,
                eventType: "moveOut",
                tenantId: reservation.userId?._id || reservation.userId,
                recordedBy: actorId,
                readingStatus: "recorded",
              },
            ],
            { session },
          );
        }
      }

      // -- Target room: arriving moveIn snapshot --
      if (targetMeterReading != null && !Number.isNaN(Number(targetMeterReading))) {
        // Admin provided an explicit reading — use it.
        await UtilityReading.create(
          [
            {
              utilityType: "electricity",
              roomId: targetRoom._id,
              branch: targetRoom.branch || "",
              reading: Number(targetMeterReading),
              date: effectiveTransferDate,
              eventType: "moveIn",
              tenantId: reservation.userId?._id || reservation.userId,
              recordedBy: actorId,
            },
          ],
          { session },
        );
      } else {
        // Admin left blank — fallback: carry the last recorded reading of the
        // target room forward as the opening snapshot.
        const latestTargetReading = await UtilityReading.findOne({
          roomId: targetRoom._id,
          utilityType: "electricity",
          isArchived: false,
        })
          .sort({ date: -1, createdAt: -1 })
          .session(session)
          .lean();
        if (latestTargetReading) {
          await UtilityReading.create(
            [
              {
                utilityType: "electricity",
                roomId: targetRoom._id,
                branch: targetRoom.branch || "",
                reading: latestTargetReading.reading,
                date: effectiveTransferDate,
                eventType: "moveIn",
                tenantId: reservation.userId?._id || reservation.userId,
                recordedBy: actorId,
                readingStatus: "recorded",
              },
            ],
            { session },
          );
        }
      }

      // ── Room-Transfer Rent Settlement ───────────────────────────────────────
      // Lilycrest's confirmed rule: charge only for actual days spent in
      // each accommodation; the unused prepaid value of the old room is
      // credited against the destination room's prorated remaining-period
      // charge. Period boundaries come from the tenant's actual movein-
      // anchored rent cycle (resolveCurrentBillingCycle — correctly handles
      // 28/29/30/31-day months, never a fixed 30-day divisor). Destination
      // rate is always the successor Contract's approved amount — never the
      // mutable Room master price, and never re-resolved here even if it has
      // since changed. Source rate/prepaid basis are resolved below (see
      // prepaidRentResolver.js) rather than assumed to be the predecessor
      // Contract's approvedMonthlyRate verbatim: a structured reservation's
      // approved rent (and what it actually prepaid) lives on its immutable
      // pricingSnapshot, which can diverge from the Contract field over time.
      const moveInDate = readMoveInDate(reservation);
      const currentBillingCycle = moveInDate
        ? resolveCurrentBillingCycle(moveInDate, effectiveTransferDate)
        : null;
      const { sourceEffectiveRate, sourceRateSource } = resolveSourceEffectiveRentForTransfer({
        reservation,
        predecessorContract,
      });
      const { applicablePrepaidRent, prepaidRentSource } =
        await resolveApplicablePrepaidRentForTransfer({
          reservation,
          sourceEffectiveRate,
          currentBillingCycle,
          session,
        });
      const settlement = calculateRoomTransferRentSettlement({
        periodStart: currentBillingCycle?.billingCycleStart || effectiveTransferDate,
        periodEnd: currentBillingCycle?.billingCycleEnd || effectiveTransferDate,
        transferDate: effectiveTransferDate,
        sourceApprovedRate: sourceEffectiveRate,
        destinationApprovedRate: successorContract.approvedMonthlyRate,
        applicablePrepaidRent,
      });
      const proRataDays = settlement.sourceDays;
      const proRataRent = settlement.sourceConsumedValue;

      // ── Electricity Proration ─────────────────────────────────────────────
      // Estimate electricity consumed in the source room since the last recorded
      // reading. Requires: (a) admin-provided or DB-fallback baseline reading,
      // and (b) an open UtilityPeriod with a known ratePerUnit.
      let estimatedElectricityKwh = null;
      let estimatedElectricityCharge = 0;

      // Always resolve the baseline reading for proration (may be admin-supplied
      // or the DB fallback we fetched during the UtilityReading snapshot block).
      const baselineForProration = sourceMeterReading != null
        ? null  // admin supplied explicit value; baseline is implicit from previous reading
        : null; // will be resolved below

      const latestReadingForProration = await UtilityReading.findOne({
        roomId: currentRoom._id,
        utilityType: "electricity",
        isArchived: false,
        // Exclude the moveOut snapshot we just created in this transaction
        // by looking for readings strictly before the transfer date.
        date: { $lt: effectiveTransferDate },
      })
        .sort({ date: -1, createdAt: -1 })
        .session(session)
        .lean();

      if (
        sourceMeterReading != null &&
        !Number.isNaN(Number(sourceMeterReading)) &&
        latestReadingForProration?.reading != null
      ) {
        const kwhDelta = Number(sourceMeterReading) - Number(latestReadingForProration.reading);
        if (kwhDelta > 0) {
          // Fetch the latest open UtilityPeriod for this room to get the rate.
          const activePeriod = await UtilityPeriod.findOne({
            roomId: currentRoom._id,
            utilityType: "electricity",
            status: "open",
            isArchived: false,
          })
            .sort({ startDate: -1 })
            .session(session)
            .lean();

          const ratePerUnit = Number(activePeriod?.ratePerUnit ?? 0);
          if (ratePerUnit > 0) {
            estimatedElectricityKwh = Math.round(kwhDelta * 100) / 100;
            estimatedElectricityCharge = Math.round(kwhDelta * ratePerUnit * 100) / 100;
          }
        }
      }

      // charges.rent represents the NET settlement amount actually due
      // (destination prorated charge minus the unused old-room credit) —
      // never negative; an excess credit is recorded in transferSnapshot
      // for audit only, never auto-refunded (no existing policy to do so).
      const transferSettlementTotal = Math.round(
        (settlement.additionalAmountDue + estimatedElectricityCharge) * 100,
      ) / 100;

      // ── Transfer Settlement Bill ───────────────────────────────────────────
      // Create a dedicated transfer_settlement bill inside the same transaction
      // so the billing history reflects the actual-days settlement.
      const [transferBill] = await Bill.create(
        [
          {
            billType: "transfer_settlement",
            reservationId: reservation._id,
            userId: reservation.userId?._id || reservation.userId,
            branch: currentRoom.branch,
            roomId: currentRoom._id,
            billingMonth: effectiveTransferDate,
            billingCycleStart: currentBillingCycle?.billingCycleStart || effectiveTransferDate,
            billingCycleEnd: currentBillingCycle?.billingCycleEnd || effectiveTransferDate,
            proRataDays: proRataDays || null,
            charges: {
              rent: settlement.additionalAmountDue,
              electricity: estimatedElectricityCharge,
              water: 0,
              applianceFees: 0,
              corkageFees: 0,
              penalty: 0,
              discount: 0,
            },
            totalAmount: transferSettlementTotal,
            grossAmount: transferSettlementTotal,
            remainingAmount: transferSettlementTotal,
            status: transferSettlementTotal > 0 ? "pending" : "paid",
            notes: `Transfer settlement: ${currentRoom.name || currentRoom.roomNumber} → ${targetRoom.name || targetRoom.roomNumber} on ${effectiveTransferDate.toISOString().slice(0, 10)}` +
              (settlement.excessCredit > 0
                ? ` (excess prepaid credit of ₱${settlement.excessCredit.toFixed(2)} recorded, not auto-refunded)`
                : ""),
            transferSnapshot: {
              fromRoomId: currentRoom._id,
              fromRoomName: currentRoom.name || currentRoom.roomNumber || "",
              fromRoomType: currentRoom.type || "",
              fromRoomPrice: currentRoom.monthlyPrice || currentRoom.price || 0,
              toRoomId: targetRoom._id,
              toRoomName: targetRoom.name || targetRoom.roomNumber || "",
              toRoomType: targetRoom.type || "",
              toRoomPrice: targetRoom.monthlyPrice || targetRoom.price || 0,
              effectiveTransferDate,
              outstandingBalanceAtTransfer: billingSummary.currentBalance,
              // Source-room days used / consumed value (kept under the
              // existing field names for backward-compatible admin UI reads).
              proRataDays,
              proRataRent,
              // Full actual-days + unused-credit breakdown (new, additive).
              // sourceApprovedRate is the RESOLVED source-effective rent used to
              // value consumed days (see sourceRateSource) — for a structured
              // reservation with an approved discount this is
              // pricingSnapshot.finalMonthlyRate, not necessarily the raw
              // predecessor Contract field.
              sourceApprovedRate: sourceEffectiveRate,
              destinationApprovedRate: successorContract.approvedMonthlyRate,
              sourceRateSource,
              applicablePrepaidRent,
              prepaidRentSource,
              totalCoverageDays: settlement.totalCoverageDays,
              destinationDays: settlement.destinationDays,
              destinationProratedValue: settlement.destinationProratedValue,
              unusedPrepaidCredit: settlement.unusedPrepaidCredit,
              additionalAmountDue: settlement.additionalAmountDue,
              excessCredit: settlement.excessCredit,
              estimatedElectricityKwh,
              estimatedElectricityCharge: estimatedElectricityCharge > 0 ? estimatedElectricityCharge : null,
            },
          },
        ],
        { session },
      );

      const activeHistory = await BedHistory.findOne({
        reservationId: reservation._id,
        tenantId: reservation.userId?._id || reservation.userId,
        status: "active",
      })
        .sort({ moveInDate: -1 })
        .session(session);
      if (activeHistory) {
        activeHistory.moveOutDate = effectiveTransferDate;
        activeHistory.effectiveEndDate = effectiveTransferDate;
        activeHistory.status = "transferred";
        activeHistory.closedByAction = "transfer";
        activeHistory.reason = payload.reason || "Room transfer";
        activeHistory.notes = payload.notes || "";
        if (sourceMeterReading != null) activeHistory.transferSourceReading = Number(sourceMeterReading);
        if (targetMeterReading != null) activeHistory.transferTargetReading = Number(targetMeterReading);
        // ── Store permanent room snapshot and billing state on BedHistory ──
        activeHistory.proratedRentAdjustment = proRataRent;
        activeHistory.fromRoomSnapshot = {
          roomId: currentRoom._id,
          name: currentRoom.name || "",
          roomNumber: currentRoom.roomNumber || "",
          type: currentRoom.type || "",
          floor: currentRoom.floor || null,
          branch: currentRoom.branch || "",
          monthlyPrice: currentRoom.monthlyPrice || currentRoom.price || 0,
        };
        activeHistory.billingSnapshotAtTransfer = {
          totalOutstanding: billingSummary.currentBalance,
          totalBilled: billingSummary.visibleBills.reduce(
            (sum, e) => sum + Number(e.bill?.totalAmount || 0), 0,
          ),
          totalPaid: billingSummary.visibleBills.reduce(
            (sum, e) => sum + Number(e.bill?.paidAmount || 0), 0,
          ),
          proRataDays,
          proRataRent,
        };
        await activeHistory.save({ session });
      }

      await BedHistory.create(
        [
          {
            bedId: targetBed.id || String(targetBed._id),
            roomId: targetRoom._id,
            branch: targetRoom.branch,
            tenantId: reservation.userId?._id || reservation.userId,
            reservationId: reservation._id,
            stayId: activeStay._id,
            moveInDate: effectiveTransferDate,
            effectiveStartDate: effectiveTransferDate,
            status: "active",
            reason: payload.reason || "Room transfer",
            notes: payload.notes || "",
            transferSourceReading: sourceMeterReading != null ? Number(sourceMeterReading) : null,
            transferTargetReading: targetMeterReading != null ? Number(targetMeterReading) : null,
          },
        ],
        { session },
      );

      activeStay.roomId = targetRoom._id;
      activeStay.bedId = targetBed.id || String(targetBed._id);
      activeStay.transferNotes = payload.notes || payload.reason || "";
      activeStay.updatedBy = actorId;
      await activeStay.save({ session });

      reservation.roomId = targetRoom._id;
      reservation.selectedBed = {
        id: targetBed.id || String(targetBed._id),
        position: targetBed.position || null,
      };
      reservation.currentStayId = activeStay._id;
      reservation.latestStayStatus = activeStay.status;
      // Future rent bills (generated after this transfer) must bill the
      // destination room's approved rate, not the old room's — the
      // recurring due-date/billing-cycle anchor itself (movein-based) is
      // deliberately left untouched, this only updates which rate applies.
      reservation.monthlyRent = Number(successorContract.approvedMonthlyRate) || reservation.monthlyRent;
      await reservation.save({ session });

      // ── Contract cutover — last step before commit. Participates in this
      // same transaction (session passed through): a failure here rolls
      // back every physical mutation above via session.withTransaction's
      // automatic abort; success here can never be reached if any physical
      // mutation above already failed. This is the single Contract
      // transition authority — no manual status/isCurrent mutation here.
      const cutover = await activateRoomTransferSuccessor({
        successorContractId: successorContract._id,
        actorId,
        session,
      });

      result = {
        contractCutover: {
          predecessorContractId: String(predecessorContract._id),
          successorContractId: String(successorContract._id),
          predecessorStatus: cutover.predecessor?.status || predecessorContract.status,
          successorStatus: cutover.successor?.status || successorContract.status,
        },
        reservation,
        stay: activeStay.toObject(),
        fromRoomName: currentRoom.name || currentRoom.roomNumber || "Unknown room",
        toRoomName: targetRoom.name || targetRoom.roomNumber || "Unknown room",
        // Full room snapshots at transfer time
        fromRoomDetails: {
          roomId: currentRoom._id,
          name: currentRoom.name || "",
          roomNumber: currentRoom.roomNumber || "",
          type: currentRoom.type || "",
          floor: currentRoom.floor || null,
          branch: currentRoom.branch || "",
          monthlyPrice: currentRoom.monthlyPrice || currentRoom.price || 0,
          capacity: currentRoom.capacity || 0,
          occupancyAfterTransfer: currentRoom.currentOccupancy,
          vacatedBedId: activeStay.bedId,
        },
        toRoomDetails: {
          roomId: targetRoom._id,
          name: targetRoom.name || "",
          roomNumber: targetRoom.roomNumber || "",
          type: targetRoom.type || "",
          floor: targetRoom.floor || null,
          branch: targetRoom.branch || "",
          monthlyPrice: targetRoom.monthlyPrice || targetRoom.price || 0,
          capacity: targetRoom.capacity || 0,
          occupancyAfterTransfer: targetRoom.currentOccupancy,
          assignedBedId: targetBed.id || String(targetBed._id),
          assignedBedPosition: targetBed.position || null,
        },
        billingSnapshot: {
          outstandingBalanceAtTransfer: billingSummary.currentBalance,
          proRataDays,
          proRataRent,
          transferBillId: transferBill?._id || null,
        },
      };
    });
    return result;
  } finally {
    await session.endSession();
  }

  // ── Post-transaction: AuditLog + Tenant Notification ──────────────────────
  // Both are fire-and-forget. Errors here must never fail the transfer response.
  if (result) {
    AuditLog.log({
      type: "data_modification",
      action: `Room transfer: ${result.fromRoomName} → ${result.toRoomName}`,
      severity: "high",
      user: { id: actorId },
      details: {
        reservationId,
        fromRoomId: result.fromRoomDetails?.roomId,
        fromRoomName: result.fromRoomDetails?.name,
        toRoomId: result.toRoomDetails?.roomId,
        toRoomName: result.toRoomDetails?.name,
        transferBillId: result.billingSnapshot?.transferBillId,
        proRataRent: result.billingSnapshot?.proRataRent,
        sourceMeterReading: payload.sourceRoomMeterReading ?? null,
        targetMeterReading: payload.targetRoomMeterReading ?? null,
      },
    }).catch(() => {});

    const tenantId = result.reservation?.userId?._id || result.reservation?.userId;
    if (tenantId) {
      const fromName = result.fromRoomName || "previous room";
      const toName = result.toRoomName || "new room";
      createNotification(
        tenantId,
        "room_transfer",
        "Room Transfer Confirmed",
        `Your room has been transferred from ${fromName} to ${toName}. A settlement statement has been generated for your previous room.`,
        {
          entityType: "reservation",
          entityId: reservationId,
          emitRealtime: true,
        },
      ).catch(() => {});
    }

    // Contract lineage: the replacement Contract must already exist and be
    // legally final before this function is ever allowed to reach here (see
    // the legal readiness gate near the top of the transaction, and
    // activateRoomTransferSuccessor's call right before commit above) — so,
    // unlike the old behavior, there is nothing left to generate here after
    // the fact. Preparing a replacement Contract ahead of execution is done
    // via the dedicated prepareRoomTransferContract admin action
    // (server/controllers/reservations/tenancyActionsController.js), which
    // reuses autoGenerateTransferContract directly.

    return result;
  }
  return result;
}

export async function moveOutStayWorkflow({ reservationId, payload, actorId }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const reservation = await Reservation.findById(reservationId)
        .populate("roomId", "name roomNumber branch currentOccupancy capacity")
        .populate("userId", "firstName lastName email tenantStatus firebaseUid role branch")
        .session(session);
      if (!reservation) {
        throw Object.assign(new Error("Reservation not found"), { statusCode: 404, code: "RESERVATION_NOT_FOUND" });
      }
      if (!hasReservationStatus(reservation.status, "moveIn")) {
        throw Object.assign(new Error("Only active moved-in tenants can be moved out."), { statusCode: 400, code: "INVALID_STATUS_FOR_MOVEOUT" });
      }
      if (!payload?.confirm) {
        throw Object.assign(new Error("Move-out confirmation is required."), { statusCode: 400, code: "CONFIRM_REQUIRED" });
      }

      const activeStay = await ensureActiveStay(reservation, actorId, session);
      if (!activeStay || !CURRENT_STAY_STATUSES.includes(activeStay.status)) {
        throw Object.assign(new Error("No active stay found for move-out."), { statusCode: 400, code: "NO_ACTIVE_STAY" });
      }

      const moveOutAt = parseDateTime(payload.moveOutDate, payload.actualVacateTime || "");
      if (!moveOutAt) {
        throw Object.assign(new Error("A valid move-out date is required."), { statusCode: 400, code: "INVALID_MOVEOUT_DATE" });
      }
      if (readMoveInDate(reservation) && moveOutAt < new Date(readMoveInDate(reservation))) {
        throw Object.assign(new Error("Move-out date cannot be earlier than move-in date."), { statusCode: 400, code: "MOVEOUT_BEFORE_MOVEIN" });
      }
      if (payload.finalUtilityReading == null || Number.isNaN(Number(payload.finalUtilityReading))) {
        throw Object.assign(new Error("A final utility reading is required for move-out."), { statusCode: 400, code: "FINAL_READING_REQUIRED" });
      }

      const bills = await Bill.find({
        reservationId: reservation._id,
        isArchived: { $ne: true },
      }).session(session).lean();
      const billingSummary = buildBillingSummary(bills);

      // ── Move-out billing blocker ──────────────────────────────────────────
      // Block move-out when the tenant has an outstanding balance unless the
      // admin explicitly sets forceOverride: true after reviewing the balance.
      // This prevents accidental move-outs that leave uncollectable debt.
      if (billingSummary.hasOutstanding && !payload.forceOverride) {
        const formattedBalance = Number(billingSummary.currentBalance).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        throw Object.assign(
          new Error(
            `Tenant has ₱${formattedBalance} in outstanding balance. Settle all bills before processing move-out, or acknowledge and force-proceed.`,
          ),
          {
            statusCode: 409,
            code: "OUTSTANDING_BILLS_BLOCKING_MOVEOUT",
            outstandingBalance: billingSummary.currentBalance,
            paymentStatus: billingSummary.paymentStatus,
          },
        );
      }

      const room = await Room.findById(activeStay.roomId).session(session);
      if (room) {
        // Vacate bed immediately — available for the next reservation
        room.vacateBed(activeStay.bedId);
        room.currentOccupancy = Math.max(0, Number(room.currentOccupancy || 0) - 1);
        room.updateAvailability();
        await room.save({ session });
      }

      const activeHistory = await BedHistory.findOne({
        reservationId: reservation._id,
        tenantId: reservation.userId?._id || reservation.userId,
        status: "active",
      })
        .sort({ moveInDate: -1 })
        .session(session);
      if (activeHistory) {
        activeHistory.moveOutDate = moveOutAt;
        activeHistory.effectiveEndDate = moveOutAt;
        activeHistory.status = "completed";
        activeHistory.closedByAction = "move_out";
        activeHistory.reason = payload.reason || "Move out";
        activeHistory.notes = payload.finalNotes || "";
        await activeHistory.save({ session });
      }

      activeStay.status = payload.reason === "terminated" ? "terminated" : "completed";
      activeStay.endedAt = moveOutAt;
      activeStay.endReason = payload.reason || "move_out";
      activeStay.moveOutNotes = payload.finalNotes || "";
      activeStay.updatedBy = actorId;
      await activeStay.save({ session });

      reservation.status = "moveOut";
      reservation.moveOutDate = moveOutAt;
      reservation.currentStayId = activeStay._id;
      reservation.latestStayStatus = activeStay.status;

      // ── Deposit Forfeiture & Settlement Calculation ──────────────────────────
      const leaseEndDate = activeStay.leaseEndDate
        ? new Date(activeStay.leaseEndDate)
        : null;
      const isEarlyVacancy = leaseEndDate && moveOutAt < leaseEndDate;

      const securityDepositAmount = resolveSecurityDeposit(reservation);
      const outstandingBal = Number(billingSummary.currentBalance || 0);
      const damageDeductions = Number(payload.damageDeductions || 0);
      const keyDeduction = payload.keyReturned === false ? 500 : 0;
      const netSettlement = isEarlyVacancy
        ? 0
        : Math.max(0, securityDepositAmount - outstandingBal - damageDeductions - keyDeduction);

      if (isEarlyVacancy) {
        reservation.depositForfeited = true;
        reservation.depositForfeitureReason = "early_vacancy";
        reservation.depositForfeitedAt = new Date();
        reservation.depositRefundAmount = 0;
        reservation.depositRefundDeadline = null;
        reservation.depositRefundStatus = "forfeited";
      } else {
        reservation.depositForfeited = false;
        reservation.depositForfeitureReason = null;
        reservation.depositForfeitedAt = null;
        reservation.depositRefundDeadline = dayjs(moveOutAt).add(30, "day").toDate();
        reservation.depositRefundAmount = netSettlement;
        reservation.depositRefundStatus = "pending";
      }

      if (payload.keyReturned !== undefined) {
        reservation.keyReturned = Boolean(payload.keyReturned);
        reservation.keyReturnAssessedAt = new Date();
      }

      reservation.finalSettlementSummary = {
        securityDeposit: securityDepositAmount,
        outstandingBalance: outstandingBal,
        finalUtilityCharge: Number(payload.finalUtilityReading || 0),
        damageDeductions,
        keyDeduction,
        netAmount: netSettlement,
        settlementType: isEarlyVacancy
          ? "forfeited"
          : (netSettlement > 0 ? "refund" : (outstandingBal > 0 ? "payment_due" : "zero_balance")),
        settledAt: new Date(),
      };

      await reservation.save({ session });

      const tenant = await User.findById(reservation.userId?._id || reservation.userId).session(session);
      if (tenant) {
        tenant.tenantStatus = "moved_out";
        tenant.branch = reservation.roomId?.branch || tenant.branch;
        await tenant.save({ session });
      }

      await UtilityReading.create(
        [
          {
            utilityType: "electricity",
            roomId: reservation.roomId?._id || reservation.roomId,
            branch: reservation.roomId?.branch || "",
            reading: Number(payload.finalUtilityReading),
            date: moveOutAt,
            eventType: "moveOut",
            tenantId: reservation.userId?._id || reservation.userId,
            recordedBy: actorId,
            utilityPeriodId: null,
            activeTenantIds: [],
          },
        ],
        { session },
      );

      result = {
        reservation,
        stay: activeStay.toObject(),
        billingSummary,
        depositSettlement: {
          depositForfeited: reservation.depositForfeited,
          depositForfeitureReason: reservation.depositForfeitureReason,
          depositForfeitedAt: reservation.depositForfeitedAt,
          depositRefundDeadline: reservation.depositRefundDeadline,
          depositRefundAmount: reservation.depositRefundAmount,
          keyReturned: reservation.keyReturned,
          isEarlyVacancy: Boolean(isEarlyVacancy),
          leaseEndDate: leaseEndDate,
          actualMoveOutDate: moveOutAt,
        },
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * SCENARIO 1 - Case 1: Post-Approval Transfer Cancellation
 * Releases Room B lock and retains tenant active in Room A.
 */
export async function cancelTransferStayWorkflow(reservationId, actorId = null) {
  const reservation = await Reservation.findById(reservationId).populate("roomId");
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  if (reservation.pendingTransferRoomId) {
    const targetRoom = await Room.findById(reservation.pendingTransferRoomId);
    if (targetRoom) {
      const bed = targetRoom.beds?.find(b => String(b.id) === String(reservation.pendingTransferBedId) || String(b._id) === String(reservation.pendingTransferBedId));
      if (bed) {
        bed.status = "available";
        bed.lockType = null;
        await targetRoom.save();
      }
    }
  }

  reservation.pendingTransferRoomId = null;
  reservation.pendingTransferBedId = null;
  reservation.transferStatus = "cancelled";
  reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Transfer cancelled by admin/tenant at ${new Date().toISOString()}`;
  await reservation.save();

  return {
    success: true,
    message: "Room transfer cancelled successfully. Target room lock released.",
    reservation
  };
}

/**
 * SCENARIO 1 - Case 2: Post-Approval Move-Out Cancellation with Re-booking Conflict Check
 */
export async function cancelMoveOutStayWorkflow(reservationId, actorId = null) {
  const reservation = await Reservation.findById(reservationId).populate("roomId");
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  // Check if room/bed was already pre-booked by an incoming applicant
  const conflictQuery = {
    roomId: reservation.roomId._id || reservation.roomId,
    status: { $in: ["reserved", "pending", "approved_for_payment"] },
    isArchived: { $ne: true },
    _id: { $ne: reservation._id }
  };

  const incomingConflict = await Reservation.findOne(conflictQuery).populate("userId", "firstName lastName email");
  if (incomingConflict) {
    return {
      success: false,
      conflict: true,
      code: "REBOOKING_CONFLICT",
      message: `Cannot cancel move-out: Room ${reservation.roomId.roomNumber || reservation.roomId.name} is pre-booked by incoming applicant ${incomingConflict.userId?.firstName} ${incomingConflict.userId?.lastName}. Administrative resolution required.`,
      conflictingApplicant: incomingConflict
    };
  }

  reservation.moveOutRequested = false;
  reservation.moveOutDate = null;
  reservation.moveOutReason = null;
  reservation.status = "moveIn";
  reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Move-out request cancelled at ${new Date().toISOString()}`;
  await reservation.save();

  return {
    success: true,
    message: "Move-out request cancelled successfully. Active stay restored.",
    reservation
  };
}

/**
 * SCENARIO 1 - Case 3: Early Contract Termination
 */
export async function executeEarlyTerminationWorkflow(reservationId, payload = {}, actorId = null) {
  const { penaltyFee = 0, forfeitureReason = "early_termination" } = payload;
  const reservation = await Reservation.findById(reservationId).populate("roomId");
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  reservation.status = "moveOut";
  reservation.moveOutDate = new Date();
  reservation.depositForfeited = true;
  reservation.depositForfeitureReason = forfeitureReason;
  reservation.earlyTerminationPenalty = Number(penaltyFee);
  reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Early termination executed with penalty PHP ${penaltyFee}`;
  await reservation.save();

  // Free room inventory
  const room = await Room.findById(reservation.roomId._id || reservation.roomId);
  if (room && reservation.selectedBed?.id) {
    const bed = room.beds.find(b => String(b.id) === String(reservation.selectedBed.id));
    if (bed) {
      bed.status = "available";
      await room.save();
    }
  }

  return {
    success: true,
    message: "Early termination executed successfully.",
    reservation
  };
}

/**
 * SCENARIO 1 - Case 4: Direct Tenant Room Swap
 */
export async function executeDirectRoomSwapWorkflow(
  reservationAId,
  reservationBId,
  actorId = null,
  branchFilter = null,
) {
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const resA = await Reservation.findById(reservationAId).populate("roomId").session(session);
      const resB = await Reservation.findById(reservationBId).populate("roomId").session(session);

      if (!resA || !resB) {
        throw Object.assign(new Error("One or both reservations not found for room swap"), {
          statusCode: 404,
          code: "RESERVATION_NOT_FOUND",
        });
      }

      const branchA = resA.roomId?.branch || resA.branch;
      const branchB = resB.roomId?.branch || resB.branch;

      if (branchFilter) {
        if (branchA !== branchFilter || branchB !== branchFilter) {
          throw Object.assign(
            new Error(`Access denied. You can only execute room swaps within ${branchFilter} branch.`),
            {
              statusCode: 403,
              code: "BRANCH_ACCESS_DENIED",
            },
          );
        }
      }

      if (branchA && branchB && branchA !== branchB) {
        throw Object.assign(
          new Error("Direct room swap cannot be executed across different branches. Use standard tenant transfer."),
          {
            statusCode: 400,
            code: "CROSS_BRANCH_SWAP_PROHIBITED",
          },
        );
      }

      // Swap room and bed assignments
      const roomATemp = resA.roomId?._id || resA.roomId;
      const bedATemp = resA.selectedBed;

      resA.roomId = resB.roomId?._id || resB.roomId;
      resA.selectedBed = resB.selectedBed;
      resA.notes = `${resA.notes ? resA.notes + " | " : ""}Swapped room with tenant ${resB.userId} at ${new Date().toISOString()}`;

      resB.roomId = roomATemp;
      resB.selectedBed = bedATemp;
      resB.notes = `${resB.notes ? resB.notes + " | " : ""}Swapped room with tenant ${resA.userId} at ${new Date().toISOString()}`;

      await resA.save({ session });
      await resB.save({ session });

      result = {
        success: true,
        message: "Direct room swap executed successfully between tenants.",
        tenantA: resA,
        tenantB: resB,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * SCENARIO 1 - Case 5: Unannounced Abandonment ("Ghost Tenant") Protocol
 */
export async function executeAbandonmentProtocolWorkflow(reservationId, payload = {}, actorId = null) {
  const reservation = await Reservation.findById(reservationId).populate("roomId");
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  reservation.status = "abandoned";
  reservation.depositForfeited = true;
  reservation.depositForfeitureReason = "unannounced_abandonment";
  reservation.depositRefundAmount = 0;
  reservation.abandonedAt = new Date();
  reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Abandonment protocol triggered by admin ${actorId || ""}`;
  await reservation.save();

  // Free bed inventory immediately
  const room = await Room.findById(reservation.roomId._id || reservation.roomId);
  if (room && reservation.selectedBed?.id) {
    const bed = room.beds.find(b => String(b.id) === String(reservation.selectedBed.id));
    if (bed) {
      bed.status = "available";
      await room.save();
    }
  }

  // Update user status
  const user = await User.findById(reservation.userId);
  if (user) {
    user.tenantStatus = "abandoned";
    await user.save();
  }

  return {
    success: true,
    message: "Abandonment protocol completed. Bed inventory released and deposit forfeited.",
    reservation
  };
}

/**
 * SCENARIO 1 - Case 6: Contract Extension vs Pre-Booking Lock Check
 */
export async function validateContractExtensionWorkflow(reservationId, requestedNewEndDate) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  const room = await Room.findById(reservation.roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  // Check for pre-bookings starting before requested new end date
  const conflict = await Reservation.findOne({
    roomId: reservation.roomId,
    _id: { $ne: reservation._id },
    status: { $in: ["reserved", "pending", "approved_for_payment"] },
    isArchived: { $ne: true },
    moveInDate: { $lte: new Date(requestedNewEndDate) }
  }).populate("userId", "firstName lastName email");

  if (conflict) {
    return {
      canExtend: false,
      reason: `Cannot extend contract: Room ${room.roomNumber || room.name} is pre-booked starting ${dayjs(conflict.moveInDate).format("YYYY-MM-DD")} by ${conflict.userId?.firstName} ${conflict.userId?.lastName}.`
    };
  }

  return {
    canExtend: true,
    message: "No pre-booking conflict found. Lease extension can proceed."
  };
}


