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

  assert.equal(reservationDashboard.includes("styles.card"), true);
  assert.equal(reservationDashboard.includes("Viewing Preference Saved"), true);
  assert.equal(reservationDashboard.includes("Physical Visit Status"), false);
});

test("reserved applicant dashboard renders cancellation navigation capability", () => {
  const reservationDashboard = readTenantSource("components/ReservationDashboard.jsx");

  assert.equal(reservationDashboard.includes("onGoToReservation"), true);
  assert.equal(reservationDashboard.includes("Request Cancellation"), true);
  assert.equal(reservationDashboard.includes("Cancel reservation process"), true);
  assert.equal(reservationDashboard.includes("Cancel Reservation Process?"), true);
  assert.equal(reservationDashboard.includes("Go to Dashboard"), false);
});

test("reserved applicant detail page remains applicant-mode, not tenant-mode", () => {
  const reservationAgreementPage = readTenantSource(
    "components/profile/ReservationAgreementPage.jsx",
  );
  const dashboardTab = readTenantSource("components/profile/DashboardTab.jsx");
  const confirmationStep = readTenantSource(
    "pages/reservation-steps/ReservationConfirmationStep.jsx",
  );
  const confirmationState = readTenantSource(
    "utils/reservationConfirmationState.js",
  );

  assert.equal(
    reservationAgreementPage.includes(
      'const personLabel = isFullTenantReservation ? "Tenant" : "Applicant";',
    ),
    true,
  );
  assert.equal(
    reservationAgreementPage.includes(
      "You remain an applicant until admin completes the tenant conversion.",
    ),
    true,
  );
  assert.equal(
    reservationAgreementPage.includes(
      '{isFullTenantReservation ? "Payment Receipt" : "Reservation Fee Payment"}',
    ),
    true,
  );
  assert.equal(confirmationStep.includes("You're All Set!"), false);
  assert.equal(confirmationStep.includes("Print / Download Receipt"), false);
  assert.equal(confirmationState.includes("Room Reserved"), true);
  assert.equal(dashboardTab.includes("canViewTenantModules &&"), true);
  assert.equal(
    dashboardTab.includes('profileData?.tenantStatus === "active"'),
    true,
  );
});
