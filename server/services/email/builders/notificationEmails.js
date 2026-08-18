/** Inline HTML builders for tenant-facing support notifications. */
import {
  button,
  callout,
  detailsPanel,
  escapeHtml,
  getPortalUrl,
  p,
  renderLilycrestEmail,
  row,
} from "../emailLayout.js";

export const buildInquiryResponseEmail = ({
  CUSTOMER_NAME,
  INQUIRY_SUBJECT,
  RESPONSE,
  BRANCH_NAME,
  TICKET_ID,
}) =>
  renderLilycrestEmail({
    title: "New Reply to Your Inquiry - Lilycrest Dormitory",
    branchName: BRANCH_NAME,
    heading: "New Reply to Your Inquiry",
    body:
      p(`Hi <strong>${escapeHtml(CUSTOMER_NAME)}</strong>,`) +
      p("An administrator has replied to your concern.") +
      detailsPanel(row("Ticket", TICKET_ID ? `#${TICKET_ID}` : "") + row("Subject", INQUIRY_SUBJECT)) +
      callout("Administrator response", escapeHtml(RESPONSE), "info") +
      button("Open Inquiry", getPortalUrl()) +
      p("Continue the conversation in the Lilycrest tenant app if you need more help.", {
        size: "13px",
        margin: "0",
      }),
  });
