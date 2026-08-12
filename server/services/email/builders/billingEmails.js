/**
 * Inline HTML builders for billing/payment emails. AMOUNT/TOTAL_AMOUNT/etc.
 * arrive already formatted as strings (e.g. "4,500.00") from email.js — this
 * file never computes or reformats a monetary value itself, matching the
 * Resend Template path exactly.
 */
import { callout, detailsPanel, escapeHtml, p, renderLilycrestEmail, row, stat, statPanel } from "../emailLayout.js";

export const buildBillGeneratedEmail = ({ TENANT_NAME, BILL_TYPE_LABEL, ROOM_NAME, BILLING_MONTH, TOTAL_AMOUNT, DUE_DATE, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "New Bill Generated - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "New Bill Generated",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your ${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())} bill has been generated:`) +
      detailsPanel(row("Bill Type", BILL_TYPE_LABEL) + row("Room / Bed", ROOM_NAME) + row("Billing Month", BILLING_MONTH) + row("Due Date", DUE_DATE)) +
      statPanel(stat("Total Amount", `₱${TOTAL_AMOUNT}`)) +
      p("Please log in to the dormitory portal to view the full breakdown and make your payment.", { size: "14px" }),
  });

export const buildUtilityChargeEmail = ({ TENANT_NAME, UTILITY_LABEL, BILLING_MONTH, UTILITY_AMOUNT, TOTAL_AMOUNT, DUE_DATE, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: `${UTILITY_LABEL} Charge Available - Lilycrest Dormitory`,
    branchName: BRANCH_NAME,
    heading: `${UTILITY_LABEL} Charge Available`,
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your ${escapeHtml(String(UTILITY_LABEL || "").toLowerCase())} charge for ${escapeHtml(BILLING_MONTH)} is now available in the tenant portal.`) +
      detailsPanel(row(`${UTILITY_LABEL} Charge`, `₱${UTILITY_AMOUNT}`) + row("Due Date", DUE_DATE)) +
      statPanel(stat("Current Bill Total", `₱${TOTAL_AMOUNT}`)) +
      p("Please log in to the dormitory portal to review the updated breakdown and complete payment.", { size: "14px" }),
  });

export const buildPaymentReminderEmail = ({ TENANT_NAME, BILL_TYPE_LABEL, TOTAL_AMOUNT, DUE_DATE, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Payment Reminder - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Reminder",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`This is a friendly reminder that your ${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())} payment is due soon.`) +
      detailsPanel(row("Bill Type", BILL_TYPE_LABEL) + row("Due Date", DUE_DATE)) +
      statPanel(stat("Amount Due", `₱${TOTAL_AMOUNT}`)) +
      p("Please complete payment through the billing portal's online checkout to avoid late penalties.", { size: "14px" }),
  });

export const buildOverdueNoticeEmail = ({
  TENANT_NAME,
  BILL_TYPE_LABEL,
  DAYS_LATE,
  TOTAL_AMOUNT,
  PENALTY,
  DUE_DATE,
  REASON,
  NOTICE_VARIANT,
  BRANCH_NAME,
}) => {
  const isPenaltyNotice = NOTICE_VARIANT === "penalty";
  const headline = isPenaltyNotice ? "Penalty Notice" : "Payment Overdue";
  const intro = isPenaltyNotice
    ? `A late-payment penalty update is now attached to your <strong>${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())}</strong> bill.`
    : `Your <strong>${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())}</strong> payment is <strong>${escapeHtml(String(DAYS_LATE))} day(s) overdue</strong>. Penalties are being applied.`;

  return renderLilycrestEmail({
    title: isPenaltyNotice ? "Penalty Notice - Lilycrest Dormitory" : "Payment Overdue - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: headline,
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(intro) +
      detailsPanel(
        row("Bill Type", BILL_TYPE_LABEL) +
        row("Due Date", DUE_DATE) +
        row("Days Overdue", DAYS_LATE) +
        row("Reason", REASON),
      ) +
      statPanel(
        stat("Total Amount (incl. penalty)", `₱${TOTAL_AMOUNT}`) +
        `<p style="color:#a9841f;font-size:13px;margin:10px 0 0;">Includes ₱${escapeHtml(String(PENALTY))} in late penalties</p>`,
      ) +
      p("Please settle your payment immediately to avoid further charges.", { size: "14px" }),
  });
};

export const buildPaymentApprovedEmail = ({ TENANT_NAME, BILLING_MONTH, PAID_AMOUNT, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Payment Approved - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Approved!",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your payment of <strong>₱${escapeHtml(String(PAID_AMOUNT))}</strong> for <strong>${escapeHtml(BILLING_MONTH)}</strong> has been verified and approved.`) +
      p("Thank you for your prompt payment!"),
  });

export const buildPaymentRejectedEmail = ({ TENANT_NAME, BILLING_MONTH, REJECTION_REASON, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Payment Proof Rejected - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Proof Rejected",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your payment proof for <strong>${escapeHtml(BILLING_MONTH)}</strong> was reviewed and could not be accepted.`) +
      callout("Reason", escapeHtml(REJECTION_REASON)) +
      p(
        "Please complete payment using the billing portal's online checkout, or contact branch staff for assisted offline settlement.",
        { size: "14px" },
      ),
  });

export const buildPaymentReceiptEmail = ({
  TENANT_NAME,
  AMOUNT,
  DESCRIPTION,
  BILLED_TO,
  PAYMENT_METHOD,
  PAYMENT_DATE,
  REFERENCE_NUMBER,
  RESERVATION_CODE,
  ROOM_NAME,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: "Payment Receipt - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Receipt",
    footerNote: "You're receiving this e-mail because you made a payment at Lilycrest Dormitory.",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>, thank you for your payment. Here's a copy of your receipt.`) +
      statPanel(stat("Amount Paid", `₱${AMOUNT}`)) +
      detailsPanel(
        row("Description", DESCRIPTION) +
        row("Billed to", BILLED_TO) +
        row("Payment method", PAYMENT_METHOD) +
        row("Date paid", PAYMENT_DATE) +
        row("Reference", REFERENCE_NUMBER) +
        row("Reservation code", RESERVATION_CODE) +
        row("Room / Branch", ROOM_NAME),
      ) +
      p("If you have any questions about this payment, contact Lilycrest Dormitory through the tenant portal.", {
        size: "13px",
        color: "#6B7280",
        margin: "0",
      }),
  });
