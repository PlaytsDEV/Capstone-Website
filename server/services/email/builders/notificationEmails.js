/**
 * Inline HTML builders for general notification emails.
 */
import { callout, escapeHtml, p, renderLilycrestEmail } from "../emailLayout.js";

export const buildInquiryResponseEmail = ({ CUSTOMER_NAME, INQUIRY_SUBJECT, RESPONSE, BRANCH_NAME }) =>
  renderLilycrestEmail({
    title: "Lilycrest Dormitory - Response to Your Inquiry",
    branchName: BRANCH_NAME,
    heading: `Hello ${CUSTOMER_NAME}!`,
    footerNote: "This is an automated response. Please do not reply directly to this email.",
    body:
      p(
        `Hello <strong>${escapeHtml(CUSTOMER_NAME)}</strong>, thank you for reaching out to us. We have reviewed your inquiry and here is our response:`,
      ) +
      callout("Your Inquiry", `<em>${escapeHtml(INQUIRY_SUBJECT)}</em>`) +
      callout("Our Response", escapeHtml(RESPONSE)) +
      p("If you have any further questions, feel free to submit another inquiry through our website.", { margin: "20px 0 0" }),
  });
