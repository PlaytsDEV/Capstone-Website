import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";

/**
 * Standard CSV column configurations for Inquiries export.
 */
export const INQUIRY_CSV_COLUMNS = [
  { key: "name", label: "Inquirer Name" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Phone Number" },
  { key: "branch", label: "Preferred Branch" },
  { key: "roomType", label: "Preferred Room Type" },
  { key: "source", label: "Acquisition Source" },
  { key: "sourceNote", label: "Source Note" },
  { key: "status", label: "Status" },
  { key: "viewingDate", label: "Viewing Date" },
  { key: "viewingTime", label: "Viewing Time" },
  { key: "createdAt", label: "Date Submitted" },
  { key: "message", label: "Inquiry Message" },
  { key: "notes", label: "Admin Notes" },
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
 * Human-readable room type label formatter.
 */
function formatRoomTypeLabel(roomType = "") {
  if (!roomType) return "General / Unspecified";
  const map = {
    quadruple_sharing: "Quadruple Sharing",
    double_sharing: "Double Sharing",
    private_room: "Private Room",
  };
  if (map[roomType]) return map[roomType];
  return roomType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Human-readable status label formatter.
 */
export function getInquiryStatusLabel(inquiry = {}) {
  const status = inquiry.viewingStatus || inquiry.status || "new";
  const map = {
    new: "New / Pending",
    pending: "New / Pending",
    viewing_scheduled: "Viewing Scheduled",
    viewing_completed: "Viewing Completed",
    viewing_waived: "Viewing Waived",
    converted_to_application: "Converted",
    resolved: "Responded",
    closed: "Closed",
  };
  if (map[status]) return map[status];
  if (inquiry.adminResponse) return "Responded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Human-readable marketing source formatter.
 */
function formatSourceLabel(source = "") {
  if (!source) return "Direct / Website";
  const map = {
    website: "Website",
    facebook: "Facebook",
    tiktok: "TikTok",
    instagram: "Instagram",
    text_message: "Text Message",
    walk_in: "Walk-in",
    building_signage: "Building Signage",
    referral: "Referral",
    other: "Other",
  };
  return map[source] || source;
}

/**
 * Prepare CSV data rows from filtered inquiries array.
 */
export function formatInquiriesForCSV(inquiries = []) {
  return inquiries.map((inq) => ({
    name: inq.fullName || inq.name || inq.inquiryName || "Unknown",
    email: inq.email || "—",
    phone: inq.contactNumber || inq.phone || inq.inquiryPhone || "—",
    branch: inq.preferredBranch || inq.branch || "—",
    roomType: formatRoomTypeLabel(inq.preferredRoomType || inq.roomType),
    source: formatSourceLabel(inq.source),
    sourceNote: inq.sourceNote || "—",
    status: getInquiryStatusLabel(inq),
    viewingDate: formatDate(inq.viewingDate),
    viewingTime: inq.viewingTime || "—",
    createdAt: formatDateTime(inq.createdAt || inq.date),
    message: inq.message || "—",
    notes: inq.notes || inq.adminResponse || "—",
  }));
}

/**
 * Triggers CSV export for filtered inquiries.
 */
export function handleExportInquiriesCSV({ inquiries = [], branchFilter = "all" }) {
  const data = formatInquiriesForCSV(inquiries);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Inquiries_${branchSlug}_${dateSlug}`;

  exportToCSV(data, INQUIRY_CSV_COLUMNS, filename);
}

/**
 * Triggers branded PDF report export for filtered inquiries.
 */
export async function handleExportInquiriesPDF({
  inquiries = [],
  counts = {},
  branchFilter = "all",
  statusFilter = "",
  searchTerm = "",
}) {
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Inquiries_${branchSlug}_${dateSlug}.pdf`;

  // Calculate stats if counts object is partially supplied
  const totalCount = counts.total ?? inquiries.length;
  const pendingCount =
    counts.pending ??
    inquiries.filter((i) => !i.adminResponse && (i.viewingStatus === "new" || !i.viewingStatus)).length;
  const respondedCount =
    counts.resolved ??
    inquiries.filter((i) => Boolean(i.adminResponse) || i.viewingStatus === "resolved").length;
  const convertedCount =
    counts.converted ??
    inquiries.filter((i) => i.viewingStatus === "converted_to_application").length;

  // Build KPI summary cards
  const kpis = [
    { label: "TOTAL INQUIRIES", value: String(totalCount), format: "number" },
    { label: "NEW / PENDING", value: String(pendingCount), format: "number" },
    { label: "RESPONDED", value: String(respondedCount), format: "number" },
    { label: "CONVERTED", value: String(convertedCount), format: "number" },
  ];

  // Map inquiry rows for jsPDF table rendering
  const tableRows = inquiries.map((inq) => {
    const rawMsg = inq.message || "—";
    const truncatedMsg = rawMsg.length > 60 ? `${rawMsg.slice(0, 57)}...` : rawMsg;

    return {
      Inquirer: inq.fullName || inq.name || inq.inquiryName || "Unknown",
      Branch: inq.preferredBranch || inq.branch || "—",
      "Room Interest": formatRoomTypeLabel(inq.preferredRoomType || inq.roomType),
      Source: formatSourceLabel(inq.source),
      Status: getInquiryStatusLabel(inq),
      Submitted: formatDate(inq.createdAt || inq.date),
      Message: truncatedMsg,
    };
  });

  const activeBranchLabel =
    !branchFilter || branchFilter === "all" ? "All Branches" : branchFilter;
  const activeStatusLabel =
    !statusFilter || statusFilter === ""
      ? "All Statuses"
      : statusFilter === "pending"
      ? "Pending"
      : statusFilter === "resolved"
      ? "Responded"
      : statusFilter;

  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    `Status: ${activeStatusLabel}`,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await exportReportPdf({
    title: "Inquiries & Lead Acquisition Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    reportType: "Inquiries",
    orientation: "landscape",
    kpis,
    sections: [
      {
        type: "table",
        title: "Filtered Inquiry Records",
        description: `Export containing ${inquiries.length} inquiry record(s) matching active search and filter criteria.`,
        headers: ["Inquirer", "Branch", "Room Interest", "Source", "Status", "Submitted", "Message"],
        colWidths: [34, 22, 28, 20, 24, 24, 55],
        rows: tableRows,
      },
    ],
  });
}
