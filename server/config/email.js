/**
 * =============================================================================
 * EMAIL SERVICE — HYBRID RESEND TEMPLATE + INLINE HTML, RESEND-ONLY DELIVERY
 * =============================================================================
 *
 * Every function in this file sends through the single authoritative router
 * (server/services/email/lilycrestEmailService.js). For each email type it
 * decides, purely from whether RESEND_TEMPLATE_<KEY> is configured, whether
 * to send a Resend Dashboard Template or pre-rendered inline HTML (see
 * server/services/email/builders/*.js) — either way, Resend is the only
 * delivery provider. There is no Nodemailer/SMTP anywhere in this file.
 *
 *   RESEND_API_KEY          required
 *   RESEND_FROM_EMAIL       required
 *   RESEND_TEMPLATE_*       optional — overrides the inline HTML builder
 *                           for that one email type when set
 *
 * Firebase Admin is still used elsewhere (emailVerificationController.js,
 * passwordResetController.js) to generate the secure verifyEmail/resetPassword
 * action links — this file only ever receives the finished link and hands it
 * to Resend as a variable. Firebase is not an email provider.
 *
 * =============================================================================
 */

import crypto from "crypto";
import { getPublicUrlConfig } from "./publicUrls.js";
import { sendLilycrestEmail } from "../services/email/lilycrestEmailService.js";
import { emailFingerprint } from "../services/email/resendEmailService.js";
import { formatDisplayReference } from "../utils/referenceGenerator.js";

/**
 * Safe peso formatter — avoids toLocaleString("en-PH") which garbles output
 * in Node.js environments without full ICU data.
 */
