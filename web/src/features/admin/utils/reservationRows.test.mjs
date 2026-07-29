import test from "node:test";
import assert from "node:assert/strict";

import {
  getArchivedByName,
  isNewReservation,
  mapReservationAdminRow,
  mapVisitScheduleRows,
} from "./reservationRows.js";

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

test("mapReservationAdminRow exposes archive metadata for archived view", () => {
  const row = mapReservationAdminRow({
    _id: "reservation-archived",
    reservationCode: "RES-123ABC",
    status: "cancelled",
    isArchived: true,
    archivedAt: "2026-05-17T00:00:00.000Z",
    archivedPreviousStatus: "cancelled",
    archiveReason: "Archived by admin",
    archivedBy: {
      firstName: "Dormitory",
      lastName: "Owner",
      email: "owner@example.com",
    },
    userId: {
      firstName: "Tala",
      lastName: "Applicant",
      email: "tala@example.com",
    },
    roomId: { name: "Room 101", branch: "gil-puyat", type: "Quad" },
  });

  assert.equal(row.isArchived, true);
  assert.equal(row.archivedPreviousStatus, "cancelled");
  assert.equal(row.archivedByName, "Dormitory Owner");
  assert.equal(row.archiveReason, "Archived by admin");
});

test("getArchivedByName falls back to email or dash", () => {
  assert.equal(
    getArchivedByName({ email: "owner@example.com" }),
    "owner@example.com",
  );
  assert.equal(getArchivedByName(null), "-");
});

test("isNewReservation correctly evaluates recency", () => {
  const recentDate = new Date().toISOString();
  const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  assert.equal(isNewReservation({ createdAt: recentDate }), true);
  assert.equal(isNewReservation({ createdAt: oldDate }), false);
});

test("mapReservationAdminRow considers pending cancellation requests as isNew", () => {
  const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const row = mapReservationAdminRow({
    _id: "res-cancellation-test",
    status: "reserved",
    createdAt: oldDate,
    isViewedByAdmin: true,
    cancellationRequested: true,
    cancellationStatus: "pending",
  });

  assert.equal(row.isNew, true);
});


