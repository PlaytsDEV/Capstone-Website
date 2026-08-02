export const EMAIL_VERIFICATION_COOKIE = "lilycrest_email_verification";

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
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/auth/email-verification",
  maxAge,
});

export const setEmailVerificationCookie = (res, token, maxAge) => {
  if (token && typeof res.cookie === "function") {
    res.cookie(EMAIL_VERIFICATION_COOKIE, token, getEmailVerificationCookieOptions(maxAge));
  }
};

export const getEmailVerificationToken = (req = {}) =>
  parseCookies(req.headers?.cookie)[EMAIL_VERIFICATION_COOKIE] || "";
