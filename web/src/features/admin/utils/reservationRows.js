import { BRANCH_DISPLAY_NAMES } from "../../../shared/utils/constants.js";
import {
  RESERVATION_STAGE_MAP,
  hasReservationStatus,
  readMoveInDate,
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

export function isPendingAdminApproval(reservation) {
  if (!reservation) return false;
  if (reservation.isArchived) return false;

  // 1. Pending cancellation request (requires admin action regardless of status)
  if (hasPendingCancellationRequest(reservation)) {
    return true;
  }

  const status = (reservation.status || "").toLowerCase();

  // Terminal or resolved statuses require no admin action
  if (
    hasReservationStatus(
      status,
      "cancelled",
      "rejected",
      "reserved",
      "checked_in",
      "checked_out",
      "moved_in",
      "movein",
      "move_in",
      "confirmed",
      "occupied",
      "completed",
    ) ||
    status === "cancelled" ||
    status === "rejected" ||
    status === "reserved" ||
    status === "checked_in" ||
    status === "checked_out" ||
    status === "moved_in" ||
    status === "movein" ||
    status === "move_in" ||
    status === "confirmed" ||
    status === "occupied"
  ) {
    return false;
  }

  const hasSubmission = Boolean(
    reservation.applicationSubmittedAt || reservation.applicationResubmittedAt,
  );
  const latestSubmissionTime = hasSubmission
    ? new Date(
        reservation.applicationResubmittedAt || reservation.applicationSubmittedAt,
      ).getTime()
    : 0;
  const lastAdminViewTime = reservation.lastAdminViewedAt
    ? new Date(reservation.lastAdminViewedAt).getTime()
    : 0;
  const isSubmissionFresh = hasSubmission && latestSubmissionTime > lastAdminViewTime;

  // If viewed and no fresh submission, it is no longer unread / "NEW"
  if (reservation.isViewedByAdmin && !isSubmissionFresh) {
    return false;
  }

  // 2. Pending application review (new or fresh unviewed submission requiring admin review)
  if (
    status === "pending" ||
    status === "pending_application_review" ||
    status === "pending_review" ||
    status === "under_review" ||
    status === "viewing_preference_selected"
  ) {
    return true;
  }

  // Proof uploaded check removed — manual proof decommissioned (PayMongo only)

  // 4. Pending visit / schedule approval
  if (
    reservation.visitStatus === "pending" ||
    status === "visit_pending" ||
    (reservation.viewingPreference === "physical_visit" &&
      reservation.visitDate &&
      !reservation.visitApproved &&
      !reservation.scheduleApproved &&
      !reservation.scheduleRejected)
  ) {
    return true;
  }

  // 5. Unviewed recent creation (<48h) in an active status
  if (
    isNewReservation(reservation) &&
    !reservation.isViewedByAdmin &&
    status !== "approved_for_payment" &&
    status !== "needs_revision"
  ) {
    return true;
  }

  return false;
}

export function getCancelledByName(cancelledBy, cancellationSource, customerName, userId) {
  const cancelledById = typeof cancelledBy === "object" ? String(cancelledBy?._id || cancelledBy?.id || "") : String(cancelledBy || "");
  const userIdVal = typeof userId === "object" ? String(userId?._id || userId?.id || "") : String(userId || "");
  const isOwnUser = (cancelledById && userIdVal && cancelledById === userIdVal) || cancellationSource === "applicant";

  if (isOwnUser) {
    return customerName || "Applicant";
  }

  if (typeof cancelledBy === "object" && cancelledBy?.role) {
    const role = cancelledBy.role;
    if (role === "branch_admin") return "Branch Admin";
    if (role === "owner") return "System Owner";
    return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (cancellationSource === "admin") return "Branch Admin";
  if (cancellationSource === "system") return "System Sweeper (24h Hold Expired)";

  return "Branch Admin";
}

export function mapReservationAdminRow(reservation, seenIds = null) {
  const branchCode = reservation.roomId?.branch || "";
  const idStr = String(reservation._id || reservation.id || "");

  const hasSubmission = Boolean(
    reservation.applicationSubmittedAt || reservation.applicationResubmittedAt,
  );
  const latestSubmissionTime = hasSubmission
    ? new Date(
        reservation.applicationResubmittedAt || reservation.applicationSubmittedAt,
      ).getTime()
    : 0;
  const lastAdminViewTime = reservation.lastAdminViewedAt
    ? new Date(reservation.lastAdminViewedAt).getTime()
    : 0;
  const isSubmissionFresh = hasSubmission && latestSubmissionTime > lastAdminViewTime;

  const isSeenInSession = Boolean(
    seenIds &&
      (seenIds.has(idStr) || seenIds.has(reservation._id) || seenIds.has(reservation.id)) &&
      !isSubmissionFresh,
  );
  const isViewedByAdmin = isSubmissionFresh
    ? false
    : Boolean(reservation.isViewedByAdmin || isSeenInSession);

  const isResubmitted = Boolean(
    reservation.applicationResubmittedAt &&
      new Date(reservation.applicationResubmittedAt).getTime() >
        new Date(reservation.applicationSubmittedAt || 0).getTime(),
  );

  const isPendingCancellation = hasPendingCancellationRequest(reservation);
  const isNew = isPendingAdminApproval({
    ...reservation,
    isViewedByAdmin,
    lastAdminViewedAt: reservation.lastAdminViewedAt,
  });
  const customer =
    `${reservation.userId?.firstName || ""} ${reservation.userId?.lastName || ""}`.trim() ||
    "Unknown";

  return {
    id: reservation._id,
    reservationCode: reservation.reservationCode || "-",
    customer,
    email: reservation.userId?.email || "-",
    phone: reservation.mobileNumber || reservation.phone || "-",
    room: reservation.roomId?.name || reservation.roomId?.roomNumber || "-",
    roomType: reservation.roomId?.type || "",
    selectedBed: reservation.selectedBed || null,
    branchCode,
    branch: getBranchLabel(branchCode),
    moveInDate: readMoveInDate(reservation),
    moveOutDate: reservation.moveOutDate,
    status: reservation.status || "pending",
    isViewedByAdmin,
    isNew,
    isResubmitted,
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
    applicationSubmittedAt: reservation.applicationSubmittedAt || null,
    applicationResubmittedAt: reservation.applicationResubmittedAt || null,
    lastAdminViewedAt: reservation.lastAdminViewedAt || null,
    cancelledAt: reservation.cancelledAt || null,
    cancelledBy: reservation.cancelledBy || null,
    cancelledByName: reservation.cancelledByName || getCancelledByName(reservation.cancelledBy, reservation.cancellationSource, customer),
    cancellationSource: reservation.cancellationSource || null,
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
    photoUrl: reservation.userId?.profileImage || reservation.userId?.photoUrl || null,
    profileImage: reservation.userId?.profileImage || null,
    selfiePhotoUrl: reservation.selfiePhotoUrl || null,
    userId: reservation.userId || null,
    createdAt: reservation.createdAt,
    documentPrechecks: reservation.documentPrechecks || {},
    _raw: reservation,
  };
}

export function checkOverdueReservation(reservation, now = new Date()) {
  if (!reservation || reservation.isArchived) {
    return false;
  }
  if (!hasReservationStatus(reservation.status, "reserved")) {
    return false;
  }
  const rawDate = readMoveInDate(reservation) || reservation.moveInDate;
  if (!rawDate) {
    return false;
  }
  const moveIn = new Date(rawDate);
  return !Number.isNaN(moveIn.getTime()) && moveIn < now;
}

export function mapVisitScheduleRows(rawReservations = []) {
 const rows = [];

  rawReservations
    .filter(
      (reservation) =>
        (reservation.visitDate &&
          (reservation.viewingPreference === "physical_visit" ||
            reservation.viewingType === "physical_visit")) ||
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

export function getReservationDocumentWarnings(reservation) {
  const prechecks = reservation?.documentPrechecks;
  if (!prechecks || typeof prechecks !== "object") return [];

  const warnings = [];
  const labelMap = {
    selfiePhoto: "Selfie Photo",
    validIDFront: "Valid ID (Front)",
    validIDBack: "Valid ID (Back)",
    nbiClearance: "NBI Clearance",
    companyID: "Company/School ID",
  };

  Object.entries(labelMap).forEach(([key, label]) => {
    const item = prechecks[key];
    if (!item) return;

    const isUnreadable =
      item.readabilityStatus === "unreadable" ||
      item.readabilityStatus === "low_readability";
    const isMismatch = item.documentTypeStatus === "possible_mismatch";
    const isManualFallback = item.precheckStatus === "manual_review_fallback";
    const isNeedsReupload = item.precheckStatus === "needs_reupload";
    const hasWarnings = Array.isArray(item.aiCheckWarnings) && item.aiCheckWarnings.length > 0;

    if (isUnreadable || isMismatch || isNeedsReupload || isManualFallback || hasWarnings) {
      let msg =
        item.applicantMessage ||
        item.adminNote ||
        (isMismatch
          ? "Possible document type mismatch."
          : "Image appears unclear or unreadable. Please inspect manually.");

      if (Array.isArray(item.aiCheckWarnings) && item.aiCheckWarnings.length > 0) {
        msg = item.aiCheckWarnings.join(" ");
      }

      warnings.push(`${label}: ${msg}`);
    }
  });

  return warnings;
}

export function sortReservationsWithPriority(
  reservations = [],
  sortState = { key: "createdAt", dir: "desc" },
  statusFilter = "all",
) {
  if (!Array.isArray(reservations)) return [];
  const { key = "createdAt", dir = "desc" } = sortState || {};

  if (statusFilter === "cancellation_requested") {
    return [...reservations].sort(
      (left, right) =>
        new Date(right.cancellationRequestedAt || 0) -
        new Date(left.cancellationRequestedAt || 0),
    );
  }

  const getSortTimestamp = (row) => {
    const time =
      row?.applicationResubmittedAt ||
      row?.applicationSubmittedAt ||
      row?.createdAt;
    return time ? new Date(time).getTime() : 0;
  };

  return [...reservations].sort((left, right) => {
    // Tier 1: NEW unreviewed reservations always pinned to top
    if (left?.isNew && !right?.isNew) return -1;
    if (!left?.isNew && right?.isNew) return 1;

    // Tier 2: Column sort within each tier
    if (key === "createdAt") {
      const leftTime = getSortTimestamp(left);
      const rightTime = getSortTimestamp(right);
      return dir === "asc" ? leftTime - rightTime : rightTime - leftTime;
    }

    if (key === "moveInDate") {
      const leftMoveIn = new Date(readMoveInDate(left) || 0).getTime();
      const rightMoveIn = new Date(readMoveInDate(right) || 0).getTime();
      return dir === "asc" ? leftMoveIn - rightMoveIn : rightMoveIn - leftMoveIn;
    }

    const leftValue = left?.[key];
    const rightValue = right?.[key];

    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;

    let comparison = 0;
    if (typeof leftValue === "string") {
      comparison = leftValue.localeCompare(rightValue);
    } else {
      comparison = leftValue - rightValue;
    }

    if (comparison !== 0) {
      return dir === "asc" ? comparison : -comparison;
    }

    // Tie-breaker: latest activity time descending
    return getSortTimestamp(right) - getSortTimestamp(left);
  });
}
