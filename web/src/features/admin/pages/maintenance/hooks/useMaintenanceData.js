import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../../shared/hooks/useAuth";
import { showNotification } from "../../../../../shared/utils/notification";
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
} from "../../../../../shared/hooks/queries/useMaintenance";
import { maintenanceApi } from "../../../../../shared/api/maintenanceApi";
import {
  getAllowedAdminMaintenanceStatuses,
  LOCKED_ADMIN_MAINTENANCE_STATUSES,
} from "../../../../../shared/utils/maintenanceConfig";
import {
  buildUploadedAdminAttachment,
  createAttachmentClientId,
  createFilterPayload,
  createReportFilterPayload,
  getDefaultMaintenanceReportRange,
  getFormSummaryMessage,
  getMaintenanceApiErrorMessage,
  getMaintenanceAttachmentUri,
  getMaintenanceRequestUploadId,
  getReportFilenameBase,
  getRequestBranch,
  isBlockingWorkLogAttachment,
  isUploadedWorkLogAttachment,
  MANAGEMENT_SUMMARY_CARDS,
  mapMaintenanceApiErrors,
  matchesSlaFilter,
  matchesSummaryCard,
  normalizeApiValidationDetail,
  normalizeMaintenanceBranch,
  PROVIDER_MANUAL_CHOICE,
  PROVIDER_NONE_CHOICE,
  TEXT_MIN_LENGTHS,
  urgencyRank,
  validateAmount,
  validateMinimumText,
  validatePhilippineMobile,
  validateProgressAttachmentFile,
} from "../maintenanceUtils";

