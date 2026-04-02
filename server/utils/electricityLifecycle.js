import { BillingPeriod } from "../models/index.js";
import {
  getDefaultElectricityRatePerKwh,
  resolveElectricityRatePerKwh,
} from "./businessSettings.js";
import {
  getUtilityTargetCloseDate,
  resolveUtilityAutoOpenStartDate,
} from "./billingPolicy.js";

export async function ensureOpenElectricityPeriodForRoom({
  room,
  anchorDate,
  anchorReading,
}) {
  const existingOpenPeriod = await BillingPeriod.findOne({
    roomId: room._id,
    status: "open",
    isArchived: false,
  });

  if (existingOpenPeriod) {
    return {
      period: existingOpenPeriod,
      created: false,
      targetCloseDate: getUtilityTargetCloseDate(existingOpenPeriod.startDate),
    };
  }

  const previousPeriod = await BillingPeriod.findOne({
    roomId: room._id,
    isArchived: false,
  })
    .sort({ startDate: -1 })
    .lean();

  const configuredRate = await getDefaultElectricityRatePerKwh();
  const ratePerKwh = resolveElectricityRatePerKwh(
    previousPeriod?.ratePerKwh,
    configuredRate,
  );
  const periodStartDate = resolveUtilityAutoOpenStartDate({
    anchorDate,
    previousPeriodEndDate: previousPeriod?.endDate || null,
  });

  const period = await BillingPeriod.create({
    roomId: room._id,
    branch: room.branch,
    startDate: periodStartDate || new Date(anchorDate),
    startReading: Number(anchorReading),
    ratePerKwh,
    status: "open",
  });

  return {
    period,
    created: true,
    targetCloseDate: getUtilityTargetCloseDate(period.startDate),
  };
}
