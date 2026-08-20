/**
 * ============================================================================
 * TENANT VIOLATION CONTROLLER (Spec §23 & §22)
 * ============================================================================
 *
 * Handles house-rule violations, formal warning tracking, penalty fees,
 * ledger line-item attachments, and escalation to the Termination Review Board.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import dayjs from "dayjs";
import {
  TenantViolation,
  TerminationReview,
  Reservation,
  Bill,
  User,
  Room,
} from "../../models/index.js";
import { VIOLATION_TYPES } from "../../models/TenantViolation.js";
import { getAdminInfo, resolveAdminUserId, CURRENT_RESIDENT_STATUS_QUERY } from "./_helpers.js";
import logger from "../../middleware/logger.js";
import { logBillingAudit } from "../../utils/billingAudit.js";
import { createNotification } from "../../services/notifications/notificationService.js";

// Helper to format category for bill line-item label
const formatCategoryLabel = (type) => {
  if (!type) return "Rule Infraction";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * GET /api/billing/violations
 * List tenant violation records with filtering, search, and summary metrics.
 */
export const getViolations = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch =
      req.branchFilter ||
      (admin.isOwner && req.query.branch && req.query.branch !== "all"
        ? req.query.branch
        : null);

    if (!branch && !admin.isOwner) {
      return res.status(403).json({ success: false, error: "Access denied. Invalid branch filter." });
    }

    const { status, category, violationType, search, tenantId, reservationId } = req.query;

    const filter = { isArchived: false };
    if (branch) filter.branch = branch;
    if (tenantId) filter.tenantId = tenantId;
    if (reservationId) filter.reservationId = reservationId;
    if (status && status !== "all") filter.status = status;
    const cat = category || violationType;
    if (cat && cat !== "all") filter.violationType = cat;

    let tenantIdsFromSearch = null;
    if (search && search.trim()) {
      const q = search.trim();
      const matchingUsers = await User.find({
        $or: [
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      }).select("_id");
      tenantIdsFromSearch = matchingUsers.map((u) => u._id);

      filter.$or = [
        { tenantId: { $in: tenantIdsFromSearch } },
        { locationOfIncident: { $regex: q, $options: "i" } },
        { evidenceNotes: { $regex: q, $options: "i" } },
        { customViolationDescription: { $regex: q, $options: "i" } },
      ];
    }

    const violations = await TenantViolation.find(filter)
      .populate("tenantId", "firstName lastName email phone avatar profileImage photoURL")
      .populate({
        path: "reservationId",
        select: "roomId roomNumber branch moveInDate moveOutDate status",
        populate: { path: "roomId", select: "name roomNumber branch type" },
      })
      .populate("reportedBy", "firstName lastName email role")
      .populate("decidedBy", "firstName lastName email")
      .populate("resolvedBy", "firstName lastName email")
      .populate("escalatedToReviewId", "caseNumber status triggerType")
      .sort({ createdAt: -1 })
      .lean();

    // Compute summary KPI metrics for the branch
    const baseFilter = { isArchived: false, ...(branch ? { branch } : {}) };
    const allBranchViolations = await TenantViolation.find(baseFilter).select("status penaltyApplied").lean();

    const stats = {
      total: allBranchViolations.length,
      activeWarnings: allBranchViolations.filter((v) =>
        ["confirmed", "warning_issued"].includes(v.status),
      ).length,
      totalPenalties: allBranchViolations.reduce(
        (sum, v) => sum + (Number(v.penaltyApplied) || 0),
        0,
      ),
      escalatedCases: allBranchViolations.filter((v) => v.status === "escalated").length,
    };

    // Format for frontend response
    const formattedData = violations.map((v) => {
      const tenant = v.tenantId || {};
      const resv = v.reservationId || {};
      const room = resv.roomId || {};
      const tenantName = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "Tenant";
      const avatarUrl = tenant.profileImage || tenant.avatar || tenant.photoURL || "";

      return {
        ...v,
        tenantName,
        tenantEmail: tenant.email || "",
        tenantPhone: tenant.phone || "",
        tenantAvatar: avatarUrl,
        tenantProfileImage: avatarUrl,
        roomName: room.name || resv.roomNumber || "Unassigned",
        branch: v.branch,
        reportedByName: v.reportedBy ? `${v.reportedBy.firstName || ""} ${v.reportedBy.lastName || ""}`.trim() : "Staff Admin",
        decidedByName: v.decidedBy ? `${v.decidedBy.firstName || ""} ${v.decidedBy.lastName || ""}`.trim() : null,
      };
    });

    res.json({
      success: true,
      data: formattedData,
      stats,
    });
  } catch (error) {
    logger.error("[TenantViolation] getViolations error:", error);
    next(error);
  }
};

