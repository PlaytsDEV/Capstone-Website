import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { showNotification } from "../../../shared/utils/notification.js";
import {
  BRANCH_OPTIONS,
  BRANCH_DISPLAY_NAMES,
} from "../../../shared/utils/constants.js";
import {
  formatMaintenanceStatus,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../shared/utils/maintenanceConfig.js";

/**
 * Standard CSV column configurations for Maintenance Requests export.
 */
export const MAINTENANCE_CSV_COLUMNS = [
  { key: "requestId", label: "Request ID" },
  { key: "tenantName", label: "Tenant Name" },
  { key: "tenantPhone", label: "Tenant Phone" },
  { key: "tenantEmail", label: "Tenant Email" },
  { key: "branch", label: "Branch Assignment" },
  { key: "room", label: "Room / Unit" },
  { key: "requestType", label: "Service Category" },
  { key: "urgency", label: "Urgency Level" },
  { key: "stage", label: "Operational Stage" },
  { key: "status", label: "Detailed Status" },
  { key: "assignedProvider", label: "Assigned Contractor / Provider" },
  { key: "providerContact", label: "Contractor Contact Number" },
  { key: "actualCost", label: "Total Repair Cost (PHP)" },
  { key: "costAttribution", label: "Cost Attribution" },
  { key: "slaState", label: "SLA State" },
  { key: "description", label: "Issue Description" },
  { key: "adminNotes", label: "Admin / Work Log Notes" },
  { key: "submittedAt", label: "Submitted Date & Time" },
  { key: "scheduledDate", label: "Scheduled Servicing Date" },
  { key: "resolvedAt", label: "Resolution Date & Time" },
];

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
 * Format date and time for export reports (e.g., Nov 12, 2026, 2:30 PM).
 */
export function formatDateTime(dateValue) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Format currency amount cleanly to PHP 0.00.
 */
export function formatCurrencyAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return "0.00";
  return num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Clean date slug for export filenames (YYYY-MM-DD).
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
 * Formatter for branch display label.
 */
export function formatMaintenanceBranchLabel(branch = "") {
  if (!branch) return "Unassigned";
  if (BRANCH_DISPLAY_NAMES[branch]) return BRANCH_DISPLAY_NAMES[branch];
  if (branch === "gil-puyat") return "Gil Puyat";
  if (branch === "guadalupe") return "Guadalupe";
  const found = BRANCH_OPTIONS.find((b) => b.value === branch);
  if (found?.label) return found.label;
  return branch.charAt(0).toUpperCase() + branch.slice(1);
}

/**
 * Resolve tenant full name from polymorphic payload shapes.
 */
export function resolveTenantFullName(req = {}) {
  if (req.tenant?.full_name) return req.tenant.full_name;
  if (req.tenant?.fullName) return req.tenant.fullName;
  if (req.tenantName) return req.tenantName;
  if (req.user?.fullName) return req.user.fullName;
  if (req.tenant?.firstName) {
    return `${req.tenant.firstName} ${req.tenant.lastName || ""}`.trim();
  }
  return "Resident";
}

/**
 * Resolve tenant contact phone from polymorphic payload shapes.
 */
export function resolveTenantPhone(req = {}) {
  return (
    req.tenant?.phone ||
    req.tenant?.phoneNumber ||
    req.tenant?.contact_number ||
    req.tenantPhone ||
    req.user?.phone ||
    req.contactNumber ||
    "—"
  );
}

/**
 * Resolve tenant email from polymorphic payload shapes.
 */
export function resolveTenantEmail(req = {}) {
  return req.tenant?.email || req.tenantEmail || req.user?.email || "—";
}

/**
 * Resolve room / unit label.
 */
export function resolveRoomUnitLabel(req = {}) {
  const room =
    req.room ||
    req.roomNumber ||
    req.unitNumber ||
    req.occupancyContext?.unitNumber ||
    req.roomId?.roomNumber ||
    req.roomId?.name ||
    "";
  const bed =
    req.bedLabel ||
    req.bedNumber ||
    req.occupancyContext?.bedNumber ||
    req.bed ||
    "";

  if (room && bed) return `${room} (${bed})`;
  if (room) return String(room);
  if (bed) return `Bed ${bed}`;
  return "—";
}

/**
 * Resolve operational stage from status.
 */
export function resolveOperationalStage(status = "") {
  const s = String(status || "").toLowerCase();
  if (["pending", "viewed", "assigned"].includes(s)) return "Active Queue";
  if (["scheduled", "in_progress"].includes(s)) return "In Progress";
  if (["reopened", "overdue", "urgent", "needs_attention"].includes(s)) return "Needs Attention";
  if (["resolved"].includes(s)) return "Resolved (Awaiting)";
  if (["completed", "verified"].includes(s)) return "Completed";
  if (["cancelled", "rejected"].includes(s)) return "Closed";
  return "Active Queue";
}

/**
 * Resolve assigned contractor / service provider name.
 */
export function resolveAssignedProviderName(req = {}) {
  return (
    req.assignedProviderName ||
    req.assigned_to ||
    req.assignedProvider?.providerName ||
    req.providerDetails?.tenantVisibleLabel ||
    (req.providerSource === "manual" && req.manualProviderName) ||
    "Unassigned"
  );
}

/**
 * Resolve assigned contractor / service provider contact.
 */
export function resolveAssignedProviderContact(req = {}) {
  return (
    req.assignedProviderContact ||
    req.assignedProvider?.contactNumber ||
    req.providerDetails?.privateContact ||
    req.manualProviderContact ||
    "—"
  );
}

/**
 * Resolve total repair cost number.
 */
export function resolveTotalRepairCost(req = {}) {
  const cost =
    req.actualCost ??
    req.totalCost ??
    req.costBreakdown?.totalCost ??
    req.costBreakdown?.laborCost ??
    0;
  return Number.isFinite(Number(cost)) ? Number(cost) : 0;
}

/**
 * Resolve cost attribution label.
 */
export function resolveCostAttribution(req = {}) {
  if (req.costBreakdown?.isTenantChargeable || req.isTenantChargeable) {
    return "Tenant Chargeable";
  }
  const total = resolveTotalRepairCost(req);
  if (total > 0) return "Property Expense";
  return "None";
}

/**
 * Resolve SLA state label.
 */
export function resolveSlaStateLabel(req = {}) {
  if (req.slaState?.label) {
    const l = req.slaState.label;
    if (l === "delayed" || l === "overdue") return "SLA Overdue";
    if (l === "priority" || l === "due_soon") return "Due Soon";
    if (l === "closed" || l === "completed") return "Completed";
    return "On Track";
  }
  if (req.isOverdue) return "SLA Overdue";
  return "On Track";
}

/**
 * Prepare CSV data rows from filtered maintenance requests array.
 */
export function formatMaintenanceForCSV(requests = []) {
  return requests.map((req) => {
    const rawId = req.request_id || req.requestId || (req._id ? `#${String(req._id).slice(-6).toUpperCase()}` : "—");
    const formattedId = String(rawId).startsWith("#") ? rawId : `#${rawId}`;
    const rawType = req.request_type || req.requestType;
    const typeLabel = rawType ? getMaintenanceTypeMeta(rawType).label : "General";
    const urgencyLabel = req.urgency ? getMaintenanceUrgencyMeta(req.urgency).label : "Medium";
    const statusLabel = formatMaintenanceStatus(req.status);
    const stageLabel = resolveOperationalStage(req.status);
    const totalCost = resolveTotalRepairCost(req);

    return {
      requestId: formattedId,
      tenantName: resolveTenantFullName(req),
      tenantPhone: resolveTenantPhone(req),
      tenantEmail: resolveTenantEmail(req),
      branch: formatMaintenanceBranchLabel(req.branch),
      room: resolveRoomUnitLabel(req),
      requestType: typeLabel,
      urgency: urgencyLabel,
      stage: stageLabel,
      status: statusLabel,
      assignedProvider: resolveAssignedProviderName(req),
      providerContact: resolveAssignedProviderContact(req),
      actualCost: formatCurrencyAmount(totalCost),
      costAttribution: resolveCostAttribution(req),
      slaState: resolveSlaStateLabel(req),
      description: (req.description || req.issueDescription || "—").replace(/\r?\n+/g, " "),
      adminNotes: (req.notes || req.adminRemarks || "—").replace(/\r?\n+/g, " "),
      submittedAt: formatDateTime(req.created_at || req.createdAt),
      scheduledDate: formatDate(req.schedule?.scheduledDate || req.scheduledDate),
      resolvedAt: formatDateTime(req.resolved_at || req.resolvedAt || req.completed_at || req.completedAt),
    };
  });
}

/**
 * Triggers CSV export for filtered maintenance requests.
 */
export function handleExportMaintenanceCSV({ requests = [], branchFilter = "all" }) {
  if (!requests || requests.length === 0) {
    showNotification({
      title: "No Records to Export",
      message: "No maintenance requests match the current filter criteria.",
      type: "warning",
    });
    return;
  }

  const data = formatMaintenanceForCSV(requests);
  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Maintenance_Requests_${branchSlug}_${dateSlug}`;

  exportToCSV(data, MAINTENANCE_CSV_COLUMNS, filename);
  showNotification({
    title: "Export Complete",
    message: `Successfully exported ${requests.length} maintenance records to CSV.`,
    type: "success",
  });
}

/**
 * Triggers branded PDF report export for filtered maintenance requests.
 */
export async function handleExportMaintenancePDF({
  requests = [],
  summaryItems = [],
  branchFilter = "all",
  stageFilter = "all",
  statusFilter = "all",
  urgencyFilter = "all",
  slaFilter = "all",
  searchQuery = "",
  dateFrom = "",
  dateTo = "",
}) {
  if (!requests || requests.length === 0) {
    showNotification({
      title: "No Records to Export",
      message: "No maintenance requests match the current filter criteria.",
      type: "warning",
    });
    return;
  }

  const dateSlug = getFilenameDateSlug();
  const branchSlug = sanitizeSlug(branchFilter);
  const filename = `Lilycrest_Maintenance_Requests_${branchSlug}_${dateSlug}.pdf`;

  // Compute dynamic KPIs
  const totalCount = requests.length;
  const activeQueueCount = requests.filter((r) =>
    ["pending", "viewed", "assigned"].includes(String(r.status || "").toLowerCase()),
  ).length;
  const inProgressCount = requests.filter((r) =>
    ["scheduled", "in_progress"].includes(String(r.status || "").toLowerCase()),
  ).length;
  const needsAttentionCount = requests.filter((r) =>
    ["reopened", "overdue", "urgent"].includes(String(r.status || "").toLowerCase()) || r.isOverdue,
  ).length;
  const resolvedCount = requests.filter(
    (r) => String(r.status || "").toLowerCase() === "resolved",
  ).length;
  const completedCount = requests.filter((r) =>
    ["completed", "verified"].includes(String(r.status || "").toLowerCase()),
  ).length;
  const totalIncurredCost = requests.reduce(
    (sum, r) => sum + resolveTotalRepairCost(r),
    0,
  );

  const kpis = [
    { label: "TOTAL REQUESTS", value: String(totalCount), format: "number" },
    { label: "ACTIVE QUEUE", value: String(activeQueueCount), format: "number" },
    { label: "IN PROGRESS", value: String(inProgressCount), format: "number" },
    { label: "NEEDS ATTENTION", value: String(needsAttentionCount), format: "number" },
    { label: "RESOLVED (AWAITING)", value: String(resolvedCount), format: "number" },
    { label: "COMPLETED", value: String(completedCount), format: "number" },
    {
      label: "TOTAL REPAIR COST",
      value: `PHP ${formatCurrencyAmount(totalIncurredCost)}`,
    },
  ];

  const tableRows = requests.map((req) => {
    const rawId = req.request_id || req.requestId || (req._id ? `#${String(req._id).slice(-6).toUpperCase()}` : "—");
    const formattedId = String(rawId).startsWith("#") ? rawId : `#${rawId}`;
    const rawType = req.request_type || req.requestType;
    const typeLabel = rawType ? getMaintenanceTypeMeta(rawType).label : "General";
    const urgencyLabel = req.urgency ? getMaintenanceUrgencyMeta(req.urgency).label : "Medium";
    const statusLabel = formatMaintenanceStatus(req.status);
    const providerLabel = resolveAssignedProviderName(req);
    const costNum = resolveTotalRepairCost(req);
    const costLabel = costNum > 0 ? `PHP ${formatCurrencyAmount(costNum)}` : "—";

    return {
      ID: formattedId,
      Tenant: resolveTenantFullName(req),
      Branch: formatMaintenanceBranchLabel(req.branch),
      Room: resolveRoomUnitLabel(req),
      Category: typeLabel,
      Urgency: urgencyLabel,
      Status: statusLabel,
      Contractor: providerLabel,
      Cost: costLabel,
      Submitted: formatDate(req.created_at || req.createdAt),
    };
  });

  const activeBranchLabel =
    !branchFilter || branchFilter === "all" ? "All Branches" : formatMaintenanceBranchLabel(branchFilter);
  const activeStageLabel =
    !stageFilter || stageFilter === "all" ? null : `Stage: ${stageFilter}`;
  const activeStatusLabel =
    !statusFilter || statusFilter === "all" ? null : `Status: ${formatMaintenanceStatus(statusFilter)}`;
  const activeUrgencyLabel =
    !urgencyFilter || urgencyFilter === "all" ? null : `Urgency: ${getMaintenanceUrgencyMeta(urgencyFilter).label}`;
  const activeSlaLabel =
    !slaFilter || slaFilter === "all" ? null : `SLA: ${slaFilter}`;
  const dateRangeLabel =
    dateFrom || dateTo ? `Date Range: ${dateFrom || "Start"} to ${dateTo || "Present"}` : null;

  const filterDesc = [
    `Branch: ${activeBranchLabel}`,
    activeStageLabel,
    activeStatusLabel,
    activeUrgencyLabel,
    activeSlaLabel,
    dateRangeLabel,
    searchQuery ? `Search: "${searchQuery}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await exportReportPdf({
    title: "Maintenance Management Report",
    subtitle: `Filter Context: ${filterDesc}`,
    filename,
    period: `Generated on ${new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`,
    reportType: "Maintenance",
    kpis: kpis.slice(0, 6),
    sections: [
      {
        type: "table",
        title: "Filtered Maintenance Requests",
        description: `Export containing ${requests.length} maintenance records matching the active filter criteria.`,
        headers: ["ID", "Tenant", "Branch", "Room", "Category", "Urgency", "Status", "Contractor", "Cost", "Submitted"],
        colWidths: [22, 28, 20, 16, 20, 16, 18, 22, 18, 16],
        rows: tableRows,
      },
    ],
  });

  showNotification({
    title: "Export Complete",
    message: `Successfully generated maintenance PDF report (${requests.length} records).`,
    type: "success",
  });
}
