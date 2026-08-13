import { useMemo } from "react";
import {
  Archive,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  Eye,
  Layers,
  Square,
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
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
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
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
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
        render: (row) => (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                getAvatarPalette(row.tenant?.full_name).bg
              } ${getAvatarPalette(row.tenant?.full_name).text}`}
            >
              {(row.tenant?.full_name || "T")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-card-foreground">
                {row.tenant?.full_name || "Unknown Tenant"}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.tenant?.user_id || row.user_id}
              </div>
            </div>
          </div>
        ),
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

          return (
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `${typeMeta.color}1A`,
                  color: typeMeta.color,
                }}
              >
                <TypeIcon size={16} />
              </span>
              <div>
                <div className="text-sm font-semibold text-card-foreground">
                  {typeMeta.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.attachments?.length || 0} attachment
                  {(row.attachments?.length || 0) === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "description",
        label: "Description",
        render: (row) => (
          <div>
            <div className="max-w-[240px] truncate text-sm text-muted-foreground">
              {row.description}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{row.request_id}</div>
          </div>
        ),
      },
      {
        key: "urgency",
        label: "Urgency",
        render: (row) => {
          const urgencyMeta = getMaintenanceUrgencyMeta(row.urgency);
          return (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                backgroundColor: `${urgencyMeta.color}1A`,
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
            className={`flex items-center gap-2 text-[13px] font-medium ${getStatusTextClass(
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
        render: (row) => (
          <span
            className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: getSlaTone(row.slaState).bg,
              color: getSlaTone(row.slaState).color,
            }}
          >
            {formatSlaState(row.slaState)}
          </span>
        ),
      },
      {
        key: "assigned_to",
        label: "Assigned Technician",
        render: (row) => (
          <span className="text-xs font-medium text-card-foreground">
            {getAssignedProviderName(row) || <span className="text-muted-foreground italic">Unassigned</span>}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Date",
        sortable: true,
        render: (row) => fmtDate(row.created_at),
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
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-muted/50 px-2 text-[11px] font-semibold text-card-foreground transition hover:bg-primary hover:text-primary-foreground"
                title="Acknowledge request"
              >
                <Eye size={12} />
                <span>Acknowledge</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onRowClick?.(row)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-semibold text-card-foreground transition hover:bg-muted"
            >
              <span>Open</span>
            </button>
          </div>
        ),
      },
    ],
    [allPageIds, isAllSelected, isSomeSelected, onQuickStatusChange, onRowClick, onSelectAll, onToggleSelect, selectedRequestIds],
  );

  return (
    <div className="mt-4 space-y-4">
      {/* Sticky Floating Bulk Action Bar */}
      {selectedRequestIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selectedRequestIds.length}
            </span>
            <span className="text-xs font-semibold text-card-foreground">
              {selectedRequestIds.length} request{selectedRequestIds.length === 1 ? "" : "s"} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBulkUpdateStatus?.("viewed")}
              disabled={isBulkUpdating}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted"
            >
              <Eye size={13} />
              <span>Mark as Viewed</span>
            </button>

            <button
              type="button"
              onClick={() => onBulkArchive?.()}
              disabled={isBulkUpdating}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted"
            >
              <Archive size={13} />
              <span>Archive</span>
            </button>

            <button
              type="button"
              onClick={() => onBulkExport?.()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted"
            >
              <Download size={13} />
              <span>Export Selected CSV</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectAll?.([])}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs text-muted-foreground hover:bg-muted"
              title="Clear selection"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
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
      { key: "requestId", label: "Request ID" },
      { key: "tenantName", label: "Tenant Name" },
      { key: "branchLabel", label: "Branch" },
      { key: "room", label: "Room/Unit", render: (row) => row.room || "Not recorded" },
      { key: "requestTypeLabel", label: "Request Type" },
      { key: "urgencyLabel", label: "Urgency" },
      { key: "statusLabel", label: "Status" },
      { key: "assignedProvider", label: "Assigned Technician" },
      { key: "createdAt", label: "Created", render: (row) => fmtDate(row.createdAt) },
      { key: "updatedAt", label: "Last Updated", render: (row) => fmtDate(row.updatedAt) },
      { key: "resolutionAt", label: "Resolution", render: (row) => row.resolutionAt ? fmtDate(row.resolutionAt) : "Not completed" },
      {
        key: "sla",
        label: "SLA",
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.sla?.key === "overdue"
                ? "bg-rose-50 text-rose-700"
                : row.sla?.key === "due_soon"
                ? "bg-amber-50 text-amber-700"
                : row.sla?.key === "completed"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-sky-50 text-sky-700"
            }`}
          >
            {row.sla?.label || "On Track"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
              onClick={() => onRowClick?.(row.requestId)}
            >
              View Details
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
              onClick={() => {
                onRowClick?.(row.requestId);
                onGenerateReport?.("admin", row.requestId);
              }}
            >
              Admin Report
            </button>
          </div>
        ),
      },
    ],
    [onGenerateReport, onRowClick],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
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
          <span className="font-semibold text-card-foreground">
            {row.completionRate ? `${row.completionRate}%` : "N/A"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <DataTable
        columns={providerColumns}
        data={providers}
        loading={isLoading}
      />
    </div>
  );
}
