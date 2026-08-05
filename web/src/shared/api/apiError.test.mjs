import assert from "node:assert/strict";
import test from "node:test";
import { getApiErrorCode, normalizeVerificationErrorCode } from "./apiError.js";

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
