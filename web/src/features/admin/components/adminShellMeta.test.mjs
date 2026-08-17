import test from "node:test";
import assert from "node:assert/strict";
import { getPageMeta } from "./adminShellMeta.mjs";
import { getSidebarBrandMeta, getVisibleNavItems } from "./sidebarConfig.mjs";

test("dashboard copy stays operations-focused", () => {
  const meta = getPageMeta("/admin/dashboard");

  assert.equal(meta.title, "Dashboard");
  assert.match(meta.description, /operations view/i);
  assert.doesNotMatch(meta.description, /owner-only oversight/i);
});

test("analytics summary and detail copy stay distinct", () => {
  const summaryMeta = getPageMeta("/admin/analytics");
  const financialsMeta = getPageMeta(
    "/admin/analytics/details",
    "?tab=financials",
  );

  assert.match(summaryMeta.description, /consolidated analytics overview/i);
  assert.match(financialsMeta.description, /owner financial performance/i);
});

test("sidebar branding stays workspace-first for both branch admins and owners", () => {
  assert.deepEqual(getSidebarBrandMeta(false), {
    title: "Lilycrest",
    subtitle: "Operations Workspace",
    roleLabel: "Branch Admin",
  });

  assert.deepEqual(getSidebarBrandMeta(true), {
    title: "Lilycrest",
    subtitle: "Operations Workspace",
    roleLabel: "Owner",
  });
});

test("owners keep owner-only routes while branch admins stay on shared workspace items", () => {
  const branchAdminItems = getVisibleNavItems({ isOwner: false, can: () => false });
  const ownerItems = getVisibleNavItems({ isOwner: true, can: () => true });

  assert.equal(branchAdminItems.some((item) => item.to === "/admin/branches"), false);
  assert.equal(branchAdminItems.some((item) => item.to === "/admin/settings"), false);
  assert.equal(branchAdminItems.some((item) => item.to === "/admin/users"), false);
  assert.equal(branchAdminItems.some((item) => item.to === "/admin/audit-logs"), false);
  assert.equal(ownerItems.some((item) => item.to === "/admin/branches"), true);
  assert.equal(ownerItems.some((item) => item.to === "/admin/settings"), true);
  assert.equal(ownerItems.some((item) => item.to === "/admin/users"), true);
  assert.equal(ownerItems.some((item) => item.to === "/admin/audit-logs"), true);
});

test("system navigation labels and ordering match the consolidated IA", () => {
  const ownerItems = getVisibleNavItems({ isOwner: true, can: () => true })
    .filter((item) => item.group === "system")
    .map((item) => ({ to: item.to, text: item.text }));

  assert.deepEqual(ownerItems, [
    { to: "/admin/users", text: "Accounts & Access" },
    { to: "/admin/branches", text: "Branches" },
    { to: "/admin/audit-logs", text: "Audit & Security" },
    { to: "/admin/settings", text: "Policies & Maintenance" },
  ]);
});

test("system topbar copy uses the consolidated labels", () => {
  const userMeta = getPageMeta("/admin/users");
  assert.equal(userMeta.title, "Accounts & Access");
  assert.equal(
    userMeta.description,
    "Manage user accounts, credentials, and configure granular branch admin access permissions.",
  );

  const auditMeta = getPageMeta("/admin/audit-logs");
  assert.equal(auditMeta.title, "Audit & Security");
  assert.equal(
    auditMeta.description,
    "Review audit events, trace administrative changes, and inspect security-relevant activity.",
  );

  const settingsMeta = getPageMeta("/admin/settings");
  assert.equal(settingsMeta.title, "Policies & Maintenance");
  assert.equal(
    settingsMeta.description,
    "Control platform policies, defaults, branch overrides, and manage database backup and recovery.",
  );
});



test("contract list and detail routes share Contract workspace metadata", () => {
  assert.equal(getPageMeta("/admin/contracts").title, "Contracts");
  assert.equal(getPageMeta("/admin/contracts/507f1f77bcf86cd799439011").title, "Contracts");
});

test("dynamic 3-level breadcrumbs are generated for multi-tab pages", () => {
  const analyticsOverview = getPageMeta("/admin/analytics");
  assert.deepEqual(analyticsOverview.breadcrumbs, [
    { label: "Admin", href: "/admin/dashboard" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Overview" },
  ]);

  const analyticsOccupancy = getPageMeta("/admin/analytics", "?tab=occupancy");
  assert.deepEqual(analyticsOccupancy.breadcrumbs, [
    { label: "Admin", href: "/admin/dashboard" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Occupancy" },
  ]);

  const billingWater = getPageMeta("/admin/billing", "?tab=water");
  assert.deepEqual(billingWater.breadcrumbs, [
    { label: "Admin", href: "/admin/dashboard" },
    { label: "Billing", href: "/admin/billing" },
    { label: "Water" },
  ]);

  const roomForecast = getPageMeta("/admin/room-availability", "?tab=forecast");
  assert.deepEqual(roomForecast.breadcrumbs, [
    { label: "Admin", href: "/admin/dashboard" },
    { label: "Room Management", href: "/admin/room-availability" },
    { label: "Vacancy Forecast" },
  ]);

  const tenantRenewals = getPageMeta("/admin/tenants", "?tab=renewals");
  assert.deepEqual(tenantRenewals.breadcrumbs, [
    { label: "Admin", href: "/admin/dashboard" },
    { label: "Tenants", href: "/admin/tenants" },
    { label: "Lease Renewals" },
  ]);

  const userRoles = getPageMeta("/admin/users", "?tab=roles");
  assert.deepEqual(userRoles.breadcrumbs, [
    { label: "Admin", href: "/admin/dashboard" },
    { label: "Accounts & Access", href: "/admin/users" },
    { label: "Roles & Permissions" },
  ]);
});

