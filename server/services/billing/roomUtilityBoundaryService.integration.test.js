import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  BedHistory,
  BillingPeriod,
  MeterReading,
  Room,
  User,
  UtilityPeriod,
  UtilityReading,
} from "../../models/index.js";
import {
  createOpenUtilityPeriodWithBoundary,
  UTILITY_PERIOD_START_MODE,
} from "./utilityPeriodLifecycleService.js";
import {
  inspectUtilityRoomInitializationEvidence,
  resolveRoomUtilityBoundaryContext,
} from "./roomUtilityBoundaryService.js";

describe("room-owned utility occupancy boundaries", () => {
  let mongo;
  let room;
  let actor;
  let tenant;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "room_utility_boundaries" });
    await UtilityPeriod.syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      BillingPeriod.deleteMany({}),
      BedHistory.deleteMany({}),
      MeterReading.deleteMany({}),
      Room.deleteMany({}),
      User.deleteMany({}),
      UtilityPeriod.deleteMany({}),
      UtilityReading.deleteMany({}),
    ]);
    room = await Room.create({
      name: "GP - Boundary Test",
      roomNumber: "GP-B",
      branch: "gil-puyat",
      type: "double-sharing",
      capacity: 2,
      currentOccupancy: 0,
      price: 10000,
    });
    actor = await User.create({
      firebaseUid: `fb-${new mongoose.Types.ObjectId()}`,
      email: `${new mongoose.Types.ObjectId()}@admin.test`,
      username: `admin_${new mongoose.Types.ObjectId()}`,
      firstName: "Admin",
      lastName: "Test",
      role: "branch_admin",
      branch: "gil-puyat",
    });
    tenant = await User.create({
      firebaseUid: `fb-${new mongoose.Types.ObjectId()}`,
      email: `${new mongoose.Types.ObjectId()}@tenant.test`,
      username: `tenant_${new mongoose.Types.ObjectId()}`,
      firstName: "Tenant",
      lastName: "Test",
      role: "tenant",
      branch: "gil-puyat",
    });
  });

  test.each([0, 1000.25])(
    "first move-in reading %p atomically initializes and links both boundaries",
    async (reading) => {
      const eventAt = new Date("2026-09-02T03:04:05.678Z");
      const result = await resolveRoomUtilityBoundaryContext({
        room,
        utilityType: "electricity",
        eventAt,
        reading,
        eventType: "moveIn",
        tenantId: tenant._id,
        actorId: actor._id,
        allowInitialize: true,
        ratePerUnit: 16,
      });

      expect(result.initialized).toBe(true);
      expect(result.period.startDate.toISOString()).toBe(eventAt.toISOString());
      expect(result.period.startReading).toBe(reading);
      const stored = await UtilityReading.find({ utilityPeriodId: result.period._id })
        .sort({ createdAt: 1 })
        .lean();
      expect(stored).toHaveLength(2);
      expect(stored.map((entry) => entry.eventType)).toEqual(["periodStart", "moveIn"]);
      expect(stored.every((entry) => entry.reading === reading)).toBe(true);
      expect(stored.every((entry) => entry.date.toISOString() === eventAt.toISOString())).toBe(true);
    },
  );

  test("existing open period is reused and retry is idempotent", async () => {
    const period = await createOpenUtilityPeriodWithBoundary({
      utilityType: "electricity",
      room,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      startReading: 100,
      ratePerUnit: 16,
      actorId: actor._id,
    });
    const input = {
      room,
      utilityType: "electricity",
      eventAt: new Date("2026-09-02T00:00:00.000Z"),
      reading: 110,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
    };
    const first = await resolveRoomUtilityBoundaryContext(input);
    const retry = await resolveRoomUtilityBoundaryContext(input);

    expect(String(first.period._id)).toBe(String(period._id));
    expect(retry.idempotent).toBe(true);
    expect(await UtilityPeriod.countDocuments()).toBe(1);
    expect(await UtilityReading.countDocuments({ eventType: "moveIn" })).toBe(1);
  });

  test("concurrent first move-in initialization leaves exactly one active period", async () => {
    const input = {
      room,
      utilityType: "electricity",
      eventAt: new Date("2026-09-02T00:00:00.000Z"),
      reading: 100.5,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
      ratePerUnit: 16,
    };
    const attempts = await Promise.allSettled([
      resolveRoomUtilityBoundaryContext(input),
      resolveRoomUtilityBoundaryContext(input),
    ]);

    expect(attempts.some((attempt) => attempt.status === "fulfilled")).toBe(true);
    expect(await UtilityPeriod.countDocuments({
      roomId: room._id,
      utilityType: "electricity",
      status: { $in: ["open", "manual_review_required"] },
      isArchived: false,
    })).toBe(1);
    expect(await UtilityReading.countDocuments({
      roomId: room._id,
      eventType: "periodStart",
    })).toBe(1);
    expect(await UtilityReading.countDocuments({
      roomId: room._id,
      eventType: "moveIn",
      tenantId: tenant._id,
    })).toBe(1);
  });

  test("move-in outside the one open period is blocked", async () => {
    await createOpenUtilityPeriodWithBoundary({
      utilityType: "electricity",
      room,
      startDate: new Date("2026-09-05T00:00:00.000Z"),
      startMode: UTILITY_PERIOD_START_MODE.EXACT_OBSERVATION,
      startReading: 100,
      ratePerUnit: 16,
      actorId: actor._id,
    });
    await expect(resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-04T23:59:59.999Z"),
      reading: 100,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
    })).rejects.toMatchObject({ code: "ROOM_UTILITY_BOUNDARY_OUTSIDE_PERIOD" });
  });

  test("ambiguous active periods block move-in instead of selecting one", async () => {
    await UtilityPeriod.collection.dropIndex("unique_lifecycle_active_utility_period");
    try {
      const common = {
        utilityType: "electricity",
        roomId: room._id,
        branch: room.branch,
        startReading: 100,
        ratePerUnit: 16,
        status: "open",
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await UtilityPeriod.collection.insertMany([
        { ...common, startDate: new Date("2026-09-01T00:00:00.000Z") },
        { ...common, startDate: new Date("2026-09-01T12:00:00.000Z") },
      ]);
      await expect(resolveRoomUtilityBoundaryContext({
        room,
        eventAt: new Date("2026-09-02T00:00:00.000Z"),
        reading: 110,
        eventType: "moveIn",
        tenantId: tenant._id,
        actorId: actor._id,
        allowInitialize: true,
      })).rejects.toMatchObject({ code: "ROOM_UTILITY_BOUNDARY_AMBIGUOUS" });
    } finally {
      await UtilityPeriod.deleteMany({ roomId: room._id });
      await UtilityPeriod.syncIndexes();
    }
  });

  test("manual-review history blocks automatic move-in", async () => {
    const status = "manual_review_required";
    await UtilityPeriod.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: null,
      startReading: 100,
      endReading: null,
      ratePerUnit: 16,
      status,
    });
    await expect(
      resolveRoomUtilityBoundaryContext({
        room,
        eventAt: new Date("2026-09-03T00:00:00.000Z"),
        reading: 120,
        eventType: "moveIn",
        tenantId: tenant._id,
        actorId: actor._id,
        allowInitialize: true,
      }),
    ).rejects.toMatchObject({ code: "ROOM_UTILITY_BOUNDARY_MANUAL_REVIEW_REQUIRED" });
  });

  async function seedCleanClosedPeriod({ endReading = 1000 } = {}) {
    const endDate = new Date("2026-09-02T00:00:00.000Z");
    const period = await UtilityPeriod.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate,
      startReading: 900,
      endReading,
      ratePerUnit: 16,
      status: "closed",
      closedAt: endDate,
      closedBy: actor._id,
    });
    await UtilityReading.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      reading: endReading,
      date: endDate,
      eventType: "periodEnd",
      readingStatus: "locked",
      recordedBy: actor._id,
      utilityPeriodId: period._id,
    });
    return period;
  }

  test("clean closed-only vacant history initializes and accounts for the vacant delta as overhead", async () => {
    await seedCleanClosedPeriod({ endReading: 1000 });
    const eventAt = new Date("2026-09-05T12:30:00.000Z");
    const result = await resolveRoomUtilityBoundaryContext({
      room,
      utilityType: "electricity",
      eventAt,
      reading: 1020,
      eventType: "moveIn",
      reservationId: new mongoose.Types.ObjectId(),
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
      ratePerUnit: 16,
    });

    expect(result.initialized).toBe(true);
    expect(result.period.startReading).toBe(1020);
    expect(result.boundary.reading).toBe(1020);
    expect(result.vacancyGap).toMatchObject({
      readingFrom: 1000,
      readingTo: 1020,
      kwhConsumed: 20,
      cost: 320,
      reason: "VACANT_GAP_BEFORE_PERIOD",
    });
    const stored = await UtilityPeriod.findById(result.period._id).lean();
    expect(stored.overheadSegments).toEqual([
      expect.objectContaining({ kwhConsumed: 20, reason: "VACANT_GAP_BEFORE_PERIOD" }),
    ]);
  });

  test("closed-only history blocks when a real occupant existed during the gap", async () => {
    await seedCleanClosedPeriod();
    await BedHistory.create({
      bedId: "gap-bed",
      roomId: room._id,
      tenantId: tenant._id,
      branch: room.branch,
      moveInDate: new Date("2026-09-03T00:00:00.000Z"),
      effectiveStartDate: new Date("2026-09-03T00:00:00.000Z"),
      moveOutDate: new Date("2026-09-04T00:00:00.000Z"),
      effectiveEndDate: new Date("2026-09-04T00:00:00.000Z"),
      status: "completed",
    });
    await expect(resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-05T00:00:00.000Z"),
      reading: 1020,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
    })).rejects.toMatchObject({ code: "UTILITY_CLOSED_ONLY_OCCUPANT_DURING_GAP" });
  });

  test("closed-only history blocks an unexplained post-close reading", async () => {
    await seedCleanClosedPeriod();
    await UtilityReading.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      reading: 1010,
      date: new Date("2026-09-03T00:00:00.000Z"),
      eventType: "regularBilling",
      recordedBy: actor._id,
      utilityPeriodId: null,
    });
    await expect(resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-05T00:00:00.000Z"),
      reading: 1020,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
    })).rejects.toMatchObject({ code: "UTILITY_CLOSED_ONLY_ORPHAN_READING_AFTER_CLOSE" });
  });

  test("archived history blocks closed-only automatic initialization", async () => {
    await seedCleanClosedPeriod();
    await UtilityPeriod.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-08-02T00:00:00.000Z"),
      startReading: 800,
      endReading: 810,
      ratePerUnit: 16,
      status: "closed",
      isArchived: true,
    });
    await expect(resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-05T00:00:00.000Z"),
      reading: 1020,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
    })).rejects.toMatchObject({ code: "UTILITY_CLOSED_ONLY_ARCHIVED_HISTORY" });
  });

  test("archived history and orphan readings prevent never-initialized classification", async () => {
    await UtilityPeriod.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      startReading: 50,
      ratePerUnit: 16,
      status: "open",
      isArchived: true,
    });
    const evidence = await inspectUtilityRoomInitializationEvidence({
      roomId: room._id,
      utilityType: "electricity",
    });
    expect(evidence.neverInitialized).toBe(false);
    expect(evidence.reasons).toContain("UTILITY_PERIOD_HISTORY_EXISTS");
  });

  test("a matching orphan legacy boundary is not accepted as an idempotent success", async () => {
    const eventAt = new Date("2026-09-02T00:00:00.000Z");
    await UtilityReading.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      reading: 100,
      date: eventAt,
      eventType: "moveIn",
      tenantId: tenant._id,
      recordedBy: actor._id,
      utilityPeriodId: null,
    });
    await expect(resolveRoomUtilityBoundaryContext({
      room,
      eventAt,
      reading: 100,
      eventType: "moveIn",
      tenantId: tenant._id,
      actorId: actor._id,
      allowInitialize: true,
    })).rejects.toMatchObject({
      code: "UTILITY_BOUNDARY_ORPHAN_REVIEW_REQUIRED",
    });
  });

  test("move-out is linked and leaves the room period open", async () => {
    const period = await createOpenUtilityPeriodWithBoundary({
      utilityType: "electricity",
      room,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      startReading: 100,
      ratePerUnit: 16,
      actorId: actor._id,
    });
    const result = await resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-10T00:00:00.000Z"),
      reading: 150,
      eventType: "moveOut",
      tenantId: tenant._id,
      actorId: actor._id,
    });
    expect(String(result.boundary.utilityPeriodId)).toBe(String(period._id));
    expect((await UtilityPeriod.findById(period._id).lean()).status).toBe("open");
  });

  test("meter replacement records old final, new opening, and evidence explicitly", async () => {
    const period = await createOpenUtilityPeriodWithBoundary({
      utilityType: "electricity",
      room,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      startMode: UTILITY_PERIOD_START_MODE.EXACT_OBSERVATION,
      startReading: 9000,
      ratePerUnit: 16,
      actorId: actor._id,
    });
    const result = await resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-10T00:00:00.000Z"),
      reading: 10,
      eventType: "meterReplacement",
      actorId: actor._id,
      meterReset: {
        oldMeterFinalReading: 9800,
        evidenceReferences: ["work-order:MR-100"],
      },
    });

    expect(String(result.boundary.utilityPeriodId)).toBe(String(period._id));
    expect(result.boundary.reading).toBe(10);
    expect(result.boundary.meterReset.oldMeterFinalReading).toBe(9800);
    expect(result.boundary.meterReset.evidenceReferences).toEqual(["work-order:MR-100"]);
  });

  test("meter reset without evidence remains blocked", async () => {
    await createOpenUtilityPeriodWithBoundary({
      utilityType: "electricity",
      room,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      startMode: UTILITY_PERIOD_START_MODE.EXACT_OBSERVATION,
      startReading: 9000,
      ratePerUnit: 16,
      actorId: actor._id,
    });
    await expect(resolveRoomUtilityBoundaryContext({
      room,
      eventAt: new Date("2026-09-10T00:00:00.000Z"),
      reading: 10,
      eventType: "meterReplacement",
      actorId: actor._id,
      meterReset: { oldMeterFinalReading: 9800, evidenceReferences: [] },
    })).rejects.toMatchObject({ code: "METER_RESET_EVIDENCE_REQUIRED" });
  });

  test("normal boundary writes cannot bypass manual review", async () => {
    const period = await createOpenUtilityPeriodWithBoundary({
      utilityType: "electricity",
      room,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      startReading: 100,
      ratePerUnit: 16,
      actorId: actor._id,
    });
    period.status = "manual_review_required";
    await period.save();
    await expect(
      resolveRoomUtilityBoundaryContext({
        room,
        eventAt: new Date("2026-09-02T00:00:00.000Z"),
        reading: 101,
        eventType: "moveIn",
        tenantId: tenant._id,
        actorId: actor._id,
      }),
    ).rejects.toMatchObject({
      code: "ROOM_UTILITY_BOUNDARY_MANUAL_REVIEW_REQUIRED",
    });
  });
});
