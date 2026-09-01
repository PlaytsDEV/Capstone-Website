import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Room, User, UtilityPeriod, UtilityReading } from "../../models/index.js";
import {
  createOpenUtilityPeriodWithBoundary,
  classifyUtilityPeriodDocuments,
  resolveUtilityPeriodState,
  utilityPeriodStateError,
  UTILITY_PERIOD_STATE,
  UTILITY_PERIOD_START_MODE,
  normalizeUtilityPeriodStart,
  utilityPeriodContainsCutover,
} from "./utilityPeriodLifecycleService.js";

describe("canonical utility-period lifecycle service", () => {
  let mongo;
  let room;
  let actor;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "utility_period_lifecycle" });
    await UtilityPeriod.syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([Room.deleteMany({}), User.deleteMany({}), UtilityPeriod.deleteMany({}), UtilityReading.deleteMany({})]);
    room = await Room.create({ name: "GP - Room Test", roomNumber: "GP-T", branch: "gil-puyat", type: "private", capacity: 1, currentOccupancy: 0, price: 10000 });
    actor = await User.create({ firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `${new mongoose.Types.ObjectId()}@ex.test`, username: `u_${new mongoose.Types.ObjectId()}`, firstName: "Admin", lastName: "Test", role: "branch_admin", branch: "gil-puyat" });
  });

  test("Open Current Period persists open with one locked start boundary", async () => {
    const period = await createOpenUtilityPeriodWithBoundary({ utilityType: "electricity", room, startDate: new Date("2026-09-01T00:00:00.000+08:00"), startReading: 0, ratePerUnit: 16, actorId: actor._id });
    const stored = await UtilityPeriod.findById(period._id).lean();
    expect(stored).toMatchObject({ status: "open", endDate: null, endReading: null, closedAt: null, startReading: 0 });
    const boundaries = await UtilityReading.find({ utilityPeriodId: period._id }).lean();
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]).toMatchObject({ eventType: "periodStart", reading: 0, readingStatus: "locked" });
  });

  test("period and start boundary roll back together when boundary validation fails", async () => {
    await expect(createOpenUtilityPeriodWithBoundary({ utilityType: "electricity", room, startDate: new Date(), startReading: 5, ratePerUnit: 16, actorId: "not-an-object-id" })).rejects.toThrow();
    expect(await UtilityPeriod.countDocuments()).toBe(0);
    expect(await UtilityReading.countDocuments()).toBe(0);
  });

  test("resolver distinguishes missing, closed-only, manual review, open, and outside-period", async () => {
    expect((await resolveUtilityPeriodState({ utilityType: "electricity", roomId: room._id })).state).toBe(UTILITY_PERIOD_STATE.MISSING);
    const closed = await UtilityPeriod.create({ utilityType: "electricity", roomId: room._id, branch: room.branch, startDate: new Date("2026-08-01T00:00:00.000+08:00"), endDate: new Date("2026-09-01T00:00:00.000+08:00"), startReading: 0, endReading: 10, ratePerUnit: 16, status: "closed" });
    expect((await resolveUtilityPeriodState({ utilityType: "electricity", roomId: room._id })).state).toBe(UTILITY_PERIOD_STATE.CLOSED_ONLY);
    const open = await UtilityPeriod.create({ utilityType: "electricity", roomId: room._id, branch: room.branch, startDate: new Date("2026-09-01T00:00:00.000+08:00"), startReading: 10, ratePerUnit: 16, status: "open" });
    expect((await resolveUtilityPeriodState({ utilityType: "electricity", roomId: room._id, cutoverDate: new Date("2026-09-01T12:00:00.000+08:00") })).state).toBe(UTILITY_PERIOD_STATE.OPEN);
    expect((await resolveUtilityPeriodState({ utilityType: "electricity", roomId: room._id, cutoverDate: new Date("2026-09-01T00:00:00.000+08:00") })).state).toBe(UTILITY_PERIOD_STATE.OPEN);
    expect((await resolveUtilityPeriodState({ utilityType: "electricity", roomId: room._id, cutoverDate: new Date("2026-08-31T12:00:00.000+08:00") })).state).toBe(UTILITY_PERIOD_STATE.OUTSIDE_PERIOD);
    open.status = "manual_review_required";
    open.manualReviewReason = "test";
    await open.save();
    expect((await resolveUtilityPeriodState({ utilityType: "electricity", roomId: room._id })).state).toBe(UTILITY_PERIOD_STATE.MANUAL_REVIEW_REQUIRED);
    expect(closed.status).toBe("closed");
  });

  test("ambiguity is never silently resolved and produces a typed transfer blocker", () => {
    const resolution = classifyUtilityPeriodDocuments([
      { _id: new mongoose.Types.ObjectId(), status: "open", isArchived: false, startDate: new Date("2026-08-01T00:00:00.000+08:00") },
      { _id: new mongoose.Types.ObjectId(), status: "manual_review_required", isArchived: false, startDate: new Date("2026-09-01T00:00:00.000+08:00") },
    ]);
    expect(resolution).toMatchObject({ state: UTILITY_PERIOD_STATE.AMBIGUOUS, activeCount: 2, period: null });
    expect(utilityPeriodStateError({ resolution, roomLabel: "GP-Room1008", role: "destination" }))
      .toMatchObject({ statusCode: 409, code: "ROOM_TRANSFER_DESTINATION_ELECTRICITY_PERIOD_AMBIGUOUS" });
  });

  test("concurrent open attempts cannot create two active periods", async () => {
    const attempts = await Promise.allSettled([
      createOpenUtilityPeriodWithBoundary({ utilityType: "electricity", room, startDate: new Date("2026-09-01T00:00:00.000+08:00"), startReading: 10, ratePerUnit: 16, actorId: actor._id }),
      createOpenUtilityPeriodWithBoundary({ utilityType: "electricity", room, startDate: new Date("2026-09-02T00:00:00.000+08:00"), startReading: 10, ratePerUnit: 16, actorId: actor._id }),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await UtilityPeriod.countDocuments({ status: { $in: ["open", "manual_review_required"] } })).toBe(1);
    expect(await UtilityReading.countDocuments({ eventType: "periodStart" })).toBe(1);
  });

  test("1. exact timestamp containment uses half-open instants", () => {
    const period = { startDate: new Date("2026-09-01T12:00:00.000Z"), endDate: new Date("2026-09-01T13:00:00.000Z") };
    expect(utilityPeriodContainsCutover(period, { cutoverAt: "2026-09-01T12:00:00.000Z" })).toBe(true);
    expect(utilityPeriodContainsCutover(period, { cutoverAt: "2026-09-01T13:00:00.000Z" })).toBe(false);
  });

  test("2. same-day period beginning after cutover is OUTSIDE_PERIOD", () => {
    const result = classifyUtilityPeriodDocuments([{ status: "open", isArchived: false, startDate: new Date("2026-09-01T12:00:00.000Z") }], { cutoverAt: new Date("2026-09-01T01:00:00.000Z") });
    expect(result.state).toBe(UTILITY_PERIOD_STATE.OUTSIDE_PERIOD);
  });

  test("3. exact shared boundary selects the next period", () => {
    const boundary = new Date("2026-09-01T12:00:00.000Z");
    const result = classifyUtilityPeriodDocuments([
      { status: "closed", isArchived: false, startDate: new Date("2026-09-01T11:00:00.000Z"), endDate: boundary },
      { _id: "next", status: "open", isArchived: false, startDate: boundary },
    ], { cutoverAt: boundary });
    expect(result).toMatchObject({ state: UTILITY_PERIOD_STATE.OPEN, period: { _id: "next" } });
  });

  test("4. monthly date-only opening retains Manila-midnight semantics", () => {
    expect(normalizeUtilityPeriodStart({ startDate: "2026-09-01", startMode: UTILITY_PERIOD_START_MODE.BUSINESS_DATE }).toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });

  test("5. exact-observation opening preserves clock time on period and boundary", async () => {
    const observedAt = new Date("2026-09-01T12:35:12.123Z");
    const period = await createOpenUtilityPeriodWithBoundary({ utilityType: "electricity", room, startDate: observedAt, startMode: UTILITY_PERIOD_START_MODE.EXACT_OBSERVATION, startReading: 77, ratePerUnit: 16, actorId: actor._id });
    const boundary = await UtilityReading.findOne({ utilityPeriodId: period._id }).lean();
    expect(period.startDate.toISOString()).toBe(observedAt.toISOString());
    expect(boundary.date.toISOString()).toBe(observedAt.toISOString());
  });
});
