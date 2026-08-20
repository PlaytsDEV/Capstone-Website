import test from "node:test";
import assert from "node:assert/strict";

import {
  checkOverdueReservation,
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

test("mapReservationAdminRow resolves moveInDate from intendedMoveInDate or targetMoveInDate", () => {
  const row = mapReservationAdminRow({
    _id: "res-intended-date",
    status: "pending",
    intendedMoveInDate: "2026-09-01T00:00:00.000Z",
    roomId: { name: "Room 101", branch: "gil-puyat" },
  });

  assert.equal(row.moveInDate, "2026-09-01T00:00:00.000Z");
});

test("checkOverdueReservation returns false for new applicants with null or missing moveInDate", () => {
  assert.equal(
    checkOverdueReservation({ status: "pending", moveInDate: null }),
    false,
  );
  assert.equal(
    checkOverdueReservation({ status: "pending_application_review", moveInDate: undefined }),
    false,
  );
  assert.equal(
    checkOverdueReservation({ status: "pending", moveInDate: "" }),
    false,
  );
});

test("checkOverdueReservation returns false for early-stage applicants even with past intended dates", () => {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.equal(
    checkOverdueReservation({
      status: "pending",
      intendedMoveInDate: pastDate,
    }),
    false,
  );
  assert.equal(
    checkOverdueReservation({
      status: "pending_application_review",
      moveInDate: pastDate,
    }),
    false,
  );
  assert.equal(
    checkOverdueReservation({
      status: "approved_for_payment",
      moveInDate: pastDate,
    }),
    false,
  );
});

test("checkOverdueReservation evaluates confirmed reserved bookings accurately", () => {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Confirmed reserved booking past move-in date -> true (Overdue)
  assert.equal(
    checkOverdueReservation({
      status: "reserved",
      moveInDate: pastDate,
    }),
    true,
  );

  // Confirmed reserved booking with future move-in date -> false (Not overdue)
  assert.equal(
    checkOverdueReservation({
      status: "reserved",
      moveInDate: futureDate,
    }),
    false,
  );

  // Archived reserved booking past date -> false (Archived records ignored)
  assert.equal(
    checkOverdueReservation({
      status: "reserved",
      moveInDate: pastDate,
      isArchived: true,
    }),
    false,
  );
});

test("mapReservationAdminRow marks unviewed pending applications as isNew: true", () => {
  const row = mapReservationAdminRow({
    _id: "res-unviewed-1",
    status: "pending_application_review",
    createdAt: new Date().toISOString(),
    isViewedByAdmin: false,
    roomId: { name: "Room 101", branch: "gil-puyat" },
  });

  assert.equal(row.isNew, true);
  assert.equal(row.isViewedByAdmin, false);
});

test("mapReservationAdminRow clears isNew when isViewedByAdmin is true", () => {
  const row = mapReservationAdminRow({
    _id: "res-viewed-1",
    status: "pending_application_review",
    createdAt: new Date().toISOString(),
    isViewedByAdmin: true,
    roomId: { name: "Room 101", branch: "gil-puyat" },
  });

  assert.equal(row.isNew, false);
  assert.equal(row.isViewedByAdmin, true);
});

test("mapReservationAdminRow clears isNew when reservation ID is present in session seenIds", () => {
  const seenIds = new Set(["res-seen-in-session"]);
  const row = mapReservationAdminRow(
    {
      _id: "res-seen-in-session",
      status: "pending_application_review",
      createdAt: new Date().toISOString(),
      isViewedByAdmin: false,
      roomId: { name: "Room 101", branch: "gil-puyat" },
    },
    seenIds,
  );

  assert.equal(row.isNew, false);
  assert.equal(row.isViewedByAdmin, true);
});

test("mapReservationAdminRow does not mark moveIn or confirmed reservations as isNew", () => {
  const rowMoveIn = mapReservationAdminRow({
    _id: "res-movein-1",
    status: "moveIn",
    createdAt: new Date().toISOString(),
    isViewedByAdmin: false,
    roomId: { name: "Room 510", branch: "gil-puyat" },
  });
  assert.equal(rowMoveIn.isNew, false);

  const rowConfirmed = mapReservationAdminRow({
    _id: "res-confirmed-1",
    status: "confirmed",
    createdAt: new Date().toISOString(),
    isViewedByAdmin: false,
    roomId: { name: "Room 510", branch: "gil-puyat" },
  });
  assert.equal(rowConfirmed.isNew, false);
});




