import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ClipboardList,
  Clock3,
  FileText,
  MessageSquare,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { showNotification } from "../../../shared/utils/notification";
import {
  useAdminMaintenanceRequests,
  useArchiveMaintenanceRequest,
  useAssignMaintenanceBranch,
  useAssignMaintenanceProvider,
  useGenerateMaintenanceReport,
  useGenerateMaintenanceUpdate,
  useMaintenanceAnalytics,
  useMaintenanceBranchReport,
  useMaintenanceProviderReport,
  useMaintenanceRequest,
  useRemoveMaintenanceAttachment,
  useRestoreMaintenanceRequest,
  useSaveMaintenanceProof,
  useSendMaintenanceReply,
  useSendMaintenanceTenantSummary,
  useServiceProviders,
  useSuggestMaintenanceProvider,
  useUpdateMaintenanceRequest,
} from "../../../shared/hooks/queries/useMaintenance";
import { maintenanceApi } from "../../../shared/api/maintenanceApi";
import {
  getAllowedAdminMaintenanceStatuses,
  LOCKED_ADMIN_MAINTENANCE_STATUSES,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
  formatMaintenanceStatus,
} from "../../../shared/utils/maintenanceConfig";
import { DataTable, DetailDrawer, PageShell } from "../components/shared";
import { DrawerSkeleton } from "../../../shared/components/LoadingSkeletons";

import {
  ARCHIVE_FILTER_OPTIONS,
  buildMaintenanceTimeline,
  buildUploadedAdminAttachment,
  createAttachmentClientId,
  createFilterPayload,
  createReportFilterPayload,
  exportCsvFile,
  fmtDate,
  fmtDateTime,
  formatMaintenanceCsvRows,
  formatMaintenanceReportAsText,
  getDefaultMaintenanceReportRange,
  getFormSummaryMessage,
  getMaintenanceApiErrorMessage,
  getMaintenanceAttachmentLabel,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  getMaintenanceRequestUploadId,
  getReportFilenameBase,
  getRequestBranch,
  getSlaTone,
  getStatusDotClass,
  getStatusTextClass,
  getWorkLogAttachmentKey,
  hasValidRequestBranch,
  isBlockingWorkLogAttachment,
  isRemoteUri,
  isUploadedWorkLogAttachment,
  ITEMS_PER_PAGE,
  MAINTENANCE_TABS,
  MANAGEMENT_SUMMARY_CARDS,
  mapMaintenanceApiErrors,
  matchesSlaFilter,
  matchesSummaryCard,
  normalizeApiValidationDetail,
  normalizeMaintenanceAttachments,
  normalizeMaintenanceBranch,
  PROVIDER_MANUAL_CHOICE,
  PROVIDER_NONE_CHOICE,
  SLA_FILTER_OPTIONS,
  TEXT_MIN_LENGTHS,
  urgencyRank,
  validateAmount,
  validateMinimumText,
  validatePhilippineMobile,
  validateProgressAttachmentFile,
  formatSlaState,
} from "./maintenance/maintenanceUtils";

import { BranchBadge } from "./maintenance/components/BranchBadge";
import { SectionBadge } from "./maintenance/components/SectionBadge";
import { MaintenanceTimeline } from "./maintenance/components/MaintenanceTimeline";
import { ConfirmationModal } from "./maintenance/components/ConfirmationModal";
import { AssignBranchModal } from "./maintenance/components/AssignBranchModal";
import { AttachmentRemovalModal } from "./maintenance/components/AttachmentRemovalModal";
import { ServiceProviderAssignmentPanel } from "./maintenance/components/ServiceProviderAssignmentPanel";
import { MaintenanceSummaryCards } from "./maintenance/components/MaintenanceSummaryCards";
import { MaintenanceFilters } from "./maintenance/components/MaintenanceFilters";
import {
  AnalyticsRequestsTable,
  MaintenanceTable,
  ProviderPerformanceTable,
} from "./maintenance/components/MaintenanceTable";
import {
  MaintenanceAnalyticsCharts,
  MaintenanceExportDropdown,
  MaintenanceMetricsGrid,
  MaintenanceReportFilters,
  ReportPreviewModal,
} from "./maintenance/components/MaintenanceReportModal";
import { useMaintenanceData } from "./maintenance/hooks/useMaintenanceData";

