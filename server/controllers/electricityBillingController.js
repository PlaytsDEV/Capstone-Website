/**
 * ============================================================================
 * ELECTRICITY BILLING CONTROLLER
 * ============================================================================
 *
 * Handles all segment-based electricity billing operations.
 * Separate from billingController.js to avoid breaking existing payment flows.
 *
 * MIDDLEWARE CHAIN: verifyToken → verifyAdmin → filterByBranch → handler
 * (Tenant endpoints only need verifyToken)
 *
 * ============================================================================
 */

import dayjs from "dayjs";
import {
  Bill,
  MeterReading,
  BillingPeriod,
  BillingResult,
  Room,
  Reservation,
  User,
} from "../models/index.js";
import { computeBilling, truncate4 } from "../utils/billingEngine.js";
import logger from "../middleware/logger.js";
import { sendBillGeneratedEmail } from "../config/email.js";

/* ─── shared helpers ─────────────────────────────── */

/** Get admin's role and branch from MongoDB */
async function getAdminInfo(req) {
  const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
  return {
    role: dbUser?.role || "user",
    branch: dbUser?.branch || null,
    isSuperAdmin: dbUser?.role === "owner",
    _id: dbUser?._id || null,
  };
}

/** Round to 2 decimal places for final bill amounts */
const r2 = (n) => Math.round(n * 100) / 100;

// ============================================================================
// METER READING ENDPOINTS
// ============================================================================

/**
 * POST /api/electricity/readings
 * Record a new submeter reading for a room.
 */
