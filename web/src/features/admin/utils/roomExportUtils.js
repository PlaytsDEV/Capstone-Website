import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { showNotification } from "../../../shared/utils/notification.js";
import { formatBranch, formatRoomType, fmtCurrency } from "./formatters.js";

/**
 * Standard CSV column configurations for Room Management export.
 */
export const ROOM_CSV_COLUMNS = [
  { key: "roomNumber", label: "Room Number" },
  { key: "roomName", label: "Room Name" },
  { key: "branch", label: "Branch" },
  { key: "floor", label: "Floor" },
  { key: "type", label: "Room Type" },
  { key: "capacity", label: "Total Capacity (Beds)" },
  { key: "occupiedBeds", label: "Occupied Beds" },
  { key: "availableBeds", label: "Available Beds" },
  { key: "maintenanceBeds", label: "Maintenance Beds" },
  { key: "occupancyRatio", label: "Occupancy Ratio" },
  { key: "occupancyRate", label: "Occupancy Rate (%)" },
  { key: "status", label: "Status" },
  { key: "monthlyRent", label: "Monthly Rent (PHP)" },
  { key: "intendedTenant", label: "Intended Tenant" },
  { key: "amenities", label: "Amenities" },
];

/**
 * Compute bed-accurate effective occupancy for a room.
 */
export function getEffectiveOccupancy(room) {
  if (!room) return 0;
  const occupiedFromBeds = (room.beds || []).filter(
    (b) => b.status === "occupied" || b.status === "reserved" || Boolean(b.occupiedBy?.userId),
  ).length;
  return Math.max(Number(room.currentOccupancy || 0), occupiedFromBeds);
}

/**
 * Compute standardized status label for a room.
 */
export function getRoomStatusLabel(room) {
  if (!room) return "Unknown";
  const beds = room.beds || [];
  const bedsInMaintenance = beds.filter((b) => b.status === "maintenance").length;
  const roomCapacity = Number(room.capacity || 0);
  const roomLevelMaintenance = bedsInMaintenance === roomCapacity && roomCapacity > 0;
  const effectiveCapacity = roomLevelMaintenance ? 0 : Math.max(0, roomCapacity - bedsInMaintenance);
  const occupiedCount = getEffectiveOccupancy(room);

  if (roomLevelMaintenance || room.status === "maintenance" || (roomCapacity > 0 && effectiveCapacity === 0)) {
    return "Maintenance";
  }
  if (occupiedCount >= effectiveCapacity && effectiveCapacity > 0) {
    return "Full";
  }
  if (occupiedCount > 0) {
    return "Partial";
  }
  return "Available";
}

/**
 * Format a raw date string/object to YYYY-MM-DD cleanly.
 */
export function formatDate(dateValue) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

/**
 * Generate a clean date slug for export filenames (YYYY-MM-DD).
 */
export function getFilenameDateSlug() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Sanitize branch name for filename slug.
 */
export function sanitizeSlug(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "all";
}

/**
 * Prepare CSV data rows from filtered rooms array.
 */
export function formatRoomsForCSV(rooms = []) {
  return rooms.map((room) => {
    const beds = room.beds || [];
    const capacity = Number(room.capacity || 0);
    const occupied = getEffectiveOccupancy(room);
    const maintenanceBeds = beds.filter((b) => b.status === "maintenance").length;
    const availableBeds = Math.max(0, capacity - occupied - maintenanceBeds);
    const ratePercent = capacity > 0 ? ((occupied / capacity) * 100).toFixed(1) : "0.0";
    const monthlyPriceNum = Number(room.monthlyPrice || room.price || 0);

    const isPrivate = String(room.type || "").toLowerCase().includes("private");
    const ratioStr = isPrivate
      ? `${Math.min(1, occupied)}/1`
      : `${occupied}/${capacity}`;

    const tenantTarget = room.intendedTenant
      ? room.intendedTenant.charAt(0).toUpperCase() + room.intendedTenant.slice(1)
      : "Any / General";

    const amenitiesList =
      Array.isArray(room.amenities) && room.amenities.length > 0
        ? room.amenities.join("; ")
        : "Standard";

    return {
      roomNumber: room.roomNumber || "—",
      roomName: room.name || `Room ${room.roomNumber || "—"}`,
      branch: formatBranch(room.branch) || room.branch || "—",
      floor: room.floor !== undefined && room.floor !== null ? `Floor ${room.floor}` : "—",
      type: formatRoomType(room.type) || room.type || "—",
      capacity,
      occupiedBeds: occupied,
      availableBeds,
      maintenanceBeds,
      occupancyRatio: ratioStr,
      occupancyRate: `${ratePercent}%`,
      status: getRoomStatusLabel(room),
      monthlyRent: monthlyPriceNum.toFixed(2),
      intendedTenant: tenantTarget,
      amenities: amenitiesList,
    };
  });
}

/**
 * Triggers CSV export for filtered rooms.
 */
