import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ClipboardList,
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
  useMaintenanceDuplicates,
  useMaintenanceRequest,
  useRemoveMaintenanceAttachment,
  useRestoreMaintenanceRequest,
  useSaveMaintenanceProof,
  useSendMaintenanceReply,
  useSendMaintenanceTenantSummary,
  useServiceProviders,
  useSuggestMaintenanceProvider,
  useUpdateMaintenanceCost,
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
import { BRANCH_OPTIONS } from "../../../shared/utils/constants";
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
  exportMaintenanceRequestsPdf,
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
import { CostAttributionCard } from "./maintenance/components/CostAttributionCard";
import { MaintenanceProofInspector } from "./maintenance/components/MaintenanceProofInspector";
import { MaintenanceSummaryCards } from "./maintenance/components/MaintenanceSummaryCards";
import { MaintenanceDetailModal } from "./maintenance/components/MaintenanceDetailModal";
import { MaintenanceFilters } from "./maintenance/components/MaintenanceFilters";
import { MaintenanceTable } from "./maintenance/components/MaintenanceTable";
import {
  MaintenanceExportDropdown,
  ReportPreviewModal,
} from "./maintenance/components/MaintenanceReportModal";
import { useMaintenanceData } from "./maintenance/hooks/useMaintenanceData";

