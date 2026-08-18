import dotenv from "dotenv";
import mongoose from "mongoose";
import { AuditLog, Bill, UtilityPeriod, UtilityReading } from "../models/index.js";
import { getManilaDayjs } from "../utils/dateUtils.js";
import {
  getUtilityDueDate,
  resolveBillStatus,
  syncBillAmounts,
} from "../services/billing/billingPolicy.js";
import { logBillingAudit } from "../utils/billingAudit.js";

dotenv.config();

const isWrite = process.argv.includes("--write");
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const REPAIR_NOTE = "Corrected impossible future utility dates using the persisted period-finalization date; financial amounts and payment history were preserved.";
const ARCHIVE_NOTE = "Archived a redundant unbilled utility period whose corrected start date would duplicate another active period; readings and history were preserved as archived records.";
const AUDIT_ACTION = "utility date integrity repair";

function day(value) {
  return value ? getManilaDayjs(value).startOf("day") : null;
}

function dateKey(value) {
  return value ? day(value).format("YYYY-MM-DD") : null;
}

function isAfter(left, right) {
  return Boolean(left && right && day(left).isAfter(day(right)));
}

function clampToRange(value, start, end) {
  if (!value) return value;
  const candidate = day(value);
  if (candidate.isBefore(day(start))) return day(start).toDate();
  if (candidate.isAfter(day(end))) return day(end).toDate();
  return candidate.toDate();
}

function repairRange(period, today) {
  const evidence = day(period.closedAt || period.updatedAt || period.createdAt);
  const evidenceDay = evidence?.isAfter(today) ? today : evidence;
  if (!evidenceDay) return null;

  let start = day(period.startDate);
  let end = day(period.endDate);
  if (!start || !end) return null;

  const invalid = start.isAfter(today)
    || end.isAfter(today)
    || evidenceDay.isBefore(start)
    || evidenceDay.isBefore(end)
    || end.isBefore(start);
  if (!invalid) return null;

  if (start.isAfter(evidenceDay)) start = evidenceDay;
  if (end.isAfter(evidenceDay) || end.isBefore(start)) end = evidenceDay;
  if (start.isAfter(end)) start = end;

  return { startDate: start.toDate(), endDate: end.toDate(), evidenceDate: evidenceDay.toDate() };
}

