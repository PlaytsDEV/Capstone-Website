/**
 * =============================================================================
 * EMAIL SERVICE CONFIGURATION
 * =============================================================================
 *
 * Nodemailer configuration for sending emails to customers.
 * Uses Gmail SMTP with App Password for authentication.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to your Google Account settings
 * 2. Enable 2-Factor Authentication
 * 3. Go to Security > App passwords
 * 4. Generate a new app password for "Mail"
 * 5. Add the credentials to your .env file:
 *    - EMAIL_USER=your-gmail@gmail.com
 *    - EMAIL_PASSWORD=your-app-password (16 characters, no spaces)
 *
 * All templates below share a single visual system (white & gold) via
 * `renderEmailShell()` and the small set of content-box helpers beneath it.
 * To change the brand look (colors, logo, footer), edit THEME once —
 * every email in this file inherits it.
 *
 * =============================================================================
 */

import nodemailer from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// =============================================================================
// TRANSPORTER CONFIGURATION
// =============================================================================

const resolveEmailConfig = () => {
  const user = String(process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
  const pass = String(process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || "").trim();
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" ||
    port === 465;

  if (!process.env.EMAIL_USER && user) process.env.EMAIL_USER = user;
  if (!process.env.EMAIL_PASSWORD && pass) process.env.EMAIL_PASSWORD = pass;

  return { user, pass, host, port, secure };
};

const emailConfig = resolveEmailConfig();
const transporterOptions = emailConfig.host
  ? {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    }
  : {
      service: "gmail",
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    };

const transporter = nodemailer.createTransport(transporterOptions);

const isEmailConfigured = Boolean(emailConfig.user && emailConfig.pass);

console.log("[EMAIL CONFIG]", {
  configured: isEmailConfigured,
  host: emailConfig.host || "gmail (service)",
  port: emailConfig.port,
  secure: emailConfig.secure,
});

if (!isEmailConfigured || process.env.NODE_ENV === "test") {
  transporter.verify = () => {};
}

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.log("[EMAIL CONFIG] SMTP verification failed", safeEmailFailure(error));
    console.log("[EMAIL CONFIG] Set EMAIL_USER/EMAIL_PASSWORD or SMTP_USER/SMTP_PASS to enable emails.");
  } else {
    console.log("[EMAIL CONFIG] SMTP connection verified and ready.", {
      host: emailConfig.host || "gmail",
    });
  }
});

// =============================================================================
// RESEND — OTP EMAIL TRANSPORT
// =============================================================================

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const OTP_FROM = String(process.env.RESEND_FROM_EMAIL || "").trim();

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

if (resendClient && OTP_FROM) {
  console.log("[EMAIL CONFIG] Resend OTP transport configured.");
} else {
  if (!RESEND_API_KEY) console.log("[EMAIL CONFIG] RESEND_API_KEY not set — OTP email will fail.");
  if (!OTP_FROM) console.log("[EMAIL CONFIG] RESEND_FROM_EMAIL not set — OTP email will fail.");
}

// =============================================================================
// SHARED HELPERS
// =============================================================================

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const emailFingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value || "").trim().toLowerCase())
    .digest("hex")
    .slice(0, 12);

function safeEmailFailure(error) {
  return {
    category: /timeout|timed out|etimedout/i.test(String(error?.code || error?.name || ""))
      ? "timeout"
      : "unknown",
    statusCode: Number(error?.statusCode || error?.status || 0) || null,
  };
}