export default function AdminMaintenancePage() {
  const data = useMaintenanceData();
  const {
    isOwner,
    userBranch,
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

  const { data: duplicateData } = useMaintenanceDuplicates(selectedRequest?.request_id);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (summaryCardKey) {
      const summaryCard = MANAGEMENT_SUMMARY_CARDS.find((c) => c.key === summaryCardKey);
      if (summaryCard) {
        chips.push({
          key: `card-${summaryCardKey}`,
          label: `Metric: ${summaryCard.label}`,
          onRemove: () => setSummaryCardKey(null),
        });
      }
    }
    if (statusFilter !== "all") {
      chips.push({
        key: `status-${statusFilter}`,
        label: `Status: ${formatMaintenanceStatus(statusFilter)}`,
        onRemove: () => setStatusFilter("all"),
      });
    }
    if (isOwner && branchFilter !== "all") {
      const branchOpt = BRANCH_OPTIONS.find((b) => b.value === branchFilter);
      chips.push({
        key: `branch-${branchFilter}`,
        label: `Branch: ${branchOpt?.label || branchFilter}`,
        onRemove: () => setBranchFilter("all"),
      });
    }
    if (archiveView !== "active") {
      const archiveLabel = ARCHIVE_FILTER_OPTIONS.find((item) => item.key === archiveView)?.label || archiveView;
      chips.push({
        key: `archive-${archiveView}`,
        label: `View: ${archiveLabel}`,
        onRemove: () => setArchiveView("active"),
      });
    }
    if (requestTypeFilter !== "all") {
      chips.push({
        key: `type-${requestTypeFilter}`,
        label: `Type: ${getMaintenanceTypeMeta(requestTypeFilter).label}`,
        onRemove: () => setRequestTypeFilter("all"),
      });
    }
    if (urgencyFilter !== "all") {
      chips.push({
        key: `urgency-${urgencyFilter}`,
        label: `Urgency: ${getMaintenanceUrgencyMeta(urgencyFilter).label}`,
        onRemove: () => setUrgencyFilter("all"),
      });
    }
    if (slaFilter !== "all") {
      const slaLabel = SLA_FILTER_OPTIONS.find((item) => item.key === slaFilter)?.label || slaFilter;
      chips.push({
        key: `sla-${slaFilter}`,
        label: `SLA: ${slaLabel}`,
        onRemove: () => setSlaFilter("all"),
      });
    }
    if (dateFrom) {
      chips.push({
        key: `from-${dateFrom}`,
        label: `From: ${fmtDate(dateFrom)}`,
        onRemove: () => setDateFrom(""),
      });
    }
    if (dateTo) {
      chips.push({
        key: `to-${dateTo}`,
        label: `To: ${fmtDate(dateTo)}`,
        onRemove: () => setDateTo(""),
      });
    }
    return chips;
  }, [
    archiveView,
    branchFilter,
    dateFrom,
    dateTo,
    isOwner,
    requestTypeFilter,
    slaFilter,
    statusFilter,
    summaryCardKey,
    urgencyFilter,
  ]);

  const handleExportCsv = () => {
    exportCsvFile(formatMaintenanceCsvRows(filteredRequests), "maintenance-requests-list");
  };

  const handleExportPdf = () => {
    exportMaintenanceRequestsPdf({
      requests: filteredRequests,
      summaryItems,
      branchFilter,
      statusFilter,
      searchQuery,
    });
  };

  const handleSummaryFilter = (index) => {
    const cardKey = MANAGEMENT_SUMMARY_CARDS[index]?.key;
    if (!cardKey) return;
    setSummaryCardKey((current) => (current === cardKey ? null : cardKey));
  };

  const handleQuickStatusChange = async (requestId, nextStatus) => {
    try {
      await updateRequestMutation.mutateAsync({
        requestId,
        payload: { status: nextStatus },
      });
      showNotification({
        title: "Request Updated",
        message: `Request #${requestId} is now ${formatMaintenanceStatus(nextStatus)}.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Update Failed",
        message: getMaintenanceApiErrorMessage(err, "Failed to update request status"),
        type: "error",
      });
    }
  };

  const handleAssignProvider = async () => {
    if (!selectedRequest) return;
    try {
      let payload;
      if (providerChoice === PROVIDER_NONE_CHOICE) {
        payload = {
          providerId: null,
          notes: manualProvider.notes?.trim() || "",
        };
      } else if (providerChoice === PROVIDER_MANUAL_CHOICE) {
        payload = {
          providerName: manualProvider.providerName.trim(),
          contactNumber: manualProvider.contactNumber.trim(),
          serviceType: manualProvider.serviceType.trim() || undefined,
          notes: manualProvider.notes?.trim() || "",
          saveForFuture: Boolean(saveManualProviderForFuture),
        };
      } else {
        payload = {
          providerId: providerChoice,
          notes: manualProvider.notes?.trim() || "",
        };
      }

      await assignProviderMutation.mutateAsync({
        requestId: selectedRequest.request_id,
        payload,
      });

      showNotification({
        title: "Provider Assigned",
        message: `Contractor details updated for ticket #${selectedRequest.request_id}.`,
        type: "success",
      });
      setProviderFieldErrors({});
      setProviderFormMessage("");
    } catch (err) {
      setProviderFormMessage(getMaintenanceApiErrorMessage(err, "Failed to assign provider."));
      showNotification({
        title: "Assignment Failed",
        message: getMaintenanceApiErrorMessage(err, "Failed to assign provider."),
        type: "error",
      });
    }
  };

  const handleSuggestProvider = async () => {
    if (!selectedRequest) return;
    try {
      const result = await suggestProviderMutation.mutateAsync({
        requestId: selectedRequest.request_id,
      });
      setProviderSuggestion(result?.data || result);
      showNotification({
        title: "Recommendation Ready",
        message: "AI suggested service providers based on branch coverage and history.",
        type: "info",
      });
    } catch (err) {
      showNotification({
        title: "Suggestion Failed",
        message: getMaintenanceApiErrorMessage(err, "Unable to generate provider suggestion."),
        type: "error",
      });
    }
  };

  const handleUseProviderSuggestion = (providerId) => {
    if (providerId) {
      setProviderChoice(providerId);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Maintenance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage tenant repair requests, contractor assignments, and resolution workflows.
        </p>
      </div>

      <PageShell>
        <PageShell.Summary>
          <MaintenanceSummaryCards
            summaryItems={summaryItems}
            activeSummaryIndex={activeSummaryIndex}
            onSummaryFilter={handleSummaryFilter}
          />
        </PageShell.Summary>

        <PageShell.Actions>
          <MaintenanceFilters
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            archiveView={archiveView}
            branchFilter={branchFilter}
            userBranch={userBranch}
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
            onExportCsv={handleExportCsv}
            onExportPdf={handleExportPdf}
            onResetFilters={handleResetFilters}
          />
        </PageShell.Actions>

        <PageShell.Content>
          <MaintenanceTable
            requests={filteredRequests}
            isLoading={isLoading}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onRowClick={(row) => {
              setSelectedRequestId(row.request_id);
              if (row.status === "pending") {
                handleQuickStatusChange(row.request_id, "viewed");
              }
            }}
          />

          <MaintenanceDetailModal
            open={Boolean(selectedRequestId)}
            onClose={() => setSelectedRequestId(null)}
            request={selectedRequest}
            isLoading={isDetailLoading}
            duplicateData={duplicateData}
            timelineItems={timelineItems}
            serviceProviders={serviceProviders}
            isLoadingProviders={isLoadingProviders}
            providerChoice={providerChoice}
            onProviderChoiceChange={setProviderChoice}
            manualProvider={manualProvider}
            onManualProviderChange={(k, v) => setManualProvider((curr) => ({ ...curr, [k]: v }))}
            saveManualProviderForFuture={saveManualProviderForFuture}
            onSaveManualProviderForFutureChange={setSaveManualProviderForFuture}
            providerFieldErrors={providerFieldErrors}
            providerFormMessage={providerFormMessage}
            providerSuggestion={providerSuggestion}
            onAssignProvider={handleAssignProvider}
            onSuggestProvider={handleSuggestProvider}
            onUseProviderSuggestion={handleUseProviderSuggestion}
            isAssigningProvider={assignProviderMutation.isPending}
            isSuggestingProvider={suggestProviderMutation.isPending}
            onQuickStatusChange={handleQuickStatusChange}
            onRemoveAttachment={(target) => {
              if (target) {
                setAttachmentRemovalDialog({
                  open: true,
                  scope: target.scope,
                  reason: "duplicate_or_invalid",
                  customReason: "",
                  error: null,
                });
              }
            }}
            canRemoveAttachments={true}
          />

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
