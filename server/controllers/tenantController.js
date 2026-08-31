/**
 * ============================================================================
 * TENANT MANAGEMENT CONTROLLER
 * ============================================================================
 *
 * Controller handling administrative tenant management actions.
 * Specifically manages tenant declared appliance add-ons, fees, and audit trails.
 */

import { Reservation, User, AuditLog, Appliance } from "../models/index.js";
import logger from "../middleware/logger.js";
import { isValidObjectId } from "../utils/reservationHelpers.js";
import { TRUSTED_RESERVATION_APPLIANCE_MAP } from "./reservations/_helpers.js";

/**
 * Update declared appliance add-ons for a tenant at Guadalupe branch.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const updateTenantAppliances = async (req, res) => {
  try {
    const tenantId = req.params.id || req.params.tenantId;
    if (!tenantId || !isValidObjectId(tenantId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid tenant ID.",
        code: "INVALID_TENANT_ID",
      });
    }

    const tenant = await User.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: "Tenant not found.",
        code: "TENANT_NOT_FOUND",
      });
    }

    // Find the tenant's active Reservation
    const activeStatuses = [
      "active",
      "checked_in",
      "confirmed",
      "move_in_ready",
      "moveIn",
      "reserved",
    ];

    const reservation = await Reservation.findOne({
      userId: tenant._id,
      isArchived: { $ne: true },
      status: { $in: activeStatuses },
    })
      .populate("roomId", "name roomNumber branch price monthlyPrice")
      .sort({ createdAt: -1 });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "No active reservation found for this tenant.",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    const branch = String(
      reservation.roomId?.branch || reservation.branch || "",
    ).toLowerCase();

    if (branch !== "guadalupe") {
      return res.status(400).json({
        success: false,
        error: "Appliance fee tracking is only enabled for Guadalupe.",
        code: "APPLIANCE_FEES_DISABLED_FOR_BRANCH",
      });
    }

    const { selectedAppliances } = req.body;
    if (!Array.isArray(selectedAppliances)) {
      return res.status(400).json({
        success: false,
        error: "selectedAppliances must be an array.",
        code: "INVALID_SELECTED_APPLIANCES",
      });
    }

    let catalogMap = new Map();
    try {
      if (Appliance && typeof Appliance.find === "function") {
        const dbAppliances = await Appliance.find({}).lean();
        if (Array.isArray(dbAppliances)) {
          for (const app of dbAppliances) {
            catalogMap.set(String(app.code || "").toLowerCase(), app);
          }
        }
      }
    } catch (err) {
      logger.warn(`Could not load Appliance catalog in tenant appliance update: ${err.message}`);
    }

    let calculatedFees = 0;
    const sanitizedAppliances = [];

    for (const item of selectedAppliances) {
      if (!item || typeof item !== "object") {
        return res.status(400).json({
          success: false,
          error: "Each selected appliance must be an object.",
          code: "INVALID_APPLIANCE_ITEM",
        });
      }

      const rawId = String(item.id || item.applianceId || "").trim().toLowerCase();
      if (!rawId) {
        return res.status(400).json({
          success: false,
          error: "Appliance ID is required for each appliance entry.",
          code: "INVALID_APPLIANCE_ID",
        });
      }

      const rawQty = item.quantity;
      if (
        rawQty === undefined ||
        rawQty === null ||
        !Number.isInteger(Number(rawQty)) ||
        Number(rawQty) < 0
      ) {
        return res.status(400).json({
          success: false,
          error: `Invalid quantity for appliance '${rawId}'. Quantity must be a non-negative integer.`,
          code: "INVALID_APPLIANCE_QUANTITY",
        });
      }

      const catalogItem = catalogMap.get(rawId);
      const fallbackFee = TRUSTED_RESERVATION_APPLIANCE_MAP?.get?.(rawId)?.monthlyFee;
      const quantity = Number(rawQty);
      const unitPrice = Number(
        catalogItem?.monthlyFee ?? fallbackFee ?? item.price ?? item.unitPrice ?? 200,
      );
      calculatedFees += quantity * unitPrice;

      const applianceName =
        item.name && String(item.name).trim()
          ? String(item.name).trim()
          : (catalogItem?.name || TRUSTED_RESERVATION_APPLIANCE_MAP?.get?.(rawId)?.name || rawId);

      sanitizedAppliances.push({
        id: rawId,
        name: applianceName,
        quantity,
      });
    }

    reservation.selectedAppliances = sanitizedAppliances;
    reservation.applianceFees = calculatedFees;
    if (reservation.monthlyRent != null) {
      reservation.totalPrice = Number(reservation.monthlyRent) + calculatedFees;
    }

    await reservation.save();

    // Record AuditLog event
    try {
      await AuditLog.log({
        type: "data_modification",
        action: "tenant.appliances_updated",
        severity: "info",
        user: req.user?.email || "admin",
        userId: req.user?._id || req.user?.mongoId || null,
        userRole: req.user?.role || "branch_admin",
        branch,
        entityType: "reservation",
        entityId: String(reservation._id),
        details: `Updated declared appliances for tenant ${tenant._id}: ${sanitizedAppliances.length} items, total appliance fees ₱${calculatedFees}`,
        metadata: {
          tenantId: String(tenant._id),
          reservationId: String(reservation._id),
          selectedAppliances: sanitizedAppliances,
          applianceFees: calculatedFees,
        },
      });
    } catch (auditError) {
      logger.warn(
        { err: auditError, reservationId: reservation._id },
        "[TenantController] Audit logging failed (non-fatal)",
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        selectedAppliances: reservation.selectedAppliances,
        applianceFees: reservation.applianceFees,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Update tenant appliances error",
    );
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update tenant appliances.",
      code: "UPDATE_TENANT_APPLIANCES_ERROR",
    });
  }
};
