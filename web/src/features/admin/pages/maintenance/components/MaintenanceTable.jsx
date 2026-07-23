import { useMemo } from "react";
import { formatMaintenanceStatus, getMaintenanceTypeMeta, getMaintenanceUrgencyMeta } from "../../../../../shared/utils/maintenanceConfig";
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
}) {
  const columns = useMemo(
    () => [
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
            <div className="text-xs text-muted-foreground">{row.request_id}</div>
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
        label: "Assigned Service Provider",
        render: (row) => getAssignedProviderName(row) || "Unassigned",
      },
      {
        key: "created_at",
        label: "Date",
        sortable: true,
        render: (row) => fmtDate(row.created_at),
      },
    ],
    [],
  );

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="overflow-hidden rounded-lg border border-border">
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
      { key: "assignedProvider", label: "Assigned Service Provider" },
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
              View Request
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
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
              onClick={() => {
                onRowClick?.(row.requestId);
                onGenerateReport?.("tenant", row.requestId);
              }}
            >
              Tenant Summary
            </button>
          </div>
        ),
      },
    ],
    [onGenerateReport, onRowClick],
  );

  return (
    <DataTable
      columns={analyticsColumns}
      data={requests}
      loading={isLoading}
      pagination={{
        pageSize: ITEMS_PER_PAGE,
        currentPage,
        onPageChange,
      }}
    />
  );
}

export function ProviderPerformanceTable({
  providers = [],
  isLoading = false,
}) {
  const providerColumns = useMemo(
    () => [
      { key: "providerName", label: "Provider Name" },
      { key: "contactNumber", label: "Contact Number", render: (row) => row.contactNumber || "Not recorded" },
      { key: "assignedRequests", label: "Assigned" },
      { key: "completedRequests", label: "Completed" },
      { key: "activeRequests", label: "Pending/In Progress" },
      { key: "overdueRequests", label: "Overdue" },
      { key: "averageCompletionTimeLabel", label: "Avg Completion" },
      { key: "lastAssignedRequestDate", label: "Last Assigned", render: (row) => row.lastAssignedRequestDate ? fmtDate(row.lastAssignedRequestDate) : "Not recorded" },
      { key: "relatedRequestTypes", label: "Request Types", render: (row) => row.relatedRequestTypes?.join(", ") || "Not recorded" },
    ],
    [],
  );

  return <DataTable columns={providerColumns} data={providers} loading={isLoading} />;
}
