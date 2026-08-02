import { describe, expect, test } from "@jest/globals";
import {
  SESSION_ASSURANCE_METHODS,
  isSessionAuthorizedForRole,
} from "./sessionAssurance.js";

const otpAt = new Date("2026-08-02T00:00:00.000Z");

describe("application-session assurance policy", () => {
  test.each([
    [SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN, "applicant", null],
    [SESSION_ASSURANCE_METHODS.LOGIN_OTP, "applicant", otpAt],
    [SESSION_ASSURANCE_METHODS.LOGIN_OTP, "tenant", otpAt],
    [SESSION_ASSURANCE_METHODS.OAUTH, "applicant", null],
    [SESSION_ASSURANCE_METHODS.OAUTH, "tenant", null],
    [SESSION_ASSURANCE_METHODS.OAUTH, "branch_admin", null],
    [SESSION_ASSURANCE_METHODS.OAUTH, "owner", null],
    [SESSION_ASSURANCE_METHODS.ADMIN_PASSWORD, "branch_admin", null],
    [SESSION_ASSURANCE_METHODS.ADMIN_PASSWORD, "owner", null],
  ])("accepts %s for %s", (assuranceMethod, role, otpVerifiedAt) => {
    expect(isSessionAuthorizedForRole({ assuranceMethod, otpVerifiedAt }, role)).toBe(true);
  });

  test.each([
    [SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN, "tenant", null],
    [SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN, "branch_admin", null],
    [SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN, "owner", null],
    [SESSION_ASSURANCE_METHODS.ADMIN_PASSWORD, "applicant", null],
    [SESSION_ASSURANCE_METHODS.ADMIN_PASSWORD, "tenant", null],
    [SESSION_ASSURANCE_METHODS.LOGIN_OTP, "branch_admin", otpAt],
    [SESSION_ASSURANCE_METHODS.LOGIN_OTP, "owner", otpAt],
    [SESSION_ASSURANCE_METHODS.LOGIN_OTP, "tenant", null],
  ])("rejects %s for disallowed or insufficient role %s", (assuranceMethod, role, otpVerifiedAt) => {
    expect(isSessionAuthorizedForRole({ assuranceMethod, otpVerifiedAt }, role)).toBe(false);
  });

  test("unknown explicit assurance fails closed with or without OTP evidence", () => {
    expect(isSessionAuthorizedForRole({ assuranceMethod: "login_otpp", otpVerifiedAt: otpAt }, "tenant")).toBe(false);
    expect(isSessionAuthorizedForRole({ assuranceMethod: "arbitrary", otpVerifiedAt: null }, "applicant")).toBe(false);
  });

  test("legacy null assurance requires valid OTP evidence and an end-user role", () => {
    expect(isSessionAuthorizedForRole({ assuranceMethod: null, otpVerifiedAt: otpAt }, "applicant")).toBe(true);
    expect(isSessionAuthorizedForRole({ assuranceMethod: null, otpVerifiedAt: otpAt }, "tenant")).toBe(true);
    expect(isSessionAuthorizedForRole({ assuranceMethod: null, otpVerifiedAt: null }, "tenant")).toBe(false);
    expect(isSessionAuthorizedForRole({ assuranceMethod: null, otpVerifiedAt: otpAt }, "owner")).toBe(false);
  });

  test.each([
    [{ otpVerifiedAt: otpAt }, "missing assurance"],
    [{ assuranceMethod: 42, otpVerifiedAt: otpAt }, "invalid numeric assurance"],
    [{ assuranceMethod: {}, otpVerifiedAt: otpAt }, "malformed assurance"],
    [{ assuranceMethod: SESSION_ASSURANCE_METHODS.LOGIN_OTP, otpVerifiedAt: "not-a-date" }, "malformed OTP evidence"],
    [null, "missing session"],
  ])("rejects %s", (session) => {
    expect(isSessionAuthorizedForRole(session, "tenant")).toBe(false);
  });
});
