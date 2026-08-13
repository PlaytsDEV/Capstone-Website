/**
 * ============================================================================
 * NOTIFICATION SERVICE
 * ============================================================================
 *
 * Centralized service for creating and dispatching notifications.
 */

import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import {
  buildMaintenanceNotificationBody,
  buildMaintenanceNotificationTitle,
} from "../../config/maintenance.js";
import logger from "../../middleware/logger.js";
import { sendMobilePushBill, sendMobilePushToRecipients } from "./mobilePushService.js";
import { emitToUser } from "../../utils/socket.js";

async function createNotification(userId, type, title, message, options = {}) {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      actionUrl: options.actionUrl || null,
      entityType: options.entityType || "",
      entityId: options.entityId || null,
    });
    await notification.save();
    if (options.emitRealtime !== false) {
      try {
        emitToUser(userId, "notification:new", buildRealtimeNotificationPayload(notification));
      } catch (emitError) {
        logger.warn(
          {
            err: emitError,
            userId: String(userId || ""),
            type,
          },
          "[Notification] Realtime delivery failed",
        );
      }
    }
    return notification;
  } catch (error) {
    console.error("⚠️ Failed to create notification:", error.message);
    return null;
  }
}

async function createNotificationWithPush(
  userId,
  type,
  title,
  message,
  options = {},
  pushSender = null,
) {
  const notification = await createNotification(userId, type, title, message, options);

  if (typeof pushSender !== "function") {
    return notification;
  }

  try {
    const delivered = await pushSender();
    logger.info(
      {
        userId: String(userId || ""),
        type,
        delivered,
      },
      "[Notification] Mobile push delivery completed",
    );
  } catch (error) {
    logger.warn(
      {
        err: error,
        userId: String(userId || ""),
        type,
      },
      "[Notification] Mobile push delivery failed",
    );
  }

  return notification;
}

const buildRealtimeNotificationPayload = (notification) => {
  if (!notification) return null;

  const payload = notification?.toObject ? notification.toObject() : notification;
  return {
    ...payload,
    _id: payload?._id ? String(payload._id) : payload?._id,
    userId: payload?.userId ? String(payload.userId) : payload?.userId,
    isRead: Boolean(payload?.isRead),
  };
};

const buildMaintenanceUpdateMessage = (
  requestType,
  status,
  {
    statusChanged = true,
    hasAdminNote = false,
    hasProgressEntry = false,
    hasProgressAttachments = false,
  } = {},
) => {
  if (statusChanged) {
    return buildMaintenanceNotificationBody(requestType, status);
  }

  if (hasProgressEntry && hasProgressAttachments) {
    return "Admin replied with a progress update and attachment(s) for your maintenance request.";
  }

  if (hasProgressAttachments) {
    return "Admin added new attachment(s) to your maintenance request.";
  }

  if (hasAdminNote || hasProgressEntry) {
    return "Admin replied to your maintenance request.";
  }

  return "Your maintenance request has been updated.";
};

const formatCode = (code) => {
  if (!code || code === "N/A" || code === "—" || code === "-") return "";
  return String(code).trim();
};

