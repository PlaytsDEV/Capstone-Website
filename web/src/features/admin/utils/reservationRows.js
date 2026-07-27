import { BRANCH_DISPLAY_NAMES } from "../../../shared/utils/constants.js";
import {
 RESERVATION_STAGE_MAP,
 hasReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

export const IN_PROGRESS_STATUSES = [
 "pending",
 "viewing_preference_selected",
 "visit_pending",
 "visit_approved",
 "pending_application_review",
 "needs_revision",
 "approved_for_payment",
 "payment_pending",
];

export { RESERVATION_STAGE_MAP };

const TERMINAL_VISIT_STATUSES = new Set([
 "visit_completed",
 "allowed_without_visit",
]);

export function getBranchLabel(branch) {
 return BRANCH_DISPLAY_NAMES[branch] || branch || "Unknown";
}

export function hasPendingCancellationRequest(reservation) {
 return Boolean(
 reservation?.cancellationRequested &&
 reservation?.cancellationStatus === "pending",
  );
}

export function getArchivedByName(archivedBy) {
 if (!archivedBy) return "-";
 if (typeof archivedBy === "string") return archivedBy;
 const name = `${archivedBy.firstName || ""} ${archivedBy.lastName || ""}`.trim();
 return name || archivedBy.email || "-";
}

export function isNewReservation(reservation, maxAgeHours = 48) {
  if (!reservation?.createdAt) return false;
  const created = new Date(reservation.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= maxAgeHours;
}

export function mapReservationAdminRow(reservation) {
  const branchCode = reservation.roomId?.branch || "";
  const isViewedByAdmin = Boolean(reservation.isViewedByAdmin);
  const isNew = isNewReservation(reservation) && !isViewedByAdmin;

  return {
    id: reservation._id,
    reservationCode: reservation.reservationCode || "-",
    customer:
      `${reservation.userId?.firstName || ""} ${reservation.userId?.lastName || ""}`.trim() ||
      "Unknown",
    email: reservation.userId?.email || "-",
    phone: reservation.mobileNumber || reservation.phone || "-",
    room: reservation.roomId?.name || reservation.roomId?.roomNumber || "-",
    roomType: reservation.roomId?.type || "",
    selectedBed: reservation.selectedBed || null,
    branchCode,
    branch: getBranchLabel(branchCode),
    moveInDate: reservation.moveInDate,
    moveOutDate: reservation.moveOutDate,
    status: reservation.status || "pending",
    isViewedByAdmin,
    isNew,
    totalPrice: reservation.totalPrice,
    paymentStatus: reservation.paymentStatus,
    viewingPreference: reservation.viewingPreference,
    viewingType: reservation.viewingType,
    visitDate: reservation.visitDate,
    visitTime: reservation.visitTime,
    visitApproved: Boolean(reservation.visitApproved),
    visitScheduledAt: reservation.visitScheduledAt,
    visitStatus: reservation.visitStatus || null,
    visitOutcomeNotes: reservation.visitOutcomeNotes || "",
    visitOutcomeUpdatedAt: reservation.visitOutcomeUpdatedAt || null,
    visitOutcomeUpdatedByName: reservation.visitOutcomeUpdatedByName || "",
    visitHistory: reservation.visitHistory || [],
    scheduleApproved: Boolean(reservation.scheduleApproved),
    scheduleApprovedAt: reservation.scheduleApprovedAt || null,
    scheduleRejected: Boolean(reservation.scheduleRejected),
    scheduleRejectedAt: reservation.scheduleRejectedAt || null,
    scheduleRejectionReason: reservation.scheduleRejectionReason || "",
    cancellationRequested: Boolean(reservation.cancellationRequested),
    cancellationStatus: reservation.cancellationStatus || null,
    cancellationReason: reservation.cancellationReason || null,
    cancellationRequestedAt: reservation.cancellationRequestedAt || null,
    cancellationRequestedBy: reservation.cancellationRequestedBy || null,
    cancellationAdminNote: reservation.cancellationAdminNote || null,
    isArchived: Boolean(reservation.isArchived),
    archivedAt: reservation.archivedAt || null,
    archivedBy: reservation.archivedBy || null,
    archivedByName: getArchivedByName(reservation.archivedBy),
    archivedPreviousStatus: reservation.archivedPreviousStatus || reservation.status || null,
    archiveReason: reservation.archiveReason || "",
    createdAt: reservation.createdAt,
    _raw: reservation,
  };
}

export function checkOverdueReservation(reservation, now = new Date()) {
 if (!hasReservationStatus(reservation.status, "pending", "payment_pending", "reserved")) {
 return false;
 }
 const moveIn = new Date(reservation.moveInDate);
 return !Number.isNaN(moveIn.getTime()) && moveIn < now;
}

export function mapVisitScheduleRows(rawReservations = []) {
 const rows = [];

 rawReservations
 .filter(
 (reservation) =>
 (reservation.visitDate && reservation.viewingPreference === "physical_visit") ||
 reservation.status === "visit_pending" ||
 (reservation.visitDate && reservation.visitApproved) ||
 reservation.scheduleRejected ||
 (reservation.visitHistory && reservation.visitHistory.length > 0),
 )
 .forEach((reservation) => {
 const baseReservation = mapReservationAdminRow(reservation);
 const base = {
 ...baseReservation,
 reservationId: reservation._id,
 phone: reservation.mobileNumber || reservation.userId?.phone || "-",
 viewingType: reservation.viewingType,
 isOutOfTown: reservation.isOutOfTown,
 currentLocation: reservation.currentLocation,
 billingEmail: reservation.billingEmail,
 visitHistory: reservation.visitHistory || [],
 };

 const hasActiveVisitRow =
 reservation.visitDate &&
 !reservation.scheduleRejected &&
 !reservation.visitApproved &&
 !TERMINAL_VISIT_STATUSES.has(reservation.visitStatus) &&
 reservation.status !== "cancelled";

 if (reservation.visitHistory && reservation.visitHistory.length > 0) {
 reservation.visitHistory.forEach((historyEntry, index) => {
 if (hasActiveVisitRow && historyEntry.status === "schedule_approved") {
 return;
 }

 const actionedAt =
 historyEntry.approvedAt || historyEntry.rejectedAt || historyEntry.updatedAt || null;
 const actionedLabel =
 historyEntry.status === "approved" || historyEntry.status === "completed"
 ? "Completed"
 : historyEntry.status === "schedule_approved"
 ? "Approved"
 : historyEntry.status === "rejected"
 ? "Rejected"
 : historyEntry.status === "no_show"
 ? "No-Show"
 : historyEntry.status === "rescheduled"
 ? "Rescheduled"
 : historyEntry.status === "allowed_without_visit"
 ? "Allowed Without Visit"
 : historyEntry.status === "cancelled" || historyEntry.status === "visit_cancelled"
 ? "Cancelled"
 : null;

 rows.push({
 ...base,
 id: `${reservation._id}-history-${index}`,
 visitDate: historyEntry.visitDate,
 visitTime: historyEntry.visitTime || "-",
 visitApproved: historyEntry.status === "approved" || historyEntry.status === "completed",
 scheduleApproved: historyEntry.status === "approved" || historyEntry.status === "completed",
 scheduleRejected: historyEntry.status === "rejected",
 scheduleRejectionReason: historyEntry.rejectionReason || "",
 scheduledDate:
 historyEntry.scheduledAt ||
 reservation.visitScheduledAt ||
 reservation.createdAt,
 actionedAt,
 actionedLabel,
 historyStatus: historyEntry.status,
 isHistorical: true,
 historyIndex: index,
 attemptNumber: historyEntry.attemptNumber || null,
 });
 });
 }

 if (
 hasActiveVisitRow
 ) {
 rows.push({
 ...base,
 id: reservation._id,
 visitDate: reservation.visitDate,
 visitTime: reservation.visitTime || "-",
 visitApproved: reservation.visitApproved,
 scheduleApproved: Boolean(reservation.scheduleApproved),
 scheduleRejected: false,
 scheduleRejectionReason: "",
 visitStatus: reservation.visitStatus || null,
 status: reservation.status,
 scheduledDate: reservation.visitScheduledAt || reservation.createdAt,
 actionedAt: null,
 actionedLabel: null,
 isHistorical: false,
 attemptNumber: (reservation.visitHistory?.length || 0) + 1,
 });
 }
 });

 rows.sort(
 (left, right) =>
 new Date(right.scheduledDate || 0) - new Date(left.scheduledDate || 0),
 );

 return rows;
}

export function applyMoveInFilter(row, filters = {}, now = new Date()) {
  const moveInKey = filters.moveIn || "any";
  if (moveInKey === "any") return true;

  if (!row?.moveInDate) return false;
  const moveIn = new Date(row.moveInDate);
  if (Number.isNaN(moveIn.getTime())) return false;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (moveInKey === "today") {
    return moveIn >= startOfToday && moveIn <= endOfToday;
  }

  if (moveInKey === "this_week") {
    const dayOfWeek = startOfToday.getDay(); // 0 is Sun
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return moveIn >= startOfWeek && moveIn <= endOfWeek;
  }

  if (moveInKey === "this_month") {
    return moveIn.getFullYear() === now.getFullYear() && moveIn.getMonth() === now.getMonth();
  }

  if (moveInKey === "next_30_days") {
    const start30 = startOfToday;
    const end30 = new Date(startOfToday);
    end30.setDate(startOfToday.getDate() + 30);
    end30.setHours(23, 59, 59, 999);
    return moveIn >= start30 && moveIn <= end30;
  }

  if (moveInKey === "custom") {
    const start = filters.moveInStart ? new Date(filters.moveInStart) : null;
    const end = filters.moveInEnd ? new Date(filters.moveInEnd) : null;
    if (start && !Number.isNaN(start.getTime()) && moveIn < start) return false;
    if (end && !Number.isNaN(end.getTime())) {
      const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
      if (moveIn > endInclusive) return false;
    }
    return true;
  }

  return true;
}

export function applyAppDateFilter(row, filters = {}, now = new Date()) {
  const appDateKey = filters.applicationDate || "any";
  if (appDateKey === "any") return true;

  if (!row?.createdAt) return false;
  const created = new Date(row.createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const diffMs = now.getTime() - created.getTime();

  if (appDateKey === "last_24h") {
    return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
  }

  if (appDateKey === "last_7d") {
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  if (appDateKey === "this_month") {
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }

  if (appDateKey === "custom") {
    const start = filters.appDateStart ? new Date(filters.appDateStart) : null;
    const end = filters.appDateEnd ? new Date(filters.appDateEnd) : null;
    if (start && !Number.isNaN(start.getTime()) && created < start) return false;
    if (end && !Number.isNaN(end.getTime())) {
      const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
      if (created > endInclusive) return false;
    }
    return true;
  }

  return true;
}

export function applyQuickChip(row, chip) {
  if (!chip) return true;
  if (chip === "overdue") return checkOverdueReservation(row);
  if (chip === "new") return Boolean(row?.isNew);
  if (chip === "cancellation") return hasPendingCancellationRequest(row);
  if (chip === "awaiting_payment") return row?.paymentStatus === "pending" && row?.status === "approved_for_payment";
  if (chip === "proof_uploaded") return row?.paymentStatus === "proof_uploaded";
  return true;
}
