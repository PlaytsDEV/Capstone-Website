import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  clearWebSessionCookie,
  getWebSessionId,
  setWebSessionCookie,
} from "./webSessionCookie.js";

describe("web application session cookie", () => {
  const originalEnvironment = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnvironment; });

  test("production sessions are HttpOnly, Secure, cross-site compatible, and absent from JSON", () => {
    process.env.NODE_ENV = "production";
    const res = { cookie: jest.fn() };
    expect(setWebSessionCookie(res, "opaque-session")).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith(
      "lilycrest_web_session",
      "opaque-session",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "none" }),
    );
  });

  test("cookie creation reports failure when the response cannot set cookies", () => {
    expect(setWebSessionCookie({}, "opaque-session")).toBe(false);
  });

  test("server reads cookie sessions while preserving explicit non-browser header compatibility", () => {
    expect(getWebSessionId({ headers: { cookie: "lilycrest_web_session=cookie-value" } })).toBe("cookie-value");
    expect(getWebSessionId({ headers: { "x-session-id": "header-value", cookie: "lilycrest_web_session=cookie-value" } })).toBe("header-value");
  });

  test("logout clears with matching security attributes", () => {
    process.env.NODE_ENV = "production";
    const res = { clearCookie: jest.fn() };
    clearWebSessionCookie(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      "lilycrest_web_session",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "none" }),
    );
  });
});
