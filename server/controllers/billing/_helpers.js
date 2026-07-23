import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { Bill, Reservation, Room, User, UtilityPeriod } from "../../models/index.js";

export const RoomBill = mongoose.models.RoomBill || mongoose.model("RoomBill", new mongoose.Schema({}, { strict: false }));
import logger from "../../middleware/logger.js";
import {
  sendSuccess,
  sendError,
  AppError,
} from "../../middleware/errorHandler.js";
import {
  sendBillGeneratedEmail,
  sendOverdueNoticeEmail,
  sendPaymentApprovedEmail,
  sendPaymentReminderEmail,
  sendPaymentRejectedEmail,
} from "../../config/email.js";
import { applyBillPayment } from "../../utils/paymentLedger.js";
import { ensureCurrentCycleRentBill } from "../../utils/rentGenerator.js";
export {
  getBillRemainingAmount,
  getReservationRecurringFees,
  getVisibleBillCharges,
  getVisibleBillSnapshot,
  isUtilityChargeVisible,
  getReservationCreditAvailable,
  buildRentBillingCycle,
  resolveCurrentRentBillingCycle,
  resolveBillStatus,
  roundMoney,
  syncBillAmounts,
} from "../../utils/billingPolicy.js";
import { computePenalty, fetchPenaltySettings } from "../../utils/penaltyCalculator.js";
import notify from "../../utils/notificationService.js";
import { sendDraftUtilityBills } from "../../utils/utilityBillFlow.js";
import { generateBillPdf } from "../../utils/pdfGenerator.js";
import { logBillingAudit } from "../../utils/billingAudit.js";
import { isWaterBillableRoom } from "../../utils/utilityFlowRules.js";
import {
  CURRENT_RESIDENT_STATUS_QUERY,
  readMoveInDate,
} from "../../utils/lifecycleNaming.js";

export { CURRENT_RESIDENT_STATUS_QUERY, readMoveInDate };
import { resolveAdminAccessContext } from "../../utils/adminAccess.js";
import { isOwnerRole, isAdminRole } from "../../config/roles.js";

export const getAdminInfo = resolveAdminAccessContext;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const SERVER_ROOT = path.join(__dirname, "..", "..");
export const BILL_PDF_ROOT = path.join(SERVER_ROOT, "uploads", "bills");

export function resolveManualPaymentMethod(note = "") {
  const normalized = String(note || "").trim().toLowerCase();

  if (normalized.includes("gcash")) return "gcash";
  if (normalized.includes("maya") || normalized.includes("paymaya")) return "paymaya";
  if (normalized.includes("grab")) return "grab_pay";
  if (normalized.includes("bank")) return "bank";
  if (normalized.includes("card") || normalized.includes("credit") || normalized.includes("debit")) {
    return "card";
  }
  if (normalized.includes("check") || normalized.includes("cheque")) return "check";

  return "cash";
}

export function resolveProofPaymentMethod(bill) {
  const existingMethod = String(bill?.paymentMethod || "").trim().toLowerCase();
  if (
    ["bank", "gcash", "card", "check", "cash", "paymongo", "paymaya", "grab_pay", "maya", "online"].includes(
      existingMethod,
    )
  ) {
    return existingMethod;
  }

  return "bank";
}

export function isPaymentValidationError(error) {
  return (
    error?.message === "Bill has no remaining balance." ||
    error?.message === "Payment amount must be greater than zero."
  );
}

export function buildBillPaymentFlow(bill, visibleSnapshot = null) {
  const visible = visibleSnapshot || getVisibleBillSnapshot(bill);
  const proofStatus = bill?.paymentProof?.verificationStatus || "none";

  let tenantMessage = "Use online checkout from the Billing page to pay this statement.";
  let adminMessage =
    "Use manual settlement only for branch-assisted offline payments such as cash or bank transfer.";

  if (proofStatus === "pending-verification") {
    tenantMessage =
      "A previously submitted offline payment proof is awaiting staff review. New proof uploads are disabled; use online checkout for future payments.";
    adminMessage =
      "Review this proof only because it was submitted before online checkout became the standard monthly-billing flow.";
  } else if (proofStatus === "approved" || proofStatus === "rejected") {
    tenantMessage =
      "Offline payment proof uploads are no longer used for monthly bills. Use online checkout for future payments.";
    adminMessage =
      "This proof record is legacy billing history. New monthly payments should go through online checkout or an assisted offline settlement.";
  }

  return {
    primary: "online_checkout",
    onlineCheckoutEligible:
      Number(visible?.remainingAmount || 0) > 0 && visible?.status !== "paid",
    manualProofSubmissionEnabled: false,
    legacyProofStatus: proofStatus === "none" ? null : proofStatus,
    adminManualSettlementScope: "offline-only",
    tenantMessage,
    adminMessage,
  };
}

/** Auto-mark overdue bills */
export async function markOverdueBills(bills) {
  const now = dayjs().toDate();
  for (const bill of bills) {
    const nextStatus = resolveBillStatus(bill, now);
    if (bill.status !== nextStatus) {
      bill.status = nextStatus;
      bill.remainingAmount = getBillRemainingAmount(bill);
      await bill.save();
    }
  }
}

