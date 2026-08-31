import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantTransferApi } from "../../api/tenantTransferApi.js";

export const TENANT_TRANSFER_QUERY_KEY = ["tenant", "roomTransfer", "current"];
export const TENANT_TRANSFER_PREFERENCES_QUERY_KEY = ["tenant", "roomTransfer", "preferences"];

export function useTenantTransferLifecycle(enabled = true) {
  return useQuery({
    queryKey: TENANT_TRANSFER_QUERY_KEY,
    queryFn: tenantTransferApi.getCurrent,
    enabled,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useTenantTransferPreferences(enabled = true) {
  return useQuery({
    queryKey: TENANT_TRANSFER_PREFERENCES_QUERY_KEY,
    queryFn: tenantTransferApi.getPreferences,
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

const refreshCanonicalLifecycle = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: TENANT_TRANSFER_QUERY_KEY });
  return queryClient.refetchQueries({ queryKey: TENANT_TRANSFER_QUERY_KEY, type: "active" });
};

export function useCreateTenantTransferRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tenantTransferApi.create,
    onSuccess: () => refreshCanonicalLifecycle(queryClient),
    onError: (error) => error?.response?.status === 409
      ? refreshCanonicalLifecycle(queryClient)
      : undefined,
  });
}

export function useCancelTenantTransferRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tenantTransferApi.cancel,
    onSuccess: () => refreshCanonicalLifecycle(queryClient),
    onError: (error) => error?.response?.status === 409
      ? refreshCanonicalLifecycle(queryClient)
      : undefined,
  });
}
