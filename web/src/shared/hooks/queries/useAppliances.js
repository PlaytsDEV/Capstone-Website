import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { applianceApi } from "../../api/applianceApi";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Fetch appliances from the catalog
 * @param {{ includeInactive?: boolean }} params
 * @param {object} options
 */
export function useAppliances(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.appliances.all(params),
    queryFn: async () => {
      const res = await applianceApi.getAll(params);
      return res?.data || res || [];
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 300_000,
    ...options,
  });
}

/**
 * Mutation hooks for Appliance CRUD
 */
export function useApplianceMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["appliances"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => applianceApi.create(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => applianceApi.update(id, updates),
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => applianceApi.archive(id),
    onSuccess: invalidate,
  });

  return {
    createAppliance: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateAppliance: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    archiveAppliance: archiveMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,
  };
}
