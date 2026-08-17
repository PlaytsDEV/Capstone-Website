/**
 * adminDailyBriefingService.js
 * Generates an AI-driven daily operational standup briefing for branch administrators.
 */

import dayjs from "dayjs";
import {
  Reservation,
  MoveOutClearance,
  MaintenanceRequest,
  Bill,
  Payment,
  Announcement,
  Room,
} from "../../models/index.js";

/**
 * Generates a comprehensive daily shift briefing for the specified branch.
 *
 * @param {Object} params
 * @param {string} [params.branch] - Admin's active branch ('gil-puyat', 'guadalupe', 'all')
 * @param {string} [params.userRole] - 'owner' or 'branch_admin' / 'admin'
 * @returns {Promise<Object>} Structured daily operational briefing
 */
export async function generateDailyShiftBriefing({ branch = "all", userRole = "branch_admin" } = {}) {
  try {
    const isOwner = userRole === "owner" || branch === "all";
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();
    const threeDaysFromNow = dayjs().add(3, "day").endOf("day").toDate();
    const yesterdayStart = dayjs().subtract(1, "day").startOf("day").toDate();

    const branchQuery = (!isOwner && branch && branch !== "all") ? { branch } : {};

    // 1. Scheduled Move-Ins Today (Reservations with intended move in date today)
    let moveInsToday = [];
    try {
      moveInsToday = await Reservation.find({
        ...branchQuery,
        status: { $in: ["approved", "active", "checked_in", "moveIn", "confirmed", "reserved", "paid"] },
        isArchived: { $ne: true },
        $or: [
          { intendedMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { targetMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { actualMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { preferredMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { requestedMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { moveInDate: { $gte: todayStart, $lte: todayEnd } },
        ],
      })
        .populate("roomId", "roomNumber name")
        .select("firstName lastName fullName email phone branch intendedMoveInDate targetMoveInDate preferredMoveInDate requestedMoveInDate moveInDate roomId selectedBed bedId")
        .lean();
    } catch (resErr) {
      console.warn("Could not query move-ins for daily briefing:", resErr?.message);
    }

    // 2. Scheduled Move-Outs / Clearances Today
    let moveOutsToday = [];
    try {
      moveOutsToday = await MoveOutClearance.find({
        ...branchQuery,
        status: { $in: ["pending", "in_progress", "scheduled"] },
        isArchived: { $ne: true },
        $or: [
          { scheduledInspectionDate: { $gte: todayStart, $lte: todayEnd } },
          { moveOutDate: { $gte: todayStart, $lte: todayEnd } },
        ],
      })
        .populate("userId", "firstName lastName username email phone")
        .populate("roomId", "roomNumber")
        .lean();
    } catch (moErr) {
      console.warn("Could not query move-outs for daily briefing:", moErr?.message);
    }

    // 3. Urgent & High-Priority Maintenance Tickets Needing Attention
    let urgentMaintenance = [];
    try {
      urgentMaintenance = await MaintenanceRequest.find({
        ...branchQuery,
        status: { $in: ["pending", "in_progress", "scheduled"] },
        urgency: { $in: ["urgent", "high"] },
        isArchived: { $ne: true },
      })
        .populate("userId", "firstName lastName email phone")
        .populate("roomId", "roomNumber")
        .sort({ urgency: -1, createdAt: 1 })
        .limit(5)
        .lean();
    } catch (maintErr) {
      console.warn("Could not query maintenance for daily briefing:", maintErr?.message);
    }

    // 4. Financial & Billing Overview
    let paymentsCollectedYesterday = 0;
    let upcomingDueInvoicesCount = 0;
    let overdueInvoicesCount = 0;

    try {
      // Recent payments
      const recentPayments = await Payment.find({
        ...branchQuery,
        status: "completed",
        paymentDate: { $gte: yesterdayStart, $lte: todayEnd },
        isArchived: { $ne: true },
      })
        .select("amount")
        .lean();

      paymentsCollectedYesterday = recentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Bills due soon
      upcomingDueInvoicesCount = await Bill.countDocuments({
        ...branchQuery,
        status: { $in: ["pending", "partially-paid"] },
        publicationState: "published",
        dueDate: { $gte: todayStart, $lte: threeDaysFromNow },
        isArchived: { $ne: true },
      });

      // Overdue bills
      overdueInvoicesCount = await Bill.countDocuments({
        ...branchQuery,
        status: "overdue",
        publicationState: "published",
        isArchived: { $ne: true },
      });
    } catch (finErr) {
      console.warn("Could not query financials for daily briefing:", finErr?.message);
    }

    // 5. Active Branch Announcements
    let activeAnnouncements = [];
    try {
      activeAnnouncements = await Announcement.find({
        $or: [{ branch: "all" }, ...(!isOwner && branch ? [{ branch }] : [])],
        isActive: { $ne: false },
        isArchived: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(2)
        .select("title content category createdAt")
        .lean();
    } catch (annErr) {
      console.warn("Could not query announcements for daily briefing:", annErr?.message);
    }

    // 6. Branch Name Formatter
    const branchTitle =
      branch === "gil-puyat"
        ? "Gil Puyat Branch"
        : branch === "guadalupe"
        ? "Guadalupe Branch"
        : "Consolidated Operations (All Branches)";

    const formattedDate = dayjs().format("dddd, MMMM D, YYYY");

    // Formulate Executive Summary string
    const summaryLines = [
      `Operations Standup Briefing for ${branchTitle} on ${formattedDate}:`,
      `• Scheduled Move-Ins: ${moveInsToday.length} tenant(s)`,
      `• Scheduled Move-Outs / Clearances: ${moveOutsToday.length} tenant(s)`,
      `• High-Priority / Urgent Maintenance: ${urgentMaintenance.length} ticket(s)`,
      `• Recent Collections (Last 24h): ₱${paymentsCollectedYesterday.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      `• Invoices Approaching Due Date (Next 3 Days): ${upcomingDueInvoicesCount} invoice(s)`,
    ];

    if (overdueInvoicesCount > 0) {
      summaryLines.push(`• Overdue Invoices Requiring Follow-Up: ${overdueInvoicesCount} invoice(s)`);
    }

    return {
      success: true,
      data: {
        title: `Today's Operations Briefing · ${branchTitle}`,
        dateString: formattedDate,
        branch: branchTitle,
        summary: summaryLines.join("\n"),
        stats: {
          moveInsCount: moveInsToday.length,
          moveOutsCount: moveOutsToday.length,
          urgentMaintenanceCount: urgentMaintenance.length,
          paymentsCollectedYesterday,
          upcomingDueInvoicesCount,
          overdueInvoicesCount,
        },
        moveIns: moveInsToday.map((m) => ({
          name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.fullName || "Tenant",
          roomNumber: m.roomId?.roomNumber || "Assigned",
          bedId: m.bedId || "Bed",
          phone: m.phone || "N/A",
        })),
        moveOuts: moveOutsToday.map((mo) => ({
          name: `${mo.userId?.firstName || ""} ${mo.userId?.lastName || ""}`.trim() || "Tenant",
          roomNumber: mo.roomId?.roomNumber || "Assigned",
          inspectionDate: mo.scheduledInspectionDate ? dayjs(mo.scheduledInspectionDate).format("h:mm A") : "Today",
        })),
        maintenance: urgentMaintenance.map((u) => ({
          id: u._id,
          title: u.title || u.issue || u.category || "Maintenance Issue",
          roomNumber: u.roomId?.roomNumber || "Facility",
          urgency: u.urgency,
          status: u.status,
        })),
        announcements: activeAnnouncements.map((a) => ({
          title: a.title,
          category: a.category || "Notice",
        })),
      },
    };
  } catch (error) {
    console.error("Error in generateDailyShiftBriefing:", error);
    return {
      success: false,
      error: "Failed to generate daily shift briefing",
    };
  }
}
