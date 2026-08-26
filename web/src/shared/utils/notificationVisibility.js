import { USER_ROLES } from "./constants.js";

export const APPLICANT_NOTIFICATION_TYPES = new Set([
  "reservation_confirmed",
  "reservation_cancelled",
  "reservation_cancellation_requested",
  "reservation_cancellation_rejected",
  "reservation_expired",
  "reservation_noshow",
  "visit_approved",
  "visit_rejected",
  "payment_approved",
  "payment_rejected",
  "account_suspended",
  "account_reactivated",
]);

export const TENANT_NOTIFICATION_TYPES = new Set([
  "bill_generated",
  "bill_due_reminder",
  "penalty_applied",
  "contract_expiring",
  "grace_period_warning",
  "move_in_reminder",
  "maintenance_update",
  "contract_document_ready",
  "chat_reply",
  "payment_approved",
  "payment_rejected",
  "account_suspended",
  "account_reactivated",
  "announcement",
  "renewal_effective",
  "tenant_violation",
  "reservation_confirmed",
  "reservation_cancelled",
  "reservation_cancellation_requested",
  "reservation_cancellation_rejected",
  "reservation_expired",
  "reservation_noshow",
  "visit_approved",
  "visit_rejected",
]);

export const ADMIN_NOTIFICATION_TYPES = new Set([
  "general",
  "reservation_cancellation_requested",
  "sla_breach",
  "chat_unresponded",
  "announcement",
  "account_suspended",
  "account_reactivated",
  "inquiry_new",
  "maintenance_new",
  "payment_proof_submitted",
  "application_submitted",
  "contract_signed",
  "contract_prepared",
  "contract_incomplete",
  "contract_error",
  "visit_requested",
  "visit_scheduled",
]);

const APPLICANT_GENERAL_TITLES = new Set([
  "Application Approved for Payment",
  "Application Needs Revision",
  "Application Rejected",
  "Application Pending Review",
  "Physical Visit Preference Saved",
  "2D Remote Viewing Request Submitted",
  "Urgent Move-in Review Requested",
  "Move-In Readiness Incomplete",
  "Remaining Initial Balance Available",
  "Initial Payment Confirmed and Complete",
  "Reservation Hold Expired",
]);

const TENANT_GENERAL_TITLES = new Set([
  "Bill Overdue",
  "Contract Renewed",
  "Move-Out Complete",
  "Room Transfer",
  "Lease Renewal Offer",
  "Renewal Declined",
  "Lease Renewed!",
  "Move-In Readiness Incomplete",
  "Move-In Complete",
  "Remaining Initial Balance Available",
  "Initial Payment Confirmed and Complete",
  "Reservation Hold Expired",
]);

const normalizeUrl = (url) => String(url || "");
const normalizeRole = (role) => String(role || "").toLowerCase();

const isAdminRole = (role) =>
  role === USER_ROLES.BRANCH_ADMIN || role === USER_ROLES.OWNER;

const isAdminActionUrl = (notification = {}) =>
  normalizeUrl(notification.actionUrl).startsWith("/admin");

const isApplicantReservationActionUrl = (notification = {}) => {
  const actionUrl = normalizeUrl(notification.actionUrl);
  return actionUrl === "/applicant/reservation" || actionUrl.startsWith("/applicant/reservation?");
};

const isApplicantGeneralNotification = (notification = {}) =>
  notification.type === "general" &&
  !isAdminActionUrl(notification) &&
  (APPLICANT_GENERAL_TITLES.has(notification.title) ||
    isApplicantReservationActionUrl(notification) ||
    ["reservation", "bill", "user"].includes(notification.entityType));

const isTenantGeneralNotification = (notification = {}) =>
  notification.type === "general" &&
  !isAdminActionUrl(notification) &&
  (TENANT_GENERAL_TITLES.has(notification.title) ||
    ["bill", "maintenance", "stay", "user", "reservation", "contract", "announcement"].includes(notification.entityType));

export const isNotificationVisibleForUser = (notification, user) => {
  const role = normalizeRole(user?.role);
  const type = notification?.type;

  if (role === USER_ROLES.APPLICANT) {
    return (
      APPLICANT_NOTIFICATION_TYPES.has(type) ||
      isApplicantGeneralNotification(notification)
    );
  }

  if (role === USER_ROLES.TENANT) {
    return (
      TENANT_NOTIFICATION_TYPES.has(type) ||
      isTenantGeneralNotification(notification)
    );
  }

  if (isAdminRole(role)) {
    return ADMIN_NOTIFICATION_TYPES.has(type);
  }

  return false;
};

export const getVisibleNotificationsForUser = (notifications = [], user) =>
  notifications.filter((notification) =>
    isNotificationVisibleForUser(notification, user),
  );

export const getNotificationQueryScope = (user) => {
  const role = normalizeRole(user?.role) || "anonymous";
  const id = user?._id || user?.id || user?.uid || "current";
  return `${role}:${id}`;
};
