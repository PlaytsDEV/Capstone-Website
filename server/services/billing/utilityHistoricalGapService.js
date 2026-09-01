import mongoose from "mongoose";
import {
  AuditLog,
  Room,
  UtilityHistoricalGap,
  UtilityPeriod,
} from "../../models/index.js";
import { UTILITY_REVIEW_OUTCOMES } from "../../models/UtilityPeriod.js";
import { roundMoney } from "./financialMath.js";
import { computeBilling, sortReadings } from "./billingEngine.js";
import { parsePhysicalMeterReading } from "../../utils/physicalMeterReading.js";
import { resolveRoomScopedReservationsForUtilityPeriod } from "./roomScopedUtilityParticipants.js";
import { buildTenantEventsForPeriod, filterBillableReservationsForPeriod } from "../../utils/utilityFlowRules.js";

const requiredText = (value, label) => {
  const normalized = String(value || "").trim();
  if (!normalized) throw Object.assign(new Error(`${label} is required.`), { statusCode: 400, code: "UTILITY_REVIEW_METADATA_REQUIRED" });
  return normalized;
};

const normalizeEvidence = (values) => [...new Set((Array.isArray(values) ? values : [values])
  .map((value) => String(value || "").trim()).filter(Boolean))];

export function validateHistoricalGapResolution({
  outcome,
  explanation,
  evidenceReferences,
  approvalReference,
  financialDispositionType,
  financialAmount,
  canonicalRecomputedAmount,
  canonicalCalculationReference,
}) {
  if (!UTILITY_REVIEW_OUTCOMES.includes(outcome)) {
    throw Object.assign(new Error("A supported historical-gap outcome is required."), { statusCode: 400, code: "UTILITY_REVIEW_OUTCOME_INVALID" });
  }
  const normalized = {
    outcome,
    explanation: requiredText(explanation, "Resolution explanation"),
    evidenceReferences: normalizeEvidence(evidenceReferences),
    approvalReference: requiredText(approvalReference, "Approval reference"),
  };

  if (outcome === "APPROVED_NON_CHARGE") {
    normalized.financialDispositionType = "AUTHORIZED_BUSINESS_LOSS_NON_CHARGE";
    normalized.financialAmount = 0;
  } else if (outcome === "ACCOUNTING_ADJUSTMENT") {
    const amount = Number(financialAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      throw Object.assign(new Error("Accounting adjustment requires an explicit, finite, non-zero signed amount."), { statusCode: 400, code: "UTILITY_REVIEW_SIGNED_ADJUSTMENT_REQUIRED" });
    }
    normalized.financialDispositionType = requiredText(financialDispositionType, "Financial disposition type");
    normalized.financialAmount = roundMoney(amount);
  } else if (outcome === "RECONSTRUCTED_FROM_VERIFIED_READING") {
    if (!normalized.evidenceReferences.length) {
      throw Object.assign(new Error("Verified physical evidence is required for reconstruction."), { statusCode: 400, code: "UTILITY_REVIEW_RECONSTRUCTION_EVIDENCE_REQUIRED" });
    }
    const amount = Number(canonicalRecomputedAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw Object.assign(new Error("A trusted canonical billing recomputation is required."), { statusCode: 422, code: "UTILITY_REVIEW_CANONICAL_RECOMPUTATION_REQUIRED" });
    }
    normalized.financialDispositionType = "CANONICAL_RECONSTRUCTED_CHARGE";
    normalized.financialAmount = roundMoney(amount);
    normalized.evidenceReferences.push(requiredText(canonicalCalculationReference, "Canonical calculation reference"));
  } else {
    const amount = Number(financialAmount);
    if (!Number.isFinite(amount)) {
      throw Object.assign(new Error("Other reviewed disposition requires an explicit signed financial amount."), { statusCode: 400, code: "UTILITY_REVIEW_FINANCIAL_AMOUNT_REQUIRED" });
    }
    normalized.financialDispositionType = requiredText(financialDispositionType, "Financial disposition type");
    normalized.financialAmount = roundMoney(amount);
  }
  return normalized;
}

export async function recomputeHistoricalGapFromVerifiedReading({ gap, period, verifiedOpeningReading, session = null }) {
  const opening = parsePhysicalMeterReading(verifiedOpeningReading, { fieldLabel: "Newly verified historical opening reading", maximum: 999999.99 });
  const closing = parsePhysicalMeterReading(period.startReading, { fieldLabel: "Fresh-baseline closing reading", maximum: 999999.99 });
  if (opening > closing) throw Object.assign(new Error("Verified historical reading exceeds the fresh baseline."), { statusCode: 400, code: "UTILITY_REVIEW_RECONSTRUCTION_READING_REGRESSION" });
  let roomQuery = Room.findById(gap.roomId).lean();
  if (session) roomQuery = roomQuery.session(session);
  const room = await roomQuery;
  if (!room) throw Object.assign(new Error("Historical-gap room was not found."), { statusCode: 404, code: "UTILITY_REVIEW_ROOM_NOT_FOUND" });
  const reservations = await resolveRoomScopedReservationsForUtilityPeriod({ room, periodStart: gap.intervalStart, periodEnd: gap.intervalEnd, utilityType: gap.utilityType, session });
  const billable = filterBillableReservationsForPeriod({ reservations, cycleStart: gap.intervalStart, cycleEnd: gap.intervalEnd });
  const readings = sortReadings([
    { _id: "verified-gap-start", utilityType: gap.utilityType, roomId: gap.roomId, reading: opening, date: gap.intervalStart, eventType: "periodStart", tenantId: null },
    { _id: "fresh-baseline-gap-end", utilityType: gap.utilityType, roomId: gap.roomId, reading: closing, date: gap.intervalEnd, eventType: "periodEnd", tenantId: null },
  ]);
  const syntheticPeriod = { startDate: gap.intervalStart, endDate: gap.intervalEnd, startReading: opening, endReading: closing, ratePerUnit: period.ratePerUnit };
  const tenantEvents = buildTenantEventsForPeriod({ period: syntheticPeriod, reservations: billable, readings });
  const result = computeBilling({ utilityPeriod: syntheticPeriod, readings, reservations: billable, tenantEvents, forceSegmented: true, utilityType: gap.utilityType, roomType: room.type });
  const summary = (result.tenantSummaries || []).find((item) => String(item.tenantId) === String(gap.tenantId));
  if (!summary) throw Object.assign(new Error("Canonical recomputation did not produce the affected tenant's share."), { statusCode: 409, code: "UTILITY_REVIEW_RECONSTRUCTION_TENANT_MISSING" });
  return { amount: roundMoney(summary.billAmount), reference: `canonical-gap-recompute:${gap._id}:${opening}:${closing}` };
}

