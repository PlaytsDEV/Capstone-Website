import dotenv from "dotenv";
import mongoose from "mongoose";
import { Bill, UtilityPeriod, UtilityReading } from "../models/index.js";
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
    const dispatchPath = `utilityDispatch.${period.utilityType}.periodId`;
    const bills = await Bill.find({ [dispatchPath]: period._id, isArchived: false });
    report.push({
      periodId: String(period._id),
      utilityType: period.utilityType,
      before: { startDate: dateKey(period.startDate), endDate: dateKey(period.endDate), closedAt: dateKey(period.closedAt) },
      after: { startDate: dateKey(range.startDate), endDate: dateKey(range.endDate) },
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
    });

    if (!isWrite) continue;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        period.startDate = range.startDate;
        period.endDate = range.endDate;
        period.segments = repairedSegments(period.segments, range);
        period.revised = true;
        period.revisedAt = new Date();
        period.revisionNote = "Corrected impossible future utility dates using the persisted period-finalization date; financial amounts and payment history were preserved.";
        await period.save({ session });

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

      await logBillingAudit({
        action: "utility_date_integrity_repair",
        severity: "warning",
        details: "Corrected impossible utility cycle and sent-bill dates; recalculated lifecycle status while preserving financial amounts and payment ledger history.",
        metadata: report[report.length - 1],
        entityType: "utility_period",
        entityId: period._id,
        branch: period.branch || null,
      }).catch((error) => {
        console.warn(`[repair-future-utility-period-dates] Audit log failed for ${period._id}: ${error.message}`);
      });
    } finally {
      await session.endSession();
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