/**
 * GET /api/billing/violations/active-tenants
 * Returns active checked-in tenants in branch with room info and cumulative warning count.
 */
export const getActiveTenantsForViolations = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const effectiveBranch =
      req.branchFilter ||
      (admin.isOwner && req.query.branch && req.query.branch !== "all"
        ? req.query.branch
        : admin.isOwner
        ? null
        : admin.branch);

    const RESIDENT_STATUSES = [
      "moveIn",
      "reserved",
      "move_in_overdue",
      "checked-in",
      "checked_in",
      "active",
      "approved_for_payment",
      "payment_pending",
      ...CURRENT_RESIDENT_STATUS_QUERY,
    ];

    // Find rooms if branch is specified
    const roomFilter = { isArchived: false };
    if (effectiveBranch) roomFilter.branch = effectiveBranch;
    const rooms = await Room.find(roomFilter).select("_id branch name roomNumber type").lean();
    const roomIds = rooms.map((r) => r._id);

    const reservationFilter = {
      $or: [
        { roomId: { $in: roomIds } },
        ...(effectiveBranch ? [{ branch: effectiveBranch }] : []),
      ],
      status: { $in: RESIDENT_STATUSES },
      isArchived: { $ne: true },
    };

    const reservations = await Reservation.find(reservationFilter)
      .populate("userId", "firstName lastName email phone avatar profileImage photoURL role branch")
      .populate("roomId", "name roomNumber branch type")
      .sort({ moveInDate: -1, createdAt: -1 })
      .lean();

    // Also query all users with role "tenant" in branch/system as secondary fallback
    const userFilter = {
      role: "tenant",
      isArchived: { $ne: true },
      ...(effectiveBranch ? { branch: effectiveBranch } : {}),
    };
    const tenantUsers = await User.find(userFilter)
      .select("firstName lastName email phone avatar profileImage photoURL role branch")
      .lean();

    const seenTenantIds = new Set();
    const tenantList = [];

    // 1. Process active reservations
    for (const r of reservations) {
      const u = r.userId;
      if (!u || !u._id) continue;
      const tenantIdStr = u._id.toString();
      if (seenTenantIds.has(tenantIdStr)) continue;
      seenTenantIds.add(tenantIdStr);

      const room = r.roomId || {};
      const warningCount = await TenantViolation.computeWarningCount(u._id);
      const avatarUrl = u.profileImage || u.avatar || u.photoURL || "";

      tenantList.push({
        reservationId: r._id,
        tenantId: u._id,
        fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Tenant",
        email: u.email || "",
        phone: u.phone || "",
        profileImage: avatarUrl,
        avatar: avatarUrl,
        roomName: room.name || room.roomNumber || r.roomNumber || "Room",
        roomNumber: room.roomNumber || r.roomNumber || "",
        bedIdentifier: r.bedNumber || r.bedName || r.bedId || "",
        branch: r.branch || room.branch || u.branch || "gil-puyat",
        warningCount,
      });
    }

    // 2. Process any remaining tenant users without an active reservation document
    for (const u of tenantUsers) {
      const tenantIdStr = u._id.toString();
      if (seenTenantIds.has(tenantIdStr)) continue;
      seenTenantIds.add(tenantIdStr);

      const warningCount = await TenantViolation.computeWarningCount(u._id);
      const avatarUrl = u.profileImage || u.avatar || u.photoURL || "";

      tenantList.push({
        reservationId: null,
        tenantId: u._id,
        fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Tenant",
        email: u.email || "",
        phone: u.phone || "",
        profileImage: avatarUrl,
        avatar: avatarUrl,
        roomName: "Resident (No Room Assigned)",
        roomNumber: "",
        bedIdentifier: "",
        branch: u.branch || effectiveBranch || "gil-puyat",
        warningCount,
      });
    }

    res.json({
      success: true,
      data: tenantList,
    });
  } catch (error) {
    logger.error("[TenantViolation] getActiveTenantsForViolations error:", error);
    next(error);
  }
};