export async function resolveHistoricalUtilityGap({
  reviewRecordId,
  expectedPeriodId = null,
  actorId,
  actorName = "Administrator",
  actorRole = "admin",
  branch = "",
  reviewedAt = new Date(),
  verifiedOpeningReading = null,
  canonicalRecompute = recomputeHistoricalGapFromVerifiedReading,
  session = null,
  ...decisionInput
}) {
  if (!actorId) throw Object.assign(new Error("Resolver actor is required."), { statusCode: 400, code: "UTILITY_REVIEW_ACTOR_REQUIRED" });
  const execute = async (activeSession) => {
    const gap = await UtilityHistoricalGap.findOne({
      _id: reviewRecordId,
      ...(expectedPeriodId ? { utilityPeriodId: expectedPeriodId } : {}),
      reviewState: "PENDING",
      isArchived: false,
    }).session(activeSession);
    if (!gap) throw Object.assign(new Error("Pending historical utility review was not found."), { statusCode: 409, code: "UTILITY_REVIEW_NOT_PENDING" });

    let trustedRecomputation = null;
    if (decisionInput.outcome === "RECONSTRUCTED_FROM_VERIFIED_READING") {
      const linkedPeriod = await UtilityPeriod.findById(gap.utilityPeriodId).session(activeSession).lean();
      trustedRecomputation = await canonicalRecompute({ gap, period: linkedPeriod, verifiedOpeningReading, session: activeSession });
    }
    const decision = validateHistoricalGapResolution({
      ...decisionInput,
      canonicalRecomputedAmount: trustedRecomputation?.amount ?? decisionInput.canonicalRecomputedAmount,
      canonicalCalculationReference: trustedRecomputation?.reference ?? decisionInput.canonicalCalculationReference,
    });

    const now = new Date(reviewedAt);
    const auditLogId = `UTILITY-GAP-RESOLUTION-${gap._id}`;
    const resolution = { ...decision, resolvedBy: actorId, reviewedAt: now, resolvedAt: now, auditLogId };
    const period = await UtilityPeriod.findOneAndUpdate(
      { _id: gap.utilityPeriodId, status: "manual_review_required", isArchived: false, "manualReview.resolution.outcome": null },
      { $set: {
        status: "open",
        manualReviewReason: null,
        manualReviewResolvedBy: actorId,
        manualReviewResolvedAt: now,
        "manualReview.reviewedAt": now,
        "manualReview.resolution": resolution,
      } },
      { new: true, runValidators: true, session: activeSession },
    );
    if (!period) throw Object.assign(new Error("The linked period is no longer awaiting this review."), { statusCode: 409, code: "UTILITY_REVIEW_PERIOD_TRANSITION_INVALID" });

    gap.reviewState = "RESOLVED";
    gap.resolution = resolution;
    await gap.save({ session: activeSession });
    await AuditLog.create([{
      logId: auditLogId,
      timestamp: now,
      type: "data_modification",
      action: "RESOLVE_HISTORICAL_UTILITY_GAP",
      severity: "high",
      user: actorName,
      userId: actorId,
      userRole: actorRole,
      branch: branch || gap.branch,
      entityType: "utility",
      entityId: String(gap._id),
      details: `Resolved ${gap.reason} without fabricating a meter reading.`,
      metadata: { gapId: String(gap._id), utilityPeriodId: String(period._id), resolution },
    }], { session: activeSession });
    return { gap, period, resolution };
  };
  if (session) return execute(session);
  const ownSession = await mongoose.startSession();
  try {
    let result;
    await ownSession.withTransaction(async () => { result = await execute(ownSession); });
    return result;
  } finally {
    await ownSession.endSession();
  }
}

export async function getResolvedHistoricalElectricityDisposition({ reservationId, roomId, session = null }) {
  let query = UtilityHistoricalGap.find({
    utilityType: "electricity",
    reservationId,
    roomId,
    reviewState: "RESOLVED",
    isArchived: false,
    "resolution.financialAmount": { $exists: true },
  }).select("_id resolution").lean();
  if (session) query = query.session(session);
  const gaps = await query;
  return {
    amount: roundMoney(gaps.reduce((sum, gap) => sum + Number(gap.resolution?.financialAmount || 0), 0)),
    gapIds: gaps.map((gap) => String(gap._id)),
  };
}
