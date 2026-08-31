/**
 * ============================================================================
 * APPLIANCE CATALOG CONTROLLER
 * ============================================================================
 *
 * Handles administrative CRUD operations for the appliance surcharge catalog.
 * Supports dynamic pricing, category classification, and automatic seeding
 * with soft-delete archiving for backward compatibility.
 */

import { Appliance, AuditLog } from "../models/index.js";
import logger from "../middleware/logger.js";
import { isValidObjectId } from "../utils/reservationHelpers.js";

// Standard default appliances to seed on first run
export const DEFAULT_APPLIANCE_SEEDS = Object.freeze([
  {
    name: "Electric Fan",
    code: "fan",
    monthlyFee: 200,
    category: "cooling",
    maxQuantity: 5,
    description: "Standard portable desk or stand fan",
    isActive: true,
  },
  {
    name: "Rice Cooker",
    code: "ricecooker",
    monthlyFee: 200,
    category: "cooking",
    maxQuantity: 2,
    description: "Small personal or compact rice cooker",
    isActive: true,
  },
  {
    name: "Laptop",
    code: "laptop",
    monthlyFee: 200,
    category: "electronics",
    maxQuantity: 3,
    description: "Personal laptop computer or charging station",
    isActive: true,
  },
]);

/**
 * Generate a safe URL-friendly code slug from an appliance name.
 * @param {string} name
 * @returns {string}
 */
