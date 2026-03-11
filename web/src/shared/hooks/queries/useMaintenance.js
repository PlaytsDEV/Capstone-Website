import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { maintenanceApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/** Fetch current tenant's maintenance requests */
export function useMyMaintenanceRequests(limit, status) {
  return useQuery({
    queryKey: [...queryKeys.maintenance.all, "my", limit, status],
    queryFn: () => maintenanceApi.getMyRequests(limit, status),
  });
}

/** Fetch maintenance requests by branch (admin) */
export function useMaintenanceByBranch(limit, status, category) {
  return useQuery({
    queryKey: [...queryKeys.maintenance.all, "branch", limit, status, category],
    queryFn: () => maintenanceApi.getByBranch(limit, status, category),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

/** Update maintenance request status (admin) */
export function useUpdateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, status, completionNote }) =>
      maintenanceApi.updateRequest(requestId, status, completionNote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

/** Get completion statistics (admin) */
export function useMaintenanceCompletionStats(days) {
  return useQuery({
    queryKey: ["maintenance", "completionStats", days],
    queryFn: () => maintenanceApi.getCompletionStats(days),
  });
}

/** Get issue frequency stats (admin) */
export function useIssueFrequency(limit, months) {
  return useQuery({
    queryKey: ["maintenance", "issueFrequency", limit, months],
    queryFn: () => maintenanceApi.getIssueFrequency(limit, months),
  });
}
