import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { AuditLog, Room, UtilityHistoricalGap, UtilityPeriod } from "../../models/index.js";
import { resolveHistoricalUtilityGap } from "./utilityHistoricalGapService.js";

describe("historical utility-gap resolution", () => {
  let mongo; let actorId; let period; let gap;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "utility_gap_resolution" });
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); }, 120_000);
  beforeEach(async () => {
    await Promise.all([AuditLog.deleteMany({}), Room.deleteMany({}), UtilityHistoricalGap.deleteMany({}), UtilityPeriod.deleteMany({})]);
    actorId = new mongoose.Types.ObjectId();
    const reservationId = new mongoose.Types.ObjectId();
    const tenantId = new mongoose.Types.ObjectId();
    const room = await Room.create({ name: "GP - Room 705", roomNumber: "GP-705", branch: "gil-puyat", type: "private", capacity: 1, currentOccupancy: 1, price: 14400 });
    period = await UtilityPeriod.create({ utilityType: "electricity", roomId: room._id, branch: room.branch, startDate: new Date("2026-09-01T12:00:00Z"), startReading: 100, ratePerUnit: 16, status: "manual_review_required", manualReviewReason: "unknown_prebaseline_consumption" });
    gap = await UtilityHistoricalGap.create({ repairKey: `test:${new mongoose.Types.ObjectId()}`, utilityType: "electricity", roomId: room._id, branch: room.branch, utilityPeriodId: period._id,
      intervalStart: new Date("2026-09-01T00:00:00Z"), intervalEnd: period.startDate, reason: "UNKNOWN_PREBASELINE_TENANT_LIABILITY", reservationId, tenantId,
      evidenceReferences: ["meter-photo:fresh"], reviewState: "PENDING", blocksTransfer: true, openedBy: actorId, openedAt: new Date(), reviewOwner: actorId, reviewReference: "review:1" });
    period.manualReview = { reviewType: "HISTORICAL_PHYSICAL_METER_GAP", reason: "unknown_prebaseline_consumption", openedAt: new Date(), openedBy: actorId,
      observationAt: period.startDate, affectedIntervalStart: gap.intervalStart, affectedIntervalEnd: gap.intervalEnd, evidenceReferences: ["meter-photo:fresh"], reviewOwner: actorId,
      reviewReference: "review:1", historicalGapId: gap._id, resolution: null };
    await period.save();
  });

  test("10. resolution persists actor, outcome, evidence, and immutable audit metadata", async () => {
    const result = await resolveHistoricalUtilityGap({ reviewRecordId: gap._id, expectedPeriodId: period._id, actorId, outcome: "OTHER_REVIEWED_DISPOSITION", explanation: "Owner-approved debit", evidenceReferences: ["ledger:review"], approvalReference: "owner:approval", financialDispositionType: "MANUAL_DEBIT", financialAmount: 25 });
    expect(result.gap.resolution).toMatchObject({ outcome: "OTHER_REVIEWED_DISPOSITION", financialAmount: 25 });
    expect(String(result.gap.resolution.resolvedBy)).toBe(String(actorId));
    expect(await AuditLog.countDocuments({ logId: `UTILITY-GAP-RESOLUTION-${gap._id}` })).toBe(1);
  });
  test("13-14. resolution opens the same period and creates no second active period", async () => {
    const originalId = String(period._id);
    await resolveHistoricalUtilityGap({ reviewRecordId: gap._id, expectedPeriodId: period._id, actorId, outcome: "APPROVED_NON_CHARGE", explanation: "Authorized business loss", approvalReference: "owner:approval" });
    const active = await UtilityPeriod.find({ roomId: period.roomId, status: { $in: ["open", "manual_review_required"] }, isArchived: false }).lean();
    expect(active).toHaveLength(1);
    expect(String(active[0]._id)).toBe(originalId);
    expect(active[0].status).toBe("open");
  });
  test("a completed resolution is immutable and cannot be applied twice", async () => {
    const input = { reviewRecordId: gap._id, expectedPeriodId: period._id, actorId, outcome: "APPROVED_NON_CHARGE", explanation: "Authorized business loss", approvalReference: "owner:approval" };
    await resolveHistoricalUtilityGap(input);
    await expect(resolveHistoricalUtilityGap(input)).rejects.toMatchObject({ code: "UTILITY_REVIEW_NOT_PENDING" });
  });
  test("reconstructed outcome accepts only the trusted canonical recomputation result", async () => {
    const result = await resolveHistoricalUtilityGap({
      reviewRecordId: gap._id,
      expectedPeriodId: period._id,
      actorId,
      outcome: "RECONSTRUCTED_FROM_VERIFIED_READING",
      explanation: "Recovered the physical start boundary",
      evidenceReferences: ["verified-photo:start"],
      approvalReference: "owner:approval",
      verifiedOpeningReading: 90,
      canonicalRecompute: async () => ({ amount: 160, reference: "canonical-engine:test-vector" }),
    });
    expect(result.resolution).toMatchObject({ financialAmount: 160, financialDispositionType: "CANONICAL_RECONSTRUCTED_CHARGE" });
    expect(result.resolution.evidenceReferences).toContain("canonical-engine:test-vector");
  });
});
