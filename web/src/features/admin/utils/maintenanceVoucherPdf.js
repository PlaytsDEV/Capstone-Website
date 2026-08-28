import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { showNotification } from "../../../shared/utils/notification.js";
import {
  formatDate,
  formatDateTime,
  formatCurrencyAmount,
  getFilenameDateSlug,
  sanitizeSlug,
  resolveTenantFullName,
  formatMaintenanceBranchLabel,
  resolveRoomUnitLabel,
  resolveAssignedProviderName,
  resolveTotalRepairCost,
  resolveCostAttribution,
} from "./maintenanceExportUtils.js";
import {
  formatTurnaroundDuration,
} from "../pages/maintenance/maintenanceUtils.js";
import {
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
  formatMaintenanceStatus,
} from "../../../shared/utils/maintenanceConfig.js";

/**
 * Extracts and formats structured single-ticket maintenance voucher parameters.
 */
export function formatMaintenanceVoucherData(request) {
  if (!request) return null;

  const rawId =
    request.request_id ||
    request.requestId ||
    (request._id ? `#${String(request._id).slice(-6).toUpperCase()}` : "—");
  const formattedId = String(rawId).startsWith("#") ? rawId : `#${rawId}`;

  const tenantName = resolveTenantFullName(request) || "Tenant";
  const branch = formatMaintenanceBranchLabel(request.branch) || "Lilycrest Main";
  const room = resolveRoomUnitLabel(request) || "—";
  const rawType = request.request_type || request.requestType;
  const category = rawType ? getMaintenanceTypeMeta(rawType).label : "Maintenance";
  const urgency = request.urgency ? getMaintenanceUrgencyMeta(request.urgency).label : "Normal";
  const status = formatMaintenanceStatus(request.status || "completed");

  const laborCost = Number(request?.costBreakdown?.laborCost || 0);
  const materialsCost = Number(request?.costBreakdown?.materialsCost || 0);
  const totalCost = laborCost + materialsCost || resolveTotalRepairCost(request) || Number(request?.actualCost || 0);
  const attributionLabel = resolveCostAttribution(request) || (request?.costBreakdown?.isTenantChargeable ? "Billed to Tenant" : "Dormitory Covered");

  const turnaround = formatTurnaroundDuration(
    request?.createdAt || request?.created_at,
    request?.resolutionConfirmation?.confirmedAt ||
      request?.closed_at ||
      request?.resolved_at ||
      request?.updatedAt,
  );

  const providerName = resolveAssignedProviderName(request) || "Lilycrest Facilities Team";
  const providerCategory =
    request?.assignedProviderCategory ||
    request?.assignedProvider?.serviceType ||
    category;

  const rating = request?.resolutionConfirmation?.rating || 5;
  const rawWorkLog = Array.isArray(request?.work_log) ? request.work_log : request?.workLog || [];
  const latestResolutionLog = rawWorkLog.length > 0 ? rawWorkLog[rawWorkLog.length - 1] : null;
  const resolutionNotes =
    latestResolutionLog?.note ||
    request?.resolution_note ||
    request?.resolutionNote ||
    request?.notes ||
    "Maintenance work completed and verified on site.";

  const kpis = [
    { label: "TURNAROUND TIME", value: turnaround, format: "text" },
    { label: "TOTAL SETTLEMENT", value: `PHP ${formatCurrencyAmount(totalCost)}`, format: "text" },
    { label: "CONTRACTOR / TECHNICIAN", value: providerName, format: "text" },
    { label: "TENANT SATISFACTION", value: `${rating}/5 Stars`, format: "text" },
  ];

  return {
    requestId: formattedId,
    rawId,
    tenantName,
    branch,
    room,
    category,
    urgency,
    status,
    submittedAt: formatDateTime(request?.created_at || request?.createdAt),
    completedAt: formatDateTime(request?.closed_at || request?.resolved_at || request?.updatedAt),
    totalCostFormatted: `PHP ${formatCurrencyAmount(totalCost)}`,
    laborCostFormatted: `PHP ${formatCurrencyAmount(laborCost)}`,
    materialsCostFormatted: `PHP ${formatCurrencyAmount(materialsCost)}`,
    attributionLabel,
    providerName,
    providerCategory,
    rating,
    kpis,
    summaryNarrative: request?.completionReport?.summary || resolutionNotes,
    tenantFeedback: request?.resolutionConfirmation?.tenantFeedback || "Standard on-site resolution confirmed",
  };
}

