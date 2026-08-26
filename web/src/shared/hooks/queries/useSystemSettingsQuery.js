import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../../api/settingsApi.js";

export const SETTINGS_QUERY_KEYS = {
  all: ["settings"],
  business: () => [...SETTINGS_QUERY_KEYS.all, "business"],
  system: () => [...SETTINGS_QUERY_KEYS.all, "system"],
};

export function useSystemSettings(options = {}) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.business(),
    queryFn: () => settingsApi.getSettings(),
    staleTime: 60_000,
    ...options,
  });
}

export function useBusinessSettings(options = {}) {
  return useSystemSettings(options);
}

export function useUpdateSystemSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => settingsApi.updateSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all });
    },
  });
}

export function useUpdateBusinessSettingsMutation() {
  return useUpdateSystemSettingsMutation();
}

export function useUpdateBranchSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branch, ...payload }) => settingsApi.updateBranchSettings(branch, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}