export function handleExportRoomsCSV({ rooms = [], branchFilter = "all" }) {
  if (!rooms || rooms.length === 0) {
    showNotification("No room inventory records match the current filter criteria.", "info", 3000);
    return;
  }

  const data = formatRoomsForCSV(rooms);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Rooms_${branchSlug}_${dateSlug}`;

  exportToCSV(data, ROOM_CSV_COLUMNS, filename);
  showNotification(`Successfully exported ${rooms.length} room inventory record(s) to CSV.`, "success", 3000);
}

/**
 * Triggers branded PDF report export for filtered rooms.
 */
export async function handleExportRoomsPDF({
  rooms = [],
  stats = {},
  branchFilter = "all",
  floorFilter = "all",
  roomTypeFilter = "all",
  roomStatusFilter = "all",
  searchTerm = "",
}) {
  if (!rooms || rooms.length === 0) {
    showNotification("No room records available to export for the active filters.", "info", 3000);
    return;
  }

  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Rooms_${branchSlug}_${dateSlug}.pdf`;

  // Compute stats if not fully passed
  const totalRooms = stats.total ?? rooms.length;
  const totalCapacity = stats.totalCapacity ?? rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);
  const totalOccupancy = stats.totalOccupancy ?? rooms.reduce((sum, r) => sum + getEffectiveOccupancy(r), 0);
  const availableCount = stats.available ?? rooms.filter((r) => getRoomStatusLabel(r) === "Available").length;
  const partialCount = stats.partial ?? rooms.filter((r) => getRoomStatusLabel(r) === "Partial").length;
  const fullCount = stats.full ?? rooms.filter((r) => getRoomStatusLabel(r) === "Full").length;
  const maintenanceCount = stats.maintenance ?? rooms.filter((r) => getRoomStatusLabel(r) === "Maintenance").length;
  const occupancyRate = totalCapacity > 0 ? ((totalOccupancy / totalCapacity) * 100).toFixed(1) : "0.0";

  const kpis = [
    { label: "TOTAL ROOMS", value: String(totalRooms), format: "number" },
    { label: "AVAILABLE", value: String(availableCount), format: "number" },
    { label: "PARTIAL", value: String(partialCount), format: "number" },
    { label: "FULL", value: String(fullCount), format: "number" },
    { label: "MAINTENANCE", value: String(maintenanceCount), format: "number" },
    { label: "TOTAL BEDS", value: `${totalCapacity}`, format: "number" },
    { label: "OCCUPANCY RATE", value: `${occupancyRate}%` },
  ];

  // Map room rows for PDF table (total colWidths = 174mm to perfectly match content width CW)
  const tableRows = rooms.map((room) => {
    const occupied = getEffectiveOccupancy(room);
    const capacity = Number(room.capacity || 0);
    const monthlyPrice = Number(room.monthlyPrice || room.price || 0);
    const isPrivate = String(room.type || "").toLowerCase().includes("private");
    const ratioStr = isPrivate
      ? `${Math.min(1, occupied)}/1`
      : `${occupied}/${capacity}`;

    return {
      "Room #": room.roomNumber || "—",
      "Room Name": room.name || `Room ${room.roomNumber || "—"}`,
      Branch: formatBranch(room.branch) || "—",
      Floor: room.floor !== undefined && room.floor !== null ? `Fl. ${room.floor}` : "—",
      Type: formatRoomType(room.type) || "—",
      Capacity: String(capacity),
      Occupied: ratioStr,
      Status: getRoomStatusLabel(room),
      "Monthly Rent": fmtCurrency(monthlyPrice),
    };
  });

  const activeBranchLabel =
    branchFilter === "all" ? "All Branches" : formatBranch(branchFilter);
  const activeFloorLabel =
    floorFilter === "all" ? "All Floors" : `Floor ${floorFilter}`;
  const activeTypeLabel =
    roomTypeFilter === "all" ? "All Types" : formatRoomType(roomTypeFilter);
  const activeStatusLabel =
    roomStatusFilter === "all"
      ? "All Statuses"
      : roomStatusFilter.charAt(0).toUpperCase() + roomStatusFilter.slice(1);

  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    floorFilter !== "all" ? `Floor: ${activeFloorLabel}` : null,
    roomTypeFilter !== "all" ? `Type: ${activeTypeLabel}` : null,
    roomStatusFilter !== "all" ? `Status: ${activeStatusLabel}` : null,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  await exportReportPdf({
    title: "Room Inventory & Capacity Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    reportType: "Room Inventory",
    orientation: "landscape",
    kpis,
    sections: [
      {
        type: "table",
        title: "Room Inventory & Occupancy Roster",
        description: `Official management report containing ${rooms.length} room inventory record(s) matching the active workspace filters.`,
        headers: [
          "Room #",
          "Room Name",
          "Branch",
          "Floor",
          "Type",
          "Capacity",
          "Occupied",
          "Status",
          "Monthly Rent",
        ],
        colWidths: [18, 34, 22, 16, 30, 18, 18, 24, 28],
        rows: tableRows,
      },
    ],
  });

  showNotification("Room inventory report generated as PDF successfully.", "success", 3000);
}
