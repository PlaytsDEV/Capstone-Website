import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessTenantApplication,
  getPhysicalVisitApplicantState,
  isPhysicalVisitApplicationLocked,
  isPhysicalVisitApplicationStageRequestBlocked,
  isTenantApplicationStageRequestBlocked,
} from "./physicalVisitFlow.js";

test("scheduled physical visits keep final application submission locked", () => {
  assert.equal(
    isPhysicalVisitApplicationLocked({
      status: "visit_approved",
      viewingPreference: "physical_visit",
      viewingType: "inperson",
      visitStatus: "physical_visit_scheduled",
      scheduleApproved: true,
      visitApproved: false,
      visitDate: "2026-05-20T00:00:00.000Z",
      visitTime: "09:00 AM",
    }),
    true,
  );
});

test("direct application stage requests are blocked for scheduled physical visits", () => {
  const reservation = {
    status: "visit_pending",
    viewingPreference: "physical_visit",
    visitStatus: "physical_visit_scheduled",
    visitDate: "2026-05-20T00:00:00.000Z",
    visitTime: "09:00 AM",
  };

  assert.equal(isPhysicalVisitApplicationStageRequestBlocked(3, reservation), true);
  assert.equal(isPhysicalVisitApplicationStageRequestBlocked(2, reservation), false);

  const applicantState = getPhysicalVisitApplicantState(reservation);
  assert.equal(applicantState.route, "/applicant/reservation?step=2");
  assert.equal(applicantState.canFillApplication, false);
});

test("completed physical visits unlock final application submission", () => {
  const reservation = {
    status: "visit_approved",
    viewingPreference: "physical_visit",
    viewingType: "inperson",
    visitStatus: "visit_completed",
    visitApproved: true,
  };

  assert.equal(isPhysicalVisitApplicationLocked(reservation), false);
  assert.equal(canAccessTenantApplication(reservation), true);
  assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), false);
});

test("allowed without visit unlocks physical visit application access", () => {
  const reservation = {
    status: "visit_pending",
    viewingPreference: "physical_visit",
    visitStatus: "allowed_without_visit",
  };

  assert.equal(isPhysicalVisitApplicationLocked(reservation), false);
  assert.equal(canAccessTenantApplication(reservation), true);
  assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), false);
});

test("visitApproved true stays unlocked after refetch even with stale schedule status", () => {
  const reservation = {
    status: "visit_approved",
    viewingPreference: "physical_visit",
    visitStatus: "schedule_approved",
    scheduleApproved: true,
    visitApproved: true,
  };

  assert.equal(canAccessTenantApplication(reservation), true);
  assert.equal(isPhysicalVisitApplicationLocked(reservation), false);
  assert.equal(getPhysicalVisitApplicantState(reservation).canFillApplication, true);
});

test("no-show and rescheduled physical visits keep application locked", () => {
  for (const visitStatus of ["no_show", "rescheduled", "cancelled"]) {
    assert.equal(
      isPhysicalVisitApplicationLocked({
        status: "visit_approved",
        viewingPreference: "physical_visit",
        visitStatus,
      }),
      true,
      `${visitStatus} should keep the application locked`,
    );
  }
});

test("remote viewing does not use the physical visit submission lock", () => {
  assert.equal(
    isPhysicalVisitApplicationLocked({
      status: "viewing_preference_selected",
      viewingPreference: "remote_2d_viewing",
      viewingType: "remote_2d",
    }),
    false,
  );
  assert.equal(
    canAccessTenantApplication({
      status: "viewing_preference_selected",
      viewingPreference: "remote_2d_viewing",
      viewingType: "remote_2d",
    }),
    true,
  );
});

test("urgent no-visit review does not use the physical visit submission lock", () => {
  assert.equal(
    isPhysicalVisitApplicationLocked({
      status: "viewing_preference_selected",
      viewingPreference: "urgent_move_in_review",
    }),
    false,
  );
  assert.equal(
    canAccessTenantApplication({
      status: "viewing_preference_selected",
      viewingPreference: "urgent_move_in_review",
    }),
    true,
  );
});

test("terminal reservation states keep application access locked", () => {
  for (const status of ["rejected", "cancelled", "expired", "archived"]) {
    const reservation = {
      status,
      viewingPreference: "physical_visit",
      visitStatus: "visit_completed",
      visitApproved: true,
    };

    assert.equal(canAccessTenantApplication(reservation), false);
    assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), true);
  }
});
