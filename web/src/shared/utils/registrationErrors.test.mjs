import assert from "node:assert/strict";
import test from "node:test";
import { getRegistrationErrorMessage } from "./registrationErrors.js";

const RAW_LEAK_PATTERNS = [
  /auth\//i,
  /VALIDATION_ERROR/,
  /OTP_SESSION_REQUIRED/,
  /RATE_LIMIT/,
  /Bad Request/i,
  /MongoDB/i,
  /at\s+\w+\s*\(/, // stack trace frame
];

function assertNoLeak(message) {
  assert.equal(typeof message, "string");
  assert.ok(message.length > 0);
  for (const pattern of RAW_LEAK_PATTERNS) {
    assert.doesNotMatch(message, pattern);
  }
}

test("maps Firebase auth/email-already-in-use to a friendly, actionable message", () => {
  const message = getRegistrationErrorMessage({ code: "auth/email-already-in-use" }, "signup");
  assertNoLeak(message);
  assert.match(message, /already exists/i);
  assert.match(message, /sign in/i);
});

test("maps backend VALIDATION_ERROR without leaking the raw code", () => {
  const error = new Error("Validation failed");
  error.code = "VALIDATION_ERROR";
  error.response = { data: { error: "Validation failed", code: "VALIDATION_ERROR" } };
  assertNoLeak(getRegistrationErrorMessage(error));
});

test("maps OTP-related backend codes to plain language", () => {
  const cases = [
    ["OTP_SESSION_REQUIRED", /session/i],
    ["OTP_EXPIRED", /expired/i],
    ["OTP_INVALID", /incorrect/i],
    ["OTP_ATTEMPTS_EXCEEDED", /too many/i],
    ["RATE_LIMIT_EXCEEDED", /wait/i],
  ];
  for (const [code, expected] of cases) {
    const error = new Error(code);
    error.code = code;
    const message = getRegistrationErrorMessage(error);
    assertNoLeak(message);
    assert.match(message, expected);
  }
});

test("network failures produce a connectivity message, not a raw fetch error", () => {
  const error = new TypeError("Failed to fetch");
  const message = getRegistrationErrorMessage(error);
  assertNoLeak(message);
  assert.match(message, /connect/i);
});

test("server 5xx failures produce a generic retry message", () => {
  const error = new Error("Internal Server Error");
  error.response = { status: 500 };
  const message = getRegistrationErrorMessage(error);
  assertNoLeak(message);
});

test("unknown/unmapped errors fall back to the safe generic registration message, never raw text", () => {
  const error = new Error("ECONNREFUSED 127.0.0.1:27017 MongoDB connection error");
  const message = getRegistrationErrorMessage(error);
  assertNoLeak(message);
  assert.match(message, /could not (complete|connect)/i);
});

test("a null/undefined error still returns safe copy", () => {
  assertNoLeak(getRegistrationErrorMessage(null));
  assertNoLeak(getRegistrationErrorMessage(undefined));
});
