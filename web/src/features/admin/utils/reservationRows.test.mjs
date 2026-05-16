import test from "node:test";
import assert from "node:assert/strict";

import { mapVisitScheduleRows } from "./reservationRows.js";

const basePhysicalReservation = {
  _id: "reservation-1",
  status: "visit_approved",
  viewingPreference: "physical_visit",
  visitDate: "2026-05-20T00:00:00.000Z",
  visitTime: "09:00 AM",
  visitApproved: false,
  scheduleRejected: false,
  userId: { firstName: "Tala", lastName: "Applicant", email: "tala@example.com" },
  roomId: { name: "Room 101", branch: "gil-puyat" },
  createdAt: "2026-05-01T00:00:00.000Z",
};

test("allowed-without-visit reservations do not remain as active visit rows", () => {
  const rows = mapVisitScheduleRows([
    {
      ...basePhysicalReservation,
      visitStatus: "allowed_without_visit",
      visitHistory: [
        {
          status: "allowed_without_visit",
          visitDate: "2026-05-20T00:00:00.000Z",
          visitTime: "09:00 AM",
          updatedAt: "2026-05-16T00:00:00.000Z",
          updatedByName: "Branch Admin",
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isHistorical, true);
  assert.equal(rows[0].historyStatus, "allowed_without_visit");
  assert.equal(rows[0].actionedLabel, "Allowed Without Visit");
});

test("no-show reservations remain active so admins can reschedule or waive", () => {
  const rows = mapVisitScheduleRows([
    {
      ...basePhysicalReservation,
      status: "visit_pending",
      visitStatus: "no_show",
      visitHistory: [],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isHistorical, false);
  assert.equal(rows[0].visitStatus, "no_show");
});
