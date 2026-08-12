/**
 * Shared Lilycrest email shell — the inline-HTML equivalent of what a
 * Resend Dashboard Template's layout provides. Every builder in
 * services/email/builders/*.js calls `renderLilycrestEmail()` for the outer
 * white-and-gold branded shell and only supplies its own content; none of
 * them duplicate the header/container/typography/footer markup.
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
  footerNote = "This is an automated notification. Please do not reply directly to this email.",
}) => `<!DOCTYPE html>
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
          <tr>
            <td style="background-color:${THEME.cardBg};padding:30px 40px;text-align:center;border-bottom:3px solid ${THEME.goldAccent};">
              <img src="${escapeHtml(getLogoUrl())}" alt="Lilycrest Dormitory" width="72" height="72" style="display:block;margin:0 auto 12px;max-width:72px;height:auto;">
              <h1 style="color:${THEME.gold};margin:0;font-size:28px;font-weight:600;">Lilycrest Dormitory</h1>
              <p style="color:${THEME.goldDeep};margin:10px 0 0;font-size:14px;">${escapeHtml(branchName)} Branch</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 20px;">
              ${heading ? `<h2 style="color:${THEME.textDark};margin:0;font-size:22px;font-weight:600;text-align:center;">${escapeHtml(heading)}</h2>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background-color:${THEME.goldTint};padding:25px 40px;text-align:center;border-top:1px solid ${THEME.goldTintBorder};">
              <p style="color:#888888;font-size:14px;margin:0 0 10px;">Best regards,<br><strong style="color:#b8933f;">Lilycrest Dormitory Team</strong></p>
              <p style="color:${THEME.textFaint};font-size:12px;margin:15px 0 0;">${escapeHtml(footerNote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** Standard paragraph. `html` is inner HTML the caller has already escaped. */
export const p = (html, opts = {}) =>
  `<p style="color:${opts.color || THEME.textBody};font-size:${opts.size || "16px"};line-height:1.6;margin:${opts.margin || "0 0 16px"};">${html}</p>`;

/** Primary CTA button. `url` must be a trusted, server-generated URL — never user input. */
export const button = (label, url) =>
  `<div style="text-align:center;margin:28px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${THEME.gold};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a></div>`;

/** Gold-tinted callout / quote box (left gold border). */
export const callout = (label, contentHtml) => `
  <div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-left:4px solid ${THEME.goldAccent};padding:18px 20px;margin:0 0 20px;border-radius:0 8px 8px 0;">
    ${label ? `<p style="color:${THEME.goldDeep};font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${escapeHtml(label)}</p>` : ""}
    <p style="color:${THEME.textDark};font-size:14px;margin:0;line-height:1.7;white-space:pre-wrap;">${contentHtml}</p>
  </div>`;

/** Gold key/value row. Both `label` and `value` are escaped here. */
export const row = (label, value) => {
  if (value === "" || value === null || value === undefined) return "";
  return `<tr><td style="padding:6px 0;color:${THEME.goldDeep};font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${THEME.textDark};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(String(value))}</td></tr>`;
};

/** Panel wrapping a set of row() entries. */
export const detailsPanel = (rowsHtml) =>
  `<div style="background-color:${THEME.goldTint};border:1px solid ${THEME.goldTintBorder};border-radius:8px;padding:18px 20px;margin:0 0 20px;"><table style="width:100%;border-collapse:collapse;">${rowsHtml}</table></div>`;

/** Large centered amount/stat highlight. `value` is escaped here. */
export const stat = (label, value) => `
  <p style="color:${THEME.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${escapeHtml(label)}</p>
  <p style="color:#B8860B;font-size:28px;font-weight:700;margin:0;">${escapeHtml(String(value))}</p>`;

/** Centered stat panel container. */
export const statPanel = (innerHtml) =>
  `<div style="background-color:${THEME.goldTint};border-radius:8px;padding:20px;margin:20px 0;text-align:center;">${innerHtml}</div>`;

/** Status badge used across notice-style emails. */
export const badge = (text) => `
  <div style="background-color:${THEME.goldTint};border-left:4px solid ${THEME.goldAccent};padding:14px 18px;border-radius:8px;margin:0 0 20px;text-align:center;">
    <p style="margin:0;font-size:14px;color:${THEME.goldDeep};font-weight:600;">${escapeHtml(text)}</p>
  </div>`;
