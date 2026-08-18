import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { getContractStage, formatContractValue } from "./contractUi.mjs";

/**
 * Standard CSV column definitions for Contracts export.
 */
export const CONTRACT_CSV_COLUMNS = [
  { key: "contractNumber", label: "Contract No." },
  { key: "tenantLegalName", label: "Tenant Name" },
  { key: "branch", label: "Branch" },
  { key: "roomNumber", label: "Room" },
  { key: "bedLabel", label: "Bed Slot" },
  { key: "roomType", label: "Room Type" },
  { key: "status", label: "Contract Stage" },
  { key: "durationMonths", label: "Lease Duration (Months)" },
  { key: "monthlyRate", label: "Monthly Rent (PHP)" },
  { key: "startDate", label: "Lease Start Date" },
  { key: "endDate", label: "Lease End Date" },
  { key: "createdAt", label: "Date Created" },
];

/**
 * Format date cleanly as YYYY-MM-DD.
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
 * Clean date slug for filenames.
 */
function getFilenameDateSlug() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Format raw contracts list for CSV download.
 */
export function formatContractsForCSV(contracts = []) {
  return contracts.map((c) => ({
    contractNumber: c.contractNumber || "Pending",
    tenantLegalName: c.tenantLegalName || c.tenantName || "Unknown",
    branch: formatContractValue(c.branch),
    roomNumber: c.roomNumber || "—",
    bedLabel: c.bedLabel || "—",
    roomType: c.roomType || "—",
    status: getContractStage(c.status),
    durationMonths: c.durationMonths || c.leaseDurationMonths || "—",
    monthlyRate: c.monthlyRate || c.approvedMonthlyRate || 0,
    startDate: formatDate(c.startDate || c.leaseStartDate),
    endDate: formatDate(c.endDate || c.leaseEndDate),
    createdAt: formatDate(c.createdAt),
  }));
}

/**
 * Triggers CSV export for filtered contracts.
 */
export function handleExportContractsCSV({ contracts = [], branchFilter = "all" }) {
  const data = formatContractsForCSV(contracts);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = branchFilter === "all" ? "all" : branchFilter.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const filename = `Lilycrest_Contracts_${branchSlug}_${dateSlug}`;

  exportToCSV(data, CONTRACT_CSV_COLUMNS, filename);
}

/**
 * Triggers branded PDF report export for filtered contracts.
 */
export async function handleExportContractsPDF({
  contracts = [],
  counts = {},
  branchFilter = "all",
  statusFilter = "all",
  searchTerm = "",
}) {
  const dateSlug = getFilenameDateSlug();
  const branchSlug = branchFilter === "all" ? "all" : branchFilter.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const filename = `Lilycrest_Contracts_${branchSlug}_${dateSlug}.pdf`;

  const kpis = [
    { label: "TOTAL CONTRACTS", value: String(contracts.length), format: "number" },
    { label: "DRAFT / PENDING", value: String(counts.draft || 0), format: "number" },
    { label: "GENERATED", value: String(counts.generated || 0), format: "number" },
    { label: "SIGNED & ACTIVE", value: String(counts.signed || counts.active || 0), format: "number" },
    { label: "ARCHIVED / VOID", value: String(counts.archived || 0), format: "number" },
  ];

  const tableRows = contracts.map((c) => ({
    "Contract No.": c.contractNumber || "Pending",
    Tenant: c.tenantLegalName || c.tenantName || "Unknown",
    Branch: formatContractValue(c.branch),
    Room: `${c.roomNumber || "—"}${c.bedLabel ? ` (${c.bedLabel})` : ""}`,
    Stage: getContractStage(c.status),
    "Start Date": formatDate(c.startDate || c.leaseStartDate),
    "End Date": formatDate(c.endDate || c.leaseEndDate),
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
    title: "Contracts Management Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    reportType: "Contracts",
    kpis,
    sections: [
      {
        type: "table",
        title: "Filtered Lease Contracts List",
        description: `Export containing ${contracts.length} contract records matching the active filter criteria.`,
        headers: ["Contract No.", "Tenant", "Branch", "Room", "Stage", "Start Date", "End Date"],
        colWidths: [26, 36, 21, 24, 25, 23, 23],
        rows: tableRows,
      },
    ],
  });
}
