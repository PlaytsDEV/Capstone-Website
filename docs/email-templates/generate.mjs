// One-off generator: produces ready-to-paste HTML for every Resend Template
// referenced by server/services/email/templateRegistry.js, using the same
// white & gold Lilycrest visual system the pre-migration inline HTML used.
// Run: node docs/email-templates/generate.mjs
// Output: docs/email-templates/<KEY>.html (one file per template) + MANIFEST.md

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const THEME = {
  logo: "{{{LOGO_URL}}}",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  pageBg: "#f5f5f5",
  cardBg: "#ffffff",
  gold: "#c9a227",
  goldDeep: "#a9841f",
  goldAccent: "#d4af37",
  goldTint: "#faf6e8",
  goldTintBorder: "#e8d9a8",
  textDark: "#1F2937",
  textBody: "#555555",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
};

const shell = ({ heading, bodyHtml, branchVar = "{{BRANCH_NAME}}", footerNote = "This is an automated notification. Please do not reply directly to this email." }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;font-family:${THEME.fontFamily};background-color:${THEME.pageBg};">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;margin:0 auto;background-color:${THEME.cardBg};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:${THEME.cardBg};padding:30px 40px;text-align:center;border-bottom:3px solid ${THEME.goldAccent};">
              <h1 style="color:${THEME.gold};margin:0;font-size:28px;font-weight:600;">Lilycrest Dormitory</h1>
              <p style="color:${THEME.goldDeep};margin:10px 0 0;font-size:14px;">${branchVar} Branch</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 20px;">
              <h2 style="color:${THEME.textDark};margin:0;font-size:22px;font-weight:600;text-align:center;">${heading}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${THEME.goldTint};padding:25px 40px;text-align:center;border-top:1px solid ${THEME.goldTintBorder};">
              <p style="color:#888888;font-size:14px;margin:0 0 10px;">Best regards,<br><strong style="color:#b8933f;">Lilycrest Dormitory Team</strong></p>
              <p style="color:${THEME.textFaint};font-size:12px;margin:15px 0 0;">${footerNote}</p>
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
  `<div style="text-align:center;margin:28px 0;"><a href="${urlVar}" style="display:inline-block;background:${THEME.gold};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">${label}</a></div>`;

const detailsPanel = (rows) =>
  `<div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:8px;padding:18px 20px;margin:0 0 20px;"><table style="width:100%;border-collapse:collapse;">${rows}</table></div>`;

const row = (label, valueVar) =>
  `<tr><td style="padding:6px 0;color:${THEME.goldDeep};font-size:13px;">${label}</td><td style="padding:6px 0;color:${THEME.textDark};font-size:13px;font-weight:600;text-align:right;">${valueVar}</td></tr>`;

const statPanel = (label, valueVar) => `
  <div style="background-color:${THEME.goldTint};border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
    <p style="color:${THEME.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${label}</p>
    <p style="color:#B8860B;font-size:28px;font-weight:700;margin:0;">${valueVar}</p>
  </div>`;

const callout = (label, contentVar) => `
  <div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-left:4px solid ${THEME.goldAccent};padding:18px 20px;margin:0 0 20px;border-radius:0 8px 8px 0;">
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
    branchVar: "Lilycrest",
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
    branchVar: "Lilycrest",
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
    branchVar: "Lilycrest",
    bodyHtml:
      p("Hi <strong>{{USER_NAME}}</strong>,") +
      p("Use this 6-digit code to finish signing in to your Lilycrest account.", { size: "14px" }) +
      `<div style="letter-spacing:8px;font-size:32px;font-weight:700;color:${THEME.textDark};background:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:10px;padding:18px;text-align:center;margin:0 0 20px;">{{OTP_CODE}}</div>` +
      p("This code expires in {{EXPIRY_MINUTES}} minutes. If you did not request it, you can ignore this email.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
});

templates.push({
  key: "PASSWORD_CHANGED",
  subject: "Your Lilycrest password was changed",
  variables: ["USER_NAME", "TIMESTAMP", "IP_ADDRESS"],
  html: shell({
    heading: "Password Changed Successfully",
    branchVar: "Lilycrest",
    bodyHtml:
      p("Hi <strong>{{USER_NAME}}</strong>,") +
      p("Your Lilycrest account password was <strong>successfully changed</strong>.", { size: "14px" }) +
      detailsPanel(row("Date &amp; Time", "{{TIMESTAMP}}") + row("IP Address", "{{IP_ADDRESS}}")) +
      `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin:0;"><p style="margin:0;color:#991B1B;font-size:13px;line-height:1.5;"><strong>Didn't make this change?</strong> Your account may be compromised — reset your password immediately or contact Lilycrest support.</p></div>`,
  }),
});

