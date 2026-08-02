const WEB_SESSION_COOKIE = "lilycrest_web_session";

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

export const getWebSessionCookieOptions = () => {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  };
};

export const setWebSessionCookie = (res, sessionId) => {
  if (sessionId && typeof res.cookie === "function") {
    res.cookie(WEB_SESSION_COOKIE, sessionId, getWebSessionCookieOptions());
    return true;
  }
  return false;
};

export const clearWebSessionCookie = (res) => {
  if (typeof res.clearCookie !== "function") return;
  const { maxAge: _maxAge, ...options } = getWebSessionCookieOptions();
  res.clearCookie(WEB_SESSION_COOKIE, options);
};

export const getWebSessionId = (requestLike = {}) => {
  const explicitSession = requestLike.headers?.["x-session-id"];
  if (typeof explicitSession === "string" && explicitSession.trim()) {
    return explicitSession.trim();
  }

  const cookieHeader =
    requestLike.headers?.cookie || requestLike.handshake?.headers?.cookie || "";
  return parseCookies(cookieHeader)[WEB_SESSION_COOKIE] || "";
};

export { WEB_SESSION_COOKIE };
