import {
  Bill,
  BillingPeriod,
  Reservation,
  Room,
  User,
  WaterBillingRecord,
} from "../models/index.js";
import {
  applyWaterRecordToDraftBills,
  buildWaterResult,
  buildWaterCycle,
  buildWaterTenantSnapshot,
  computeWaterAmount,
  computeWaterUsage,
  getLatestWaterRecordForRoom,
  isWaterBillableRoomType,
  validateWaterCycleWindow,
} from "../utils/waterBilling.js";
import { getUtilityTargetCloseDate, roundMoney } from "../utils/billingPolicy.js";
import { logBillingAudit } from "../utils/billingAudit.js";
import { getRoomLabel } from "../utils/roomLabel.js";
import { getWaterRecordDiagnostics } from "../utils/utilityDiagnostics.js";
import { getDraftBillsForSummaryBillIds, sendDraftUtilityBills } from "../utils/utilityBillFlow.js";
import { sendBillGeneratedEmail } from "../config/email.js";
import dayjs from "dayjs";
async function getAdminInfo(req) {
  const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
  return {
    role: dbUser?.role || "user",
    branch: dbUser?.branch || null,
    isSuperAdmin: dbUser?.role === "owner",
    _id: dbUser?._id || null,
    email: dbUser?.email || req.user?.email || "",
    displayName:
      `${dbUser?.firstName || ""} ${dbUser?.lastName || ""}`.trim() ||
      dbUser?.email ||
      req.user?.email ||
      "Admin",
  };
}

async function getUserInfo(req) {
  return User.findOne({ firebaseUid: req.user.uid }).lean();
}

