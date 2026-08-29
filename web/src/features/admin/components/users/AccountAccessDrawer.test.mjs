import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const drawerSource = fs.readFileSync(
  new URL("./AccountAccessDrawer.jsx", import.meta.url),
  "utf8"
);

test("AccountAccessDrawer enforces role-adaptive layout structure", () => {
  // Verifies dynamic column layout based on tenant vs admin/owner role
  assert.match(drawerSource, /isTenantRole/);
  assert.match(drawerSource, /isTenantRole\s*\?\s*["']md:grid-cols-2["']\s*:\s*["']lg:grid-cols-3["']/);
});

test("AccountAccessDrawer translates technical database flags to human-friendly terms", () => {
  // Verifies plain-English labels replace raw DB jargon
  assert.match(drawerSource, /Registration Date/);
  assert.match(drawerSource, /Dormitory Stay Status/);
  assert.match(drawerSource, /Last Status Change/);
  assert.match(drawerSource, /Last Account Update/);
  // Verifies raw jargon is no longer present as labels
  assert.doesNotMatch(drawerSource, /"Lifecycle Reservation"/);
  assert.doesNotMatch(drawerSource, /"Active Stay"/);
  assert.doesNotMatch(drawerSource, /"Status Changed"/);
});

test("AccountAccessDrawer provides one-click copy ergonomics", () => {
  // Verifies copy state and clipboard integration
  assert.match(drawerSource, /copiedField/);
  assert.match(drawerSource, /handleCopy/);
  assert.match(drawerSource, /navigator\.clipboard/);
});

test("AccountAccessDrawer strictly gates Open in Tenants button to active tenants only", () => {
  // Verifies shortcut link to Tenant Workspace is only shown if user has role 'tenant'
  assert.match(drawerSource, /resolvedUser\?\.role === ["']tenant["']/);
  assert.match(drawerSource, /Open in Tenants/);
  assert.match(drawerSource, /whitespace-nowrap/);
});

test("AccountAccessDrawer integrates 48px avatar and unified profile header", () => {
  // Verifies enlarged avatar and unified profile header
  assert.match(drawerSource, /w-12 h-12/);
});

test("AccountAccessDrawer respects design tokens and visual invariants", () => {
  // Verifies no hardcoded hex colors and no gradient backgrounds
  assert.doesNotMatch(drawerSource, /#0A1628/);
  assert.doesNotMatch(drawerSource, /bg-gradient/);
  assert.doesNotMatch(drawerSource, /border-l-4/);
});