/** Map a Bill document to API response shape */
export const formatBill = (bill) => {
  const visible = getVisibleBillSnapshot(bill);
  const roomId = bill.roomId?._id || bill.roomId || bill.reservationId?.roomId || null;
  const roomName =
    bill.roomId?.name ||
    bill.roomId?.roomNumber ||
    bill.reservationId?.roomName ||
    "N/A";
  return {
    id: bill._id,
    tenant: bill.userId
      ? {
          id: bill.userId._id,
          name: `${bill.userId.firstName || ""} ${bill.userId.lastName || ""}`.trim(),
          email: bill.userId.email,
        }
      : null,
    roomId,
    room: roomName,
    roomName,
    branch: bill.branch,
    billReference: formatBillReference(bill),
    billingMonth: bill.billingMonth,
    dueDate: visible.dueDate,
    issuedAt: visible.issuedAt,
    sentAt: bill.sentAt || null,
    billingCycleStart: bill.billingCycleStart,
    billingCycleEnd: bill.billingCycleEnd,
    utilityCycleStart: bill.utilityCycleStart || null,
    utilityCycleEnd: bill.utilityCycleEnd || null,
    utilityReadingDate: bill.utilityReadingDate || null,
    additionalCharges: bill.additionalCharges || [],
    charges: visible.charges,
    grossAmount: visible.grossAmount,
    reservationCreditApplied: bill.reservationCreditApplied || 0,
    totalAmount: visible.totalAmount,
    paidAmount: bill.paidAmount || 0,
    remainingAmount: visible.remainingAmount,
    isFirstCycleBill: !!bill.isFirstCycleBill,
    billType: resolveRentBillType(bill),
    status: visible.status,
    paymentMethod: bill.paymentMethod || null,
    paymentDate: bill.paymentDate || null,
    paymongoPaymentId: bill.paymongoPaymentId || null,
    penaltyDetails: bill.penaltyDetails || { daysLate: 0, ratePerDay: null, appliedAt: null },
    legacyPaymentFallbackLabel:
      visible.status === "paid" ? "Paid — legacy/no ledger record" : null,
    paymentProof: bill.paymentProof || { verificationStatus: "none" },
    paymentFlow: buildBillPaymentFlow(bill, visible),
    delivery: bill.delivery || {},
    pdfPath: bill.pdfPath || null,
    pdfAvailable: Boolean(bill.pdfPath),
    pdfGeneratedAt: bill.pdfGeneratedAt || null,
    notes: bill.notes,
    createdAt: bill.createdAt,
  };
};

export async function getReservationBillingContext(
  reservationId,
  currentBillId = null,
  referenceDate = new Date(),
) {
  const reservation = await Reservation.findById(reservationId);
  const moveInDate = readMoveInDate(reservation);
  if (!reservation || !moveInDate) return null;

  const existingCount = await Bill.countDocuments({
    reservationId: reservation._id,
    isArchived: false,
    "charges.rent": { $gt: 0 },
    ...(currentBillId ? { _id: { $ne: currentBillId } } : {}),
  });

  const cycle = resolveCurrentRentBillingCycle(moveInDate, referenceDate);
  const creditAvailable = getReservationCreditAvailable(reservation);

  return {
    reservation,
    existingCount,
    cycle,
    isFirstCycleBill: existingCount === 0,
    creditAvailable,
  };
}

export function sortReservationsByMoveIn(reservations = []) {
  return [...reservations].sort((left, right) => {
    const leftMoveIn = readMoveInDate(left)
      ? dayjs(readMoveInDate(left)).valueOf()
      : 0;
    const rightMoveIn = readMoveInDate(right)
      ? dayjs(readMoveInDate(right)).valueOf()
      : 0;
    return rightMoveIn - leftMoveIn;
  });
}

export async function getActiveReservationForUser(userId, { populateBilling = false } = {}) {
  let activeReservationsQuery = Reservation.find({
    userId,
    status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
    isArchived: { $ne: true },
  });

  if (populateBilling) {
    activeReservationsQuery = activeReservationsQuery
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name roomNumber branch price monthlyPrice type");
  } else {
    activeReservationsQuery = activeReservationsQuery.lean();
  }

  const activeReservations = await activeReservationsQuery;

  if (activeReservations.length === 0) return null;

  return sortReservationsByMoveIn(activeReservations)[0];
}

export async function ensureTenantCurrentRentBill(userId, referenceDate = new Date()) {
  const activeStay = await getActiveReservationForUser(userId, {
    populateBilling: true,
  });
  if (!activeStay) return null;

  await ensureCurrentCycleRentBill({
    reservation: activeStay,
    referenceDate,
    dryRun: false,
    notifyTenant: false,
    requireGenerationDateMatch: false,
  });

  return activeStay;
}

export async function getTenantBillForRequest(req, billId) {
  const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
  if (!dbUser) return { dbUser: null, bill: null };

  const bill = await Bill.findOne({
    _id: billId,
    userId: dbUser._id,
    isArchived: false,
  }).lean();

  return { dbUser, bill };
}

export async function findUtilityPeriodForBill({ bill, utilityType }) {
  if (!bill?.roomId) return null;

  let period = await UtilityPeriod.findOne({
    roomId: bill.roomId,
    utilityType,
    isArchived: false,
    "tenantSummaries.billId": bill._id,
  }).lean();

  if (period) return period;

  const cycleFilter = {
    roomId: bill.roomId,
    utilityType,
    isArchived: false,
  };
  if (bill.utilityCycleStart) cycleFilter.startDate = bill.utilityCycleStart;
  if (bill.utilityCycleEnd) cycleFilter.endDate = bill.utilityCycleEnd;

  period = await UtilityPeriod.findOne(cycleFilter).lean();
  return period || null;
}

