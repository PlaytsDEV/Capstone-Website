import { beforeEach, describe, expect, jest, test } from "@jest/globals";

describe("cancellationMoveInSelfHealService", () => {
  let healDanglingMovedInCancellations;
  let mockReservationFind;
  let mockAutoGenerateMoveInContract;
  let mockLogger;

  beforeEach(async () => {
    jest.resetModules();

    mockReservationFind = jest.fn();
    mockAutoGenerateMoveInContract = jest.fn();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    jest.unstable_mockModule("../models/index.js", () => ({
      Reservation: {
        find: mockReservationFind,
      },
    }));

    jest.unstable_mockModule("./autoContractOrchestratorService.js", () => ({
      autoGenerateMoveInContract: mockAutoGenerateMoveInContract,
    }));

    jest.unstable_mockModule("../middleware/logger.js", () => ({
      default: mockLogger,
    }));

    const module = await import("./cancellationMoveInSelfHealService.js");
    healDanglingMovedInCancellations = module.healDanglingMovedInCancellations;
  });

  test("returns healedCount 0 when no dangling reservations are found", async () => {
    mockReservationFind.mockResolvedValue([]);

    const result = await healDanglingMovedInCancellations();

    expect(mockReservationFind).toHaveBeenCalledWith({
      status: "moveIn",
      cancellationRequested: true,
      cancellationStatus: "pending",
    });
    expect(result).toEqual({ healedCount: 0 });
    expect(mockAutoGenerateMoveInContract).not.toHaveBeenCalled();
  });

  test("heals dangling reservations and triggers auto contract generation", async () => {
    const mockSave1 = jest.fn().mockResolvedValue(true);
    const mockSave2 = jest.fn().mockResolvedValue(true);

    const dangling1 = {
      _id: "res_001",
      userId: "user_001",
      status: "moveIn",
      cancellationRequested: true,
      cancellationStatus: "pending",
      confirmedMoveInDate: new Date("2026-09-01"),
      moveInDate: new Date("2026-09-05"),
      save: mockSave1,
    };

    const dangling2 = {
      _id: "res_002",
      userId: "user_002",
      status: "moveIn",
      cancellationRequested: true,
      cancellationStatus: "pending",
      confirmedMoveInDate: null,
      moveInDate: new Date("2026-09-10"),
      save: mockSave2,
    };

    mockReservationFind.mockResolvedValue([dangling1, dangling2]);
    mockAutoGenerateMoveInContract.mockResolvedValue({ success: true });

    const result = await healDanglingMovedInCancellations();

    expect(result).toEqual({ healedCount: 2 });

    // Check dangling1 mutations
    expect(dangling1.cancellationRequested).toBe(false);
    expect(dangling1.cancellationStatus).toBe("dismissed_on_movein");
    expect(dangling1.cancellationAdminNote).toBe("Auto-dismissed: Tenant successfully moved in.");
    expect(dangling1.cancellationReviewedAt).toBeInstanceOf(Date);
    expect(mockSave1).toHaveBeenCalledTimes(1);

    // Check dangling2 mutations
    expect(dangling2.cancellationRequested).toBe(false);
    expect(dangling2.cancellationStatus).toBe("dismissed_on_movein");
    expect(dangling2.cancellationAdminNote).toBe("Auto-dismissed: Tenant successfully moved in.");
    expect(dangling2.cancellationReviewedAt).toBeInstanceOf(Date);
    expect(mockSave2).toHaveBeenCalledTimes(1);

    // Check contract orchestrator calls
    expect(mockAutoGenerateMoveInContract).toHaveBeenCalledTimes(2);
    expect(mockAutoGenerateMoveInContract).toHaveBeenNthCalledWith(1, {
      reservationId: "res_001",
      actualMoveInDate: dangling1.confirmedMoveInDate,
      actorId: "user_001",
    });
    expect(mockAutoGenerateMoveInContract).toHaveBeenNthCalledWith(2, {
      reservationId: "res_002",
      actualMoveInDate: dangling2.moveInDate,
      actorId: "user_002",
    });
  });

  test("handles non-fatal autoGenerateMoveInContract errors gracefully and continues healing", async () => {
    const mockSave1 = jest.fn().mockResolvedValue(true);
    const mockSave2 = jest.fn().mockResolvedValue(true);

    const dangling1 = {
      _id: "res_001",
      userId: "user_001",
      status: "moveIn",
      cancellationRequested: true,
      cancellationStatus: "pending",
      confirmedMoveInDate: new Date("2026-09-01"),
      save: mockSave1,
    };

    const dangling2 = {
      _id: "res_002",
      userId: "user_002",
      status: "moveIn",
      cancellationRequested: true,
      cancellationStatus: "pending",
      confirmedMoveInDate: new Date("2026-09-02"),
      save: mockSave2,
    };

    mockReservationFind.mockResolvedValue([dangling1, dangling2]);
    mockAutoGenerateMoveInContract
      .mockRejectedValueOnce(new Error("Contract template unavailable"))
      .mockResolvedValueOnce({ success: true });

    const result = await healDanglingMovedInCancellations();

    expect(result).toEqual({ healedCount: 2 });
    expect(mockSave1).toHaveBeenCalledTimes(1);
    expect(mockSave2).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "res_001",
      }),
      "[SelfHeal] Move-in contract generation retry had warning (non-fatal)",
    );
  });

  test("returns error object when Reservation.find fails", async () => {
    mockReservationFind.mockRejectedValue(new Error("Database connection lost"));

    const result = await healDanglingMovedInCancellations();

    expect(result).toEqual({
      healedCount: 0,
      error: "Database connection lost",
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "[SelfHeal] Error healing dangling cancellation requests",
    );
  });
});
