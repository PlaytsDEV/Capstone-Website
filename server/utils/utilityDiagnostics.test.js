import { describe, expect, test } from "@jest/globals";
import {
  classifyWaterRecordSyncStatus,
  detectMissingMoveInAnchors,
} from "./utilityDiagnostics.js";

describe("detectMissingMoveInAnchors", () => {
  test("flags tenants without a move-in reading when they do not predate the period", () => {
    const missing = detectMissingMoveInAnchors({
      reservations: [
        {
          _id: "res-1",
          status: "checked-in",
          checkInDate: new Date("2026-04-20T00:00:00.000Z"),
          userId: {
            _id: "tenant-1",
            firstName: "Ava",
            lastName: "Tenant",
          },
        },
      ],
      readings: [],
      periodStartDate: new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(missing).toHaveLength(1);
    expect(String(missing[0].tenantId)).toBe("tenant-1");
  });

  test("does not flag tenants who were already active before the anchored period", () => {
    const missing = detectMissingMoveInAnchors({
      reservations: [
        {
          _id: "res-1",
          status: "checked-in",
          checkInDate: new Date("2026-04-01T00:00:00.000Z"),
          userId: {
            _id: "tenant-1",
            firstName: "Ava",
            lastName: "Tenant",
          },
        },
      ],
      readings: [],
      periodStartDate: new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(missing).toHaveLength(0);
  });
});

describe("classifyWaterRecordSyncStatus", () => {
  test("marks private/shared rooms with no overlaps as orphaned", () => {
    expect(
      classifyWaterRecordSyncStatus({
        roomType: "private",
        eligibleReservationCount: 0,
        matchedElectricityPeriodId: null,
        tenantShares: [],
      }),
    ).toEqual({
      syncStatus: "no_overlapping_reservations",
      syncReason: "no-overlapping-reservations",
    });
  });

  test("marks quadruple rooms as not billable for water sync", () => {
    expect(
      classifyWaterRecordSyncStatus({
        roomType: "quadruple-sharing",
        eligibleReservationCount: 4,
        matchedElectricityPeriodId: null,
        tenantShares: [],
      }),
    ).toEqual({
      syncStatus: "room_not_billable",
      syncReason: "room-not-billable",
    });
  });

  test("marks records with reservations but no linked bills as awaiting draft sync", () => {
    expect(
      classifyWaterRecordSyncStatus({
        roomType: "double-sharing",
        eligibleReservationCount: 2,
        matchedElectricityPeriodId: null,
        tenantShares: [],
      }),
    ).toEqual({
      syncStatus: "awaiting_bill_sync",
      syncReason: "draft-bills-not-created",
    });
  });
});
