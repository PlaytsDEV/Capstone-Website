/**
 * Shared, flat Lilycrest transactional-email shell.
 *
 * Every inline Resend builder supplies only its business content. This file
 * owns the canonical logo, branch subtitle, responsive container, typography,
 * CTA, status, and footer treatments. All user-controlled values must be
 * escaped before interpolation.
 */
import { getPublicUrlConfig } from "../../config/publicUrls.js";
import {
  formatBranchSubtitle,
  GENERIC_BRANCH_LABEL,
} from "../../utils/branchPresentation.js";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const fmtPeso = (n) => {
  const fixed = Number(n || 0).toFixed(2);
  const [int, dec] = fixed.split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
};

export const formatVisitScheduleLabel = (visitDate, visitTime) => {
  const dateLabel = visitDate
    ? new Date(visitDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "TBD";
  return visitTime ? `${dateLabel} at ${visitTime}` : dateLabel;
};

export const THEME = Object.freeze({
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  navy: "#0A1628",
  navyHover: "#13243D",
  gold: "#D4AF37",
  goldDeep: "#B9921F",
  goldTint: "#FBF7EA",
  goldTintBorder: "#F3E4B0",
  surfaceMuted: "#F1F5F9",
  border: "#E5E7EB",
  success: "#059669",
  successBg: "#ECFDF5",
  successText: "#065F46",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningText: "#92400E",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerText: "#991B1B",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoText: "#1E40AF",
  footerBg: "#F8FAFC",
  textDark: "#0A1628",
  textBody: "#1E293B",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
});

export const getLogoUrl = () => getPublicUrlConfig().publicLogoUrl;

export const getPortalUrl = (pathname = "") => {
  const baseUrl = getPublicUrlConfig().publicFrontendUrl || "https://www.lilycrest.space";
  const suffix = String(pathname || "").trim();
  return suffix ? `${baseUrl}${suffix.startsWith("/") ? suffix : `/${suffix}`}` : baseUrl;
};

const toneTokens = (tone = "warning") => {
  if (tone === "success") {
    return { background: THEME.successBg, border: THEME.success, text: THEME.successText };
  }
  if (tone === "danger") {
    return { background: THEME.dangerBg, border: THEME.danger, text: THEME.dangerText };
  }
  if (tone === "info") {
    return { background: THEME.infoBg, border: THEME.info, text: THEME.infoText };
  }
  return { background: THEME.warningBg, border: THEME.warning, text: THEME.warningText };
};

export const renderLilycrestEmail = ({
  title,
  branchName,
  heading,
  body,
  footerNote = "",
}) => {
  const branchSubtitle = formatBranchSubtitle(branchName);
  const branchSubtitleMarkup = branchSubtitle === GENERIC_BRANCH_LABEL
    ? ""
    : `<p style="margin:6px 0 0;color:${THEME.gold};font-size:13px;font-weight:600;">${escapeHtml(branchSubtitle)}</p>`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || heading || "Lilycrest Dormitory")}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .lc-shell-pad { padding: 12px !important; }
      .lc-email-card { border-radius: 8px !important; }
      .lc-header { padding: 24px 20px !important; }
      .lc-heading { padding: 24px 20px 0 !important; }
      .lc-body { padding: 0 20px 24px !important; }
      .lc-footer { padding: 20px !important; }
      .lc-button { display: block !important; padding: 14px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;font-family:${THEME.fontFamily};background-color:${THEME.pageBg};">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td class="lc-shell-pad" style="padding:24px 16px;">
        <table role="presentation" class="lc-email-card" width="100%" style="width:100%;max-width:560px;margin:0 auto;background-color:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td class="lc-header" style="background-color:${THEME.navy};padding:28px 40px;text-align:center;border-bottom:3px solid ${THEME.gold};">
              <img src="${escapeHtml(getLogoUrl())}" alt="Lilycrest Dormitory logo" width="52" height="52" style="display:block;margin:0 auto 12px;max-width:52px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
              <h1 style="margin:0;color:#FFFFFF;font-size:21px;font-weight:700;letter-spacing:0.4px;">Lilycrest Dormitory</h1>
              ${branchSubtitleMarkup}
            </td>
          </tr>
          <tr>
            <td class="lc-heading" style="padding:28px 40px 0;">
              ${heading ? `<h2 style="color:${THEME.textDark};margin:0 0 16px;font-size:20px;font-weight:700;">${escapeHtml(heading)}</h2>` : ""}
            </td>
          </tr>
          <tr>
            <td class="lc-body" style="padding:0 40px 28px;">${body}</td>
          </tr>
          <tr>
            <td class="lc-footer" style="background-color:${THEME.footerBg};padding:22px 40px;border-top:1px solid ${THEME.border};">
              ${footerNote ? `<p style="margin:0 0 12px;color:${THEME.textMuted};font-size:13px;line-height:1.5;">${escapeHtml(footerNote)}</p>` : ""}
              <p style="margin:0;color:${THEME.textMuted};font-size:12px;line-height:1.5;">
                Lilycrest Dormitory<br>
                Automated service email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;text-align:center;color:${THEME.textMuted};font-size:11px;">
          © ${new Date().getFullYear()} Lilycrest Dormitory. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const p = (html, opts = {}) =>
  `<p style="color:${opts.color || THEME.textBody};font-size:${opts.size || "15px"};line-height:1.6;margin:${opts.margin || "0 0 16px"};">${html}</p>`;

export const button = (label, url) =>
  `<div style="text-align:center;margin:24px 0 28px;"><a class="lc-button" href="${escapeHtml(url)}" style="display:inline-block;background-color:${THEME.navy};color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.2px;">${escapeHtml(label)}</a></div>`;

export const callout = (label, contentHtml, tone = "warning") => {
  const colors = toneTokens(tone);
  return `
  <div style="background-color:${colors.background};border:1px solid ${colors.border};padding:14px 18px;margin:0 0 20px;border-radius:8px;">
    ${label ? `<p style="color:${colors.text};font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">${escapeHtml(label)}</p>` : ""}
    <p style="color:${colors.text};font-size:13px;margin:0;line-height:1.5;white-space:pre-wrap;">${contentHtml}</p>
  </div>`;
};

export const row = (label, value) => {
  if (value === "" || value === null || value === undefined) return "";
  return `<tr><td style="padding:6px 0;color:${THEME.textSecondary};font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${THEME.textDark};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(String(value))}</td></tr>`;
};

export const detailsPanel = (rowsHtml) =>
  `<div style="background-color:${THEME.surfaceMuted};border:1px solid ${THEME.border};border-radius:8px;padding:16px 18px;margin:0 0 20px;"><table role="presentation" style="width:100%;border-collapse:collapse;">${rowsHtml}</table></div>`;

export const stat = (label, value) => `
  <p style="color:${THEME.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${escapeHtml(label)}</p>
  <p style="color:${THEME.navy};font-size:28px;font-weight:700;margin:0;">${escapeHtml(String(value))}</p>`;

export const statPanel = (innerHtml) =>
  `<div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:8px;padding:18px;margin:20px 0;text-align:center;">${innerHtml}</div>`;

export const badge = (text, tone = "warning") => {
  const colors = toneTokens(tone);
  return `
  <div style="background-color:${colors.background};border:1px solid ${colors.border};padding:10px 14px;border-radius:8px;margin:0 0 20px;text-align:center;">
    <p style="margin:0;font-size:13px;color:${colors.text};font-weight:700;">${escapeHtml(text)}</p>
  </div>`;
};
