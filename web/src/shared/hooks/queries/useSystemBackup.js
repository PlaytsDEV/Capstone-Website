import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backupApi } from "../../api/backupApi.js";

export const BACKUP_QUERY_KEYS = {
  all: ["backups"],
  config: () => [...BACKUP_QUERY_KEYS.all, "config"],
  history: (page = 1, limit = 20) => [...BACKUP_QUERY_KEYS.all, "history", { page, limit }],
  list: (params = {}) => [...BACKUP_QUERY_KEYS.all, "list", params],
};

export function useBackupConfig(options = {}) {
  return useQuery({
    queryKey: BACKUP_QUERY_KEYS.config(),
    queryFn: () => backupApi.getConfig(),
    staleTime: 30_000,
    ...options,
  });
}

export function useBackupHistory(page = 1, limit = 20, options = {}) {
  return useQuery({
    queryKey: BACKUP_QUERY_KEYS.history(page, limit),
    queryFn: () => backupApi.getHistory(page, limit),
    staleTime: 10_000,
    ...options,
  });
}

export function useBackupList(page = 1, limit = 20, options = {}) {
  return useQuery({
    queryKey: BACKUP_QUERY_KEYS.list({ page, limit }),
    queryFn: async () => {
      const res = await backupApi.getBackups(page, limit);
      return res?.records || res?.data?.backups || res || [];
    },
    staleTime: 30_000,
    ...options,
  });
}

export function useUpdateBackupConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => backupApi.updateConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_QUERY_KEYS.all });
    },
  });
}

export function useCreateBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => backupApi.createBackup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_QUERY_KEYS.all });
    },
  });
}

export function useTriggerBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => backupApi.triggerBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_QUERY_KEYS.all });
    },
  });
}

export function useDeleteBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => backupApi.deleteBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_QUERY_KEYS.all });
    },
  });
}

export function useRestoreBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => backupApi.restoreBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_QUERY_KEYS.all });
    },
  });
}

export function useUploadAndRestoreMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => backupApi.uploadAndRestore(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_QUERY_KEYS.all });
    },
  });
}
