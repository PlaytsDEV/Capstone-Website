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
} from "../../../../../shared/utils/maintenanceConfig";
import { formatBranch, fmtDate, getRelativeTime } from "../../../../../shared/utils/formatDate";
import { DataTable } from "../../../components/shared";
import ProfileAvatar from "../../../../../shared/components/ProfileAvatar";
import {
  formatCleanRoomName,
  getAssignedProviderName,
  getAvatarPalette,
  getRequestBranch,
  getStatusBadgeMeta,
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
        key: "tenant",
        label: "Tenant & Location",
        width: "21%",
        render: (row) => {
          const rawName = row.tenant?.full_name || row.tenantName || "";
          const isDeleted =
            !rawName ||
            rawName.toLowerCase().includes("deleted") ||
            row.tenant?.is_deleted ||
            row.is_deleted;
          const palette = getAvatarPalette(rawName);
          const branchName = formatBranch(getRequestBranch(row));
          const rawRoom = row.room_number || row.room?.name || row.roomId?.name || "";
          const roomInfo = formatCleanRoomName(rawRoom);
          const bedSlot = row.bedIdentifier || row.bed?.bedNumber || row.bedNumber || null;

          if (isDeleted) {
            return (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                  <UserX size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Deleted Account
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{branchName}</div>
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
            <div className="flex items-center gap-3">
              <ProfileAvatar
                user={{ name: rawName }}
                initials={initials}
                size={36}
                defaultOnly
              />
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 break-words"
                  title={rawName}
                >
                  {rawName}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  <span>{branchName}</span>
                  {roomInfo && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">
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
        width: "22%",
        render: (row) => {
          const typeMeta = getMaintenanceTypeMeta(row.request_type);
          const TypeIcon = typeMeta.icon;
          const attachmentCount = row.attachments?.length || 0;

          return (
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 mt-0.5"
                title={typeMeta.label}
              >
                <TypeIcon size={16} className="text-slate-600 dark:text-slate-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {typeMeta.label}
                  </span>
                  {attachmentCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"
                      title={`${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`}
                    >
                      <Paperclip size={12} className="text-slate-400 dark:text-slate-500" />
                      <span>{attachmentCount}</span>
                    </span>
                  )}
                </div>
                <p
                  className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words mt-0.5 leading-relaxed"
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
        width: "14%",
        render: (row) => {
          const rawUrgency = String(row.urgency || "").toLowerCase();
          const isUrgent = rawUrgency === "urgent" || rawUrgency === "high" || rawUrgency === "emergency";
          const isLow = rawUrgency === "low";
          const urgencyLabel = isLow ? "Low" : isUrgent ? "Urgent" : "Standard";

          const isTerminal = ["completed", "rejected", "cancelled", "closed", "resolved"].includes(row.status);
          const rawSla = String(row.slaState?.label || row.slaState || "").toLowerCase();

          let slaElement = null;
          if (!isTerminal) {
            if (rawSla.includes("delay") || rawSla.includes("overdue") || rawSla.includes("breach")) {
              slaElement = (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>Overdue</span>
                </span>
              );
            } else if (rawSla.includes("soon") || rawSla.includes("risk") || rawSla.includes("priority")) {
              slaElement = (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Clock size={13} className="shrink-0" />
                  <span>Due soon</span>
                </span>
              );
            } else {
              slaElement = (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <span>On schedule</span>
                </span>
              );
            }
          }

          return (
            <div className="flex flex-col items-start gap-1.5">
              {isUrgent ? (
                <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Urgent
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {urgencyLabel}
                </span>
              )}
              {slaElement}
            </div>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        width: "12%",
        render: (row) => {
          const statusMeta = getStatusBadgeMeta(row.status);

          return (
            <div className="flex flex-col items-start gap-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${statusMeta.badge}`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${statusMeta.dot}`} />
                <span>{formatMaintenanceStatus(row.status, { includeStage: true })}</span>
              </span>
              {row.status === "resolved" && (
                <span
                  id={`awaiting-verification-badge-${row.request_id || row._id || row.id}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-transparent text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                >
                  Awaiting Verification
                </span>
              )}
              {row.isReopened && row.status !== "reopened" && (
                <span
                  id={`reopened-badge-${row.request_id || row._id || row.id}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-transparent text-rose-700 dark:text-rose-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                >
                  Reopened
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "technician",
        label: "Technician",
        width: "17%",
        render: (row) => {
          const provider = getAssignedProviderName(row);
          if (!provider) {
            return (
              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal italic">
                Unassigned
              </span>
            );
          }
          return (
            <div className="flex items-start gap-2 min-w-0" title={provider}>
              <Wrench size={14} className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <span
                className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 break-words leading-snug"
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
              className="flex items-center justify-end gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block whitespace-nowrap">
                  {fmtDate(row.created_at)}
                </span>
                {relTime && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block whitespace-nowrap mt-0.5">
                    {relTime}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRowClick?.(row)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer shadow-2xs"
                title="Open maintenance request"
              >
                <span>Open</span>
                <ChevronRight size={13} className="text-slate-400" />
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 p-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-slate-700 dark:text-slate-300" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
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
