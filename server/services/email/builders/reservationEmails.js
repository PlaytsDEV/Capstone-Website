/**
 * Inline HTML builders for reservation/applicant lifecycle emails.
 */
import { badge, button, callout, detailsPanel, escapeHtml, p, renderLilycrestEmail, row } from "../emailLayout.js";

export const buildReservationConfirmedEmail = ({ TENANT_NAME, RESERVATION_CODE, ROOM_NAME, BRANCH_NAME, MOVE_IN_DATE }) =>
  renderLilycrestEmail({
    title: "Reservation Confirmed - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Reservation Confirmed!",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p("Your reservation has been confirmed. Here are your details:") +
      detailsPanel(
        row("Reservation Code", RESERVATION_CODE) +
        row("Room", ROOM_NAME) +
        row("Branch", BRANCH_NAME) +
        row("Move-in Date", MOVE_IN_DATE),
      ) +
      p(
        "Please arrive on your move-in date with your valid ID. If you have questions, contact us through the dormitory portal.",
        { size: "14px" },
      ),
  });

export const buildVisitApprovedEmail = ({ TENANT_NAME, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Visit Schedule Confirmed - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Visit Schedule Confirmed",
    footerNote: "Lilycrest Dormitory Management System",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your physical visit schedule for <strong>${escapeHtml(BRANCH_NAME)}</strong> has been confirmed by our admin team.`) +
      badge("Visit Schedule Confirmed — for viewing coordination only") +
      p(
        "Please continue your tenant application and document upload in the portal. Payment will only become available after your application and documents are approved.",
      ),
  });

export const buildVisitStatusEmail = ({
  TENANT_NAME,
  ROOM_NAME,
  BRANCH_NAME,
  VISIT_CODE,
  VISIT_SCHEDULE,
  PREVIOUS_SCHEDULE,
  REMARKS,
  STATUS_LABEL,
  STATUS_INTRO,
  NEXT_STEP,
  SCHEDULE_LABEL = "Visit Schedule",
  CTA_LABEL,
  CTA_URL,
}) =>
  renderLilycrestEmail({
    title: STATUS_LABEL,
    branchName: BRANCH_NAME,
    heading: STATUS_LABEL,
    footerNote: "Lilycrest Dormitory Management System",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(escapeHtml(STATUS_INTRO)) +
      badge(STATUS_LABEL) +
      detailsPanel(
        row("Room", ROOM_NAME) +
        row("Branch", BRANCH_NAME) +
        row("Visit Code", VISIT_CODE) +
        row(SCHEDULE_LABEL || "Visit Schedule", VISIT_SCHEDULE) +
        row("Previous Schedule", PREVIOUS_SCHEDULE) +
        row("Remarks", REMARKS),
      ) +
      (CTA_LABEL && CTA_URL ? button(CTA_LABEL, CTA_URL) : "") +
      p(escapeHtml(NEXT_STEP), { size: "14px" }) +
      p("Payment remains locked until your application and required documents are approved.", {
        size: "13px",
        color: "#6B7280",
        margin: "0",
      }),
  });

export const buildDocumentsRejectedEmail = ({ TENANT_NAME, REJECTION_REASON, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Documents Need Attention - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Documents Need Attention",
    body:
      p(`Hello <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p("We reviewed your submitted documents and found an issue:") +
      callout("Reason", escapeHtml(REJECTION_REASON)) +
      p("Please log in to the dormitory portal and re-upload your documents. Your reservation will remain active.", {
        size: "14px",
      }),
  });
