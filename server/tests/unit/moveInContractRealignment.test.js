import { describe, expect, test } from "@jest/globals";
import {
  computeLeaseEndDate,
  buildTenantWorkspaceEntry,
} from "../../utils/tenantWorkspace.js";

describe("Move-In Lease End Date & Contract Realignment", () => {
  test("computeLeaseEndDate calculates exact calendar boundary N months later", () => {
    const result = computeLeaseEndDate({
      moveInDate: new Date("2026-08-28T00:00:00.000Z"),
      leaseDuration: 1,
    });

    expect(result?.toISOString().slice(0, 10)).toBe("2026-09-28");
  });

  test("buildTenantWorkspaceEntry prioritizes canonical contract leaseEndDate when available", () => {
    const contractLeaseEndDate = new Date("2026-09-28T00:00:00.000Z");
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "res-123",
        status: "moveIn",
        moveInDate: new Date("2026-08-28T00:00:00.000Z"),
        confirmedMoveInDate: new Date("2026-08-28T00:00:00.000Z"),
        leaseDuration: 1,
        userId: { _id: "user-123", name: "Juanito Dela Cruzz" },
      },
      contracts: [
        {
          _id: "contract-123",
          reservationId: "res-123",
          status: "generated",
          isCurrent: true,
          leaseStartDate: new Date("2026-08-28T00:00:00.000Z"),
          leaseEndDate: contractLeaseEndDate,
        },
      ],
      now: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(entry.leaseEndDate).toEqual(contractLeaseEndDate);
    expect(entry.daysUntilLeaseEnd).toBe(27);
  });
});
