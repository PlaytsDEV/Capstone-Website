import { describe, expect, test } from "@jest/globals";

import {
  getNotificationVisibilityFilterForRole,
  isNotificationVisibleForRole,
} from "./notificationVisibility.js";

test("server applicant visibility allows only applicant reservation/application contexts", () => {
  expect(isNotificationVisibleForRole({ type: "reservation_confirmed" }, "applicant")).toBe(true);
  expect(
    isNotificationVisibleForRole({
      type: "general",
      title: "Application Approved for Payment",
      actionUrl: "/applicant/reservation",
    }, "applicant")
  ).toBe(true);
  expect(isNotificationVisibleForRole({ type: "maintenance_update" }, "applicant")).toBe(false);
  expect(
    isNotificationVisibleForRole({
      type: "general",
      title: "Unactioned Visit Request",
      actionUrl: "/admin/reservations",
    }, "applicant")
  ).toBe(false);
});

test("server tenant visibility allows tenant workstream updates only", () => {
  expect(isNotificationVisibleForRole({ type: "bill_due_reminder" }, "tenant")).toBe(true);
  expect(
    isNotificationVisibleForRole({
      type: "general",
      title: "Room Transfer",
      entityType: "stay",
    }, "tenant")
  ).toBe(true);
  expect(isNotificationVisibleForRole({ type: "visit_approved" }, "tenant")).toBe(false);
});

test("server admin visibility keeps operational alerts separate", () => {
  expect(
    isNotificationVisibleForRole({
      type: "general",
      title: "Payment Received",
      actionUrl: "/admin/billing",
    }, "owner")
  ).toBe(true);
  expect(isNotificationVisibleForRole({ type: "chat_unresponded" }, "branch_admin")).toBe(true);
  expect(isNotificationVisibleForRole({ type: "bill_generated" }, "branch_admin")).toBe(false);
  expect(isNotificationVisibleForRole({ type: "visit_rejected" }, "branch_admin")).toBe(false);
});

test("server mongo filters are scoped by role", () => {
  const applicantFilter = getNotificationVisibilityFilterForRole("applicant");
  const tenantFilter = getNotificationVisibilityFilterForRole("tenant");
  const adminFilter = getNotificationVisibilityFilterForRole("branch_admin");

  expect(applicantFilter.$or).toBeTruthy();
  expect(tenantFilter.$or).toBeTruthy();
  expect(adminFilter.type.$in.includes("general")).toBe(true);
  expect(adminFilter.type.$in.includes("bill_generated")).toBe(false);
});