/**
 * Triggers branded PDF export for a single completed maintenance voucher.
 */
export async function handleExportSingleMaintenanceVoucherPDF(param) {
  const request = param?.request ? param.request : param;

  if (!request || typeof request !== "object" || Object.keys(request).length === 0) {
    showNotification({
      title: "Export Failed",
      message: "No maintenance record provided for PDF generation.",
      type: "error",
    });
    return;
  }

  const voucherData = formatMaintenanceVoucherData(request);
  const dateSlug = getFilenameDateSlug();
  const reqSlug = sanitizeSlug(String(voucherData.rawId || "voucher"));
  const filename = `Lilycrest_Maintenance_Completion_Voucher_${reqSlug}_${dateSlug}.pdf`;

  await exportReportPdf({
    title: "Maintenance Completion Voucher",
    subtitle: `Ticket ${voucherData.requestId} • Completed & Recorded: ${voucherData.completedAt}`,
    filename,
    reportType: "Maintenance Voucher",
    orientation: "portrait",
    kpis: voucherData.kpis,
    sections: [
      {
        type: "table",
        title: "Ticket & Unit Information",
        description: "Official maintenance request parameters and unit location details.",
        headers: ["Parameter", "Details"],
        colWidths: [50, 128],
        rows: [
          { Parameter: "Ticket Reference ID", Details: voucherData.requestId },
          { Parameter: "Tenant Name", Details: voucherData.tenantName },
          { Parameter: "Dormitory Branch", Details: voucherData.branch },
          { Parameter: "Room / Unit Number", Details: voucherData.room },
          { Parameter: "Service Category", Details: voucherData.category },
          { Parameter: "Urgency Level", Details: voucherData.urgency },
          { Parameter: "Submission Date", Details: voucherData.submittedAt },
          { Parameter: "Completion Date", Details: voucherData.completedAt },
        ],
      },
      {
        type: "table",
        title: "Financial Settlement & Cost Attribution",
        description: "Audited repair expenses and responsible billing attribution.",
        headers: ["Expense Item", "Amount", "Billing Attribution"],
        colWidths: [60, 48, 70],
        rows: [
          {
            "Expense Item": "Labor & Workmanship",
            Amount: voucherData.laborCostFormatted,
            "Billing Attribution": voucherData.attributionLabel,
          },
          {
            "Expense Item": "Replacement Parts / Materials",
            Amount: voucherData.materialsCostFormatted,
            "Billing Attribution": voucherData.attributionLabel,
          },
          {
            "Expense Item": "Total Settlement Amount",
            Amount: voucherData.totalCostFormatted,
            "Billing Attribution": voucherData.attributionLabel,
          },
        ],
      },
      {
        type: "table",
        title: "Resolution Narrative & Tenant Feedback",
        description: "Summary of technician work performed and tenant feedback rating.",
        headers: ["Field", "Resolution Details"],
        colWidths: [50, 128],
        rows: [
          { Field: "Assigned Technician", "Resolution Details": voucherData.providerName },
          { Field: "Official Work Summary", "Resolution Details": voucherData.summaryNarrative },
          {
            Field: "Tenant Feedback",
            "Resolution Details": `Rating: ${voucherData.rating}/5 Stars • Remarks: "${voucherData.tenantFeedback}"`,
          },
        ],
      },
    ],
  });

  showNotification({
    title: "Completion Report Downloaded",
    message: `Successfully generated PDF voucher for ticket ${voucherData.requestId}.`,
    type: "success",
  });
}
