import test from "node:test";
import assert from "node:assert/strict";
import { mapReservationAdminRow, mapVisitScheduleRows } from "./reservationRows.js";

const baseReservation = {
  _id: "reservation-1",
  reservationCode: "RES-123456",
  status: "viewing_preference_selected",
  userId: {
    firstName: "Tala",
    lastName: "Applicant",
    email: "tala@example.com",
  },
  roomId: {
    name: "Room 301",
    branch: "gil-puyat",
    type: "quadruple-sharing",
  },
  mobileNumber: "09123456789",
  visitDate: "2026-05-20T00:00:00.000Z",
  visitTime: "01:00 PM",
  viewingPreference: "physical_visit",
  viewingType: "inperson",
  selectedBed: { id: "bed-a", position: "upper" },
  createdAt: "2026-05-12T00:00:00.000Z",
};

test("mapReservationAdminRow keeps admin modal live-state fields", () => {
  const row = mapReservationAdminRow({
    ...baseReservation,
    scheduleApproved: true,
    scheduleApprovedAt: "2026-05-13T00:00:00.000Z",
    cancellationRequested: true,
    cancellationStatus: "pending",
  });

  assert.equal(row.visitDate, baseReservation.visitDate);
  assert.equal(row.visitTime, baseReservation.visitTime);
  assert.deepEqual(row.selectedBed, baseReservation.selectedBed);
  assert.equal(row.scheduleApproved, true);
  assert.equal(row.cancellationRequested, true);
  assert.equal(row.cancellationStatus, "pending");
});

test("mapVisitScheduleRows does not duplicate active approved schedules", () => {
  const rows = mapVisitScheduleRows([
    {
      ...baseReservation,
      scheduleApproved: true,
      visitApproved: false,
      visitHistory: [
        {
          status: "schedule_approved",
          visitDate: baseReservation.visitDate,
          visitTime: baseReservation.visitTime,
          updatedAt: "2026-05-13T00:00:00.000Z",
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isHistorical, false);
  assert.equal(rows[0].scheduleApproved, true);
});
