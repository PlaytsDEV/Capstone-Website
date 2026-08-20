/**
 * adminDynamicSuggestionsService.js
 * Generates live, context-aware query suggestions for the Admin Operations Assistant
 * based on current database state, urgent tickets, move-ins, and billing alerts.
 */

import dayjs from "dayjs";
import {
  Reservation,
  MaintenanceRequest,
  Bill,
  Contract,
  Room,
} from "../../models/index.js";

/**
 * Fetches dynamic, real-time suggested queries based on active dormitory events.
 *
 * @param {Object} params
 * @param {string} [params.branch] - Active branch ('gil-puyat', 'guadalupe', 'all')
 * @param {string} [params.userRole] - User role ('branch_admin', 'owner')
 * @returns {Promise<Object>} List of contextual suggestion chips
 */
export async function getAdminDynamicSuggestions({ branch = "all", userRole = "branch_admin" } = {}) {
  try {
    const isOwner = userRole === "owner" || branch === "all";
    const branchQuery = (!isOwner && branch && branch !== "all") ? { branch } : {};

    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();
    const nextThreeDays = dayjs().add(3, "day").endOf("day").toDate();
    const nextThirtyDays = dayjs().add(30, "day").endOf("day").toDate();

    const suggestions = [];

    // 1. Primary standup briefing chip
    if (isOwner && (branch === "all" || !branch)) {
      suggestions.push({
        label: "Consolidated Operations Briefing",
        prompt: "Today's Shift Briefing",
        category: "standup",
        priority: 1,
      });
    } else {
      const branchLabel = branch === "guadalupe" ? "Guadalupe" : "Gil Puyat";
      suggestions.push({
        label: `Today's Shift Briefing · ${branchLabel}`,
        prompt: "Today's Shift Briefing",
        category: "standup",
        priority: 1,
      });
    }

    // 2. Urgent / High-Priority Maintenance Suggestions
    try {
      const urgentTickets = await MaintenanceRequest.find({
        ...branchQuery,
        status: { $in: ["pending", "in_progress", "scheduled"] },
        urgency: { $in: ["urgent", "high"] },
        isArchived: { $ne: true },
      })
        .populate("roomId", "roomNumber")
        .sort({ urgency: -1, createdAt: 1 })
        .limit(2)
        .lean();

      urgentTickets.forEach((t) => {
        const roomNum = t.roomId?.roomNumber;
        const issueName = t.title || t.issue || t.category || "Issue";
        if (roomNum) {
          suggestions.push({
            label: `Urgent: Room ${roomNum} (${issueName})`,
            prompt: `What is the urgent maintenance status for Room ${roomNum}?`,
            category: "maintenance",
            priority: 2,
          });
        }
      });
    } catch (mErr) {
      console.warn("Could not query maintenance suggestions:", mErr?.message);
    }

    // 3. Today's Scheduled Move-Ins
    try {
      const moveIns = await Reservation.find({
        ...branchQuery,
        status: { $in: ["approved", "active", "checked_in", "moveIn", "confirmed", "reserved"] },
        isArchived: { $ne: true },
        $or: [
          { intendedMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { preferredMoveInDate: { $gte: todayStart, $lte: todayEnd } },
          { moveInDate: { $gte: todayStart, $lte: todayEnd } },
        ],
      })
        .populate("roomId", "roomNumber")
        .limit(2)
        .lean();

      moveIns.forEach((m) => {
        const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.fullName || "Tenant";
        const roomNum = m.roomId?.roomNumber;
        suggestions.push({
          label: `Move-In: ${name}${roomNum ? ` (Rm ${roomNum})` : ""}`,
          prompt: `Show info for ${name}`,
          category: "move_in",
          priority: 3,
        });
      });
    } catch (rErr) {
      console.warn("Could not query move-in suggestions:", rErr?.message);
    }

    // 4. Overdue Invoices or Billing Deadlines
    try {
      const overdueCount = await Bill.countDocuments({
        ...branchQuery,
        status: "overdue",
        publicationState: "published",
        isArchived: { $ne: true },
      });

      if (overdueCount > 0) {
        suggestions.push({
          label: `Follow up ${overdueCount} Overdue Bill${overdueCount > 1 ? "s" : ""}`,
          prompt: "What is the policy and turnaround time for overdue utility bills?",
          category: "billing",
          priority: 4,
        });
      }
    } catch (bErr) {
      console.warn("Could not query overdue suggestions:", bErr?.message);
    }

    // 5. Expiring Contracts in Next 30 Days
    try {
      const expiringCount = await Contract.countDocuments({
        ...branchQuery,
        status: "active",
        endDate: { $gte: todayStart, $lte: nextThirtyDays },
        isArchived: { $ne: true },
      });

      if (expiringCount > 0) {
        suggestions.push({
          label: `${expiringCount} Contract${expiringCount > 1 ? "s" : ""} Expiring Soon`,
          prompt: "What is the standard lease renewal and deposit clearance policy?",
          category: "contracts",
          priority: 5,
        });
      }
    } catch (cErr) {
      console.warn("Could not query contract suggestions:", cErr?.message);
    }

    // 6. Common Standard Operating Procedures
    const standardSops = [
      { label: "Lost room key policy", prompt: "What is the lost room key replacement procedure?", category: "sop" },
      { label: "Guest curfew & visitor policy", prompt: "What is the guest visiting hours and overnight curfew policy?", category: "sop" },
      { label: "Move-out clearance checklist", prompt: "What is the move-out clearance checklist and deposit refund policy?", category: "sop" },
      { label: "Urgent maintenance turnaround times", prompt: "What are the target turnaround times for urgent maintenance escalations?", category: "sop" },
      { label: "Utility late penalty rules", prompt: "What are the utility billing dispute rules and grace periods?", category: "sop" },
    ];

    // Mix standard SOPs to ensure at least 5-6 rich suggestions
    standardSops.forEach((sop) => {
      if (suggestions.length < 7) {
        suggestions.push(sop);
      }
    });

    return {
      success: true,
      data: suggestions,
    };
  } catch (error) {
    console.error("Error in getAdminDynamicSuggestions:", error);
    return {
      success: false,
      data: [
        { label: "Today's Shift Briefing", prompt: "Today's Shift Briefing", category: "standup" },
        { label: "Move-out clearance checklist", prompt: "Move-out clearance checklist", category: "sop" },
        { label: "Lost room key policy", prompt: "Lost room key policy", category: "sop" },
        { label: "Guest curfew & visitor policy", prompt: "Guest curfew & visitor policy", category: "sop" },
      ],
    };
  }
}