const formatVisitScheduleLabel = (visitDate, visitTime) => {
  const hasDate = Boolean(visitDate);
  const dateLabel = hasDate
    ? new Date(visitDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "TBD";

  return visitTime ? `${dateLabel} at ${visitTime}` : dateLabel;
};

/**
 * Safe peso formatter — avoids toLocaleString("en-PH") which garbles output
 * in Node.js environments without full ICU data (outputs Unicode separators
 * that email clients render as garbage like "±& &2&,&0&0&0&.&0&0").
 */
const fmtPeso = (n) => {
  const fixed = Number(n || 0).toFixed(2);
  const [int, dec] = fixed.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas}.${dec}`;
};

// =============================================================================
// BRAND THEME — WHITE & GOLD (single source of truth for every template)
// =============================================================================

const THEME = {
  logo: "https://www.lilycrest.space/assets/LOGO-8Ay0b2-y.svg",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  pageBg: "#f5f5f5",
  cardBg: "#ffffff",
  gold: "#c9a227", // headline / emphasis gold
  goldDeep: "#a9841f", // subheads, footer strong text
  goldAccent: "#d4af37", // borders / rules
  goldTint: "#faf6e8", // soft gold panel background
  goldTintBorder: "#e8d9a8", // panel border
  goldIconBg: "#fdf6e3", // icon circle background
  textDark: "#1F2937",
  textBody: "#555555",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
};

/**
 * Icon library — each icon is a small PNG rasterized from a gold line-art
 * SVG and embedded as a base64 data URI <img>. Raw inline <svg> tags get
 * stripped by Gmail and most mail clients as a security precaution, so a
 * real <img> tag (even a base64 one) is what actually renders in the inbox.
 */
const renderEmailShell = ({
  title,
  branchName = "Lilycrest",
  heading,
  bodyHtml,
  footerNote = "This is an automated notification. Please do not reply directly to this email.",
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || heading || "Lilycrest Dormitory")}</title>
</head>
<body style="margin:0;padding:0;font-family:${THEME.fontFamily};background-color:${THEME.pageBg};">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;margin:0 auto;background-color:${THEME.cardBg};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:${THEME.cardBg};padding:30px 40px;text-align:center;border-bottom:3px solid ${THEME.goldAccent};">
              <img src="${THEME.logo}" alt="Lilycrest Dormitory Logo" width="160"
                   style="display:block;margin:0 auto 16px;max-width:160px;height:auto;">
              <h1 style="color:${THEME.gold};margin:0;font-size:28px;font-weight:600;">Lilycrest Dormitory</h1>
              <p style="color:${THEME.goldDeep};margin:10px 0 0;font-size:14px;">${escapeHtml(branchName)} Branch</p>
            </td>
          </tr>
          <!-- Heading -->
          <tr>
            <td style="padding:40px 40px 20px;">
              ${heading ? `<h2 style="color:${THEME.textDark};margin:0;font-size:22px;font-weight:600;text-align:center;">${escapeHtml(heading)}</h2>` : ""}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${THEME.goldTint};padding:25px 40px;text-align:center;border-top:1px solid ${THEME.goldTintBorder};">
              <p style="color:#888888;font-size:14px;margin:0 0 10px;">
                Best regards,<br>
                <strong style="color:#b8933f;">Lilycrest Dormitory Team</strong>
              </p>
              <p style="color:${THEME.textFaint};font-size:12px;margin:15px 0 0;">
                ${escapeHtml(footerNote)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/** Standard paragraph */
const p = (text, opts = {}) =>
  `<p style="color:${opts.color || THEME.textBody};font-size:${opts.size || "16px"};line-height:1.6;margin:${opts.margin || "0 0 16px"};">${text}</p>`;

/** Gold-tinted callout / quote box (left gold border) */
const goldCallout = ({ label, content }) => `
  <div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-left:4px solid ${THEME.goldAccent};padding:18px 20px;margin:0 0 20px;border-radius:0 8px 8px 0;">
    ${label ? `<p style="color:${THEME.goldDeep};font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${escapeHtml(label)}</p>` : ""}
    <p style="color:${THEME.textDark};font-size:14px;margin:0;line-height:1.7;white-space:pre-wrap;">${content}</p>
  </div>
`;

/** Gold key/value row inside a details panel */
const goldRow = (label, value) => `
  <tr>
    <td style="padding:6px 0;color:${THEME.goldDeep};font-size:13px;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:${THEME.textDark};font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>
`;

/** Panel that wraps a set of goldRow entries */
const goldDetailsPanel = (rowsHtml) => `
  <div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:8px;padding:18px 20px;margin:0 0 20px;">
    <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
  </div>
`;

/** Large centered amount / stat highlight (e.g. total due, amount paid) */
const goldStat = ({ label, value, emphasis = false }) => `
  <p style="color:${THEME.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${escapeHtml(label)}</p>
  <p style="color:${emphasis ? "#B8860B" : THEME.textDark};font-size:${emphasis ? "28px" : "16px"};font-weight:700;margin:0 0 16px;">${value}</p>
`;

/** Centered stat panel container */
const goldStatPanel = (innerHtml) => `
  <div style="background-color:${THEME.goldTint};border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
    ${innerHtml}
  </div>
`;

/** Status badge used across notice-style emails */
const goldBadge = (text) => `
  <div style="background-color:${THEME.goldTint};border-left:4px solid ${THEME.goldAccent};padding:14px 18px;border-radius:8px;margin:0 0 20px;text-align:center;">
    <p style="margin:0;font-size:14px;color:${THEME.goldDeep};font-weight:600;">${escapeHtml(text)}</p>
  </div>
`;

// =============================================================================
// INQUIRY RESPONSE EMAIL
// =============================================================================

const generateInquiryResponseEmail = (customerName, inquirySubject, response, branchName) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(customerName)}</strong>, thank you for reaching out to us. We have reviewed your inquiry and here is our response:`)}
    ${goldCallout({ label: "Your Inquiry", content: `<em>${escapeHtml(inquirySubject)}</em>` })}
    ${goldCallout({ label: "Our Response", content: escapeHtml(response) })}
    ${p("If you have any further questions, feel free to submit another inquiry through our website.", { margin: "20px 0 0" })}
  `;
  return renderEmailShell({
    title: "Lilycrest Dormitory - Response to Your Inquiry",
    branchName,
    heading: `Hello ${escapeHtml(customerName)}!`,
    bodyHtml,
    footerNote: "This is an automated response. Please do not reply directly to this email.",
  });
};

export const sendInquiryResponseEmail = async ({
  to,
  customerName,
  inquirySubject,
  response,
  branchName = "Lilycrest",
}) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log("⚠️ Email not sent - EMAIL_USER and EMAIL_PASSWORD not configured");
    return { success: false, message: "Email service not configured" };
  }
  const mailOptions = {
    from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
    to,
    subject: `Re: Your Inquiry - Lilycrest Dormitory ${branchName}`,
    html: generateInquiryResponseEmail(customerName, inquirySubject, response, branchName),
    text: `Hello ${customerName}!\n\nThank you for reaching out to us. We have reviewed your inquiry and here is our response:\n\nYour Inquiry:\n${inquirySubject}\n\nOur Response:\n${response}\n\nIf you have any further questions, feel free to submit another inquiry through our website.\n\nBest regards,\nLilycrest Dormitory Team`,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// RESERVATION CONFIRMED EMAIL
// =============================================================================

const generateReservationConfirmedEmail = (tenantName, reservationCode, roomName, branchName, moveInDate) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p("Your reservation has been confirmed. Here are your details:")}
    ${goldDetailsPanel(
      goldRow("Reservation Code", escapeHtml(reservationCode)) +
      goldRow("Room", escapeHtml(roomName)) +
      goldRow("Branch", escapeHtml(branchName)) +
      goldRow("Move-in Date", escapeHtml(moveInDate))
    )}
    ${p("Please arrive on your move-in date with your valid ID. If you have questions, contact us through the dormitory portal.", { size: "14px" })}
  `;
  return renderEmailShell({
    title: "Reservation Confirmed - Lilycrest Dormitory",
    branchName,
    heading: "Reservation Confirmed!",
    bodyHtml,
  });
};

