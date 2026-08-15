import { useMemo } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
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
import { formatBranch, fmtDate, getRelativeTime } from "../../../../../shared/utils/formatDate";
import { DataTable } from "../../../components/shared";
import {
  getAssignedProviderName,
  getAvatarPalette,
  getRequestBranch,
  getStatusDotClass,
  getStatusTextClass,
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
              width: "40px",
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
        key: "resident",
        label: "Resident & Location",
        width: "25%",
        render: (row) => {
          const rawName = row.tenant?.full_name || row.tenantName || "";
          const isDeleted =
            !rawName ||
            rawName.toLowerCase().includes("deleted") ||
            row.tenant?.is_deleted ||
            row.is_deleted;
          const palette = getAvatarPalette(rawName);
          const branchName = formatBranch(getRequestBranch(row));
          const roomInfo =
            row.room_number || row.room?.name || row.roomId?.name
              ? `Room ${row.room_number || row.room?.name || row.roomId?.name}`
              : null;
          const bedSlot = row.bedIdentifier || row.bed?.bedNumber || row.bedNumber || null;

          if (isDeleted) {
            return (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <UserX size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Deleted Account
                  </div>
                  <div className="text-[10px] text-slate-400">{branchName}</div>
                </div>
              </div>
            );
          }

          const initials =
            rawName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase() || "T";

          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${palette.bg} ${palette.text}`}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {rawName}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  <span>{branchName}</span>
                  {roomInfo && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {roomInfo}{bedSlot ? ` (${bedSlot})` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "issue",
        label: "Issue & Category",
        width: "31%",
        render: (row) => {
          const typeMeta = getMaintenanceTypeMeta(row.request_type);
          const TypeIcon = typeMeta.icon;
          const attachmentCount = row.attachments?.length || 0;
          const shortId = row.request_id ? `#${row.request_id.slice(-6).toUpperCase()}` : "";

          return (
            <div className="flex items-start gap-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border mt-0.5"
                style={{
                  backgroundColor: `${typeMeta.color}14`,
                  borderColor: `${typeMeta.color}33`,
                  color: typeMeta.color,
                }}
                title={typeMeta.label}
              >
                <TypeIcon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {typeMeta.label}
                  </span>
                  {shortId && (
                    <span className="font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {shortId}
                    </span>
                  )}
                  {attachmentCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      <Paperclip size={10} className="text-slate-400" />
                      <span>{attachmentCount}</span>
                    </span>
                  )}
                </div>
                <p
                  className="text-xs font-normal text-slate-600 dark:text-slate-300 truncate mt-0.5"
                  title={row.description}
                >
                  {row.description || "No description provided"}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        key: "priority_sla",
        label: "Priority & Schedule",
        width: "16%",
        render: (row) => {
          const urgencyMeta = getMaintenanceUrgencyMeta(row.urgency);
          const rawUrgency = String(row.urgency || "").toLowerCase();
          const urgencyLabel =
            rawUrgency === "low"
              ? "Low"
              : rawUrgency === "normal" || rawUrgency === "medium"
              ? "Standard"
              : "Urgent";

          const rawSla = String(row.slaState || "").toLowerCase();
          let slaElement = null;
          if (rawSla.includes("delay") || rawSla.includes("overdue") || rawSla.includes("breach")) {
            slaElement = (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle size={11} className="shrink-0" />
                <span>Overdue</span>
              </span>
            );
          } else if (rawSla.includes("soon") || rawSla.includes("risk")) {
            slaElement = (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Clock size={11} className="shrink-0" />
                <span>Due soon</span>
              </span>
            );
          } else if (rawSla.includes("close") || rawSla.includes("cancel")) {
            slaElement = (
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                Closed
              </span>
            );
          } else if (rawSla.includes("complete") || rawSla.includes("resolve")) {
            slaElement = (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={11} className="shrink-0" />
                <span>Resolved</span>
              </span>
            );
          } else {
            slaElement = (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <CheckCircle2 size={11} className="shrink-0 text-emerald-500" />
                <span>On schedule</span>
              </span>
            );
          }

          return (
            <div className="flex flex-col items-start gap-1">
              <span
                className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: `${urgencyMeta.color}14`,
                  borderColor: `${urgencyMeta.color}33`,
                  color: urgencyMeta.color,
                }}
              >
                {urgencyLabel}
              </span>
              {slaElement}
            </div>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        width: "14%",
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
        key: "technician",
        label: "Technician",
        width: "15%",
        render: (row) => {
          const provider = getAssignedProviderName(row);
          if (!provider) {
            return (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/60">
                Unassigned
              </span>
            );
          }
          return (
            <div className="flex items-center gap-1.5">
              <Wrench size={12} className="text-primary shrink-0" />
              <span
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                title={provider}
              >
                {provider}
              </span>
            </div>
          );
        },
      },
      {
        key: "actions",
        label: "Reported",
        width: "14%",
        align: "right",
        render: (row) => {
          const relTime = getRelativeTime(row.created_at);
          return (
            <div
              className="flex items-center justify-end gap-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block whitespace-nowrap">
                  {fmtDate(row.created_at)}
                </span>
                {relTime && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block whitespace-nowrap">
                    {relTime}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRowClick?.(row)}
                className="inline-flex h-7 items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer"
                title="Open maintenance request"
              >
                <span>Open</span>
                <ChevronRight size={12} className="text-slate-400" />
              </button>
            </div>
          );
        },
      },
    ],
    [
      allPageIds,
      isAllSelected,
      isSomeSelected,
      onRowClick,
      onSelectAll,
      onToggleSelect,
      selectedRequestIds,
    ],
  );

  return (
    <div className="space-y-3">
      {/* Sticky Bulk Action Bar */}
      {selectedRequestIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/90 dark:bg-blue-950/60 p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
              {selectedRequestIds.length} request{selectedRequestIds.length === 1 ? "" : "s"} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBulkUpdateStatus?.("viewed")}
              disabled={isBulkUpdating}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <CheckCircle2 size={13} />
              <span>Mark as Viewed</span>
            </button>

            <button
              type="button"
              onClick={() => onBulkArchive?.()}
              disabled={isBulkUpdating}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Archive size={13} />
              <span>Archive</span>
            </button>

            <button
              type="button"
              onClick={() => onBulkExport?.()}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectAll?.([])}
              className="inline-flex h-7.5 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
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
