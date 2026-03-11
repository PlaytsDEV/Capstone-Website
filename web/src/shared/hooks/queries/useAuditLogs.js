import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/** Fetch audit logs with filters */
export function useAuditLogs(params) {
  return useQuery({
    queryKey: queryKeys.auditLogs.all(params),
    queryFn: () => auditApi.getLogs(params),
  });
}

/** Fetch audit log statistics */
export function useAuditStats(branch) {
  return useQuery({
    queryKey: ["auditLogs", "stats", branch],
    queryFn: () => auditApi.getStats(branch),
  });
}

/** Export audit logs */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (filters) => auditApi.export(filters),
  });
}

/** Cleanup old logs (super admin) */
export function useCleanupAuditLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (daysToKeep) => auditApi.cleanup(daysToKeep),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditLogs"] }),
  });
}
