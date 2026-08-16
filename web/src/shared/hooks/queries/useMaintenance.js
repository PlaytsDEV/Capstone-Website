import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { maintenanceApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/** Fetch current tenant's maintenance requests */
export function useMyMaintenanceRequests(filters) {
  return useQuery({
    queryKey: queryKeys.maintenance.mine(filters),
    queryFn: () => maintenanceApi.getMyRequests(filters),
    placeholderData: keepPreviousData,
  });
}

/** Fetch maintenance requests for admins */
export function useAdminMaintenanceRequests(filters) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.maintenance.admin(filters),
    queryFn: () => maintenanceApi.getAdminAll(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,       // reduced from 15 s — less network churn
    refetchOnWindowFocus: false,   // tab-switching no longer triggers a fetch
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: queryKeys.maintenance.admin(filters) });

  return { ...query, refresh };
}

export function useMaintenanceAnalytics(filters, options = {}) {
  return useQuery({
    queryKey: ["maintenance", "analytics", filters],
    queryFn: () => maintenanceApi.getAdminAnalytics(filters),
    enabled: options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export function useMaintenanceBranchReport(filters, options = {}) {
  return useQuery({
    queryKey: ["maintenance", "branchReport", filters],
    queryFn: () => maintenanceApi.getAdminBranchReport(filters),
    enabled: options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export function useMaintenanceProviderReport(filters, options = {}) {
  return useQuery({
    queryKey: ["maintenance", "providerReport", filters],
    queryFn: () => maintenanceApi.getAdminProviderReport(filters),
    enabled: options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

/** Fetch single maintenance request */
export function useMaintenanceRequest(requestId) {
  return useQuery({
    queryKey: queryKeys.maintenance.detail(requestId),
    queryFn: () => maintenanceApi.getRequest(requestId),
    enabled: !!requestId,
  });
}

/** Create maintenance request */
export function useCreateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => maintenanceApi.createRequest(data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all }),
  });
}

/** Update a pending maintenance request (tenant) */
export function useUpdateMyMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, data }) =>
      maintenanceApi.updateMyRequest(requestId, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Cancel a pending maintenance request (tenant) */
export function useCancelMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId) => maintenanceApi.cancelRequest(requestId),
    onSuccess: (_data, requestId) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(requestId),
        });
      }
    },
  });
}

/** Reopen a resolved/completed maintenance request (tenant) */
export function useReopenMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, note }) =>
      maintenanceApi.reopenRequest(requestId, note),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Send a tenant reply on an existing maintenance request */
export function useSendTenantMaintenanceReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.sendTenantReply(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Update maintenance request status/notes/assignment (admin) */
export function useUpdateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.updateAdminRequestStatus(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Send a tenant-facing reply from admin/owner/staff */
export function useSendMaintenanceReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.sendAdminReply(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useSaveMaintenanceProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.saveAdminProof(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useRemoveMaintenanceAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.removeAdminAttachment(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useServiceProviders(filters, options = {}) {
  return useQuery({
    queryKey: queryKeys.maintenance.serviceProviders(filters),
    queryFn: () => maintenanceApi.getServiceProviders(filters),
    enabled: options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export function useAssignMaintenanceProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.assignAdminProvider(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      qc.invalidateQueries({ queryKey: ["maintenance", "serviceProviders"] });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useAssignMaintenanceBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, branch }) =>
      maintenanceApi.assignAdminBranch(requestId, { branch }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      qc.invalidateQueries({ queryKey: ["maintenance", "serviceProviders"] });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useGenerateMaintenanceUpdate() {
  return useMutation({
    mutationFn: ({ requestId }) => maintenanceApi.generateAdminUpdate(requestId),
  });
}

export function useGenerateMaintenanceReport() {
  return useMutation({
    mutationFn: ({ requestId, reportType }) =>
      maintenanceApi.generateAdminReport(requestId, { reportType }),
  });
}

export function useSendMaintenanceTenantSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId }) => maintenanceApi.sendAdminTenantSummary(requestId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useSuggestMaintenanceProvider() {
  return useMutation({
    mutationFn: ({ requestId }) => maintenanceApi.suggestAdminProvider(requestId),
  });
}

export function useRateMaintenanceProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, ...payload }) =>
      maintenanceApi.rateAdminProvider(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
      qc.invalidateQueries({ queryKey: ["serviceProviders"] });
    },
  });
}

export function useArchiveMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.archiveAdminRequest(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

export function useRestoreMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.restoreAdminRequest(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Update maintenance request cost attribution (admin) */
export function useUpdateMaintenanceCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.updateAdminCost(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Fetch potential duplicate requests for the same room */
export function useMaintenanceDuplicates(requestId) {
  return useQuery({
    queryKey: ["maintenance", "duplicates", requestId],
    queryFn: () => maintenanceApi.getAdminDuplicates(requestId),
    enabled: Boolean(requestId),
    staleTime: 30_000,
  });
}

/** Bulk update maintenance requests (admin) */
export function useBulkMaintenanceUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => maintenanceApi.bulkUpdateAdminRequests(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
    },
  });
}

/** Confirm resolution or reopen (tenant) */
export function useConfirmMaintenanceResolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.confirmResolution(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Schedule maintenance appointment window (admin) */
export function useScheduleAdminMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.scheduleAdminMaintenance(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Finalize and sign official completion report (admin) */
export function useFinalizeAdminMaintenanceReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }) =>
      maintenanceApi.finalizeAdminReport(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      if (variables?.requestId) {
        qc.invalidateQueries({
          queryKey: queryKeys.maintenance.detail(variables.requestId),
        });
      }
    },
  });
}

/** Backward-compatible alias for previous admin callers */
export const useMaintenanceByBranch = useAdminMaintenanceRequests;

export function useMaintenanceCompletionStats(days) {
  return useQuery({
    queryKey: ["maintenance", "completionStats", days],
    queryFn: () => maintenanceApi.getCompletionStats(days),
  });
}

export function useIssueFrequency(limit, months) {
  return useQuery({
    queryKey: ["maintenance", "issueFrequency", limit, months],
    queryFn: () => maintenanceApi.getIssueFrequency(limit, months),
  });
}

