import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { formatAnnouncementBranch, formatAnnouncementCategory } from "../../../shared/utils/announcementConfig.js";

/**
 * Standard CSV column configurations for Announcements and Policies export.
 */
export const ANNOUNCEMENT_CSV_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "contentType", label: "Record Type" },
  { key: "category", label: "Category" },
  { key: "targetBranch", label: "Target Audience / Branch" },
  { key: "publicationStatus", label: "Status" },
  { key: "startsAt", label: "Starts At" },
  { key: "endsAt", label: "Ends At" },
  { key: "policyKey", label: "Policy Key" },
  { key: "version", label: "Version" },
  { key: "effectiveDate", label: "Effective Date" },
  { key: "isPinned", label: "Is Pinned" },
  { key: "requiresAcknowledgment", label: "Requires Acknowledgment" },
  { key: "acknowledgmentCount", label: "Acknowledgments" },
  { key: "recipientCount", label: "Recipients" },
  { key: "acknowledgmentCompletionPercent", label: "Completion Rate" },
  { key: "createdAt", label: "Created Date" },
];

/**
 * Format date cleanly as YYYY-MM-DD.
 */
function formatDate(dateValue) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
    if (Number.isNaN(d.getTime())) return "—";
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
 * Sanitize string for filename slug.
 */
function sanitizeSlug(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "all";
}

/**
 * Format raw announcement list for CSV download.
 */
export function formatAnnouncementsForCSV(announcements = []) {
  return announcements.map((a) => ({
    title: a.title || "Untitled",
    contentType: a.contentType === "policy" ? "Official Policy" : "General Notice",
    category: formatAnnouncementCategory(a.category),
    targetBranch: formatAnnouncementBranch(a.targetBranch),
    publicationStatus:
      a.publicationStatus === "published"
        ? "Published"
        : a.publicationStatus === "scheduled"
          ? "Scheduled"
          : "Draft",
    startsAt: formatDateTime(a.startsAt),
    endsAt: formatDateTime(a.endsAt),
    policyKey: a.policyKey || "—",
    version: a.version || (a.contentType === "policy" ? 1 : "—"),
    effectiveDate: formatDate(a.effectiveDate),
    isPinned: a.isPinned ? "Yes" : "No",
    requiresAcknowledgment: a.requiresAcknowledgment ? "Yes" : "No",
    acknowledgmentCount: a.acknowledgmentCount || 0,
    recipientCount: a.recipientCount || 0,
    acknowledgmentCompletionPercent: `${a.acknowledgmentCompletionPercent || 0}%`,
    createdAt: formatDateTime(a.createdAt),
  }));
}

/**
 * Triggers CSV export for announcements.
 */
export function handleExportAnnouncementsCSV({
  announcements = [],
  branchFilter = "all",
}) {
  const data = formatAnnouncementsForCSV(announcements);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Announcements_${branchSlug}_${dateSlug}`;

  exportToCSV(data, ANNOUNCEMENT_CSV_COLUMNS, filename);
}

/**
 * Triggers branded PDF report export for announcements.
 */
export async function handleExportAnnouncementsPDF({
  announcements = [],
  stats = {},
  branchFilter = "all",
  statusFilter = "all",
  searchTerm = "",
}) {
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Announcements_${branchSlug}_${dateSlug}.pdf`;

  const kpis = [
    { label: "TOTAL BROADCASTS", value: String(announcements.length), format: "number" },
    { label: "ACTIVE NOTICES", value: String(stats.active ?? stats.published ?? 0), format: "number" },
    { label: "SCHEDULED NOTICES", value: String(stats.scheduled ?? 0), format: "number" },
    { label: "TOTAL DRAFTS", value: String(stats.drafts ?? stats.draft ?? 0), format: "number" },
  ];

  const tableRows = announcements.map((a) => ({
    Title: a.title || "Untitled",
    Type: a.contentType === "policy" ? "Policy" : "Notice",
    Category: formatAnnouncementCategory(a.category),
    Branch: formatAnnouncementBranch(a.targetBranch),
    Status:
      a.publicationStatus === "published"
        ? "Published"
        : a.publicationStatus === "scheduled"
          ? "Scheduled"
          : "Draft",
    "Effective / Start": formatDate(a.startsAt || a.effectiveDate || a.createdAt),
    Pinned: a.isPinned ? "Yes" : "No",
    "Ack Rate": a.requiresAcknowledgment
      ? `${a.acknowledgmentCount || 0}/${a.recipientCount || 0} (${a.acknowledgmentCompletionPercent || 0}%)`
      : "N/A",
  }));

  const activeBranchLabel = branchFilter === "all" ? "All Branches" : branchFilter;
  const activeStatusLabel = statusFilter === "all" ? "All Statuses" : statusFilter;
  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    `Status: ${activeStatusLabel}`,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await exportReportPdf({
    title: "Announcements & Policy Broadcasts Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    period: `Generated on ${new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`,
    reportType: "Announcements",
    kpis,
    sections: [
      {
        type: "table",
        title: "Announcements & Policy Records List",
        description: `Official management report containing ${announcements.length} broadcast records matching active filters.`,
        headers: ["Title", "Type", "Category", "Branch", "Status", "Effective / Start", "Pinned", "Ack Rate"],
        colWidths: [44, 18, 22, 26, 20, 24, 16, 28],
        rows: tableRows,
      },
    ],
  });
}
