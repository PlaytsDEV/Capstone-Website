// One-off generator: produces ready-to-paste HTML for every Resend Template
// referenced by server/services/email/templateRegistry.js, using the same
// canonical navy / gold Lilycrest visual system used by the repository-owned
// inline builders. Dashboard templates remain an explicit opt-in path.
// Run: node docs/email-templates/generate.mjs
// Output: docs/email-templates/<KEY>.html (one file per template) + MANIFEST.md

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const THEME = {
  logo: "https://www.lilycrest.space/lilycrest-logo.png",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  navy: "#0A1628",
  navyHover: "#13243D",
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  gold: "#D4AF37",
  goldDeep: "#7A5C00",
  goldTint: "#FBF7EA",
  border: "#E5E7EB",
  textDark: "#0A1628",
  textBody: "#1E293B",
  textMuted: "#4B5563",
  textFaint: "#6B7280",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
};

const shell = ({ heading, bodyHtml, branchSubtitle = "{{BRANCH_SUBTITLE}}", footerNote = "Automated service email — please use the Lilycrest portal for assistance." }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;font-family:${THEME.fontFamily};background-color:${THEME.pageBg};">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background-color:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${THEME.navy};padding:24px 32px;text-align:center;border-bottom:4px solid ${THEME.gold};">
              <img src="${THEME.logo}" width="176" alt="Lilycrest Dormitory" style="display:block;width:176px;max-width:70%;height:auto;margin:0 auto;">
              ${branchSubtitle ? `<p style="color:#F3E4B0;margin:12px 0 0;font-size:13px;line-height:1.4;">${branchSubtitle}</p>` : "<!-- Branch subtitle intentionally omitted when no canonical branch is available. -->"}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 16px;">
              <h1 style="color:${THEME.textDark};margin:0;font-size:24px;line-height:1.3;font-weight:700;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${THEME.pageBg};padding:22px 32px;border-top:1px solid ${THEME.border};">
              <p style="color:${THEME.textDark};font-size:13px;font-weight:700;margin:0 0 6px;">Lilycrest Dormitory</p>
              <p style="color:${THEME.textFaint};font-size:12px;line-height:1.5;margin:0;">${footerNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const p = (text, opts = {}) =>
  `<p style="color:${opts.color || THEME.textBody};font-size:${opts.size || "16px"};line-height:1.6;margin:${opts.margin || "0 0 16px"};">${text}</p>`;

const button = (label, urlVar) =>
  `<div style="margin:24px 0;"><a href="${urlVar}" style="display:inline-block;background-color:${THEME.navy};color:#FFFFFF;text-decoration:none;padding:13px 20px;border-radius:8px;font-size:14px;font-weight:700;line-height:1.2;">${label}</a></div>`;

const detailsPanel = (rows) =>
  `<div style="background-color:${THEME.pageBg};border:1px solid ${THEME.border};border-radius:8px;padding:16px 18px;margin:0 0 20px;"><table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table></div>`;

const row = (label, valueVar) =>
  `<tr><td style="padding:7px 8px 7px 0;color:${THEME.textMuted};font-size:13px;vertical-align:top;">${label}</td><td style="padding:7px 0;color:${THEME.textDark};font-size:13px;font-weight:700;text-align:right;vertical-align:top;">${valueVar}</td></tr>`;

const statPanel = (label, valueVar) => `
  <div style="background-color:${THEME.goldTint};border:1px solid #F3E4B0;border-radius:8px;padding:18px;margin:20px 0;">
    <p style="color:${THEME.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${label}</p>
    <p style="color:${THEME.navy};font-size:28px;line-height:1.2;font-weight:700;margin:0;">${valueVar}</p>
  </div>`;

const callout = (label, contentVar) => `
  <div style="background-color:${THEME.goldTint};border:1px solid #F3E4B0;border-left:4px solid ${THEME.gold};padding:16px 18px;margin:0 0 20px;border-radius:0 8px 8px 0;">
    <p style="color:${THEME.goldDeep};font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${label}</p>
    <p style="color:${THEME.textDark};font-size:14px;margin:0;line-height:1.7;">${contentVar}</p>
  </div>`;

// Each entry: { key, subject, variables (for the manifest), html }
const templates = [];

templates.push({
  key: "EMAIL_VERIFICATION",
  subject: "Verify your Lilycrest email",
  variables: ["USER_NAME", "VERIFICATION_URL"],
  html: shell({
    heading: "Verify Your Email",
    branchSubtitle: "",
    bodyHtml:
      p("Hi <strong>{{USER_NAME}}</strong>,") +
      p("Confirm your email address to finish setting up your Lilycrest account.", { size: "14px" }) +
      button("Verify email address", "{{{VERIFICATION_URL}}}") +
      p("This link can be used only once. If you did not create this account, you can ignore this email.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
});

templates.push({
  key: "PASSWORD_RESET",
  subject: "Reset your Lilycrest password",
  variables: ["USER_NAME", "RESET_URL"],
  html: shell({
    heading: "Reset Your Password",
    branchSubtitle: "",
    bodyHtml:
      p("Hi <strong>{{USER_NAME}}</strong>,") +
      p("We received a request to reset the password for your Lilycrest account.", { size: "14px" }) +
      button("Reset Password", "{{{RESET_URL}}}") +
      p("If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.", { size: "13px", color: THEME.textMuted, margin: "0 0 16px" }) +
      p("If the button above doesn't work, copy and paste this link into your browser:", { size: "13px", color: THEME.textMuted, margin: "0 0 6px" }) +
      `<p style="word-break:break-all;font-size:12px;margin:0;"><a href="{{{RESET_URL}}}" style="color:${THEME.gold};">{{RESET_URL}}</a></p>`,
  }),
});

templates.push({
  key: "LOGIN_OTP",
  subject: "Your Lilycrest login verification code",
  variables: ["USER_NAME", "OTP_CODE", "EXPIRY_MINUTES"],
  html: shell({
    heading: "Login Verification",
    branchSubtitle: "",
    bodyHtml:
      p("Hi <strong>{{USER_NAME}}</strong>,") +
      p("Use this 6-digit code to finish signing in to your Lilycrest account.", { size: "14px" }) +
      `<div style="letter-spacing:8px;font-size:32px;font-weight:700;color:${THEME.textDark};background-color:${THEME.goldTint};border:1px solid #F3E4B0;border-radius:10px;padding:18px;text-align:center;margin:0 0 20px;">{{OTP_CODE}}</div>` +
      p("This code expires in {{EXPIRY_MINUTES}} minutes. If you did not request it, you can ignore this email.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
});

templates.push({
  key: "PASSWORD_CHANGED",
  subject: "Your Lilycrest password was changed",
  variables: ["USER_NAME", "TIMESTAMP", "IP_ADDRESS"],
  html: shell({
    heading: "Password Changed Successfully",
    branchSubtitle: "",
    bodyHtml:
      p("Hi <strong>{{USER_NAME}}</strong>,") +
      p("Your Lilycrest account password was <strong>successfully changed</strong>.", { size: "14px" }) +
      detailsPanel(row("Date &amp; Time", "{{TIMESTAMP}}") + row("IP Address", "{{IP_ADDRESS}}")) +
      `<div style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin:0;"><p style="margin:0;color:#991B1B;font-size:13px;line-height:1.5;"><strong>Didn't make this change?</strong> Your account may be compromised — reset your password immediately or contact Lilycrest support.</p></div>`,
  }),
});

templates.push({
  key: "INQUIRY_RESPONSE",
  subject: "New reply to #{{TICKET_ID}} | Lilycrest Dormitory",
  variables: ["CUSTOMER_NAME", "TICKET_ID", "INQUIRY_SUBJECT", "RESPONSE", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Hello {{CUSTOMER_NAME}}!",
    bodyHtml:
      p("Thank you for reaching out to us. We have reviewed your inquiry and here is our response:") +
      detailsPanel(row("Ticket ID", "#{{TICKET_ID}}")) +
      callout("Your Inquiry", "<em>{{INQUIRY_SUBJECT}}</em>") +
      callout("Our Response", "{{RESPONSE}}") +
      button("Open Inquiry", "https://www.lilycrest.space") +
      p("Open the tenant portal to continue this conversation or confirm whether your concern was resolved.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
});

templates.push({
  key: "RESERVATION_CONFIRMED",
  subject: "Reservation Confirmed — {{RESERVATION_CODE}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "RESERVATION_CODE", "ROOM_NAME", "BRANCH_NAME", "BRANCH_SUBTITLE", "MOVE_IN_DATE"],
  html: shell({
    heading: "Reservation Confirmed!",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your reservation has been confirmed. Here are your details:") +
      detailsPanel(
        row("Reservation Code", "{{RESERVATION_CODE}}") +
        row("Room", "{{ROOM_NAME}}") +
        row("Branch", "{{BRANCH_NAME}}") +
        row("Move-in Date", "{{MOVE_IN_DATE}}"),
      ) +
      button("View Reservation", "https://www.lilycrest.space/applicant/reservation") +
      p("Please arrive on your move-in date with your valid ID. If you have questions, contact us through the dormitory portal.", { size: "14px" }),
  }),
});

templates.push({
  key: "VISIT_APPROVED",
  subject: "Visit Schedule Confirmed — Continue Your Application | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Visit Schedule Confirmed",
    footerNote: "Lilycrest Dormitory Management System",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your physical visit schedule for <strong>{{BRANCH_NAME}}</strong> has been confirmed by our admin team.") +
      `<div style="background-color:${THEME.goldTint};border-left:4px solid ${THEME.gold};padding:14px 18px;border-radius:8px;margin:0 0 20px;text-align:center;"><p style="margin:0;font-size:14px;color:${THEME.goldDeep};font-weight:600;">Visit Schedule Confirmed — for viewing coordination only</p></div>` +
      p("Please continue your tenant application and document upload in the portal. Payment will only become available after your application and documents are approved.") +
      button("Continue Application", "https://www.lilycrest.space/applicant/reservation"),
  }),
});

templates.push({
  key: "VISIT_STATUS",
  subject: "{{STATUS_LABEL}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "ROOM_NAME", "BRANCH_NAME", "BRANCH_SUBTITLE", "VISIT_CODE", "VISIT_SCHEDULE", "PREVIOUS_SCHEDULE", "REMARKS", "STATUS_LABEL", "STATUS_INTRO", "NEXT_STEP"],
  html: shell({
    heading: "{{STATUS_LABEL}}",
    footerNote: "Lilycrest Dormitory Management System",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("{{STATUS_INTRO}}") +
      `<div style="background-color:${THEME.goldTint};border-left:4px solid ${THEME.gold};padding:14px 18px;border-radius:8px;margin:0 0 20px;text-align:center;"><p style="margin:0;font-size:14px;color:${THEME.goldDeep};font-weight:600;">{{STATUS_LABEL}}</p></div>` +
      detailsPanel(
        row("Room", "{{ROOM_NAME}}") +
        row("Branch", "{{BRANCH_NAME}}") +
        row("Visit Code", "{{VISIT_CODE}}") +
        row("Visit Schedule", "{{VISIT_SCHEDULE}}") +
        row("Previous Schedule", "{{PREVIOUS_SCHEDULE}}") +
        row("Remarks", "{{REMARKS}}"),
      ) +
      p("{{NEXT_STEP}}", { size: "14px" }) +
      button("View Application", "https://www.lilycrest.space/applicant/reservation") +
      p("Payment remains locked until your application and required documents are approved.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
  note: "PREVIOUS_SCHEDULE and REMARKS may arrive as empty strings — in Resend, leave the row visible (it will render blank) or use a conditional block ({{#if PREVIOUS_SCHEDULE}}...{{/if}}) if your Resend plan supports it.",
});

templates.push({
  key: "DOCUMENTS_REJECTED",
  subject: "Action Required: Documents Need Attention — Lilycrest Dormitory",
  variables: ["TENANT_NAME", "REJECTION_REASON", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Documents Need Attention",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("We reviewed your submitted documents and found an issue:") +
      callout("Reason", "{{REJECTION_REASON}}") +
      button("Review Documents", "https://www.lilycrest.space/applicant/reservation") +
      p("Please re-upload the requested documents. Your reservation will remain active.", { size: "14px" }),
  }),
});

templates.push({
  key: "BILL_GENERATED",
  subject: "{{BILL_TYPE_LABEL}} bill for {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILL_TYPE_LABEL", "ROOM_NAME", "BILLING_MONTH", "TOTAL_AMOUNT", "DUE_DATE", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "New Bill Generated",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your {{BILL_TYPE_LABEL}} bill has been generated:") +
      detailsPanel(
        row("Bill Type", "{{BILL_TYPE_LABEL}}") +
        row("Room / Bed", "{{ROOM_NAME}}") +
        row("Billing Month", "{{BILLING_MONTH}}") +
        row("Due Date", "{{DUE_DATE}}"),
      ) +
      statPanel("Total Amount", "&#8369;{{TOTAL_AMOUNT}}") +
      button("View Billing Statement", "https://www.lilycrest.space/applicant/billing") +
      p("Please log in to the dormitory portal to view the full breakdown and make your payment.", { size: "14px" }),
  }),
});

templates.push({
  key: "UTILITY_CHARGE",
  subject: "{{UTILITY_LABEL}} charge for {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "UTILITY_LABEL", "BILLING_MONTH", "UTILITY_AMOUNT", "TOTAL_AMOUNT", "DUE_DATE", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "{{UTILITY_LABEL}} Charge Available",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your {{UTILITY_LABEL}} charge for {{BILLING_MONTH}} is now available in the tenant portal.") +
      detailsPanel(row("{{UTILITY_LABEL}} Charge", "&#8369;{{UTILITY_AMOUNT}}") + row("Due Date", "{{DUE_DATE}}")) +
      statPanel("Current Bill Total", "&#8369;{{TOTAL_AMOUNT}}") +
      button("View Billing Statement", "https://www.lilycrest.space/applicant/billing") +
      p("Please log in to the dormitory portal to review the updated breakdown and complete payment.", { size: "14px" }),
  }),
});

templates.push({
  key: "PAYMENT_REMINDER",
  subject: "{{BILL_TYPE_LABEL}} Reminder — Due {{DUE_DATE}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILL_TYPE_LABEL", "BILLING_MONTH", "TOTAL_AMOUNT", "DUE_DATE", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Payment Reminder",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("This is a friendly reminder that your {{BILL_TYPE_LABEL}} payment is due soon.") +
      detailsPanel(row("Bill Type", "{{BILL_TYPE_LABEL}}") + row("Due Date", "{{DUE_DATE}}")) +
      statPanel("Amount Due", "&#8369;{{TOTAL_AMOUNT}}") +
      button("View Billing", "https://www.lilycrest.space/applicant/billing") +
      p("Please complete payment through the billing portal's online checkout to avoid late penalties.", { size: "14px" }),
  }),
});

templates.push({
  key: "OVERDUE_NOTICE",
  subject: "Overdue / Penalty Notice — {{BILL_TYPE_LABEL}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILL_TYPE_LABEL", "BILLING_MONTH", "DAYS_LATE", "TOTAL_AMOUNT", "PENALTY", "DUE_DATE", "REASON", "NOTICE_VARIANT", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Payment Overdue",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your {{BILL_TYPE_LABEL}} payment is <strong>{{DAYS_LATE}} day(s) overdue</strong>. Penalties are being applied.") +
      detailsPanel(
        row("Bill Type", "{{BILL_TYPE_LABEL}}") +
        row("Due Date", "{{DUE_DATE}}") +
        row("Days Overdue", "{{DAYS_LATE}}") +
        row("Reason", "{{REASON}}"),
      ) +
      statPanel("Total Amount (incl. penalty)", "&#8369;{{TOTAL_AMOUNT}}") +
      p("Includes &#8369;{{PENALTY}} in late penalties.", { size: "13px", color: THEME.goldDeep, margin: "0 0 16px" }) +
      button("View Billing", "https://www.lilycrest.space/applicant/billing") +
      p("Please settle your payment immediately to avoid further charges.", { size: "14px" }),
  }),
  note: "NOTICE_VARIANT is \"overdue\" or \"penalty\". If your Resend plan supports conditional blocks, use {{#if (eq NOTICE_VARIANT \"penalty\")}} to swap the heading to \"Penalty Notice\"; otherwise the generic \"Payment Overdue\" heading above covers both.",
});