templates.push({
  key: "INQUIRY_RESPONSE",
  subject: "Re: Your Inquiry - Lilycrest Dormitory",
  variables: ["CUSTOMER_NAME", "INQUIRY_SUBJECT", "RESPONSE", "BRANCH_NAME"],
  html: shell({
    heading: "Hello {{CUSTOMER_NAME}}!",
    bodyHtml:
      p("Thank you for reaching out to us. We have reviewed your inquiry and here is our response:") +
      callout("Your Inquiry", "<em>{{INQUIRY_SUBJECT}}</em>") +
      callout("Our Response", "{{RESPONSE}}") +
      p("If you have any further questions, feel free to submit another inquiry through our website.", { margin: "20px 0 0" }),
  }),
});

templates.push({
  key: "RESERVATION_CONFIRMED",
  subject: "Reservation Confirmed — {{RESERVATION_CODE}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "RESERVATION_CODE", "ROOM_NAME", "BRANCH_NAME", "MOVE_IN_DATE"],
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
      p("Please arrive on your move-in date with your valid ID. If you have questions, contact us through the dormitory portal.", { size: "14px" }),
  }),
});

templates.push({
  key: "VISIT_APPROVED",
  subject: "Visit Schedule Confirmed — Continue Your Application | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BRANCH_NAME"],
  html: shell({
    heading: "Visit Schedule Confirmed",
    footerNote: "Lilycrest Dormitory Management System",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your physical visit schedule for <strong>{{BRANCH_NAME}}</strong> has been confirmed by our admin team.") +
      `<div style="background-color:${THEME.goldTint};border-left:4px solid ${THEME.goldAccent};padding:14px 18px;border-radius:8px;margin:0 0 20px;text-align:center;"><p style="margin:0;font-size:14px;color:${THEME.goldDeep};font-weight:600;">Visit Schedule Confirmed — for viewing coordination only</p></div>` +
      p("Please continue your tenant application and document upload in the portal. Payment will only become available after your application and documents are approved."),
  }),
});

templates.push({
  key: "VISIT_STATUS",
  subject: "{{STATUS_LABEL}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "ROOM_NAME", "BRANCH_NAME", "VISIT_CODE", "VISIT_SCHEDULE", "PREVIOUS_SCHEDULE", "REMARKS", "STATUS_LABEL", "STATUS_INTRO", "NEXT_STEP"],
  html: shell({
    heading: "{{STATUS_LABEL}}",
    footerNote: "Lilycrest Dormitory Management System",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("{{STATUS_INTRO}}") +
      `<div style="background-color:${THEME.goldTint};border-left:4px solid ${THEME.goldAccent};padding:14px 18px;border-radius:8px;margin:0 0 20px;text-align:center;"><p style="margin:0;font-size:14px;color:${THEME.goldDeep};font-weight:600;">{{STATUS_LABEL}}</p></div>` +
      detailsPanel(
        row("Room", "{{ROOM_NAME}}") +
        row("Branch", "{{BRANCH_NAME}}") +
        row("Visit Code", "{{VISIT_CODE}}") +
        row("Visit Schedule", "{{VISIT_SCHEDULE}}") +
        row("Previous Schedule", "{{PREVIOUS_SCHEDULE}}") +
        row("Remarks", "{{REMARKS}}"),
      ) +
      p("{{NEXT_STEP}}", { size: "14px" }) +
      p("Payment remains locked until your application and required documents are approved.", { size: "13px", color: THEME.textMuted, margin: "0" }),
  }),
  note: "PREVIOUS_SCHEDULE and REMARKS may arrive as empty strings — in Resend, leave the row visible (it will render blank) or use a conditional block ({{#if PREVIOUS_SCHEDULE}}...{{/if}}) if your Resend plan supports it.",
});

templates.push({
  key: "DOCUMENTS_REJECTED",
  subject: "Action Required: Documents Need Attention — Lilycrest Dormitory",
  variables: ["TENANT_NAME", "REJECTION_REASON", "BRANCH_NAME"],
  html: shell({
    heading: "Documents Need Attention",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("We reviewed your submitted documents and found an issue:") +
      callout("Reason", "{{REJECTION_REASON}}") +
      p("Please log in to the dormitory portal and re-upload your documents. Your reservation will remain active.", { size: "14px" }),
  }),
});

templates.push({
  key: "BILL_GENERATED",
  subject: "{{BILL_TYPE_LABEL}} bill for {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILL_TYPE_LABEL", "ROOM_NAME", "BILLING_MONTH", "TOTAL_AMOUNT", "DUE_DATE", "BRANCH_NAME"],
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
      p("Please log in to the dormitory portal to view the full breakdown and make your payment.", { size: "14px" }),
  }),
});

