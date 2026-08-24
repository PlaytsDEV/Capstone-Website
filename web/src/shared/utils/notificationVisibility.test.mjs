import test from "node:test";
import assert from "node:assert/strict";

import {
  getNotificationQueryScope,
  getVisibleNotificationsForUser,
  isNotificationVisibleForUser,
} from "./notificationVisibility.js";

const applicant = { id: "applicant-1", role: "applicant" };
const tenant = { id: "tenant-1", role: "tenant" };
const admin = { id: "admin-1", role: "branch_admin" };

test("applicant notifications are limited to reservation, visit, and application updates", () => {
  assert.equal(
    isNotificationVisibleForUser({ type: "visit_approved" }, applicant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({
      type: "general",
      title: "Application Pending Review",
      actionUrl: "/applicant/reservation",
    }, applicant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "bill_generated" }, applicant),
    false,
  );
  assert.equal(
    isNotificationVisibleForUser({
      type: "general",
      title: "Reservation Payment Needs Review",
      actionUrl: "/admin/reservations",
    }, applicant),
    false,
  );
});

test("tenant notifications include billing, maintenance, contracts, chat, violations, and personal history", () => {
  assert.equal(
    isNotificationVisibleForUser({ type: "maintenance_update" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "contract_document_ready" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "chat_reply" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "renewal_effective" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "tenant_violation" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({
      type: "general",
      title: "Contract Renewed",
      entityType: "stay",
    }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({
      type: "general",
      title: "Lease Renewal Offer",
      entityType: "reservation",
    }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "visit_approved" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "reservation_confirmed" }, tenant),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({
      type: "general",
      title: "Payment Received",
      actionUrl: "/admin/billing",
    }, tenant),
    false,
  );
});

test("admin notifications remain operational and separate", () => {
  assert.equal(
    isNotificationVisibleForUser({
      type: "general",
      title: "Payment Received",
      actionUrl: "/admin/billing",
    }, admin),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "sla_breach" }, admin),
    true,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "bill_generated" }, admin),
    false,
  );
  assert.equal(
    isNotificationVisibleForUser({ type: "visit_approved" }, admin),
    false,
  );
});

test("visible notification lists and query scopes are role-aware", () => {
  const mixed = [
    { type: "visit_approved" },
    { type: "bill_generated" },
    { type: "general", title: "Application Pending Review", actionUrl: "/applicant/reservation" },
  ];

  assert.deepEqual(getVisibleNotificationsForUser(mixed, applicant), [
    mixed[0],
    mixed[2],
  ]);
  assert.equal(getNotificationQueryScope(applicant), "applicant:applicant-1");
  assert.equal(getNotificationQueryScope(tenant), "tenant:tenant-1");
});
