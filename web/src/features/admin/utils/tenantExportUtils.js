import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { formatBranch } from "../utils/formatters.js";

/**
 * Standard CSV column configurations for Tenants Workspace export.
 */
export const TENANT_CSV_COLUMNS = [
  { key: "tenantName", label: "Tenant Name" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Mobile Phone" },
  { key: "branch", label: "Branch" },
  { key: "room", label: "Room" },
  { key: "bed", label: "Bed" },
  { key: "leaseEndDate", label: "Contract End Date" },
  { key: "daysUntilLeaseEnd", label: "Days Until End" },
  { key: "paymentStatus", label: "Billing Status" },
  { key: "leaseStatus", label: "Contract Status" },
  { key: "stayStatus", label: "Occupancy Status" },
  { key: "nextAction", label: "Next Action" },
];

/**
 * Cleanly format an ISO date string/timestamp into YYYY-MM-DD.
 */
export function formatDate(dateValue) {
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
 * Normalize and map tenant objects for CSV generation.
 */
export function formatTenantsForCSV(tenants = []) {
  return tenants.map((tenant) => {
    const email = tenant.contact?.email || tenant.email || "—";
    const phone = tenant.contact?.phone || tenant.phone || "—";
    const branchLabel = formatBranch(tenant.branch) || tenant.branch || "—";
    const daysRemaining =
      tenant.daysUntilLeaseEnd != null
        ? `${tenant.daysUntilLeaseEnd} day${tenant.daysUntilLeaseEnd === 1 ? "" : "s"}`
        : "—";

    return {
      tenantName: tenant.tenantName || "Unknown",
      email,
      phone,
      branch: branchLabel,
      room: tenant.room || "—",
      bed: tenant.bed || "—",
      leaseEndDate: formatDate(tenant.leaseEndDate),
      daysUntilLeaseEnd: daysRemaining,
      paymentStatus: (tenant.paymentStatus || "—").toUpperCase(),
      leaseStatus: (tenant.leaseStatus || "—").replace(/_/g, " ").toUpperCase(),
      stayStatus: (tenant.stayStatus || "—").replace(/_/g, " ").toUpperCase(),
      nextAction: tenant.nextActionLabel || tenant.nextAction || "—",
    };
  });
}

/**
 * Triggers CSV export for the current tenant directory.
 */
export function handleExportTenantsCSV({ tenants = [], branchFilter = "all" }) {
  const data = formatTenantsForCSV(tenants);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Tenants_${branchSlug}_${dateSlug}`;

  exportToCSV(data, TENANT_CSV_COLUMNS, filename);
}

/**
 * Triggers branded PDF report export for the current tenant directory.
 */
export async function handleExportTenantsPDF({
  tenants = [],
  summaryItems = [],
  branchFilter = "all",
  leaseStatusFilter = "all",
  paymentStatusFilter = "all",
  stayStatusFilter = "all",
  searchTerm = "",
}) {
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Tenants_${branchSlug}_${dateSlug}.pdf`;

  // Build KPI cards from summaryItems or compute fallbacks
  const kpis = summaryItems.length > 0
    ? summaryItems.map((item, idx) => ({
        label: String(item.label || "").toUpperCase(),
        value: String(item.value ?? "0"),
        highlight: idx === 0,
      }))
    : [
        { label: "TOTAL TENANTS", value: String(tenants.length), highlight: true },
        { label: "ACTIVE", value: String(tenants.filter((t) => t.stayStatus === "active").length) },
        { label: "EXPIRING SOON", value: String(tenants.filter((t) => t.leaseStatus === "expiring_soon").length) },
        { label: "OVERDUE", value: String(tenants.filter((t) => t.paymentStatus === "overdue").length) },
      ];

  // Map tenant rows for PDF table
  const tableRows = tenants.map((tenant) => ({
    Tenant: tenant.tenantName || "Unknown",
    Branch: formatBranch(tenant.branch) || "—",
    Room: `${tenant.room || "—"}${tenant.bed ? ` (${tenant.bed})` : ""}`,
    "Contract End": formatDate(tenant.leaseEndDate),
    Billing: (tenant.paymentStatus || "—").toUpperCase(),
    Contract: (tenant.leaseStatus || "—").replace(/_/g, " ").toUpperCase(),
    Occupancy: (tenant.stayStatus || "—").replace(/_/g, " ").toUpperCase(),
  }));

  const activeBranchLabel =
    branchFilter === "all" ? "All Branches" : formatBranch(branchFilter);
  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    leaseStatusFilter !== "all" ? `Contract: ${leaseStatusFilter}` : null,
    paymentStatusFilter !== "all" ? `Billing: ${paymentStatusFilter}` : null,
    stayStatusFilter !== "all" ? `Occupancy: ${stayStatusFilter}` : null,
    searchTerm ? `Search: "${searchTerm}"` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  await exportReportPdf({
    title: "Tenant Directory Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    reportType: "Tenants",
    orientation: "landscape",
    kpis,
    sections: [
      {
        type: "table",
        title: "Current Tenant Roster",
        description: `Listing ${tenants.length} tenant record(s) matching the active workspace filters.`,
        headers: ["Tenant", "Branch", "Room", "Contract End", "Billing", "Contract", "Occupancy"],
        colWidths: [38, 22, 28, 24, 26, 28, 28],
        rows: tableRows,
      },
    ],
  });
}
