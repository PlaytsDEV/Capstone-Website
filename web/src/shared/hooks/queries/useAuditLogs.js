import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { auditApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/** Fetch audit logs with filters */
export function useAuditLogs(params, options = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.all(params),
    queryFn: () => auditApi.getLogs(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Fetch paginated audit logs with preserved envelope metadata */
export function usePaginatedAuditLogs(params, options = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.paged(params),
    queryFn: () => auditApi.getLogsPage(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Fetch audit log statistics */
export function useAuditStats(branch, options = {}) {
  return useQuery({
    queryKey: ["auditLogs", "stats", branch],
    queryFn: () => auditApi.getStats(branch),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Fetch owner-only failed login monitoring data */
export function useFailedLoginSignals(hours = 24, options = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.failedLogins(hours),
    queryFn: () => auditApi.getFailedLogins(hours),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Export audit logs */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (variables) => {
      if (variables && typeof variables === "object" && ("filters" in variables || "format" in variables)) {
        return auditApi.export(variables.filters || {}, variables.format || "json");
      }
      return auditApi.export(variables || {}, "json");
    },
  });
}

/** Cleanup old logs (owner) */
export function useCleanupAuditLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (daysToKeep) => auditApi.cleanup(daysToKeep),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditLogs"] }),
  });
}
