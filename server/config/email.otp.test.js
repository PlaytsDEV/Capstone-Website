import { describe, expect, jest, test } from "@jest/globals";
import {
  buildLoginOtpMessage,
  classifyOtpEmailError,
  normalizeOtpEmailResponse,
} from "./email.js";

describe("login OTP email failure classification", () => {
  test.each([
    [{ statusCode: 400, name: "validation_error", message: "API key is invalid" }, "invalid_api_key"],
    [{ statusCode: 401, name: "validation_error", message: "request rejected" }, "invalid_api_key"],
    [{ statusCode: 403, message: "sender domain is not verified" }, "sender_rejection"],
    [{ statusCode: 422, message: "from address domain is not verified" }, "sender_rejection"],
    [{ statusCode: 429, message: "rate limit exceeded" }, "rate_limit"],
    [{ code: "ETIMEDOUT", message: "request timed out" }, "timeout"],
    [{ statusCode: 400, message: "request rejected" }, "provider_rejected"],
    [{ code: "ECONNREFUSED", message: "network unavailable" }, "network"],
    [{ message: "unexpected transport failure" }, "unknown"],
  ])("classifies sanitized provider failures", (error, category) => {
    const result = classifyOtpEmailError(error);
    expect(result.category).toBe(category);
    expect(result).not.toHaveProperty("message");
  });

  test("classification never echoes provider credentials or response bodies", () => {
    const result = classifyOtpEmailError({
      statusCode: 401,
      name: "validation_error",
      message: "API key is invalid: secret-value",
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });
});

describe("login OTP provider result normalization", () => {
  test("only a positive provider message identifier is accepted", () => {
    expect(normalizeOtpEmailResponse({ data: { id: "message-1" } })).toEqual({
      success: true,
      category: "accepted",
      messageId: "message-1",
    });
    expect(normalizeOtpEmailResponse({ data: {} })).toMatchObject({
      success: false,
      category: "unexpected_response",
    });
    expect(normalizeOtpEmailResponse()).toMatchObject({
      success: false,
      category: "unexpected_response",
    });
  });

  test("a returned provider error is rejected even when data is also present", () => {
    expect(normalizeOtpEmailResponse({
      data: { id: "must-not-be-accepted" },
      error: { statusCode: 400, message: "API key invalid" },
    })).toMatchObject({ success: false, category: "invalid_api_key" });
  });
});

describe("login OTP message content", () => {
  test("HTML and plaintext alternatives contain the intended OTP without logging it", () => {
    const otp = "731946";
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const message = buildLoginOtpMessage({
      to: "controlled@example.test", name: "Test\r\nInjected", otp, expiresInMinutes: 10,
    });
    expect(message.html).toContain(otp);
    expect(message.text).toContain(otp);
    expect(message.text).not.toContain("\r\n");
    expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(otp);
    log.mockRestore();
    error.mockRestore();
  });

  test("delivery failure classification never includes an OTP", () => {
    const result = classifyOtpEmailError({ statusCode: 401, message: "API key invalid; request rejected" });
    expect(JSON.stringify(result)).not.toMatch(/\b\d{6}\b/);
  });
});