export function slugifyCode(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Auto-seed standard appliances if the collection is empty.
 */
export async function ensureDefaultAppliancesSeeded() {
  try {
    const count = await Appliance.countDocuments();
    if (count === 0) {
      logger.info("Appliance catalog is empty. Auto-seeding default appliances...");
      await Appliance.insertMany(DEFAULT_APPLIANCE_SEEDS);
      logger.info("Successfully seeded default appliances into catalog.");
    }
  } catch (err) {
    logger.warn(`Could not verify/seed default appliances: ${err.message}`);
  }
}

/**
 * GET /api/appliances
 * Fetch all active appliances (or all if includeInactive=true).
 */
export const getAppliances = async (req, res) => {
  try {
    await ensureDefaultAppliancesSeeded();

    const includeInactive =
      req.query.includeInactive === "true" || req.query.includeInactive === true;
    const filter = includeInactive ? {} : { isActive: true };

    const appliances = await Appliance.find(filter)
      .sort({ category: 1, name: 1 })
      .lean();

    return res.json({
      success: true,
      count: appliances.length,
      data: appliances,
    });
  } catch (err) {
    logger.error(`Error fetching appliance catalog: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch appliance catalog.",
      code: "FETCH_APPLIANCES_ERROR",
    });
  }
};

/**
 * Validate appliance input payload.
 * Returns error string or null if valid.
 */
export const validateApplianceInput = ({ name, monthlyFee, maxQuantity, description }) => {
  if (name !== undefined) {
    const trimmed = String(name || "").trim();
    if (!trimmed || trimmed.length < 3) {
      return "Appliance name must be at least 3 characters.";
    }
    if (trimmed.length > 50) {
      return "Appliance name cannot exceed 50 characters.";
    }
    const nameRegex = /^(?=.*[a-zA-Z])[a-zA-Z0-9\s\-()\/]+$/;
    if (!nameRegex.test(trimmed)) {
      return "Appliance name must contain letters and only letters, numbers, spaces, hyphens, and parentheses.";
    }
  }

  if (monthlyFee !== undefined) {
    const feeNum = Number(monthlyFee);
    if (Number.isNaN(feeNum) || feeNum < 0) {
      return "Monthly fee must be a non-negative number.";
    }
    if (feeNum > 5000) {
      return "Monthly fee cannot exceed ₱5,000.";
    }
    if (!Number.isInteger(feeNum) || feeNum % 10 !== 0) {
      return "Monthly fee must be a whole number in increments of ₱10.";
    }
  }

  if (maxQuantity !== undefined) {
    const qtyNum = Number(maxQuantity);
    if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 10) {
      return "Max units per tenant must be a whole number between 1 and 10.";
    }
  }

  if (description !== undefined) {
    const descTrimmed = String(description || "").trim();
    if (descTrimmed.length > 150) {
      return "Description cannot exceed 150 characters.";
    }
  }

  return null;
};

/**
 * POST /api/appliances
 * Create a new appliance in the catalog.
 */
export const createAppliance = async (req, res) => {
  try {
    const {
      name,
      code,
      monthlyFee,
      category = "general",
      maxQuantity = 5,
      description = "",
      isActive = true,
    } = req.body;

    const validationError = validateApplianceInput({
      name,
      monthlyFee,
      maxQuantity,
      description,
    });
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
        code: "VALIDATION_ERROR",
      });
    }

    const trimmedName = String(name || "").trim();
    const feeNum = Number(monthlyFee);

    const generatedCode = String(code || "").trim().toLowerCase() || slugifyCode(trimmedName);
    if (!generatedCode) {
      return res.status(400).json({
        success: false,
        error: "A valid appliance code or name is required.",
        code: "INVALID_CODE",
      });
    }

    // Check for duplicate code or name
    const existing = await Appliance.findOne({
      $or: [
        { code: generatedCode },
        { name: { $regex: new RegExp(`^${trimmedName}$`, "i") } },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `An appliance with code '${generatedCode}' or name '${trimmedName}' already exists.`,
        code: "APPLIANCE_ALREADY_EXISTS",
      });
    }

    const parsedMaxQty = Number(maxQuantity);
    const validMaxQty = Number.isInteger(parsedMaxQty) && parsedMaxQty >= 1 && parsedMaxQty <= 10 ? parsedMaxQty : 5;

    const newAppliance = await Appliance.create({
      name: trimmedName,
      code: generatedCode,
      monthlyFee: feeNum,
      category: String(category || "general").toLowerCase().trim(),
      maxQuantity: validMaxQty,
      description: String(description || "").trim(),
      isActive: Boolean(isActive),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    // Log audit trail
    try {
      await AuditLog.create({
        userId: req.user?._id || null,
        userEmail: req.user?.email || "system",
        userRole: req.user?.role || "admin",
        action: "appliance.created",
        targetId: newAppliance._id?.toString(),
        targetType: "Appliance",
        details: {
          name: newAppliance.name,
          code: newAppliance.code,
          monthlyFee: newAppliance.monthlyFee,
          category: newAppliance.category,
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to write appliance audit log: ${auditErr.message}`);
    }

    return res.status(201).json({
      success: true,
      message: "Appliance added to catalog successfully.",
      data: newAppliance,
    });
  } catch (err) {
    logger.error(`Error creating appliance: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to create appliance.",
      code: "CREATE_APPLIANCE_ERROR",
    });
  }
};

/**
 * PATCH /api/appliances/:id
 * Update an existing appliance.
 */
export const updateAppliance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid appliance ID.",
        code: "INVALID_APPLIANCE_ID",
      });
    }

    const appliance = await Appliance.findById(id);
    if (!appliance) {
      return res.status(404).json({
        success: false,
        error: "Appliance not found.",
        code: "APPLIANCE_NOT_FOUND",
      });
    }

    const {
      name,
      monthlyFee,
      category,
      maxQuantity,
      description,
      isActive,
    } = req.body;

    const validationError = validateApplianceInput({
      name,
      monthlyFee,
      maxQuantity,
      description,
    });
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
        code: "VALIDATION_ERROR",
      });
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();
      // Check duplicate name on other appliances
      const existingName = await Appliance.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${trimmed}$`, "i") },
      });
      if (existingName) {
        return res.status(409).json({
          success: false,
          error: `Another appliance with name '${trimmed}' already exists.`,
          code: "APPLIANCE_ALREADY_EXISTS",
        });
      }
      appliance.name = trimmed;
    }

    if (monthlyFee !== undefined) {
      appliance.monthlyFee = Number(monthlyFee);
    }

    if (category !== undefined) {
      appliance.category = String(category).toLowerCase().trim();
    }

    if (maxQuantity !== undefined) {
      appliance.maxQuantity = Number(maxQuantity);
    }

    if (description !== undefined) {
      appliance.description = String(description).trim();
    }

    if (isActive !== undefined) {
      appliance.isActive = Boolean(isActive);
    }

    appliance.updatedBy = req.user?._id || null;
    await appliance.save();

    // Log audit trail
    try {
      await AuditLog.create({
        userId: req.user?._id || null,
        userEmail: req.user?.email || "system",
        userRole: req.user?.role || "admin",
        action: "appliance.updated",
        targetId: appliance._id?.toString(),
        targetType: "Appliance",
        details: {
          name: appliance.name,
          code: appliance.code,
          monthlyFee: appliance.monthlyFee,
          isActive: appliance.isActive,
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to write appliance audit log: ${auditErr.message}`);
    }

    return res.json({
      success: true,
      message: "Appliance updated successfully.",
      data: appliance,
    });
  } catch (err) {
    logger.error(`Error updating appliance: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to update appliance.",
      code: "UPDATE_APPLIANCE_ERROR",
    });
  }
};

/**
 * DELETE /api/appliances/:id
 * Soft-deletes (archives) an appliance from the active catalog.
 */
export const deleteAppliance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid appliance ID.",
        code: "INVALID_APPLIANCE_ID",
      });
    }

    const appliance = await Appliance.findById(id);
    if (!appliance) {
      return res.status(404).json({
        success: false,
        error: "Appliance not found.",
        code: "APPLIANCE_NOT_FOUND",
      });
    }

    appliance.isActive = false;
    appliance.updatedBy = req.user?._id || null;
    await appliance.save();

    // Log audit trail
    try {
      await AuditLog.create({
        userId: req.user?._id || null,
        userEmail: req.user?.email || "system",
        userRole: req.user?.role || "admin",
        action: "appliance.archived",
        targetId: appliance._id?.toString(),
        targetType: "Appliance",
        details: {
          name: appliance.name,
          code: appliance.code,
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to write appliance audit log: ${auditErr.message}`);
    }

    return res.json({
      success: true,
      message: "Appliance archived successfully.",
      data: appliance,
    });
  } catch (err) {
    logger.error(`Error deleting appliance: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to delete appliance.",
      code: "DELETE_APPLIANCE_ERROR",
    });
  }
};
