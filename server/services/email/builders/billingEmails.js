/**
 * Inline HTML builders for billing and payment events. Monetary values arrive
 * preformatted from config/email.js; these builders never recompute them.
 */
import {
  badge,
  button,
  callout,
  detailsPanel,
  escapeHtml,
  getPortalUrl,
  p,
  renderLilycrestEmail,
  row,
  stat,
  statPanel,
} from "../emailLayout.js";

const billingUrl = () => getPortalUrl("/applicant/billing");
const amount = (value) => {
  const normalized = String(value ?? "0.00").trim();
  return /^PHP\s/i.test(normalized) ? normalized : `PHP ${normalized}`;
};

export const buildBillGeneratedEmail = ({
  TENANT_NAME,
  BILL_TYPE_LABEL,
  ROOM_NAME,
  BILLING_MONTH,
  TOTAL_AMOUNT,
  DUE_DATE,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: "New Bill Generated - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Your Billing Statement Is Ready",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your ${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())} statement is now available.`) +
      detailsPanel(
        row("Room / Bed", ROOM_NAME) +
          row("Billing Period", BILLING_MONTH) +
          row("Due Date", DUE_DATE),
      ) +
      statPanel(stat("Total Due", amount(TOTAL_AMOUNT))) +
      button("View Billing Statement", billingUrl()) +
      p("Review the full breakdown before completing payment through the authenticated tenant portal.", {
        size: "14px",
        margin: "0",
      }),
  });

export const buildUtilityChargeEmail = ({
  TENANT_NAME,
  UTILITY_LABEL,
  BILLING_MONTH,
  UTILITY_AMOUNT,
  TOTAL_AMOUNT,
  DUE_DATE,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: `${UTILITY_LABEL} Charge Available - Lilycrest Dormitory`,
    branchName: BRANCH_NAME,
    heading: `${UTILITY_LABEL} Charge Available`,
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your ${escapeHtml(String(UTILITY_LABEL || "").toLowerCase())} charge for ${escapeHtml(BILLING_MONTH)} is now available.`) +
      detailsPanel(
        row(`${UTILITY_LABEL} Charge`, amount(UTILITY_AMOUNT)) + row("Due Date", DUE_DATE),
      ) +
      statPanel(stat("Current Bill Total", amount(TOTAL_AMOUNT))) +
      button("View Billing Statement", billingUrl()) +
      p("Review the updated breakdown and available payment methods in the tenant portal.", {
        size: "14px",
        margin: "0",
      }),
  });

export const buildPaymentReminderEmail = ({
  TENANT_NAME,
  BILL_TYPE_LABEL,
  TOTAL_AMOUNT,
  DUE_DATE,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: "Payment Reminder - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Reminder",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your ${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())} payment is due soon.`) +
      detailsPanel(row("Bill Type", BILL_TYPE_LABEL) + row("Due Date", DUE_DATE)) +
      statPanel(stat("Amount Due", amount(TOTAL_AMOUNT))) +
      button("View Billing", billingUrl()) +
      p("Please complete payment before the due date to avoid late penalties.", {
        size: "14px",
        margin: "0",
      }),
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
    ? `A late-payment penalty update was applied to your <strong>${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())}</strong> bill.`
    : `Your <strong>${escapeHtml(String(BILL_TYPE_LABEL || "").toLowerCase())}</strong> payment is <strong>${escapeHtml(String(DAYS_LATE))} day(s) overdue</strong>.`;

  return renderLilycrestEmail({
    title: `${headline} - Lilycrest Dormitory`,
    branchName: BRANCH_NAME,
    heading: headline,
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(intro) +
      callout("Action required", "Please review and settle this balance as soon as possible.", "danger") +
      detailsPanel(
        row("Bill Type", BILL_TYPE_LABEL) +
          row("Due Date", DUE_DATE) +
          row("Days Overdue", DAYS_LATE) +
          row("Reason", REASON),
      ) +
      statPanel(
        stat("Total Amount (including penalty)", amount(TOTAL_AMOUNT)) +
          `<p style="color:#991B1B;font-size:13px;margin:10px 0 0;">Includes ${escapeHtml(amount(PENALTY))} in late penalties</p>`,
      ) +
      button("View Billing", billingUrl()),
  });
};

export const buildPaymentApprovedEmail = ({
  TENANT_NAME,
  BILLING_MONTH,
  PAID_AMOUNT,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: "Payment Approved - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Approved",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      badge("Payment verified", "success") +
      p(`Your payment of <strong>${escapeHtml(amount(PAID_AMOUNT))}</strong> for <strong>${escapeHtml(BILLING_MONTH)}</strong> has been verified.`) +
      button("View Billing", billingUrl()) +
      p("Thank you for your payment.", { margin: "0" }),
  });

export const buildPaymentRejectedEmail = ({
  TENANT_NAME,
  BILLING_MONTH,
  REJECTION_REASON,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: "Payment Proof Rejected - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Payment Proof Rejected",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your payment proof for <strong>${escapeHtml(BILLING_MONTH)}</strong> could not be accepted.`) +
      callout("Reason", escapeHtml(REJECTION_REASON), "danger") +
      button("Review Billing", billingUrl()) +
      p("Use the authenticated billing portal or contact branch staff for assistance.", {
        size: "14px",
        margin: "0",
      }),
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
    footerNote: "This receipt confirms a payment recorded by Lilycrest Dormitory.",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>, thank you for your payment.`) +
      badge("Payment received", "success") +
      statPanel(stat("Amount Paid", amount(AMOUNT))) +
      detailsPanel(
        row("Description", DESCRIPTION) +
          row("Billed to", BILLED_TO) +
          row("Payment method", PAYMENT_METHOD) +
          row("Date paid", PAYMENT_DATE) +
          row("Reference", REFERENCE_NUMBER) +
          row("Reservation code", RESERVATION_CODE) +
          row("Room", ROOM_NAME),
      ) +
      button("View Billing", billingUrl()) +
      p("Contact Lilycrest support through the tenant portal if you have questions about this payment.", {
        size: "13px",
        margin: "0",
      }),
  });