templates.push({
  key: "PAYMENT_APPROVED",
  subject: "Payment Approved — {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILLING_MONTH", "PAID_AMOUNT", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Payment Approved!",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your payment of <strong>&#8369;{{PAID_AMOUNT}}</strong> for <strong>{{BILLING_MONTH}}</strong> has been verified and approved.") +
      p("Thank you for your prompt payment!") +
      button("View Billing", "https://www.lilycrest.space/applicant/billing"),
  }),
});

templates.push({
  key: "PAYMENT_REJECTED",
  subject: "Payment Proof Rejected — {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILLING_MONTH", "REJECTION_REASON", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Payment Proof Rejected",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your payment proof for <strong>{{BILLING_MONTH}}</strong> was reviewed and could not be accepted.") +
      callout("Reason", "{{REJECTION_REASON}}") +
      button("Review Billing", "https://www.lilycrest.space/applicant/billing") +
      p("Please complete payment using the billing portal's online checkout, or contact branch staff for assisted offline settlement.", { size: "14px" }),
  }),
});

templates.push({
  key: "PAYMENT_RECEIPT",
  subject: "Payment Receipt — &#8369;{{AMOUNT}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "AMOUNT", "DESCRIPTION", "BILLED_TO", "PAYMENT_METHOD", "PAYMENT_DATE", "REFERENCE_NUMBER", "RESERVATION_CODE", "ROOM_NAME", "BRANCH_NAME", "BRANCH_SUBTITLE"],
  html: shell({
    heading: "Payment Receipt",
    footerNote: "You're receiving this e-mail because you made a payment at Lilycrest Dormitory.",
    bodyHtml:
      p("Hi <strong>{{TENANT_NAME}}</strong>, thank you for your payment. Here's a copy of your receipt.") +
      statPanel("Amount Paid", "&#8369;{{AMOUNT}}") +
      detailsPanel(
        row("Description", "{{DESCRIPTION}}") +
        row("Billed to", "{{BILLED_TO}}") +
        row("Payment method", "{{PAYMENT_METHOD}}") +
        row("Date paid", "{{PAYMENT_DATE}}") +
        row("Reference", "{{REFERENCE_NUMBER}}") +
        row("Reservation code", "{{RESERVATION_CODE}}") +
        row("Room / Branch", "{{ROOM_NAME}}"),
      ) +
      button("View Billing", "https://www.lilycrest.space/applicant/billing") +
      p("If you have any questions about this payment, contact Lilycrest Dormitory through the tenant portal.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
});

// ─── Write output ───────────────────────────────────────────────────────────

for (const t of templates) {
  fs.writeFileSync(path.join(__dirname, `${t.key}.html`), t.html, "utf8");
}

const manifest = `# Resend Template Setup — Copy/Paste Manifest

Each ${templates.length}-template .html file in this folder is ready to paste directly into
**Resend Dashboard → Templates → Create Template → HTML**.

Resend merge tags use \`{{VARIABLE}}\` (HTML-escaped) or \`{{{VARIABLE}}}\` (raw, used
here only for URLs going into an \`href=\` so the link itself isn't
double-escaped). The variable names below match exactly what
server/services/email/resendEmailService.js sends — do not rename them in
the template.

The canonical existing Lilycrest logo is embedded from
\`https://www.lilycrest.space/lilycrest-logo.png\` (PUBLIC_LOGO_URL's default;
see server/config/publicUrls.js). Do not substitute logo512.png/logo192.png —
those are Create React App placeholder icons, not Lilycrest branding.

For each row below:
1. Open the .html file, paste its contents into a new Resend Template.
2. Set the Subject exactly as shown (Resend subjects also accept merge tags).
3. Save/publish the template, copy its Template ID.
4. Paste that ID into the matching Render env var.

| # | Template Key | .html file | Subject | Variables | Env Var |
|---|---|---|---|---|---|
${templates
  .map(
    (t, i) =>
      `| ${i + 1} | ${t.key} | \`${t.key}.html\` | ${t.subject.replace(/\|/g, "\\|")} | ${t.variables.join(", ")} | \`RESEND_TEMPLATE_${t.key}\` |`,
  )
  .join("\n")}

## Notes per template

${templates
  .filter((t) => t.note)
  .map((t) => `- **${t.key}**: ${t.note}`)
  .join("\n")}

## After setup

The repository-controlled inline shell is the authoritative default and still
delivers through Resend. Dashboard templates are an explicit operational
opt-in: publish every HTML file above, set every matching
\`RESEND_TEMPLATE_*\` ID, set \`RESEND_TEMPLATE_MODE=dashboard\`, then redeploy.
Do not enable Dashboard mode for a partial or stale template set.
`;

fs.writeFileSync(path.join(__dirname, "MANIFEST.md"), manifest, "utf8");

console.log(`Wrote ${templates.length} template HTML files + MANIFEST.md to ${__dirname}`);
