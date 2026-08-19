import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  User,
  UserCheck,
  Wrench,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import {
  BRANCH_OPTIONS,
} from "../../../../../shared/utils/constants";
import {
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../../../shared/utils/maintenanceConfig";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsLineChart,
  ReportChartPanel,
  ReportMetricCard,
} from "../../../components/shared";
import {
  ANALYTICS_SLA_OPTIONS,
  ASSIGNMENT_FILTER_OPTIONS,
  fmtDateTime,
  formatCleanRoomName,
  formatPeso,
  formatTurnaroundDuration,
  getActiveAttachments,
  getClosureMethodMeta,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  getRequestReportMeta,
  getStructuredReportSections,
  isMaintenancePdfAttachment,
  REPORT_NA,
  REPORT_TYPE_LABELS,
  SUMMARY_STATUSES,
} from "../maintenanceUtils";
import { showNotification } from "../../../../../shared/utils/notification";

export function MaintenanceExportDropdown({
  options,
  onExportCSV,
  onExportPDF,
  disabled = false,
  loading = false,
  align = "right",
  placement = "bottom",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Support either explicit onExportCSV / onExportPDF handlers or options array
  const resolvedOptions = Array.isArray(options)
    ? options.filter(Boolean)
    : [
        onExportCSV && {
          key: "export-csv",
          label: "Export as CSV",
          icon: <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
          onClick: onExportCSV,
          disabled: disabled || loading,
        },
        onExportPDF && {
          key: "export-pdf",
          label: "Export as PDF",
          icon: <FileText size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />,
          onClick: onExportPDF,
          disabled: disabled || loading,
        },
      ].filter(Boolean);

  const handleAction = (actionFn) => {
    setOpen(false);
    if (actionFn) actionFn();
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || loading || resolvedOptions.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {loading ? (
          <LoaderCircle size={13} className="animate-spin text-slate-800 dark:text-slate-200 shrink-0" />
        ) : (
          <Download size={13} className="shrink-0 text-slate-800 dark:text-slate-200" />
        )}
        <span>{loading ? "Exporting..." : "Export"}</span>
        <ChevronDown
          size={13}
          className={`text-slate-800 dark:text-slate-200 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && !loading && resolvedOptions.length > 0 ? (
        <div
          role="menu"
          className={`absolute z-[1300] min-w-44 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {resolvedOptions.map((option) => {
            const isCsv =
              option.key?.toLowerCase().includes("csv") ||
              option.label?.toLowerCase().includes("csv");
            const isPdf =
              option.key?.toLowerCase().includes("pdf") ||
              option.label?.toLowerCase().includes("pdf");

            const optionIcon =
              option.icon ||
              (isCsv ? (
                <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isPdf ? (
                <FileText size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <FileDown size={15} className="text-slate-500 dark:text-slate-400 shrink-0" />
              ));

            return (
              <button
                key={option.key || option.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                onClick={() => handleAction(option.onClick)}
                disabled={option.disabled}
              >
                {optionIcon}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ReportExportDropdown({
  reportType,
  disabled = false,
  onExport,
}) {
  const label = REPORT_TYPE_LABELS[reportType] || "Maintenance Report";
  const options = [
    { key: "pdf", label: `Download ${label} PDF`, onClick: () => onExport?.("pdf") },
    { key: "csv", label: `Download ${label} CSV`, onClick: () => onExport?.("csv") },
  ];

  return <MaintenanceExportDropdown options={options} disabled={disabled} placement="top" />;
}

export function ReportInfoGrid({ items = [] }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        let displayValue = item.value;
        if (typeof displayValue === "object" && displayValue !== null) {
          displayValue =
            formatCleanRoomName(displayValue) ||
            displayValue.name ||
            displayValue.roomNumber ||
            displayValue.label ||
            displayValue.title ||
            REPORT_NA;
        }
        return (
          <div key={item.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              {item.label}
            </div>
            <div className="break-words text-xs font-bold text-slate-900 dark:text-slate-100">
              {displayValue || REPORT_NA}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReportViewerSection({ section }) {
  const rows = Array.isArray(section?.rows) && section.rows.length ? section.rows : [REPORT_NA];
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <span>{section.title}</span>
        </h3>
        {/admin only|internal|confidential/i.test(`${section.title} ${section.description || ""}`) ? (
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
            Admin Only
          </span>
        ) : null}
      </div>
      {section.description ? (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{section.description}</p>
      ) : null}
      <div className="mt-3 space-y-1.5">
        {rows.map((row, index) => {
          let rowContent = row;
          if (typeof rowContent === "object" && rowContent !== null) {
            rowContent =
              rowContent.name ||
              rowContent.message ||
              rowContent.title ||
              JSON.stringify(rowContent);
          }
          return (
            <div
              key={`${section.title}-${index}`}
              className="rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/40 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200"
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReportProofThumbnail({ attachment, onPreview, tag = "Proof" }) {
  const uri = getMaintenanceAttachmentUri(attachment);
  const name = getMaintenanceAttachmentName(attachment) || "Photo Proof";
  const isPdf = isMaintenancePdfAttachment(attachment) || String(name).toLowerCase().endsWith(".pdf") || String(uri).toLowerCase().includes(".pdf");
  const [imgError, setImgError] = useState(false);

  if (isPdf) {
    return (
      <a
        href={uri}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Click to open PDF: ${name}`}
        className="group relative flex flex-col items-center justify-center p-2 h-20 w-24 shrink-0 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 transition text-center shadow-2xs cursor-pointer"
      >
        <FileText size={18} className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition" />
        <span className="mt-1 text-[10px] font-bold text-rose-950 dark:text-rose-200 truncate w-full px-0.5 leading-tight">
          {name}
        </span>
        <span className="text-[9px] uppercase font-extrabold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1 rounded mt-0.5">
          PDF
        </span>
      </a>
    );
  }

  return (
    <div
      onClick={() => uri && onPreview?.({ uri, name, tag })}
      title={`Click to enlarge: ${name}`}
      className="group relative h-20 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:border-primary transition shadow-2xs"
    >
      {imgError || !uri ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 p-1 text-center">
          <ImageIcon size={16} className="mb-0.5" />
          <span className="text-[9px] truncate max-w-full text-slate-500 font-medium px-1">{name}</span>
        </div>
      ) : (
        <>
          <img
            src={uri}
            alt={name}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover group-hover:scale-105 transition"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
            <Eye size={14} className="text-white" />
          </div>
        </>
      )}
    </div>
  );
}

export function ReportPreviewModal({
  open,
  report,
  request,
  isCopying = false,
  isSending = false,
  onCopy,
  onExport,
  onSendToTenant,
  onClose,
}) {
  const [localCopied, setLocalCopied] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  if (!open || !report) return null;

  const isTenant = report.reportType === "tenant";
  const label = REPORT_TYPE_LABELS[report.reportType] || "Maintenance Report";
  const meta = getRequestReportMeta(request);
  const sections = getStructuredReportSections(report, request);

  // Executive completion facts
  const closureMeta = getClosureMethodMeta(request);
  const turnaroundDuration = formatTurnaroundDuration(
    request?.createdAt || request?.created_at,
    request?.resolutionConfirmation?.confirmedAt ||
      request?.closed_at ||
      request?.resolved_at ||
      request?.updatedAt ||
      report?.generatedAt,
  );
  const totalLabor = Number(request?.costBreakdown?.laborCost || 0);
  const totalMaterials = Number(request?.costBreakdown?.materialsCost || 0);
  const totalCost = totalLabor + totalMaterials || Number(request?.actualCost || 0);
  const isTenantChargeable = Boolean(request?.costBreakdown?.isTenantChargeable);
  const tenantRating = request?.resolutionConfirmation?.rating;
  const tenantComment = request?.resolutionConfirmation?.tenantFeedback;
  const rawWorkLog = Array.isArray(request?.work_log) ? request.work_log : request?.workLog || [];
  const latestResolutionLog = rawWorkLog.length > 0 ? rawWorkLog[rawWorkLog.length - 1] : null;
  const resolutionNoteText =
    latestResolutionLog?.note ||
    request?.resolution_note ||
    request?.resolutionNote ||
    request?.notes ||
    null;

  const initialAttachments = getActiveAttachments(request?.attachments || []);
  const workLogAttachments = rawWorkLog.flatMap((w) => getActiveAttachments(w?.attachments || []));

  const assignedProviderName =
    request?.assignedProviderName ||
    request?.assigned_to ||
    request?.assignedProvider?.providerName ||
    "Lilycrest Facilities Team";
  const assignedProviderCategory =
    request?.assignedProviderCategory ||
    request?.assignedProvider?.serviceType ||
    meta.requestType ||
    "Maintenance";

  const finalizedAt = report.finalizedAt || report.generatedAt || new Date();
  const isRecorded = Boolean(report.isRecorded || request?.completionReport?.summary || report.summary);

  const handleCopySummary = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    const summaryText = report.summary || "";
    try {
      await navigator.clipboard.writeText(summaryText);
      setLocalCopied(true);
      showNotification({
        title: "Summary Copied",
        message: "Maintenance report summary copied to clipboard.",
        type: "success",
      });
      setTimeout(() => setLocalCopied(false), 2500);
    } catch {
      showNotification({
        title: "Copy Failed",
        message: "Failed to copy summary to clipboard.",
        type: "error",
      });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="maintenance-report-preview-title"
          className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/80 dark:bg-slate-900/90">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                  Lilycrest Residences
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Maintenance Completion Voucher
                </span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 id="maintenance-report-preview-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isTenant ? "Tenant Maintenance Summary" : "Executive Maintenance Completion Report"}
                </h2>

                {/* Status Badge: Transparent with dot */}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Completed</span>
                </span>

                {/* Recorded in System Badge */}
                {isRecorded && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Recorded in System Audit</span>
                  </span>
                )}

                {/* Scope Badge */}
                <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-0.5 text-[11px] font-semibold ${
                  isTenant ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isTenant ? "bg-sky-500" : "bg-amber-500"}`} />
                  <span>{label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ticket #{meta.requestId} • Generated & Recorded {fmtDateTime(finalizedAt)}
              </p>
            </div>

            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              onClick={onClose}
              aria-label="Close report preview"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {report.message && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                {report.message}
              </div>
            )}

            {/* 1. Quick-Stats Resolution Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Turnaround Time */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                  <Timer size={12} className="text-slate-400 shrink-0" />
                  <span>Turnaround Time</span>
                </span>
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {turnaroundDuration}
                </div>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block truncate">
                  Work Completed
                </span>
              </div>

              {/* Total Settlement Cost */}
              <div
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-1 shadow-2xs"
                title={
                  totalCost > 0
                    ? `Labor: ${formatPeso(totalLabor)} • Materials: ${formatPeso(totalMaterials)}`
                    : undefined
                }
              >
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                  <Receipt size={12} className="text-slate-400 shrink-0" />
                  <span>Total Settlement</span>
                </span>
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {totalCost > 0 ? formatPeso(totalCost) : "PHP 0.00"}
                </div>
                <span className={`text-[10px] font-medium block truncate ${isTenantChargeable ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {isTenantChargeable ? "Billed to Tenant" : "Dormitory Covered"}
                </span>
              </div>

              {/* Service Provider */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                  <UserCheck size={12} className="text-slate-400 shrink-0" />
                  <span>Technician / Provider</span>
                </span>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {assignedProviderName}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                  {assignedProviderCategory}
                </span>
              </div>

              {/* Satisfaction Rating */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                  <Star size={12} className="text-amber-500 shrink-0" />
                  <span>Tenant Rating</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {tenantRating ? `${tenantRating}/5` : "5/5"}
                  </span>
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={11}
                        className={
                          star <= (tenantRating || 5)
                            ? "fill-amber-400 text-amber-500"
                            : "text-slate-300 dark:text-slate-600"
                        }
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                  {tenantRating ? "Tenant Verified" : "Staff Verified"}
                </span>
              </div>
            </div>

            {/* 2. Executive AI Analysis & Summary Narrative */}
            {report.summary && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Official AI Completion Summary &amp; Verdict</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Recorded in Permanent History
                  </span>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/30 p-3.5 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {report.summary}
                </div>
              </div>
            )}

            {/* 3. Verified Visual Proof Gallery (Before & After) */}
            {(initialAttachments.length > 0 || workLogAttachments.length > 0) && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Verified Visual Proof (Before &amp; After)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Click any photo to enlarge
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Before */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                      1. Tenant Initial Report (Before)
                    </span>
                    {initialAttachments.length === 0 ? (
                      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-[11px] text-slate-400">
                        No initial media attached
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {initialAttachments.map((att, idx) => (
                          <ReportProofThumbnail
                            key={idx}
                            attachment={att}
                            onPreview={(img) => {
                              setLightboxImage(img);
                              setLightboxZoom(1);
                            }}
                            tag="Before"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* After */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                      2. Technician Resolution Proof (After)
                    </span>
                    {workLogAttachments.length === 0 ? (
                      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-[11px] text-slate-400">
                        No resolution proof media logged
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {workLogAttachments.map((att, idx) => (
                          <ReportProofThumbnail
                            key={idx}
                            attachment={att}
                            onPreview={(img) => {
                              setLightboxImage(img);
                              setLightboxZoom(1);
                            }}
                            tag="After"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Request Information & Metadata Grid */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Request Information
                </h3>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Unit {meta.room} • {meta.branch}
                </span>
              </div>
              <ReportInfoGrid
                items={[
                  { label: "Tenant", value: meta.tenantName },
                  ...(isTenant ? [] : [{ label: "User ID", value: meta.userId }]),
                  { label: "Branch", value: meta.branch },
                  { label: "Room / Unit", value: meta.room },
                  { label: "Request Type", value: meta.requestType },
                  { label: "Urgency", value: meta.urgency },
                  { label: "Status", value: meta.status },
                  { label: "Created At", value: meta.createdAt },
                  { label: "Completed At", value: meta.updatedAt },
                ]}
              />
            </div>

            {/* 5. Additional Structured Sections */}
            <div className="space-y-3">
              {sections.map((section, index) => (
                <ReportViewerSection key={`${section.title}-${index}`} section={section} />
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/80 dark:bg-slate-900/90">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>Report ID: <strong className="text-slate-800 dark:text-slate-200">{report.reportId || meta.requestId}</strong></span>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <ReportExportDropdown
                reportType={report.reportType}
                onExport={onExport}
                disabled={!report.summary}
              />

              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-50 transition cursor-pointer"
                onClick={handleCopySummary}
                disabled={isCopying}
              >
                {localCopied ? (
                  <>
                    <Check size={13} className="text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <ClipboardList size={13} />
                    <span>Copy Summary</span>
                  </>
                )}
              </button>

              {isTenant && onSendToTenant && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition cursor-pointer"
                  onClick={onSendToTenant}
                  disabled={isSending}
                >
                  <MessageSquare size={13} />
                  <span>{isSending ? "Sending..." : "Send to Tenant"}</span>
                </button>
              )}

              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Full-Screen Lightbox Image Modal */}
      {lightboxImage &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            {/* Top Floating Controls */}
            <div
              className="fixed top-4 right-4 z-50 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 3))}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.5))}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom(1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 hover:bg-rose-600 text-white backdrop-blur-xs transition cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Bottom Floating Info */}
            <div
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/70 px-4 py-1.5 text-xs text-white backdrop-blur-xs border border-white/10 text-center max-w-[90vw] truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-semibold">{lightboxImage.tag}:</span> {lightboxImage.name} • {Math.round(lightboxZoom * 100)}%
            </div>

            {/* Centered Image */}
            <div
              className="flex items-center justify-center max-h-[85vh] max-w-[85vw] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.uri}
                alt={lightboxImage.name}
                style={{ transform: `scale(${lightboxZoom})`, transition: "transform 0.15s ease" }}
                className="max-h-[80vh] max-w-[80vw] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function MaintenanceReportFilters({
  filters,
  isOwner,
  userBranch,
  providerOptions = [],
  onChange,
  title = "Filters",
}) {
  const branchValue = isOwner ? filters.branch : userBranch;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Refine the reporting view without changing the operational request queue.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(filters.overdueOnly)}
            onChange={(event) => onChange("overdueOnly", event.target.checked)}
          />
          Overdue only
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Branch</span>
          <select
            value={branchValue || ""}
            onChange={(event) => onChange("branch", event.target.value)}
            disabled={!isOwner}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground disabled:bg-muted"
          >
            {isOwner ? <option value="all">All Branches</option> : null}
            {BRANCH_OPTIONS.map((branch) => (
              <option key={branch.value} value={branch.value}>{branch.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date From</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => onChange("dateFrom", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground" />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date To</span>
          <input type="date" value={filters.dateTo} onChange={(event) => onChange("dateTo", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground" />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</span>
          <select value={filters.status} onChange={(event) => onChange("status", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All statuses</option>
            {SUMMARY_STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Request Type</span>
          <select value={filters.requestType} onChange={(event) => onChange("requestType", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All request types</option>
            {MAINTENANCE_REQUEST_TYPES.map((type) => <option key={type} value={type}>{getMaintenanceTypeMeta(type).label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Urgency</span>
          <select value={filters.urgency} onChange={(event) => onChange("urgency", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All urgency levels</option>
            {MAINTENANCE_URGENCY_LEVELS.map((urgency) => <option key={urgency} value={urgency}>{getMaintenanceUrgencyMeta(urgency).label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Service Provider</span>
          <select value={filters.provider} onChange={(event) => onChange("provider", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All providers</option>
            {providerOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assignment</span>
          <select value={filters.assignmentStatus} onChange={(event) => onChange("assignmentStatus", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            {ASSIGNMENT_FILTER_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Target Timeline</span>
          <select value={filters.slaHealth} onChange={(event) => onChange("slaHealth", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            {ANALYTICS_SLA_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

export function MaintenanceMetricsGrid({ summary = {}, isOwner = false }) {
  const metrics = [
    ["Total Requests", summary.totalRequests ?? 0, "blue"],
    ["Pending Requests", summary.pendingRequests ?? 0, "amber"],
    ["In Progress", summary.inProgressRequests ?? 0, "blue"],
    ["Completed", summary.completedRequests ?? 0, "green"],
    ["Overdue", summary.overdueRequests ?? 0, "rose"],
    ["Cancelled/Rejected", summary.cancelledRejectedRequests ?? 0, "rose"],
    ["Avg Response", summary.averageResponseTimeLabel || "Not enough data", "blue"],
    ["Avg Resolution", summary.averageResolutionTimeLabel || "Not enough data", "green"],
    ["Most Common Issue", summary.mostCommonIssueType || "Not enough data", "blue"],
    ["Assigned", summary.assignedRequests ?? 0, "blue"],
    ["Unassigned", summary.unassignedRequests ?? 0, "amber"],
    ...(isOwner ? [["Top Branch", summary.branchWithMostRequests || "Not enough data", "green"]] : []),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, tone]) => (
        <ReportMetricCard key={label} label={label} value={value} tone={tone} />
      ))}
    </div>
  );
}

export function MaintenanceAnalyticsCharts({ data, isOwner }) {
  const charts = data?.charts || {};
  const emptyTitle = "No maintenance data";
  const emptyDescription = "No maintenance data found for the selected filters.";
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportChartPanel title="Requests by Status">
        <AnalyticsDonutChart data={charts.requestsByStatus || []} centerLabel={{ value: data?.summary?.totalRequests || 0, label: "Requests" }} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Requests by Issue Type">
        <AnalyticsBarChart data={charts.requestsByIssueType || []} bars={[{ key: "value", label: "Requests", color: "#0ea5e9" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Requests by Urgency">
        <AnalyticsDonutChart data={charts.requestsByUrgency || []} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Monthly Maintenance Trend">
        <AnalyticsLineChart data={charts.monthlyTrend || []} lines={[{ key: "total", label: "Total" }, { key: "completed", label: "Completed" }, { key: "overdue", label: "Overdue" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Overdue Requests Overview">
        <AnalyticsDonutChart data={charts.overdueOverview || []} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      {isOwner ? (
        <>
          <ReportChartPanel title="Requests per Branch">
            <AnalyticsBarChart data={charts.requestsPerBranch || []} bars={[{ key: "value", label: "Requests", color: "#0284c7" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
          </ReportChartPanel>
          <ReportChartPanel title="Average Resolution Time per Branch">
            <AnalyticsBarChart data={charts.averageResolutionTimePerBranch || []} bars={[{ key: "value", label: "Hours", color: "#10b981" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
          </ReportChartPanel>
          <ReportChartPanel title="Overdue Requests by Branch">
            <AnalyticsBarChart data={charts.overdueRequestsByBranch || []} bars={[{ key: "value", label: "Overdue", color: "#ef4444" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
          </ReportChartPanel>
        </>
      ) : null}
    </div>
  );
}