export async function buildTenantUtilityBreakdown({ dbUser, bill, utilityType }) {
  const chargeAmount = utilityType === "electricity"
    ? Number(bill?.charges?.electricity || 0)
    : Number(bill?.charges?.water || 0);
  if (!bill || chargeAmount <= 0) return null;

  const period = await findUtilityPeriodForBill({ bill, utilityType });
  if (!period) return null;

  const tenantSummary =
    (period.tenantSummaries || []).find((summary) => String(summary.billId) === String(bill._id)) ||
    (period.tenantSummaries || []).find((summary) => String(summary.tenantId) === String(dbUser._id)) ||
    null;

  if (utilityType === "electricity") {
    const activeSegments = (period.segments || []).filter((segment) =>
      (segment.activeTenantIds || []).some((tenantId) => String(tenantId) === String(dbUser._id)),
    );

    return {
      period: {
        id: period._id,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      ratePerKwh: period.ratePerUnit,
      myTotalKwh: tenantSummary?.totalUsage || 0,
      myBillAmount: tenantSummary?.billAmount || chargeAmount,
      segments: activeSegments.map((segment) => ({
        periodLabel: segment.periodLabel,
        startDate: segment.startDate,
        endDate: segment.endDate,
        readingFrom: segment.readingFrom,
        readingTo: segment.readingTo,
        segmentTotalKwh: segment.unitsConsumed,
        activeTenantCount: segment.activeTenantCount,
        sharePerTenantKwh: segment.sharePerTenantUnits,
        sharePerTenantCost: segment.sharePerTenantCost,
      })),
    };
  }

  const firstSegment = (period.segments || [])[0] || null;
  return {
    record: {
      id: period._id,
      cycleStart: period.startDate,
      cycleEnd: period.endDate,
      usage: period.computedTotalUsage || 0,
      ratePerUnit: period.ratePerUnit,
      roomTotal: period.computedTotalCost || 0,
      tenantsSharing: firstSegment?.activeTenantCount || period.tenantSummaries?.length || 0,
      myShare: tenantSummary?.billAmount || chargeAmount,
    },
  };
}

export function hasDraftLinkedSummary(period, draftBillIds) {
  return (period?.tenantSummaries || []).some((summary) =>
    summary.billId && draftBillIds.has(String(summary.billId)),
  );
}

export function buildPublishResultFromPeriod(period) {
  if (!period) return null;
  return {
    computedTotalUsage: period.computedTotalUsage,
    computedTotalCost: period.computedTotalCost,
    ratePerUnit: period.ratePerUnit,
    segments: period.segments || [],
    tenantSummaries: period.tenantSummaries || [],
  };
}

export async function getRoomPublishState(room) {
  const [allBills, periods] = await Promise.all([
    Bill.find({
      roomId: room._id,
      isArchived: false,
    })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: 1 }),
    UtilityPeriod.find({
      roomId: room._id,
      isArchived: false,
    })
      .sort({ endDate: -1, createdAt: -1 })
      .lean(),
  ]);

  const draftBillIds = new Set(
    allBills.filter((bill) => bill.status === "draft").map((bill) => String(bill._id)),
  );
  const electricityPeriods = periods.filter((period) => period.utilityType === "electricity");
  const waterPeriods = periods.filter((period) => period.utilityType === "water");
  const billableWater = isWaterBillableRoom(room);

  const electricityPeriod =
    electricityPeriods.find((period) => period.status !== "open" && hasDraftLinkedSummary(period, draftBillIds)) ||
    electricityPeriods.find((period) => period.status !== "open") ||
    null;
  const electricityOpenPeriod =
    electricityPeriods.find((period) => period.status === "open") || null;

  const waterPeriod =
    waterPeriods.find((period) => period.status !== "open" && hasDraftLinkedSummary(period, draftBillIds)) ||
    waterPeriods.find((period) => period.status !== "open") ||
    null;
  const waterOpenPeriod =
    waterPeriods.find((period) => period.status === "open") || null;
  const relevantDraftIds = new Set(
    [electricityPeriod, waterPeriod]
      .filter(Boolean)
      .flatMap((period) => (period.tenantSummaries || []).map((summary) => summary.billId))
      .filter(Boolean)
      .map((billId) => String(billId)),
  );
  const cycleBills = relevantDraftIds.size > 0
    ? allBills.filter((bill) => relevantDraftIds.has(String(bill._id)))
    : allBills;
  const draftBills = cycleBills.filter((bill) => bill.status === "draft");
  const issuedBills = cycleBills.filter((bill) => bill.status !== "draft");

  let blockingReason = "";
  let isReadyToPublish = true;
  let publishState = "ready";

  if (!electricityPeriod || electricityPeriod.status === "open") {
    isReadyToPublish = false;
    publishState = "blocked";
    blockingReason = electricityOpenPeriod
      ? "Electricity period is still open."
      : "Electricity drafts have not been generated.";
  } else if (billableWater && (!waterPeriod || waterPeriod.status === "open")) {
    isReadyToPublish = false;
    publishState = "blocked";
    blockingReason = waterOpenPeriod
      ? "Water period is still open."
      : "Water drafts have not been generated.";
  } else if (draftBills.length > 0) {
    publishState = "ready";
  } else if (issuedBills.length > 0) {
    isReadyToPublish = false;
    publishState = "issued";
    blockingReason = "Invoices for this cycle have already been sent.";
  } else if (draftBills.length === 0) {
    isReadyToPublish = false;
    publishState = "blocked";
    blockingReason = "No draft bills found for this room.";
  }

  return {
    roomId: room._id,
    roomName: room.name || room.roomNumber || "Room",
    branch: room.branch,
    type: room.type,
    waterApplicable: billableWater,
    cycleBills,
    draftBills,
    draftBillCount: draftBills.length,
    issuedBillCount: issuedBills.length,
    electricityStatus: electricityPeriod ? "closed" : (electricityOpenPeriod ? "open" : "pending"),
    waterStatus: billableWater
      ? (waterPeriod ? "finalized" : (waterOpenPeriod ? "open" : "pending"))
      : "n/a",
    isReadyToPublish,
    publishState,
    blockingReason,
    electricityPeriod,
    waterPeriod,
  };
}