export const sendReservationConfirmedEmail = async ({
  to,
  tenantName,
  reservationCode,
  roomName,
  branchName,
  moveInDate,
  checkInDate,
}) => {
  const moveInDateLabel = moveInDate || checkInDate || "TBD";
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log("⚠️ Email not sent — not configured");
    return { success: false, message: "Email service not configured" };
  }
  const mailOptions = {
    from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
    to,
    subject: `Reservation Confirmed — ${reservationCode} | Lilycrest Dormitory`,
    html: generateReservationConfirmedEmail(tenantName, reservationCode, roomName, branchName, moveInDateLabel),
    text: `Hello ${tenantName}, your reservation (${reservationCode}) for ${roomName} at ${branchName} has been confirmed. Move-in: ${moveInDateLabel}. — Lilycrest Dormitory`,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Reservation email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Reservation email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// VISIT APPROVED EMAIL
// =============================================================================

const generateVisitApprovedEmailHtml = (tenantName, branchName) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(`Your physical visit schedule for <strong>${escapeHtml(branchName)}</strong> has been confirmed by our admin team.`)}
    ${goldBadge("Visit Schedule Confirmed — for viewing coordination only")}
    ${p("Please continue your tenant application and document upload in the portal. Payment will only become available after your application and documents are approved.", { margin: "0 0 8px" })}
  `;
  return renderEmailShell({
    title: "Visit Schedule Confirmed - Lilycrest Dormitory",
    branchName,
    heading: "Visit Schedule Confirmed",
    bodyHtml,
    footerNote: "Lilycrest Dormitory Management System",
  });
};

export const sendVisitApprovedEmail = async ({ to, tenantName, branchName }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log("⚠️ Email not sent — not configured");
    return { success: false, message: "Email service not configured" };
  }
  const mailOptions = {
    from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
    to,
    subject: "Visit Schedule Confirmed — Continue Your Application | Lilycrest Dormitory",
    html: generateVisitApprovedEmailHtml(tenantName, branchName),
    text: `Hello ${tenantName}, your physical visit schedule for ${branchName} has been confirmed for viewing coordination only. Please continue your tenant application and document upload. Payment will only be available after your application and documents are approved. — Lilycrest Dormitory`,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Visit approval email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Visit approval email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// PHYSICAL VISIT STATUS EMAIL (scheduled / rescheduled / completed / no-show / cancelled / allowed)
// =============================================================================

const VISIT_STATUS_MAP = {
  scheduled: {
    subject: "Physical Visit Scheduled",
    badge: "Physical Visit Scheduled",
    intro: "Your physical visit schedule has been recorded as a room-viewing appointment.",
    nextStep:
      "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
  },
  rescheduled: {
    subject: "Physical Visit Rescheduled",
    badge: "Physical Visit Rescheduled",
    intro: "Your physical visit schedule has been updated by our admin team.",
    nextStep:
      "Your tenant application remains locked until your visit is completed or admin allows you to proceed without a completed visit.",
  },
  visit_completed: {
    subject: "Physical Visit Completed",
    badge: "Physical Visit Completed",
    intro: "Your physical visit has been recorded as completed.",
    nextStep:
      "You may now continue to your tenant application. Payment will remain locked until your application and required documents are approved.",
  },
  no_show: {
    subject: "Missed Physical Visit",
    badge: "Missed Physical Visit",
    intro: "Your scheduled physical visit was marked as a no-show.",
    nextStep: "Please reschedule your visit or contact admin before continuing. Your tenant application remains locked.",
  },
  visit_cancelled: {
    subject: "Physical Visit Cancelled",
    badge: "Physical Visit Cancelled",
    intro: "Only your physical visit schedule was cancelled. Your reservation itself remains active.",
    nextStep:
      "Please contact admin or select another allowed next step. Your tenant application remains locked unless admin separately allows you to proceed without a visit.",
  },
  allowed_without_visit: {
    subject: "You May Continue Your Tenant Application",
    badge: "Application Access Granted",
    intro: "Admin has allowed you to continue without a completed physical visit.",
    nextStep:
      "You may now complete your tenant application. Payment will remain locked until your application and required documents are approved.",
  },
};

const getPhysicalVisitEmailContent = ({
  status,
  tenantName,
  roomName,
  branchName,
  visitCode,
  visitDate,
  visitTime,
  previousVisitDate,
  previousVisitTime,
  remarks,
}) => {
  const safeTenantName = escapeHtml(tenantName || "Applicant");
  const safeRoomName = escapeHtml(roomName || "your room");
  const safeBranchName = escapeHtml(branchName || "Lilycrest");
  const safeVisitCode = escapeHtml(visitCode || "Pending");
  const safeRemarks = escapeHtml(remarks || "");
  const scheduleLabel = escapeHtml(formatVisitScheduleLabel(visitDate, visitTime));
  const previousScheduleLabel =
    previousVisitDate || previousVisitTime ? escapeHtml(formatVisitScheduleLabel(previousVisitDate, previousVisitTime)) : "";

  const content = VISIT_STATUS_MAP[status] || VISIT_STATUS_MAP.scheduled;

  const detailsRows =
    goldRow("Room", safeRoomName) +
    goldRow("Branch", safeBranchName) +
    goldRow("Visit Code", safeVisitCode) +
    goldRow("Visit Schedule", scheduleLabel) +
    (previousScheduleLabel ? goldRow("Previous Schedule", previousScheduleLabel) : "") +
    (safeRemarks ? goldRow("Remarks", safeRemarks) : "");

  const bodyHtml = `
    ${p(`Hello <strong>${safeTenantName}</strong>,`)}
    ${p(content.intro)}
    ${goldBadge(content.badge)}
    ${goldDetailsPanel(detailsRows)}
    ${p(content.nextStep, { size: "14px" })}
    ${p("Payment remains locked until your application and required documents are approved.", { size: "13px", color: THEME.textMuted, margin: "0" })}
  `;

  const html = renderEmailShell({
    title: content.subject,
    branchName,
    heading: content.subject,
    bodyHtml,
    footerNote: "Lilycrest Dormitory Management System",
  });

  const text = [
    `Hello ${tenantName || "Applicant"},`,
    "",
    content.intro,
    `Room: ${roomName || "your room"}`,
    `Branch: ${branchName || "Lilycrest"}`,
    `Visit Code: ${visitCode || "Pending"}`,
    `Visit Schedule: ${formatVisitScheduleLabel(visitDate, visitTime)}`,
    previousScheduleLabel ? `Previous Schedule: ${formatVisitScheduleLabel(previousVisitDate, previousVisitTime)}` : "",
    remarks ? `Remarks: ${remarks}` : "",
    "",
    content.nextStep,
    "Payment remains locked until your application and required documents are approved.",
    "",
    "Lilycrest Dormitory",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: content.subject, html, text };
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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log("Email not sent - not configured");
    return { success: false, message: "Email service not configured" };
  }

  const content = getPhysicalVisitEmailContent({
    status,
    tenantName,
    roomName,
    branchName,
    visitCode,
    visitDate,
    visitTime,
    previousVisitDate,
    previousVisitTime,
    remarks,
  });

  const mailOptions = {
    from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
    to,
    subject: `${content.subject} | Lilycrest Dormitory`,
    html: content.html,
    text: content.text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Visit status email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Visit status email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// DOCUMENTS REJECTED EMAIL
// =============================================================================

const generateDocumentsRejectedEmail = (tenantName, rejectionReason, branchName) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p("We reviewed your submitted documents and found an issue:")}
    ${goldCallout({ label: "Reason", content: escapeHtml(rejectionReason) })}
    ${p("Please log in to the dormitory portal and re-upload your documents. Your reservation will remain active.", { size: "14px" })}
  `;
  return renderEmailShell({
    title: "Documents Need Attention - Lilycrest Dormitory",
    branchName,
    heading: "Documents Need Attention",
    bodyHtml,
  });
};

