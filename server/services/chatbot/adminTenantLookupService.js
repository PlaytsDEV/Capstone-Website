/**
 * adminTenantLookupService.js
 * Specialized service for real-time tenant and room lookup in Lilycrest DMS Admin Assistant.
 */

import { User, Room, Reservation, Bill, MaintenanceRequest } from "../../models/index.js";

// Clean filler words from natural language queries to isolate names
const CLEAN_FILLER_REGEX = /\b(who is in|search for|search|lookup|look up|show info for|show info|info for|find tenant|find|tell me about|check tenant|check|details of|details for|status of|balance of|room|unit|rm|please|tenant)\b/gi;

/**
 * Searches for tenant or room information within the authorized branch scope.
 * 
 * @param {Object} params
 * @param {string} params.query - The search text (name, email, room number)
 * @param {string} [params.branch] - Admin's active branch (e.g. 'gil-puyat', 'guadalupe', 'all')
 * @param {string} [params.userRole] - 'owner' or 'branch_admin' / 'admin'
 * @returns {Promise<Object>} Search result with tenant details, candidates, or room info
 */
export async function findTenantOrRoomInfo({ query, branch, userRole }) {
  if (!query || typeof query !== "string") {
    return { found: false, message: "Invalid search query." };
  }

  const rawQuery = query.trim();
  const isOwner = userRole === "owner" || branch === "all";

  // Check if query is explicitly asking for a room number (e.g., "Room 204", "Unit 101", "rm 302", or pure digits "204")
  const roomPatternMatch = rawQuery.match(/(?:room|unit|rm|#)\s*([a-zA-Z0-9-]+)/i) || 
    (rawQuery.length <= 5 && /^[0-9]+[a-zA-Z]?$/.test(rawQuery) ? [rawQuery, rawQuery] : null);

  if (roomPatternMatch && roomPatternMatch[1]) {
    const roomNumber = roomPatternMatch[1];
    return await searchByRoomNumber({ roomNumber, branch, isOwner });
  }

  // Otherwise, treat as person name, email, or user ID search
  const cleanedName = rawQuery.replace(CLEAN_FILLER_REGEX, " ").replace(/\s+/g, " ").trim();
  const searchTarget = cleanedName.length > 0 ? cleanedName : rawQuery;

  return await searchByTenantIdentifier({ searchTarget, branch, isOwner });
}

/**
 * Search occupants by Room Number
 */
async function searchByRoomNumber({ roomNumber, branch, isOwner }) {
  try {
    const roomQuery = {
      roomNumber: new RegExp(`^${roomNumber}$`, "i"),
      isArchived: { $ne: true }
    };

    if (!isOwner && branch) {
      roomQuery.branch = branch;
    }

    const room = await Room.findOne(roomQuery).lean();
    if (!room) {
      return {
        found: false,
        isRoomSearch: true,
        roomNumber,
        message: `No room matching "${roomNumber}" was found in ${isOwner ? "any branch" : `${branch} branch`}.`
      };
    }

    // Find all occupied bed user IDs
    const occupiedUserIds = (room.beds || [])
      .map((b) => b?.occupiedBy?.userId)
      .filter(Boolean);

    // Also check active reservations for this room
    const activeReservations = await Reservation.find({
      roomId: room._id,
      status: { $in: ["approved", "checked_in", "active"] },
      isArchived: { $ne: true }
    }).select("user status").lean();

    const reservationUserIds = activeReservations.map((r) => r.user).filter(Boolean);
    const allUserIds = Array.from(new Set([...occupiedUserIds.map(String), ...reservationUserIds.map(String)]));

    if (allUserIds.length === 0) {
      return {
        found: true,
        isRoomSearch: true,
        roomNumber: room.roomNumber,
        roomDetails: {
          _id: room._id,
          name: room.name,
          roomNumber: room.roomNumber,
          branch: room.branch,
          floor: room.floor,
          type: room.type,
          capacity: room.capacity,
          currentOccupancy: room.currentOccupancy || 0,
          monthlyPrice: room.monthlyPrice || room.price || 0,
        },
        occupants: [],
        message: `Room ${room.roomNumber} (${room.branch}) is currently vacant (0/${room.capacity} occupants).`
      };
    }

    // Populate occupant details
    const users = await User.find({
      _id: { $in: allUserIds },
      isArchived: { $ne: true }
    }).select("firstName lastName username email phone user_id branch profileImage tenantStatus status").lean();

    const occupants = await Promise.all(
      users.map(async (u) => await enrichTenantProfile(u, room))
    );

    return {
      found: true,
      isRoomSearch: true,
      roomNumber: room.roomNumber,
      roomDetails: {
        _id: room._id,
        name: room.name,
        roomNumber: room.roomNumber,
        branch: room.branch,
        floor: room.floor,
        type: room.type,
        capacity: room.capacity,
        currentOccupancy: room.currentOccupancy || occupants.length,
        monthlyPrice: room.monthlyPrice || room.price || 0,
      },
      occupants,
      message: `Found ${occupants.length} occupant(s) in Room ${room.roomNumber} (${room.branch}).`
    };
  } catch (error) {
    console.error("Error in searchByRoomNumber:", error);
    return { found: false, error: error.message };
  }
}

/**
 * Search tenant by Name, Email, or User ID
 */
async function searchByTenantIdentifier({ searchTarget, branch, isOwner }) {
  try {
    const escaped = searchTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(escaped, "i");

    const userQuery = {
      role: "tenant",
      isArchived: { $ne: true },
      $or: [
        { firstName: nameRegex },
        { lastName: nameRegex },
        { username: nameRegex },
        { email: nameRegex },
        { user_id: nameRegex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: [{ $ifNull: ["$firstName", ""] }, " ", { $ifNull: ["$lastName", ""] }] },
              regex: escaped,
              options: "i"
            }
          }
        }
      ]
    };

    if (!isOwner && branch) {
      userQuery.branch = branch;
    }

    const matchedUsers = await User.find(userQuery)
      .select("firstName lastName username email phone user_id branch profileImage tenantStatus status createdAt")
      .limit(10)
      .lean();

    if (!matchedUsers || matchedUsers.length === 0) {
      return {
        found: false,
        searchTarget,
        message: `No active tenant found matching "${searchTarget}" in ${isOwner ? "all branches" : `${branch} branch`}.`
      };
    }

    // Single match found -> return full enriched profile card
    if (matchedUsers.length === 1) {
      const enriched = await enrichTenantProfile(matchedUsers[0]);
      return {
        found: true,
        isSingle: true,
        tenant: enriched,
        message: `Found tenant profile for ${enriched.fullName}.`
      };
    }

    // Multiple matches found -> return candidate list for disambiguation
    const candidatePromises = matchedUsers.slice(0, 5).map(async (u) => {
      const enriched = await enrichTenantProfile(u);
      return {
        _id: enriched._id,
        fullName: enriched.fullName,
        email: enriched.email,
        phone: enriched.phone,
        branch: enriched.branch,
        roomNumber: enriched.roomNumber,
        bedLabel: enriched.bedLabel,
        tenantStatus: enriched.tenantStatus,
        balance: enriched.balance
      };
    });

    const candidates = await Promise.all(candidatePromises);

    return {
      found: true,
      isMultiple: true,
      count: matchedUsers.length,
      searchTarget,
      candidates,
      message: `Found ${matchedUsers.length} tenants matching "${searchTarget}". Please select one to view full details.`
    };
  } catch (error) {
    console.error("Error in searchByTenantIdentifier:", error);
    return { found: false, error: error.message };
  }
}

