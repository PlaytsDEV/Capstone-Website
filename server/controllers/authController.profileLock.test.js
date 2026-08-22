import { describe, expect, test } from "@jest/globals";
import {
  findLockedTenantProfileFields,
  TENANT_APPLICATION_LOCKED_PROFILE_FIELDS,
} from "./authController.js";

describe("tenant application profile updates", () => {
  test("profile details are not locked before application submission", () => {
    const attempted = {
      firstName: "UpdatedName",
      lastName: "UpdatedLast",
      occupation: "Engineer",
      profileImage: "https://example.test/photo.jpg",
    };
    expect(findLockedTenantProfileFields(attempted, false)).toEqual([]);
  });

  test("identity fields are detected when locked is true", () => {
    const attempted = {
      firstName: "UpdatedName",
      lastName: "UpdatedLast",
      occupation: "Engineer",
      profileImage: "https://example.test/photo.jpg",
    };
    const locked = findLockedTenantProfileFields(attempted, true);
    expect(locked).toContain("firstName");
    expect(locked).toContain("lastName");
    expect(locked).toContain("occupation");
    expect(locked).not.toContain("profileImage");
  });

  test("profileImage is never in TENANT_APPLICATION_LOCKED_PROFILE_FIELDS", () => {
    expect(TENANT_APPLICATION_LOCKED_PROFILE_FIELDS).not.toContain("profileImage");
  });
});
