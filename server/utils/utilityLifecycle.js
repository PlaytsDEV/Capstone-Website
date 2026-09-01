import { UtilityPeriod } from "../models/index.js";
import {
  getDefaultElectricityRatePerKwh,
  getDefaultWaterRatePerUnit,
} from "./businessSettings.js";
import {
  getUtilityTargetCloseDate,
  resolveUtilityAutoOpenStartDate,
} from "./billingPolicy.js";
import {
  createOpenUtilityPeriodWithBoundary,
  resolveUtilityPeriodState,
  UTILITY_PERIOD_STATE,
} from "../services/billing/utilityPeriodLifecycleService.js";

function resolveUtilityRate(utilityType, previousRate, defaultRate) {
  if (previousRate !== undefined && previousRate !== null) {
    return previousRate;
  }
  return defaultRate;
}

export async function ensureOpenUtilityPeriodForRoom({
  utilityType,
  room,
  anchorDate,
  anchorReading,
  actorId = null,
}) {
  const resolution = await resolveUtilityPeriodState({
    utilityType,
    roomId: room._id,
  });

  if (resolution.state === UTILITY_PERIOD_STATE.OPEN) {
    return {
      period: resolution.period,
      created: false,
      targetCloseDate: getUtilityTargetCloseDate(resolution.period.startDate),
    };
  }
  if (resolution.state !== UTILITY_PERIOD_STATE.MISSING && resolution.state !== UTILITY_PERIOD_STATE.CLOSED_ONLY) {
    throw Object.assign(new Error("The room's utility period requires review before a new period can be opened."), {
      statusCode: 409,
      code: "UTILITY_PERIOD_NOT_OPENABLE",
      details: { periodState: resolution.state },
    });
  }

  const previousPeriod = await UtilityPeriod.findOne({
    utilityType,
    roomId: room._id,
    isArchived: false,
  })
    .sort({ startDate: -1 })
    .lean();

  let configuredRate;
  if (utilityType === "electricity") {
    configuredRate = await getDefaultElectricityRatePerKwh();
  } else {
    configuredRate = await getDefaultWaterRatePerUnit();
  }
  
  const ratePerUnit = resolveUtilityRate(
    utilityType,
    previousPeriod?.ratePerUnit,
    configuredRate,
  );
  
  const periodStartDate = resolveUtilityAutoOpenStartDate({
    anchorDate,
    previousPeriodEndDate: previousPeriod?.endDate || null,
  });

  if (!actorId) {
    throw Object.assign(new Error("An actor is required to create the locked period-start reading."), {
      statusCode: 400,
      code: "UTILITY_PERIOD_ACTOR_REQUIRED",
    });
  }
  const period = await createOpenUtilityPeriodWithBoundary({
    utilityType,
    room,
    startDate: periodStartDate || new Date(anchorDate),
    startReading: utilityType === "water" ? 0 : Number(anchorReading),
    ratePerUnit,
    actorId,
  });

  return {
    period,
    created: true,
    targetCloseDate: getUtilityTargetCloseDate(period.startDate),
  };
}
