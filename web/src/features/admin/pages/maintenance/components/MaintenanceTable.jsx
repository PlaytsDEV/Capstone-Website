import { useMemo } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Paperclip,
  UserX,
  Wrench,
  X,
} from "lucide-react";
import {
  formatMaintenanceStatus,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../../../shared/utils/maintenanceConfig";
import { DataTable } from "../../../components/shared";
import { BranchTableText } from "./BranchBadge";
import {
  fmtDate,
  getAssignedProviderName,
  getAvatarPalette,
  getRequestBranch,
  getSlaTone,
  getStatusDotClass,
  getStatusTextClass,
  formatSlaState,
  ITEMS_PER_PAGE,
} from "../maintenanceUtils";

export function MaintenanceTable({
  requests = [],
  isLoading = false,
  currentPage = 1,
  onPageChange,
  onRowClick,
  selectedRequestIds = [],
  onToggleSelect,
  onSelectAll,
  onBulkUpdateStatus,
  onBulkArchive,
  onBulkExport,
  isBulkUpdating = false,
  onQuickStatusChange,
}) {
  const allPageIds = useMemo(() => requests.map((r) => r.request_id), [requests]);
  const isAllSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedRequestIds.includes(id));
  const isSomeSelected =
    selectedRequestIds.length > 0 && !isAllSelected;

  const columns = useMemo(
    () => [
      ...(onToggleSelect
        ? [
            {
              key: "select",
              width: "44px",
              label: (
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAll?.(allPageIds);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={() => onSelectAll?.(allPageIds)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-blue-600 cursor-pointer"
                  />
                </div>
              ),
              render: (row) => {
                const isChecked = selectedRequestIds.includes(row.request_id);
                return (
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(row.request_id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleSelect(row.request_id)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-blue-600 cursor-pointer"
                    />
                  </div>
                );
              },
            },
          ]
        : []),
      {
        key: "tenant",
        label: "Tenant",
        render: (row) => {
          const rawName = row.tenant?.full_name || "";
          const isDeleted =
            !rawName ||
            rawName.toLowerCase().includes("deleted") ||
            row.tenant?.is_deleted ||
            row.is_deleted;
          const palette = getAvatarPalette(rawName);

          if (isDeleted) {
            return (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                  <UserX size={14} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Deleted Account
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    Former Resident
                  </div>
                </div>
              </div>
            );
          }

          const initials = rawName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || "T";

          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${palette.bg} ${palette.text}`}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {rawName}
                </div>
                {row.room_number ? (
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Room {row.room_number}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    Tenant
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "branch",
        label: "Branch",
        render: (row) => <BranchTableText branch={getRequestBranch(row)} />,
      },
      {
        key: "request_type",
        label: "Type",
        render: (row) => {
          const typeMeta = getMaintenanceTypeMeta(row.request_type);
          const TypeIcon = typeMeta.icon;
          const attachmentCount = row.attachments?.length || 0;

          return (
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg border"
                style={{
                  backgroundColor: `${typeMeta.color}14`,
                  borderColor: `${typeMeta.color}33`,
                  color: typeMeta.color,
                }}
              >
                <TypeIcon size={14} />
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {typeMeta.label}
                </div>
                {attachmentCount > 0 && (
                  <div className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    <Paperclip size={10} />
                    <span>{attachmentCount} file{attachmentCount === 1 ? "" : "s"}</span>
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "description",
        label: "Description",
        render: (row) => {
          const shortId = row.request_id ? `#${row.request_id.slice(-6).toUpperCase()}` : "";
          return (
            <div className="max-w-[260px]">
              <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-300" title={row.description}>
                {row.description}
              </div>
              {shortId && (
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  {shortId}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "urgency",
        label: "Urgency",
        render: (row) => {
          const urgencyMeta = getMaintenanceUrgencyMeta(row.urgency);
          return (
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: `${urgencyMeta.color}14`,
                borderColor: `${urgencyMeta.color}33`,
                color: urgencyMeta.color,
              }}
            >
              {urgencyMeta.label}
            </span>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getStatusTextClass(
              row.status,
            )}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(row.status)}`} />
            <span>{formatMaintenanceStatus(row.status)}</span>
          </div>
        ),
      },
      {
        key: "sla",
        label: "SLA Health",
        render: (row) => {
          const tone = getSlaTone(row.slaState);
          return (
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold"
              style={{
                background: tone.bg,
                color: tone.color,
                borderColor: `${tone.color}33`,
              }}
            >
              {formatSlaState(row.slaState)}
            </span>
          );
        },
      },
      {
        key: "assigned_to",
        label: "Technician",
        render: (row) => {
          const provider = getAssignedProviderName(row);
          if (!provider) {
            return (
              <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                Unassigned
              </span>
            );
          }
          return (
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {provider}
            </span>
          );
        },
      },
      {
        key: "created_at",
        label: "Date",
        sortable: true,
        render: (row) => (
          <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {fmtDate(row.created_at)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Action",
        align: "right",
        render: (row) => (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {row.status === "pending" && onQuickStatusChange ? (
              <button
                type="button"
                onClick={() => onQuickStatusChange(row.request_id, "viewed")}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 px-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
                title="Acknowledge request"
              >
                <Eye size={12} />
                <span>Acknowledge</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onRowClick?.(row)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
            >
              <span>Open</span>
              <ChevronRight size={12} className="text-slate-400" />
            </button>
          </div>
        ),
      },
    ],
    [allPageIds, isAllSelected, isSomeSelected, onQuickStatusChange, onRowClick, onSelectAll, onToggleSelect, selectedRequestIds],
  );

  return (
    <div className="space-y-3">
      {/* Sticky Bulk Action Bar */}
      {selectedRequestIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/90 dark:bg-blue-950/60 p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {selectedRequestIds.length}
            </span>
            <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
              {selectedRequestIds.length} request{selectedRequestIds.length === 1 ? "" : "s"} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBulkUpdateStatus?.("viewed")}
              disabled={isBulkUpdating}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Eye size={13} />
              <span>Mark as Viewed</span>
            </button>

            <button
              type="button"
              onClick={() => onBulkArchive?.()}
              disabled={isBulkUpdating}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Archive size={13} />
              <span>Archive</span>
            </button>

            <button
              type="button"
              onClick={() => onBulkExport?.()}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectAll?.([])}
              className="inline-flex h-7.5 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Clear selection"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <DataTable
          columns={columns}
          data={requests}
          loading={isLoading}
          onRowClick={(row) => onRowClick?.(row)}
          pagination={{
            pageSize: ITEMS_PER_PAGE,
            currentPage,
            onPageChange,
          }}
        />
      </div>
    </div>
  );
}

export function AnalyticsRequestsTable({
  requests = [],
  isLoading = false,
  currentPage = 1,
  onPageChange,
  onRowClick,
  onGenerateReport,
}) {
  const analyticsColumns = useMemo(
    () => [
      { key: "requestId", label: "Request ID", render: (row) => `#${(row.requestId || "").slice(-6).toUpperCase()}` },
      { key: "tenantName", label: "Tenant Name" },
      { key: "branchLabel", label: "Branch" },
      { key: "room", label: "Room/Unit", render: (row) => row.room || "Not recorded" },
      { key: "requestTypeLabel", label: "Request Type" },
      { key: "urgencyLabel", label: "Urgency" },
      { key: "statusLabel", label: "Status" },
      { key: "assignedProvider", label: "Assigned Technician", render: (row) => row.assignedProvider || "Unassigned" },
      { key: "createdAt", label: "Created", render: (row) => fmtDate(row.createdAt) },
      { key: "resolutionAt", label: "Resolution", render: (row) => row.resolutionAt ? fmtDate(row.resolutionAt) : "Pending" },
      {
        key: "sla",
        label: "SLA",
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
              row.sla?.key === "overdue"
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                : row.sla?.key === "due_soon"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                : row.sla?.key === "completed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
            }`}
          >
            {row.sla?.label || "On Track"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        align: "right",
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => onRowClick?.(row.requestId)}
            >
              Details
            </button>
            {onGenerateReport && (
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => {
                  onRowClick?.(row.requestId);
                  onGenerateReport?.("admin", row.requestId);
                }}
              >
                Report
              </button>
            )}
          </div>
        ),
      },
    ],
    [onGenerateReport, onRowClick],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <DataTable
        columns={analyticsColumns}
        data={requests}
        loading={isLoading}
        onRowClick={(row) => onRowClick?.(row.requestId)}
        pagination={{
          pageSize: ITEMS_PER_PAGE,
          currentPage,
          onPageChange,
        }}
      />
    </div>
  );
}

export function ProviderPerformanceTable({
  providers = [],
  isLoading = false,
}) {
  const providerColumns = useMemo(
    () => [
      { key: "providerName", label: "Provider Name" },
      { key: "category", label: "Category" },
      { key: "totalAssigned", label: "Total Assigned" },
      { key: "activeJobs", label: "Active Jobs" },
      { key: "completedJobs", label: "Completed" },
      { key: "overdueJobs", label: "Overdue" },
      {
        key: "completionRate",
        label: "Completion Rate",
        render: (row) => (
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {row.completionRate ? `${row.completionRate}%` : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <DataTable
        columns={providerColumns}
        data={providers}
        loading={isLoading}
      />
    </div>
  );
}
