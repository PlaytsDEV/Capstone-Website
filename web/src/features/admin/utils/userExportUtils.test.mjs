import test from "node:test";
import assert from "node:assert/strict";
import {
  USER_CSV_COLUMNS,
  formatUserRoleLabel,
  formatUserBranchLabel,
  formatUserStatusLabel,
  formatDate,
  formatUsersForCSV,
  sanitizeSlug,
} from "./userExportUtils.js";

test("USER_CSV_COLUMNS has required standard headers", () => {
  assert.ok(USER_CSV_COLUMNS.length >= 8);
  const keys = USER_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("fullName"));
  assert.ok(keys.includes("username"));
  assert.ok(keys.includes("email"));
  assert.ok(keys.includes("phone"));
  assert.ok(keys.includes("role"));
  assert.ok(keys.includes("branch"));
  assert.ok(keys.includes("status"));
  assert.ok(keys.includes("createdAt"));
});

test("formatUserRoleLabel returns human-readable roles", () => {
  assert.equal(formatUserRoleLabel("owner"), "Owner");
  assert.equal(formatUserRoleLabel("branch_admin"), "Branch Admin");
  assert.equal(formatUserRoleLabel("tenant"), "Tenant");
  assert.equal(formatUserRoleLabel("applicant"), "Applicant");
  assert.equal(formatUserRoleLabel(""), "Applicant");
  assert.equal(formatUserRoleLabel(null), "Applicant");
});

test("formatUserBranchLabel handles branch slugs cleanly", () => {
  assert.equal(formatUserBranchLabel("gil-puyat"), "Gil Puyat");
  assert.equal(formatUserBranchLabel("guadalupe"), "Guadalupe");
  assert.equal(formatUserBranchLabel(""), "Unassigned");
  assert.equal(formatUserBranchLabel(null), "Unassigned");
});

test("formatUserStatusLabel accurately resolves active, suspended, and archived states", () => {
  assert.equal(formatUserStatusLabel({ accountStatus: "active", isActive: true }), "Active");
  assert.equal(formatUserStatusLabel({ accountStatus: "suspended", isActive: false }), "Suspended");
  assert.equal(formatUserStatusLabel({ accountStatus: "banned", isActive: false }), "Blocked");
  assert.equal(formatUserStatusLabel({ isArchived: true, accountStatus: "active" }), "Archived");
  assert.equal(formatUserStatusLabel({ isArchived: false, isActive: false }), "Suspended");
});

test("formatDate handles ISO strings and empty values", () => {
  assert.equal(formatDate("2026-08-16T08:00:00.000Z"), "2026-08-16");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("invalid-date"), "—");
});

test("sanitizeSlug handles branch names cleanly", () => {
  assert.equal(sanitizeSlug("gil-puyat"), "gil_puyat");
  assert.equal(sanitizeSlug("All Branches"), "all_branches");
  assert.equal(sanitizeSlug(""), "all");
});

test("formatUsersForCSV formats users array safely with fallbacks", () => {
  const sample = [
    {
      firstName: "Maria",
      lastName: "Santos",
      username: "msantos",
      email: "maria.santos@example.com",
      phone: "+639171234567",
      role: "tenant",
      branch: "gil-puyat",
      accountStatus: "active",
      isActive: true,
      createdAt: "2026-01-15T00:00:00.000Z",
    },
    {
      firstName: "",
      lastName: "",
      username: "admin_user",
      email: "admin@lilycrest.com",
      phone: null,
      role: "branch_admin",
      branch: "guadalupe",
      accountStatus: "active",
      isActive: true,
      createdAt: "2026-02-01T00:00:00.000Z",
    },
    {
      username: "anonymous_ghost",
      isArchived: true,
    },
  ];

  const formatted = formatUsersForCSV(sample);
  assert.equal(formatted.length, 3);

  assert.equal(formatted[0].fullName, "Maria Santos");
  assert.equal(formatted[0].username, "msantos");
  assert.equal(formatted[0].email, "maria.santos@example.com");
  assert.equal(formatted[0].phone, "+639171234567");
  assert.equal(formatted[0].role, "Tenant");
  assert.equal(formatted[0].branch, "Gil Puyat");
  assert.equal(formatted[0].status, "Active");
  assert.equal(formatted[0].createdAt, "2026-01-15");

  assert.equal(formatted[1].fullName, "admin_user");
  assert.equal(formatted[1].role, "Branch Admin");
  assert.equal(formatted[1].branch, "Guadalupe");
  assert.equal(formatted[1].phone, "—");

  assert.equal(formatted[2].fullName, "anonymous_ghost");
  assert.equal(formatted[2].status, "Archived");
  assert.equal(formatted[2].branch, "Unassigned");
});