function repairedSegments(segments, range) {
  return (segments || []).map((segment) => {
    const startDate = clampToRange(segment.startDate, range.startDate, range.endDate);
    const endDate = clampToRange(segment.endDate, range.startDate, range.endDate);
    return {
      ...(segment.toObject ? segment.toObject() : segment),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  });
}

function correctedSentBillDates(bill, period, range) {
  const dispatch = bill.utilityDispatch?.[period.utilityType];
  if (dispatch?.state !== "sent") return null;

  const issuedAt = day(
    dispatch.publishedAt
    || bill.releasedAt
    || period.closedAt
    || range.evidenceDate,
  ).toDate();
  return { issuedAt, dueDate: getUtilityDueDate(issuedAt) };
}

async function logRepairAuditOnce(period, metadata, details) {
  const entityId = String(period._id);
  const exists = await AuditLog.exists({
    action: AUDIT_ACTION,
    entityType: "utility",
    entityId,
  });
  if (exists) return;

  await logBillingAudit({
    action: "utility_date_integrity_repair",
    severity: "warning",
    details,
    metadata,
    entityType: "utility",
    entityId,
    branch: period.branch || null,
  });
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is not configured");
  await mongoose.connect(mongoUri, process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {});

  const today = day(new Date());
  const periods = await UtilityPeriod.find({
    status: { $in: ["closed", "revised"] },
    isArchived: false,
    startDate: { $ne: null },
    endDate: { $ne: null },
  });

  const targets = periods
    .map((period) => ({ period, range: repairRange(period, today) }))
    .filter((entry) => entry.range);

  const report = [];
  for (const { period, range } of targets) {
    const remainsActive = await UtilityPeriod.exists({ _id: period._id, isArchived: false });
    if (!remainsActive) continue;
    const rawPeriod = await UtilityPeriod.collection.findOne(
      { _id: period._id },
      { projection: { roomId: 1 } },
    );
    if (!rawPeriod) continue;

    const dispatchPath = `utilityDispatch.${period.utilityType}.periodId`;
    const bills = await Bill.find({ [dispatchPath]: period._id, isArchived: false });
    const startDateConflicts = await UtilityPeriod.collection.find({
      _id: { $ne: period._id },
      utilityType: period.utilityType,
      roomId: rawPeriod.roomId,
      startDate: range.startDate,
      isArchived: false,
    }).project({ _id: 1 }).toArray();
    const shouldArchiveAsRedundant = startDateConflicts.length > 0 && bills.length === 0;

    if (startDateConflicts.length > 0 && bills.length > 0) {
      throw new Error(
        `Refusing to repair billed period ${period._id}: corrected start date conflicts with active period ${startDateConflicts[0]._id}`,
      );
    }

    const reportEntry = {
      periodId: String(period._id),
      utilityType: period.utilityType,
      action: shouldArchiveAsRedundant ? "archive_redundant_unbilled_period" : "repair_dates",
      conflictingPeriodIds: startDateConflicts.map((entry) => String(entry._id)),
      before: { startDate: dateKey(period.startDate), endDate: dateKey(period.endDate), closedAt: dateKey(period.closedAt) },
      after: shouldArchiveAsRedundant
        ? { isArchived: true, startDate: dateKey(period.startDate), endDate: dateKey(period.endDate) }
        : { isArchived: false, startDate: dateKey(range.startDate), endDate: dateKey(range.endDate) },
      linkedBills: bills.map((bill) => {
        const corrected = correctedSentBillDates(bill, period, range);
        return {
          billId: String(bill._id),
          state: bill.utilityDispatch?.[period.utilityType]?.state || null,
          publishedAt: dateKey(bill.utilityDispatch?.[period.utilityType]?.publishedAt),
          releasedAt: dateKey(bill.releasedAt),
          issuedAt: dateKey(bill.issuedAt),
          dueDate: dateKey(bill.dueDate),
          correctedIssuedAt: dateKey(corrected?.issuedAt),
          correctedDueDate: dateKey(corrected?.dueDate),
          status: bill.status,
          correctedStatus: corrected
            ? resolveBillStatus({ ...bill.toObject(), dueDate: corrected.dueDate })
            : bill.status,
          paidAmount: Number(bill.paidAmount || 0),
        };
      }),
      settledBillCount: bills.filter((bill) => Number(bill.paidAmount || 0) > 0).length,
    };
    report.push(reportEntry);

    if (!isWrite) continue;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (shouldArchiveAsRedundant) {
          await UtilityPeriod.updateOne(
            { _id: period._id, isArchived: false },
            {
              $set: {
                isArchived: true,
                revised: true,
                revisedAt: new Date(),
                revisionNote: ARCHIVE_NOTE,
              },
            },
            { session },
          );
          await UtilityReading.updateMany(
            { utilityPeriodId: period._id, isArchived: false },
            { $set: { isArchived: true } },
            { session },
          );
          return;
        }

        await UtilityPeriod.updateOne(
          { _id: period._id, isArchived: false },
          {
            $set: {
              startDate: range.startDate,
              endDate: range.endDate,
              segments: repairedSegments(period.segments, range),
              revised: true,
              revisedAt: new Date(),
              revisionNote: REPAIR_NOTE,
            },
          },
          { session },
        );

        await UtilityReading.updateMany(
          { utilityPeriodId: period._id, eventType: "periodStart", isArchived: false },
          { $set: { date: range.startDate } },
          { session },
        );
        await UtilityReading.updateMany(
          { utilityPeriodId: period._id, eventType: "periodEnd", isArchived: false },
          { $set: { date: range.endDate } },
          { session },
        );

        for (const bill of bills) {
          const corrected = correctedSentBillDates(bill, period, range);
          if (corrected) {
            const entry = bill.utilityDispatch[period.utilityType];
            entry.issuedAt = corrected.issuedAt;
            entry.dueDate = corrected.dueDate;
            bill.markModified("utilityDispatch");
            bill.issuedAt = corrected.issuedAt;
            bill.dueDate = corrected.dueDate;
            syncBillAmounts(bill);
          }
          bill.utilityCycleStart = range.startDate;
          bill.utilityCycleEnd = range.endDate;
          bill.utilityReadingDate = range.endDate;
          await bill.save({ session });
        }
      });

      await logRepairAuditOnce(
        period,
        reportEntry,
        shouldArchiveAsRedundant
          ? "Archived a redundant unbilled utility period and its readings after a corrected-date collision; no financial record was removed."
          : "Corrected impossible utility cycle and sent-bill dates; recalculated lifecycle status while preserving financial amounts and payment ledger history.",
      ).catch((error) => {
        console.warn(`[repair-future-utility-period-dates] Audit log failed for ${period._id}: ${error.message}`);
      });
    } finally {
      await session.endSession();
    }
  }

  if (isWrite) {
    const previouslyRepaired = await UtilityPeriod.find({ revisionNote: REPAIR_NOTE });
    for (const period of previouslyRepaired) {
      await logRepairAuditOnce(
        period,
        {
          periodId: String(period._id),
          utilityType: period.utilityType,
          action: "repair_dates",
          auditRecovered: true,
          after: {
            isArchived: Boolean(period.isArchived),
            startDate: dateKey(period.startDate),
            endDate: dateKey(period.endDate),
          },
        },
        "Recorded the audit entry for an already-committed utility date integrity repair; financial amounts and payment history were preserved.",
      );
    }
  }

  console.log(JSON.stringify({
    mode: isWrite ? "write" : "dry-run",
    affectedPeriods: report.length,
    affectedBills: new Set(report.flatMap((entry) => entry.linkedBills.map((bill) => bill.billId))).size,
    settledBillsPreserved: report.reduce((sum, entry) => sum + entry.settledBillCount, 0),
    report,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[repair-future-utility-period-dates] ERROR:", error.message || String(error));
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