/**
 * GET /api/billing/violations/:id
 * Retrieve a single violation record with full audit and evidence detail.
 */
export const getViolationById = async (req, res, next) => {
  try {
    const violation = await TenantViolation.findById(req.params.id)
      .populate("tenantId", "firstName lastName email phone avatar profileImage")
      .populate({
        path: "reservationId",
        select: "roomId roomNumber branch moveInDate moveOutDate status",
        populate: { path: "roomId", select: "name roomNumber branch type" },
      })
      .populate("reportedBy", "firstName lastName email role")
      .populate("decidedBy", "firstName lastName email")
      .populate("resolvedBy", "firstName lastName email")
      .populate("escalatedToReviewId")
      .lean();

    if (!violation) {
      return res.status(404).json({ success: false, error: "Tenant violation record not found." });
    }

    const tenant = violation.tenantId || {};
    const resv = violation.reservationId || {};
    const room = resv.roomId || {};

    const formatted = {
      ...violation,
      tenantName: `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "Tenant",
      tenantEmail: tenant.email || "",
      tenantPhone: tenant.phone || "",
      roomName: room.name || resv.roomNumber || "Unassigned",
    };

    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error("[TenantViolation] getViolationById error:", error);
    next(error);
  }
};

/**
 * POST /api/billing/violations
 * Record a new rule infraction with validation, warning count calculation, and optional billing sync.
 */
export const createViolation = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const adminUserId = await resolveAdminUserId(req, admin);

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        error: "Authenticated user record not found in system.",
      });
    }

    const {
      tenantId,
      reservationId: providedReservationId,
      violationType,
      customViolationDescription,
      dateOfIncident,
      timeOfIncident,
      locationOfIncident,
      evidenceUrls,
      evidenceUrl,
      evidenceNotes,
      description,
      penaltyApplied,
      penaltyAmount,
      penaltyReason,
      chargeToBill,
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: "Tenant ID is required." });
    }

    if (!violationType || !VIOLATION_TYPES.includes(violationType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid violation type. Must be one of: ${VIOLATION_TYPES.join(", ")}`,
      });
    }

    if (violationType === "custom" && (!customViolationDescription || !customViolationDescription.trim())) {
      return res.status(400).json({
        success: false,
        error: "A description is required when category is set to Custom Infraction.",
      });
    }

    if (!dateOfIncident) {
      return res.status(400).json({ success: false, error: "Date of incident is required." });
    }

    const incidentDate = new Date(dateOfIncident);
    if (Number.isNaN(incidentDate.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid incident date format." });
    }

    if (dayjs(incidentDate).isAfter(dayjs().endOf("day"))) {
      return res.status(400).json({ success: false, error: "Incident date cannot be in the future." });
    }

    const penaltyNum = Number(penaltyApplied !== undefined ? penaltyApplied : penaltyAmount) || 0;
    if (penaltyNum < 0 || penaltyNum > 100000) {
      return res.status(400).json({
        success: false,
        error: "Penalty fee must be a valid amount between ₱0.00 and ₱100,000.00.",
      });
    }

    if (penaltyNum > 0 && (!penaltyReason || !penaltyReason.trim())) {
      return res.status(400).json({
        success: false,
        error: "A penalty reason is required when a monetary penalty is applied.",
      });
    }

    // Resolve reservation and branch
    let reservation = null;
    if (providedReservationId) {
      reservation = await Reservation.findById(providedReservationId).populate("roomId").lean();
    }
    if (!reservation) {
      reservation = await Reservation.findOne({
        userId: tenantId,
        isArchived: { $ne: true },
      })
        .sort({ moveInDate: -1, createdAt: -1 })
        .populate("roomId")
        .lean();
    }

    const tenantUser = await User.findById(tenantId).lean();
    if (!tenantUser && !reservation) {
      return res.status(404).json({
        success: false,
        error: "Resident user record not found.",
      });
    }

    const branch =
      req.branchFilter ||
      reservation?.branch ||
      reservation?.roomId?.branch ||
      tenantUser?.branch ||
      admin.branch ||
      "gil-puyat";

    // Compute cumulative warnings
    const priorCount = await TenantViolation.computeWarningCount(tenantId);
    const nextWarningNumber = priorCount + 1;

    // Normalize evidence URLs
    let normalizedUrls = [];
    if (Array.isArray(evidenceUrls)) {
      normalizedUrls = evidenceUrls.filter((u) => typeof u === "string" && u.trim());
    } else if (evidenceUrl && typeof evidenceUrl === "string" && evidenceUrl.trim()) {
      normalizedUrls = [evidenceUrl.trim()];
    }

    const notes = (evidenceNotes || description || "").trim();

    // Create the violation record
    const violation = new TenantViolation({
      reservationId: reservation?._id || null,
      tenantId,
      branch,
      violationType,
      customViolationDescription: violationType === "custom" ? customViolationDescription.trim() : null,
      dateOfIncident: incidentDate,
      timeOfIncident: timeOfIncident ? String(timeOfIncident).trim() : null,
      locationOfIncident: locationOfIncident ? String(locationOfIncident).trim() : "",
      status: "reported",
      evidenceUrls: normalizedUrls,
      evidenceNotes: notes,
      warningNumber: nextWarningNumber,
      penaltyApplied: penaltyNum > 0 ? penaltyNum : null,
      penaltyReason: penaltyNum > 0 ? penaltyReason.trim() : null,
      reportedBy: adminUserId,
    });

    await violation.save();

    // If penalty is applied, automatically append to resident's active/open rent bill with dedicated line item
    let attachedBillId = null;
    if (chargeToBill !== false && penaltyNum > 0 && reservation?._id) {
      try {
        const openBill = await Bill.findOne({
          reservationId: reservation._id,
          userId: tenantId,
          status: { $in: ["draft", "pending", "overdue"] },
          isArchived: { $ne: true },
        }).sort({ billingMonth: -1 });

        if (openBill) {
          const categoryLabel = formatCategoryLabel(violationType);
          const lineItemLabel = `Violation Penalty: ${categoryLabel} (${violation._id.toString().slice(-6)})`;

          openBill.additionalCharges = openBill.additionalCharges || [];
          openBill.additionalCharges.push({
            name: lineItemLabel,
            amount: penaltyNum,
          });

          openBill.charges = openBill.charges || {};
          openBill.charges.penalty = (Number(openBill.charges.penalty) || 0) + penaltyNum;
          openBill.totalAmount = (Number(openBill.totalAmount) || 0) + penaltyNum;
          openBill.remainingAmount = (Number(openBill.remainingAmount) || 0) + penaltyNum;

          await openBill.save();
          attachedBillId = openBill._id;

          logger.info(
            `[TenantViolation] Attached penalty ₱${penaltyNum} to Bill ${openBill._id} for tenant ${tenantId}`,
          );
        }
      } catch (billError) {
        logger.error("[TenantViolation] Failed to auto-attach penalty to bill:", billError);
      }
    }

    await logBillingAudit({
      action: "LOG_TENANT_VIOLATION",
      actorId: adminUserId,
      targetUserId: tenantId,
      branch,
      details: {
        violationId: violation._id,
        violationType,
        warningNumber: nextWarningNumber,
        penaltyApplied: penaltyNum,
        attachedBillId,
      },
    });

    // Dispatch in-app notification to tenant
    try {
      const categoryLabel = formatCategoryLabel(violationType);
      const penaltyText = penaltyNum > 0 ? ` with an assessed penalty fee of ₱${penaltyNum.toFixed(2)}` : "";
      await createNotification(
        tenantId,
        "tenant_violation",
        `House Rule Warning (#${nextWarningNumber})`,
        `A dormitory rule infraction (${categoryLabel}) was recorded on your account${penaltyText}. Please review your account policies.`,
        { entityType: "violation", entityId: violation._id }
      );
    } catch (notifErr) {
      logger.warn("[TenantViolation] Failed to dispatch tenant in-app notification:", notifErr);
    }

    res.status(201).json({
      success: true,
      message: "Violation record logged successfully.",
      data: violation,
      attachedBillId,
    });
  } catch (error) {
    logger.error("[TenantViolation] createViolation error:", error);
    next(error);
  }
};

