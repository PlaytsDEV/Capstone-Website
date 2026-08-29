import {
  buildBillingSummary,
  buildLeaseExtensionHistory,
  buildTenantWorkspaceEntry,
  buildTenantWorkspaceStats,
  computeLeaseEndDate,
} from "./tenantWorkspace.js";

describe("tenantWorkspace utilities", () => {
  test("computes lease end from move-in date and lease duration", () => {
    const result = computeLeaseEndDate({
      moveInDate: new Date("2026-01-15T00:00:00.000Z"),
      leaseDuration: 6,
    });

    expect(result?.toISOString()).toBe("2026-07-14T00:00:00.000Z");
  });

  test("classifies pending manual verification as next action without changing payment status enum", () => {
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "reservation-1",
        reservationCode: "RES-001",
        status: "moveIn",
        moveInDate: new Date("2026-01-01T00:00:00.000Z"),
        leaseDuration: 12,
        selectedBed: { id: "bed-a", position: "lower" },
        userId: {
          _id: "tenant-1",
          firstName: "Jamie",
          lastName: "Cruz",
          email: "jamie@example.com",
          phone: "09170000000",
        },
        roomId: {
          _id: "room-1",
          name: "GP-201",
          branch: "gil-puyat",
        },
        leaseExtensions: [],
      },
      bills: [
        {
          _id: "bill-1",
          reservationId: "reservation-1",
          status: "pending",
          isArchived: false,
          charges: { rent: 5000, electricity: 0, water: 0, penalty: 0, discount: 0 },
          totalAmount: 5000,
          paidAmount: 0,
          dueDate: new Date("2026-04-30T00:00:00.000Z"),
          paymentProof: {
            verificationStatus: "pending-verification",
          },
        },
      ],
      bedHistoryRecords: [],
      now: new Date("2026-04-11T00:00:00.000Z"),
    });

    expect(entry.paymentStatus).toBe("partial");
    expect(entry.nextAction).toBe("verify_payment");
    expect(entry.allowedActions.moveOut.enabled).toBe(true);
    expect(
      entry.warningFlags.some((warning) => warning.code === "pending_payment_verification"),
    ).toBe(true);
  });

  test("marks overdue balances as overdue billing summary", () => {
    const summary = buildBillingSummary(
      [
        {
          _id: "bill-2",
          status: "overdue",
          isArchived: false,
          charges: { rent: 4500, electricity: 0, water: 0, penalty: 300, discount: 0 },
          totalAmount: 4800,
          paidAmount: 0,
          dueDate: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
      new Date("2026-04-11T00:00:00.000Z"),
    );

    expect(summary.paymentStatus).toBe("overdue");
    expect(summary.currentBalance).toBe(4800);
    expect(summary.hasOverdue).toBe(true);
  });

  test("summary stats only count entries that remain visible in the tenants workspace", () => {
    const stats = buildTenantWorkspaceStats([
      {
        reservationId: "reservation-1",
        stayStatus: "active",
        leaseStatus: "active",
        paymentStatus: "paid",
      },
      {
        reservationId: "reservation-2",
        stayStatus: "active",
        leaseStatus: "expiring_soon",
        paymentStatus: "overdue",
      },
    ]);

    expect(stats).toEqual({
      totalTenants: 2,
      totalResidents: 2,
      activeTenants: 2,
      expiringSoon: 1,
      overduePayments: 1,
    });
  });

  test("does not trigger room_history_incomplete for new tenants with valid initial room assignment", () => {
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "res-new-1",
        status: "moveIn",
        moveInDate: new Date("2026-01-01T00:00:00.000Z"),
        selectedBed: { id: "bed-1", position: "lower" },
        roomId: { _id: "room-1", name: "Room 101", branch: "gil-puyat" },
      },
      bedHistoryRecords: [],
      now: new Date("2026-01-10T00:00:00.000Z"),
    });

    expect(
      entry.warningFlags.some((warning) => warning.code === "room_history_incomplete"),
    ).toBe(false);
    expect(entry.roomHistory.length).toBe(1);
    expect(entry.roomHistory[0].source).toBe("reservation_fallback");
  });

  test("triggers room_history_incomplete when both bedHistoryRecords and room assignment are missing", () => {
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "res-corrupted-1",
        status: "moveIn",
        // missing moveInDate and roomId
      },
      bedHistoryRecords: [],
      now: new Date("2026-01-10T00:00:00.000Z"),
    });

    expect(
      entry.warningFlags.some((warning) => warning.code === "room_history_incomplete"),
    ).toBe(true);
    expect(entry.roomHistory.length).toBe(0);
  });

  test("generates granular overdue electricity, rent, water, and penalty warning cards", () => {
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "res-overdue-1",
        status: "moveIn",
        moveInDate: new Date("2026-01-01T00:00:00.000Z"),
        selectedBed: { id: "bed-1", position: "lower" },
        roomId: { _id: "room-1", name: "Room 101", branch: "gil-puyat" },
      },
      bills: [
        {
          _id: "bill-overdue-1",
          status: "overdue",
          isArchived: false,
          charges: {
            rent: 6500,
            electricity: 1200,
            water: 350,
            penalty: 150,
            discount: 0,
          },
          totalAmount: 8200,
          remainingAmount: 8200,
          dueDate: new Date("2026-04-01T00:00:00.000Z"),
          billingCycleStart: new Date("2026-03-01T00:00:00.000Z"),
          billingCycleEnd: new Date("2026-03-31T00:00:00.000Z"),
        },
      ],
      bedHistoryRecords: [],
      now: new Date("2026-04-15T00:00:00.000Z"),
    });

    const elecWarning = entry.warningFlags.find((w) => w.code === "overdue_electricity");
    const rentWarning = entry.warningFlags.find((w) => w.code === "overdue_rent");
    const waterWarning = entry.warningFlags.find((w) => w.code === "overdue_water");
    const penaltyWarning = entry.warningFlags.find((w) => w.code === "overdue_penalty");

    expect(elecWarning).toBeDefined();
    expect(elecWarning.amount).toBe(1200);
    expect(elecWarning.category).toBe("electricity");

    expect(rentWarning).toBeDefined();
    expect(rentWarning.amount).toBe(6500);
    expect(rentWarning.category).toBe("rent");

    expect(waterWarning).toBeDefined();
    expect(waterWarning.amount).toBe(350);
    expect(waterWarning.category).toBe("water");

    expect(penaltyWarning).toBeDefined();
    expect(penaltyWarning.amount).toBe(150);
    expect(penaltyWarning.category).toBe("penalty");
  });

  test("generates structured warning flags for active unresolved tenant violations", () => {
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "res-violation-1",
        status: "moveIn",
        moveInDate: new Date("2026-01-01T00:00:00.000Z"),
        selectedBed: { id: "bed-1", position: "lower" },
        roomId: { _id: "room-1", name: "Room 101", branch: "gil-puyat" },
      },
      violations: [
        {
          _id: "viol-1",
          violationType: "smoking_inside",
          customViolationDescription: "Smoking detected in hallway near Room 101",
          dateOfIncident: new Date("2026-04-10T14:30:00.000Z"),
          locationOfIncident: "2nd Floor Hallway",
          status: "confirmed",
          penaltyAmount: 1000,
        },
        {
          _id: "viol-2",
          violationType: "cooking_in_room",
          customViolationDescription: "",
          dateOfIncident: new Date("2026-04-11T18:00:00.000Z"),
          locationOfIncident: "Room 101",
          status: "resolved", // Should be filtered out
          penaltyAmount: 0,
        },
      ],
      bedHistoryRecords: [],
      now: new Date("2026-04-15T00:00:00.000Z"),
    });

    const activeViolations = entry.warningFlags.filter((w) => w.code === "tenant_violation");
    expect(activeViolations.length).toBe(1);
    expect(activeViolations[0].title).toBe("Active Violation: Smoking Inside Dormitory");
    expect(activeViolations[0].penaltyAmount).toBe(1000);
    expect(activeViolations[0].location).toBe("2nd Floor Hallway");
  });

  test("includes createdAt and updatedAt timestamps for sorting in tenant workspace entry", () => {
    const entry = buildTenantWorkspaceEntry({
      reservation: {
        _id: "res-timestamp-1",
        status: "moveIn",
        moveInDate: new Date("2026-02-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-20T08:00:00.000Z"),
        updatedAt: new Date("2026-02-01T10:00:00.000Z"),
        selectedBed: { id: "bed-1", position: "lower" },
        roomId: { _id: "room-1", name: "Room 101", branch: "gil-puyat" },
      },
      bedHistoryRecords: [],
      now: new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(entry.createdAt).toBe("2026-01-20T08:00:00.000Z");
    expect(entry.updatedAt).toBe("2026-02-01T10:00:00.000Z");
    expect(entry.moveInDate).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });

  describe("buildLeaseExtensionHistory", () => {
    test("returns an empty array when only 1 initial baseline stay exists", () => {
      const history = buildLeaseExtensionHistory({
        stayHistory: [
          {
            _id: "stay-initial-1",
            leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
            leaseEndDate: new Date("2026-06-30T00:00:00.000Z"),
            status: "active",
            previousStayId: null,
          },
        ],
        reservation: { leaseExtensions: [] },
      });

      expect(history).toEqual([]);
    });

    test("accurately calculates added months and records genuine renewal stays", () => {
      const history = buildLeaseExtensionHistory({
        stayHistory: [
          {
            _id: "stay-initial-1",
            leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
            leaseEndDate: new Date("2026-06-30T00:00:00.000Z"),
            status: "renewed",
            previousStayId: null,
            endReason: "renewed",
          },
          {
            _id: "stay-renewed-2",
            leaseStartDate: new Date("2026-07-01T00:00:00.000Z"),
            leaseEndDate: new Date("2026-12-31T00:00:00.000Z"),
            status: "active",
            previousStayId: "stay-initial-1",
            renewalNotes: "Extended for second semester",
          },
        ],
        reservation: { leaseExtensions: [] },
      });

      expect(history.length).toBe(1);
      expect(history[0].id).toBe("stay-renewed-2");
      expect(history[0].addedMonths).toBe(6);
      expect(history[0].notes).toBe("Extended for second semester");
      expect(history[0].leaseStartDate).toEqual(new Date("2026-07-01T00:00:00.000Z"));
      expect(history[0].leaseEndDate).toEqual(new Date("2026-12-31T00:00:00.000Z"));
    });

    test("falls back to reservation.leaseExtensions when explicit extension entries exist", () => {
      const history = buildLeaseExtensionHistory({
        stayHistory: [],
        reservation: {
          _id: "res-ext-1",
          leaseExtensions: [
            {
              addedMonths: 3,
              previousDuration: 6,
              newDuration: 9,
              extendedAt: new Date("2026-03-01T00:00:00.000Z"),
              notes: "3-month extension",
            },
          ],
        },
      });

      expect(history.length).toBe(1);
      expect(history[0].addedMonths).toBe(3);
      expect(history[0].previousDuration).toBe(6);
      expect(history[0].newDuration).toBe(9);
    });

    test("buildTenantWorkspaceEntry leaseInfo.extensionHistory is empty for single stay", () => {
      const entry = buildTenantWorkspaceEntry({
        reservation: {
          _id: "res-single-stay",
          status: "moveIn",
          moveInDate: new Date("2026-01-01T00:00:00.000Z"),
          leaseDuration: 6,
          roomId: { _id: "room-1", name: "Room 101", branch: "gil-puyat" },
          selectedBed: { id: "bed-1", position: "lower" },
          userId: { _id: "u-1", firstName: "Alex", lastName: "Reyes" },
        },
        stayHistory: [
          {
            _id: "stay-1",
            leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
            leaseEndDate: new Date("2026-06-30T00:00:00.000Z"),
            status: "active",
          },
        ],
        now: new Date("2026-04-15T00:00:00.000Z"),
      });

      expect(entry.leaseInfo.extensionHistory).toEqual([]);
    });

    test("accurately maps historical contracts for both current and past stays in roomHistory", () => {
      const pastRoomId = "room-past-201";
      const currentRoomId = "room-curr-222";

      const pastContract = {
        _id: "contract-past-1",
        contractNumber: "LIL-GP-2026-00085",
        contractPurpose: "initial",
        status: "replaced",
        isCurrent: false,
        isCanonical: false,
        roomId: pastRoomId,
        bedId: "bed-1",
        leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
        leaseEndDate: new Date("2026-06-30T00:00:00.000Z"),
        approvedMonthlyRate: 5000,
      };

      const currentContract = {
        _id: "contract-curr-2",
        contractNumber: "LIL-GP-2026-00107",
        contractPurpose: "amendment",
        status: "active",
        isCurrent: true,
        isCanonical: true,
        roomId: currentRoomId,
        bedId: "bed-2",
        leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
        leaseEndDate: new Date("2026-12-31T00:00:00.000Z"),
        approvedMonthlyRate: 5500,
      };

      const entry = buildTenantWorkspaceEntry({
        reservation: {
          _id: "res-transfer-1",
          status: "moveIn",
          moveInDate: new Date("2026-01-01T00:00:00.000Z"),
          roomId: { _id: currentRoomId, name: "Room 222", branch: "gil-puyat" },
          selectedBed: { id: "bed-2", position: "bed-2" },
          userId: { _id: "u-1", firstName: "Gil", lastName: "Puyat" },
        },
        contracts: [currentContract, pastContract],
        bedHistoryRecords: [
          {
            _id: "bed-hist-curr",
            roomId: { _id: currentRoomId, name: "Room 222", branch: "gil-puyat" },
            bedId: "bed-2",
            moveInDate: new Date("2026-08-28T00:00:00.000Z"),
            moveOutDate: null,
            status: "active",
          },
          {
            _id: "bed-hist-past",
            roomId: { _id: pastRoomId, name: "Room 201", branch: "gil-puyat" },
            bedId: "bed-1",
            moveInDate: new Date("2026-08-28T00:00:00.000Z"),
            moveOutDate: new Date("2026-08-28T00:00:00.000Z"),
            status: "completed",
          },
        ],
        now: new Date("2026-08-29T00:00:00.000Z"),
      });

      expect(entry.roomHistory).toHaveLength(2);
      
      const currentEntry = entry.roomHistory.find((r) => r.id === "bed-hist-curr");
      expect(currentEntry).toBeDefined();
      expect(currentEntry.contract).toBeDefined();
      expect(currentEntry.contract.contractNumber).toBe("LIL-GP-2026-00107");
      expect(currentEntry.roomId).toBe(currentRoomId);

      const pastEntry = entry.roomHistory.find((r) => r.id === "bed-hist-past");
      expect(pastEntry).toBeDefined();
      expect(pastEntry.contract).toBeDefined();
      expect(pastEntry.contract.contractNumber).toBe("LIL-GP-2026-00085");
      expect(pastEntry.contract.isCurrent).toBe(false);
      expect(pastEntry.roomId).toBe(pastRoomId);
    });
  });
});



