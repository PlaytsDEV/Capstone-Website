import dayjs from "dayjs";
import { diffManilaDays, toManilaStartOfDay } from "./dateUtils.js";
import { getVisibleBillSnapshot, roundMoney } from "./billingPolicy.js";
import {
  hasReservationStatus,
  readMoveInDate,
  readMoveOutDate,
} from "./lifecycleNaming.js";
import {
  resolveTenantFinancialSummary,
  resolveTenantPersonalDetails,
} from "../services/tenantProfileService.js";

export const LEASE_EXPIRING_SOON_DAYS = 30;

const NEXT_ACTION_LABELS = Object.freeze({
  verify_payment: "Verify payment",
  review_overdue_account: "Review overdue account",
  process_move_out: "Process move-out",
  renew_lease: "Renew lease",
  none: "No action needed",
});

const WARNING_SEVERITY = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export function computeLeaseEndDate(reservation) {
  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) return null;
  const leaseDuration = Number(reservation?.leaseDuration || 0);
  if (!Number.isFinite(leaseDuration) || leaseDuration <= 0) return null;

  const end = dayjs(moveInDate).add(leaseDuration, "month").subtract(1, "day");
  return end.isValid() ? end.toDate() : null;
}

export function computeDaysUntil(dateLike, now = new Date()) {
  if (!dateLike) return null;
  const diff = diffManilaDays(dateLike, now);
  return Number.isNaN(diff) ? null : diff;
}

export function buildBillingSummary(bills = [], now = new Date()) {
  const visibleBills = bills
    .filter((bill) => bill && bill.isArchived !== true && bill.status !== "draft")
    .map((bill) => ({
      bill,
      snapshot: getVisibleBillSnapshot(bill, now),
    }));

  const currentBalance = roundMoney(
    visibleBills.reduce(
      (sum, entry) => sum + Number(entry.snapshot?.remainingAmount || 0),
      0,
    ),
  );
  const hasOverdue = visibleBills.some(
    (entry) => entry.snapshot?.status === "overdue",
  );
  const hasOutstanding = currentBalance > 0;
  const hasPendingVerification = visibleBills.some(
    (entry) =>
      entry.bill?.paymentProof?.verificationStatus === "pending-verification",
  );

  let paymentStatus = "paid";
  if (hasOverdue) paymentStatus = "overdue";
  else if (hasOutstanding) paymentStatus = "partial";

  const overdueEntries = visibleBills.filter(
    (entry) => entry.snapshot?.status === "overdue" && entry.bill?.dueDate,
  );
  const oldestOverdueDueDate = overdueEntries.length > 0
    ? overdueEntries.reduce((oldest, cur) =>
        new Date(cur.bill.dueDate) < new Date(oldest) ? cur.bill.dueDate : oldest,
      overdueEntries[0].bill.dueDate)
    : null;

  const pendingEntries = visibleBills.filter(
    (entry) => entry.snapshot?.status !== "paid" && entry.bill?.dueDate,
  );
  const nextDueDate = pendingEntries.length > 0
    ? pendingEntries.reduce((earliest, cur) =>
        new Date(cur.bill.dueDate) < new Date(earliest) ? cur.bill.dueDate : earliest,
      pendingEntries[0].bill.dueDate)
    : null;

  return {
    currentBalance,
    paymentStatus,
    hasOverdue,
    hasOutstanding,
    hasPendingVerification,
    oldestOverdueDueDate,
    nextDueDate,
    visibleBills,
  };
}

export function buildStayStatus(reservation, now = new Date()) {
  const moveOutDate = readMoveOutDate(reservation);
  if (
    hasReservationStatus(reservation?.status, "moveOut") ||
    (moveOutDate && !dayjs(moveOutDate).isAfter(dayjs(now)))
  ) {
    return "moved_out";
  }

  if (moveOutDate && dayjs(moveOutDate).isAfter(dayjs(now))) {
    return "moving_out";
  }

  return "active";
}

export function normalizeTenantStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "moved_out") return "moved_out";
  if (normalized === "inactive") return "inactive";
  if (normalized === "active") return "active";
  return normalized || "applicant";
}

