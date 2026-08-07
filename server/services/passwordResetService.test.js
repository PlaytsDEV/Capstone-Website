import { describe, expect, jest, test } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.EMAIL_ACTION_URL = "https://www.lilycrest.space/auth-action";

const { getPasswordResetCooldownSeconds, buildCustomPasswordResetLink } = await import("./passwordResetService.js");

describe("getPasswordResetCooldownSeconds", () => {
  test("defaults to 60 seconds", () => {
    expect(getPasswordResetCooldownSeconds({})).toBe(60);
  });

  test("respects a configured value within bounds", () => {
    expect(getPasswordResetCooldownSeconds({ PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: "120" })).toBe(120);
  });

  test("rejects an out-of-bounds value", () => {
    expect(() => getPasswordResetCooldownSeconds({ PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: "1" })).toThrow();
  });
});

describe("buildCustomPasswordResetLink — regression: raw Firebase link host must never survive into the delivered link", () => {
  const env = { PUBLIC_FRONTEND_URL: "https://www.lilycrest.space", EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action" };

  test("rewrites a Firebase-default-hosted link onto the canonical Lilycrest action URL", () => {
    const rawFirebaseLink =
      "https://lilycrest-dorm.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc123&apiKey=fake-key&lang=en&continueUrl=https%3A%2F%2Fwww.lilycrest.space%2Fsignin";
    const result = buildCustomPasswordResetLink(rawFirebaseLink, env);
    const parsed = new URL(result);
    expect(parsed.origin + parsed.pathname).toBe("https://www.lilycrest.space/auth-action");
    expect(parsed.searchParams.get("mode")).toBe("resetPassword");
    expect(parsed.searchParams.get("oobCode")).toBe("abc123");
    expect(parsed.searchParams.get("apiKey")).toBe("fake-key");
    expect(parsed.searchParams.get("lang")).toBe("en");
  });

  test("rewrites a link hosted on a Vercel deployment domain (the actual observed defect) onto the canonical domain", () => {
    const rawFirebaseLink =
      "https://lilycrest-dormitory.vercel.app/auth-action?mode=resetPassword&oobCode=xyz789&apiKey=fake-key";
    const result = buildCustomPasswordResetLink(rawFirebaseLink, env);
    expect(result).not.toContain("vercel.app");
    expect(result.startsWith("https://www.lilycrest.space/auth-action?")).toBe(true);
    expect(new URL(result).searchParams.get("oobCode")).toBe("xyz789");
  });

  test("does not propagate continueUrl or any other extraneous query parameter onto the rebuilt link", () => {
    const rawFirebaseLink =
      "https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc123&apiKey=fake-key&continueUrl=https%3A%2F%2Fattacker.example%2Fphish&someOtherParam=1";
    const result = buildCustomPasswordResetLink(rawFirebaseLink, env);
    expect(result).not.toContain("attacker.example");
    expect(result).not.toContain("continueUrl");
    expect(result).not.toContain("someOtherParam");
  });

  test("never derives the host from localhost or any non-configured value", () => {
    const rawFirebaseLink = "http://localhost:9099/__/auth/action?mode=resetPassword&oobCode=abc123&apiKey=fake-key";
    const result = buildCustomPasswordResetLink(rawFirebaseLink, env);
    expect(result.startsWith("https://www.lilycrest.space/auth-action?")).toBe(true);
  });
});
