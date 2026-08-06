import assert from "node:assert/strict";
import test from "node:test";
import {
  getApiErrorCode,
  normalizeVerificationErrorCode,
  resolveResendVerificationMessage,
} from "./apiError.js";

test("reads top-level rate-limit code", () => {
  assert.equal(getApiErrorCode({ code: "RATE_LIMITED" }), "RATE_LIMITED");
});

test("reads nested error code", () => {
  assert.equal(getApiErrorCode({ error: { code: "RATE_LIMIT_EXCEEDED" } }), "RATE_LIMIT_EXCEEDED");
});

test("reads Axios-style nested response data code", () => {
  assert.equal(getApiErrorCode({ response: { data: { error: { code: "RATE_LIMITED" } } } }), "RATE_LIMITED");
});

test("canonicalizes rate limits and cooldowns", () => {
  for (const code of ["RATE_LIMITED", "RATE_LIMIT_EXCEEDED", "COOLDOWN_ACTIVE"]) {
    assert.equal(normalizeVerificationErrorCode({ code }, "fallback"), "RATE_LIMITED_OR_COOLDOWN_ACTIVE");
  }
});

test("uses the supplied fallback for unknown errors", () => {
  assert.equal(normalizeVerificationErrorCode({}, "INVALID_OR_TAMPERED_LINK"), "INVALID_OR_TAMPERED_LINK");
});

test("resolveResendVerificationMessage: cooldown/rate-limit takes priority and never names a provider", () => {
  const byState = resolveResendVerificationMessage({ response: { data: { state: "RATE_LIMITED_OR_COOLDOWN_ACTIVE" } } });
  assert.match(byState, /wait/i);
  const byFirebaseCode = resolveResendVerificationMessage({ code: "auth/too-many-requests" });
  assert.match(byFirebaseCode, /wait/i);
});

test("resolveResendVerificationMessage: wrong password stays a distinct, separate message", () => {
  assert.match(resolveResendVerificationMessage({ code: "auth/wrong-password" }), /password/i);
  assert.match(resolveResendVerificationMessage({ code: "auth/invalid-credential" }), /password/i);
});

test("resolveResendVerificationMessage: surfaces the backend's stable delivery-failure message verbatim", () => {
  const message = resolveResendVerificationMessage({
    response: {
      data: {
        state: "VERIFICATION_EMAIL_SEND_FAILED",
        message: "We could not deliver the verification email to this address. Please check the address and try again.",
      },
    },
  });
  assert.equal(
    message,
    "We could not deliver the verification email to this address. Please check the address and try again.",
  );
});

test("resolveResendVerificationMessage: falls back to a generic message when the server sends none", () => {
  const message = resolveResendVerificationMessage({ response: { data: { state: "VERIFICATION_EMAIL_SEND_FAILED" } } });
  assert.match(message, /could not send a new verification link/i);
});

test("resolveResendVerificationMessage: never names SMTP, Gmail, Firebase, or Resend regardless of input", () => {
  const scenarios = [
    { response: { data: { state: "RATE_LIMITED_OR_COOLDOWN_ACTIVE" } } },
    { code: "auth/wrong-password" },
    { response: { data: { state: "VERIFICATION_EMAIL_SEND_FAILED", message: "Email service is temporarily unavailable. Please try again later." } } },
    { response: { data: { state: "VERIFICATION_EMAIL_SEND_FAILED" } } },
    {},
    null,
    undefined,
  ];
  for (const err of scenarios) {
    const message = resolveResendVerificationMessage(err).toLowerCase();
    for (const forbidden of ["smtp", "gmail", "firebase", "resend"]) {
      assert.ok(!message.includes(forbidden), `message must not mention "${forbidden}": ${message}`);
    }
  }
});

test("resolveResendVerificationMessage handles null/undefined input without throwing", () => {
  assert.doesNotThrow(() => resolveResendVerificationMessage(null));
  assert.doesNotThrow(() => resolveResendVerificationMessage(undefined));
});