export function buildLeaseStatus(daysUntilLeaseEnd) {
  if (daysUntilLeaseEnd == null) return "active";
  if (daysUntilLeaseEnd <= 0) return "expired";
  if (daysUntilLeaseEnd <= LEASE_EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

export function buildWarningFlags({
  leaseStatus,
  billingSummary,
  hasRoomHistory,
  moveOutDate,
}) {
  const flags = [];

  if (leaseStatus === "expired") {
    flags.push({
      code: "lease_expired",
      severity: WARNING_SEVERITY.error,
      message: "The lease contract for this tenant has expired.",
      details: "This tenant's rental agreement end date has already passed.",
      impact: "The tenant is still checked in, but their contract status is marked as expired.",
      recommendation: "Renew the lease agreement or prepare to process the tenant's move-out.",
    });
  } else if (leaseStatus === "expiring_soon") {
    flags.push({
      code: "lease_expiring_soon",
      severity: WARNING_SEVERITY.warning,
      message: "The lease contract is ending soon.",
      details: "This tenant's rental contract will end within the next 30 days.",
      impact: "The tenant may need to decide whether to extend their stay or prepare to move out.",
      recommendation: "Send a lease renewal notice or schedule a move-out check.",
    });
  }

  if (billingSummary.hasOverdue) {
    flags.push({
      code: "overdue_balance",
      severity: WARNING_SEVERITY.error,
      message: "This tenant has an overdue bill.",
      details: "One or more payment invoices have passed their due date without payment.",
      impact: "A daily late payment penalty rate (₱50/day) is accruing on overdue balances until paid in full. Continued non-payment leads to automated notices, service restrictions, and administrative review.",
      recommendation: "Review payment history, verify original due date, send an urgent payment notice, or record a received payment.",
      createdAt: billingSummary.oldestOverdueDueDate || null,
      dueDate: billingSummary.oldestOverdueDueDate || null,
    });
  } else if (billingSummary.hasOutstanding) {
    flags.push({
      code: "outstanding_balance",
      severity: WARNING_SEVERITY.warning,
      message: "This tenant has an unpaid balance.",
      details: "There is still an open balance on the tenant's current bill.",
      impact: "The remaining balance needs to be settled on or before the due date to avoid accruing daily late penalties (₱50/day).",
      recommendation: "Check payment deadlines, review billing breakdown, or assist tenant with payment completion.",
      createdAt: billingSummary.nextDueDate || null,
      dueDate: billingSummary.nextDueDate || null,
    });
  }

  if (billingSummary.hasPendingVerification) {
    flags.push({
      code: "pending_payment_verification",
      severity: WARNING_SEVERITY.warning,
      message: "Payment proof is waiting for admin review.",
      details: "The tenant uploaded a payment receipt that needs your review.",
      impact: "The account balance will update as soon as you verify the payment proof.",
      recommendation: "Go to Billing & Payments to review and verify the submitted receipt.",
    });
  }

  if (!hasRoomHistory) {
    flags.push({
      code: "room_history_incomplete",
      severity: WARNING_SEVERITY.warning,
      message: "Room history is incomplete for this stay.",
      details: "We don't have a complete record of room or bed transfers for this tenant's stay.",
      impact: "Utility bill calculations will automatically use the current room assignment.",
      recommendation: "Check the tenant's room history or log any room changes if they moved rooms.",
    });
  }

  if (moveOutDate) {
    flags.push({
      code: "billing_impact_warning",
      severity: WARNING_SEVERITY.info,
      message: "Move-out date affects bill calculation for this stay.",
      details: "A move-out date has been scheduled for this tenant.",
      impact: "Monthly rent and utility bills will be adjusted to cover only the exact days stayed.",
      recommendation: "Make sure final meter readings and room inspection notes are recorded.",
    });
  }

  return flags;
}

export function buildNextAction({
  stayStatus,
  leaseStatus,
  billingSummary,
}) {
  if (billingSummary.hasPendingVerification) return "verify_payment";
  if (billingSummary.hasOverdue) return "review_overdue_account";
  if (stayStatus === "moving_out") return "process_move_out";
  if (stayStatus === "active" && leaseStatus !== "active") return "renew_lease";
  return "none";
}

export function buildAllowedActions({
  reservation,
  currentStay = null,
  stayStatus,
  billingSummary,
  tenantStatus = "",
  hasAvailableBedsInBranch = true,
  hasFutureRenewal = false,
}) {
  const isMovedInReservation = hasReservationStatus(reservation?.status, "moveIn");
  const normalizedTenantStatus = normalizeTenantStatus(tenantStatus);
  const hasActiveStay = currentStay ? currentStay.status === "active" : isMovedInReservation;
  const canManageStay =
    isMovedInReservation &&
    hasActiveStay &&
    stayStatus !== "moved_out" &&
    !["inactive", "moved_out"].includes(normalizedTenantStatus);

  const withReason = (enabled, reason = "", blockingCodes = [], extra = {}) => ({
    enabled,
    reason,
    blockingCodes,
    ...extra,
  });

  return {
    renew: !canManageStay
      ? withReason(false, "Only active moved-in stays can be renewed.", ["NO_ACTIVE_STAY"])
      : hasFutureRenewal
        ? withReason(false, "A future renewal already exists for this tenant.", ["FUTURE_RENEWAL_EXISTS"])
        : withReason(true),
    transfer: !canManageStay
      ? withReason(false, "Only active moved-in stays can be transferred.", ["NO_ACTIVE_STAY"], { hasAvailableBedsInBranch })
      : !hasAvailableBedsInBranch
        ? withReason(false, "No available same-branch bed is available for transfer.", ["NO_AVAILABLE_BED"], { hasAvailableBedsInBranch })
        : withReason(true, "", [], { hasAvailableBedsInBranch }),
    moveOut: !canManageStay
      ? withReason(false, "Only active moved-in stays can be moved out.", ["NO_ACTIVE_STAY"])
      : withReason(
          true,
          billingSummary.hasOutstanding || billingSummary.hasPendingVerification
            ? "Outstanding billing will remain for final settlement after move-out."
            : "",
          [],
        ),
  };
}

function buildRoomHistoryEntries({ reservation, bedHistoryRecords = [] }) {
  if (bedHistoryRecords.length > 0) {
    return bedHistoryRecords.map((record) => ({
      id: String(record._id),
      roomName: record.roomId?.name || reservation.roomId?.name || "Unknown room",
      branch: record.roomId?.branch || reservation.roomId?.branch || "",
      bedId: record.bedId || "",
      bedLabel: record.bedId || record.bedId === 0 ? String(record.bedId) : "",
      moveInDate: record.moveInDate || null,
      moveOutDate: record.moveOutDate || null,
      source: "history",
    }));
  }

  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) return [];

  return [
    {
      id: `fallback:${reservation?._id || reservation?.id || "stay"}`,
      roomName: reservation.roomId?.name || "Unknown room",
      branch: reservation.roomId?.branch || "",
      bedId: reservation.selectedBed?.id || "",
      bedLabel: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
      moveInDate,
      moveOutDate: readMoveOutDate(reservation),
      source: "reservation_fallback",
    },
  ];
}

export function buildTenantWorkspaceEntry({
  reservation,
  currentStay = null,
  stayHistory = [],
  bills = [],
  bedHistoryRecords = [],
  tenantStatus = "",
  hasAvailableBedsInBranch = true,
  now = new Date(),
}) {
  const leaseEndDate = currentStay?.leaseEndDate || computeLeaseEndDate(reservation);
  const daysUntilLeaseEnd = computeDaysUntil(leaseEndDate, now);
  const billingSummary = buildBillingSummary(bills, now);
  const stayStatus =
    currentStay?.status === "completed" || currentStay?.status === "terminated"
      ? "moved_out"
      : buildStayStatus(reservation, now);
  const leaseStatus = buildLeaseStatus(daysUntilLeaseEnd);
  const roomHistory = buildRoomHistoryEntries({ reservation, bedHistoryRecords });
  const warningFlags = buildWarningFlags({
    leaseStatus,
    billingSummary,
    hasRoomHistory: roomHistory.length > 0,
    moveOutDate: readMoveOutDate(reservation),
  });
  const nextAction = buildNextAction({
    stayStatus,
    leaseStatus,
    billingSummary,
  });
  const hasFutureRenewal = stayHistory.some((stay) =>
    currentStay?._id &&
    String(stay.previousStayId || "") === String(currentStay._id) &&
    ["active", "ending_soon"].includes(String(stay.status || "")),
  );
  const allowedActions = buildAllowedActions({
    reservation,
    currentStay,
    stayStatus,
    billingSummary,
    tenantStatus,
    hasAvailableBedsInBranch,
    hasFutureRenewal,
  });

  const tenantUser = reservation.userId || {};
  const personalInformation = resolveTenantPersonalDetails({
    user: tenantUser,
    reservation,
  });
  const fullName = personalInformation.fullName || "Unknown tenant";
  const financialSummary = resolveTenantFinancialSummary({
    reservation,
    currentBalance: billingSummary.currentBalance,
    paymentStatus: billingSummary.paymentStatus,
  });

  return {
    id: String(reservation._id || reservation.id),
    reservationId: String(reservation._id || reservation.id),
    tenantId: String(tenantUser._id || reservation.userId || ""),
    reservationCode: reservation.reservationCode || "",
    tenantName: fullName,
    contact: {
      email: tenantUser.email || reservation.email || "",
      phone: tenantUser.phone || reservation.mobileNumber || "",
    },
    branch: reservation.roomId?.branch || "",
    room: reservation.roomId?.name || reservation.roomId?.roomNumber || "",
    roomId: currentStay?.roomId ? String(currentStay.roomId) : reservation.roomId?._id ? String(reservation.roomId._id) : "",
    bed: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
    bedId: currentStay?.bedId || reservation.selectedBed?.id || "",
    moveInDate: currentStay?.leaseStartDate || readMoveInDate(reservation),
    moveOutDate: readMoveOutDate(reservation),
    leaseEndDate,
    daysUntilLeaseEnd,
    currentBalance: billingSummary.currentBalance,
    currentStayId: currentStay?._id ? String(currentStay._id) : String(reservation.currentStayId || ""),
    tenantStatus: normalizeTenantStatus(tenantStatus),
    stayStatus,
    leaseStatus,
    paymentStatus: billingSummary.paymentStatus,
    nextAction,
    nextActionLabel: NEXT_ACTION_LABELS[nextAction] || NEXT_ACTION_LABELS.none,
    allowedActions,
    warningFlags,
    paymentFlags: {
      pendingVerification: billingSummary.hasPendingVerification,
      hasOutstandingBalance: billingSummary.hasOutstanding,
      hasOverdueBalance: billingSummary.hasOverdue,
    },
    basicInfo: {
      name: fullName,
      email: personalInformation.email || "",
      phone: personalInformation.phone || "",
      birthDate: personalInformation.birthDate,
      address: personalInformation.currentAddress,
      emergencyContactName: personalInformation.emergencyContact.name,
      emergencyContactRelationship:
        personalInformation.emergencyContact.relationship,
      emergencyContactPhone: personalInformation.emergencyContact.phone,
      branch: reservation.roomId?.branch || "",
      room: reservation.roomId?.name || reservation.roomId?.roomNumber || "",
      bed: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
    },
    personalInformation,
    leaseInfo: {
      moveInDate: currentStay?.leaseStartDate || readMoveInDate(reservation),
      leaseEndDate,
      daysUntilLeaseEnd,
      extensionHistory:
        stayHistory.length > 0
          ? stayHistory.map((stay) => ({
              id: String(stay._id || stay.id),
              addedMonths: null,
              previousDuration: null,
              newDuration: null,
              extendedAt: stay.createdAt || null,
              notes: stay.renewalNotes || "",
              leaseStartDate: stay.leaseStartDate || null,
              leaseEndDate: stay.leaseEndDate || null,
              status: stay.status || "",
            }))
          : (reservation.leaseExtensions || []).map((entry, index) => ({
              id: `${reservation._id || reservation.id}:extension:${index}`,
              addedMonths: Number(entry.addedMonths || 0),
              previousDuration: Number(entry.previousDuration || 0),
              newDuration: Number(entry.newDuration || 0),
              extendedAt: entry.extendedAt || null,
              notes: entry.notes || "",
            })),
    },
    paymentInfo: {
      currentBalance: billingSummary.currentBalance,
      paymentStatus: billingSummary.paymentStatus,
      pendingVerification: billingSummary.hasPendingVerification,
      billCount: billingSummary.visibleBills.length,
      monthlyRent: financialSummary.monthlyRate,
      advanceRent: financialSummary.advanceRent,
      securityDeposit: financialSummary.securityDeposit,
      reservationFee: financialSummary.reservationFee,
    },
    financialSummary,
    roomHistory,
    systemWarnings: warningFlags,
  };
}

export function buildTenantWorkspaceStats(entries = []) {
  return {
    totalTenants: entries.length,
    totalResidents: entries.length,
    activeTenants: entries.filter((entry) => entry.stayStatus === "active").length,
    expiringSoon: entries.filter((entry) => entry.leaseStatus === "expiring_soon").length,
    overduePayments: entries.filter((entry) => entry.paymentStatus === "overdue").length,
  };
}