export const sendDocumentsRejectedEmail = async ({ to, tenantName, rejectionReason, branchName = "Lilycrest" }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { success: false, message: "Email service not configured" };
  }
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: "Action Required: Documents Need Attention — Lilycrest Dormitory",
      html: generateDocumentsRejectedEmail(tenantName, rejectionReason, branchName),
      text: `Hello ${tenantName}, your documents need attention. Reason: ${rejectionReason}. Please log in and re-upload. — Lilycrest Dormitory`,
    });
    console.log("✅ Document rejection email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Document rejection email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// BILL GENERATED EMAIL
// =============================================================================

const generateBillGeneratedEmail = ({ tenantName, billTypeLabel, roomName, billingMonth, totalAmount, dueDate, branchName }) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(`Your ${billTypeLabel.toLowerCase()} bill has been generated:`)}
    ${goldStatPanel(
      goldStat({ label: "Bill Type", value: escapeHtml(billTypeLabel) }) +
      (roomName ? goldStat({ label: "Room / Bed", value: escapeHtml(roomName) }) : "") +
      goldStat({ label: "Billing Month", value: escapeHtml(billingMonth) }) +
      goldStat({ label: "Total Amount", value: `&#8369;${fmtPeso(totalAmount)}`, emphasis: true }) +
      goldStat({ label: "Due Date", value: escapeHtml(dueDate) })
    )}
    ${p("Please log in to the dormitory portal to view the full breakdown and make your payment. If you use bank transfer, proof of payment may be required by branch staff before the payment is considered settled.", { size: "14px" })}
  `;
  return renderEmailShell({
    title: "New Bill Generated - Lilycrest Dormitory",
    branchName,
    heading: "New Bill Generated",
    bodyHtml,
  });
};

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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { success: false, message: "Email service not configured" };
  }
  const normalizedBillType = String(billType || "bill").trim().toLowerCase();
  const billTypeLabel =
    normalizedBillType === "rent"
      ? "Monthly Rent"
      : normalizedBillType === "initial_payment"
        ? "Initial Payment"
        : normalizedBillType.charAt(0).toUpperCase() + normalizedBillType.slice(1);
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: `${billTypeLabel} bill for ${billingMonth} | Lilycrest Dormitory`,
      html: generateBillGeneratedEmail({ tenantName, billTypeLabel, roomName, billingMonth, totalAmount, dueDate, branchName }),
      text: `Hello ${tenantName}, your ${billTypeLabel} bill for ${billingMonth} is PHP ${totalAmount}. Due: ${dueDate}. Log in and continue to PayMongo to complete payment. - Lilycrest Dormitory`,
    });
    console.log("✅ Bill email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Bill email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// UTILITY CHARGE AVAILABLE EMAIL
// =============================================================================

const generateUtilityChargeEmail = ({ tenantName, utilityLabel, billingMonth, utilityAmount, totalAmount, dueDate, branchName }) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(`Your ${utilityLabel.toLowerCase()} charge for ${escapeHtml(billingMonth)} is now available in the tenant portal.`)}
    ${goldStatPanel(
      goldStat({ label: `${utilityLabel} Charge`, value: `&#8369;${fmtPeso(utilityAmount)}` }) +
      goldStat({ label: "Current Bill Total", value: `&#8369;${fmtPeso(totalAmount)}`, emphasis: true }) +
      goldStat({ label: "Due Date", value: escapeHtml(dueDate) })
    )}
    ${p("Please log in to the dormitory portal to review the updated breakdown and complete payment.", { size: "14px" })}
  `;
  return renderEmailShell({
    title: `${utilityLabel} Charge Available - Lilycrest Dormitory`,
    branchName,
    heading: `${utilityLabel} Charge Available`,
    bodyHtml,
  });
};

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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { success: false, message: "Email service not configured" };
  }
  const utilityLabel = utilityType === "water" ? "Water" : "Electricity";
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: `${utilityLabel} charge for ${billingMonth} | Lilycrest Dormitory`,
      html: generateUtilityChargeEmail({ tenantName, utilityLabel, billingMonth, utilityAmount, totalAmount, dueDate, branchName }),
      text: `Hello ${tenantName}, your ${utilityLabel.toLowerCase()} charge for ${billingMonth} is now available. Current bill total: ₱${totalAmount}. Due: ${dueDate}.`,
    });
    console.log("✅ Utility email accepted", { emailFingerprint: emailFingerprint(to), success: true });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Utility email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// PAYMENT REMINDER EMAIL (sent 3 days before due date)
// =============================================================================

const generatePaymentReminderEmail = ({ tenantName, billTypeLabel, totalAmount, dueDate, branchName }) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(`This is a friendly reminder that your ${billTypeLabel.toLowerCase()} payment is due soon.`)}
    ${goldStatPanel(
      goldStat({ label: "Bill Type", value: escapeHtml(billTypeLabel) }) +
      goldStat({ label: "Amount Due", value: `&#8369;${fmtPeso(totalAmount)}`, emphasis: true }) +
      goldStat({ label: "Due Date", value: escapeHtml(dueDate) })
    )}
    ${p("Please complete payment through the billing portal's online checkout to avoid late penalties. If branch staff accepts an offline payment, they will record it after confirmation.", { size: "14px" })}
  `;
  return renderEmailShell({
    title: "Payment Reminder - Lilycrest Dormitory",
    branchName,
    heading: "Payment Reminder",
    bodyHtml,
  });
};

export const sendPaymentReminderEmail = async ({
  to,
  tenantName,
  billingMonth,
  totalAmount,
  dueDate,
  billType = "Bill",
  branchName = "Lilycrest",
}) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return { success: false, message: "Email service not configured" };
  const billTypeLabel = String(billType || "Bill");
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: `${billTypeLabel} Reminder — Due ${dueDate} | Lilycrest Dormitory`,
      html: generatePaymentReminderEmail({ tenantName, billTypeLabel, totalAmount, dueDate, branchName }),
      text: `Hello ${tenantName}, reminder: your ${billTypeLabel.toLowerCase()} balance of ₱${totalAmount} is due on ${dueDate}. — Lilycrest Dormitory`,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Payment reminder email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// OVERDUE / PENALTY NOTICE EMAIL
// =============================================================================

const generateOverdueNoticeEmail = ({
  tenantName,
  billTypeLabel,
  daysLate,
  totalAmount,
  penalty,
  dueDate,
  reason,
  isPenaltyNotice,
  branchName,
}) => {
  const headline = isPenaltyNotice ? "Penalty Notice" : "Payment Overdue";
  const intro = isPenaltyNotice
    ? `A late-payment penalty update is now attached to your <strong>${escapeHtml(billTypeLabel.toLowerCase())}</strong> bill.`
    : `Your <strong>${escapeHtml(billTypeLabel.toLowerCase())}</strong> payment is <strong>${daysLate} day${daysLate !== 1 ? "s" : ""} overdue</strong>. Penalties are being applied.`;

  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(intro)}
    ${goldStatPanel(
      goldStat({ label: "Bill Type", value: escapeHtml(billTypeLabel) }) +
      goldStat({ label: "Due Date", value: escapeHtml(dueDate) }) +
      (daysLate > 0 ? goldStat({ label: "Days Overdue", value: `${daysLate} day${daysLate !== 1 ? "s" : ""}` }) : "") +
      goldStat({ label: "Total Amount (incl. penalty)", value: `&#8369;${fmtPeso(totalAmount)}`, emphasis: true }) +
      `<p style="color:${THEME.goldDeep};font-size:13px;margin:0;">Includes &#8369;${fmtPeso(penalty)} in late penalties</p>` +
      (reason ? `<p style="color:${THEME.goldDeep};font-size:13px;margin:10px 0 0;">Reason: ${escapeHtml(reason)}</p>` : "")
    )}
    ${p("Please settle your payment immediately to avoid further charges.", { size: "14px" })}
  `;

  return renderEmailShell({
    title: isPenaltyNotice ? "Penalty Notice - Lilycrest Dormitory" : "Payment Overdue - Lilycrest Dormitory",
    branchName,
    heading: headline,
    bodyHtml,
  });
};

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
}) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return { success: false, message: "Email service not configured" };
  const billTypeLabel = String(billType || "Bill");
  const isPenaltyNotice = noticeVariant === "penalty";
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: isPenaltyNotice
        ? `Penalty Notice — ${billTypeLabel} | Lilycrest Dormitory`
        : `Overdue Notice — ${billTypeLabel} | Lilycrest Dormitory`,
      html: generateOverdueNoticeEmail({ tenantName, billTypeLabel, daysLate, totalAmount, penalty, dueDate, reason, isPenaltyNotice, branchName }),
      text: isPenaltyNotice
        ? `Hello ${tenantName}, a penalty update has been applied to your ${billTypeLabel.toLowerCase()} bill. Due date: ${dueDate}. Total due: ₱${totalAmount}. Penalty: ₱${penalty}.${reason ? ` Reason: ${reason}.` : ""} — Lilycrest Dormitory`
        : `Hello ${tenantName}, your ${billTypeLabel.toLowerCase()} bill is ${daysLate} days overdue. Due date: ${dueDate}. Total due: ₱${totalAmount} (includes ₱${penalty} penalty).${reason ? ` Reason: ${reason}.` : ""} — Lilycrest Dormitory`,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Overdue notice email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// PAYMENT APPROVED EMAIL
// =============================================================================

const generatePaymentApprovedEmail = ({ tenantName, paidAmount, billingMonth, branchName }) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(`Your payment of <strong>&#8369;${fmtPeso(paidAmount)}</strong> for <strong>${escapeHtml(billingMonth)}</strong> has been verified and approved.`)}
    ${p("Thank you for your prompt payment!")}
  `;
  return renderEmailShell({
    title: "Payment Approved - Lilycrest Dormitory",
    branchName,
    heading: "Payment Approved!",
    bodyHtml,
  });
};

export const sendPaymentApprovedEmail = async ({ to, tenantName, billingMonth, paidAmount, branchName = "Lilycrest" }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return { success: false, message: "Email service not configured" };
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: `Payment Approved — ${billingMonth} | Lilycrest Dormitory`,
      html: generatePaymentApprovedEmail({ tenantName, paidAmount, billingMonth, branchName }),
      text: `Hello ${tenantName}, your payment of ₱${paidAmount} for ${billingMonth} has been approved. — Lilycrest Dormitory`,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Payment approved email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// PAYMENT REJECTED EMAIL
// =============================================================================

const generatePaymentRejectedEmail = ({ tenantName, billingMonth, rejectionReason, branchName }) => {
  const bodyHtml = `
    ${p(`Hello <strong>${escapeHtml(tenantName)}</strong>,`)}
    ${p(`Your payment proof for <strong>${escapeHtml(billingMonth)}</strong> was reviewed and could not be accepted.`)}
    ${goldCallout({ label: "Reason", content: escapeHtml(rejectionReason) })}
    ${p("Please complete payment using the billing portal's online checkout. If you need branch-assisted offline settlement, contact the branch staff directly.", { size: "14px" })}
  `;
  return renderEmailShell({
    title: "Payment Proof Rejected - Lilycrest Dormitory",
    branchName,
    heading: "Payment Proof Rejected",
    bodyHtml,
  });
};

export const sendPaymentRejectedEmail = async ({ to, tenantName, billingMonth, rejectionReason, branchName = "Lilycrest" }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return { success: false, message: "Email service not configured" };
  try {
    const info = await transporter.sendMail({
      from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
      to,
      subject: `Payment Proof Rejected — ${billingMonth} | Lilycrest Dormitory`,
      html: generatePaymentRejectedEmail({ tenantName, billingMonth, rejectionReason, branchName }),
      text: `Hello ${tenantName}, your payment proof for ${billingMonth} was rejected. Reason: ${rejectionReason}. Please use the billing portal's online checkout for monthly payment, or contact the branch for assisted offline settlement. — Lilycrest Dormitory`,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Payment rejected email failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
    return { success: false, error: error.message };
  }
};