/**
 * Enriches a User record with Room, Bed, Billing Balance, and Maintenance tickets
 */
async function enrichTenantProfile(user, preloadedRoom = null) {
  const userId = user._id;
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.email || "Tenant";

  let roomNumber = "Unassigned";
  let bedLabel = "N/A";
  let roomType = "N/A";
  let branchName = user.branch || "General";
  let roomId = null;

  // 1. Locate Room and Bed
  if (preloadedRoom) {
    roomNumber = preloadedRoom.roomNumber;
    roomId = preloadedRoom._id;
    branchName = preloadedRoom.branch;
    roomType = preloadedRoom.type;
    const matchingBed = (preloadedRoom.beds || []).find((b) => String(b?.occupiedBy?.userId) === String(userId));
    if (matchingBed) {
      bedLabel = `Bed ${matchingBed.code || matchingBed.bunkBlock || matchingBed.position || "1"}`;
    }
  } else {
    // Find room where user is assigned
    const room = await Room.findOne({
      "beds.occupiedBy.userId": userId,
      isArchived: { $ne: true }
    }).lean();

    if (room) {
      roomNumber = room.roomNumber;
      roomId = room._id;
      branchName = room.branch;
      roomType = room.type;
      const matchingBed = (room.beds || []).find((b) => String(b?.occupiedBy?.userId) === String(userId));
      if (matchingBed) {
        bedLabel = `Bed ${matchingBed.code || matchingBed.bunkBlock || matchingBed.position || "1"}`;
      }
    } else {
      // Fallback to active reservation
      const reservation = await Reservation.findOne({
        user: userId,
        status: { $in: ["approved", "checked_in", "active"] },
        isArchived: { $ne: true }
      }).populate("roomId").lean();

      if (reservation?.roomId) {
        roomNumber = reservation.roomId.roomNumber || "Assigned";
        roomId = reservation.roomId._id;
        branchName = reservation.branch || reservation.roomId.branch || branchName;
        roomType = reservation.roomId.type || roomType;
        if (reservation.bedId) {
          bedLabel = `Bed ${reservation.bedId}`;
        }
      }
    }
  }

  // 2. Billing & Balance Aggregation
  let totalBalance = 0;
  let hasOverdue = false;
  let latestRentAmount = 0;

  try {
    const bills = await Bill.find({
      userId: userId,
      publicationState: "published",
      status: { $in: ["pending", "partially-paid", "overdue"] },
      isArchived: { $ne: true }
    }).select("totalAmount remainingAmount charges status dueDate").lean();

    for (const b of bills) {
      const remaining = typeof b.remainingAmount === "number" ? b.remainingAmount : (b.totalAmount || 0);
      totalBalance += remaining;
      if (b.status === "overdue" || (b.dueDate && new Date(b.dueDate) < new Date())) {
        hasOverdue = true;
      }
      if (b.charges?.rent && b.charges.rent > latestRentAmount) {
        latestRentAmount = b.charges.rent;
      }
    }
  } catch (billErr) {
    console.warn("Could not aggregate bills for tenant lookup:", billErr?.message);
  }

  // 3. Maintenance Tickets Count
  let openMaintenanceCount = 0;
  try {
    openMaintenanceCount = await MaintenanceRequest.countDocuments({
      userId: userId,
      status: { $in: ["pending", "in_progress", "scheduled"] },
      isArchived: { $ne: true }
    });
  } catch (maintErr) {
    console.warn("Could not aggregate maintenance for tenant lookup:", maintErr?.message);
  }

  // 4. Normalized Tenant Status
  const rawStatus = user.tenantStatus || user.status || "active";
  const normalizedStatus = rawStatus === "active" ? "Active Tenant" :
    rawStatus === "applicant" ? "Applicant" :
    rawStatus === "inactive" ? "Inactive" :
    rawStatus === "moved_out" ? "Moved Out" :
    rawStatus === "evicted" ? "Evicted" :
    rawStatus === "blacklisted" ? "Blacklisted" : "Active Tenant";

  return {
    _id: user._id,
    userId: user.user_id || String(user._id).slice(-6).toUpperCase(),
    fullName,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "No email on file",
    phone: user.phone || "No phone on file",
    branch: branchName,
    roomNumber,
    roomId,
    bedLabel,
    roomType,
    profileImage: user.profileImage || null,
    tenantStatus: normalizedStatus,
    rawStatus,
    monthlyRent: latestRentAmount,
    balance: totalBalance,
    hasOverdue,
    openMaintenanceCount,
    isSettled: totalBalance === 0
  };
}
