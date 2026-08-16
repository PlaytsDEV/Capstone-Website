/**
 * Shared Lilycrest email shell — the inline-HTML equivalent of what a
 * Resend Dashboard Template's layout provides. Every builder in
 * services/email/builders/*.js calls `renderLilycrestEmail()` for the outer
 * navy-and-gold branded shell and only supplies its own content; none of
 * them duplicate the header/container/typography/footer markup.
 *
 * Navy (#1E3A5F) stays the structural color (header band, headings) and gold
 * (#D4AF37, matching the web app's --color-accent) is the accent (CTA
 * buttons, dividers, footer tint) — replaces the orange accent from the
 * pre-Aug-12 identity with the site's actual current brand gold, and adds
 * the real Lilycrest mark (getLogoUrl()) to the header in place of the
 * generic house emoji that stood in for it.
 *
 * All user-controlled values passed through here MUST go through
 * `escapeHtml()` (or a caller-controlled trusted structure) before being
 * interpolated — this file assumes its inputs are already safe and does not
 * re-escape content blocks itself, since some callers intentionally pass
 * already-composed inner HTML (e.g. a details panel with several rows).
 */
import { getPublicUrlConfig } from "../../config/publicUrls.js";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Safe peso formatter — avoids toLocaleString("en-PH") ICU gaps in Node. */
export const fmtPeso = (n) => {
  const fixed = Number(n || 0).toFixed(2);
  const [int, dec] = fixed.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas}.${dec}`;
};

export const formatVisitScheduleLabel = (visitDate, visitTime) => {
  const dateLabel = visitDate
    ? new Date(visitDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "TBD";
  return visitTime ? `${dateLabel} at ${visitTime}` : dateLabel;
};

export const THEME = Object.freeze({
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  pageBg: "#F3F4F6",
  cardBg: "#ffffff",
  navy: "#1E3A5F",
  navyLight: "#2D5A8E",
  gold: "#D4AF37",
  goldDeep: "#B9921F",
  goldTint: "#FBF7EA",
  goldTintBorder: "#F3E4B0",
  warnBg: "#FEF3C7",
  warnBorder: "#FDE68A",
  warnText: "#92400E",
  footerBg: "#FBF7EA",
  footerBorder: "#F3E4B0",
  textDark: "#1E3A5F",
  textBody: "#374151",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
});

export const getLogoUrl = () => getPublicUrlConfig().publicLogoUrl;

/**
 * Renders the outer branded shell. `body` is inner HTML (already composed
 * from the helpers below); `heading`/`branchName`/`title`/`footerNote` are
 * plain strings this function escapes itself.
 */
export const renderLilycrestEmail = ({
  title,
  branchName = "Lilycrest",
  heading,
  body,
  footerNote = "",
}) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || heading || "LilyCrest Dormitory")}</title>
</head>
<body style="margin:0;padding:0;font-family:${THEME.fontFamily};background-color:${THEME.pageBg};">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" style="max-width:560px;margin:0 auto;background-color:${THEME.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${THEME.navy} 0%,${THEME.navyLight} 100%);padding:32px 40px;text-align:center;border-bottom:3px solid ${THEME.gold};">
              <img src="${escapeHtml(getLogoUrl())}" alt="Lilycrest" width="56" height="56" style="display:block;margin:0 auto 12px;max-width:56px;height:auto;">
              <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:0.5px;">LilyCrest Dormitory</h1>
              <p style="margin:6px 0 0;color:${THEME.gold};font-size:13px;">${escapeHtml(branchName)} Branch — Tenant Portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 0;">
              ${heading ? `<h2 style="color:${THEME.textDark};margin:0 0 16px;font-size:20px;font-weight:700;">${escapeHtml(heading)}</h2>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background-color:${THEME.footerBg};padding:24px 40px;border-top:1px solid ${THEME.footerBorder};">
              ${footerNote ? `<p style="margin:0 0 12px;color:${THEME.textMuted};font-size:13px;line-height:1.5;">${escapeHtml(footerNote)}</p>` : ""}
              <p style="margin:0;color:${THEME.textFaint};font-size:12px;">
                This is an automated message from LilyCrest Dormitory Management System.<br/>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;text-align:center;color:${THEME.textFaint};font-size:11px;">
          © ${new Date().getFullYear()} LilyCrest Dormitory. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** Standard paragraph. `html` is inner HTML the caller has already escaped. */
export const p = (html, opts = {}) =>
  `<p style="color:${opts.color || THEME.textBody};font-size:${opts.size || "15px"};line-height:1.6;margin:${opts.margin || "0 0 16px"};">${html}</p>`;

/** Primary CTA button. `url` must be a trusted, server-generated URL — never user input. */
export const button = (label, url) =>
  `<div style="text-align:center;margin:0 0 28px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${THEME.gold};color:${THEME.navy};text-decoration:none;padding:16px 40px;border-radius:14px;font-weight:700;font-size:16px;letter-spacing:0.3px;">${escapeHtml(label)}</a></div>`;

/** Amber time-sensitive-notice callout (matches the old expiry-warning boxes). */
export const callout = (label, contentHtml) => `
  <div style="background-color:${THEME.warnBg};border:1px solid ${THEME.warnBorder};padding:14px 20px;margin:0 0 20px;border-radius:12px;">
    ${label ? `<p style="color:${THEME.warnText};font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${escapeHtml(label)}</p>` : ""}
    <p style="color:${THEME.warnText};font-size:13px;margin:0;line-height:1.5;white-space:pre-wrap;">${contentHtml}</p>
  </div>`;

/** Navy-tinted key/value row. Both `label` and `value` are escaped here. */
export const row = (label, value) => {
  if (value === "" || value === null || value === undefined) return "";
  return `<tr><td style="padding:6px 0;color:${THEME.navy};font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${THEME.textDark};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(String(value))}</td></tr>`;
};

/** Panel wrapping a set of row() entries. */
export const detailsPanel = (rowsHtml) =>
  `<div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:12px;padding:18px 20px;margin:0 0 20px;"><table style="width:100%;border-collapse:collapse;">${rowsHtml}</table></div>`;

/** Large centered amount/stat highlight. `value` is escaped here. */
export const stat = (label, value) => `
  <p style="color:${THEME.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${escapeHtml(label)}</p>
  <p style="color:${THEME.navy};font-size:28px;font-weight:700;margin:0;">${escapeHtml(String(value))}</p>`;

/** Centered stat panel container. */
export const statPanel = (innerHtml) =>
  `<div style="background-color:${THEME.goldTint};border-radius:12px;padding:20px;margin:20px 0;text-align:center;">${innerHtml}</div>`;

/** Status badge used across notice-style emails (amber, time-sensitive style). */
export const badge = (text) => `
  <div style="background-color:${THEME.warnBg};border:1px solid ${THEME.warnBorder};padding:14px 18px;border-radius:12px;margin:0 0 20px;text-align:center;">
    <p style="margin:0;font-size:13px;color:${THEME.warnText};font-weight:600;">${escapeHtml(text)}</p>
  </div>`;
