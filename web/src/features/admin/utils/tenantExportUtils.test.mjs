import test from "node:test";
import assert from "node:assert/strict";
import {
  TENANT_CSV_COLUMNS,
  formatDate,
  formatTenantsForCSV,
  sanitizeSlug,
} from "./tenantExportUtils.js";

test("TENANT_CSV_COLUMNS has required standard headers", () => {
  const keys = TENANT_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("tenantName"));
  assert.ok(keys.includes("email"));
  assert.ok(keys.includes("phone"));
  assert.ok(keys.includes("branch"));
  assert.ok(keys.includes("room"));
  assert.ok(keys.includes("leaseEndDate"));
  assert.ok(keys.includes("paymentStatus"));
  assert.ok(keys.includes("leaseStatus"));
  assert.ok(keys.includes("stayStatus"));
  assert.ok(keys.includes("nextAction"));
});

test("formatDate handles ISO strings, nulls, and invalid dates", () => {
  assert.equal(formatDate("2026-09-01T00:00:00.000Z"), "2026-09-01");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("invalid-date-string"), "—");
});

test("sanitizeSlug cleans branch names cleanly", () => {
  assert.equal(sanitizeSlug("Gil Puyat"), "gil_puyat");
  assert.equal(sanitizeSlug("all"), "all");
  assert.equal(sanitizeSlug(""), "all");
});

test("formatTenantsForCSV formats tenant records safely with fallbacks", () => {
  const mockTenants = [
    {
      tenantName: "Maria Clara",
      contact: { email: "maria@example.com", phone: "09171234567" },
      branch: "gil-puyat",
      room: "Room 101",
      bed: "Bed A",
      leaseEndDate: "2026-12-31T00:00:00.000Z",
      daysUntilLeaseEnd: 136,
      paymentStatus: "paid",
      leaseStatus: "active",
      stayStatus: "active",
      nextActionLabel: "No Action Needed",
    },
    {
      tenantName: "Crisostomo Ibarra",
      email: "ibarra@example.com",
      phone: "09181234567",
      branch: "guadalupe",
      room: "Room 202",
      bed: "Bed B",
      leaseEndDate: null,
      daysUntilLeaseEnd: null,
      paymentStatus: "overdue",
      leaseStatus: "expiring_soon",
      stayStatus: "moving_out",
      nextAction: "review_overdue_account",
    },
  ];

  const rows = formatTenantsForCSV(mockTenants);
  assert.equal(rows.length, 2);

  assert.equal(rows[0].tenantName, "Maria Clara");
  assert.equal(rows[0].email, "maria@example.com");
  assert.equal(rows[0].phone, "09171234567");
  assert.equal(rows[0].branch, "Gil Puyat");
  assert.equal(rows[0].leaseEndDate, "2026-12-31");
  assert.equal(rows[0].daysUntilLeaseEnd, "136 days");
  assert.equal(rows[0].paymentStatus, "PAID");
  assert.equal(rows[0].leaseStatus, "ACTIVE");

  assert.equal(rows[1].tenantName, "Crisostomo Ibarra");
  assert.equal(rows[1].daysUntilLeaseEnd, "—");
  assert.equal(rows[1].leaseEndDate, "—");
  assert.equal(rows[1].paymentStatus, "OVERDUE");
  assert.equal(rows[1].leaseStatus, "EXPIRING SOON");
  assert.equal(rows[1].stayStatus, "MOVING OUT");
});
