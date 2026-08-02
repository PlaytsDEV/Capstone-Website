import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCustomEmailVerificationLink,
  createVerificationContext,
  maskEmail,
  normalizeVerificationContinuation,
  verifyVerificationContext,
} from "./emailVerificationService.js";

const env = {
  NODE_ENV: "production",
  PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
  PUBLIC_API_URL: "https://api.lilycrest.space",
  EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
  RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
  EMAIL_VERIFICATION_SECRET: "test-only-secret-with-enough-entropy",
};

describe("signed email verification context", () => {
  test("round-trips Firebase identity and trusted reservation continuation", () => {
    const token = createVerificationContext({ uid: "firebase-uid", email: "leigh@example.com", continuePath: "/applicant/reservation?step=1" }, env);
    expect(verifyVerificationContext(token, env)).toMatchObject({ uid: "firebase-uid", continuePath: "/applicant/reservation?step=1" });
    expect(maskEmail("leigh@example.com")).toBe("l****@example.com");
  });

  test("rejects tampering and external continuation", () => {
    const token = createVerificationContext({ uid: "firebase-uid", email: "leigh@example.com", continuePath: "https://evil.example/steal" }, env);
    expect(verifyVerificationContext(token, env).continuePath).toBe("/signin");
    expect(() => verifyVerificationContext(`${token}x`, env)).toThrow("INVALID_CONTEXT");
    expect(normalizeVerificationContinuation("//evil.example/steal", env)).toBe("/signin");
  });

  test("rewrites Firebase links to the configured action handler without losing action parameters", () => {
    const token = createVerificationContext({ uid: "firebase-uid", email: "leigh@example.com" }, env);
    const link = buildCustomEmailVerificationLink({
      firebaseLink: "https://project.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=one-time-code&apiKey=public-key",
      verificationContext: token,
    }, env);
    const parsed = new URL(link);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(env.EMAIL_ACTION_URL);
    expect(parsed.searchParams.get("mode")).toBe("verifyEmail");
    expect(parsed.searchParams.get("oobCode")).toBe("one-time-code");
    expect(parsed.searchParams.get("continueUrl")).not.toContain("evil.example");
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
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:oobCode|verificationContext|verificationLink)/);
  });
});
