/** Inline HTML builders for reservation and applicant lifecycle events. */
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
} from "../emailLayout.js";

const reservationUrl = () => getPortalUrl("/applicant/reservation");

export const buildReservationConfirmedEmail = ({
  TENANT_NAME,
  RESERVATION_CODE,
  ROOM_NAME,
  BRANCH_NAME,
  MOVE_IN_DATE,
}) =>
  renderLilycrestEmail({
    title: "Reservation Confirmed - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Reservation Confirmed",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      badge("Reservation confirmed", "success") +
      detailsPanel(
        row("Reservation Code", RESERVATION_CODE) +
          row("Room", ROOM_NAME) +
          row("Branch", BRANCH_NAME) +
          row("Move-in Date", MOVE_IN_DATE),
      ) +
      button("View Reservation", reservationUrl()) +
      p("Please arrive on your move-in date with a valid ID. Contact us through the tenant portal if you need help.", {
        size: "14px",
        margin: "0",
      }),
  });

export const buildVisitApprovedEmail = ({ TENANT_NAME, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Visit Schedule Confirmed - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Visit Schedule Confirmed",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(`Your physical visit schedule for <strong>${escapeHtml(BRANCH_NAME)}</strong> has been confirmed.`) +
      badge("Viewing schedule confirmed", "success") +
      button("Continue Application", reservationUrl()) +
      p("Payment becomes available only after your application and required documents are approved.", {
        size: "13px",
        margin: "0",
      }),
  });

const visitTone = (label = "") => {
  const normalized = String(label).toLowerCase();
  if (normalized.includes("completed") || normalized.includes("continue")) return "success";
  if (normalized.includes("cancelled")) return "danger";
  if (normalized.includes("scheduled") || normalized.includes("rescheduled")) return "info";
  return "warning";
};

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
}) =>
  renderLilycrestEmail({
    title: STATUS_LABEL,
    branchName: BRANCH_NAME,
    heading: STATUS_LABEL,
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p(escapeHtml(STATUS_INTRO)) +
      badge(STATUS_LABEL, visitTone(STATUS_LABEL)) +
      detailsPanel(
        row("Room", ROOM_NAME) +
          row("Branch", BRANCH_NAME) +
          row("Visit Code", VISIT_CODE) +
          row("Visit Schedule", VISIT_SCHEDULE) +
          row("Previous Schedule", PREVIOUS_SCHEDULE) +
          row("Remarks", REMARKS),
      ) +
      p(escapeHtml(NEXT_STEP), { size: "14px" }) +
      button("View Application", reservationUrl()) +
      p("Payment remains locked until your application and required documents are approved.", {
        size: "13px",
        margin: "0",
      }),
  });

export const buildDocumentsRejectedEmail = ({
  TENANT_NAME,
  REJECTION_REASON,
  BRANCH_NAME,
}) =>
  renderLilycrestEmail({
    title: "Documents Need Attention - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "Documents Need Attention",
    body:
      p(`Hi <strong>${escapeHtml(TENANT_NAME)}</strong>,`) +
      p("We reviewed your submitted documents and found an issue.") +
      callout("Reason", escapeHtml(REJECTION_REASON), "warning") +
      button("Review Documents", reservationUrl()) +
      p("Your reservation remains active while you correct and resubmit the required documents.", {
        size: "14px",
        margin: "0",
      }),
  });
