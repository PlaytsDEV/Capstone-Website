/**
 * ============================================================================
 * ADMIN QUICK SEARCH CONTROLLER
 * ============================================================================
 *
 * Provides fast, indexed live search for Tenants, Rooms, and Maintenance Tickets
 * for the Admin Command Palette (Quick Search).
 *
 * Strict Role & Branch Scoping:
 * - Branch Admins: Scoped strictly to their assigned branch.
 * - Owners: Can search across all branches or filter by requested branch.
 * ============================================================================
 */

import { User, Room, MaintenanceRequest } from "../models/index.js";
import { isOwnerRole } from "../config/roles.js";

/**
 * Perform quick live search across Tenants, Rooms, and Maintenance Requests.
 */
export const handleAdminQuickSearch = async (req, res, next) => {
  try {
    const rawQuery = (req.query.query || req.query.q || "").trim();
    if (!rawQuery || rawQuery.length < 1) {
      return res.status(200).json({
        success: true,
        data: {
          tenants: [],
          rooms: [],
          maintenance: [],
        },
      });
    }

    const userRole = req.authUser?.role || req.user?.role || "branch_admin";
    const isOwner = isOwnerRole(userRole);

    // Branch scoping
    let branchFilter = null;
    if (!isOwner) {
      branchFilter = req.branchFilter || req.authUser?.branch || null;
    } else if (req.query.branch && req.query.branch !== "all") {
      branchFilter = req.query.branch;
    }

    const escaped = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escaped, "i");

    // 1. Search Tenants
    const tenantQuery = {
      role: "tenant",
      isArchived: { $ne: true },
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
        { user_id: searchRegex },
        { phone: searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: [{ $ifNull: ["$firstName", ""] }, " ", { $ifNull: ["$lastName", ""] }] },
              regex: escaped,
              options: "i",
            },
          },
        },
      ],
    };
    if (branchFilter) {
      tenantQuery.branch = branchFilter;
    }

    // 2. Search Rooms
    const roomQuery = {
      isArchived: { $ne: true },
      $or: [
        { roomNumber: searchRegex },
        { name: searchRegex },
        { type: searchRegex },
      ],
    };
    if (branchFilter) {
      roomQuery.branch = branchFilter;
    }

    // 3. Search Maintenance Tickets
    const maintQuery = {
      isArchived: { $ne: true },
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { issue: searchRegex },
        { ticketCode: searchRegex },
        { roomNumber: searchRegex },
      ],
    };
    if (branchFilter) {
      maintQuery.branch = branchFilter;
    }

    // Execute queries in parallel with limits
    const [tenants, rooms, maintenance] = await Promise.all([
      User.find(tenantQuery)
        .select("_id firstName lastName username email phone user_id branch profileImage tenantStatus")
        .limit(5)
        .lean(),
      Room.find(roomQuery)
        .select("_id name roomNumber branch floor type capacity currentOccupancy price monthlyPrice")
        .limit(5)
        .lean(),
      MaintenanceRequest.find(maintQuery)
        .select("_id title category urgency status branch roomNumber createdAt")
        .populate("roomId", "roomNumber")
        .limit(5)
        .lean(),
    ]);

    // Format formatted items
    const formattedTenants = tenants.map((t) => {
      const fullName = `${t.firstName || ""} ${t.lastName || ""}`.trim() || t.username || "Tenant";
      const branchDisplay = t.branch === "guadalupe" ? "Guadalupe" : t.branch === "gil-puyat" || t.branch === "gil_puyat" ? "Gil Puyat" : t.branch || "General";
      return {
        id: `tenant-${t._id}`,
        label: fullName,
        subtext: `${t.email || t.phone || t.user_id || "Tenant"} · ${branchDisplay}`,
        branch: branchDisplay,
        type: "tenant",
        group: "Tenants",
        to: `/admin/tenants?search=${encodeURIComponent(fullName)}`,
      };
    });

    const formattedRooms = rooms.map((r) => {
      const branchDisplay = r.branch === "guadalupe" ? "Guadalupe" : r.branch === "gil-puyat" || r.branch === "gil_puyat" ? "Gil Puyat" : r.branch || "General";
      const occ = r.currentOccupancy !== undefined ? `${r.currentOccupancy}/${r.capacity || "?"} occupied` : "";
      return {
        id: `room-${r._id}`,
        label: `Room ${r.roomNumber}${r.name ? ` (${r.name})` : ""}`,
        subtext: `${r.type ? `${r.type.toUpperCase()} · ` : ""}${occ ? `${occ} · ` : ""}${branchDisplay}`,
        branch: branchDisplay,
        type: "room",
        group: "Rooms",
        to: `/admin/room-availability`,
      };
    });

    const formattedMaintenance = maintenance.map((m) => {
      const roomNum = m.roomId?.roomNumber || m.roomNumber || "General";
      const branchDisplay = m.branch === "guadalupe" ? "Guadalupe" : m.branch === "gil-puyat" || m.branch === "gil_puyat" ? "Gil Puyat" : m.branch || "General";
      return {
        id: `maint-${m._id}`,
        label: m.title || "Maintenance Ticket",
        subtext: `Room ${roomNum} · ${m.status?.replace("_", " ") || "Pending"} · ${branchDisplay}`,
        branch: branchDisplay,
        type: "maintenance",
        group: "Maintenance",
        to: `/admin/maintenance?search=${encodeURIComponent(m.title || roomNum)}`,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        tenants: formattedTenants,
        rooms: formattedRooms,
        maintenance: formattedMaintenance,
      },
    });
  } catch (error) {
    next(error);
  }
};