export function useMaintenanceData() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const userBranch = normalizeMaintenanceBranch(user?.branch);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    ["requests", "analytics", "branch_reports", "service_providers"].includes(requestedTab)
      ? requestedTab
      : "requests",
  );
  const defaultReportRange = useMemo(() => getDefaultMaintenanceReportRange(), []);

  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveView, setArchiveView] = useState("active");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const requestedBranch = searchParams.get("branch");
  const [branchFilter, setBranchFilter] = useState(() =>
    requestedBranch && isOwner ? requestedBranch : "all",
  );
  const [sortMode, setSortMode] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [summaryCardKey, setSummaryCardKey] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [analyticsFilters, setAnalyticsFilters] = useState({
    branch: isOwner ? "all" : userBranch,
    dateFrom: defaultReportRange.dateFrom,
    dateTo: defaultReportRange.dateTo,
    status: "all",
    requestType: "all",
    urgency: "all",
    provider: "all",
    assignmentStatus: "all",
    slaHealth: "all",
    overdueOnly: false,
  });

  const [branchReportFilters, setBranchReportFilters] = useState({
    branch: isOwner ? "all" : userBranch,
    dateFrom: defaultReportRange.dateFrom,
    dateTo: defaultReportRange.dateTo,
    status: "all",
    requestType: "all",
    urgency: "all",
    provider: "all",
    assignmentStatus: "all",
    slaHealth: "all",
    overdueOnly: false,
  });

  const [analyticsRequestPage, setAnalyticsRequestPage] = useState(1);
  const [branchReportRequestPage, setBranchReportRequestPage] = useState(1);

  const [selectedRequestId, setSelectedRequestId] = useState(null);
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

  const [archiveDialogMode, setArchiveDialogMode] = useState(null);
  const [branchAssignmentDialog, setBranchAssignmentDialog] = useState({
    open: false,
    branch: "",
    error: "",
  });
  const [reportPreview, setReportPreview] = useState(null);
  const [isCopyingReport, setIsCopyingReport] = useState(false);
  const [sendTenantSummaryDialogOpen, setSendTenantSummaryDialogOpen] = useState(false);
  const [updateType, setUpdateType] = useState("status_update");
  const [attachmentRemovalDialog, setAttachmentRemovalDialog] = useState({
    open: false,
    target: null,
    scope: "",
    reason: "",
    customReason: "",
    error: "",
  });

  const listFilters = useMemo(
    () =>
      createFilterPayload({
        status: statusFilter,
        requestType: requestTypeFilter,
        urgency: urgencyFilter,
        dateFrom,
        dateTo,
        branch: isOwner ? branchFilter : null,
        archiveView,
      }),
    [
      archiveView,
      branchFilter,
      dateFrom,
      dateTo,
      isOwner,
      requestTypeFilter,
      statusFilter,
      urgencyFilter,
    ],
  );

  const summaryFilters = useMemo(
    () =>
      createFilterPayload({
        requestType: requestTypeFilter,
        urgency: urgencyFilter,
        dateFrom,
        dateTo,
        branch: isOwner ? branchFilter : null,
        archiveView,
      }),
    [archiveView, branchFilter, dateFrom, dateTo, isOwner, requestTypeFilter, urgencyFilter],
  );

  const analyticsQueryFilters = useMemo(
    () => createReportFilterPayload(analyticsFilters, { isOwner, userBranch }),
    [analyticsFilters, isOwner, userBranch],
  );
  const branchReportQueryFilters = useMemo(
    () => createReportFilterPayload(branchReportFilters, { isOwner, userBranch }),
    [branchReportFilters, isOwner, userBranch],
  );

  const {
    data: requestsData,
    isLoading,
    isError,
    error,
  } = useAdminMaintenanceRequests(listFilters);
  const { data: summaryData } = useAdminMaintenanceRequests(summaryFilters);
  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    error: analyticsError,
  } = useMaintenanceAnalytics(analyticsQueryFilters, {
    enabled: activeTab === "analytics",
  });
  const {
    data: branchReportData,
    isLoading: isBranchReportLoading,
    isError: isBranchReportError,
    error: branchReportError,
  } = useMaintenanceBranchReport(branchReportQueryFilters, {
    enabled: activeTab === "branch_reports",
  });
  const {
    data: providerReportData,
    isLoading: isProviderReportLoading,
    isError: isProviderReportError,
    error: providerReportError,
  } = useMaintenanceProviderReport(branchReportQueryFilters, {
    enabled: activeTab === "service_providers",
  });
  const {
    data: requestDetailData,
    isLoading: isDetailLoading,
  } = useMaintenanceRequest(selectedRequestId);

  const updateRequestMutation = useUpdateMaintenanceRequest();
  const sendReplyMutation = useSendMaintenanceReply();
  const saveProofMutation = useSaveMaintenanceProof();
  const removeAttachmentMutation = useRemoveMaintenanceAttachment();
  const archiveRequestMutation = useArchiveMaintenanceRequest();
  const restoreRequestMutation = useRestoreMaintenanceRequest();
  const assignBranchMutation = useAssignMaintenanceBranch();
  const assignProviderMutation = useAssignMaintenanceProvider();
  const generateUpdateMutation = useGenerateMaintenanceUpdate();
  const generateReportMutation = useGenerateMaintenanceReport();
  const sendTenantSummaryMutation = useSendMaintenanceTenantSummary();
  const suggestProviderMutation = useSuggestMaintenanceProvider();

  const requests = requestsData?.requests || [];
  const summaryRequests = summaryData?.requests || requests;
  const selectedRequest = requestDetailData?.request || null;

  const providerFilters = useMemo(() => {
    if (!selectedRequest) return {};
    const branchId = getRequestBranch(selectedRequest);
    const category = selectedRequest.request_type
      ? selectedRequest.request_type
      : "";
    return { branchId, category };
  }, [selectedRequest]);

  const {
    data: providerData,
    isLoading: isLoadingProviders,
  } = useServiceProviders(providerFilters, {
    enabled: Boolean(selectedRequest && getRequestBranch(selectedRequest)),
  });

  const serviceProviders = providerData?.providers || [];

  const summaryItems = useMemo(
    () =>
      MANAGEMENT_SUMMARY_CARDS.map((item) => ({
        ...item,
        value: summaryRequests.filter((request) =>
          matchesSummaryCard({
            request,
            cardKey: item.key,
            dateFrom,
            dateTo,
          }),
        ).length,
        trend: item.description,
      })),
    [dateFrom, dateTo, summaryRequests],
  );

  const activeSummaryIndex = MANAGEMENT_SUMMARY_CARDS.findIndex(
    (item) => item.key === summaryCardKey,
  );

  const sortedRequests = useMemo(() => {
    const nextRequests = [...requests];
    nextRequests.sort((left, right) => {
      if (sortMode === "urgency") {
        const urgencyDelta =
          (urgencyRank[left.urgency] ?? 99) - (urgencyRank[right.urgency] ?? 99);
        if (urgencyDelta !== 0) return urgencyDelta;
      }
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
    return nextRequests;
  }, [requests, sortMode]);

  const searchedRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedRequests;

    return sortedRequests.filter((request) => {
      const haystack = [
        request.request_id,
        request.description,
        request.assigned_to,
        request.user_id,
        request.tenant?.user_id,
        request.tenant?.full_name,
        request.tenant?.branch,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, sortedRequests]);

  const filteredRequests = useMemo(
    () =>
      searchedRequests.filter(
        (request) =>
          matchesSlaFilter({ request, slaFilter }) &&
          matchesSummaryCard({
            request,
            cardKey: summaryCardKey,
            dateFrom,
            dateTo,
          }),
      ),
    [dateFrom, dateTo, searchedRequests, slaFilter, summaryCardKey],
  );

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setArchiveView("active");
    setRequestTypeFilter("all");
    setUrgencyFilter("all");
    setSlaFilter("all");
    setDateFrom("");
    setDateTo("");
    setBranchFilter(isOwner ? "all" : userBranch);
    setSortMode("newest");
    setSearchQuery("");
    setSummaryCardKey(null);
    setShowAdvancedFilters(false);
    setCurrentPage(1);
  };

  return {
    isOwner,
    userBranch,
    activeTab,
    handleTabChange,

    // Filters
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

    // Query Data
    requests,
    summaryRequests,
    filteredRequests,
    isLoading,
    isError,
    error,
    currentPage,
    setCurrentPage,

    // Detail & Selected Request
    selectedRequestId,
    setSelectedRequestId,
    selectedRequest,
    isDetailLoading,
    serviceProviders,
    isLoadingProviders,

    // Summary Items
    summaryItems,
    activeSummaryIndex,

    // Analytics / Reports
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

    // Modals state
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

    // Mutations
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
  };
}
