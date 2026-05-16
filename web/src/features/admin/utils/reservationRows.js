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

export function mapReservationAdminRow(reservation) {
 const branchCode = reservation.roomId?.branch || "";

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