const fmtPeso = (n) => {
  const fixed = Number(n || 0).toFixed(2);
  const [int, dec] = fixed.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas}.${dec}`;
};

const formatVisitScheduleLabel = (visitDate, visitTime) => {
  const hasDate = Boolean(visitDate);
  const dateLabel = hasDate
    ? new Date(visitDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "TBD";
  return visitTime ? `${dateLabel} at ${visitTime}` : dateLabel;
};

// =============================================================================
// INQUIRY RESPONSE EMAIL
// =============================================================================

export const sendInquiryResponseEmail = async ({ to, customerName, inquirySubject, response, branchName = "Lilycrest" }) => {
  const cleanTo = String(to || "").trim().replace(/,/g, ".");
  if (!cleanTo || !cleanTo.includes("@")) {
    return { success: false, provider: "resend", category: "invalid_recipient", code: "EMAIL_INVALID_RECIPIENT" };
  }
  return sendLilycrestEmail({
    to: cleanTo,
    templateKey: "INQUIRY_RESPONSE",
    variables: {
      CUSTOMER_NAME: customerName,
      INQUIRY_SUBJECT: inquirySubject,
      RESPONSE: response,
      BRANCH_NAME: branchName,
    },
  });
};

// =============================================================================
// RESERVATION CONFIRMED EMAIL
// =============================================================================

export const sendReservationConfirmedEmail = async ({
  to,
  tenantName,
  reservationCode,
  roomName,
  branchName,
  moveInDate,
  checkInDate,
}) =>
  sendLilycrestEmail({
    to,
    templateKey: "RESERVATION_CONFIRMED",
    variables: {
      TENANT_NAME: tenantName,
      RESERVATION_CODE: reservationCode,
      ROOM_NAME: roomName,
      BRANCH_NAME: branchName,
      MOVE_IN_DATE: moveInDate || checkInDate || "TBD",
    },
  });

// =============================================================================
// VISIT APPROVED EMAIL
// =============================================================================

export const sendVisitApprovedEmail = async ({ to, tenantName, branchName }) =>
  sendLilycrestEmail({
    to,
    templateKey: "VISIT_APPROVED",
    variables: { TENANT_NAME: tenantName, BRANCH_NAME: branchName },
  });

// =============================================================================
// PHYSICAL VISIT STATUS EMAIL (scheduled / rescheduled / completed / no-show / cancelled / allowed)
// =============================================================================

const VISIT_STATUS_MAP = {
  scheduled: {
    label: "Physical Visit Scheduled",
    intro: "Your physical visit schedule has been recorded as a room-viewing appointment.",
    nextStep:
      "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
    scheduleLabel: "Visit Schedule",
    ctaLabel: "View Visit Details",
  },
  rescheduled: {
    label: "Physical Visit Rescheduled",
    intro: "Your physical visit schedule has been updated.",
    nextStep:
      "Your tenant application remains locked until your visit is completed or admin allows you to proceed without a completed visit.",
    scheduleLabel: "New Schedule",
    ctaLabel: "View Updated Schedule",
  },
  visit_completed: {
    label: "Physical Visit Completed",
    intro: "Your physical visit has been recorded as completed.",
    nextStep:
      "You may now continue to your tenant application. Payment will remain locked until your application and required documents are approved.",
    scheduleLabel: "Completed Visit",
    ctaLabel: "Continue Application",
  },
  no_show: {
    label: "Missed Physical Visit",
    intro: "We missed you at your scheduled room viewing appointment. Your room reservation is open for rescheduling.",
    nextStep:
      "Please pick a new viewing schedule that works best for you. If your selected room becomes unavailable before rescheduling, you will be able to browse and select another available room.",
    scheduleLabel: "Missed Appointment",
    ctaLabel: "Reschedule Visit Now",
  },
  visit_cancelled: {
    label: "Physical Visit Cancelled",
    intro: "Only your physical visit schedule was cancelled. Your reservation itself remains active.",
    nextStep:
      "Please contact admin or select another allowed next step. Your tenant application remains locked unless admin separately allows you to proceed without a visit.",
    scheduleLabel: "Cancelled Schedule",
    ctaLabel: "View Reservation",
  },
  allowed_without_visit: {
    label: "You May Continue Your Tenant Application",
    intro: "Admin has allowed you to continue without a completed physical visit.",
    nextStep:
      "You may now complete your tenant application. Payment will remain locked until your application and required documents are approved.",
    scheduleLabel: "Visit Schedule",
    ctaLabel: "Continue Application",
  },
};

export const sendPhysicalVisitStatusEmail = async ({
  to,
  tenantName,
  roomName,
  branchName,
  visitCode,
  visitDate,
  visitTime,
  previousVisitDate,
  previousVisitTime,
  remarks,
  status,
}) => {
  const content = VISIT_STATUS_MAP[status] || VISIT_STATUS_MAP.scheduled;
  const currentSchedule = formatVisitScheduleLabel(visitDate, visitTime);
  const rawPreviousSchedule =
    previousVisitDate || previousVisitTime ? formatVisitScheduleLabel(previousVisitDate, previousVisitTime) : "";

  // Only pass previous schedule when status is rescheduled and the dates actually differ
  const previousSchedule =
    status === "rescheduled" && rawPreviousSchedule && rawPreviousSchedule !== currentSchedule
      ? rawPreviousSchedule
      : "";

  const publicUrls = getPublicUrlConfig();
  const ctaUrl = `${publicUrls.clientUrl}/applicant/reservation?step=2`;

  return sendLilycrestEmail({
    to,
    templateKey: "VISIT_STATUS",
    variables: {
      TENANT_NAME: tenantName || "Applicant",
      ROOM_NAME: roomName || "your room",
      BRANCH_NAME: branchName || "Lilycrest",
      VISIT_CODE: visitCode || "Pending",
      VISIT_SCHEDULE: currentSchedule,
      PREVIOUS_SCHEDULE: previousSchedule,
      SCHEDULE_LABEL: content.scheduleLabel || "Visit Schedule",
      REMARKS: remarks || "",
      STATUS_LABEL: content.label,
      STATUS_INTRO: content.intro,
      NEXT_STEP: content.nextStep,
      CTA_LABEL: content.ctaLabel || "View Details",
      CTA_URL: ctaUrl,
    },
  });
};

// =============================================================================
// DOCUMENTS REJECTED EMAIL
// =============================================================================

export const sendDocumentsRejectedEmail = async ({ to, tenantName, rejectionReason, branchName = "Lilycrest" }) =>
  sendLilycrestEmail({
    to,
    templateKey: "DOCUMENTS_REJECTED",
    variables: { TENANT_NAME: tenantName, REJECTION_REASON: rejectionReason, BRANCH_NAME: branchName },
  });

// =============================================================================
// BILL GENERATED EMAIL
// =============================================================================

export const sendBillGeneratedEmail = async ({
  to,
  tenantName,
  billingMonth,
  totalAmount,
  dueDate,
  branchName = "Lilycrest",
  billType = "bill",
  roomName = "",
}) => {
  const normalizedBillType = String(billType || "bill").trim().toLowerCase();
  const billTypeLabel =
    normalizedBillType === "rent"
      ? "Monthly Rent"
      : normalizedBillType === "initial_payment"
        ? "Initial Payment"
        : normalizedBillType.charAt(0).toUpperCase() + normalizedBillType.slice(1);
  return sendLilycrestEmail({
    to,
    templateKey: "BILL_GENERATED",
    variables: {
      TENANT_NAME: tenantName,
      BILL_TYPE_LABEL: billTypeLabel,
      ROOM_NAME: roomName,
      BILLING_MONTH: billingMonth,
      TOTAL_AMOUNT: fmtPeso(totalAmount),
      DUE_DATE: dueDate,
      BRANCH_NAME: branchName,
    },
  });
};

// =============================================================================
// UTILITY CHARGE AVAILABLE EMAIL
// =============================================================================

export const sendUtilityChargeAvailableEmail = async ({
  to,
  tenantName,
  utilityType,
  billingMonth,
  utilityAmount,
  totalAmount,
  dueDate,
  branchName = "Lilycrest",
}) => {
  const utilityLabel = utilityType === "water" ? "Water" : "Electricity";
  return sendLilycrestEmail({
    to,
    templateKey: "UTILITY_CHARGE",
    variables: {
      TENANT_NAME: tenantName,
      UTILITY_LABEL: utilityLabel,
      BILLING_MONTH: billingMonth,
      UTILITY_AMOUNT: fmtPeso(utilityAmount),
      TOTAL_AMOUNT: fmtPeso(totalAmount),
      DUE_DATE: dueDate,
      BRANCH_NAME: branchName,
    },
  });
};

// =============================================================================
// PAYMENT REMINDER EMAIL (sent 3 days before due date)
// =============================================================================

export const sendPaymentReminderEmail = async ({
  to,
  tenantName,
  billingMonth,
  totalAmount,
  dueDate,
  billType = "Bill",
  branchName = "Lilycrest",
}) =>
  sendLilycrestEmail({
    to,
    templateKey: "PAYMENT_REMINDER",
    variables: {
      TENANT_NAME: tenantName,
      BILL_TYPE_LABEL: String(billType || "Bill"),
      BILLING_MONTH: billingMonth,
      TOTAL_AMOUNT: fmtPeso(totalAmount),
      DUE_DATE: dueDate,
      BRANCH_NAME: branchName,
    },
  });

// =============================================================================
// OVERDUE / PENALTY NOTICE EMAIL
// =============================================================================

export const sendOverdueNoticeEmail = async ({
  to,
  tenantName,
  billingMonth,
  totalAmount,
  daysLate,
  penalty,
  dueDate = "the due date",
  billType = "Bill",
  reason = "",
  noticeVariant = "overdue",
  branchName = "Lilycrest",
}) =>
  sendLilycrestEmail({
    to,
    templateKey: "OVERDUE_NOTICE",
    variables: {
      TENANT_NAME: tenantName,
      BILL_TYPE_LABEL: String(billType || "Bill"),
      BILLING_MONTH: billingMonth,
      DAYS_LATE: daysLate,
      TOTAL_AMOUNT: fmtPeso(totalAmount),
      PENALTY: fmtPeso(penalty),
      DUE_DATE: dueDate,
      REASON: reason,
      NOTICE_VARIANT: noticeVariant === "penalty" ? "penalty" : "overdue",
      BRANCH_NAME: branchName,
    },
  });

// =============================================================================
// PAYMENT APPROVED EMAIL
// =============================================================================

export const sendPaymentApprovedEmail = async ({ to, tenantName, billingMonth, paidAmount, branchName = "Lilycrest" }) =>
  sendLilycrestEmail({
    to,
    templateKey: "PAYMENT_APPROVED",
    variables: {
      TENANT_NAME: tenantName,
      BILLING_MONTH: billingMonth,
      PAID_AMOUNT: fmtPeso(paidAmount),
      BRANCH_NAME: branchName,
    },
  });

// =============================================================================
// PAYMENT REJECTED EMAIL
// =============================================================================

export const sendPaymentRejectedEmail = async ({ to, tenantName, billingMonth, rejectionReason, branchName = "Lilycrest" }) =>
  sendLilycrestEmail({
    to,
    templateKey: "PAYMENT_REJECTED",
    variables: {
      TENANT_NAME: tenantName,
      BILLING_MONTH: billingMonth,
      REJECTION_REASON: rejectionReason,
      BRANCH_NAME: branchName,
    },
  });

// =============================================================================
// PAYMENT RECEIPT EMAIL
// =============================================================================

/**
 * Namespaced so a legitimate second receipt for a different payment never
 * collides with an earlier one, but the exact same payment reference retried
 * (e.g. a webhook redelivery) is deduped by Resend instead of double-sent.
 */
const paymentReceiptIdempotencyKey = (referenceId) =>
  referenceId ? crypto.createHash("sha256").update(`payment-receipt:${referenceId}`).digest("hex") : undefined;

export const sendPaymentReceiptEmail = async ({
  to,
  tenantName,
  amount,
  description,
  billedTo,
  paymentMethod = "Online Payment",
  paymentDate,
  referenceId,
  reservationCode,
  roomName,
  branch,
}) =>
  sendLilycrestEmail({
    to,
    templateKey: "PAYMENT_RECEIPT",
    idempotencyKey: paymentReceiptIdempotencyKey(referenceId),
    variables: {
      TENANT_NAME: tenantName,
      AMOUNT: fmtPeso(amount),
      DESCRIPTION: description,
      BILLED_TO: billedTo || tenantName,
      PAYMENT_METHOD: paymentMethod,
      PAYMENT_DATE: paymentDate,
      REFERENCE_NUMBER: formatDisplayReference(referenceId, "—"),
      RESERVATION_CODE: reservationCode || "",
      ROOM_NAME: roomName || "",
      BRANCH_NAME: branch || "Lilycrest",
    },
  });

// =============================================================================
// EMAIL VERIFICATION LINK
// =============================================================================

/**
 * Namespaced separately from the password-reset key below so a retry of one
 * flow can never be deduped against the other for the same address.
 */
const verificationEmailIdempotencyKey = (to, verificationLink) =>
  crypto.createHash("sha256").update(`email-verification:${to}:${verificationLink}`).digest("hex");

export const sendEmailVerificationLinkEmail = async ({ to, name, verificationLink }) =>
  sendLilycrestEmail({
    to,
    templateKey: "EMAIL_VERIFICATION",
    idempotencyKey: verificationEmailIdempotencyKey(to, verificationLink),
    variables: {
      USER_NAME: name || "there",
      VERIFICATION_URL: verificationLink,
    },
  });

// =============================================================================
// PASSWORD RESET EMAIL
// =============================================================================

const passwordResetEmailIdempotencyKey = (to, resetLink) =>
  crypto.createHash("sha256").update(`password-reset:${to}:${resetLink}`).digest("hex");

export const sendPasswordResetLinkEmail = async ({ to, name, resetLink }) =>
  sendLilycrestEmail({
    to,
    templateKey: "PASSWORD_RESET",
    idempotencyKey: passwordResetEmailIdempotencyKey(to, resetLink),
    variables: {
      USER_NAME: name || "there",
      RESET_URL: resetLink,
    },
  });

// =============================================================================
// PASSWORD CHANGED SECURITY NOTIFICATION EMAIL
// =============================================================================

export const sendPasswordChangedEmail = async ({ to, name, timestamp, ipAddress }) =>
  sendLilycrestEmail({
    to,
    templateKey: "PASSWORD_CHANGED",
    variables: {
      USER_NAME: name || "there",
      TIMESTAMP: timestamp || new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
      IP_ADDRESS: ipAddress || "Unknown",
    },
  });

// =============================================================================
// LOGIN OTP EMAIL
// =============================================================================

export const sendLoginOtpEmail = async ({ to, name, otp, expiresInMinutes = 10 }) =>
  sendLilycrestEmail({
    to,
    templateKey: "LOGIN_OTP",
    variables: {
      USER_NAME: name || "there",
      OTP_CODE: otp,
      EXPIRY_MINUTES: expiresInMinutes,
    },
  });

// =============================================================================
// QA TEST HARNESS — force-send any template from the command line
// =============================================================================
//
// Only runs when this file is executed directly (`node email.js ...`), never
// when it's imported by your app.
//
// Usage:
//   node email.js <template> <to-email> [name]

const QA_TEMPLATES = {
  inquiry: (to, name) =>
    sendInquiryResponseEmail({
      to,
      customerName: name,
      inquirySubject: "Do you allow overnight visitors?",
      response: "Yes, visitors are allowed until 10 PM with front desk registration.",
      branchName: "Gil Puyat",
    }),
  reservation: (to, name) =>
    sendReservationConfirmedEmail({
      to,
      tenantName: name,
      reservationCode: "RSV-TEST-001",
      roomName: "Room 204 - Bed A",
      branchName: "Gil Puyat",
      moveInDate: "August 15, 2026",
    }),
  "visit-approved": (to, name) => sendVisitApprovedEmail({ to, tenantName: name, branchName: "Gil Puyat" }),
  "visit-scheduled": (to, name) =>
    sendPhysicalVisitStatusEmail({
      to, tenantName: name, roomName: "Room 204 - Bed A", branchName: "Gil Puyat",
      visitCode: "VC-TEST-001", visitDate: "2026-08-05", visitTime: "2:00 PM", status: "scheduled",
    }),
  "visit-rescheduled": (to, name) =>
    sendPhysicalVisitStatusEmail({
      to, tenantName: name, roomName: "Room 204 - Bed A", branchName: "Gil Puyat",
      visitCode: "VC-TEST-001", visitDate: "2026-08-07", visitTime: "3:30 PM",
      previousVisitDate: "2026-08-05", previousVisitTime: "2:00 PM", status: "rescheduled",
    }),
  "visit-completed": (to, name) =>
    sendPhysicalVisitStatusEmail({
      to, tenantName: name, roomName: "Room 204 - Bed A", branchName: "Gil Puyat",
      visitCode: "VC-TEST-001", visitDate: "2026-08-05", visitTime: "2:00 PM", status: "visit_completed",
    }),
  "visit-no-show": (to, name) =>
    sendPhysicalVisitStatusEmail({
      to, tenantName: name, roomName: "Room 204 - Bed A", branchName: "Gil Puyat",
      visitCode: "VC-TEST-001", visitDate: "2026-08-05", visitTime: "2:00 PM", status: "no_show",
    }),
  "visit-cancelled": (to, name) =>
    sendPhysicalVisitStatusEmail({
      to, tenantName: name, roomName: "Room 204 - Bed A", branchName: "Gil Puyat",
      visitCode: "VC-TEST-001", visitDate: "2026-08-05", visitTime: "2:00 PM", status: "visit_cancelled",
    }),
  "docs-rejected": (to, name) =>
    sendDocumentsRejectedEmail({
      to, tenantName: name, rejectionReason: "Uploaded ID photo is blurry, please re-upload.", branchName: "Gil Puyat",
    }),
  bill: (to, name) =>
    sendBillGeneratedEmail({
      to, tenantName: name, billingMonth: "August 2026", totalAmount: 4500, dueDate: "August 10, 2026",
      branchName: "Gil Puyat", billType: "rent", roomName: "Room 204 - Bed A",
    }),
  electricity: (to, name) =>
    sendUtilityChargeAvailableEmail({
      to, tenantName: name, utilityType: "electricity", billingMonth: "August 2026",
      utilityAmount: 350, totalAmount: 4850, dueDate: "August 10, 2026", branchName: "Gil Puyat",
    }),
  water: (to, name) =>
    sendUtilityChargeAvailableEmail({
      to, tenantName: name, utilityType: "water", billingMonth: "August 2026",
      utilityAmount: 150, totalAmount: 4650, dueDate: "August 10, 2026", branchName: "Gil Puyat",
    }),
  reminder: (to, name) =>
    sendPaymentReminderEmail({
      to, tenantName: name, billingMonth: "August 2026", totalAmount: 4500,
      dueDate: "August 10, 2026", billType: "Rent", branchName: "Gil Puyat",
    }),
  overdue: (to, name) =>
    sendOverdueNoticeEmail({
      to, tenantName: name, billingMonth: "August 2026", totalAmount: 4750, daysLate: 3,
      penalty: 250, dueDate: "August 10, 2026", billType: "Rent", noticeVariant: "overdue", branchName: "Gil Puyat",
    }),
  penalty: (to, name) =>
    sendOverdueNoticeEmail({
      to, tenantName: name, billingMonth: "August 2026", totalAmount: 4750, daysLate: 3,
      penalty: 250, dueDate: "August 10, 2026", billType: "Rent", reason: "Late payment penalty applied.",
      noticeVariant: "penalty", branchName: "Gil Puyat",
    }),
  "payment-approved": (to, name) => sendPaymentApprovedEmail({ to, tenantName: name, billingMonth: "August 2026", paidAmount: 4500 }),
  "payment-rejected": (to, name) =>
    sendPaymentRejectedEmail({
      to, tenantName: name, billingMonth: "August 2026",
      rejectionReason: "Proof of payment does not match the billed amount.", branchName: "Gil Puyat",
    }),
  receipt: (to, name) =>
    sendPaymentReceiptEmail({
      to, tenantName: name, amount: 4500, description: "Monthly Rent - August 2026",
      billedTo: name, paymentMethod: "GCash", paymentDate: "August 1, 2026",
      referenceId: "REF-TEST-0001", reservationCode: "RSV-TEST-001", roomName: "Room 204 - Bed A", branch: "Gil Puyat",
    }),
  otp: (to, name) => sendLoginOtpEmail({ to, name, otp: "482913", expiresInMinutes: 10 }),
};

const isRunDirectly =
  typeof process !== "undefined" && process.argv[1] && /email\.js$/.test(process.argv[1]);

if (isRunDirectly) {
  const [, , template, to, name = "Test Tenant"] = process.argv;

  if (!template || !to || !QA_TEMPLATES[template]) {
    console.log("\nUsage: node email.js <template> <to-email> [name]\n");
    console.log("Available templates:\n  " + Object.keys(QA_TEMPLATES).join("\n  "));
    process.exit(template && !QA_TEMPLATES[template] ? 1 : 0);
  }

  console.log(`\n[QA] Force-sending "${template}"`, { emailFingerprint: emailFingerprint(to) });
  QA_TEMPLATES[template](to, name)
    .then((result) => {
      console.log("[QA] Result:", {
        success: Boolean(result?.success),
        category: result?.category || null,
        code: result?.code || null,
      });
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[QA] Unhandled error", err?.message);
      process.exit(1);
    });
}
