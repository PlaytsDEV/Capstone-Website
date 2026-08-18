import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";

/**
 * Standard CSV column configurations for Visit Schedules export.
 */
export const VISIT_SCHEDULE_CSV_COLUMNS = [
  { key: "reservationCode", label: "Reservation Code" },
  { key: "visitorName", label: "Visitor Name" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Phone Number" },
  { key: "branch", label: "Branch" },
  { key: "room", label: "Room" },
  { key: "scheduledDate", label: "Requested Date" },
  { key: "visitDate", label: "Visit Appointment Date" },
  { key: "visitTime", label: "Visit Time Slot" },
  { key: "status", label: "Status" },
  { key: "actionedAt", label: "Actioned Date" },
];

/**
 * Format a raw date string/object to YYYY-MM-DD cleanly.
 */
function formatDate(dateValue) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

/**
 * Format date and time for display in exports.
 */
function formatDateTime(dateValue) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Generate a clean date slug for export filenames (YYYY-MM-DD).
 */
function getFilenameDateSlug() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Sanitize branch name for filename slug.
 */
function sanitizeSlug(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "all";
}

/**
 * Get readable label for visit status.
 */
export function getVisitStatusLabel(row) {
  if (row.isHistorical) {
    const historyMap = {
      schedule_approved: "Sched. Approved",
      approved: "Completed",
      completed: "Completed",
      rejected: "Rejected",
      no_show: "No-Show",
      cancelled: "Cancelled",
      visit_cancelled: "Cancelled",
      pending: "Scheduled",
    };
    return historyMap[row.historyStatus] || "Historical Visit";
  }
  if (row.scheduleRejected) return "Rejected";
  if (row.visitApproved || row.visitStatus === "visit_completed") return "Visit Completed";
  if (row.visitStatus === "no_show") return "No-Show";
  return "Awaiting Visit";
}

/**
 * Prepare CSV data rows from filtered visit schedules array.
 */
export function formatVisitSchedulesForCSV(schedules = []) {
  return schedules.map((row) => ({
    reservationCode: row.reservationCode || "—",
    visitorName: row.customer || "Unknown",
    email: row.email || "—",
    phone: row.phone || "—",
    branch: row.branch || "—",
    room: row.room || "—",
    scheduledDate: formatDateTime(row.scheduledDate),
    visitDate: formatDate(row.visitDate),
    visitTime: row.visitTime || "—",
    status: getVisitStatusLabel(row),
    actionedAt: formatDateTime(row.actionedAt),
  }));
}

/**
 * Triggers CSV export for filtered visit schedules.
 */
export function handleExportVisitSchedulesCSV({ schedules = [], branchFilter = "all" }) {
  const data = formatVisitSchedulesForCSV(schedules);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Visit_Schedules_${branchSlug}_${dateSlug}`;

  exportToCSV(data, VISIT_SCHEDULE_CSV_COLUMNS, filename);
}

/**
 * Triggers branded PDF report export for filtered visit schedules.
 */
export async function handleExportVisitSchedulesPDF({
  schedules = [],
  counts = {},
  branchFilter = "all",
  activeFilterLabel = "All Visits",
  searchTerm = "",
}) {
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Visit_Schedules_${branchSlug}_${dateSlug}.pdf`;

  // Build KPI summary cards matching current counts
  const kpis = [
    { label: "TOTAL VISITS", value: String(counts.total || schedules.length), format: "number" },
    { label: "AWAITING VISIT", value: String(counts.awaitingVisit || 0), format: "number" },
    { label: "COMPLETED", value: String(counts.completed || 0), format: "number" },
    { label: "NO-SHOW", value: String(counts.noShows || 0), format: "number" },
    { label: "REJECTED", value: String(counts.rejected || 0), format: "number" },
    { label: "CANCELLED", value: String(counts.cancelled || 0), format: "number" },
  ];

  // Map visit schedule rows for jsPDF table rendering
  const tableRows = schedules.map((row) => ({
    Visitor: row.customer || "Unknown",
    Branch: row.branch || "—",
    Room: row.room || "—",
    Requested: formatDate(row.scheduledDate),
    Appointment: row.visitDate ? `${formatDate(row.visitDate)} ${row.visitTime || ""}`.trim() : "—",
    Status: getVisitStatusLabel(row),
  }));

  const activeBranchLabel =
    branchFilter === "all" ? "All Branches" : branchFilter;
  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    `Filter: ${activeFilterLabel}`,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await exportReportPdf({
    title: "Visit Schedules Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    reportType: "Visit Schedules",
    kpis,
    sections: [
      {
        type: "table",
        title: "Filtered Visit Schedules",
        description: `Export containing ${schedules.length} visit schedule records matching the active filter criteria.`,
        headers: ["Visitor", "Branch", "Room", "Requested", "Appointment", "Status"],
        colWidths: [36, 22, 22, 23, 45, 30],
        rows: tableRows,
      },
    ],
  });
}