const notify = {
  reservationConfirmed: (userId, reservationCode, roomName) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    const roomStr = roomName ? ` for ${roomName}` : "";
    return createNotification(userId, "reservation_confirmed", "Reservation Confirmed",
      `Your reservation${codeStr}${roomStr} has been confirmed.`,
      { entityType: "reservation" });
  },

  reservationCancelled: (userId, reservationCode, reason) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    const reasonStr = reason ? `. Reason: ${reason}` : "";
    return createNotification(userId, "reservation_cancelled", "Reservation Cancelled",
      `Your reservation${codeStr} has been cancelled${reasonStr}.`,
      { entityType: "reservation" });
  },

  cancellationRequested: (userId, reservationCode) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    return createNotification(userId, "reservation_cancellation_requested", "Cancellation Request Submitted",
      `Your cancellation request for reservation${codeStr} is pending admin review.`,
      { entityType: "reservation", actionUrl: "/applicant/profile" });
  },

  cancellationApproved: (userId, reservationCode) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    return createNotification(userId, "reservation_cancelled", "Reservation Cancelled",
      `Your reservation${codeStr} has been cancelled. The reservation fee is non-refundable.`,
      { entityType: "reservation" });
  },

  cancellationRejected: (userId, reservationCode, note) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    return createNotification(userId, "reservation_cancellation_rejected", "Cancellation Request Not Approved",
      `Your cancellation request for reservation${codeStr} was not approved.${note ? ` Admin note: ${note}` : ""}`,
      { entityType: "reservation" });
  },

  cancellationRequestAlert: (adminUserId, tenantName, reservationCode, reservationId = null) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` for reservation ${code}` : " for reservation";
    return createNotification(adminUserId, "reservation_cancellation_requested", "Cancellation Request Received",
      `${tenantName} has requested cancellation${codeStr}. Review required. The reservation fee is non-refundable.`,
      {
        entityType: "reservation",
        entityId: reservationId ? String(reservationId) : null,
        actionUrl: reservationId
          ? `/admin/reservations?reservationId=${String(reservationId)}&focus=cancellation`
          : "/admin/reservations",
      });
  },

  visitApproved: (userId, branchName) =>
    createNotification(userId, "visit_approved", "Visit Schedule Confirmed",
      `Your physical visit schedule for ${branchName} has been confirmed for viewing coordination only. Payment will remain locked until your application and documents are approved.`,
      { entityType: "reservation" }),

  visitRejected: (userId, reason) =>
    createNotification(userId, "visit_rejected", "Visit Schedule Rejected",
      `Your visit schedule has been rejected. ${reason || "Please reschedule."}`,
      { entityType: "reservation" }),

  paymentApproved: (userId, billingMonth, amount, options = {}) => {
    const title = "Payment Approved";
    const formattedAmount = typeof amount === "number" ? amount.toLocaleString() : amount;
    const message = `Your payment of ₱${formattedAmount} for ${billingMonth} has been approved.`;
    const billId = options.billId || null;

    return createNotificationWithPush(
      userId,
      "payment_approved",
      title,
      message,
      {
        entityType: "bill",
        entityId: billId ? String(billId) : null,
        actionUrl: billId ? `/billing?billId=${String(billId)}` : "/billing",
      },
      () =>
        sendMobilePushToRecipients([userId], {
          title,
          body: message,
          data: {
            type: "payment_approved",
            billing_id: billId ? String(billId) : "",
            screen: "billing",
            url: billId ? `/bill-details?billId=${String(billId)}` : "/(tabs)/billing",
          },
        }),
    );
  },

  billingNotice: (
    userId,
    {
      notificationType = "bill_due_reminder",
      title = "Billing Notice",
      message = "You have a billing update.",
      billId = null,
      actionUrl = "/billing",
      pushType = "billing_notice",
    } = {},
  ) =>
    createNotificationWithPush(
      userId,
      notificationType,
      title,
      message,
      {
        entityType: "bill",
        entityId: billId ? String(billId) : null,
        actionUrl,
      },
      () =>
        sendMobilePushToRecipients([userId], {
          title,
          body: message,
          data: {
            type: pushType,
            billing_id: billId ? String(billId) : "",
            screen: "billing",
            url: billId ? `/bill-details?billId=${String(billId)}` : "/(tabs)/billing",
          },
        }),
    ),

  paymentRejected: (userId, billingMonth, reason, options = {}) => {
    const title = "Payment Rejected";
    const message = `Your payment for ${billingMonth} was rejected. ${reason || "Please resubmit."}`;
    const billId = options.billId || null;

    return createNotificationWithPush(
      userId,
      "payment_rejected",
      title,
      message,
      {
        entityType: "bill",
        entityId: billId ? String(billId) : null,
        actionUrl: billId ? `/billing?billId=${String(billId)}` : "/billing",
      },
      () =>
        sendMobilePushToRecipients([userId], {
          title,
          body: message,
          data: {
            type: "payment_rejected",
            billing_id: billId ? String(billId) : "",
            screen: "billing",
            url: billId ? `/bill-details?billId=${String(billId)}` : "/(tabs)/billing",
          },
        }),
    );
  },

  billGenerated: async (userId, billingMonth, totalAmount, dueDate, options = {}) =>
    createNotificationWithPush(
      userId,
      "bill_generated",
      "New Bill Available",
      options.billType === "rent"
        ? "Your rent bill is now available"
        : `Your bill for ${billingMonth} is ₱${totalAmount}. Due by ${dueDate}.`,
      {
        entityType: "bill",
        entityId: options.billId || null,
        actionUrl: options.actionUrl || null,
      },
      () => sendMobilePushBill(userId, null, {
        billingMonth,
        totalAmount,
        dueDate,
        billId: options.billId || null,
        billType: options.billType || "bill",
      }),
    ),

  utilityChargeAvailable: (
    userId,
    utilityType,
    billingMonth,
    utilityAmount,
    totalAmount,
    dueDate,
  ) =>
    createNotification(
      userId,
      "bill_generated",
      `${utilityType === "water" ? "Water" : "Electricity"} Charge Available`,
      `Your ${utilityType} charge for ${billingMonth} is ₱${utilityAmount}. Current bill total: ₱${totalAmount}. Due by ${dueDate}.`,
      { entityType: "bill", actionUrl: "/tenant/account?tab=billing" },
    ),

  overdueMoveIn: (userId, reservationCode, roomName, tenantName, daysOverdue) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` (${code})` : "";
    return createNotification(userId, "grace_period_warning", "Overdue Move-In",
      `${tenantName}${codeStr} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue for move-in to ${roomName}. Please extend or cancel.`,
      { entityType: "reservation" });
  },

  accountSuspended: (userId, reason) =>
    createNotification(userId, "account_suspended", "Account Suspended",
      `Your account has been suspended. ${reason || "Contact support for details."}`,
      { entityType: "user" }),

  accountReactivated: (userId) =>
    createNotification(userId, "account_reactivated", "Account Reactivated",
      "Your account has been reactivated. You can now log in and use the system.",
      { entityType: "user" }),

  billDueReminder: (userId, billingMonth, totalAmount, daysUntilDue, options = {}) => {
    const title = "Payment Reminder";
    const message = `Your bill of ₱${totalAmount.toLocaleString()} for ${billingMonth} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`;
    const billId = options.billId || null;

    return createNotificationWithPush(
      userId,
      "bill_due_reminder",
      title,
      message,
      {
        entityType: "bill",
        entityId: billId ? String(billId) : null,
        actionUrl: billId ? `/billing?billId=${String(billId)}` : "/billing",
      },
      () =>
        sendMobilePushToRecipients([userId], {
          title,
          body: message,
          data: {
            type: "bill_due_reminder",
            billing_id: billId ? String(billId) : "",
            screen: "billing",
            url: billId ? `/bill-details?billId=${String(billId)}` : "/(tabs)/billing",
          },
        }),
    );
  },

  penaltyApplied: (userId, billingMonth, penaltyAmount, daysLate, options = {}) => {
    const title = "Late Payment Penalty";
    const message = `A penalty of ₱${penaltyAmount.toLocaleString()} (${daysLate} day${daysLate === 1 ? "" : "s"} late) has been applied to your ${billingMonth} bill.`;
    const billId = options.billId || null;

    return createNotificationWithPush(
      userId,
      "penalty_applied",
      title,
      message,
      {
        entityType: "bill",
        entityId: billId ? String(billId) : null,
        actionUrl: billId ? `/billing?billId=${String(billId)}` : "/billing",
      },
      () =>
        sendMobilePushToRecipients([userId], {
          title,
          body: message,
          data: {
            type: "penalty_applied",
            billing_id: billId ? String(billId) : "",
            screen: "billing",
            url: billId ? `/bill-details?billId=${String(billId)}` : "/(tabs)/billing",
          },
        }),
    );
  },

  contractExpiring: (userId, roomName, daysRemaining) => {
    const title = "Lease Expiring Soon";
    const message = `Your lease for ${roomName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Please contact the admin to renew or arrange move-out.`;

    return createNotificationWithPush(
      userId,
      "contract_expiring",
      title,
      message,
      { entityType: "reservation", actionUrl: "/applicant/profile" },
      () =>
        sendMobilePushToRecipients([userId], {
          title,
          body: message,
          data: {
            type: "contract_expiring",
            screen: "home",
          },
        }),
    );
  },

  reservationExpired: (userId, reservationCode, roomName) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    const roomStr = roomName ? ` for ${roomName}` : "";
    return createNotification(userId, "reservation_expired", "Reservation Expired",
      `Your reservation${codeStr}${roomStr} has expired due to inactivity. The bed has been released.`,
      { entityType: "reservation" });
  },

  reservationNoShow: (userId, reservationCode, roomName, daysOverdue) => {
    const code = formatCode(reservationCode);
    const codeStr = code ? ` ${code}` : "";
    const roomStr = roomName ? ` for ${roomName}` : "";
    return createNotification(userId, "reservation_noshow", "Reservation Cancelled — No Show",
      `Your reservation${codeStr}${roomStr} has been cancelled. You did not move in within ${daysOverdue} days of your deadline.`,
      { entityType: "reservation" });
  },

  stalePendingVisitWarning: (adminUserId, tenantName, roomName, daysPending) =>
    createNotification(adminUserId, "general", "Unactioned Visit Request",
      `${tenantName} has a visit request for ${roomName} pending for ${daysPending} days. It will auto-expire in ${14 - daysPending} day${(14 - daysPending) === 1 ? "" : "s"} if not acted on.`,
      { entityType: "reservation" }),

  slaBreachAlert: (adminUserId, branch, delayedCount, urgencyBreakdown) =>
    createNotification(
      adminUserId,
      "sla_breach",
      `SLA Breach — ${delayedCount} Request${delayedCount > 1 ? "s" : ""} Overdue`,
      `${delayedCount} maintenance request${delayedCount > 1 ? "s" : ""} in ${branch} ${delayedCount > 1 ? "have" : "has"} breached SLA. (${urgencyBreakdown}). Immediate attention required.`,
      { actionUrl: "/admin/maintenance?quickFilter=delayed", entityType: "maintenance" },
    ),

  chatUnresponded: (adminUserId, branch, conversationCount) =>
    createNotification(
      adminUserId,
      "chat_unresponded",
      `${conversationCount} Chat${conversationCount > 1 ? "s" : ""} Awaiting Response`,
      `${conversationCount} open conversation${conversationCount > 1 ? "s" : ""} in ${branch} ${conversationCount > 1 ? "have" : "has"} not received an admin reply in over 4 hours.`,
      { actionUrl: "/admin/chat", entityType: "chat" },
    ),

  moveOutComplete: (userId, roomName) =>
    createNotificationWithPush(
      userId,
      "general",
      "Move-Out Complete",
      `You have been moved out from ${roomName}. Thank you for staying at Lilycrest!`,
      { entityType: "stay" },
      () =>
        sendMobilePushToRecipients([userId], {
          title: "Move-Out Complete",
          body: `You have been moved out from ${roomName}. Thank you for staying at Lilycrest!`,
          data: {
            type: "move_out",
            screen: "home",
          },
        }),
    ),

  general: (userId, title, message, options = {}) =>
    createNotification(userId, "general", title, message, options),

  maintenanceUpdated: async (userId, requestType, status, requestId, options = {}) => {
    const notification = await createNotification(
      userId,
      "maintenance_update",
      buildMaintenanceNotificationTitle(requestType),
      buildMaintenanceUpdateMessage(requestType, status, options),
      {
        entityType: "maintenance",
        entityId: requestId || null,
        actionUrl: "/applicant/maintenance",
      },
    );

    return notification;
  },

  newMaintenanceTicket: (branch, tenantName, roomName, urgency, category, requestId) => {
    const isEmergency = urgency === "emergency" || urgency === "high";
    const title = isEmergency
      ? `CRITICAL: Emergency Maintenance Request`
      : `New Maintenance Request`;
    const message = `${tenantName} in ${roomName || "assigned room"} filed a ${urgency ? urgency.toUpperCase() : "NORMAL"} maintenance request (${category || "General"}).`;
    return notifyBranchAdmins(branch, "maintenance_new", title, message, {
      entityType: "maintenance",
      entityId: requestId ? String(requestId) : null,
      actionUrl: requestId ? `/admin/maintenance?requestId=${String(requestId)}` : "/admin/maintenance",
    });
  },

  maintenanceTenantReply: (branch, tenantName, requestId) =>
    notifyBranchAdmins(branch, "maintenance_new", "Maintenance Reply Received",
      `${tenantName} replied to maintenance request.`,
      {
        entityType: "maintenance",
        entityId: requestId ? String(requestId) : null,
        actionUrl: requestId ? `/admin/maintenance?requestId=${String(requestId)}` : "/admin/maintenance",
      }),

  maintenanceReopened: (branch, tenantName, requestId) =>
    notifyBranchAdmins(branch, "maintenance_new", "Maintenance Ticket Re-opened",
      `${tenantName} re-opened maintenance request. Action required.`,
      {
        entityType: "maintenance",
        entityId: requestId ? String(requestId) : null,
        actionUrl: requestId ? `/admin/maintenance?requestId=${String(requestId)}` : "/admin/maintenance",
      }),

  newApplicationSubmitted: (branch, applicantName, roomName, reservationId) =>
    notifyBranchAdmins(branch, "application_submitted", "New Application Received",
      `New application submitted by ${applicantName} for ${roomName || "room"}. Document review required.`,
      {
        entityType: "reservation",
        entityId: reservationId ? String(reservationId) : null,
        actionUrl: reservationId ? `/admin/reservations?reservationId=${String(reservationId)}` : "/admin/reservations",
      }),

  contractSignedByTenant: (branch, tenantName, roomName, contractId) =>
    notifyBranchAdmins(branch, "contract_signed", "Lease Contract Signed",
      `${tenantName} has signed the lease contract for ${roomName || "room"}. Ready for admin verification.`,
      {
        entityType: "contract",
        entityId: contractId ? String(contractId) : null,
        actionUrl: "/admin/contracts",
      }),

  paymentProofSubmitted: (branch, tenantName, billingMonth, amount, billId) => {
    const formattedAmount = typeof amount === "number" ? amount.toLocaleString() : amount;
    return notifyBranchAdmins(branch, "payment_proof_submitted", "Payment Verification Pending",
      `${tenantName} submitted payment proof of ₱${formattedAmount} for ${billingMonth}. Verification required.`,
      {
        entityType: "bill",
        entityId: billId ? String(billId) : null,
        actionUrl: billId ? `/admin/billing?billId=${String(billId)}` : "/admin/billing",
      });
  },

  newVisitRequested: (branch, applicantName, roomName, visitDate, visitTime) =>
    notifyBranchAdmins(branch, "visit_requested", "New Visit Scheduled",
      `${applicantName} scheduled a viewing visit for ${roomName || "room"} on ${visitDate}${visitTime ? ` at ${visitTime}` : ""}.`,
      {
        entityType: "reservation",
        actionUrl: "/admin/reservations?tab=visits",
      }),
};

export async function notifyBranchAdmins(branch, type, title, message, options = {}) {
  try {
    const adminRecipients = branch
      ? [
          { role: "branch_admin", branch },
          { role: "owner" },
        ]
      : [
          { role: "branch_admin" },
          { role: "owner" },
        ];

    const adminUsers = await User.find({
      $or: adminRecipients,
      accountStatus: "active",
      isArchived: { $ne: true },
    }).select("_id branch role").lean();

    const notifications = await Promise.all(
      adminUsers.map((admin) =>
        createNotification(admin._id, type, title, message, options)
      )
    );

    return notifications.filter(Boolean);
  } catch (error) {
    logger.warn(
      { err: error, branch, type },
      "[Notification] Failed to notify branch admins",
    );
    return [];
  }
}

export { createNotification, notify };
export default notify;
