/**
 * Canonical, code-controlled frontend origin for links Firebase embeds in
 * outbound auth emails (password reset, email verification's shared
 * /auth-action handler).
 *
 * This must never be derived from window.location, document.referrer, or a
 * request Origin/Host header — those reflect whatever host served the
 * current bundle, including ephemeral Vercel preview deployments. It is
 * baked in at build time via VITE_APP_URL instead, mirroring how the backend
 * pins PUBLIC_FRONTEND_URL/EMAIL_ACTION_URL (see server/config/publicUrls.js).
 */
const normalizeUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const envAppUrl = normalizeUrl(import.meta.env.VITE_APP_URL);
const isProd = import.meta.env.PROD;

// No production fallback: an unset VITE_APP_URL in a production build must
// not silently resolve to some other domain (e.g. whatever Firebase Console
// has configured as its default action URL). Development falls back to the
// local dev server so the flow works without extra setup.
export const APP_URL = envAppUrl || (isProd ? "" : "http://localhost:5173");

export const isAppUrlConfigured = Boolean(APP_URL);

export const EMAIL_ACTION_URL = APP_URL ? `${APP_URL}/auth-action` : "";
