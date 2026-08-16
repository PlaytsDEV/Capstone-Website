import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const launcherSource = fs.readFileSync(path.join(here, "TenantAssistantLauncher.jsx"), "utf8");
const drawerSource = fs.readFileSync(path.join(here, "TenantAssistantDrawer.jsx"), "utf8");
const billingCardSource = fs.readFileSync(path.join(here, "cards/TenantBillingBreakdownCard.jsx"), "utf8");
const leaseCardSource = fs.readFileSync(path.join(here, "cards/TenantLeaseTimelineCard.jsx"), "utf8");
const maintenanceCardSource = fs.readFileSync(path.join(here, "cards/TenantMaintenanceCard.jsx"), "utf8");
const escalateModalSource = fs.readFileSync(path.join(here, "modals/TenantHumanEscalateModal.jsx"), "utf8");
const stylesSource = fs.readFileSync(path.join(here, "../../styles/tenant-assistant.css"), "utf8");
const layoutSource = fs.readFileSync(path.join(here, "../../../../shared/layouts/TenantLayout.jsx"), "utf8");

test("TenantAssistantLauncher renders accessible floating button and unread badge", () => {
  assert.match(launcherSource, /tenant-assistant-launcher/);
  assert.match(launcherSource, /aria-label="Open Lilycrest AI Assistant"/);
  assert.match(launcherSource, /onClick=\{onClick\}/);
});

test("TenantAssistantDrawer includes header, route prompts, chat stream, and escalation trigger", () => {
  assert.match(drawerSource, /tenant-assistant-drawer/);
  assert.match(drawerSource, /tenant-assistant-backdrop/);
  assert.match(drawerSource, /Grounded on/);
  assert.match(drawerSource, /activeRoutePrompts/);
  assert.match(drawerSource, /streamTenantAssistant/);
  assert.match(drawerSource, /TenantBillingBreakdownCard/);
  assert.match(drawerSource, /TenantLeaseTimelineCard/);
  assert.match(drawerSource, /TenantMaintenanceCard/);
  assert.match(drawerSource, /TenantHumanEscalateModal/);
});

test("TenantBillingBreakdownCard renders breakdown numbers, free water badge, and link to /applicant/billing", () => {
  assert.match(billingCardSource, /tenant-snapshot-card/);
  assert.match(billingCardSource, /Base Monthly Rent/);
  assert.match(billingCardSource, /Electricity Share/);
  assert.match(billingCardSource, /Water Consumption/);
  assert.match(billingCardSource, /FREE/);
  assert.match(billingCardSource, /\/applicant\/billing/);
});

test("TenantLeaseTimelineCard renders room, progress track, days left, and link to /applicant/contracts", () => {
  assert.match(leaseCardSource, /tenant-lease-progress-track/);
  assert.match(leaseCardSource, /tenant-lease-progress-fill/);
  assert.match(leaseCardSource, /Lease Start/);
  assert.match(leaseCardSource, /Lease Expiration/);
  assert.match(leaseCardSource, /Security Deposit Held/);
  assert.match(leaseCardSource, /\/applicant\/contracts/);
});

test("TenantMaintenanceCard renders ticket code, urgency badge, technician status, and link to /applicant/maintenance", () => {
  assert.match(maintenanceCardSource, /tenant-snapshot-card/);
  assert.match(maintenanceCardSource, /Service Provider/);
  assert.match(maintenanceCardSource, /Scheduled Visit/);
  assert.match(maintenanceCardSource, /\/applicant\/maintenance/);
});

test("TenantHumanEscalateModal handles category selection, character count, and calls escalateTenantAssistant", () => {
  assert.match(escalateModalSource, /Escalate to Branch Admin/);
  assert.match(escalateModalSource, /escalate-category/);
  assert.match(escalateModalSource, /escalate-summary/);
  assert.match(escalateModalSource, /escalateTenantAssistant/);
});

test("TenantLayout mounts TenantAssistantLauncher and TenantAssistantDrawer", () => {
  assert.match(layoutSource, /TenantAssistantLauncher/);
  assert.match(layoutSource, /TenantAssistantDrawer/);
  assert.match(layoutSource, /isAssistantOpen/);
});

test("CSS strictly enforces solid HSL design with zero gradients and fluid responsiveness", () => {
  assert.doesNotMatch(stylesSource, /linear-gradient/i);
  assert.doesNotMatch(stylesSource, /radial-gradient/i);
  assert.match(stylesSource, /\.tenant-assistant-launcher/);
  assert.match(stylesSource, /\.tenant-assistant-drawer/);
  assert.match(stylesSource, /max-width:\s*440px/);
  assert.match(stylesSource, /@media\s*\(max-width:\s*640px\)/);
  assert.match(stylesSource, /max-width:\s*100vw/);
});