// =============================================================================
// PAYMENT RECEIPT EMAIL
// =============================================================================

const generatePaymentReceiptHtml = ({
  tenantName,
  amount,
  description,
  billedTo,
  paymentMethod,
  paymentDate,
  referenceId,
  reservationCode,
  roomName,
  branch,
}) => {
  const detailsRows =
    goldRow("Description", escapeHtml(description)) +
    goldRow("Billed to", escapeHtml(billedTo || tenantName)) +
    goldRow("Payment method", escapeHtml(paymentMethod)) +
    goldRow("Date paid", escapeHtml(paymentDate)) +
    goldRow("Reference", `<span style="font-family:monospace;font-weight:400;color:${THEME.textMuted};">${escapeHtml(referenceId)}</span>`) +
    (reservationCode ? goldRow("Reservation code", escapeHtml(reservationCode)) : "") +
    (reservationCode && roomName ? goldRow("Room / Branch", `${escapeHtml(roomName)}${branch ? ` · ${escapeHtml(branch)}` : ""}`) : "");

  const bodyHtml = `
    ${p(`Hi <strong>${escapeHtml(tenantName)}</strong>, thank you for your payment. Here's a copy of your receipt.`)}
    ${goldStatPanel(goldStat({ label: "Amount Paid", value: `&#8369;${fmtPeso(amount)}`, emphasis: true }))}
    ${goldDetailsPanel(detailsRows)}
    ${
      reservationCode
        ? goldCallout({
            label: "What Happens Next",
            content:
              "Your room reservation is now <strong>secured</strong>. The admin team will review your application and contact you to arrange your move-in schedule. Please prepare your valid ID and other required documents on move-in day.",
          })
        : ""
    }
    ${p("If you have any questions about this payment, contact Lilycrest Dormitory through the tenant portal.", { size: "13px", color: THEME.textMuted, margin: "0" })}
  `;

  return renderEmailShell({
    title: "Payment Receipt - Lilycrest Dormitory",
    branchName: branch || "Lilycrest",
    heading: "Payment Receipt",
    bodyHtml,
    footerNote: "You're receiving this e-mail because you made a payment at Lilycrest Dormitory.",
  });
};

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
}) => {
  const subject = `Payment Receipt — ₱${Number(amount).toLocaleString()} | Lilycrest Dormitory`;
  const html = generatePaymentReceiptHtml({
    tenantName,
    amount,
    description,
    billedTo,
    paymentMethod,
    paymentDate,
    referenceId,
    reservationCode,
    roomName,
    branch,
  });
  const text = `Hi ${tenantName}, your payment of ₱${amount} for "${description}" has been received. Reference: ${referenceId}. Date: ${paymentDate}.${reservationCode ? ` Reservation: ${reservationCode}.` : ""} — Lilycrest Dormitory`;

  // Primary: SMTP (Nodemailer)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      const info = await transporter.sendMail({
        from: { name: "Lilycrest Dormitory", address: process.env.EMAIL_USER },
        to,
        subject,
        html,
        text,
      });
      console.log("✅ Receipt email accepted", { emailFingerprint: emailFingerprint(to), success: true });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Receipt email (SMTP) failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
      return { success: false, error: error.message };
    }
  }

  // Fallback: Resend (same service used for OTP)
  if (resendClient && OTP_FROM) {
    try {
      const { data, error } = await resendClient.emails.send({ from: OTP_FROM, to: [to], subject, html, text });
      if (error) {
        console.error("❌ Receipt email (Resend) failed", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
        return { success: false, error: error.message };
      }
      console.log("✅ Receipt email (Resend) accepted", { emailFingerprint: emailFingerprint(to), success: true });
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error("❌ Receipt email (Resend) error", { emailFingerprint: emailFingerprint(to), ...safeEmailFailure(error) });
      return { success: false, error: error.message };
    }
  }

  console.log("⚠️ Receipt email not sent — neither SMTP nor Resend is configured");
  return { success: false, message: "Email service not configured" };
};

// =============================================================================
// LOGIN OTP EMAIL
// =============================================================================

export const generateLoginOtpEmail = ({ displayName, otp, expiresInMinutes }) => {
  const bodyHtml = `
    ${p(`Hi <strong>${escapeHtml(displayName)}</strong>,`)}
    ${p("Use this 6-digit code to finish signing in to your Lilycrest account.", { size: "14px" })}
    <div style="letter-spacing:8px;font-size:32px;font-weight:700;color:${THEME.textDark};background:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:10px;padding:18px;text-align:center;margin:0 0 20px;">${escapeHtml(otp)}</div>
    ${p(`This code expires in ${expiresInMinutes} minutes. If you did not request it, you can ignore this email.`, { size: "13px", color: THEME.textMuted, margin: "0" })}
  `;
  return renderEmailShell({
    title: "Your Lilycrest login OTP",
    branchName: "Lilycrest",
    heading: "Login Verification",
    bodyHtml,
  });
};

export const sendLoginOtpEmail = async ({ to, name, otp, expiresInMinutes = 10 }) => {
  if (!resendClient || !OTP_FROM) {
    return {
      success: false,
      category: "configuration",
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      statusCode: null,
    };
  }

  try {
    const result = await resendClient.emails.send(
      buildLoginOtpMessage({ to, name, otp, expiresInMinutes }),
    );
    return normalizeOtpEmailResponse(result);
  } catch (error) {
    return { success: false, ...classifyOtpEmailError(error) };
  }
};

export const normalizeOtpEmailResponse = ({ data, error } = {}) => {
  if (error) return { success: false, ...classifyOtpEmailError(error) };
  if (typeof data?.id !== "string" || !data.id.trim()) {
    return {
      success: false,
      category: "unexpected_response",
      code: "EMAIL_PROVIDER_UNEXPECTED_RESPONSE",
      statusCode: null,
    };
  }
  return { success: true, category: "accepted", messageId: data.id };
};

export const buildLoginOtpMessage = ({ to, name, otp, expiresInMinutes = 10 }) => {
  const displayName = name || "there";
  return {
    from: OTP_FROM,
    to: [to],
    subject: "Your Lilycrest login OTP",
    html: generateLoginOtpEmail({ displayName, otp, expiresInMinutes }),
    text: `Hi ${String(displayName).replace(/[\r\n]+/g, " ")}, your Lilycrest login OTP is ${otp}. It expires in ${expiresInMinutes} minutes.`,
  };
};

export const classifyOtpEmailError = (error = {}) => {
  const statusCode = Number(error.statusCode || error.status || error.cause?.statusCode || 0) || null;
  const rawCode = String(error.name || error.code || error.cause?.code || "");
  const text = `${rawCode} ${error.message || ""}`.toLowerCase();

  if (/api key|invalid[_ -]?api[_ -]?key|unauthor|authenticat/.test(text)) {
    return { category: "invalid_api_key", code: "EMAIL_PROVIDER_AUTH_REJECTED", statusCode };
  }
  if (statusCode === 429 || /rate.?limit|too many/.test(text)) {
    return { category: "rate_limit", code: "EMAIL_PROVIDER_RATE_LIMITED", statusCode };
  }
  if (/timeout|timed out|abort|econnreset|etimedout/.test(text)) {
    return { category: "timeout", code: "EMAIL_PROVIDER_TIMEOUT", statusCode };
  }
  if (/econnrefused|enotfound|eai_again|network|socket/.test(text)) {
    return { category: "network", code: "EMAIL_PROVIDER_NETWORK_ERROR", statusCode };
  }
  if (/domain|sender|from address|verify/.test(text)) {
    return { category: "sender_rejection", code: "EMAIL_PROVIDER_SENDER_REJECTED", statusCode };
  }
  if ([401, 403].includes(statusCode)) {
    return { category: "invalid_api_key", code: "EMAIL_PROVIDER_AUTH_REJECTED", statusCode };
  }
  if (statusCode && statusCode >= 400) {
    return { category: "provider_rejected", code: "EMAIL_PROVIDER_REJECTED", statusCode };
  }
  return { category: "unknown", code: "EMAIL_PROVIDER_ERROR", statusCode };
};

export default transporter;

// =============================================================================
// QA TEST HARNESS — force-send any template from the command line
// =============================================================================
//
// Only runs when this file is executed directly (`node email.js ...`), never
// when it's imported by your app, so it's safe to leave in.
//
// Usage:
//   node email.js <template> <to-email> [name]
//
// Run with no args to print the list of available templates.

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
  "visit-approved": (to, name) =>
    sendVisitApprovedEmail({ to, tenantName: name, branchName: "Gil Puyat" }),
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
  "payment-approved": (to, name) =>
    sendPaymentApprovedEmail({ to, tenantName: name, billingMonth: "August 2026", paidAmount: 4500 }),
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
  typeof process !== "undefined" &&
  process.argv[1] &&
  /email\.js$/.test(process.argv[1]);

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
        statusCode: result?.statusCode || null,
      });
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[QA] Unhandled error", safeEmailFailure(err));
      process.exit(1);
    });
}
