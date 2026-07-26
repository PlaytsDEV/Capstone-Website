import { describe, expect, test } from "@jest/globals";
import {
  findLockedTenantProfileFields,
  TENANT_APPLICATION_LOCKED_PROFILE_FIELDS,
} from "./authController.js";

describe("tenant application-derived profile protection", () => {
  test("tenant legal, contact, emergency, and employment fields are locked", () => {
    const attempted = Object.fromEntries(
      TENANT_APPLICATION_LOCKED_PROFILE_FIELDS.map((field) => [field, "changed"]),
    );
    expect(findLockedTenantProfileFields(attempted, "tenant"))
      .toEqual(TENANT_APPLICATION_LOCKED_PROFILE_FIELDS);
  });

  test("tenant may update a non-legal profile image without changing source data", () => {
    expect(findLockedTenantProfileFields({ profileImage: "https://example.test/photo.jpg" }, "tenant"))
      .toEqual([]);
  });

  test("admin profile behavior is not restricted by the tenant-only rule", () => {
    expect(findLockedTenantProfileFields({ firstName: "Admin" }, "admin")).toEqual([]);
  });
});
