import { createCorsOriginPolicy } from "../config/corsPolicy.js";

export const EMAIL_VERIFICATION_COOKIE = "lilycrest_email_verification";
export const EMAIL_VERIFICATION_CSRF_HEADER = "x-email-verification-csrf";

const parseCookies = (header = "") =>
  String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return cookies;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});

export const getEmailVerificationCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // The production web and API hosts are same-site subdomains, so Lax keeps
  // this capability out of cross-site requests without breaking API fetches.
  sameSite: "lax",
  path: "/api/auth/email-verification",
  maxAge,
});

export const setEmailVerificationCookie = (res, token, maxAge) => {
  if (token && typeof res.cookie === "function") {
    res.cookie(EMAIL_VERIFICATION_COOKIE, token, getEmailVerificationCookieOptions(maxAge));
  }
};

export const clearEmailVerificationCookie = (res) => {
  if (typeof res.clearCookie !== "function") return;
  const { maxAge: _maxAge, ...options } = getEmailVerificationCookieOptions();
  res.clearCookie(EMAIL_VERIFICATION_COOKIE, options);
};

export const getEmailVerificationToken = (req = {}) =>
  parseCookies(req.headers?.cookie)[EMAIL_VERIFICATION_COOKIE] || "";

export const requireEmailVerificationCsrf = (req, res, next) => {
  const origin = String(req.headers?.origin || "").trim();
  const marker = String(req.headers?.[EMAIL_VERIFICATION_CSRF_HEADER] || "").trim();
  let allowed = false;
  try {
    allowed = Boolean(origin) && createCorsOriginPolicy().isOriginAllowed(origin);
  } catch {
    allowed = false;
  }
  if (!allowed || marker !== "1") {
    return res.status(403).json({
      code: "CSRF_VALIDATION_FAILED",
      message: "Email verification request validation failed.",
    });
  }
  return next();
};
