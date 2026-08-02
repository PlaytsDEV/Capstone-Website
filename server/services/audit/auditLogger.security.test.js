import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const auditLog = jest.fn();

await jest.unstable_mockModule("../../models/AuditLog.js", () => ({
  default: { log: auditLog },
}));

const { default: auditLogger } = await import("./auditLogger.js");

describe("authentication audit log sanitization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
  });

  test("recursively redacts OTP, device, session, Firebase, token, and API key fields", () => {
    const sanitized = auditLogger.sanitizeData({
      otp: "731946",
      nested: {
        otpCode: "731946",
        deviceId: "device-private",
        session_id: "session-private",
        firebaseUid: "firebase-private",
        authorization: "Bearer private",
        apiKey: "api-key-private",
        safe: "retained",
      },
    });

    expect(sanitized.otp).toBe("[REDACTED]");
    expect(sanitized.nested.safe).toBe("retained");
    expect(JSON.stringify(sanitized)).not.toMatch(
      /731946|device-private|session-private|firebase-private|Bearer private|api-key-private/,
    );
  });

  test("login and error audit records use an email fingerprint and never copy the OTP", async () => {
    const req = {
      user: { email: "controlled@example.test" },
      headers: { "user-agent": "Test Agent" },
      body: { otp: "731946" },
      method: "POST",
      path: "/api/auth/verify-otp",
      ip: "127.0.0.1",
    };

    await auditLogger.logLogin(req, { _id: "user-1", email: "controlled@example.test", role: "tenant" });
    await auditLogger.logError(req, new Error("Safe verification failure"), "OTP verification error");

    const output = JSON.stringify(auditLog.mock.calls);
    expect(output).not.toContain("controlled@example.test");
    expect(output).not.toContain("731946");
    expect(output).toContain("sha256:");
    expect(auditLog.mock.calls[1][0].metadata.body.otp).toBe("[REDACTED]");
  });
});
