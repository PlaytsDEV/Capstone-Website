import test from "node:test";
import assert from "node:assert/strict";

import {
  getNotificationVisibilityFilterForRole,
  isNotificationVisibleForRole,
} from "./notificationVisibility.js";

test("server applicant visibility allows only applicant reservation/application contexts", () => {
  assert.equal(isNotificationVisibleForRole({ type: "reservation_confirmed" }, "applicant"), true);
  assert.equal(
    isNotificationVisibleForRole({
      type: "general",
      title: "Application Approved for Payment",
      actionUrl: "/applicant/reservation",
    }, "applicant"),
    true,
  );
  assert.equal(isNotificationVisibleForRole({ type: "maintenance_update" }, "applicant"), false);
  assert.equal(
    isNotificationVisibleForRole({
      type: "general",
      title: "Unactioned Visit Request",
      actionUrl: "/admin/reservations",
    }, "applicant"),
    false,
  );
});

test("server tenant visibility allows tenant workstream updates only", () => {
  assert.equal(isNotificationVisibleForRole({ type: "bill_due_reminder" }, "tenant"), true);
  assert.equal(
    isNotificationVisibleForRole({
      type: "general",
      title: "Room Transfer",
      entityType: "stay",
    }, "tenant"),
    true,
  );
  assert.equal(isNotificationVisibleForRole({ type: "visit_approved" }, "tenant"), false);
});

test("server admin visibility keeps operational alerts separate", () => {
  assert.equal(
    isNotificationVisibleForRole({
      type: "general",
      title: "Payment Received",
      actionUrl: "/admin/billing",
    }, "owner"),
    true,
  );
  assert.equal(isNotificationVisibleForRole({ type: "chat_unresponded" }, "branch_admin"), true);
  assert.equal(isNotificationVisibleForRole({ type: "bill_generated" }, "branch_admin"), false);
  assert.equal(isNotificationVisibleForRole({ type: "visit_rejected" }, "branch_admin"), false);
});

test("server mongo filters are scoped by role", () => {
  const applicantFilter = getNotificationVisibilityFilterForRole("applicant");
  const tenantFilter = getNotificationVisibilityFilterForRole("tenant");
  const adminFilter = getNotificationVisibilityFilterForRole("branch_admin");

  assert.ok(applicantFilter.$or);
  assert.ok(tenantFilter.$or);
  assert.deepEqual(adminFilter.type.$in.includes("general"), true);
  assert.deepEqual(adminFilter.type.$in.includes("bill_generated"), false);
});