/**
 * PATCH /api/billing/violations/:id/decision
 * Admin adjudication: Confirm or dismiss violation, issue warning/penalty, or escalate.
 */
export const updateViolationDecision = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const adminUserId = await resolveAdminUserId(req, admin);
    const { id } = req.params;
    const {
      decision,
      decisionReason,
      status: targetStatus,
      penaltyApplied,
      penaltyReason,
      resolution,
      chargeToBill,
    } = req.body;

    if (!["confirmed", "dismissed"].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Decision must be either 'confirmed' or 'dismissed'.",
      });
    }

    if (!decisionReason || !decisionReason.trim()) {
      return res.status(400).json({
        success: false,
        error: "A formal reason is required for the admin decision.",
      });
    }

    const violation = await TenantViolation.findById(id);
    if (!violation) {
      return res.status(404).json({ success: false, error: "Violation record not found." });
    }

    // Branch guard
    if (req.branchFilter && violation.branch !== req.branchFilter) {
      return res.status(403).json({ success: false, error: "Unauthorized for this branch." });
    }

    violation.adminDecision = decision;
    violation.adminDecisionReason = decisionReason.trim();
    violation.decidedBy = adminUserId;
    violation.decidedAt = new Date();

    if (decision === "dismissed") {
      violation.status = "dismissed";
      violation.resolution = resolution ? resolution.trim() : "Infraction dismissed upon administrative review.";
      violation.resolvedBy = adminUserId;
      violation.resolvedAt = new Date();
    } else {
      // Confirmed
      if (targetStatus && ["warning_issued", "penalty_issued", "resolved", "escalated"].includes(targetStatus)) {
        violation.status = targetStatus;
      } else {
        violation.status = "confirmed";
      }

      if (penaltyApplied !== undefined && Number(penaltyApplied) > 0) {
        violation.penaltyApplied = Number(penaltyApplied);
        violation.penaltyReason = (penaltyReason || decisionReason).trim();
        violation.penaltyApprovedBy = adminUserId;
      }

      if (resolution && resolution.trim()) {
        violation.resolution = resolution.trim();
        violation.resolvedBy = adminUserId;
        violation.resolvedAt = new Date();
      }

      // If escalating to Termination Review Board
      if (violation.status === "escalated" && !violation.escalatedToReviewId) {
        const review = new TerminationReview({
          reservationId: violation.reservationId,
          tenantId: violation.tenantId,
          branch: violation.branch,
          triggerType: "violation_escalation",
          triggeredByViolationId: violation._id,
          triggerReason: `Violation Escalation: ${violation.violationType} — ${decisionReason.trim()}`,
          openedBy: adminUserId,
          openedAt: new Date(),
          status: "open",
        });

        await review.save();
        violation.escalatedToReviewId = review._id;
        violation.escalatedAt = new Date();

        logger.info(
          `[TenantViolation] Escalated violation ${violation._id} to TerminationReview ${review._id}`,
        );
      }

      // Handle optional bill line-item attachment
      if (chargeToBill && violation.penaltyApplied > 0 && violation.reservationId) {
        const openBill = await Bill.findOne({
          reservationId: violation.reservationId,
          userId: violation.tenantId,
          status: { $in: ["draft", "pending", "overdue"] },
          isArchived: { $ne: true },
        }).sort({ billingMonth: -1 });

        if (openBill) {
          const categoryLabel = formatCategoryLabel(violation.violationType);
          const lineItemLabel = `Violation Penalty: ${categoryLabel} (${violation._id.toString().slice(-6)})`;

          openBill.additionalCharges = openBill.additionalCharges || [];
          openBill.additionalCharges.push({
            name: lineItemLabel,
            amount: violation.penaltyApplied,
          });

          openBill.charges = openBill.charges || {};
          openBill.charges.penalty = (Number(openBill.charges.penalty) || 0) + violation.penaltyApplied;
          openBill.totalAmount = (Number(openBill.totalAmount) || 0) + violation.penaltyApplied;
          openBill.remainingAmount = (Number(openBill.remainingAmount) || 0) + violation.penaltyApplied;

          await openBill.save();
        }
      }
    }

    await violation.save();

    await logBillingAudit({
      action: "UPDATE_VIOLATION_DECISION",
      actorId: adminUserId,
      targetUserId: violation.tenantId,
      branch: violation.branch,
      details: {
        violationId: violation._id,
        decision,
        status: violation.status,
        escalatedToReviewId: violation.escalatedToReviewId,
      },
    });

    // Dispatch decision notification to tenant
    try {
      if (violation.tenantId) {
        const categoryLabel = formatCategoryLabel(violation.violationType);
        const isDismissed = decision === "dismissed";
        await createNotification(
          violation.tenantId,
          "tenant_violation",
          `Rule Infraction Status: ${isDismissed ? "Infraction Dismissed" : "Warning Confirmed"}`,
          isDismissed
            ? `Your recorded infraction for ${categoryLabel} has been dismissed upon administrative review.`
            : `Administrative review has confirmed the infraction for ${categoryLabel}. ${decisionReason.trim()}`,
          { entityType: "violation", entityId: violation._id }
        );
      }
    } catch (notifErr) {
      logger.warn("[TenantViolation] Failed to dispatch decision notification:", notifErr);
    }

    res.json({
      success: true,
      message: "Violation decision updated successfully.",
      data: violation,
    });
  } catch (error) {
    logger.error("[TenantViolation] updateViolationDecision error:", error);
    next(error);
  }
};

