import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { showNotification } from "../../../shared/utils/notification.js";

/**
 * Standard CSV column configurations for User Accounts export.
 */
export const USER_CSV_COLUMNS = [
  { key: "fullName", label: "Full Name" },
  { key: "username", label: "Username" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Phone Number" },
  { key: "role", label: "Role" },
  { key: "branch", label: "Branch Assignment" },
  { key: "status", label: "Account Status" },
  { key: "createdAt", label: "Date Created" },
];

/**
 * Human-readable role label formatter.
 */
export function formatUserRoleLabel(role = "") {
  if (!role) return "Applicant";
  const map = {
    owner: "Owner",
    branch_admin: "Branch Admin",
    tenant: "Tenant",
    applicant: "Applicant",
  };
  if (map[role]) return map[role];
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Human-readable branch label formatter.
 */
export function formatUserBranchLabel(branch = "") {
  if (!branch) return "Unassigned";
  if (branch === "gil-puyat") return "Gil Puyat";
  if (branch === "guadalupe") return "Guadalupe";
  return branch.charAt(0).toUpperCase() + branch.slice(1);
}

/**
 * Human-readable account status label formatter.
 */
export function formatUserStatusLabel(user = {}) {
  if (user.isArchived) return "Archived";
  const rawStatus = user.accountStatus || (user.isActive !== false ? "active" : "suspended");
  const map = {
    active: "Active",
    suspended: "Suspended",
    banned: "Blocked",
    restricted: "Suspended / Blocked",
    pending_verification: "Pending Verification",
    archived: "Archived",
  };
  if (map[rawStatus]) return map[rawStatus];
  return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
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
 * Prepare CSV data rows from filtered users array.
 */
export function formatUsersForCSV(users = []) {
  return users.map((u) => {
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || "—";
    return {
      fullName,
      username: u.username || "—",
      email: u.email || "—",
      phone: u.phone || "—",
      role: formatUserRoleLabel(u.role),
      branch: formatUserBranchLabel(u.branch),
      status: formatUserStatusLabel(u),
      createdAt: formatDate(u.createdAt),
    };
  });
}

/**
 * Triggers CSV export for filtered user accounts.
 */
export function handleExportUsersCSV({ users = [], branchFilter = "all" }) {
  if (!users || users.length === 0) {
    showNotification("No user accounts available to export.", "warning", 3000);
    return;
  }

  const data = formatUsersForCSV(users);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Users_${branchSlug}_${dateSlug}`;

  exportToCSV(data, USER_CSV_COLUMNS, filename);
  showNotification(`Successfully exported ${users.length} user accounts to CSV`, "success", 3000);
}

/**
 * Triggers branded PDF report export for filtered user accounts.
 */
export async function handleExportUsersPDF({
  users = [],
  stats = {},
  branchFilter = "all",
  roleFilter = "all",
  statusFilter = "all",
  searchTerm = "",
}) {
  if (!users || users.length === 0) {
    showNotification("No user accounts available to export.", "warning", 3000);
    return;
  }

  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Users_${branchSlug}_${dateSlug}.pdf`;

  // Calculate stats from stats object or from active users dataset
  const totalCount = stats.total ?? users.length;
  const activeCount =
    stats.activeCount ??
    users.filter((u) => !u.isArchived && (u.accountStatus === "active" || (u.isActive !== false && !u.accountStatus))).length;
  const adminCount =
    (stats.byRole?.branch_admin || 0) + (stats.byRole?.owner || 0) ||
    users.filter((u) => u.role === "branch_admin" || u.role === "owner").length;
  const suspendedBlockedCount =
    (stats.byAccountStatus?.suspended || 0) + (stats.byAccountStatus?.banned || 0) ||
    users.filter((u) => u.accountStatus === "suspended" || u.accountStatus === "banned" || u.isActive === false).length;
  const archivedCount =
    stats.archivedCount ?? users.filter((u) => u.isArchived === true).length;

  const kpis = [
    { label: "TOTAL ACCOUNTS", value: String(totalCount), format: "number" },
    { label: "ACTIVE ACCOUNTS", value: String(activeCount), format: "number" },
    { label: "ADMIN ACCOUNTS", value: String(adminCount), format: "number" },
    { label: "SUSPENDED / BLOCKED", value: String(suspendedBlockedCount), format: "number" },
    { label: "ARCHIVED ACCOUNTS", value: String(archivedCount), format: "number" },
  ];

  const tableRows = users.map((u) => {
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || "—";
    return {
      "Full Name": fullName,
      Username: u.username || "—",
      Email: u.email || "—",
      Phone: u.phone || "—",
      Role: formatUserRoleLabel(u.role),
      Branch: formatUserBranchLabel(u.branch),
      Status: formatUserStatusLabel(u),
      Created: formatDate(u.createdAt),
    };
  });

  const activeBranchLabel =
    !branchFilter || branchFilter === "all" ? "All Branches" : formatUserBranchLabel(branchFilter);
  const activeRoleLabel =
    !roleFilter || roleFilter === "all" ? "All Roles" : formatUserRoleLabel(roleFilter);
  const activeStatusLabel =
    !statusFilter || statusFilter === "all"
      ? "All Statuses"
      : statusFilter === "active"
      ? "Active"
      : statusFilter === "restricted"
      ? "Suspended / Blocked"
      : statusFilter === "archived"
      ? "Archived"
      : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    `Role: ${activeRoleLabel}`,
    `Status: ${activeStatusLabel}`,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await exportReportPdf({
    title: "User Accounts & Access Management Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    reportType: "User Accounts",
    orientation: "landscape",
    kpis,
    sections: [
      {
        type: "table",
        title: "Filtered User Accounts Registry",
        description: `Official management report containing ${users.length} account record(s) matching active search and filter criteria.`,
        headers: ["Full Name", "Username", "Email", "Phone", "Role", "Branch", "Status", "Created"],
        colWidths: [32, 22, 40, 24, 20, 20, 22, 22],
        rows: tableRows,
      },
    ],
  });

  showNotification(`Successfully exported user report to PDF`, "success", 3000);
}
