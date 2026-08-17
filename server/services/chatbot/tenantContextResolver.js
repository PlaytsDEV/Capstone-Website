import mongoose from "mongoose";
import User from "../../models/User.js";
import Reservation from "../../models/Reservation.js";
import Contract from "../../models/Contract.js";
import Bill from "../../models/Bill.js";
import MaintenanceRequest from "../../models/MaintenanceRequest.js";
import { ACTIVE_STAY_STATUS_QUERY, CURRENT_RESIDENT_STATUS_QUERY } from "../../utils/lifecycleNaming.js";

/**
 * Format raw branch identifiers (e.g. "gil_puyat", "gil-puyat") into readable display names.
 */
function formatBranchName(rawBranch) {
  if (!rawBranch) return "Lilycrest Residence";
  const str = String(rawBranch).toLowerCase().trim();
  if (str.includes("gil") || str.includes("puyat") || str.includes("pasay")) {
    return "Gil Puyat";
  }
  if (str.includes("guadalupe") || str.includes("makati")) {
    return "Guadalupe";
  }
  return rawBranch
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves comprehensive, real-time context for the authenticated tenant.
 * Strictly scoped by user ID to prevent any cross-tenant data leakage.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user identifier
 * @param {Object} [fallbackAuthUser=null] - Optional cached auth user from req.authUser
 * @returns {Promise<Object>} Sanitized context snapshot
 */
export async function resolveTenantAIContext(userId, fallbackAuthUser = null) {
  if (!userId && !fallbackAuthUser) return null;

  const validObjectId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  const userQuery = validObjectId ? { _id: validObjectId } : { _id: userId };

  const [dbUser, activeReservation, contract, latestBill, activeMaintenanceRaw] = await Promise.all([
    User.findOne(userQuery)
      .select("firstName lastName email branch roomNumber roomBed contactNumber")
      .lean()
      .catch(() => null),
    Reservation.findOne({
      $or: [
        { userId: userId },
        ...(validObjectId ? [{ userId: validObjectId }] : []),
      ],
      isArchived: false,
      status: { $in: [...ACTIVE_STAY_STATUS_QUERY, ...CURRENT_RESIDENT_STATUS_QUERY, "approved_for_payment", "payment_pending", "reserved", "moveIn"] },
    })
      .populate("roomId", "name roomNumber branch type floor")
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => null),
    Contract.findOne({
      $or: [
        { tenantId: userId },
        { userId: userId },
        ...(validObjectId ? [{ tenantId: validObjectId }, { userId: validObjectId }] : []),
      ],
      isArchived: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => null),
    Bill.findOne({
      $or: [
        { userId: userId },
        ...(validObjectId ? [{ userId: validObjectId }] : []),
      ],
      isArchived: false,
    })
      .sort({ billingMonth: -1, createdAt: -1 })
      .lean()
      .catch(() => null),
    MaintenanceRequest.find({
      $or: [
        { user_id: String(userId) },
        { userId: userId },
        ...(validObjectId ? [{ userId: validObjectId }, { user_id: String(validObjectId) }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .catch(() => []),
  ]);

  const user = dbUser || fallbackAuthUser;
  if (!user && !activeReservation && !contract) {
    return null;
  }

  const rawBranch =
    user?.branch ||
    activeReservation?.roomId?.branch ||
    activeReservation?.branch ||
    contract?.branch ||
    "guadalupe";

  const branchDisplay = formatBranchName(rawBranch);

  const tenantName =
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.name ||
    user?.fullName ||
    "Tenant";

  const roomNumber =
    user?.roomNumber ||
    activeReservation?.roomId?.roomNumber ||
    activeReservation?.roomNumber ||
    contract?.roomNumber ||
    "304";

  const bedPosition =
    user?.roomBed ||
    activeReservation?.selectedBed?.id ||
    activeReservation?.selectedBed?.position ||
    contract?.bedLabel ||
    contract?.bedId ||
    "Bed 1";

  // Formulate structured current bill
  let currentBill = null;
  if (latestBill) {
    const rentAmount = Number(latestBill.charges?.rent ?? latestBill.rentAmount ?? 0);
    const electricityAmount = Number(latestBill.charges?.electricity ?? latestBill.electricityAmount ?? 0);
    const waterAmount = Number(latestBill.charges?.water ?? latestBill.waterAmount ?? 0);
    const applianceAmount = Number(latestBill.charges?.applianceFees ?? latestBill.applianceAmount ?? 0);
    const penaltyAmount = Number(latestBill.charges?.penalty ?? latestBill.penaltyAmount ?? 0);
    const discountAmount = Number(latestBill.charges?.discount ?? latestBill.discountAmount ?? 0);
    const totalAmount = Number(latestBill.totalAmount ?? (rentAmount + electricityAmount + applianceAmount + penaltyAmount - discountAmount));

    currentBill = {
      billId: latestBill._id,
      month: latestBill.billingMonth || latestBill.month || new Date(),
      totalAmount,
      rentAmount,
      electricityAmount,
      waterAmount,
      applianceAmount,
      penaltyAmount,
      discountAmount,
      status: latestBill.status || "pending",
      dueDate: latestBill.dueDate || null,
      proRataDays: latestBill.proRataDays || null,
    };
  }

  // Formulate structured active contract
  let contractData = null;
  const activeDoc = contract || activeReservation;
  if (activeDoc) {
    const startDate = activeDoc.leaseStartDate || activeDoc.startDate || activeDoc.moveInDate || null;
    const endDate = activeDoc.leaseEndDate || activeDoc.endDate || activeDoc.moveOutDate || null;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    contractData = {
      contractNumber: contract?.contractNumber || "CTR-ACTIVE",
      roomNumber,
      bedPosition,
      startDate,
      endDate,
      daysRemaining,
      monthlyRate: Number(contract?.approvedMonthlyRate ?? contract?.regularMonthlyRate ?? activeDoc.monthlyRate ?? 3500),
      depositAmount: Number(contract?.securityDepositAmount ?? activeDoc.depositAmount ?? activeDoc.totalPrice ?? 3500),
      status: contract?.status || activeDoc?.status || "active",
      roomType: contract?.roomType || activeReservation?.roomId?.type || "Quadruple Sharing",
    };
  }

  // Formulate maintenance tickets list
  const activeMaintenance = (activeMaintenanceRaw || []).map((ticket) => ({
    ticketCode: ticket.ticketNumber || ticket.request_id || String(ticket._id),
    category: ticket.request_type || ticket.type || "Maintenance Issue",
    urgency: ticket.urgency || "normal",
    status: ticket.status || "pending",
    description: ticket.description?.slice(0, 150) || "Room repair request",
    providerName: ticket.providerDetails?.tenantVisibleLabel || ticket.providerName || "Assigned Technician",
    scheduledDate: ticket.schedule?.scheduledDate || ticket.scheduledDate || null,
    submittedDate: ticket.createdAt || new Date(),
  }));

  return {
    tenantName,
    branch: branchDisplay,
    branchRaw: rawBranch,
    roomNumber,
    bedPosition,
    currentBill,
    contract: contractData,
    activeMaintenance,
    hasActiveMaintenance: activeMaintenance.length > 0,
    hasPendingBill: Boolean(currentBill && currentBill.status !== "paid"),
  };
}
