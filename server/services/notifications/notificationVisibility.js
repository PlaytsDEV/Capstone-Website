/**
 * ============================================================================
 * NOTIFICATION VISIBILITY SERVICE
 * ============================================================================
 *
 * Rules and filters for role-based notification visibility.
 */

import { ADMIN_ROLE_VALUES } from "../../config/roles.js";

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
  "visit_requested",
]);

const APPLICANT_GENERAL_TITLES = new Set([
  "Application Approved for Payment",
  "Application Needs Revision",
  "Application Rejected",
  "Application Pending Review",
  "Physical Visit Preference Saved",
  "2D Remote Viewing Request Submitted",
  "Urgent Move-in Review Requested",
]);

const TENANT_GENERAL_TITLES = new Set([
  "Bill Overdue",
  "Contract Renewed",
  "Move-Out Complete",
  "Room Transfer",
]);

const ADMIN_ROLES = new Set(ADMIN_ROLE_VALUES);

const normalizeRole = (role) => String(role || "").toLowerCase();
const normalizeUrl = (url) => String(url || "");

const isAdminActionUrl = (notification = {}) =>
  normalizeUrl(notification.actionUrl).startsWith("/admin");

const isApplicantReservationActionUrl = (notification = {}) => {
  const actionUrl = normalizeUrl(notification.actionUrl);
  return actionUrl === "/applicant/reservation" || actionUrl.startsWith("/applicant/reservation?");
};

const isApplicantGeneralNotification = (notification = {}) =>
  notification.type === "general" &&
  (APPLICANT_GENERAL_TITLES.has(notification.title) ||
    isApplicantReservationActionUrl(notification));

const isTenantGeneralNotification = (notification = {}) =>
  notification.type === "general" &&
  !isAdminActionUrl(notification) &&
  (TENANT_GENERAL_TITLES.has(notification.title) ||
    ["bill", "maintenance", "stay", "user"].includes(notification.entityType));

export const isNotificationVisibleForRole = (notification = {}, role) => {
  const normalizedRole = normalizeRole(role);
  const type = notification?.type;

  if (normalizedRole === "applicant") {
    return (
      APPLICANT_NOTIFICATION_TYPES.has(type) ||
      isApplicantGeneralNotification(notification)
    );
  }

  if (normalizedRole === "tenant") {
    return (
      TENANT_NOTIFICATION_TYPES.has(type) ||
      isTenantGeneralNotification(notification)
    );
  }

  if (ADMIN_ROLES.has(normalizedRole)) {
    return ADMIN_NOTIFICATION_TYPES.has(type);
  }

  return false;
};

const applicantGeneralMongoFilter = {
  type: "general",
  $or: [
    { title: { $in: [...APPLICANT_GENERAL_TITLES] } },
    { actionUrl: { $regex: "^/applicant/reservation(\\?|$)" } },
  ],
};

const tenantGeneralMongoFilter = {
  type: "general",
  $and: [
    {
      $or: [
        { actionUrl: { $exists: false } },
        { actionUrl: null },
        { actionUrl: "" },
        { actionUrl: { $not: /^\/admin/ } },
      ],
    },
    {
      $or: [
        { title: { $in: [...TENANT_GENERAL_TITLES] } },
        { entityType: { $in: ["bill", "maintenance", "stay", "user"] } },
      ],
    },
  ],
};

export const getNotificationVisibilityFilterForRole = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "applicant") {
    return {
      $or: [
        { type: { $in: [...APPLICANT_NOTIFICATION_TYPES] } },
        applicantGeneralMongoFilter,
      ],
    };
  }

  if (normalizedRole === "tenant") {
    return {
      $or: [
        { type: { $in: [...TENANT_NOTIFICATION_TYPES] } },
        tenantGeneralMongoFilter,
      ],
    };
  }

  if (ADMIN_ROLES.has(normalizedRole)) {
    return { type: { $in: [...ADMIN_NOTIFICATION_TYPES] } };
  }

  return { _id: null };
};

export const getNotificationVisibilityFilterForUser = (user) =>
  getNotificationVisibilityFilterForRole(user?.role);