export default function AdminMaintenancePage() {
  const data = useMaintenanceData();
  const {
    isOwner,
    userBranch,
    activeTab,
    handleTabChange,
    statusFilter,
    setStatusFilter,
    archiveView,
    setArchiveView,
    requestTypeFilter,
    setRequestTypeFilter,
    urgencyFilter,
    setUrgencyFilter,
    slaFilter,
    setSlaFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    branchFilter,
    setBranchFilter,
    sortMode,
    setSortMode,
    searchQuery,
    setSearchQuery,
    summaryCardKey,
    setSummaryCardKey,
    showAdvancedFilters,
    setShowAdvancedFilters,
    handleResetFilters,
    requests,
    summaryRequests,
    filteredRequests,
    isLoading,
    isError,
    error,
    currentPage,
    setCurrentPage,
    selectedRequestId,
    setSelectedRequestId,
    selectedRequest,
    isDetailLoading,
    serviceProviders,
    isLoadingProviders,
    summaryItems,
    activeSummaryIndex,
    analyticsData,
    isAnalyticsLoading,
    isAnalyticsError,
    analyticsError,
    analyticsFilters,
    setAnalyticsFilters,
    analyticsRequestPage,
    setAnalyticsRequestPage,
    branchReportData,
    isBranchReportLoading,
    isBranchReportError,
    branchReportError,
    branchReportFilters,
    setBranchReportFilters,
    branchReportRequestPage,
    setBranchReportRequestPage,
    providerReportData,
    isProviderReportLoading,
    isProviderReportError,
    providerReportError,
    reportPreview,
    setReportPreview,
    archiveDialogMode,
    setArchiveDialogMode,
    branchAssignmentDialog,
    setBranchAssignmentDialog,
    attachmentRemovalDialog,
    setAttachmentRemovalDialog,
    sendTenantSummaryDialogOpen,
    setSendTenantSummaryDialogOpen,
    updateRequestMutation,
    sendReplyMutation,
    saveProofMutation,
    removeAttachmentMutation,
    archiveRequestMutation,
    restoreRequestMutation,
    assignBranchMutation,
    assignProviderMutation,
    generateUpdateMutation,
    generateReportMutation,
    sendTenantSummaryMutation,
    suggestProviderMutation,
  } = data;

  const [draftStatus, setDraftStatus] = useState("viewed");
  const [draftNotes, setDraftNotes] = useState("");
  const [providerChoice, setProviderChoice] = useState(PROVIDER_NONE_CHOICE);
  const [manualProvider, setManualProvider] = useState({
    providerName: "",
    contactNumber: "",
    serviceType: "",
    notes: "",
  });
  const [saveManualProviderForFuture, setSaveManualProviderForFuture] = useState(false);
  const [providerFieldErrors, setProviderFieldErrors] = useState({});
  const [providerFormMessage, setProviderFormMessage] = useState("");
  const [providerSuggestion, setProviderSuggestion] = useState(null);
  const [draftWorkLogNote, setDraftWorkLogNote] = useState("");
  const [draftWorkLogAttachments, setDraftWorkLogAttachments] = useState([]);
  const [uploadingUpdateAttachment, setUploadingUpdateAttachment] = useState(false);
  const [updateFieldErrors, setUpdateFieldErrors] = useState({});
  const [updateFormMessage, setUpdateFormMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploadingReplyAttachment, setUploadingReplyAttachment] = useState(false);
  const [replyFieldErrors, setReplyFieldErrors] = useState({});
  const [replyFormMessage, setReplyFormMessage] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofAttachments, setProofAttachments] = useState([]);
  const [uploadingProofAttachment, setUploadingProofAttachment] = useState(false);
  const [proofFieldErrors, setProofFieldErrors] = useState({});
  const [proofFormMessage, setProofFormMessage] = useState("");
  const [updateType, setUpdateType] = useState("status_update");

  const selectedRequestStatusOptions = useMemo(
    () => getAllowedAdminMaintenanceStatuses(selectedRequest?.status),
    [selectedRequest?.status],
  );
  const isSelectedRequestLocked = LOCKED_ADMIN_MAINTENANCE_STATUSES.includes(
    selectedRequest?.status || "",
  );
  const hasDraftChanges = Boolean(selectedRequest) && (
    draftStatus !== (selectedRequest.status || "") ||
    draftNotes.trim() !== String(selectedRequest.notes || "").trim() ||
    Boolean(draftWorkLogNote.trim()) ||
    draftWorkLogAttachments.length > 0
  );
  const timelineItems = useMemo(
    () => buildMaintenanceTimeline(selectedRequest),
    [selectedRequest],
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (statusFilter !== "all") {
      chips.push({ key: `status-${statusFilter}`, label: `Status: ${formatMaintenanceStatus(statusFilter)}` });
    }
    if (archiveView !== "active") {
      const archiveLabel = ARCHIVE_FILTER_OPTIONS.find((item) => item.key === archiveView)?.label || archiveView;
      chips.push({ key: `archive-${archiveView}`, label: `View: ${archiveLabel}` });
    }
    if (requestTypeFilter !== "all") {
      chips.push({ key: `type-${requestTypeFilter}`, label: `Type: ${getMaintenanceTypeMeta(requestTypeFilter).label}` });
    }
    if (urgencyFilter !== "all") {
      chips.push({ key: `urgency-${urgencyFilter}`, label: `Urgency: ${getMaintenanceUrgencyMeta(urgencyFilter).label}` });
    }
    if (slaFilter !== "all") {
      const slaLabel = SLA_FILTER_OPTIONS.find((item) => item.key === slaFilter)?.label || slaFilter;
      chips.push({ key: `sla-${slaFilter}`, label: `SLA Health: ${slaLabel}` });
    }
    if (dateFrom) chips.push({ key: `from-${dateFrom}`, label: `From: ${fmtDate(dateFrom)}` });
    if (dateTo) chips.push({ key: `to-${dateTo}`, label: `To: ${fmtDate(dateTo)}` });
    return chips;
  }, [archiveView, dateFrom, dateTo, requestTypeFilter, slaFilter, statusFilter, urgencyFilter]);

  const handleExport = () => {
    exportCsvFile(formatMaintenanceCsvRows(filteredRequests), "maintenance-requests-list");
  };

  const handleSummaryFilter = (index) => {
    const cardKey = MANAGEMENT_SUMMARY_CARDS[index]?.key;
    if (!cardKey) return;
    setSummaryCardKey((current) => (current === cardKey ? null : cardKey));
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Maintenance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage tenant repair requests, reporting, service provider performance, and branch maintenance insights.
        </p>
      </div>

      <PageShell>
        <MaintenanceSummaryCards
          summaryItems={summaryItems}
          activeSummaryIndex={activeSummaryIndex}
          onSummaryFilter={handleSummaryFilter}
        />

        <PageShell.Actions>
          {activeTab === "requests" ? (
            <MaintenanceFilters
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              archiveView={archiveView}
              branchFilter={branchFilter}
              urgencyFilter={urgencyFilter}
              slaFilter={slaFilter}
              requestTypeFilter={requestTypeFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              sortMode={sortMode}
              showAdvancedFilters={showAdvancedFilters}
              isOwner={isOwner}
              filteredRequestsCount={filteredRequests.length}
              summaryRequestsCount={summaryRequests.length}
              activeFilterChips={activeFilterChips}
              onSearchQueryChange={setSearchQuery}
              onStatusFilterChange={setStatusFilter}
              onArchiveViewChange={setArchiveView}
              onBranchFilterChange={setBranchFilter}
              onUrgencyFilterChange={setUrgencyFilter}
              onSlaFilterChange={setSlaFilter}
              onRequestTypeFilterChange={setRequestTypeFilter}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onSortModeChange={setSortMode}
              onToggleAdvancedFilters={() => setShowAdvancedFilters((curr) => !curr)}
              onExport={handleExport}
              onResetFilters={handleResetFilters}
            />
          ) : null}
        </PageShell.Actions>

        <PageShell.Content>
          {activeTab === "requests" ? (
            <MaintenanceTable
              requests={filteredRequests}
              isLoading={isLoading}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onRowClick={(row) => setSelectedRequestId(row.request_id)}
            />
          ) : null}

          {activeTab === "analytics" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Maintenance Analytics Dashboard</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Performance insights based on recorded maintenance data.</p>
                </div>
              </div>
              <MaintenanceReportFilters
                filters={analyticsFilters}
                isOwner={isOwner}
                userBranch={userBranch}
                providerOptions={analyticsData?.providerOptions || []}
                onChange={(key, val) => setAnalyticsFilters((curr) => ({ ...curr, [key]: val }))}
                title="Analytics filters"
              />
              {isAnalyticsError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                  {analyticsError?.message || "Unable to load maintenance analytics."}
                </div>
              ) : isAnalyticsLoading ? (
                <DrawerSkeleton rows={5} />
              ) : (
                <>
                  <MaintenanceMetricsGrid summary={analyticsData?.summary} isOwner={isOwner} />
                  <MaintenanceAnalyticsCharts data={analyticsData} isOwner={isOwner} />
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h3 className="mb-3 text-sm font-semibold text-card-foreground">Filtered Maintenance Requests</h3>
                    <AnalyticsRequestsTable
                      requests={analyticsData?.requests || []}
                      isLoading={isAnalyticsLoading}
                      currentPage={analyticsRequestPage}
                      onPageChange={setAnalyticsRequestPage}
                      onRowClick={(id) => setSelectedRequestId(id)}
                    />
                  </section>
                </>
              )}
            </div>
          ) : null}

          {activeTab === "branch_reports" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Branch-Level Maintenance Report</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Generate official branch reports from selected filters.</p>
                </div>
              </div>
              <MaintenanceReportFilters
                filters={branchReportFilters}
                isOwner={isOwner}
                userBranch={userBranch}
                providerOptions={branchReportData?.providerOptions || []}
                onChange={(key, val) => setBranchReportFilters((curr) => ({ ...curr, [key]: val }))}
                title="Report filters"
              />
              {isBranchReportError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                  {branchReportError?.message || "Unable to generate branch report."}
                </div>
              ) : isBranchReportLoading ? (
                <DrawerSkeleton rows={5} />
              ) : (
                <section className="rounded-xl border border-border bg-card p-5">
                  <MaintenanceMetricsGrid summary={branchReportData?.summary} isOwner={isOwner} />
                  <div className="mt-5">
                    <AnalyticsRequestsTable
                      requests={branchReportData?.requests || []}
                      isLoading={isBranchReportLoading}
                      currentPage={branchReportRequestPage}
                      onPageChange={setBranchReportRequestPage}
                      onRowClick={(id) => setSelectedRequestId(id)}
                    />
                  </div>
                </section>
              )}
            </div>
          ) : null}

          {activeTab === "service_providers" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Service Provider Performance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Assignment, completion, and overdue performance by provider.</p>
                </div>
              </div>
              <ProviderPerformanceTable
                providers={providerReportData?.providers || []}
                isLoading={isProviderReportLoading}
              />
            </div>
          ) : null}

          {selectedRequestId ? (
            <DetailDrawer
              width={1200}
              open={Boolean(selectedRequestId)}
              onClose={() => setSelectedRequestId(null)}
              title="Maintenance Request"
              subtitle={selectedRequest ? `Request #${selectedRequest.request_id}` : ""}
            >
              {isDetailLoading || !selectedRequest ? (
                <div className="px-6 py-6">
                  <DrawerSkeleton rows={4} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-5">
                      <DetailDrawer.Section label="Request Details">
                        <DetailDrawer.Row label="Tenant" value={selectedRequest.tenant?.full_name || "Unknown"} />
                        <DetailDrawer.Row label="Branch" value={getRequestBranch(selectedRequest)} />
                        <DetailDrawer.Row label="Type" value={getMaintenanceTypeMeta(selectedRequest.request_type).label} />
                        <DetailDrawer.Row label="Urgency" value={getMaintenanceUrgencyMeta(selectedRequest.urgency).label} />
                        <DetailDrawer.Row label="Status" value={formatMaintenanceStatus(selectedRequest.status)} />
                        <DetailDrawer.Row label="Submitted" value={fmtDateTime(selectedRequest.created_at)} />
                      </DetailDrawer.Section>
                    </div>

                    <ServiceProviderAssignmentPanel
                      request={selectedRequest}
                      providers={serviceProviders}
                      isLoadingProviders={isLoadingProviders}
                      selectedChoice={providerChoice}
                      manualProvider={manualProvider}
                      saveForFuture={saveManualProviderForFuture}
                      fieldErrors={providerFieldErrors}
                      formMessage={providerFormMessage}
                      suggestion={providerSuggestion}
                      onChoiceChange={setProviderChoice}
                      onManualChange={(k, v) => setManualProvider((curr) => ({ ...curr, [k]: v }))}
                      onSaveForFutureChange={setSaveManualProviderForFuture}
                    />
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5">
                    <MaintenanceTimeline items={timelineItems} />
                  </div>
                </div>
              )}
            </DetailDrawer>
          ) : null}

          <ReportPreviewModal
            open={Boolean(reportPreview)}
            report={reportPreview}
            request={selectedRequest}
            onClose={() => setReportPreview(null)}
          />

          <ConfirmationModal
            open={sendTenantSummaryDialogOpen}
            title="Send Tenant Summary?"
            message="This will send the tenant-safe maintenance summary to the tenant."
            confirmLabel="Send Summary"
            confirmTone="emerald"
            onCancel={() => setSendTenantSummaryDialogOpen(false)}
          />

          <ConfirmationModal
            open={Boolean(archiveDialogMode)}
            title={archiveDialogMode === "restore" ? "Restore Request" : "Archive Request"}
            message="Confirm request action"
            confirmLabel={archiveDialogMode === "restore" ? "Restore Request" : "Archive Request"}
            confirmTone={archiveDialogMode === "restore" ? "emerald" : "rose"}
            onCancel={() => setArchiveDialogMode(null)}
          />

          <AssignBranchModal
            open={branchAssignmentDialog.open}
            branch={branchAssignmentDialog.branch}
            error={branchAssignmentDialog.error}
            onCancel={() => setBranchAssignmentDialog((curr) => ({ ...curr, open: false }))}
          />

          <AttachmentRemovalModal
            open={attachmentRemovalDialog.open}
            scope={attachmentRemovalDialog.scope}
            reason={attachmentRemovalDialog.reason}
            customReason={attachmentRemovalDialog.customReason}
            error={attachmentRemovalDialog.error}
            onCancel={() => setAttachmentRemovalDialog((curr) => ({ ...curr, open: false }))}
          />
        </PageShell.Content>
      </PageShell>
    </div>
  );
}
