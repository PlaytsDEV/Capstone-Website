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
import { resolveSecurityDeposit, resolveReservationFinancials } from "./depositUtils.js";
import {
  activateRoomTransferSuccessor,
  activateRoomTransferSuccessorDraft,
  resolveRoomTransferSuccessor,
} from "../services/contractRoomTransferActivationService.js";
import {
  resolveCurrentBillingCycle,
  sumBillCharges,
  syncBillAmounts,
  roundMoney,
} from "../services/billing/billingPolicy.js";
import {
  CURRENT_STAY_STATUSES,
  resolveCurrentStayForReservation,
  resolveAuthoritativeCurrentContract,
} from "../services/tenantContractSelectionService.js";
import {
  transitionContract,
  createReplacementContractForTransfer,
  validateContractForGeneration,
  ROOM_TRANSFER_SUCCESSOR_PURPOSES,
  ABANDONED_TRANSFER_SUCCESSOR_STATUSES,
} from "../services/contractService.js";
import { generatePreparedContractPdf } from "../services/contractPdfService.js";
import { calculateRoomTransferRentSettlement } from "../services/billing/roomTransferSettlement.js";
import { calculateRoomTransferDepositSettlement } from "../services/billing/roomTransferDepositSettlement.js";
import { recordRoomTransferRentCredit } from "../services/billing/tenantCreditService.js";
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
    .select("name roomNumber branch type beds")
    .lean();

  return rooms
    .map((room) => ({
      id: String(room._id),
      name: room.name || room.roomNumber,
      branch: room.branch,
      type: room.type || "",
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
        : renewalExists
          ? { ...disabled("A future renewal already exists for this tenant. Resolve or cancel it before transferring.", "FUTURE_RENEWAL_EXISTS"), hasAvailableBedsInBranch }
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

/**
 * Read-only Room Transfer financial preview — the numbers the Admin sees on
 * the "Review & Settlement" step BEFORE confirming. Runs the SAME canonical
 * pure math the real transfer runs (roomTransferSettlement +
 * roomTransferDepositSettlement + prepaidRentResolver), so the preview and
 * the executed settlement always agree. Mutates nothing.
 *
 * Returns null when it cannot be computed (no target room, unsupported room
 * type, missing lease term) rather than guessing.
 */
export async function computeRoomTransferPreview({ reservationId, targetRoomId, effectiveTransferDate, depositHeldOverride = null }) {
  if (!targetRoomId) return null;
  const [reservation, targetRoom] = await Promise.all([
    Reservation.findById(reservationId).populate("roomId", "name roomNumber branch type price monthlyPrice").lean(),
    Room.findById(targetRoomId).lean(),
  ]);
  if (!reservation || !targetRoom) return null;

  const activeStay = await resolveCurrentStayForReservation(reservationId).lean();
  const predecessorContract = await resolveAuthoritativeCurrentContract({
    reservationId, tenantId: reservation.userId,
  });
  const transferDate = normalizeDate(effectiveTransferDate) || new Date();
  const moveInDate = readMoveInDate(reservation);
  const leaseEndDate = activeStay?.leaseEndDate || predecessorContract?.leaseEndDate || computeLeaseEndDate(reservation);
  const leaseDurationMonths =
    predecessorContract?.leaseDurationMonths ||
    (moveInDate && leaseEndDate ? Math.max(1, dayjs(leaseEndDate).diff(dayjs(moveInDate), "month")) : 12);

  // Destination approved rate — the same authoritative table
  // createReplacementContractForTransfer uses (never the mutable Room price).
  let destinationApprovedRate = 0;
  try {
    const { resolveAuthoritativeLeasePricing } = await import("../services/contractPricingResolver.js");
    const { getBusinessSettings } = await import("./businessSettings.js");
    const settings = await getBusinessSettings().catch(() => ({}));
    const pricing = resolveAuthoritativeLeasePricing({
      room: targetRoom, roomType: targetRoom.type, branch: targetRoom.branch, leaseDurationMonths, settings,
    });
    destinationApprovedRate = roundMoney(Number(pricing.finalMonthlyRate) || 0);
  } catch {
    destinationApprovedRate = roundMoney(Number(targetRoom.monthlyPrice ?? targetRoom.price) || 0);
  }
  if (!(destinationApprovedRate > 0)) return null;

  const currentBillingCycle = moveInDate
    ? resolveCurrentBillingCycle(moveInDate, transferDate)
    : null;
  const { sourceEffectiveRate, sourceRateSource } = resolveSourceEffectiveRentForTransfer({
    reservation, predecessorContract,
  });
  const { applicablePrepaidRent, prepaidRentSource } = await resolveApplicablePrepaidRentForTransfer({
    reservation, sourceEffectiveRate, currentBillingCycle,
  });
  const settlement = calculateRoomTransferRentSettlement({
    periodStart: currentBillingCycle?.billingCycleStart || transferDate,
    periodEnd: currentBillingCycle?.billingCycleEnd || transferDate,
    transferDate,
    sourceApprovedRate: sourceEffectiveRate,
    destinationApprovedRate,
    applicablePrepaidRent,
  });

  // Deposit — REQUIRED (1x destination rate) vs HELD (actual cash).
  // `depositHeldOverride` lets the scheduled-transfer executor recompute the
  // ADDITIONAL-deposit-due against the held amount as it stood BEFORE the
  // pre-paid Scheduled Transfer Balance Bill funded it — so a paid deposit
  // component is not mistaken for "requirement dropped" (see Phase 2G #13).
  const destinationRequiredDeposit = roundMoney(destinationApprovedRate);
  let depositHeld = depositHeldOverride != null && Number.isFinite(Number(depositHeldOverride))
    ? Number(depositHeldOverride)
    : Number(reservation.securityDepositHeld);
  let depositHeldKnown = Number.isFinite(depositHeld);
  if (!depositHeldKnown) {
    const fin = resolveReservationFinancials(reservation);
    depositHeld = fin.isSettled ? roundMoney(Number(fin.securityDeposit) || 0) : null;
    depositHeldKnown = depositHeld != null;
  }
  const depositSettlement = calculateRoomTransferDepositSettlement({
    depositCurrentlyHeld: depositHeldKnown ? depositHeld : 0,
    destinationRequiredDeposit,
  });

  // Best-effort source electricity ESTIMATE (never part of the immediate
  // total — Phase 6: source electricity is billed once at UtilityPeriod
  // close). Shown as an informational figure only.
  const sourceRoomId = reservation.roomId?._id || reservation.roomId;
  const [lastReading, openPeriod] = await Promise.all([
    UtilityReading.findOne({ roomId: sourceRoomId, utilityType: "electricity", isArchived: false })
      .sort({ date: -1, createdAt: -1 }).select("reading").lean(),
    UtilityPeriod.findOne({ roomId: sourceRoomId, utilityType: "electricity", status: "open" })
      .sort({ startDate: -1 }).select("ratePerUnit").lean(),
  ]);

  const rentAdjustmentDue = roundMoney(settlement.additionalAmountDue);
  const excessRentCredit = roundMoney(settlement.excessCredit);
  const additionalDepositDue = roundMoney(depositSettlement.additionalDepositDue);
  // The ONE immediate figure the admin acts on: rent adjustment + additional
  // deposit. Electricity and water are NOT here.
  const totalImmediateDue = roundMoney(rentAdjustmentDue + additionalDepositDue);

  return {
    fromRoom: { id: String(sourceRoomId), name: reservation.roomId?.name || reservation.roomId?.roomNumber || "", type: reservation.roomId?.type || "" },
    toRoom: { id: String(targetRoom._id), name: targetRoom.name || targetRoom.roomNumber || "", type: targetRoom.type || "" },
    effectiveTransferDate: transferDate,
    leaseStartDate: moveInDate || null,
    leaseEndDate: leaseEndDate || null,
    // The move-in-anchored rent cycle the transfer date falls in — used to
    // stamp billingCycleStart/End on a Scheduled Room Transfer Balance Bill so
    // it lines up with the settlement the executor later recomputes.
    billingCycle: currentBillingCycle
      ? {
          billingCycleStart: currentBillingCycle.billingCycleStart,
          billingCycleEnd: currentBillingCycle.billingCycleEnd,
          cycleIndex: currentBillingCycle.cycleIndex ?? null,
        }
      : null,
    rent: {
      sourceEffectiveRate: roundMoney(sourceEffectiveRate),
      sourceRateSource,
      destinationApprovedRate,
      applicablePrepaidRent: roundMoney(applicablePrepaidRent),
      prepaidRentSource,
      destinationProratedValue: roundMoney(settlement.destinationProratedValue),
      unusedPrepaidCredit: roundMoney(settlement.unusedPrepaidCredit),
      adjustmentDue: rentAdjustmentDue,            // charges.rent on the settlement Bill
      excessCredit: excessRentCredit,              // -> a rent-only TenantCredit
      sourceDays: settlement.sourceDays,
      destinationDays: settlement.destinationDays,
      totalCoverageDays: settlement.totalCoverageDays,
    },
    deposit: {
      required: destinationRequiredDeposit,
      held: depositHeldKnown ? roundMoney(depositHeld) : null,  // null = legacy, unknown — UI shows "Unavailable"
      heldKnown: depositHeldKnown,
      balanceDue: additionalDepositDue,            // charges.securityDeposit on the settlement Bill
      excessHeld: roundMoney(depositSettlement.excessDepositHeld),  // stays refundable, NOT a credit
    },
    electricity: {
      // Informational preview only. NOT added to totalImmediateDue.
      estimatedKwh: null,
      estimatedCharge: null,
      ratePerUnit: Number(openPeriod?.ratePerUnit ?? 0) || null,
      billedAtPeriodClose: true,
      note: "Estimated source-room electricity — the final charge is generated during the normal utility period close.",
      _baselineReading: lastReading?.reading ?? null,
    },
    water: {
      // Resolved by the destination room/branch policy at period close; no
      // immediate water charge is created by a transfer (Phase 5).
      billedAtPeriodClose: true,
      note: "Water follows the current room/branch billing policy and is settled at its normal period close (or not billed separately where included in rent).",
    },
    totalImmediateDue,
  };
}

export async function getTenantActionContext(reservationId, previewParams = null) {
  const reservation = await Reservation.findById(reservationId)
    .populate("roomId", "name roomNumber branch beds monthlyPrice price type")
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

  // Additive: when the Transfer modal passes a candidate targetRoomId (+
  // optional effectiveTransferDate), include the canonical financial preview
  // so the admin sees the real rent-adjustment / additional-deposit /
  // required-vs-held numbers rather than a hand-rolled front-end estimate.
  let transferPreview = null;
  if (previewParams?.targetRoomId) {
    try {
      transferPreview = await computeRoomTransferPreview({
        reservationId,
        targetRoomId: previewParams.targetRoomId,
        effectiveTransferDate: previewParams.effectiveTransferDate,
      });
    } catch (err) {
      logger.warn({ err, reservationId }, "[getTenantActionContext] transfer preview failed (non-fatal)");
      transferPreview = null;
    }
  }

  return {
    reservationId: String(reservation._id),
    transferPreview,
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

      const renewalRoomId = reservation.roomId?._id || reservation.roomId;
      // Stay.bedId is a required String — `""` is rejected. The renewed Stay
      // must carry the SAME bed representation the current Stay uses: a real
      // bed id for a shared room, or the canonical private-room sentinel
      // `room-<roomId>` (the room-transfer flow already writes this to
      // activeStay.bedId for a private destination). Prefer the current
      // Stay's bedId; else the reservation's selected bed; else the sentinel.
      const renewalBedId =
        activeStay.bedId ||
        reservation.selectedBed?.id ||
        `room-${renewalRoomId}`;
      const [newStay] = await Stay.create(
        [
          {
            tenantId: reservation.userId?._id || reservation.userId,
            reservationId: reservation._id,
            branch: reservation.roomId?.branch || "",
            roomId: renewalRoomId,
            bedId: renewalBedId,
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

      // Ensure declared appliance add-ons cleanly carry over during lease renewals within Guadalupe
      const renewalBranch = String(reservation.roomId?.branch || reservation.branch || "").toLowerCase();
      if (renewalBranch === "guadalupe") {
        reservation.selectedAppliances = reservation.selectedAppliances || [];
        reservation.applianceFees = Number(reservation.applianceFees || 0);
        if (payload?.successorReservationId) {
          const succRes = await Reservation.findById(payload.successorReservationId).session(session);
          if (succRes) {
            succRes.selectedAppliances = Array.isArray(reservation.selectedAppliances)
              ? JSON.parse(JSON.stringify(reservation.selectedAppliances))
              : [];
            succRes.applianceFees = Number(reservation.applianceFees || 0);
            if (succRes.monthlyRent != null) {
              succRes.totalPrice = Number(succRes.monthlyRent) + Number(succRes.applianceFees);
            }
            await succRes.save({ session });
          }
        }
      }

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

// Canonical bed-required room types (same set the reservation/move-in flow
// uses): a private room has no bed to pick, a double/quadruple-sharing room
// does. Applied INDEPENDENTLY to the source room (does a bed get released?)
// and the destination room (is a bed required/occupied?) — a room transfer
// may cross room types, so the two sides can differ. Always read from the
// live Room.type of the actual source/destination room, never a stale
// reservation preferredRoomType.
const BED_REQUIRED_ROOM_TYPES = new Set(["double-sharing", "quadruple-sharing"]);
const roomTypeRequiresBed = (roomType) => BED_REQUIRED_ROOM_TYPES.has(String(roomType || ""));

// A room transfer amends the tenant's CONTINUING lease. Its predecessor is
// whatever `resolveAuthoritativeCurrentContract` returns as the tenant's
// current Contract — which is a legal lease in effect today. That is:
//   - a fully wet-signed lease (status active/published/expiring_soon), OR
//   - a Room Transfer Addendum from a PRIOR transfer that is the tenant's
//     current Contract (isCurrent:true) but whose own wet-signing is still
//     pending (status still "generated"). Phase 8: a legitimate Transfer #2
//     must NOT be blocked just because Addendum #1's document-signing step
//     has not finished — the continuing lease is valid regardless.
const FINAL_PREDECESSOR_STATUSES = new Set(["active", "published", "expiring_soon"]);
const isValidTransferPredecessor = (contract) => {
  if (!contract) return false;
  if (FINAL_PREDECESSOR_STATUSES.has(contract.status)) return true;
  return (
    contract.status === "generated" &&
    contract.isCurrent === true &&
    (contract.contractPurpose === "amendment" || contract.contractPurpose === "replacement")
  );
};

/**
 * Prepare the room-transfer replacement Contract as a tenant-visible Draft,
 * OUTSIDE the physical-transfer transaction (Contract PDF generation does
 * storage I/O and is not transaction-safe — same reason autoGenerateMoveInContract
 * runs after the moveIn status write, not inside it).
 *
 * Idempotent: createReplacementContractForTransfer reuses an existing
 * non-abandoned successor, and an already-`generated` successor is not
 * regenerated. A crash between this and the transaction below leaves a
 * prepared-but-not-current successor Draft — exactly the retry-reuse case,
 * and the same failure shape as an interrupted move-in.
 *
 * Returns the successor Contract doc (status "generated", isCurrent:false).
 */
/**
 * Shared pre-transaction validation for a room-transfer intent. Resolves the
 * reservation, destination room + (conditional) bed, the current-lease
 * predecessor Contract and the active Stay, and runs every cheap guard that
 * does NOT need a transaction session. Used by BOTH the one-step
 * `transferStayWorkflow` (Stage A) and the read-only
 * `prepareRoomTransferAddendum` / `discardRoomTransferAddendum` endpoints so
 * the "is this transfer legal?" rules live in exactly one place.
 *
 * Mutates nothing. Throws `{statusCode, code}` on any failed guard.
 *
 * @param {Object}  p
 * @param {string}  p.reservationId
 * @param {Object}  p.payload            - { targetRoomId, targetBedId?, effectiveTransferDate?, confirm? }
 * @param {boolean} [p.requireConfirm=false] - enforce payload.confirm (the cutover does; preview/discard do not)
 * @returns {{ reservation, targetRoom, targetBed, predecessorContract, activeStay, effectiveTransferDate, destinationNeedsBed }}
 */
export async function resolveValidatedRoomTransferIntent({ reservationId, payload = {}, requireConfirm = false }) {
  const reservation = await Reservation.findById(reservationId)
    .populate("roomId", "name roomNumber branch beds currentOccupancy capacity type")
    .populate("userId", "firstName lastName email tenantStatus");
  if (!reservation) {
    throw Object.assign(new Error("Reservation not found"), { statusCode: 404, code: "RESERVATION_NOT_FOUND" });
  }
  if (!hasReservationStatus(reservation.status, "moveIn")) {
    throw Object.assign(new Error("Only active moved-in tenants can be transferred."), { statusCode: 400, code: "INVALID_STATUS_FOR_TRANSFER" });
  }
  if (requireConfirm && !payload?.confirm) {
    throw Object.assign(new Error("Transfer confirmation is required."), { statusCode: 400, code: "CONFIRM_REQUIRED" });
  }
  if (!payload.targetRoomId) {
    throw Object.assign(new Error("Target room is required."), { statusCode: 400, code: "MISSING_TRANSFER_FIELDS" });
  }

  const effectiveTransferDate = normalizeDate(payload.effectiveTransferDate) || new Date();
  const targetRoom = await Room.findById(payload.targetRoomId);
  if (!targetRoom) {
    throw Object.assign(new Error("Target room not found."), { statusCode: 404, code: "TARGET_ROOM_NOT_FOUND" });
  }
  if (String(targetRoom.branch) !== String(reservation.roomId?.branch || "")) {
    throw Object.assign(new Error("Transfers are limited to rooms within the same branch."), { statusCode: 400, code: "CROSS_BRANCH_TRANSFER_NOT_ALLOWED" });
  }
  // A room transfer MAY change room type (Private <-> Double <-> Quadruple).
  // Bed requirement is driven by the DESTINATION Room.type; a bed id supplied
  // for a private destination is IGNORED, never rejected.
  const destinationNeedsBed = roomTypeRequiresBed(targetRoom.type);
  if (destinationNeedsBed && !payload.targetBedId) {
    throw Object.assign(
      new Error("A specific bed must be selected for a shared room."),
      { statusCode: 400, code: "MISSING_TRANSFER_FIELDS" },
    );
  }
  const targetBed = destinationNeedsBed
    ? targetRoom.beds.find(
        (bed) => String(bed.id) === String(payload.targetBedId) || String(bed._id) === String(payload.targetBedId),
      )
    : null;
  if (destinationNeedsBed && !targetBed) {
    throw Object.assign(new Error("Target bed not found in the destination room."), { statusCode: 404, code: "TARGET_BED_NOT_FOUND" });
  }

  const predecessorContract = await resolveAuthoritativeCurrentContract({
    reservationId: reservation._id,
    tenantId: reservation.userId?._id || reservation.userId,
  });
  if (!predecessorContract || !isValidTransferPredecessor(predecessorContract)) {
    throw Object.assign(
      new Error("The tenant's current lease Contract is not active — room transfer cannot proceed."),
      { statusCode: 409, code: "ROOM_TRANSFER_PREDECESSOR_NOT_ACTIVE" },
    );
  }
  const activeStay = await resolveCurrentStayForReservation(reservation._id);
  if (!activeStay || !CURRENT_STAY_STATUSES.includes(activeStay.status)) {
    throw Object.assign(new Error("No active stay found for transfer."), { statusCode: 400, code: "NO_ACTIVE_STAY" });
  }
  if (
    String(activeStay.roomId) === String(payload.targetRoomId) &&
    (!payload.targetBedId || String(activeStay.bedId) === String(payload.targetBedId))
  ) {
    throw Object.assign(new Error("Transfer target must differ from the current room and bed."), { statusCode: 400, code: "SAME_TRANSFER_TARGET" });
  }

  return { reservation, targetRoom, targetBed, predecessorContract, activeStay, effectiveTransferDate, destinationNeedsBed };
}

/**
 * R2 — Prepare (or reuse) the Room Transfer Addendum Draft + its PDF for a
 * planned transfer, WITHOUT performing the physical cutover. This is the
 * "preview / download the Addendum before you Confirm" endpoint.
 *
 * Reuses the exact same Stage-A validation + `prepareRoomTransferDraft` as
 * the one-step cutover, so a subsequent `PUT /transfer` finds and reuses this
 * very Draft (idempotent — `createReplacementContractForTransfer` returns the
 * existing non-abandoned successor, and an already-`generated` Draft is not
 * regenerated).
 *
 * Mutates NOTHING physical: no Stay, no Reservation.roomId, no occupancy, no
 * Bill, no TenantCredit, no UtilityReading, no recurringRentRate, no
 * securityDepositHeld, no pendingTransfer* fields. The Addendum is created
 * `isCurrent:false` and is NOT activated as the tenant's current Contract.
 *
 * @returns {{ addendum: {...identity}, reused: boolean }}
 */
export async function prepareRoomTransferAddendum({ reservationId, payload = {}, actorId = null }) {
  const {
    reservation, targetRoom, targetBed, predecessorContract, activeStay, effectiveTransferDate,
  } = await resolveValidatedRoomTransferIntent({ reservationId, payload, requireConfirm: false });

  // Was a compatible Draft already prepared for this exact transfer?
  const existing = await resolveRoomTransferSuccessor({ predecessorContractId: predecessorContract._id }).catch(() => null);
  const reused = Boolean(
    existing &&
    String(existing.roomId) === String(targetRoom._id) &&
    ["generated", "awaiting_signatures", "partially_signed", "signed",
     "awaiting_notarization", "notarized", "ready_for_publication", "published"].includes(existing.status),
  );

  const addendum = await prepareRoomTransferDraft({
    reservation,
    predecessorContract,
    activeStay,
    targetRoom,
    targetBed,
    effectiveTransferDate,
    actorId,
  });

  return {
    reused,
    addendum: {
      contractId: String(addendum._id),
      contractNumber: addendum.contractNumber || null,
      contractPurpose: addendum.contractPurpose,          // "amendment"
      status: addendum.status,                            // "generated"
      version: addendum.version ?? null,
      amendmentEffectiveDate: addendum.amendmentEffectiveDate || effectiveTransferDate,
      leaseStartDate: addendum.leaseStartDate || null,    // ORIGINAL lease start (unchanged)
      leaseEndDate: addendum.leaseEndDate || null,        // ORIGINAL lease end (unchanged)
      roomId: String(addendum.roomId),
      roomNumber: addendum.roomNumber || targetRoom.roomNumber || null,
      roomType: addendum.roomType || targetRoom.type || null,
      bedId: addendum.bedId || null,
      approvedMonthlyRate: addendum.approvedMonthlyRate ?? null,
      securityDepositAmount: addendum.securityDepositAmount ?? null,
      preparedDocument: addendum.preparedDocument
        ? {
            url: addendum.preparedDocument.url || null,
            version: addendum.preparedDocument.version ?? null,
            fileHash: addendum.preparedDocument.fileHash || null,
          }
        : null,
    },
  };
}

/**
 * R4 — Discard a PRE-CUTOVER Room Transfer Addendum Draft. This is NOT a
 * reversal of a completed transfer: it only applies while the Addendum is a
 * `generated` (or earlier) Draft that has NOT been activated as the tenant's
 * current Contract and NO physical transfer has occurred.
 *
 * Transitions that Draft `-> cancelled` (which makes it an "abandoned"
 * successor — `createReplacementContractForTransfer` will then create a fresh
 * one for the next attempt). Leaves the original/current Contract active, the
 * Stay unchanged, the Reservation room unchanged, occupancy unchanged,
 * utilities unchanged. Creates no Bill / TenantCredit, changes no held
 * deposit, touches no `pendingTransfer*` fields, releases no bed lock.
 *
 * @returns {{ discarded: boolean, contractId: string|null, previousStatus: string|null }}
 */
export async function discardRoomTransferAddendum({ reservationId, actorId = null }) {
  const reservation = await Reservation.findById(reservationId)
    .populate("userId", "_id");
  if (!reservation) {
    throw Object.assign(new Error("Reservation not found"), { statusCode: 404, code: "RESERVATION_NOT_FOUND" });
  }

  const predecessorContract = await resolveAuthoritativeCurrentContract({
    reservationId: reservation._id,
    tenantId: reservation.userId?._id || reservation.userId,
  });
  if (!predecessorContract) {
    throw Object.assign(new Error("No current Contract for this tenant."), { statusCode: 409, code: "NO_CURRENT_CONTRACT" });
  }

  // If the tenant's CURRENT Contract is itself a room-transfer successor that
  // has been made current, the transfer already executed (Stage-B cutover
  // activated it) — this is a post-cutover state, NOT a pre-cutover discard.
  if (
    ROOM_TRANSFER_SUCCESSOR_PURPOSES.includes(predecessorContract.contractPurpose) &&
    predecessorContract.isCurrent === true &&
    predecessorContract.replacesContractId
  ) {
    // Only "already completed" when the physical room actually moved onto this
    // successor's room (a bare current amendment from a PRIOR completed
    // transfer is fine to build the NEXT transfer on).
    const succRoomId = String(predecessorContract.roomId);
    const reservationRoomId = String(reservation.roomId?._id || reservation.roomId);
    if (succRoomId === reservationRoomId) {
      // Is there a not-yet-current NEXT-transfer Draft chained off it? If so we
      // fall through and discard that. Otherwise the only thing "in flight" is
      // the completed transfer itself.
      const chainedNext = await Contract.findOne({
        replacesContractId: predecessorContract._id,
        contractPurpose: { $in: [...ROOM_TRANSFER_SUCCESSOR_PURPOSES] },
        status: { $nin: [...ABANDONED_TRANSFER_SUCCESSOR_STATUSES] },
        isCurrent: { $ne: true },
      });
      if (!chainedNext) {
        throw Object.assign(
          new Error("This Room Transfer has already been completed and cannot be discarded here. Post-cutover reversal is a separate workflow."),
          { statusCode: 409, code: "TRANSFER_ALREADY_COMPLETED" },
        );
      }
    }
  }

  // The prepared successor, if any — a NON-abandoned amendment/replacement
  // that replaces the current Contract and has NOT itself been made current.
  const successor = await Contract.findOne({
    replacesContractId: predecessorContract._id,
    contractPurpose: { $in: [...ROOM_TRANSFER_SUCCESSOR_PURPOSES] },
    status: { $nin: [...ABANDONED_TRANSFER_SUCCESSOR_STATUSES] },
  }).sort({ createdAt: -1 });

  if (!successor) {
    throw Object.assign(
      new Error("No prepared Room Transfer Addendum to discard."),
      { statusCode: 404, code: "NO_PREPARED_ADDENDUM" },
    );
  }
  // If it has already become the tenant's current Contract, the transfer has
  // been executed — this is a post-cutover state, not a discard.
  if (successor.isCurrent === true) {
    throw Object.assign(
      new Error("This Room Transfer has already been completed and cannot be discarded here. Post-cutover reversal is a separate workflow."),
      { statusCode: 409, code: "TRANSFER_ALREADY_COMPLETED" },
    );
  }
  if (!DISCARDABLE_ADDENDUM_STATUSES.has(successor.status)) {
    throw Object.assign(
      new Error(`A Room Transfer Addendum in status "${successor.status}" cannot be discarded.`),
      { statusCode: 409, code: "ADDENDUM_NOT_DISCARDABLE" },
    );
  }

  const previousStatus = successor.status;
  await transitionContract(successor, "cancelled", actorId, "Room Transfer Addendum discarded before cutover by admin");

  return { discarded: true, contractId: String(successor._id), previousStatus };
}

// Statuses from which a prepared-but-not-current transfer Addendum may be
// discarded. Deliberately excludes final/legal statuses (active/expired/etc.)
// and anything already terminal.
const DISCARDABLE_ADDENDUM_STATUSES = new Set([
  "draft", "incomplete", "ready_for_generation", "generated",
  "awaiting_signatures", "partially_signed",
]);

async function prepareRoomTransferDraft({ reservation, predecessorContract, activeStay, targetRoom, targetBed, effectiveTransferDate, actorId }) {
  const successor = await createReplacementContractForTransfer({
    reservationId: reservation._id,
    stayId: activeStay?._id || predecessorContract.stayId,
    oldContract: predecessorContract,
    targetRoom,
    targetBed: targetBed
      ? { id: targetBed.id || String(targetBed._id), label: targetBed.position || "" }
      : {},
    effectiveTransferDate,
    actorId,
  });

  if (String(successor.roomId) !== String(targetRoom._id)) {
    throw Object.assign(
      new Error("An existing room-transfer replacement Contract for this tenant targets a different room. Resolve it before transferring."),
      { statusCode: 409, code: "ROOM_TRANSFER_CONTRACT_ROOM_MISMATCH" },
    );
  }

  // Already prepared (retry, or prepared earlier) — nothing to regenerate.
  const PREPARED_OR_BEYOND = new Set([
    "generated", "awaiting_signatures", "partially_signed", "signed",
    "awaiting_notarization", "notarized", "ready_for_publication", "published",
  ]);
  if (PREPARED_OR_BEYOND.has(successor.status)) return successor;

  if (successor.status !== "ready_for_generation") {
    const validation = await validateContractForGeneration(successor);
    if (!validation.valid) {
      throw Object.assign(
        new Error(
          "The room-transfer replacement Contract could not be auto-completed for generation: " +
          (validation.missingFields?.join(", ") || validation.errors?.join(", ") || "missing required data") +
          ". Complete it in the Contracts workspace, then retry the transfer.",
        ),
        { statusCode: 422, code: "ROOM_TRANSFER_CONTRACT_INCOMPLETE", validation },
      );
    }
    await transitionContract(successor, "ready_for_generation", actorId, "Room-transfer replacement Contract auto-validated");
    Object.assign(successor, validation.generationData.pricing);
    successor.templateType = validation.template.templateId;
    successor.templateVersion = validation.template.templateVersion;
    successor.legalContentVersion = validation.template.legalContentVersion;
    successor.validatedGenerationData = validation.generationData;
    successor.lastValidatedAt = new Date();
    successor.updatedBy = actorId;
    await successor.save();
  }

  const { contract: generated } = await generatePreparedContractPdf({
    contractId: successor._id,
    actorId,
    regenerationReason: `Auto-generated replacement for Room Transfer to Room ${targetRoom.roomNumber || targetRoom.name}`,
  });
  return generated;
}

export async function transferStayWorkflow({ reservationId, payload, actorId }) {
  // ── Stage A — pre-transaction preparation ────────────────────────────────
  // Cheap validation (no transaction session) + prepare the Room Transfer
  // Addendum Draft BEFORE opening the physical-transfer transaction (Contract
  // PDF generation is not transaction-safe). Identical validation to the
  // read-only `prepareRoomTransferAddendum` / `discardRoomTransferAddendum`
  // endpoints — the "is this transfer legal?" rules live in
  // `resolveValidatedRoomTransferIntent`.
  const {
    reservation: prepReservation,
    targetRoom: prepTargetRoom,
    targetBed: prepTargetBed,
    predecessorContract: prepPredecessor,
    activeStay: prepActiveStay,
    effectiveTransferDate: prepEffectiveDate,
  } = await resolveValidatedRoomTransferIntent({ reservationId, payload, requireConfirm: true });

  const preparedSuccessor = await prepareRoomTransferDraft({
    reservation: prepReservation,
    predecessorContract: prepPredecessor,
    activeStay: prepActiveStay,
    targetRoom: prepTargetRoom,
    targetBed: prepTargetBed,
    effectiveTransferDate: prepEffectiveDate,
    actorId,
  });

  // ── Stage B — physical transfer + Contract cutover (atomic) ──────────────
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const reservation = await Reservation.findById(reservationId)
        .populate("roomId", "name roomNumber branch beds currentOccupancy capacity type")
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

      // Hard guard, not just the advisory buildActionAvailability check above
      // (a stale UI state could otherwise bypass it) — a pending future
      // renewal must be resolved or cancelled before a room transfer can
      // proceed, since transferring the predecessor Contract out from under
      // it would leave the renewal's frozen currentTerms describing a room
      // the tenant no longer occupies.
      const pendingRenewalStay = await Stay.exists({
        reservationId: reservation._id,
        previousStayId: activeStay._id,
      }).session(session);
      if (pendingRenewalStay) {
        throw Object.assign(new Error("A future renewal already exists for this tenant. Resolve or cancel it before transferring."), { statusCode: 409, code: "FUTURE_RENEWAL_EXISTS" });
      }

      if (!payload.targetRoomId) {
        throw Object.assign(new Error("Target room is required."), { statusCode: 400, code: "MISSING_TRANSFER_FIELDS" });
      }

      const targetRoom = await Room.findById(payload.targetRoomId).session(session);
      if (!targetRoom) {
        throw Object.assign(new Error("Target room not found."), { statusCode: 404, code: "TARGET_ROOM_NOT_FOUND" });
      }
      if (String(targetRoom.branch) !== String(reservation.roomId?.branch || "")) {
        throw Object.assign(new Error("Transfers are limited to rooms within the same branch."), { statusCode: 400, code: "CROSS_BRANCH_TRANSFER_NOT_ALLOWED" });
      }
      // A room transfer MAY cross room types — nothing here blocks a
      // Private<->Double<->Quadruple change. Bed handling is decided
      // independently for the source and the destination from their own
      // live Room.type.
      const currentRoom = await Room.findById(activeStay.roomId).session(session);
      if (!currentRoom) {
        throw Object.assign(new Error("Current room not found."), { statusCode: 404, code: "CURRENT_ROOM_NOT_FOUND" });
      }
      const sourceNeedsBed = roomTypeRequiresBed(currentRoom.type);
      const destinationNeedsBed = roomTypeRequiresBed(targetRoom.type);

      if (destinationNeedsBed && !payload.targetBedId) {
        throw Object.assign(new Error("A specific bed must be selected for a shared room."), { statusCode: 400, code: "MISSING_TRANSFER_FIELDS" });
      }
      if (
        String(activeStay.roomId) === String(payload.targetRoomId) &&
        (!payload.targetBedId || String(activeStay.bedId) === String(payload.targetBedId))
      ) {
        throw Object.assign(new Error("Transfer target must differ from the current room and bed."), { statusCode: 400, code: "SAME_TRANSFER_TARGET" });
      }

      // Resolve the destination bed only when the destination room needs one.
      // A bed id supplied for a private destination is ignored, never
      // occupied. A bed must belong to the destination room and be available.
      const targetBed = destinationNeedsBed
        ? targetRoom.beds.find(
            (bed) => String(bed.id) === String(payload.targetBedId) || String(bed._id) === String(payload.targetBedId),
          )
        : null;
      if (destinationNeedsBed && !targetBed) {
        throw Object.assign(new Error("Target bed not found in the destination room."), { statusCode: 404, code: "TARGET_BED_NOT_FOUND" });
      }
      if (destinationNeedsBed && targetBed.status !== "available") {
        throw Object.assign(new Error("Selected target bed is not available."), { statusCode: 409, code: "BED_NOT_AVAILABLE" });
      }
      // Destination room capacity guard — only when actually changing rooms
      // (a same-room bed reshuffle does not add an occupant). Independent of
      // bed-level status, so it also covers a private destination.
      const changingRooms = String(activeStay.roomId) !== String(targetRoom._id);
      if (
        changingRooms &&
        Number(targetRoom.currentOccupancy || 0) >= Number(targetRoom.capacity || 0)
      ) {
        throw Object.assign(new Error("The destination room is full."), { statusCode: 409, code: "DESTINATION_ROOM_FULL" });
      }

      // ── Contract cutover readiness — the replacement Contract Draft was
      // prepared in Stage A (before this transaction). Re-resolve it here
      // with the transaction session so the cutover below acts on the same
      // authoritative record. It is a tenant-visible generated Draft, NOT a
      // wet-signed final — the tenant occupies the new room while the
      // Contract is still a Draft, exactly like a fresh move-in. Wet-signing
      // remains a later admin step (generated → … → published → active).
      const predecessorContract = await resolveAuthoritativeCurrentContract({
        reservationId: reservation._id,
        tenantId: reservation.userId?._id || reservation.userId,
        session,
      });
      if (!predecessorContract || !isValidTransferPredecessor(predecessorContract)) {
        throw Object.assign(
          new Error("The tenant's current lease Contract is not active — room transfer cannot proceed."),
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
      if (String(successorContract._id) !== String(preparedSuccessor._id)) {
        throw Object.assign(
          new Error("The room-transfer replacement Contract changed between preparation and execution. Retry the transfer."),
          { statusCode: 409, code: "ROOM_TRANSFER_CONTRACT_CHANGED" },
        );
      }

      const targetBedIdentifier = destinationNeedsBed && targetBed
        ? (targetBed.id || String(targetBed._id))
        : null;
      const sameRoomReshuffle = String(currentRoom._id) === String(targetRoom._id);

      if (sameRoomReshuffle) {
        // Same room, different bed (a shared-room bed reshuffle). currentRoom
        // and targetRoom are two stale instances of ONE document — mutate and
        // save exactly ONE of them, and do NOT touch the occupancy counter
        // (no occupant enters or leaves the room).
        if (sourceNeedsBed && activeStay.bedId) currentRoom.vacateBed(activeStay.bedId);
        if (targetBedIdentifier) {
          currentRoom.occupyBed(targetBedIdentifier, reservation.userId?._id || reservation.userId, reservation._id);
        }
        currentRoom.updateAvailability();
        await currentRoom.save({ session });
      } else {
        // ── Source room: release the bed (shared source only) and decrement
        // occupancy ATOMICALLY (conditional $inc — the same primitive the
        // canonical move-in/reserve path uses; see occupancyManager.js). The
        // in-memory instance is refreshed from the atomic result so the
        // subsequent bed-array save does not clobber the counter.
        const decremented = await Room.atomicDecreaseOccupancy(currentRoom._id, session);
        if (decremented) {
          currentRoom.currentOccupancy = decremented.currentOccupancy;
          currentRoom.available = decremented.available;
        } else {
          currentRoom.currentOccupancy = Math.max(0, Number(currentRoom.currentOccupancy || 0) - 1);
          currentRoom.updateAvailability();
        }
        if (sourceNeedsBed && activeStay.bedId) currentRoom.vacateBed(activeStay.bedId);
        await currentRoom.save({ session });

        // ── Destination room: increment occupancy ATOMICALLY. A null result
        // means the room filled between the guard above and here (concurrent
        // transfer / move-in claiming the last slot) — fail the whole
        // transfer safely; the transaction rolls back the source decrement.
        const incremented = await Room.atomicIncreaseOccupancy(targetRoom._id, session);
        if (!incremented) {
          throw Object.assign(
            new Error("The destination room filled up before the transfer could complete."),
            { statusCode: 409, code: "DESTINATION_ROOM_FULL" },
          );
        }
        targetRoom.currentOccupancy = incremented.currentOccupancy;
        targetRoom.available = incremented.available;
        // Occupy the bed only if the DESTINATION room type has per-bed
        // assignment. A private destination has no bed to occupy. targetBed
        // is null unless destinationNeedsBed, so a stale bed id sent for a
        // private destination is ignored here.
        if (targetBedIdentifier) {
          targetRoom.occupyBed(targetBedIdentifier, reservation.userId?._id || reservation.userId, reservation._id);
        }
        await targetRoom.save({ session });
      }

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

      // ── Security-Deposit Settlement (SEPARATE from rent — never netted) ──────
      // Canonical required deposit = 1x the destination room's approved monthly
      // rate (successorContract.approvedMonthlyRate — the same rule move-in
      // uses via structuredInitialPaymentPolicy / depositUtils). "Held" is the
      // ACTUAL deposit cash: reservation.securityDepositHeld, initialised here
      // from the tenant's move-in financials when it has never been populated
      // (legacy records) — deterministically, from the same resolver move-in
      // used, NOT fabricated from "the Contract said a deposit was required".
      const destinationRequiredDeposit = roundMoney(Number(successorContract.approvedMonthlyRate) || 0);
      // Scheduled transfer: if the pre-paid Scheduled Transfer Balance Bill
      // already funded securityDepositHeld (Phase 2F), the ADDITIONAL deposit
      // due for this transfer must be computed against the held amount as it
      // stood BEFORE that funding — otherwise the Bill-reuse assertion below
      // (recomputed component vs the Bill's charges.securityDeposit) would
      // mismatch and the settlement Bill would be wrong. The executor passes
      // that pre-funding value; the paid deposit component remains real cash
      // (its ledger entry is untouched).
      const scheduledDepositHeldOverride =
        payload.scheduledTransferBillId != null &&
        payload.depositHeldOverride != null &&
        Number.isFinite(Number(payload.depositHeldOverride))
          ? roundMoney(Number(payload.depositHeldOverride))
          : null;
      let depositCurrentlyHeld = scheduledDepositHeldOverride != null
        ? scheduledDepositHeldOverride
        : Number(reservation.securityDepositHeld);
      let heldWasBackfilled = false;
      if (!Number.isFinite(depositCurrentlyHeld)) {
        const moveInFinancials = resolveReservationFinancials(reservation);
        // Only treat the move-in deposit as "held" if the initial payment is
        // actually settled; otherwise fall back to 0 held (never assume cash).
        depositCurrentlyHeld = moveInFinancials.isSettled
          ? roundMoney(Number(moveInFinancials.securityDeposit) || 0)
          : 0;
        heldWasBackfilled = true;
      }
      const depositSettlement = calculateRoomTransferDepositSettlement({
        depositCurrentlyHeld,
        destinationRequiredDeposit,
      });
      const additionalDepositDue = depositSettlement.additionalDepositDue;
      const excessDepositHeld = depositSettlement.excessDepositHeld;

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

      // ── Transfer Settlement Bill ───────────────────────────────────────────
      // ONE Bill, but rent and security deposit are separate, categorized
      // charge lines that are never flattened:
      //   charges.rent            = additional RENT due (destination prorated
      //                             remainder − unused prepaid rent, floored
      //                             at 0). An excess becomes a TenantCredit
      //                             (below), not a negative line.
      //   charges.securityDeposit = additional DEPOSIT due (destination
      //                             required − currently held, floored at 0).
      //                             Only the DIFFERENCE, never a full deposit.
      // The Bill total is the canonical sumBillCharges(charges) — never a
      // hand-rolled sum in this service.
      //
      // SOURCE-ROOM ELECTRICITY IS NOT CHARGED HERE. The transfer writes a
      // `moveOut` electricity UtilityReading at the transfer date (above);
      // when the source room's UtilityPeriod is later closed, the departed
      // tenant is billed for EXACTLY their pre-transfer segment
      // ([periodStart, transfer-cutoff]) via the room-scoped occupancy
      // resolution (see resolveRoomScopedReservationsForPeriod, Phase 4).
      // That period close is the single canonical financial responsibility
      // for that consumption. Adding an `estimatedElectricityCharge` line on
      // this Bill too would double-charge the same kWh. The estimate is kept
      // in transferSnapshot as an ADMIN PREVIEW figure only (informational).
      // Source-room WATER is likewise left to its canonical period close
      // (Phase 5) — never settled immediately here.
      const transferCharges = {
        rent: settlement.additionalAmountDue,
        electricity: 0,
        water: 0,
        applianceFees: 0,
        corkageFees: 0,
        penalty: 0,
        securityDeposit: additionalDepositDue,
        discount: 0,
      };
      const transferSettlementTotal = sumBillCharges(transferCharges);
      const rentComponentDue = roundMoney(settlement.additionalAmountDue);
      const depositComponentDue = roundMoney(additionalDepositDue);
      const excessRentCredit = roundMoney(settlement.excessCredit);

      const noteParts = [
        `Transfer settlement: ${currentRoom.name || currentRoom.roomNumber} → ${targetRoom.name || targetRoom.roomNumber} on ${effectiveTransferDate.toISOString().slice(0, 10)}`,
        `rent due ₱${rentComponentDue.toFixed(2)}`,
        `deposit due ₱${depositComponentDue.toFixed(2)}`,
      ];
      if (excessRentCredit > 0) noteParts.push(`excess prepaid rent ₱${excessRentCredit.toFixed(2)} kept as rent credit`);
      if (excessDepositHeld > 0) noteParts.push(`excess deposit held ₱${excessDepositHeld.toFixed(2)} (stays refundable)`);

      // ── Scheduled Room Transfer: RE-USE the pre-created (and possibly
      //    already-paid) Scheduled Transfer Balance Bill instead of creating a
      //    SECOND transfer_settlement Bill. The executor
      //    (scheduledRoomTransferExecutor.js) has already gated: it only calls
      //    this workflow when the linked Bill's rent + securityDeposit
      //    components equal the freshly-recomputed canonical settlement, and
      //    only when that Bill is fully settled (or zero). So here we just
      //    assert that invariant still holds in-session (a mismatch is a race
      //    -> abort the whole txn) and refresh the Bill's execution-time
      //    metadata while preserving paidAmount / status / payment history.
      const scheduledBillId = payload.scheduledTransferBillId || null;
      let transferBill;
      if (scheduledBillId) {
        transferBill = await Bill.findById(scheduledBillId).session(session);
        if (
          !transferBill ||
          String(transferBill.reservationId) !== String(reservation._id) ||
          transferBill.billType !== "transfer_settlement" ||
          transferBill.isArchived === true ||
          transferBill.status === "voided"
        ) {
          throw Object.assign(
            new Error("The linked Scheduled Room Transfer Balance Bill is missing or invalid."),
            { statusCode: 409, code: "ROOM_TRANSFER_SCHEDULED_BILL_INVALID" },
          );
        }
        const billRent = roundMoney(Number(transferBill.charges?.rent || 0));
        const billDeposit = roundMoney(Number(transferBill.charges?.securityDeposit || 0));
        if (
          Math.abs(billRent - roundMoney(transferCharges.rent)) > 0.01 ||
          Math.abs(billDeposit - roundMoney(transferCharges.securityDeposit)) > 0.01
        ) {
          throw Object.assign(
            new Error(
              "The Scheduled Room Transfer Balance Bill no longer matches the canonical settlement recomputed at execution.",
            ),
            { statusCode: 409, code: "ROOM_TRANSFER_SCHEDULED_BILL_MISMATCH" },
          );
        }
        // Refresh execution-time metadata; never touch paidAmount / payment history.
        transferBill.roomId = currentRoom._id;
        transferBill.billingMonth = effectiveTransferDate;
        transferBill.billingCycleStart = currentBillingCycle?.billingCycleStart || effectiveTransferDate;
        transferBill.billingCycleEnd = currentBillingCycle?.billingCycleEnd || effectiveTransferDate;
        transferBill.proRataDays = proRataDays || null;
        transferBill.notes = noteParts.join("; ");
        transferBill.transferSnapshot = {
          ...(transferBill.transferSnapshot || {}),
          fromRoomId: currentRoom._id,
          fromRoomName: currentRoom.name || currentRoom.roomNumber || "",
          fromRoomType: currentRoom.type || "",
          toRoomId: targetRoom._id,
          toRoomName: targetRoom.name || targetRoom.roomNumber || "",
          toRoomType: targetRoom.type || "",
          effectiveTransferDate,
          cycleStart: currentBillingCycle?.billingCycleStart || null,
          cycleEnd: currentBillingCycle?.billingCycleEnd || null,
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
          sourceElectricitySettledAtPeriodClose: true,
          depositPreviouslyHeld: depositSettlement.depositPreviouslyHeld,
          destinationRequiredDeposit: depositSettlement.destinationRequiredDeposit,
          additionalDepositDue: depositSettlement.additionalDepositDue,
          excessDepositHeld: depositSettlement.excessDepositHeld,
          depositHeldAfterTransferBeforePayment: depositSettlement.depositHeldAfterTransferBeforePayment,
          depositHeldWasBackfilled: heldWasBackfilled,
          rentComponentDue,
          depositComponentDue,
          totalImmediateDue: transferSettlementTotal,
          transferReference: predecessorContract._id,
          isScheduledTransferBalance: true,
          reconciledAtExecution: true,
        };
        syncBillAmounts(transferBill, { preserveStatus: true });
        await transferBill.save({ session });
      } else {
      [transferBill] = await Bill.create(
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
            charges: transferCharges,
            totalAmount: transferSettlementTotal,
            grossAmount: transferSettlementTotal,
            remainingAmount: transferSettlementTotal,
            status: transferSettlementTotal > 0 ? "pending" : "paid",
            notes: noteParts.join("; "),
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
              // ── RENT breakdown (actual-days) ─────────────────────────────
              // sourceApprovedRate is the RESOLVED source-effective rent used
              // to value consumed days (see sourceRateSource) — for a
              // structured reservation with an approved discount this is
              // pricingSnapshot.finalMonthlyRate, not the raw predecessor
              // Contract field.
              cycleStart: currentBillingCycle?.billingCycleStart || null,
              cycleEnd: currentBillingCycle?.billingCycleEnd || null,
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
              // Informational admin-preview figures only — NOT a charge on
              // this Bill. The departed tenant's source-room electricity is
              // billed once, at the source room's UtilityPeriod close.
              estimatedElectricityKwh,
              estimatedElectricityCharge: estimatedElectricityCharge > 0 ? estimatedElectricityCharge : null,
              sourceElectricitySettledAtPeriodClose: true,
              // ── DEPOSIT breakdown (independent of rent) ──────────────────
              depositPreviouslyHeld: depositSettlement.depositPreviouslyHeld,
              destinationRequiredDeposit: depositSettlement.destinationRequiredDeposit,
              additionalDepositDue: depositSettlement.additionalDepositDue,
              excessDepositHeld: depositSettlement.excessDepositHeld,
              depositHeldAfterTransferBeforePayment: depositSettlement.depositHeldAfterTransferBeforePayment,
              depositHeldWasBackfilled: heldWasBackfilled,
              // ── FINAL settlement components ─────────────────────────────
              rentComponentDue,
              depositComponentDue,
              totalImmediateDue: transferSettlementTotal,
              transferReference: predecessorContract._id,
            },
          },
        ],
        { session },
      );
      }

      // ── Excess prepaid RENT -> reusable TenantCredit (never a deposit,
      //    never a refund here). Idempotency key is bound to the transfer
      //    event (predecessor Contract id): a retried transfer resolves the
      //    same credit instead of creating a second one.
      if (excessRentCredit > 0) {
        await recordRoomTransferRentCredit({
          userId: reservation.userId?._id || reservation.userId,
          reservationId: reservation._id,
          branch: currentRoom.branch,
          amount: excessRentCredit,
          transferReference: predecessorContract._id,
          sourceBillId: transferBill._id,
          idempotencyKey: `room_transfer_rent_credit:${String(predecessorContract._id)}`,
          reason: `Excess prepaid rent on transfer ${currentRoom.roomNumber} -> ${targetRoom.roomNumber}`,
          createdBy: actorId,
          session,
        });
      }

      // ── Security deposit HELD ledger ───────────────────────────────────────
      // Held CASH does NOT change at transfer time:
      //   - a higher-deposit destination bills the difference (charges.
      //     securityDeposit) and only funds securityDepositHeld when that
      //     component is CONFIRMED PAID (paymentLedger.js);
      //   - a lower-deposit destination leaves the excess held (refundable).
      // We only (a) initialise securityDepositHeld from move-in financials if
      // it was never populated, and (b) append an audit entry recording the
      // new REQUIRED amount and any additional-due / excess-held.
      const heldBefore = Number.isFinite(Number(reservation.securityDepositHeld))
        ? roundMoney(Number(reservation.securityDepositHeld))
        : roundMoney(depositCurrentlyHeld);
      reservation.securityDepositHeld = heldBefore;
      reservation.securityDepositLedger = reservation.securityDepositLedger || [];
      const depositLedgerKey = `room_transfer_adjustment_due:${String(predecessorContract._id)}`;
      if (!reservation.securityDepositLedger.some((e) => e.idempotencyKey === depositLedgerKey)) {
        reservation.securityDepositLedger.push({
          kind: heldWasBackfilled ? "backfill" : "transfer_adjustment_due",
          previousHeld: heldWasBackfilled ? null : heldBefore,
          adjustmentAmount: 0, // held cash unchanged at this point
          resultingHeld: heldBefore,
          sourceRef: { kind: "bill", id: transferBill._id },
          transferReference: predecessorContract._id,
          billId: transferBill._id,
          idempotencyKey: depositLedgerKey,
          reason:
            `Room transfer ${currentRoom.roomNumber} -> ${targetRoom.roomNumber}: ` +
            `required deposit ₱${destinationRequiredDeposit.toFixed(2)}, held ₱${heldBefore.toFixed(2)}` +
            (additionalDepositDue > 0 ? `, additional ₱${additionalDepositDue.toFixed(2)} due on Bill` : "") +
            (excessDepositHeld > 0 ? `, excess ₱${excessDepositHeld.toFixed(2)} held (refundable)` : ""),
          createdBy: actorId,
        });
      }

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
      } else {
        // No active BedHistory row for the SOURCE room — today move-in only
        // creates one for shared rooms, so a tenant transferring OUT of a
        // PRIVATE room would otherwise leave no room-scoped occupancy record.
        // Utility (electricity/water) billing resolves a room's occupants for
        // a period spanning the transfer from BedHistory, so create the
        // closed audit row now. Room-scoped, written in this same
        // transaction, rolled back with everything else on failure.
        const sourceBedSentinel = (sourceNeedsBed && activeStay.bedId) || `room-${currentRoom._id}`;
        await BedHistory.create(
          [
            {
              bedId: sourceBedSentinel,
              roomId: currentRoom._id,
              branch: currentRoom.branch,
              tenantId: reservation.userId?._id || reservation.userId,
              reservationId: reservation._id,
              stayId: activeStay._id,
              moveInDate: readMoveInDate(reservation) || activeStay.leaseStartDate,
              effectiveStartDate: readMoveInDate(reservation) || activeStay.leaseStartDate,
              moveOutDate: effectiveTransferDate,
              effectiveEndDate: effectiveTransferDate,
              status: "transferred",
              closedByAction: "transfer",
              reason: payload.reason || "Room transfer",
              notes: payload.notes || "",
              transferSourceReading: sourceMeterReading != null ? Number(sourceMeterReading) : null,
              transferTargetReading: targetMeterReading != null ? Number(targetMeterReading) : null,
              proratedRentAdjustment: proRataRent,
              fromRoomSnapshot: {
                roomId: currentRoom._id,
                name: currentRoom.name || "",
                roomNumber: currentRoom.roomNumber || "",
                type: currentRoom.type || "",
                floor: currentRoom.floor || null,
                branch: currentRoom.branch || "",
                monthlyPrice: currentRoom.monthlyPrice || currentRoom.price || 0,
              },
              billingSnapshotAtTransfer: {
                totalOutstanding: billingSummary.currentBalance,
                totalBilled: billingSummary.visibleBills.reduce(
                  (sum, e) => sum + Number(e.bill?.totalAmount || 0), 0,
                ),
                totalPaid: billingSummary.visibleBills.reduce(
                  (sum, e) => sum + Number(e.bill?.paidAmount || 0), 0,
                ),
                proRataDays,
                proRataRent,
              },
            },
          ],
          { session },
        );
      }

      // A private destination has no per-bed record. BedHistory.bedId and
      // Stay.bedId are both required String fields (Mongoose rejects ""), so
      // use one stable room-scoped sentinel for both — the canonical
      // private-room bed representation for this flow. All close-out /
      // resolution lookups here are by reservation/tenant/room/status, never
      // bed-scoped, so the sentinel is inert.
      const privateBedSentinel = `room-${targetRoom._id}`;
      const stayBedId = targetBedIdentifier || privateBedSentinel;
      await BedHistory.create(
        [
          {
            bedId: stayBedId,
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

      const destinationApprovedRate = Number(successorContract.approvedMonthlyRate) || 0;

      activeStay.roomId = targetRoom._id;
      // Shared destination -> the real bed id; private destination -> the
      // room-scoped sentinel (Stay.bedId is a required String).
      activeStay.bedId = stayBedId;
      // Move-out deposit clearance reads Stay.monthlyRent for the 1x-rate
      // deposit fallback — keep it aligned with the destination rate so a
      // legacy tenant (no securityDepositHeld yet) still gets the right
      // destination-based figure.
      if (destinationApprovedRate > 0) activeStay.monthlyRent = destinationApprovedRate;
      activeStay.transferNotes = payload.notes || payload.reason || "";
      activeStay.updatedBy = actorId;
      await activeStay.save({ session });

      reservation.roomId = targetRoom._id;
      // Reservation.selectedBed.id follows the existing convention of "" for
      // a private room (it is not a required field).
      reservation.selectedBed = {
        id: targetBedIdentifier || "",
        position: targetBed?.position || null,
      };
      reservation.currentStayId = activeStay._id;
      reservation.latestStayStatus = activeStay.status;
      // Future rent bills (generated after this transfer) must bill the
      // destination room's approved rate, not the old room's — the
      // recurring due-date/billing-cycle anchor itself (movein-based) is
      // deliberately left untouched, this only updates which rate applies.
      reservation.monthlyRent = destinationApprovedRate || reservation.monthlyRent;
      // A STRUCTURED reservation's recurring rent bill normally resolves from
      // the IMMUTABLE pricingSnapshot.finalMonthlyRate (which a room transfer
      // may not touch — see the Reservation pre-save guard). Record the
      // post-transfer destination rate on a dedicated recurringRentRate
      // field; resolveReservationRentAmount (rentGenerator.js) prefers it
      // over the snapshot when set, so the next monthly Bill uses the
      // destination rate without violating snapshot immutability.
      if (destinationApprovedRate > 0) {
        reservation.recurringRentRate = destinationApprovedRate;
      }

      // Ensure declared appliance add-ons cleanly carry over during room transfers within Guadalupe
      const targetBranch = String(targetRoom.branch || "").toLowerCase();
      if (targetBranch === "guadalupe") {
        reservation.selectedAppliances = reservation.selectedAppliances || [];
        reservation.applianceFees = Number(reservation.applianceFees || 0);
        reservation.totalPrice = Number(reservation.monthlyRent || 0) + Number(reservation.applianceFees || 0);

        if (payload?.successorReservationId) {
          const succRes = await Reservation.findById(payload.successorReservationId).session(session);
          if (succRes) {
            succRes.selectedAppliances = Array.isArray(reservation.selectedAppliances)
              ? JSON.parse(JSON.stringify(reservation.selectedAppliances))
              : [];
            succRes.applianceFees = Number(reservation.applianceFees || 0);
            if (succRes.monthlyRent != null) {
              succRes.totalPrice = Number(succRes.monthlyRent) + Number(succRes.applianceFees);
            }
            await succRes.save({ session });
          }
        }
      }

      await reservation.save({ session });

      // ── Contract cutover — last step before commit. Participates in this
      // same transaction (session passed through): a failure here rolls
      // back every physical mutation above via session.withTransaction's
      // automatic abort; success here can never be reached if any physical
      // mutation above already failed. This is the single Contract
      // transition authority — no manual status/isCurrent mutation here.
      // Draft variant: the successor is a tenant-visible generated Draft
      // (prepared in Stage A), not a wet-signed final — predecessor →
      // replaced, successor → isCurrent + tenantVisible, status left at
      // "generated". Wet-signing stays a later admin step.
      const cutover = await activateRoomTransferSuccessorDraft({
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
          assignedBedId: targetBedIdentifier || null,
          assignedBedPosition: targetBed?.position || null,
        },
        billingSnapshot: {
          outstandingBalanceAtTransfer: billingSummary.currentBalance,
          proRataDays,
          proRataRent,
          transferBillId: transferBill?._id || null,
          // Rent and deposit components kept separate.
          rentComponentDue,
          depositComponentDue,
          excessRentCredit,
          excessDepositHeld,
          depositPreviouslyHeld: depositSettlement.depositPreviouslyHeld,
          destinationRequiredDeposit: depositSettlement.destinationRequiredDeposit,
          totalImmediateDue: transferSettlementTotal,
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

    // Contract lineage: the replacement Contract Draft was generated in
    // Stage A and made the tenant's current Contract by the cutover inside
    // the transaction. Nudge the web/admin/mobile surfaces to refetch so the
    // new Draft (and its Pending acknowledgement) shows without a manual
    // reload. Fire-and-forget — the transfer already succeeded.
    try {
      const { emitToUser, emitToAdmins } = await import("./socket.js");
      const succId = result.contractCutover?.successorContractId;
      if (tenantId && succId && typeof emitToUser === "function") {
        emitToUser(tenantId, "contract:updated", {
          contractId: String(succId),
          reason: "room_transfer",
          reservationId: String(reservationId),
        });
      }
      if (succId && typeof emitToAdmins === "function") {
        emitToAdmins("contract:updated", { contractId: String(succId), reason: "room_transfer" });
      }
    } catch {
      // realtime layer optional — a plain refresh still shows the new Draft
    }

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

      // ── Contract lifecycle synchronization ──────────────────────────────
      // Move-out must also formally close the tenant's Contract — otherwise
      // it is silently left at "active"/"expiring_soon" forever, which lets
      // stale renewals activate and lets the tenant/admin keep seeing an
      // "Active Contract" for a tenancy that has already ended. A normal,
      // full-term move-out drives the Contract to "expired" (move-out is the
      // sole writer of that status); reason:"terminated" (early exit or
      // administrative termination) drives it to "terminated" instead. Both
      // are legal terminal edges from published/active/expiring_soon in
      // CONTRACT_TRANSITIONS, and transitionContract forces isCurrent:false
      // for either (see terminalStatuses in contractService.js).
      const currentContract = await resolveAuthoritativeCurrentContract({
        reservationId: reservation._id,
        session,
      });
      if (
        currentContract &&
        !["terminated", "archived", "expired", "replaced", "cancelled"].includes(
          currentContract.status,
        )
      ) {
        const targetStatus = payload.reason === "terminated" ? "terminated" : "expired";
        await transitionContract(
          currentContract,
          targetStatus,
          actorId,
          payload.reason === "terminated" ? "early_termination_move_out" : "normal_completion_move_out",
          session,
        );

        // A dangling lease renewal chained off the Contract we just closed
        // out is now meaningless — left alone, the daily renewal-activation
        // cron could otherwise activate it for a tenant who has already
        // left. Cancel it here, synchronously, in the same transaction.
        const danglingRenewal = await Contract.findOne({
          contractPurpose: "renewal",
          replacesContractId: currentContract._id,
          status: { $in: ["published", "renewal_pending"] },
        }).session(session);
        if (danglingRenewal) {
          await transitionContract(
            danglingRenewal,
            "cancelled",
            actorId,
            "predecessor_moved_out",
            session,
          );
        }
      } else if (!currentContract) {
        logger.warn(
          { reservationId: reservation._id },
          "Move-out completed with no resolvable current Contract — nothing to transition (known gap, tracked separately).",
        );
      }

      reservation.status = "moveOut";
      reservation.moveOutDate = moveOutAt;
      reservation.currentStayId = activeStay._id;
      reservation.latestStayStatus = activeStay.status;

      // ── Deposit Forfeiture & Settlement Calculation ──────────────────────────
      const leaseEndDate = activeStay.leaseEndDate
        ? new Date(activeStay.leaseEndDate)
        : null;
      const isEarlyVacancy = leaseEndDate && moveOutAt < leaseEndDate;

      // Settle against the ACTUAL cash held (kept authoritative by the
      // room-transfer + payment flows). Phase 10:
      //   - `Number(null)` is 0, so a legacy record (securityDepositHeld
      //     never populated) or one the transfer flow BACKFILLED to 0
      //     (move-in financials not settled) must NOT be read as "₱0 held".
      //   - A genuine 0-held record is indistinguishable from those and, in
      //     practice, means nothing to refund anyway — so both fall back to
      //     the canonical basis: the current Stay's monthly rent (which the
      //     transfer keeps aligned to the destination rate), then the 1x
      //     resolver. This mirrors moveOutClearanceService.openMoveOutClearance.
      const heldRaw = Number(reservation.securityDepositHeld);
      const heldIsRealCash = Number.isFinite(heldRaw) && heldRaw > 0;
      const securityDepositAmount = heldIsRealCash
        ? heldRaw
        : Number(activeStay?.monthlyRent) > 0
          ? Number(activeStay.monthlyRent)
          : resolveSecurityDeposit(reservation);
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

      // Additive fields for the early-termination call path
      // (executeEarlyTerminationWorkflow) — do not alter the deposit
      // forfeiture/settlement formula above, only record the penalty
      // context alongside it when supplied.
      if (payload.earlyTerminationPenalty !== undefined) {
        reservation.earlyTerminationPenalty = Number(payload.earlyTerminationPenalty);
      }
      if (payload.forfeitureReason && payload.reason === "terminated") {
        reservation.depositForfeitureReason = payload.forfeitureReason;
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

    // ── Tenant is leaving the dorm: resolve any OPEN scheduled room transfer
    //    so a future destination hold is never left blocking a room after the
    //    tenant is gone. No payment -> safe auto-cancel; payment exists ->
    //    hold released but Bill/Payment/deposit-ledger/Addendum history
    //    preserved + action_required PAYMENT_ALREADY_RECEIVED. Never executes
    //    the transfer. Best-effort — runs AFTER the move-out txn commits and
    //    never fails the move-out itself. (Termination routes through this
    //    same workflow.)
    try {
      const { resolveScheduledTransferBeforeTenantDeparture } = await import(
        "../services/scheduledRoomTransferExecutor.js"
      );
      await resolveScheduledTransferBeforeTenantDeparture(reservationId, { actorId });
    } catch (e) {
      logger.warn({ err: e, reservationId }, "moveOutStayWorkflow: scheduled-transfer resolution failed (non-fatal)");
    }

    return result;
  } finally {
    await session.endSession();
  }
}

// NOTE (R1 hybrid reconciliation): main's `cancelTransferStayWorkflow` is
// intentionally NOT carried forward. It operated on the phantom
// `reservation.pendingTransfer*` / `transferStatus` fields and a bed "lock"
// that the prepare step never actually set, and it filtered on
// `contractPurpose:"replacement"`. The canonical one-step Addendum model has
// no pre-cutover phantom state to unwind. A clean "discard prepared Room
// Transfer Addendum" workflow (transition the generated Addendum Draft ->
// cancelled, nothing else) is introduced in R4.

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
 *
 * Delegates to moveOutStayWorkflow (the canonical, transactional, billing-
 * aware move-out path) with reason:"terminated" rather than maintaining a
 * second, thinner move-out implementation. Previously this function never
 * touched Stay or Contract at all and skipped the outstanding-balance check
 * entirely — a divergence that made "early termination" and "move-out with
 * reason=terminated" produce two different, inconsistent end-states for what
 * is conceptually the same real-world event. Callers must now supply the
 * same required fields moveOutStayWorkflow needs (moveOutDate,
 * finalUtilityReading, confirm is implied) in addition to the
 * penalty/forfeiture fields specific to early termination.
 */
export async function executeEarlyTerminationWorkflow(reservationId, payload = {}, actorId = null) {
  const { penaltyFee = 0, forfeitureReason = "early_termination", ...rest } = payload;
  const result = await moveOutStayWorkflow({
    reservationId,
    payload: {
      ...rest,
      reason: "terminated",
      confirm: true,
      earlyTerminationPenalty: Number(penaltyFee),
      forfeitureReason,
    },
    actorId,
  });

  return {
    success: true,
    message: "Early termination executed successfully.",
    reservation: result.reservation,
    stay: result.stay,
    billingSummary: result.billingSummary,
    depositSettlement: result.depositSettlement,
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

  // Resolve any OPEN scheduled room transfer — same rule as move-out: no
  // payment -> safe auto-cancel; payment exists -> hold released, financial
  // history preserved, action_required. Never executes the transfer.
  try {
    const { resolveScheduledTransferBeforeTenantDeparture } = await import(
      "../services/scheduledRoomTransferExecutor.js"
    );
    await resolveScheduledTransferBeforeTenantDeparture(reservationId, { actorId });
  } catch (e) {
    logger.warn({ err: e, reservationId }, "executeAbandonmentProtocolWorkflow: scheduled-transfer resolution failed (non-fatal)");
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

/**
 * Utility helper to copy declared appliance add-ons and recalculate fees
 * from a source reservation to a successor reservation within Guadalupe.
 *
 * @param {Object} sourceReservation
 * @param {Object} targetReservation
 */
export function copyApplianceAddOns(sourceReservation, targetReservation) {
  if (!sourceReservation || !targetReservation) return;
  const branch = String(
    targetReservation.roomId?.branch ||
      targetReservation.branch ||
      sourceReservation.roomId?.branch ||
      sourceReservation.branch ||
      "",
  ).toLowerCase();

  if (branch === "guadalupe") {
    targetReservation.selectedAppliances = Array.isArray(
      sourceReservation.selectedAppliances,
    )
      ? JSON.parse(JSON.stringify(sourceReservation.selectedAppliances))
      : [];
    targetReservation.applianceFees = Number(
      sourceReservation.applianceFees || 0,
    );
    if (targetReservation.monthlyRent != null) {
      targetReservation.totalPrice =
        Number(targetReservation.monthlyRent) +
        Number(targetReservation.applianceFees);
    }
  }
}



