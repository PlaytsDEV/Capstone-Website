import { USER_ROLES } from "./constants";

export const TENANT_ONLY_NOTIFICATION_TYPES = new Set([
  "bill_generated",
  "bill_due_reminder",
  "penalty_applied",
  "contract_expiring",
  "grace_period_warning",
  "move_in_reminder",
  "maintenance_update",
]);

export const isNotificationVisibleForUser = (notification, user) => {
  if (user?.role !== USER_ROLES.APPLICANT) return true;
  return !TENANT_ONLY_NOTIFICATION_TYPES.has(notification?.type);
};

export const getVisibleNotificationsForUser = (notifications = [], user) =>
  notifications.filter((notification) =>
    isNotificationVisibleForUser(notification, user),
  );