function formatWaterRecord(record, diagnostics = null) {
  return {
    id: record._id,
    roomId: record.roomId,
    branch: record.branch,
    cycleStart: record.cycleStart,
    cycleEnd: record.cycleEnd,
    previousReading: record.previousReading,
    currentReading: record.currentReading,
    usage: record.usage,
    ratePerUnit: record.ratePerUnit,
    computedAmount: record.computedAmount,
    finalAmount: record.finalAmount,
    isOverridden: !!record.isOverridden,
    overrideReason: record.overrideReason || "",
    status: record.status,
    notes: record.notes || "",
    finalizedAt: record.finalizedAt,
    tenantShares: record.tenantShares || [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: diagnostics?.syncStatus || null,
    syncReason: diagnostics?.syncReason || null,
    eligibleReservationCount: diagnostics?.eligibleReservationCount ?? null,
    matchedElectricityPeriodId: diagnostics?.matchedElectricityPeriodId || null,
  };
}

function buildRecordPayload({ room, cycleStart, cycleEnd, previousReading, currentReading, ratePerUnit, finalAmount, overrideReason, notes, existingRecord = null }) {
  const usage = computeWaterUsage(previousReading, currentReading);
  const computedAmount = computeWaterAmount(usage, ratePerUnit);
  const sanitizedFinalAmount = Number(finalAmount);
  const finalRoomAmount = Number.isFinite(sanitizedFinalAmount) && sanitizedFinalAmount >= 0
    ? roundMoney(sanitizedFinalAmount)
    : computedAmount;

  return {
    roomId: room._id,
    branch: room.branch,
    cycleStart,
    cycleEnd,
    previousReading: Number(previousReading),
    currentReading: Number(currentReading),
    usage,
    ratePerUnit: Number(ratePerUnit),
    computedAmount,
    finalAmount: finalRoomAmount,
    isOverridden: Math.abs(finalRoomAmount - computedAmount) > 0.0001,
    overrideReason: overrideReason || "",
    notes: notes ?? existingRecord?.notes ?? "",
  };
}

function formatTenantWaterRecord(record, share) {
  return {
    id: record._id,
    billId: share?.billId || null,
    room: getRoomLabel(record.roomId, "N/A"),
    branch: record.branch,
    cycleStart: record.cycleStart,
    cycleEnd: record.cycleEnd,
    previousReading: record.previousReading,
    currentReading: record.currentReading,
    usage: record.usage,
    ratePerUnit: record.ratePerUnit,
    roomTotal: record.finalAmount,
    tenantsSharing: record.tenantShares?.length || 0,
    myShare: share?.shareAmount || 0,
    status: record.status,
  };
}

function buildRecordDateFilter(from, to, field = "cycleEnd") {
  const filter = {};
  if (from) {
    const parsedFrom = new Date(from);
    if (!Number.isNaN(parsedFrom.getTime())) {
      filter.$gte = parsedFrom;
    }
  }
  if (to) {
    const parsedTo = new Date(to);
    if (!Number.isNaN(parsedTo.getTime())) {
      parsedTo.setHours(23, 59, 59, 999);
      filter.$lte = parsedTo;
    }
  }
  return Object.keys(filter).length ? { [field]: filter } : {};
}

function formatWaterPeriod(record, bills = []) {
  const hasDraftBills = bills.some((bill) => bill.status === "draft");
  const hasSentBills = bills.some((bill) => bill.status !== "draft" || bill.sentAt);
  const displayStatus = record.status === "draft"
    ? "open"
    : hasDraftBills
      ? "ready"
      : "closed";

  return {
    id: record._id,
    startDate: record.cycleStart,
    endDate: record.cycleEnd,
    startReading: record.previousReading,
    endReading: record.currentReading,
    ratePerKwh: record.ratePerUnit,
    ratePerUnit: record.ratePerUnit,
    status: record.status === "draft" ? "open" : "closed",
    displayStatus,
    revised: !!record.isOverridden,
    hasDraftBills,
    hasSentBills,
    closedAt: record.finalizedAt || null,
    targetCloseDate: null,
  };
}

async function getWaterRecordWithAccess(id, admin) {
  const record = await WaterBillingRecord.findById(id);
  if (!record || record.isArchived) {
    return null;
  }
  if (!admin.isSuperAdmin && record.branch !== admin.branch) {
    const error = new Error("Access denied");
    error.statusCode = 403;
    throw error;
  }
  return record;
}

async function ensureBillableRoom(roomId, admin) {
  const room = await Room.findById(roomId);
  if (!room) {
    const error = new Error("Room not found");
    error.statusCode = 404;
    throw error;
  }
  if (!admin.isSuperAdmin && room.branch !== admin.branch) {
    const error = new Error("Access denied");
    error.statusCode = 403;
    throw error;
  }
  return room;
}

export const getMyWaterRecords = async (req, res, next) => {
  try {
    const dbUser = await getUserInfo(req);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const bills = await Bill.find({
      userId: dbUser._id,
      status: { $ne: "draft" },
      isArchived: false,
    })
      .select("_id")
      .lean();

    const billIds = bills.map((bill) => bill._id);
    if (billIds.length === 0) {
      return res.json({ records: [] });
    }

    const accessibleBillIds = new Set(billIds.map((billId) => String(billId)));
    const records = await WaterBillingRecord.find({
      status: "finalized",
      isArchived: false,
      "tenantShares.billId": { $in: billIds },
    })
      .populate("roomId", "name roomNumber branch type")
      .sort({ cycleEnd: -1, createdAt: -1 })
      .lean();

    res.json({
      records: records
        .map((record) => {
          const share = (record.tenantShares || []).find(
            (entry) =>
              accessibleBillIds.has(String(entry.billId)) &&
              String(entry.tenantId) === String(dbUser._id),
          );
          return share ? formatTenantWaterRecord(record, share) : null;
        })
        .filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyWaterBreakdownByBillId = async (req, res, next) => {
  try {
    const dbUser = await getUserInfo(req);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const bill = await Bill.findById(req.params.billId).lean();
    if (!bill || bill.isArchived) {
      return res.status(404).json({ error: "Bill not found" });
    }
    if (String(bill.userId) !== String(dbUser._id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (bill.status === "draft") {
      return res.status(403).json({ error: "Bill is not yet available" });
    }

    const record = await WaterBillingRecord.findOne({
      status: "finalized",
      isArchived: false,
      "tenantShares.billId": bill._id,
    })
      .populate("roomId", "name roomNumber branch type")
      .lean();

    if (!record) {
      return res.status(404).json({ error: "No water billing record found for this bill" });
    }

    const share = (record.tenantShares || []).find(
      (entry) => String(entry.billId) === String(bill._id),
    );

    res.json({
      record: formatTenantWaterRecord(record, share),
    });
  } catch (error) {
    next(error);
  }
};

export const exportWaterBilling = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch = admin.isSuperAdmin ? req.query.branch || null : admin.branch;
    const status = req.query.status && req.query.status !== "all" ? req.query.status : null;
    const roomId = req.query.roomId || null;

    const filter = {
      isArchived: false,
      ...(branch ? { branch } : {}),
      ...(status ? { status } : {}),
      ...(roomId ? { roomId } : {}),
      ...buildRecordDateFilter(req.query.from, req.query.to, "cycleEnd"),
    };

    const records = await WaterBillingRecord.find(filter)
      .populate("roomId", "name roomNumber branch type")
      .sort({ cycleEnd: -1, createdAt: -1 })
      .lean();

    const rows = records.flatMap((record) => {
      const baseRow = {
        recordId: String(record._id),
        roomId: String(record.roomId?._id || record.roomId || ""),
        roomName: getRoomLabel(record.roomId),
        branch: record.branch,
        roomType: record.roomId?.type || "",
        cycleStart: record.cycleStart,
        cycleEnd: record.cycleEnd,
        status: record.status,
        usage: record.usage,
        ratePerUnit: record.ratePerUnit,
        computedAmount: record.computedAmount,
        finalAmount: record.finalAmount,
        isOverridden: !!record.isOverridden,
        tenantCount: record.tenantShares?.length || 0,
        finalizedAt: record.finalizedAt || null,
        syncStatus: null,
        syncReason: null,
      };

      if (!record.tenantShares?.length) {
        return [
          {
            ...baseRow,
            tenantName: "",
            tenantShare: "",
            billId: "",
          },
        ];
      }

      return record.tenantShares.map((share) => ({
        ...baseRow,
        tenantName: share.tenantName || "",
        tenantShare: share.shareAmount ?? "",
        billId: share.billId ? String(share.billId) : "",
      }));
    });

    await logBillingAudit({
      req,
      admin,
      action: "water_export_downloaded",
      severity: "low",
      branch,
      details: `Exported ${rows.length} water billing row${rows.length === 1 ? "" : "s"}`,
      metadata: {
        rowCount: rows.length,
        recordCount: records.length,
        filters: {
          branch,
          status,
          roomId,
          from: req.query.from || null,
          to: req.query.to || null,
        },
      },
    });

    res.json({
      success: true,
      generatedAt: new Date(),
      filters: {
        branch,
        status,
        roomId,
        from: req.query.from || null,
        to: req.query.to || null,
      },
      summary: {
        recordCount: records.length,
        rowCount: rows.length,
      },
      rows,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoomsForWaterBilling = async (req, res, next) => {
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

    const roomIds = rooms.map((room) => room._id);
    const [latestRecords, activeReservations] = await Promise.all([
      WaterBillingRecord.find({
        roomId: { $in: roomIds },
        isArchived: false,
      })
        .sort({ cycleEnd: -1, createdAt: -1 })
        .lean(),
      Reservation.aggregate([
        {
          $match: {
            roomId: { $in: roomIds },
            status: "checked-in",
            isArchived: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$roomId",
            activeTenantCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const latestByRoom = new Map();
    for (const record of latestRecords) {
      const key = String(record.roomId);
      if (!latestByRoom.has(key)) latestByRoom.set(key, record);
    }
    const diagnosticsByRecordId = new Map(
      (
        await Promise.all(
          latestRecords.map((record) => getWaterRecordDiagnostics(record)),
        )
      )
        .filter(Boolean)
        .map((diag) => [String(diag.recordId), diag]),
    );
    const activeCountByRoom = new Map(
      activeReservations.map((entry) => [String(entry._id), entry.activeTenantCount]),
    );

    res.json({
      rooms: rooms.map((room) => {
        const latest = latestByRoom.get(String(room._id));
        const isEligible = isWaterBillableRoomType(room.type);
        const latestDiagnostics = latest
          ? diagnosticsByRecordId.get(String(latest._id))
          : null;
        return {
          id: room._id,
          name: room.name,
          roomNumber: room.roomNumber,
          branch: room.branch,
          type: room.type,
          capacity: room.capacity,
          isWaterEligible: isEligible,
          activeTenantCount: activeCountByRoom.get(String(room._id)) || 0,
          latestRecord: latest
            ? {
                id: latest._id,
                cycleEnd: latest.cycleEnd,
                currentReading: latest.currentReading,
                finalAmount: latest.finalAmount,
                status: latest.status,
                syncStatus: latestDiagnostics?.syncStatus || null,
                syncReason: latestDiagnostics?.syncReason || null,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const getWaterRecords = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const room = await ensureBillableRoom(req.params.roomId, admin);

    const records = await WaterBillingRecord.find({
      roomId: room._id,
      isArchived: false,
    })
      .sort({ cycleEnd: -1, createdAt: -1 })
      .lean();

    const diagnosticsByRecordId = new Map(
      (
        await Promise.all(records.map((record) => getWaterRecordDiagnostics(record)))
      )
        .filter(Boolean)
        .map((diag) => [String(diag.recordId), diag]),
    );

    res.json({
      records: records.map((record) =>
        formatWaterRecord(record, diagnosticsByRecordId.get(String(record._id))),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getLatestWaterRecord = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const room = await ensureBillableRoom(req.params.roomId, admin);
    const record = await getLatestWaterRecordForRoom(room._id);

    if (!record) {
      return res.status(404).json({ error: "No water record found for this room" });
    }

    const diagnostics = await getWaterRecordDiagnostics(record);
    res.json({ record: formatWaterRecord(record, diagnostics) });
  } catch (error) {
    next(error);
  }
};

export const createWaterRecord = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const {
      roomId,
      cycleEnd,
      previousReading,
      currentReading,
      ratePerUnit,
      finalAmount,
      overrideReason,
      notes,
    } = req.body;

    if (!roomId) return res.status(400).json({ error: "Room ID is required" });
    if (currentReading === undefined) {
      return res.status(400).json({ error: "Current reading is required" });
    }
    if (!ratePerUnit || Number(ratePerUnit) <= 0) {
      return res.status(400).json({ error: "Water rate (₱ per unit) is required. Enter this month's rate from your water bill." });
    }

    const room = await ensureBillableRoom(roomId, admin);
    if (!isWaterBillableRoomType(room.type)) {
      return res.status(400).json({ error: "Water billing is not enabled for this room type." });
    }
    const existingDraft = await WaterBillingRecord.findOne({
      roomId: room._id,
      status: "draft",
      isArchived: false,
    });
    if (existingDraft) {
      return res.status(409).json({
        error: "Finish or delete the existing draft water billing period before starting a new one.",
      });
    }
    const latestRecord = await getLatestWaterRecordForRoom(room._id);
    const cycle = buildWaterCycle({
      cycleEnd: cycleEnd ? new Date(cycleEnd) : null,
      latestRecord,
      referenceDate: new Date(),
    });
    validateWaterCycleWindow(cycle);
    const resolvedPreviousReading = previousReading ?? latestRecord?.currentReading;

    if (resolvedPreviousReading === undefined || resolvedPreviousReading === null) {
      return res.status(400).json({
        error: "Previous reading is required for the first water billing record in a room.",
      });
    }

    const existingRecord = await WaterBillingRecord.findOne({
      roomId: room._id,
      cycleStart: cycle.cycleStart,
      isArchived: false,
    });
    if (existingRecord) {
      return res.status(409).json({
        error: "A water record already exists for this room and cycle.",
      });
    }

    const payload = buildRecordPayload({
      room,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      previousReading: resolvedPreviousReading,
      currentReading,
      ratePerUnit,
      finalAmount,
      overrideReason,
      notes,
    });

    const record = new WaterBillingRecord({
      ...payload,
      status: "draft",
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    record.tenantShares = await buildWaterTenantSnapshot(
      room,
      record.cycleStart,
      record.cycleEnd,
      record.finalAmount,
    );
    await record.save();

    const diagnostics = await getWaterRecordDiagnostics(record);

    res.status(201).json({
      success: true,
      record: formatWaterRecord(record, diagnostics),
      schedule: {
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWaterRecord = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;
    const record = await WaterBillingRecord.findById(id);
    if (!record || record.isArchived) {
      return res.status(404).json({ error: "Water record not found" });
    }
    if (!admin.isSuperAdmin && record.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (record.status !== "draft") {
      return res.status(400).json({ error: "Only draft water records can be deleted" });
    }

    record.isArchived = true;
    record.updatedBy = admin._id;
    await record.save();

    await logBillingAudit(req, {
      admin,
      action: "water_draft_deleted",
      severity: "medium",
      entityId: record._id,
      branch: record.branch,
      details: `Deleted draft water billing for room ${getRoomLabel(record.roomId, "Room")}`,
      metadata: {
        roomId: record.roomId,
        cycleStart: record.cycleStart,
        cycleEnd: record.cycleEnd,
        status: record.status,
      },
    });

    res.json({ success: true, id: record._id });
  } catch (error) {
    next(error);
  }
};

export const updateWaterRecord = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;
    const record = await WaterBillingRecord.findById(id);
    if (!record || record.isArchived) {
      return res.status(404).json({ error: "Water record not found" });
    }
    if (!admin.isSuperAdmin && record.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (record.status !== "draft") {
      return res.status(400).json({ error: "Only draft water records can be edited" });
    }

    const room = await Room.findById(record.roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isWaterBillableRoomType(room.type)) {
      return res.status(400).json({ error: "Water billing is not enabled for this room type." });
    }

    const {
      cycleEnd = record.cycleEnd,
      previousReading = record.previousReading,
      currentReading = record.currentReading,
      ratePerUnit = record.ratePerUnit,
      finalAmount = record.finalAmount,
      overrideReason = record.overrideReason,
      notes = record.notes,
    } = req.body;

    const cycle = validateWaterCycleWindow({
      cycleStart: record.cycleStart,
      cycleEnd,
    });

    const payload = buildRecordPayload({
      room,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      previousReading,
      currentReading,
      ratePerUnit,
      finalAmount,
      overrideReason,
      notes,
      existingRecord: record,
    });

    Object.assign(record, payload, { updatedBy: admin._id });
    record.tenantShares = await buildWaterTenantSnapshot(
      room,
      record.cycleStart,
      record.cycleEnd,
      record.finalAmount,
    );
    await record.save();

    const diagnostics = await getWaterRecordDiagnostics(record);

    if (record.isOverridden) {
      await logBillingAudit(req, {
        admin,
        action: "water_amount_overridden",
        severity: "high",
        entityId: record._id,
        branch: record.branch,
        details: `Overrode water amount for room ${getRoomLabel(room)}`,
        metadata: {
          roomId: room._id,
          cycleStart: record.cycleStart,
          cycleEnd: record.cycleEnd,
          computedAmount: record.computedAmount,
          finalAmount: record.finalAmount,
          overrideReason: record.overrideReason || "",
        },
      });
    }

    res.json({
      success: true,
      record: formatWaterRecord(record, diagnostics),
      schedule: {
        cycleStart: record.cycleStart,
        cycleEnd: record.cycleEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const finalizeWaterRecord = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;
    const record = await WaterBillingRecord.findById(id);
    if (!record || record.isArchived) {
      return res.status(404).json({ error: "Water record not found" });
    }
    if (!admin.isSuperAdmin && record.branch !== admin.branch) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (record.status !== "draft") {
      return res.status(400).json({ error: "Only draft water records can be finalized" });
    }

    const room = await Room.findById(record.roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isWaterBillableRoomType(room.type)) {
      return res.status(400).json({ error: "Water billing is not enabled for this room type." });
    }

    record.status = "finalized";
    record.finalizedAt = new Date();
    record.finalizedBy = admin._id;
    record.updatedBy = admin._id;
    record.tenantShares = await buildWaterTenantSnapshot(
      room,
      record.cycleStart,
      record.cycleEnd,
      record.finalAmount,
    );
    await record.save();

    const applyResult = await applyWaterRecordToDraftBills(record);
    const diagnostics = await getWaterRecordDiagnostics(record);

    await logBillingAudit(req, {
      admin,
      action: "water_billing_finalized",
      severity: "info",
      entityId: record._id,
      branch: record.branch,
      details: `Finalized water billing for room ${getRoomLabel(room)}`,
      metadata: {
        roomId: room._id,
        cycleStart: record.cycleStart,
        cycleEnd: record.cycleEnd,
        finalAmount: record.finalAmount,
        appliedBillCount: applyResult?.appliedBillCount || 0,
        syncReason: applyResult?.reason || null,
      },
    });

    res.json({
      success: true,
      record: formatWaterRecord(record, diagnostics),
      draftBillSync: applyResult,
      schedule: {
        cycleStart: record.cycleStart,
        cycleEnd: record.cycleEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyWaterBills = async (req, res, next) => {
  try {
    const dbUser = await getUserInfo(req);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const records = await WaterBillingRecord.find({
      status: "finalized",
      isArchived: false,
      "tenantShares.tenantId": dbUser._id,
    })
      .populate("roomId", "name roomNumber branch type")
      .sort({ cycleEnd: -1, updatedAt: -1 })
      .lean();

    const bills = records.map((record) => {
      const result = buildWaterResult(record, record.roomId);
      const mySummary = result.tenantSummaries.find(
        (summary) => String(summary.tenantId) === String(dbUser._id),
      );

      return {
        billingResultId: result.id,
        billingPeriodId: result.billingPeriodId,
        room: getRoomLabel(record.roomId, "N/A"),
        branch: record.branch,
        ratePerUnit: result.ratePerUnit,
        totalUsage: mySummary?.totalUsage || 0,
        billAmount: mySummary?.billAmount || 0,
        billId: mySummary?.billId || null,
        verified: true,
        revised: !!record.isOverridden,
        computedAt: result.computedAt,
      };
    });

    res.json({ bills });
  } catch (error) {
    next(error);
  }
};

export const getMyWaterBillBreakdown = async (req, res, next) => {
  try {
    const dbUser = await getUserInfo(req);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const record = await WaterBillingRecord.findById(req.params.periodId)
      .populate("roomId", "name roomNumber branch type")
      .lean();
    if (!record || record.isArchived || record.status !== "finalized") {
      return res.status(404).json({ error: "Billing result not found" });
    }

    const result = buildWaterResult(record, record.roomId);
    const mySummary = result.tenantSummaries.find(
      (summary) => String(summary.tenantId) === String(dbUser._id),
    );
    if (!mySummary) {
      return res.status(403).json({ error: "You do not have access to this billing result" });
    }

    res.json({
      room: getRoomLabel(record.roomId, "N/A"),
      branch: record.branch,
      ratePerUnit: result.ratePerUnit,
      totalUsage: result.totalUsage,
      myTotalUsage: mySummary.totalUsage,
      myBillAmount: mySummary.billAmount,
      verified: true,
      segments: result.segments,
      allSegments: result.segments,
    });
  } catch (error) {
    next(error);
  }
};

export const openWaterPeriod = async (req, res, next) => {
  const derivedCycleEnd = req.body.startDate
    ? getUtilityTargetCloseDate(new Date(req.body.startDate))
    : undefined;
  req.body = {
    ...req.body,
    cycleEnd: req.body.endDate || req.body.cycleEnd || derivedCycleEnd,
    previousReading: req.body.startReading ?? req.body.previousReading,
    currentReading: req.body.startReading ?? req.body.currentReading,
    ratePerUnit: req.body.ratePerUnit ?? req.body.ratePerKwh,
  };
  return createWaterRecord(req, res, next);
};

export const getWaterPeriods = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const room = await ensureBillableRoom(req.params.roomId, admin);

    const records = await WaterBillingRecord.find({
      roomId: room._id,
      isArchived: false,
    })
      .sort({ cycleEnd: -1, createdAt: -1 })
      .lean();

    const billIds = records.flatMap((record) =>
      (record.tenantShares || []).map((share) => share.billId).filter(Boolean),
    );
    const bills = billIds.length
      ? await Bill.find({ _id: { $in: billIds }, isArchived: false })
          .select("_id status sentAt")
          .lean()
      : [];
    const billMap = new Map(bills.map((bill) => [String(bill._id), bill]));

    res.json({
      periods: records.map((record) => {
        const periodBills = (record.tenantShares || [])
          .map((share) => share.billId)
          .filter(Boolean)
          .map((billId) => billMap.get(String(billId)))
          .filter(Boolean);
        return formatWaterPeriod(record, periodBills);
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const updateWaterPeriod = async (req, res, next) => {
  req.params.id = req.params.id;
  req.body = {
    ...req.body,
    ratePerUnit: req.body.ratePerUnit ?? req.body.ratePerKwh,
  };
  return updateWaterRecord(req, res, next);
};

export const closeWaterPeriod = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const record = await getWaterRecordWithAccess(req.params.id, admin);
    if (!record) {
      return res.status(404).json({ error: "Billing period not found" });
    }
    if (record.status !== "draft") {
      return res.status(400).json({ error: "Only open periods can be closed" });
    }

    const room = await Room.findById(record.roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const cycle = validateWaterCycleWindow({
      cycleStart: record.cycleStart,
      cycleEnd: req.body.endDate ?? req.body.cycleEnd ?? record.cycleEnd,
    });

    const payload = buildRecordPayload({
      room,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      previousReading: record.previousReading,
      currentReading: req.body.endReading ?? req.body.currentReading,
      ratePerUnit: req.body.ratePerUnit ?? req.body.ratePerKwh ?? record.ratePerUnit,
      finalAmount: req.body.finalAmount ?? record.finalAmount,
      overrideReason: req.body.overrideReason ?? record.overrideReason,
      notes: req.body.notes ?? record.notes,
      existingRecord: record,
    });

    Object.assign(record, payload, {
      status: "finalized",
      finalizedAt: new Date(),
      finalizedBy: admin._id,
      updatedBy: admin._id,
    });
    record.tenantShares = await buildWaterTenantSnapshot(
      room,
      record.cycleStart,
      record.cycleEnd,
      record.finalAmount,
    );
    await record.save();

    const applyResult = await applyWaterRecordToDraftBills(record);
    res.json({
      success: true,
      result: {
        id: record._id,
        totalRoomCost: record.finalAmount,
        totalUsage: record.usage,
        verified: true,
        tenantCount: record.tenantShares.length,
        tenantSummaries: record.tenantShares.map((share) => ({
          tenantName: share.tenantName,
          billAmount: share.shareAmount,
        })),
      },
      draftBillSync: applyResult,
    });
  } catch (error) {
    next(error);
  }
};

export const getWaterBillingResult = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const record = await getWaterRecordWithAccess(req.params.periodId, admin);
    if (!record || record.status !== "finalized") {
      return res.status(404).json({ error: "No billing result found for this period" });
    }

    const room = await Room.findById(record.roomId).lean();
    res.json({ result: buildWaterResult(record.toObject ? record.toObject() : record, room) });
  } catch (error) {
    next(error);
  }
};

export const reviseWaterBillingResult = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const record = await getWaterRecordWithAccess(req.params.periodId, admin);
    if (!record) {
      return res.status(404).json({ error: "Billing period not found" });
    }
    if (record.status !== "finalized") {
      return res.status(400).json({ error: "Cannot revise an open period" });
    }

    const linkedBills = await Bill.find({
      _id: { $in: (record.tenantShares || []).map((share) => share.billId).filter(Boolean) },
      isArchived: false,
    }).lean();
    if (linkedBills.some((bill) => bill.status !== "draft")) {
      return res.status(409).json({ error: "Cannot revise water billing after bills were sent" });
    }

    record.tenantShares = await buildWaterTenantSnapshot(
      await Room.findById(record.roomId),
      record.cycleStart,
      record.cycleEnd,
      record.finalAmount,
    );
    await record.save();
    const applyResult = await applyWaterRecordToDraftBills(record);

    res.json({
      success: true,
      message: "Billing result revised successfully",
      appliedBillCount: applyResult.appliedBillCount || 0,
      verified: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getWaterDraftBills = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const record = await getWaterRecordWithAccess(req.params.periodId, admin);
    if (!record) {
      return res.status(404).json({ error: "Billing period not found" });
    }

    const bills = await getDraftBillsForSummaryBillIds(
      buildWaterResult(record.toObject ? record.toObject() : record, null).tenantSummaries,
    );

    res.json({
      bills: bills.map((bill) => ({
        billId: bill._id,
        tenantId: bill.userId?._id,
        tenantName: bill.userId
          ? `${bill.userId.firstName || ""} ${bill.userId.lastName || ""}`.trim()
          : "Unknown",
        charges: bill.charges,
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        notes: bill.notes,
        isManuallyAdjusted: bill.isManuallyAdjusted,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const sendWaterBills = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const record = await getWaterRecordWithAccess(req.params.periodId, admin);
    if (!record) {
      return res.status(404).json({ error: "Billing period not found" });
    }
    if (record.status !== "finalized") {
      return res.status(400).json({ error: "Cannot send bills for an open period" });
    }

    const room = await Room.findById(record.roomId).lean();
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const matchingElectricityPeriod = await BillingPeriod.findOne({
      roomId: room._id,
      isArchived: false,
      startDate: record.cycleStart,
      endDate: record.cycleEnd,
      status: { $in: ["closed", "revised"] },
    }).lean();

    if (!matchingElectricityPeriod) {
      return res.status(400).json({
        error: `Finalize the electricity billing for room ${getRoomLabel(room)} before sending bills.`,
      });
    }

    const result = buildWaterResult(record.toObject ? record.toObject() : record, room);
    const draftBills = await getDraftBillsForSummaryBillIds(result.tenantSummaries);
    if (draftBills.length === 0) {
      return res.json({ success: true, sent: 0, skipped: 0, message: "No draft bills to send" });
    }

    const { sent } = await sendDraftUtilityBills({
      bills: draftBills,
      period: {
        startDate: record.cycleStart,
        endDate: record.cycleEnd,
      },
      result,
    });

    for (const bill of draftBills) {
      try {
        const tenant = await User.findById(bill.userId).lean();
        const summary = result.tenantSummaries.find(
          (entry) => String(entry.billId) === String(bill._id),
        );
        if (tenant?.email) {
          await sendBillGeneratedEmail({
            to: tenant.email,
            tenantName: summary?.tenantName || `${tenant.firstName} ${tenant.lastName}`,
            billingMonth: dayjs(record.cycleStart).format("MMMM YYYY"),
            totalAmount: bill.totalAmount,
            dueDate: dayjs(bill.dueDate).format("MMMM D, YYYY"),
            branchName: record.branch || "Lilycrest",
          });
        }
      } catch (emailErr) {
        // Water sending should not fail just because email delivery failed.
      }
    }

    await logBillingAudit(req, {
      admin,
      action: "water_bills_sent_to_tenants",
      severity: "info",
      entityId: record._id,
      branch: record.branch,
      details: `Sent ${sent} water utility bill(s) for room ${getRoomLabel(room)}`,
      metadata: {
        roomId: room._id,
        periodId: record._id,
        sent,
        skipped: result.tenantSummaries.length - sent,
      },
    });

    res.json({
      success: true,
      sent,
      skipped: result.tenantSummaries.length - sent,
    });
  } catch (error) {
    next(error);
  }
};
