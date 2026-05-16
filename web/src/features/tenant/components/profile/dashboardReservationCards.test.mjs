import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(__dirname, "../..");

const readTenantSource = (relativePath) =>
  readFileSync(resolve(tenantRoot, relativePath), "utf8");

test("dashboard profile no longer persists viewing preference feedback cards", () => {
  const profilePage = readTenantSource("pages/ProfilePage.jsx");
  const dashboardTab = readTenantSource("components/profile/DashboardTab.jsx");
  const reservationFlow = readTenantSource("hooks/useReservationFlow.js");

  assert.equal(profilePage.includes("dashboardFeedback"), false);
  assert.equal(profilePage.includes("reservationFeedback"), false);
  assert.equal(dashboardTab.includes("feedback={"), false);
  assert.equal(dashboardTab.includes("onDismissFeedback"), false);
  assert.equal(reservationFlow.includes("reservationFeedback"), false);
});

test("reservation dashboard has one persistent current reservation card", () => {
  const reservationDashboard = readTenantSource("components/ReservationDashboard.jsx");
  const progressSummaryMatches =
    reservationDashboard.match(/Reservation Progress Summary/g) || [];

  assert.equal(progressSummaryMatches.length, 1);
  assert.equal(reservationDashboard.includes("Viewing Preference Saved"), false);
  assert.equal(reservationDashboard.includes("Physical Visit Status"), false);
});