templates.push({
  key: "UTILITY_CHARGE",
  subject: "{{UTILITY_LABEL}} charge for {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "UTILITY_LABEL", "BILLING_MONTH", "UTILITY_AMOUNT", "TOTAL_AMOUNT", "DUE_DATE", "BRANCH_NAME"],
  html: shell({
    heading: "{{UTILITY_LABEL}} Charge Available",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your {{UTILITY_LABEL}} charge for {{BILLING_MONTH}} is now available in the tenant portal.") +
      detailsPanel(row("{{UTILITY_LABEL}} Charge", "&#8369;{{UTILITY_AMOUNT}}") + row("Due Date", "{{DUE_DATE}}")) +
      statPanel("Current Bill Total", "&#8369;{{TOTAL_AMOUNT}}") +
      p("Please log in to the dormitory portal to review the updated breakdown and complete payment.", { size: "14px" }),
  }),
});

templates.push({
  key: "PAYMENT_REMINDER",
  subject: "{{BILL_TYPE_LABEL}} Reminder — Due {{DUE_DATE}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILL_TYPE_LABEL", "BILLING_MONTH", "TOTAL_AMOUNT", "DUE_DATE", "BRANCH_NAME"],
  html: shell({
    heading: "Payment Reminder",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("This is a friendly reminder that your {{BILL_TYPE_LABEL}} payment is due soon.") +
      detailsPanel(row("Bill Type", "{{BILL_TYPE_LABEL}}") + row("Due Date", "{{DUE_DATE}}")) +
      statPanel("Amount Due", "&#8369;{{TOTAL_AMOUNT}}") +
      p("Please complete payment through the billing portal's online checkout to avoid late penalties.", { size: "14px" }),
  }),
});

templates.push({
  key: "OVERDUE_NOTICE",
  subject: "Overdue / Penalty Notice — {{BILL_TYPE_LABEL}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILL_TYPE_LABEL", "BILLING_MONTH", "DAYS_LATE", "TOTAL_AMOUNT", "PENALTY", "DUE_DATE", "REASON", "NOTICE_VARIANT", "BRANCH_NAME"],
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
      p("Please settle your payment immediately to avoid further charges.", { size: "14px" }),
  }),
  note: "NOTICE_VARIANT is \"overdue\" or \"penalty\". If your Resend plan supports conditional blocks, use {{#if (eq NOTICE_VARIANT \"penalty\")}} to swap the heading to \"Penalty Notice\"; otherwise the generic \"Payment Overdue\" heading above covers both.",
});

templates.push({
  key: "PAYMENT_APPROVED",
  subject: "Payment Approved — {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILLING_MONTH", "PAID_AMOUNT", "BRANCH_NAME"],
  html: shell({
    heading: "Payment Approved!",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your payment of <strong>&#8369;{{PAID_AMOUNT}}</strong> for <strong>{{BILLING_MONTH}}</strong> has been verified and approved.") +
      p("Thank you for your prompt payment!"),
  }),
});

templates.push({
  key: "PAYMENT_REJECTED",
  subject: "Payment Proof Rejected — {{BILLING_MONTH}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "BILLING_MONTH", "REJECTION_REASON", "BRANCH_NAME"],
  html: shell({
    heading: "Payment Proof Rejected",
    bodyHtml:
      p("Hello <strong>{{TENANT_NAME}}</strong>,") +
      p("Your payment proof for <strong>{{BILLING_MONTH}}</strong> was reviewed and could not be accepted.") +
      callout("Reason", "{{REJECTION_REASON}}") +
      p("Please complete payment using the billing portal's online checkout, or contact branch staff for assisted offline settlement.", { size: "14px" }),
  }),
});

templates.push({
  key: "PAYMENT_RECEIPT",
  subject: "Payment Receipt — &#8369;{{AMOUNT}} | Lilycrest Dormitory",
  variables: ["TENANT_NAME", "AMOUNT", "DESCRIPTION", "BILLED_TO", "PAYMENT_METHOD", "PAYMENT_DATE", "REFERENCE_NUMBER", "RESERVATION_CODE", "ROOM_NAME", "BRANCH_NAME"],
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

Before creating templates, first set \`LOGO_URL\` — replace the literal
\`{{{LOGO_URL}}}\` placeholder in each HTML file with the real Lilycrest
logo URL: \`https://www.lilycrest.space/lilycrest-logo.png\` (matches
PUBLIC_LOGO_URL's default — see server/config/publicUrls.js), or leave it
as a merge tag and pass LOGO_URL as an extra variable if you'd rather not
hardcode it. Do not use logo512.png/logo192.png — those are Create React
App's generic placeholder icons, not Lilycrest branding.

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

Once every \`RESEND_TEMPLATE_*\` env var is set on Render, redeploy — production
startup validation will stop warning about missing templates
(server/config/startupValidation.js), and every email type will start
delivering through Resend.
`;

fs.writeFileSync(path.join(__dirname, "MANIFEST.md"), manifest, "utf8");

console.log(`Wrote ${templates.length} template HTML files + MANIFEST.md to ${__dirname}`);
