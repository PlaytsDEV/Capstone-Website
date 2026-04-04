import {
  DEFAULT_BRANCH_OVERRIDES,
  getBranchSettings,
  getBusinessSettings,
  serializeBranchOverrides,
} from "../utils/businessSettings.js";
import { sendSuccess } from "../middleware/errorHandler.js";

export async function getBusinessRules(req, res, next) {
  try {
    const settings = await getBusinessSettings();
    sendSuccess(res, {
      reservationFeeAmount: settings.reservationFeeAmount,
      penaltyRatePerDay: settings.penaltyRatePerDay,
      defaultElectricityRatePerKwh: settings.defaultElectricityRatePerKwh,
      defaultWaterRatePerUnit: settings.defaultWaterRatePerUnit,
      branchOverrides: serializeBranchOverrides(settings.branchOverrides),
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBusinessRules(req, res, next) {
  try {
    const {
      reservationFeeAmount,
      penaltyRatePerDay,
      defaultElectricityRatePerKwh,
      defaultWaterRatePerUnit,
      branchOverrides,
    } = req.body;
    const settings = await getBusinessSettings();

    if (reservationFeeAmount !== undefined) {
      const parsed = Number(reservationFeeAmount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: "Reservation fee amount must be a non-negative number" });
      }
      settings.reservationFeeAmount = parsed;
    }

    if (penaltyRatePerDay !== undefined) {
      const parsed = Number(penaltyRatePerDay);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: "Penalty rate per day must be a non-negative number" });
      }
      settings.penaltyRatePerDay = parsed;
    }

    if (defaultElectricityRatePerKwh !== undefined) {
      const parsed = Number(defaultElectricityRatePerKwh);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: "Default electricity rate must be a non-negative number" });
      }
      settings.defaultElectricityRatePerKwh = parsed;
    }

    if (defaultWaterRatePerUnit !== undefined) {
      const parsed = Number(defaultWaterRatePerUnit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: "Default water rate must be a non-negative number" });
      }
      settings.defaultWaterRatePerUnit = parsed;
    }

    if (branchOverrides !== undefined) {
      const mergedOverrides = serializeBranchOverrides({
        ...serializeBranchOverrides(settings.branchOverrides),
        ...branchOverrides,
      });
      settings.branchOverrides = mergedOverrides;
    }

    await settings.save();

    sendSuccess(res, {
      reservationFeeAmount: settings.reservationFeeAmount,
      penaltyRatePerDay: settings.penaltyRatePerDay,
      defaultElectricityRatePerKwh: settings.defaultElectricityRatePerKwh,
      defaultWaterRatePerUnit: settings.defaultWaterRatePerUnit,
      branchOverrides: serializeBranchOverrides(settings.branchOverrides),
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBranchBillingSettings(req, res, next) {
  try {
    const branch = String(req.params.branch || "").toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_BRANCH_OVERRIDES, branch)) {
      return res.status(400).json({ error: "Unsupported branch for billing overrides" });
    }

    const settings = await getBusinessSettings();
    const current = getBranchSettings(branch, settings);
    const nextSettings = { ...current };

    if (req.body.isApplianceFeeEnabled !== undefined) {
      nextSettings.isApplianceFeeEnabled = Boolean(req.body.isApplianceFeeEnabled);
    }

    if (req.body.applianceFeeAmountPerUnit !== undefined) {
      const parsed = Number(req.body.applianceFeeAmountPerUnit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: "Appliance fee amount must be a non-negative number" });
      }
      nextSettings.applianceFeeAmountPerUnit = parsed;
    }

    settings.branchOverrides = {
      ...serializeBranchOverrides(settings.branchOverrides),
      [branch]: nextSettings,
    };
    await settings.save();

    sendSuccess(res, {
      branch,
      settings: getBranchSettings(branch, settings),
      branchOverrides: serializeBranchOverrides(settings.branchOverrides),
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}
