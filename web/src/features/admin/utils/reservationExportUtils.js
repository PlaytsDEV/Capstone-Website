import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import {
  RESERVATION_STATUS_LABELS,
  readMoveInDate,
} from "../../../shared/utils/lifecycleNaming.js";

/**
 * Standard CSV column configurations for reservations export.
 */
export const RESERVATION_CSV_COLUMNS = [
  { key: "reservationCode", label: "Reservation Code" },
  { key: "applicant", label: "Applicant Name" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Mobile Phone" },
  { key: "branch", label: "Branch" },
  { key: "room", label: "Room" },
  { key: "roomType", label: "Room Type" },
  { key: "status", label: "Status" },
  { key: "moveInDate", label: "Move-In Date" },
  { key: "leaseDuration", label: "Lease Duration" },
  { key: "paymentStatus", label: "Payment Status" },
  { key: "createdAt", label: "Date Applied" },
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
 * Prepare CSV data rows from filtered reservations array.
 */
export function formatReservationsForCSV(reservations = []) {
  return reservations.map((res) => {
    const rawMoveIn = readMoveInDate(res);
    const statusLabel =
      RESERVATION_STATUS_LABELS[res.status] || res.status || "Unknown";

    return {
      reservationCode: res.reservationCode || "—",
      applicant: res.customer || `${res.firstName || ""} ${res.lastName || ""}`.trim() || "Unknown",
      email: res.email || "—",
      phone: res.phone || res.mobileNumber || "—",
      branch: res.branch || "—",
      room: res.room || "—",
      roomType: res.roomType || "—",
      status: statusLabel,
      moveInDate: formatDate(rawMoveIn),
      leaseDuration: res.leaseDuration ? `${res.leaseDuration} Months` : "—",
      paymentStatus: res.paymentStatus ? res.paymentStatus.toUpperCase() : "—",
      createdAt: formatDate(res.createdAt),
    };
  });
}

/**
 * Triggers CSV export for filtered reservations.
 */
export function handleExportReservationsCSV({ reservations, branchFilter = "all" }) {
  const data = formatReservationsForCSV(reservations);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Reservations_${branchSlug}_${dateSlug}`;

  exportToCSV(data, RESERVATION_CSV_COLUMNS, filename);
}

/**
 * Triggers branded PDF report export for filtered reservations.
 */
export async function handleExportReservationsPDF({
  reservations = [],
  counts = {},
  branchFilter = "all",
  statusFilter = "all",
  searchTerm = "",
}) {
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Reservations_${branchSlug}_${dateSlug}.pdf`;

  // Build KPI summary cards matching current counts
  const kpis = [
    { label: "TOTAL RECORDS", value: String(reservations.length), format: "number" },
    { label: "PENDING REVIEW", value: String(counts.pendingApplicationReview || 0), format: "number" },
    { label: "APPROVED PAYMENT", value: String(counts.approvedForPayment || 0), format: "number" },
    { label: "RESERVED", value: String(counts.reserved || 0), format: "number" },
    { label: "MOVE IN", value: String(counts.movedIn || 0), format: "number" },
    { label: "CANCELLED", value: String(counts.cancelled || 0), format: "number" },
  ];

  // Map reservation rows for jsPDF table rendering
  const tableRows = reservations.map((res) => {
    const rawMoveIn = readMoveInDate(res);
    const statusLabel =
      RESERVATION_STATUS_LABELS[res.status] || res.status || "Unknown";

    return {
      Code: res.reservationCode || "—",
      Applicant: res.customer || "Unknown",
      Branch: res.branch || "—",
      Room: res.room || "—",
      Status: statusLabel,
      "Move In": formatDate(rawMoveIn),
      Created: formatDate(res.createdAt),
    };
  });

  const activeBranchLabel =
    branchFilter === "all" ? "All Branches" : branchFilter;
  const activeStatusLabel =
    statusFilter === "all" ? "All Statuses" : statusFilter;
  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    `Status Filter: ${activeStatusLabel}`,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await exportReportPdf({
    title: "Reservations Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    period: `Generated on ${new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`,
    reportType: "Reservations",
    kpis,
    sections: [
      {
        type: "table",
        title: "Filtered Reservations List",
        description: `Export containing ${reservations.length} reservation records matching the active filter criteria.`,
        headers: ["Code", "Applicant", "Branch", "Room", "Status", "Move In", "Created"],
        colWidths: [26, 42, 24, 20, 26, 18, 18],
        rows: tableRows,
      },
    ],
  });
}