/**
 * GET /api/billing/termination-reviews
 * Retrieve administrative termination review cases for the review board.
 */
export const getTerminationCases = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch =
      req.branchFilter ||
      (admin.isOwner && req.query.branch && req.query.branch !== "all"
        ? req.query.branch
        : null);

    const filter = { isArchived: false };
    if (branch) filter.branch = branch;

    const cases = await TerminationReview.find(filter)
      .populate("tenantId", "firstName lastName email phone")
      .populate("reservationId", "roomNumber branch moveInDate moveOutDate")
      .populate("openedBy", "firstName lastName email")
      .populate("triggeredByViolationId", "violationType penaltyApplied createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = cases.map((c) => {
      const tenant = c.tenantId || {};
      return {
        ...c,
        tenantName: `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "Tenant",
        tenantEmail: tenant.email || "",
        caseNumber: c._id.toString().slice(-6).toUpperCase(),
        reason: c.triggerReason || (c.triggerType === "violation_escalation" ? "Rule Infraction Escalation" : "Notice 3 Exhaustion"),
        balanceSnapshot: c.totalOutstandingAtOpen || 0,
        outcome: c.decision?.outcome || c.status,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error("[TenantViolation] getTerminationCases error:", error);
    next(error);
  }
};

/**
 * POST /api/billing/termination-reviews
 * Open a manual termination review case.
 */
export const createTerminationCase = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const adminUserId = await resolveAdminUserId(req, admin);
    const { tenantId, reservationId, branch, triggerReason } = req.body;

    if (!tenantId || !reservationId || !branch) {
      return res.status(400).json({
        success: false,
        error: "tenantId, reservationId, and branch are required.",
      });
    }

    if (!triggerReason || !triggerReason.trim()) {
      return res.status(400).json({
        success: false,
        error: "A reason is required when manually opening a review case.",
      });
    }

    const review = new TerminationReview({
      tenantId,
      reservationId,
      branch,
      triggerType: "manual",
      triggerReason: triggerReason.trim(),
      openedBy: adminUserId,
      openedAt: new Date(),
      status: "open",
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: "Termination review case opened successfully.",
      data: review,
    });
  } catch (error) {
    logger.error("[TenantViolation] createTerminationCase error:", error);
    next(error);
  }
};
