import { describe, expect, test } from "@jest/globals";
import {
  findLockedTenantProfileFields,
  TENANT_APPLICATION_LOCKED_PROFILE_FIELDS,
} from "./authController.js";

describe("tenant application profile updates", () => {
  test("tenant may update profile details and profile image directly", () => {
    const attempted = {
      firstName: "UpdatedName",
      lastName: "UpdatedLast",
      occupation: "Engineer",
      profileImage: "https://example.test/photo.jpg",
    };
    expect(findLockedTenantProfileFields(attempted, "tenant")).toEqual([]);
  });

  test("admin profile behavior is not restricted", () => {
    expect(findLockedTenantProfileFields({ firstName: "Admin" }, "admin")).toEqual([]);
  });
});
