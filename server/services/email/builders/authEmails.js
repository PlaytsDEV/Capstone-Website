/**
 * Inline HTML builders for authentication emails. Each function receives the
 * exact same variables object the Resend Template path would receive (see
 * docs/email-templates/MANIFEST.md) — the two paths must render the same
 * business information, just via different content-generation mechanisms.
 */
import { button, escapeHtml, p, renderLilycrestEmail, row, detailsPanel, THEME } from "../emailLayout.js";

export const buildVerificationEmail = ({ USER_NAME, VERIFICATION_URL }) =>
  renderLilycrestEmail({
    title: "Verify your Lilycrest email",
    heading: "Verify Your Email",
    body:
      p(`Hi <strong>${escapeHtml(USER_NAME || "there")}</strong>,`) +
      p("Confirm your email address to finish setting up your Lilycrest account.", { size: "14px" }) +
      button("Verify email address", VERIFICATION_URL) +
      p("This link can be used only once. If you did not create this account, you can ignore this email.", {
        size: "13px",
        color: "#6B7280",
        margin: "0",
      }),
  });

export const buildPasswordResetEmail = ({ USER_NAME, RESET_URL }) =>
  renderLilycrestEmail({
    title: "Reset your Lilycrest password",
    heading: "Reset Your Password",
    body:
      p(`Hi <strong>${escapeHtml(USER_NAME || "there")}</strong>,`) +
      p("We received a request to reset the password for your Lilycrest account.", { size: "14px" }) +
      button("Reset Password", RESET_URL) +
      p(
        "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
        { size: "13px", color: "#6B7280", margin: "0 0 16px" },
      ) +
      p("If the button above doesn't work, copy and paste this link into your browser:", {
        size: "13px",
        color: "#6B7280",
        margin: "0 0 6px",
      }) +
      `<p style="word-break:break-all;font-size:12px;margin:0;"><a href="${escapeHtml(RESET_URL)}" style="color:${THEME.goldDeep};">${escapeHtml(RESET_URL)}</a></p>`,
  });

export const buildLoginOtpEmail = ({ USER_NAME, OTP_CODE, EXPIRY_MINUTES }) =>
  renderLilycrestEmail({
    title: "Your Lilycrest login OTP",
    heading: "Login Verification",
    body:
      p(`Hi <strong>${escapeHtml(USER_NAME || "there")}</strong>,`) +
      p("Use this 6-digit code to finish signing in to your Lilycrest account.", { size: "14px" }) +
      `<div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;background:${THEME.navy};border-radius:16px;padding:24px 40px;border-top:3px solid ${THEME.gold};"><p style="margin:0 0 6px;color:${THEME.gold};font-size:12px;letter-spacing:1px;text-transform:uppercase;">Verification Code</p><p style="margin:0;color:#FFFFFF;font-size:40px;font-weight:700;letter-spacing:10px;">${escapeHtml(OTP_CODE)}</p></div></div>` +
      p(`This code expires in ${escapeHtml(String(EXPIRY_MINUTES ?? 10))} minutes. If you did not request it, you can ignore this email.`, {
        size: "13px",
        color: "#6B7280",
        margin: "0",
      }),
  });

export const buildPasswordChangedEmail = ({ USER_NAME, TIMESTAMP, IP_ADDRESS }) =>
  renderLilycrestEmail({
    title: "Your Lilycrest password was changed",
    heading: "Password Changed Successfully",
    body:
      p(`Hi <strong>${escapeHtml(USER_NAME || "there")}</strong>,`) +
      p("Your Lilycrest account password was <strong>successfully changed</strong>.", { size: "14px" }) +
      detailsPanel(row("Date & Time", TIMESTAMP) + row("IP Address", IP_ADDRESS)) +
      `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin:0;"><p style="margin:0;color:#991B1B;font-size:13px;line-height:1.5;"><strong>Didn't make this change?</strong> Your account may be compromised — reset your password immediately or contact Lilycrest support.</p></div>`,
  });

export const buildWelcomeAccountActivationEmail = ({ USER_NAME, ROLE_LABEL, USERNAME, SETUP_URL }) =>
  renderLilycrestEmail({
    title: "Welcome to Lilycrest — Set Up Your Account",
    heading: "Set Up Your Password",
    body:
      p(`Hi <strong>${escapeHtml(USER_NAME || "there")}</strong>,`) +
      p("Welcome to Lilycrest! Your account has been created. Please set up your password to activate your account and get started.", {
        size: "14px",
      }) +
      detailsPanel(
        row("Account Type", ROLE_LABEL || "User") +
        (USERNAME ? row("Username", USERNAME) : "")
      ) +
      button("Set Up Password", SETUP_URL) +
      p(
        "This activation link can be used to securely create your password. If you did not expect this invitation or believe it was sent in error, please contact Lilycrest support.",
        { size: "13px", color: "#6B7280", margin: "0 0 16px" },
      ) +
      p("If the button above doesn't work, copy and paste this link into your browser:", {
        size: "13px",
        color: "#6B7280",
        margin: "0 0 6px",
      }) +
      `<p style="word-break:break-all;font-size:12px;margin:0;"><a href="${escapeHtml(SETUP_URL)}" style="color:${THEME.goldDeep};">${escapeHtml(SETUP_URL)}</a></p>`,
  });