/** Build paginated bill response */
export async function fetchBills(filter, query) {
  const { status, month, page = 1, limit = 20, search, roomId } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  if (status && status !== "all") filter.status = status;
  if (roomId) filter.roomId = roomId;
  if (month) {
    const d = dayjs(month);
    filter.billingMonth = {
      $gte: d.startOf("month").toDate(),
      $lt: d.add(1, "month").startOf("month").toDate(),
    };
  }

  let userIds = null;
  if (search) {
    const q = search.trim();
    const matchingUsers = await User.find({
      $or: [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    }).select("_id").lean();
    userIds = matchingUsers.map((u) => u._id);
    filter.userId = { $in: userIds };
  }

  let bills = await Bill.find(filter)
    .populate("userId", "firstName lastName email username")
    .populate("roomId", "name roomNumber branch type")
    .populate("reservationId", "roomId roomName bedDetails")
    .sort({ billingMonth: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Bill.countDocuments(filter);
  await markOverdueBills(bills);

  return {
    bills: bills.map(formatBill),
    pagination: {
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/** Round to 2 decimal places */
export const r2 = (n) => Math.round(n * 100) / 100;

export const computeWaterShare = (roomType, totalWater, tenantCount) => {
  if (!totalWater || totalWater <= 0) return 0;
  switch (roomType) {
    case "quadruple-sharing":
      return 0;
    case "double-sharing":
      return tenantCount > 0 ? r2(totalWater / tenantCount) : 0;
    case "private":
      return r2(totalWater);
    default:
      return tenantCount > 0 ? r2(totalWater / tenantCount) : 0;
  }
};

export const suggestRent = (reservation, room, moveInDate) => {
  if (reservation.monthlyRent) return reservation.monthlyRent;
  if (reservation.totalPrice) return reservation.totalPrice;
  const months = dayjs().diff(dayjs(moveInDate), "month", true);
  const isLongTerm = months >= 6;
  return isLongTerm ? (room.monthlyPrice ?? room.price ?? 0) : (room.price ?? 0);
};

export function parseRequiredDate(value, label) {
  const parsed = dayjs(value);
  if (!value || !parsed.isValid()) {
    const error = new Error(`${label} is required`);
    error.statusCode = 400;
    throw error;
  }
  return parsed.startOf("day");
}

export function createBillingError(message, statusCode = 400, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

export function getBillDaysOverdue(bill, referenceDate = new Date()) {
  const dueDate = bill?.dueDate ? dayjs(bill.dueDate) : null;
  if (!dueDate?.isValid()) return 0;
  const daysOverdue = dayjs(referenceDate)
    .startOf("day")
    .diff(dueDate.startOf("day"), "day");
  return daysOverdue > 0 ? daysOverdue : 0;
}

export function canSendBillReminder(bill) {
  const visible = getVisibleBillSnapshot(bill);
  return Boolean(
    visible?.dueDate &&
      ["pending", "partially-paid", "overdue"].includes(visible?.status),
  );
}

export function formatBillReference(bill = {}) {
  const id = String(bill?._id || bill?.id || "").slice(-6).toUpperCase();
  const month = bill?.billingMonth && dayjs(bill.billingMonth).isValid()
    ? dayjs(bill.billingMonth).format("YYYYMM")
    : dayjs().format("YYYYMM");
  return `LC-RB-${month}-${id || "DRAFT"}`;
}

export function resolveRentCycleForBillingMonth(reservation, billingMonth) {
  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) {
    throw createBillingError("No active tenant", 400, "NO_ACTIVE_TENANT");
  }

  const selectedMonth = parseRequiredDate(billingMonth, "Billing month").startOf("month");
  const monthEnd = selectedMonth.endOf("month");
  const anchor = dayjs(moveInDate).startOf("day");

  if (anchor.isAfter(monthEnd)) {
    throw createBillingError("No active tenant", 400, "NO_ACTIVE_TENANT");
  }

  let cycleIndex = Math.max(0, selectedMonth.diff(anchor, "month"));
  let cycle = buildRentBillingCycle(anchor.toDate(), cycleIndex);

  while (dayjs(cycle.billingCycleStart).isBefore(selectedMonth, "day")) {
    cycleIndex += 1;
    cycle = buildRentBillingCycle(anchor.toDate(), cycleIndex);
  }

  if (dayjs(cycle.billingCycleStart).isAfter(monthEnd, "day")) {
    throw createBillingError("No active tenant", 400, "NO_ACTIVE_TENANT");
  }

  return cycle;
}

export function resolveRentDueDate(cycle, dueDate) {
  const resolved = dueDate
    ? parseRequiredDate(dueDate, "Due date")
    : dayjs(cycle.dueDate).startOf("day");

  if (resolved.isBefore(dayjs(cycle.billingCycleEnd).startOf("day"))) {
    throw createBillingError(
      "Due date must be on or after the billing period end.",
      400,
      "INVALID_DUE_DATE",
    );
  }

  return resolved.toDate();
}

export function resolveRentAmountForBilling(reservation, room, cycle, rentAmount) {
  const explicitRent =
    rentAmount === undefined || rentAmount === null || rentAmount === ""
      ? null
      : Number(rentAmount);
  const rent = explicitRent === null
    ? suggestRent(reservation, room, cycle.billingCycleStart)
    : explicitRent;

  if (!Number.isFinite(rent) || rent <= 0) {
    throw createBillingError("Invalid rent amount", 400, "INVALID_RENT_AMOUNT");
  }

  return roundMoney(rent);
}

export function buildRentDuplicateFilter(reservationId, cycle, billingMonth) {
  const selectedMonth = parseRequiredDate(billingMonth, "Billing month").startOf("month");
  const nextMonthStart = selectedMonth.add(1, "month");
  const cycleStart = dayjs(cycle.billingCycleStart).startOf("day").toDate();
  const cycleEnd = dayjs(cycle.billingCycleEnd).startOf("day").toDate();

  return {
    reservationId,
    isArchived: false,
    "charges.rent": { $gt: 0 },
    $or: [
      { billingCycleStart: cycleStart },
      { billingMonth: cycleStart },
      {
        billingCycleStart: {
          $gte: cycleStart,
          $lt: cycleEnd,
        },
      },
      {
        billingMonth: {
          $gte: selectedMonth.toDate(),
          $lt: nextMonthStart.toDate(),
        },
      },
    ],
  };
}

export function getBedLabel(reservation = {}) {
  return (
    reservation?.selectedBed?.position ||
    reservation?.selectedBed?.id ||
    reservation?.bedDetails?.position ||
    reservation?.bedDetails?.id ||
    ""
  );
}

export function getRoomLabel(room = {}) {
  return room?.name || room?.roomNumber || "Room";
}

export async function loadRentReservationForAdmin({ reservationId, branch }) {
  if (!reservationId) {
    throw createBillingError("No active tenant", 400, "NO_ACTIVE_TENANT");
  }

  const reservation = await Reservation.findOne({
    _id: reservationId,
    status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
    isArchived: { $ne: true },
  })
    .populate("userId", "firstName lastName email")
    .populate("roomId", "name roomNumber branch type price monthlyPrice");

  if (!reservation || !reservation.userId || !reservation.roomId) {
    throw createBillingError("No active tenant", 404, "NO_ACTIVE_TENANT");
  }
  if (reservation.roomId.branch !== branch) {
    throw createBillingError("Access denied.", 403, "ACCESS_DENIED");
  }

  return reservation;
}

export async function loadRentBillForAdmin({ billId, branch }) {
  if (!billId) {
    throw createBillingError("Bill not found", 404, "BILL_NOT_FOUND");
  }

  const bill = await Bill.findOne({
    _id: billId,
    isArchived: false,
    "charges.rent": { $gt: 0 },
  });

  if (!bill) {
    throw createBillingError("Bill not found", 404, "BILL_NOT_FOUND");
  }

  if (branch && bill.branch !== branch) {
    throw createBillingError("Access denied.", 403, "ACCESS_DENIED");
  }

  return bill;
}

export async function loadBillForAdmin({ billId, branch }) {
  if (!billId) {
    throw createBillingError("Bill not found", 404, "BILL_NOT_FOUND");
  }

  const bill = await Bill.findOne({
    _id: billId,
    isArchived: false,
  });

  if (!bill) {
    throw createBillingError("Bill not found", 404, "BILL_NOT_FOUND");
  }

  if (branch && bill.branch !== branch) {
    throw createBillingError("Access denied.", 403, "ACCESS_DENIED");
  }

  return bill;
}

export async function buildRentBillDraft({
  reservation,
  branch,
  billingMonth,
  dueDate,
  rentAmount,
  notes = "",
  allowDuplicate = false,
}) {
  const room = reservation.roomId || {};
  const cycle = resolveRentCycleForBillingMonth(reservation, billingMonth);
  const dueDateValue = resolveRentDueDate(cycle, dueDate);
  const duplicate = await Bill.findOne(
    buildRentDuplicateFilter(reservation._id, cycle, billingMonth),
  ).populate("userId", "firstName lastName email");

  if (duplicate && !allowDuplicate) {
    const error = createBillingError("Duplicate bill exists", 409, "DUPLICATE_RENT_BILL");
    error.bill = duplicate;
    throw error;
  }

  const rent = resolveRentAmountForBilling(reservation, room, cycle, rentAmount);
  const recurring = getReservationRecurringFees(reservation);
  const applianceFees = roundMoney(recurring.applianceFees || 0);
  const grossAmount = roundMoney(rent + applianceFees);
  const priorRentBill = await Bill.findOne({
    reservationId: reservation._id,
    isArchived: false,
    "charges.rent": { $gt: 0 },
    ...(duplicate ? { _id: { $ne: duplicate._id } } : {}),
  }).select("_id");
  const isFirstCycleBill = !priorRentBill;
  const creditAvailable = getReservationCreditAvailable(reservation);
  const reservationCreditApplied = isFirstCycleBill
    ? Math.min(grossAmount, creditAvailable)
    : 0;

  const bill = new Bill({
    reservationId: reservation._id,
    userId: reservation.userId._id,
    branch,
    roomId: room._id,
    billingMonth: cycle.billingMonth,
    billingCycleStart: cycle.billingCycleStart,
    billingCycleEnd: cycle.billingCycleEnd,
    dueDate: dueDateValue,
    issuedAt: new Date(),
    sentAt: new Date(),
    isFirstCycleBill,
    proRataDays: dayjs(cycle.billingCycleEnd).diff(
      dayjs(cycle.billingCycleStart),
      "day",
    ),
    charges: {
      rent,
      electricity: 0,
      water: 0,
      applianceFees,
      corkageFees: 0,
      penalty: 0,
      discount: 0,
    },
    additionalCharges: recurring.additionalCharges,
    grossAmount,
    reservationCreditApplied,
    totalAmount: grossAmount,
    remainingAmount: grossAmount,
    status: "pending",
    notes,
  });

  syncBillAmounts(bill);

  return {
    bill,
    duplicate,
    cycle,
    recurring,
    rent,
    applianceFees,
    grossAmount,
    reservationCreditApplied,
  };
}

export function formatRentBillPreview({ reservation, bill, duplicate = null, cycle }) {
  const tenant = reservation.userId || {};
  const room = reservation.roomId || {};
  return {
    reservationId: reservation._id,
    tenant: {
      id: tenant._id,
      name:
        [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim() ||
        "Tenant",
      email: tenant.email || "",
      moveInDate: readMoveInDate(reservation),
    },
    branch: room.branch || bill.branch,
    room: {
      id: room._id || null,
      name: getRoomLabel(room),
      bed: getBedLabel(reservation),
    },
    billReference: formatBillReference(bill),
    billingMonth: bill.billingMonth,
    billingPeriod: {
      start: bill.billingCycleStart,
      end: bill.billingCycleEnd,
      cycleIndex: cycle?.cycleIndex ?? null,
    },
    dueDate: bill.dueDate,
    charges: {
      rent: bill.charges?.rent || 0,
      applianceFees: bill.charges?.applianceFees || 0,
      electricity: bill.charges?.electricity || 0,
      water: bill.charges?.water || 0,
      penalty: bill.charges?.penalty || 0,
      discount: bill.charges?.discount || 0,
    },
    additionalCharges: bill.additionalCharges || [],
    creditApplied: bill.reservationCreditApplied || 0,
    grossAmount: bill.grossAmount || 0,
    totalAmount: bill.totalAmount || 0,
    status: duplicate ? "already_billed" : "ready",
    duplicateBill: duplicate ? formatBill(duplicate) : null,
  };
}

export async function generateRentBillPdf({ bill, reservation }) {
  const room = reservation.roomId || bill.roomId;
  const tenant = reservation.userId || bill.userId;
  const billPayload = {
    ...(bill.toObject ? bill.toObject() : bill),
    billReference: formatBillReference(bill),
  };
  const pdfPath = await generateBillPdf({
    bill: billPayload,
    billingResult: null,
    period: {
      startDate: bill.billingCycleStart || bill.billingMonth,
      endDate: bill.billingCycleEnd || bill.dueDate,
      branch: bill.branch,
    },
    room,
    tenant,
  });

  bill.pdfPath = pdfPath;
  bill.pdfGeneratedAt = new Date();
  await bill.save();
  return pdfPath;
}

export async function finalizeRentBill({
  req,
  admin,
  reservation,
  draft,
}) {
  const { bill } = draft;
  await bill.save();

  if (bill.reservationCreditApplied > 0 && typeof reservation.save === "function") {
    reservation.reservationCreditConsumedAt = new Date();
    reservation.reservationCreditAppliedBillId = bill._id;
    await reservation.save();
  }

  let pdfError = null;
  try {
    await generateRentBillPdf({ bill, reservation });
  } catch (error) {
    pdfError = error.message || "PDF generation failed";
  }

  const delivery = await deliverBillNotification({
    bill,
    tenant: reservation.userId,
    room: reservation.roomId,
    billType: "rent",
  });

  await logBillingAudit(req, {
    admin,
    action: "Rent bill generated",
    details: `Generated rent bill ${formatBillReference(bill)} for ${bill.totalAmount}`,
    entityId: bill._id,
    branch: bill.branch,
    metadata: {
      reservationId: String(reservation._id),
      tenantId: String(reservation.userId?._id || reservation.userId),
      billingCycleStart: bill.billingCycleStart,
      billingCycleEnd: bill.billingCycleEnd,
      dueDate: bill.dueDate,
      rentAmount: bill.charges?.rent || 0,
      applianceFees: bill.charges?.applianceFees || 0,
      creditApplied: bill.reservationCreditApplied || 0,
      totalAmount: bill.totalAmount,
      emailStatus: delivery.email?.status,
      notificationStatus: delivery.notification?.status,
      pdfGenerated: Boolean(bill.pdfPath),
      pdfError,
    },
  });

  await bill.populate("userId", "firstName lastName email");
  await bill.populate("roomId", "name roomNumber branch type");
  await bill.populate("reservationId", "roomId roomName bedDetails");

  return {
    bill,
    delivery: {
      ...delivery,
      pdf: {
        status: pdfError ? "failed" : bill.pdfPath ? "generated" : "not_attempted",
        path: bill.pdfPath || null,
        generatedAt: bill.pdfGeneratedAt || null,
        error: pdfError || "",
      },
    },
  };
}

export function summarizeRentTenantRows(tenants = []) {
  const alreadyBilled = tenants.filter((tenant) => tenant.currentMonthBill).length;
  const missingData = tenants.filter((tenant) => tenant.billStatus === "missing_data").length;
  const readyToGenerate = tenants.filter((tenant) => tenant.billStatus === "ready").length;
  return {
    totalTenants: tenants.length,
    alreadyBilled,
    missingData,
    readyToGenerate,
  };
}

export function resolveRentBillType(bill = {}) {
  const charges = bill.charges || {};
  if (Number(charges.rent || 0) > 0) return "rent";
  if (Number(charges.water || 0) > 0 && Number(charges.electricity || 0) > 0) {
    return "utilities";
  }
  if (Number(charges.water || 0) > 0) return "water";
  if (Number(charges.electricity || 0) > 0) return "electricity";
  return "bill";
}

export function formatBillTypeLabel(bill = {}) {
  const billType = resolveRentBillType(bill);
  if (billType === "rent") return "Rent";
  if (billType === "water") return "Water";
  if (billType === "electricity") return "Electricity";
  if (billType === "utilities") return "Utilities";
  return "Bill";
}

export function buildPenaltyNoticeReason(bill = {}) {
  const penaltyAmount = Number(bill?.charges?.penalty || 0);
  if (penaltyAmount <= 0) return "";

  const daysLate = Number(bill?.penaltyDetails?.daysLate || 0);
  const ratePerDay = Number(bill?.penaltyDetails?.ratePerDay || 0);

  if (daysLate > 0 && ratePerDay > 0) {
    return `Late payment penalty for ${daysLate} day${daysLate === 1 ? "" : "s"} at PHP ${ratePerDay.toFixed(2)} per day.`;
  }
  if (daysLate > 0) {
    return `Late payment penalty for ${daysLate} day${daysLate === 1 ? "" : "s"} overdue.`;
  }
  return "Late payment penalty applied to the bill.";
}

export async function deliverBillNotification({ bill, tenant, room, billType = null }) {
  const tenantName =
    [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim() ||
    "Tenant";
  const billingMonthLabel = dayjs(bill.billingMonth).format("MMMM YYYY");
  const dueDateLabel = bill.dueDate
    ? dayjs(bill.dueDate).format("MMMM D, YYYY")
    : "the due date";
  const delivery = {
    email: { status: "not_attempted", sentAt: null, error: "" },
    notification: { status: "not_attempted", sentAt: null, error: "" },
  };

  if (tenant?.email) {
    const emailResult = await sendBillGeneratedEmail({
      to: tenant.email,
      tenantName,
      billingMonth: billingMonthLabel,
      totalAmount: bill.totalAmount,
      dueDate: dueDateLabel,
      branchName: room?.branch || bill.branch || "Lilycrest",
      billType: billType || resolveRentBillType(bill),
      roomName: room?.name || room?.roomNumber || "",
    });

    if (emailResult?.success) {
      delivery.email.status = "sent";
      delivery.email.sentAt = new Date();
    } else {
      delivery.email.status = "failed";
      delivery.email.error =
        emailResult?.error || emailResult?.message || "Email delivery failed";
    }
  }

  try {
    await notify.billGenerated(
      bill.userId,
      billingMonthLabel,
      bill.totalAmount,
      dueDateLabel,
      {
        billType: billType || resolveRentBillType(bill),
        billId: bill._id,
        actionUrl: "/billing",
      },
    );
    delivery.notification.status = "sent";
    delivery.notification.sentAt = new Date();
  } catch (error) {
    delivery.notification.status = "failed";
    delivery.notification.error = error.message || "Notification failed";
  }

  bill.delivery = delivery;
  await bill.save();
  return delivery;
}

export async function deliverBillReminder({ bill, tenant, room, noticeType = "reminder" }) {
  const visible = getVisibleBillSnapshot(bill);
  const reminderAmount = Number(
    visible?.remainingAmount ?? visible?.totalAmount ?? bill.totalAmount ?? 0,
  );
  const penaltyAmount = Number(visible?.charges?.penalty || 0);
  const billTypeLabel = formatBillTypeLabel(bill);
  const tenantName =
    [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim() ||
    "Tenant";
  const billingMonthLabel = dayjs(bill.billingMonth).format("MMMM YYYY");
  const dueDateLabel = bill.dueDate
    ? dayjs(bill.dueDate).format("MMMM D, YYYY")
    : "the due date";
  const daysOverdue = getBillDaysOverdue(bill);
  const penaltyReason = buildPenaltyNoticeReason(bill);
  const resolvedNoticeType =
    noticeType === "penalty" ? "penalty" : daysOverdue > 0 ? "overdue" : "reminder";
  const delivery = {
    email: { status: "not_attempted", sentAt: null, error: "" },
    notification: { status: "not_attempted", sentAt: null, error: "" },
    daysOverdue,
    noticeType: resolvedNoticeType,
    penaltyAmount,
  };

  if (tenant?.email) {
    const emailResult =
      resolvedNoticeType === "reminder"
        ? await sendPaymentReminderEmail({
            to: tenant.email,
            tenantName,
            billingMonth: billingMonthLabel,
            totalAmount: reminderAmount,
            dueDate: dueDateLabel,
            billType: billTypeLabel,
            branchName: room?.branch || bill.branch || "Lilycrest",
          })
        : await sendOverdueNoticeEmail({
            to: tenant.email,
            tenantName,
            billingMonth: billingMonthLabel,
            totalAmount: reminderAmount,
            daysLate: daysOverdue,
            penalty: penaltyAmount,
            dueDate: dueDateLabel,
            billType: billTypeLabel,
            reason: resolvedNoticeType === "penalty" ? penaltyReason : "",
            noticeVariant: resolvedNoticeType,
            branchName: room?.branch || bill.branch || "Lilycrest",
          });

    if (emailResult?.success) {
      delivery.email.status = "sent";
      delivery.email.sentAt = new Date();
    } else {
      delivery.email.status = "failed";
      delivery.email.error =
        emailResult?.error || emailResult?.message || "Email delivery failed";
    }
  }

  try {
    const baseMessage = `Your ${billTypeLabel.toLowerCase()} bill for ${billingMonthLabel} has a remaining balance of PHP ${reminderAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due date: ${dueDateLabel}.`;
    const overdueMessage =
      daysOverdue > 0
        ? ` Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}.`
        : "";

    if (resolvedNoticeType === "penalty") {
      await notify.billingNotice(bill.userId, {
        notificationType: "penalty_applied",
        title: "Penalty Notice",
        message: `${baseMessage}${overdueMessage} Penalty amount: PHP ${penaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.${penaltyReason ? ` Reason: ${penaltyReason}` : ""}`,
        billId: bill._id,
        actionUrl: "/billing",
        pushType: "billing_penalty_notice",
      });
    } else if (resolvedNoticeType === "overdue") {
      await notify.billingNotice(bill.userId, {
        notificationType: "bill_due_reminder",
        title: "Overdue Bill Notice",
        message: `${baseMessage}${overdueMessage}`,
        billId: bill._id,
        actionUrl: "/billing",
        pushType: "billing_overdue_notice",
      });
    } else {
      await notify.billingNotice(bill.userId, {
        notificationType: "bill_due_reminder",
        title: "Payment Reminder",
        message: baseMessage,
        billId: bill._id,
        actionUrl: "/billing",
        pushType: "billing_due_notice",
      });
    }
    delivery.notification.status = "sent";
    delivery.notification.sentAt = new Date();
  } catch (error) {
    delivery.notification.status = "failed";
    delivery.notification.error = error.message || "Notification failed";
  }

  return delivery;
}

export function formatActiveRentTenant(
  reservation,
  existingBill = null,
  cycle = null,
  validationError = "",
) {
  const room = reservation.roomId || {};
  const tenant = reservation.userId || {};
  const moveInDate = readMoveInDate(reservation);
  const recurring = getReservationRecurringFees(reservation);
  const monthlyRent = suggestRent(reservation, room, moveInDate || new Date());
  const validationErrors = [];

  if (!moveInDate) validationErrors.push("No active tenant");
  if (!Number.isFinite(Number(monthlyRent)) || Number(monthlyRent) <= 0) {
    validationErrors.push("Invalid rent amount");
  }
  if (validationError) validationErrors.push(validationError);

  const billStatus = existingBill
    ? "already_billed"
    : validationErrors.length > 0
      ? "missing_data"
      : "ready";

  return {
    reservationId: reservation._id,
    tenantId: tenant._id,
    tenantName:
      [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim() ||
      "Tenant",
    email: tenant.email || "",
    branch: room.branch || "",
    roomId: room._id || null,
    roomName: room.name || room.roomNumber || "Room",
    roomNumber: room.roomNumber || room.name || "",
    roomType: room.type || "",
    roomCapacity: room.capacity || null,
    roomOccupancy: room.currentOccupancy || null,
    bedPosition: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
    moveInDate,
    monthlyRent,
    billingCycle: cycle
      ? {
          start: cycle.billingCycleStart,
          end: cycle.billingCycleEnd,
          dueDate: cycle.dueDate,
          generationDate: cycle.generationDate,
          cycleIndex: cycle.cycleIndex,
        }
      : null,
    billingCycleStart: cycle?.billingCycleStart || null,
    billingCycleEnd: cycle?.billingCycleEnd || null,
    nextBillingDate: cycle?.generationDate || cycle?.billingCycleStart || null,
    dueDate: cycle?.dueDate || null,
    billStatus,
    validationErrors,
    customCharges: recurring.additionalCharges,
    currentMonthBill: existingBill
      ? {
          id: existingBill._id,
          status: existingBill.status,
          dueDate: existingBill.dueDate,
          totalAmount: existingBill.totalAmount,
          pdfAvailable: Boolean(existingBill.pdfPath),
        }
      : null,
  };
}