export const recordMeterReading = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { roomId, reading, date, eventType, tenantId } = req.body;

    // Validate required fields
    if (!roomId) return res.status(400).json({ error: "Room ID is required" });
    if (reading === undefined || reading === null)
      return res.status(400).json({ error: "Meter reading value is required" });
    if (!date) return res.status(400).json({ error: "Date is required" });
    if (!eventType)
      return res.status(400).json({ error: "Event type is required" });
    if (
      (eventType === "move-in" || eventType === "move-out") &&
      !tenantId
    ) {
      return res
        .status(400)
        .json({ error: "Tenant ID is required for move-in/move-out events" });
    }

    // Verify room exists and admin has access
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!admin.isSuperAdmin && room.branch !== admin.branch) {
      return res.status(403).json({ error: "Cannot access rooms from another branch" });
    }

    // FR-MR-03: Reading must be >= the most recent reading for the same room
    const lastReading = await MeterReading.findOne({
      roomId: room._id,
      isArchived: false,
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    if (lastReading && reading < lastReading.reading) {
      return res.status(400).json({
        error: `Reading cannot be lower than last recorded value (${lastReading.reading}). Meter readings must be non-decreasing.`,
      });
    }

    // Build activeTenantIds snapshot: all checked-in tenants currently in room
    const checkedInReservations = await Reservation.find({
      roomId: room._id,
      status: "checked-in",
      isArchived: { $ne: true },
    })
      .select("userId")
      .lean();
    const activeTenantIds = checkedInReservations
      .map((r) => r.userId)
      .filter(Boolean);

    // Find the open billing period for this room (if any)
    const openPeriod = await BillingPeriod.findOne({
      roomId: room._id,
      status: "open",
      isArchived: false,
    }).lean();

    const meterReading = new MeterReading({
      roomId: room._id,
      branch: room.branch,
      reading: Number(reading),
      date: new Date(date),
      eventType,
      tenantId: tenantId || null,
      activeTenantIds,
      recordedBy: admin._id,
      billingPeriodId: openPeriod?._id || null,
    });
    await meterReading.save();

    res.status(201).json({
      success: true,
      meterReading: {
        id: meterReading._id,
        roomId: meterReading.roomId,
        reading: meterReading.reading,
        date: meterReading.date,
        eventType: meterReading.eventType,
        tenantId: meterReading.tenantId,
        activeTenantCount: activeTenantIds.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/electricity/readings/:roomId
 * Get all meter readings for a room. Optional ?periodId filter.
 */
export const getMeterReadings = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { roomId } = req.params;
    const { periodId } = req.query;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!admin.isSuperAdmin && room.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    const filter = { roomId: room._id, isArchived: false };
    if (periodId) filter.billingPeriodId = periodId;

    const readings = await MeterReading.find(filter)
      .populate("tenantId", "firstName lastName")
      .populate("recordedBy", "firstName lastName")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    res.json({
      readings: readings.map((r) => ({
        id: r._id,
        reading: r.reading,
        date: r.date,
        eventType: r.eventType,
        tenant: r.tenantId
          ? `${r.tenantId.firstName || ""} ${r.tenantId.lastName || ""}`.trim()
          : null,
        tenantId: r.tenantId?._id || null,
        activeTenantCount: r.activeTenantIds?.length || 0,
        recordedBy: r.recordedBy
          ? `${r.recordedBy.firstName || ""} ${r.recordedBy.lastName || ""}`.trim()
          : "System",
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/electricity/readings/:roomId/latest
 * Get the most recent meter reading for a room.
 */
export const getLatestReading = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!admin.isSuperAdmin && room.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    const reading = await MeterReading.findOne({
      roomId: room._id,
      isArchived: false,
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    if (!reading) {
      return res
        .status(404)
        .json({ error: "No meter readings found for this room" });
    }

    res.json({
      reading: reading.reading,
      date: reading.date,
      eventType: reading.eventType,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// BILLING PERIOD ENDPOINTS
// ============================================================================

/**
 * POST /api/electricity/periods
 * Open a new billing period for a room.
 */
export const openBillingPeriod = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { roomId, startDate, startReading, ratePerKwh } = req.body;

    if (!roomId) return res.status(400).json({ error: "Room ID is required" });
    if (!startDate)
      return res.status(400).json({ error: "Start date is required" });
    if (startReading === undefined)
      return res.status(400).json({ error: "Start reading is required" });
    if (!ratePerKwh || ratePerKwh <= 0)
      return res
        .status(400)
        .json({ error: "Rate per kWh is required and must be positive" });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!admin.isSuperAdmin && room.branch !== admin.branch) {
      return res.status(403).json({ error: "Cannot access rooms from another branch" });
    }

    // Check for existing open period
    const existingOpen = await BillingPeriod.findOne({
      roomId: room._id,
      status: "open",
      isArchived: false,
    });
    if (existingOpen) {
      return res.status(409).json({
        error:
          "This room already has an open billing period. Close it before opening a new one.",
      });
    }

    // Also record the start reading as a meter reading entry
    const meterReading = new MeterReading({
      roomId: room._id,
      branch: room.branch,
      reading: Number(startReading),
      date: new Date(startDate),
      eventType: "regular-billing",
      recordedBy: admin._id,
      activeTenantIds: [],
    });
    await meterReading.save();

    const period = new BillingPeriod({
      roomId: room._id,
      branch: room.branch,
      startDate: new Date(startDate),
      startReading: Number(startReading),
      ratePerKwh: Number(ratePerKwh),
      status: "open",
    });
    await period.save();

    // Link the start reading to the new period
    meterReading.billingPeriodId = period._id;
    await meterReading.save();

    res.status(201).json({
      success: true,
      period: {
        id: period._id,
        roomId: period.roomId,
        startDate: period.startDate,
        startReading: period.startReading,
        ratePerKwh: period.ratePerKwh,
        status: period.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/electricity/periods/:id/close
 * Close a billing period and trigger computation.
 */
export const closeBillingPeriod = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;
    const { endReading, endDate } = req.body;

    if (endReading === undefined)
      return res.status(400).json({ error: "End reading is required" });

    const period = await BillingPeriod.findById(id);
    if (!period) return res.status(404).json({ error: "Billing period not found" });
    if (!admin.isSuperAdmin && period.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (period.status !== "open") {
      return res
        .status(400)
        .json({ error: "Only open periods can be closed" });
    }
    if (Number(endReading) < period.startReading) {
      return res.status(400).json({
        error: `End reading (${endReading}) cannot be lower than start reading (${period.startReading}).`,
      });
    }

    const room = await Room.findById(period.roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const closingDate = endDate ? new Date(endDate) : new Date();

    // Record end-of-period meter reading
    const endMeterReading = new MeterReading({
      roomId: room._id,
      branch: room.branch,
      reading: Number(endReading),
      date: closingDate,
      eventType: "regular-billing",
      recordedBy: admin._id,
      billingPeriodId: period._id,
      activeTenantIds: [],
    });
    await endMeterReading.save();

    // Fetch all readings for this room within the period's date range
    const allReadings = await MeterReading.find({
      roomId: room._id,
      isArchived: false,
      date: { $gte: period.startDate, $lte: closingDate },
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // Build tenant events from reservations
    const tenantEvents = await buildTenantEventsFromReadings(
      room._id,
      allReadings,
      period.startReading,
    );

    // Run the billing engine
    const computationResult = computeBilling({
      meterReadings: allReadings.map((r) => ({
        date: r.date,
        reading: r.reading,
        eventType: r.eventType,
      })),
      tenantEvents,
      ratePerKwh: period.ratePerKwh,
      startReading: period.startReading,
      endReading: Number(endReading),
    });

    // Save BillingResult
    const billingResult = new BillingResult({
      billingPeriodId: period._id,
      roomId: room._id,
      branch: room.branch,
      computedBy: admin._id,
      ratePerKwh: period.ratePerKwh,
      totalRoomKwh: computationResult.totalRoomKwh,
      totalRoomCost: computationResult.totalRoomCost,
      verified: computationResult.verified,
      segments: computationResult.segments,
      tenantSummaries: computationResult.tenantSummaries,
    });
    await billingResult.save();

    // Generate individual Bill documents for each tenant as DRAFT
    // Bills remain hidden from tenants until admin clicks "Send Bills"
    for (const summary of computationResult.tenantSummaries) {
      const existingBill = await Bill.findOne({
        userId: summary.tenantId,
        billingMonth: period.startDate,
        isArchived: false,
      });
      if (existingBill) continue; // Skip duplicates

      const bill = new Bill({
        userId: summary.tenantId,
        branch: room.branch,
        roomId: room._id,
        billingMonth: period.startDate,
        dueDate: null,          // Set at send time
        charges: {
          electricity: r2(summary.billAmount),
          rent: 0,
          water: 0,
          applianceFees: 0,
          corkageFees: 0,
          penalty: 0,
          discount: 0,
        },
        totalAmount: r2(summary.billAmount),
        status: "draft",        // Hidden from tenants until sent
      });
      await bill.save();

      // Update the billingResult with the billId
      const ts = billingResult.tenantSummaries.find(
        (t) => String(t.tenantId) === String(summary.tenantId),
      );
      if (ts) ts.billId = bill._id;
    }
    await billingResult.save();

    // Update period status
    period.endDate = closingDate;
    period.endReading = Number(endReading);
    period.status = "closed";
    period.closedAt = new Date();
    period.closedBy = admin._id;
    await period.save();

    // ── Auto-chain: open the next billing period (continuous cycle) ────────
    // The next period starts from where this one ended, same rate, same room.
    // This means admin never needs to manually "Open Period" again.
    try {
      const alreadyOpen = await BillingPeriod.findOne({
        roomId: room._id,
        status: "open",
        isArchived: false,
      });
      if (!alreadyOpen) {
        const nextPeriod = new BillingPeriod({
          roomId: room._id,
          branch: room.branch,
          startDate: closingDate,
          startReading: Number(endReading),
          ratePerKwh: period.ratePerKwh,
          status: "open",
          createdBy: admin._id,
        });
        await nextPeriod.save();
        logger.info({ roomId: room._id, nextPeriodId: nextPeriod._id }, "Auto-opened next billing period");
      }
    } catch (chainErr) {
      // Non-fatal — existing period is already closed, admin can open manually
      logger.warn({ err: chainErr }, "Auto-chain billing period failed (non-fatal)");
    }

    // Email notifications are now sent via sendBills endpoint
    // (admin reviews draft bills first, then manually triggers send)

    res.json({
      success: true,
      result: {
        id: billingResult._id,
        totalRoomKwh: computationResult.totalRoomKwh,
        totalRoomCost: computationResult.totalRoomCost,
        verified: computationResult.verified,
        segmentCount: computationResult.segments.length,
        tenantCount: computationResult.tenantSummaries.length,
        tenantSummaries: computationResult.tenantSummaries.map((t) => ({
          tenantName: t.tenantName,
          totalKwh: t.totalKwh,
          billAmount: t.billAmount,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/electricity/periods/:roomId
 * List all billing periods for a room.
 */
export const getBillingPeriods = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!admin.isSuperAdmin && room.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    const periods = await BillingPeriod.find({
      roomId: room._id,
      isArchived: false,
    })
      .sort({ startDate: -1 })
      .lean();

    res.json({
      periods: periods.map((p) => ({
        id: p._id,
        startDate: p.startDate,
        endDate: p.endDate,
        startReading: p.startReading,
        endReading: p.endReading,
        ratePerKwh: p.ratePerKwh,
        status: p.status,
        revised: p.revised,
        closedAt: p.closedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// BILLING RESULT ENDPOINTS
// ============================================================================

/**
 * GET /api/electricity/results/:periodId
 * Get full billing result for a period (segments + tenant summaries).
 */
export const getBillingResult = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { periodId } = req.params;

    const result = await BillingResult.findOne({
      billingPeriodId: periodId,
      isArchived: false,
    }).lean();

    if (!result) {
      return res
        .status(404)
        .json({ error: "No billing result found for this period" });
    }
    if (!admin.isSuperAdmin && result.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/electricity/results/:periodId/revise
 * Re-run computation on a closed period. Overwrites the result.
 */
export const reviseBillingResult = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { periodId } = req.params;
    const { revisionNote } = req.body;

    const period = await BillingPeriod.findById(periodId);
    if (!period) return res.status(404).json({ error: "Billing period not found" });
    if (!admin.isSuperAdmin && period.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (period.status === "open") {
      return res.status(400).json({ error: "Cannot revise an open period" });
    }

    const room = await Room.findById(period.roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Re-fetch readings and re-compute
    const allReadings = await MeterReading.find({
      roomId: room._id,
      isArchived: false,
      date: { $gte: period.startDate, $lte: period.endDate },
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const tenantEvents = await buildTenantEventsFromReadings(
      room._id,
      allReadings,
      period.startReading,
    );

    const computationResult = computeBilling({
      meterReadings: allReadings.map((r) => ({
        date: r.date,
        reading: r.reading,
        eventType: r.eventType,
      })),
      tenantEvents,
      ratePerKwh: period.ratePerKwh,
      startReading: period.startReading,
      endReading: period.endReading,
    });

    // Overwrite existing result
    await BillingResult.findOneAndUpdate(
      { billingPeriodId: period._id },
      {
        computedAt: new Date(),
        computedBy: admin._id,
        totalRoomKwh: computationResult.totalRoomKwh,
        totalRoomCost: computationResult.totalRoomCost,
        verified: computationResult.verified,
        segments: computationResult.segments,
        tenantSummaries: computationResult.tenantSummaries,
        revised: true,
        revisionNote: revisionNote || null,
        revisedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Update period
    period.revised = true;
    period.revisionNote = revisionNote || null;
    period.revisedAt = new Date();
    period.status = "revised";
    await period.save();

    res.json({
      success: true,
      message: "Billing result revised successfully",
      verified: computationResult.verified,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// TENANT ENDPOINTS
// ============================================================================

/**
 * GET /api/electricity/my-bills
 * Tenant views their electricity bill summaries.
 */
export const getMyElectricityBills = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const results = await BillingResult.find({
      "tenantSummaries.tenantId": dbUser._id,
      isArchived: false,
    })
      .populate("roomId", "name branch type")
      .sort({ computedAt: -1 })
      .lean();

    const bills = results.map((r) => {
      const mySummary = r.tenantSummaries.find(
        (t) => String(t.tenantId) === String(dbUser._id),
      );
      return {
        billingResultId: r._id,
        billingPeriodId: r.billingPeriodId,
        room: r.roomId?.name || "N/A",
        branch: r.branch,
        ratePerKwh: r.ratePerKwh,
        totalKwh: mySummary?.totalKwh || 0,
        billAmount: mySummary?.billAmount || 0,
        billId: mySummary?.billId || null,
        verified: r.verified,
        revised: r.revised,
        computedAt: r.computedAt,
      };
    });

    res.json({ bills });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/electricity/my-bills/:periodId
 * Tenant views one period's breakdown (only their segments).
 */
export const getMyBillBreakdown = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const { periodId } = req.params;
    const result = await BillingResult.findOne({
      billingPeriodId: periodId,
      isArchived: false,
    })
      .populate("roomId", "name branch type")
      .lean();

    if (!result) {
      return res.status(404).json({ error: "Billing result not found" });
    }

    // Check tenant has access
    const mySummary = result.tenantSummaries.find(
      (t) => String(t.tenantId) === String(dbUser._id),
    );
    if (!mySummary) {
      return res.status(403).json({ error: "You do not have access to this billing result" });
    }

    // Filter segments to only show those where tenant was active
    const mySegments = result.segments.filter((seg) =>
      seg.activeTenantIds.some((id) => String(id) === String(dbUser._id)),
    );

    res.json({
      room: result.roomId?.name || "N/A",
      branch: result.branch,
      ratePerKwh: result.ratePerKwh,
      totalRoomKwh: result.totalRoomKwh,
      myTotalKwh: mySummary.totalKwh,
      myBillAmount: mySummary.billAmount,
      verified: result.verified,
      segments: mySegments,
      allSegments: result.segments, // Full table for transparency
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/electricity/my-bills/by-bill/:billId
 * Tenant: returns the electricity segment breakdown for a specific Bill document.
 *
 * Use-case: BillingPage already has a Bill object with charges.electricity > 0.
 *   This endpoint lets the UI show the full kWh breakdown using that billId
 *   without needing to know the periodId.
 *
 * Auth: verifyToken only (tenant-facing)
 */
export const getMyBillBreakdownByBillId = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const { billId } = req.params;

    // Validate the bill exists and belongs to this tenant
    const bill = await Bill.findById(billId).lean();
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (String(bill.userId) !== String(dbUser._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Find the BillingResult that references this billId
    const result = await BillingResult.findOne({
      "tenantSummaries.billId": bill._id,
      isArchived: false,
    })
      .populate("roomId", "name branch type")
      .populate("billingPeriodId", "startDate endDate")
      .lean();

    if (!result) {
      // Bill has no electricity breakdown (e.g. rent-only bill, or result was deleted)
      return res.status(404).json({ error: "No electricity breakdown found for this bill" });
    }

    // Find this tenant's summary within the result
    const mySummary = result.tenantSummaries.find(
      (t) => String(t.billId) === String(bill._id),
    );

    if (!mySummary) {
      return res.status(403).json({ error: "Access denied to this billing result" });
    }

    // Filter segments to only those where this tenant was active
    const mySegments = result.segments
      .filter((seg) =>
        seg.activeTenantIds.some((id) => String(id) === String(dbUser._id)),
      )
      .map((seg) => ({
        segmentIndex: seg.segmentIndex,
        periodLabel: seg.periodLabel,
        readingFrom: seg.readingFrom,
        readingTo: seg.readingTo,
        kwhConsumed: r2(seg.kwhConsumed),
        activeTenantCount: seg.activeTenantCount,
        sharePerTenantKwh: r2(seg.sharePerTenantKwh),
        sharePerTenantCost: r2(seg.sharePerTenantCost),
      }));

    res.json({
      room: result.roomId?.name || "N/A",
      branch: result.branch,
      ratePerKwh: result.ratePerKwh,
      period: {
        startDate: result.billingPeriodId?.startDate || null,
        endDate: result.billingPeriodId?.endDate || null,
      },
      myTotalKwh: r2(mySummary.totalKwh),
      myBillAmount: r2(mySummary.billAmount),
      verified: result.verified,
      segments: mySegments,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// ADMIN: Get rooms for electricity billing
// ============================================================================

/**
 * GET /api/electricity/rooms
 * Get rooms with billing period status for admin dashboard.
 */
export const getRoomsForBilling = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch = admin.isSuperAdmin && req.query.branch
      ? req.query.branch
      : admin.branch;

    const filter = { isArchived: false };
    if (branch) filter.branch = branch;

    const rooms = await Room.find(filter)
      .select("name roomNumber branch type capacity")
      .sort({ name: 1 })
      .lean();

    const roomIds = rooms.map((r) => r._id);

    // Parallel: open periods, latest readings, checked-in reservations
    const [openPeriods, latestReadings, activeReservations] = await Promise.all([
      BillingPeriod.find({ roomId: { $in: roomIds }, status: "open", isArchived: false }).lean(),
      MeterReading.aggregate([
        { $match: { roomId: { $in: roomIds }, isArchived: false } },
        { $sort: { date: -1 } },
        { $group: { _id: "$roomId", latestReading: { $first: "$reading" }, latestDate: { $first: "$date" } } },
      ]),
      Reservation.find({
        roomId: { $in: roomIds },
        status: "checked-in",
        isArchived: { $ne: true },
      })
        .populate("userId", "firstName lastName")
        .select("roomId userId")
        .lean(),
    ]);

    const openPeriodMap = new Map(openPeriods.map((p) => [String(p.roomId), p]));
    const readingMap = new Map(latestReadings.map((r) => [String(r._id), r]));

    // Build per-room tenant map with masked names
    const tenantsByRoom = new Map();
    for (const res of activeReservations) {
      const key = String(res.roomId);
      if (!tenantsByRoom.has(key)) tenantsByRoom.set(key, []);
      const u = res.userId;
      if (u) {
        const first = u.firstName || "Tenant";
        const last = u.lastName || "";
        // Mask: show first name + masked last name (e.g. "Maria ****")
        const maskedLast = last ? "*".repeat(Math.max(last.length, 4)) : "****";
        tenantsByRoom.get(key).push(`${first} ${maskedLast}`);
      }
    }

    res.json({
      rooms: rooms.map((room) => {
        const key = String(room._id);
        const period = openPeriodMap.get(key);
        const latest = readingMap.get(key);
        const tenants = tenantsByRoom.get(key) || [];
        return {
          id: room._id,
          name: room.name,
          roomNumber: room.roomNumber,
          branch: room.branch,
          type: room.type,
          capacity: room.capacity,
          hasOpenPeriod: !!period,
          openPeriodId: period?._id || null,
          ratePerKwh: period?.ratePerKwh || null,
          latestReading: latest?.latestReading || null,
          latestReadingDate: latest?.latestDate || null,
          hasActiveTenants: tenants.length > 0,
          activeTenantCount: tenants.length,
          maskedTenants: tenants,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// HELPER: Build tenant events from meter readings
// ============================================================================

/**
 * Build tenant events array from meter readings and reservations.
 * Each tenant event tracks their moveInReading and optional moveOutReading.
 */
async function buildTenantEventsFromReadings(roomId, readings, periodStartReading) {
  // Get all tenants who had checked-in reservations for this room
  const reservations = await Reservation.find({
    roomId,
    status: { $in: ["checked-in", "checked-out"] },
    isArchived: { $ne: true },
  })
    .populate("userId", "firstName lastName")
    .lean();

  const tenantMap = new Map();

  // First: register all tenants from reservations as having moved in
  // at or before the period start
  for (const res of reservations) {
    if (!res.userId) continue;
    const key = String(res.userId._id);
    if (!tenantMap.has(key)) {
      tenantMap.set(key, {
        tenantId: key,
        tenantName:
          `${res.userId.firstName || ""} ${res.userId.lastName || ""}`.trim() ||
          "Tenant",
        moveInReading: 0, // default: before period start
        moveOutReading: null,
      });
    }
  }

  // Then: override with actual meter reading events
  for (const reading of readings) {
    if (!reading.tenantId) continue;
    const key = String(reading.tenantId);

    if (reading.eventType === "move-in") {
      if (!tenantMap.has(key)) {
        // New tenant — find their name
        const user = await User.findById(reading.tenantId)
          .select("firstName lastName")
          .lean();
        tenantMap.set(key, {
          tenantId: key,
          tenantName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : "Tenant",
          moveInReading: reading.reading,
          moveOutReading: null,
        });
      } else {
        tenantMap.get(key).moveInReading = reading.reading;
      }
    }

    if (reading.eventType === "move-out") {
      if (tenantMap.has(key)) {
        tenantMap.get(key).moveOutReading = reading.reading;
      }
    }
  }

  return Array.from(tenantMap.values());
}

// ============================================================================
// DELETE: Meter Reading
// ============================================================================

/**
 * DELETE /api/electricity/readings/:id
 * Soft-delete a meter reading by archiving it.
 * Admins are allowed to delete readings that belong to closed periods,
 * but they must click 'Re-run' on the period to recalculate the bills.
 */
export const deleteMeterReading = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;

    const reading = await MeterReading.findById(id);
    if (!reading) return res.status(404).json({ error: "Meter reading not found" });
    if (!admin.isSuperAdmin && reading.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    await MeterReading.findByIdAndDelete(id);

    res.json({ success: true, message: "Meter reading deleted." });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DRAFT BILLING ENDPOINTS
// ============================================================================

/**
 * GET /api/electricity/periods/:periodId/draft-bills
 * Get all draft bills for a closed billing period.
 */
export const getDraftBills = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { periodId } = req.params;

    const result = await BillingResult.findOne({
      billingPeriodId: periodId,
      isArchived: false,
    }).lean();

    if (!result) {
      return res.status(404).json({ error: "No billing result found for this period" });
    }
    if (!admin.isSuperAdmin && result.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    const billIds = result.tenantSummaries
      .map((t) => t.billId)
      .filter(Boolean);

    const bills = billIds.length > 0
      ? await Bill.find({
          _id: { $in: billIds },
          status: "draft",
          isArchived: false,
        })
          .populate("userId", "firstName lastName email")
          .lean()
      : [];

    res.json({
      bills: bills.map((b) => ({
        billId: b._id,
        tenantId: b.userId?._id,
        tenantName: b.userId
          ? `${b.userId.firstName || ""} ${b.userId.lastName || ""}`.trim()
          : "Unknown",
        charges: b.charges,
        totalAmount: b.totalAmount,
        dueDate: b.dueDate,
        notes: b.notes,
        isManuallyAdjusted: b.isManuallyAdjusted,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/electricity/periods/:periodId/send-bills
 * Send all draft bills for a period — flips to pending and emails tenants.
 */
export const sendBills = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { periodId } = req.params;
    const { defaultDueDate } = req.body;

    const period = await BillingPeriod.findById(periodId);
    if (!period) return res.status(404).json({ error: "Billing period not found" });
    if (!admin.isSuperAdmin && period.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (period.status === "open") {
      return res.status(400).json({ error: "Cannot send bills for an open period" });
    }

    const result = await BillingResult.findOne({
      billingPeriodId: period._id,
      isArchived: false,
    }).lean();

    if (!result) {
      return res.status(404).json({ error: "No billing result found" });
    }

    const billIds = result.tenantSummaries.map((t) => t.billId).filter(Boolean);
    const draftBills = await Bill.find({
      _id: { $in: billIds },
      status: "draft",
      isArchived: false,
    });

    if (draftBills.length === 0) {
      return res.json({ success: true, sent: 0, skipped: 0, message: "No draft bills to send" });
    }

    const fallbackDueDate = defaultDueDate
      ? new Date(defaultDueDate)
      : new Date(Date.now() + 7 * 86_400_000);

    const sentAt = new Date();
    let sent = 0;

    for (const bill of draftBills) {
      bill.status = "pending";
      bill.dueDate = bill.dueDate ?? fallbackDueDate;
      bill.sentAt = sentAt;
      await bill.save();

      // Email tenant
      try {
        const tenant = await User.findById(bill.userId).lean();
        if (tenant?.email) {
          const summary = result.tenantSummaries.find(
            (t) => String(t.tenantId) === String(bill.userId),
          );
          await sendBillGeneratedEmail({
            to: tenant.email,
            tenantName: summary?.tenantName || `${tenant.firstName} ${tenant.lastName}`,
            billingMonth: dayjs(period.startDate).format("MMMM YYYY"),
            totalAmount: bill.totalAmount,
            dueDate: dayjs(bill.dueDate).format("MMMM D, YYYY"),
            branchName: period.branch || "Lilycrest",
          });
        }
      } catch (emailErr) {
        logger.warn({ err: emailErr }, "Bill notification email failed (non-blocking)");
      }
      sent++;
    }

    res.json({
      success: true,
      sent,
      skipped: billIds.length - sent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/electricity/bills/:billId/adjust
 * Admin adjusts charges on a draft bill. Recomputes totalAmount.
 */
export const adjustDraftBill = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { billId } = req.params;
    const { charges, notes, dueDate } = req.body;

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (!admin.isSuperAdmin && bill.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (bill.status !== "draft") {
      return res.status(400).json({ error: "Only draft bills can be adjusted" });
    }

    // Merge provided charge fields
    if (charges) {
      const chargeFields = ["electricity", "water", "rent", "applianceFees", "corkageFees", "penalty", "discount"];
      for (const field of chargeFields) {
        if (charges[field] !== undefined) {
          bill.charges[field] = r2(Number(charges[field]));
        }
      }
    }

    // Recompute total (sum of all charges minus discount)
    const c = bill.charges;
    bill.totalAmount = r2(
      (c.electricity || 0) +
      (c.water || 0) +
      (c.rent || 0) +
      (c.applianceFees || 0) +
      (c.corkageFees || 0) +
      (c.penalty || 0) -
      (c.discount || 0)
    );

    if (notes !== undefined) bill.notes = notes;
    if (dueDate) bill.dueDate = new Date(dueDate);
    bill.isManuallyAdjusted = true;

    await bill.save();

    res.json({
      success: true,
      bill: {
        billId: bill._id,
        charges: bill.charges,
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        notes: bill.notes,
        isManuallyAdjusted: bill.isManuallyAdjusted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE: Billing Period
// ============================================================================

/**
 * DELETE /api/electricity/periods/:id
 * Hard-delete a billing period and cascade-delete its linked readings & results.
 */
export const deleteBillingPeriod = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;

    const period = await BillingPeriod.findById(id);
    if (!period) return res.status(404).json({ error: "Billing period not found" });
    if (!admin.isSuperAdmin && period.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Find associated results to delete linked bills
    const results = await BillingResult.find({ billingPeriodId: period._id });
    for (const result of results) {
       for (const ts of result.tenantSummaries) {
          if (ts.billId) {
            await Bill.findByIdAndDelete(ts.billId);
          }
       }
    }

    // Hard delete the period
    await BillingPeriod.findByIdAndDelete(id);

    // Hard delete all readings linked to this period
    await MeterReading.deleteMany({ billingPeriodId: period._id });

    // Hard delete any generated billing results linked to this period
    await BillingResult.deleteMany({ billingPeriodId: period._id });

    res.json({ success: true, message: "Billing period deleted." });
  } catch (error) {
    next(error);
  }
};
