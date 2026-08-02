import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCustomEmailVerificationLink,
  createOpaqueExchangeToken,
  getExchangeExpiry,
  hashExchangeToken,
  maskEmail,
  normalizeVerificationContinuation,
} from "./emailVerificationService.js";

const env = {
  NODE_ENV: "production",
  PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
  PUBLIC_API_URL: "https://api.lilycrest.space",
  EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
  RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
  EMAIL_VERIFICATION_SECRET: "test-only-secret-with-enough-entropy",
};

describe("opaque email verification exchange", () => {
  test("creates random opaque tokens and stores a non-reversible keyed hash", () => {
    const token = createOpaqueExchangeToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashExchangeToken(token, env)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashExchangeToken(token, env)).not.toContain(token);
    expect(() => hashExchangeToken(`${token}x`, env)).toThrow("INVALID_EXCHANGE_TOKEN");
    expect(maskEmail("leigh@example.com")).toBe("l****@example.com");
  });

  test("uses a one-hour default action exchange lifetime", () => {
    const now = Date.UTC(2026, 0, 1);
    expect(getExchangeExpiry(env, now).getTime()).toBe(now + 60 * 60 * 1000);
  });

  test("rejects external reservation continuation", () => {
    expect(normalizeVerificationContinuation("//evil.example/steal", env)).toBe("/signin");
    expect(normalizeVerificationContinuation("/applicant/reservation?step=1", env)).toBe("/applicant/reservation?step=1");
  });

  test("rewrites Firebase links with only a short-lived opaque exchange identifier", () => {
    const exchangeToken = createOpaqueExchangeToken();
    const link = buildCustomEmailVerificationLink({
      firebaseLink: "https://project.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=one-time-code&apiKey=public-key",
      exchangeToken,
    }, env);
    const parsed = new URL(link);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(env.EMAIL_ACTION_URL);
    expect(parsed.searchParams.get("mode")).toBe("verifyEmail");
    expect(parsed.searchParams.get("oobCode")).toBe("one-time-code");
    expect(parsed.searchParams.get("exchange")).toBe(exchangeToken);
    expect(parsed.searchParams.has("context")).toBe(false);
    expect(parsed.searchParams.has("continueUrl")).toBe(false);
  });

  test("runtime verification code contains no Vercel host or sensitive-link logging", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const files = [
      path.join(root, "controllers/emailVerificationController.js"),
      path.join(root, "services/emailVerificationService.js"),
      path.join(root, "config/email.js"),
    ];
    const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/vercel\.app/i);
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:oobCode|exchangeToken|verificationLink)/);
    expect(source).not.toMatch(/logger\.(?:info|warn|error)\([^\n]*(?:exchangeToken|verificationLink)/);
  });
});
