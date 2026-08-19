import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { reservationApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Targeted invalidation after a reservation mutation.
 * Invalidates the list views and occupancy data, but NOT unrelated domains.
 * Pass reservationId to also bust the specific detail cache.
 */
const invalidateReservationSideEffects = (qc, reservationId = null) =>
  Promise.all([
    // All list/workspace variants under "reservations"
    qc.invalidateQueries({ queryKey: ["reservations", "list"] }),
    qc.invalidateQueries({ queryKey: ["reservations", "currentResidents"] }),
    qc.invalidateQueries({ queryKey: ["reservations", "tenantWorkspace"] }),
    // Room occupancy changes on bed assignment/release
    qc.invalidateQueries({ queryKey: ["rooms", "branchOccupancy"] }),
    qc.invalidateQueries({ queryKey: ["rooms", "occupancy"] }),
    // Current user's own reservation/profile state
    qc.invalidateQueries({ queryKey: ["users", "currentUser"] }),
    // Visit scheduling capacity changes whenever active visit reservations move.
    qc.invalidateQueries({ queryKey: ["reservations", "visitAvailability"] }),
    // Specific detail if known
    ...(reservationId
      ? [qc.invalidateQueries({ queryKey: queryKeys.reservations.detail(reservationId) })]
      : []),
  ]);

/** Fetch all reservations — 30s freshness, socket events & mutations trigger instant refresh */
export function useReservations(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.all(params),
    queryFn: () => reservationApi.getAll(params),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/** Fetch current moved-in residents for admin tenants page */
export function useCurrentResidents(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.currentResidents(params),
    queryFn: () => reservationApi.getCurrentResidents(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Fetch tenancy workspace rows for admin tenants page */
export function useTenantWorkspace(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.tenantWorkspace(params),
    queryFn: () => reservationApi.getTenantWorkspace(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Fetch tenancy workspace detail for a single reservation */
export function useTenantWorkspaceDetail(reservationId, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.tenantWorkspaceDetail(reservationId),
    queryFn: () => reservationApi.getTenantWorkspaceById(reservationId),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    enabled: !!reservationId,
    ...options,
  });
}

/** Pre-fetch tenancy workspace detail into TanStack Query cache (e.g., on row hover) */
export function prefetchTenantWorkspaceDetail(queryClient, reservationId) {
  if (!queryClient || !reservationId) return Promise.resolve(null);
  return queryClient.prefetchQuery({
    queryKey: queryKeys.reservations.tenantWorkspaceDetail(reservationId),
    queryFn: () => reservationApi.getTenantWorkspaceById(reservationId),
    staleTime: 60 * 1000,
  });
}

export function useTenantActionContext(reservationId, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.tenantActionContext(reservationId),
    queryFn: () => reservationApi.getTenantActionContext(reservationId),
    enabled: !!reservationId,
    ...options,
  });
}

/** Mark a tenant workspace record as viewed by admin */
export function useMarkTenantAsViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId) => reservationApi.markTenantAsViewed(reservationId),
    onSuccess: (data, reservationId) => {
      const readAt =
        data?.data?.lastAdminViewedAt ||
        data?.lastAdminViewedAt ||
        new Date().toISOString();
      qc.setQueriesData({ queryKey: ["reservations", "tenantWorkspace"] }, (old) => {
        if (!old || !Array.isArray(old.tenants)) return old;
        return {
          ...old,
          tenants: old.tenants.map((t) => {
            if (String(t.id || t.reservationId) === String(reservationId)) {
              return { ...t, lastAdminViewedAt: readAt, isViewedByAdmin: true };
            }
            return t;
          }),
        };
      });
      qc.invalidateQueries({
        queryKey: queryKeys.reservations.tenantWorkspaceDetail(reservationId),
      });
    },
  });
}

/** Fetch a single reservation by ID */
export function useReservation(reservationId, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.detail(reservationId),
    queryFn: () => reservationApi.getById(reservationId),
    ...options,
    enabled: Boolean(reservationId) && options.enabled !== false,
  });
}

export function useVisitAvailability(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.visitAvailability(params),
    queryFn: () => reservationApi.getVisitAvailability(params),
    enabled: !!params.branch,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useVisitAvailabilitySettings(branch, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.visitAvailabilitySettings(branch),
    queryFn: () => reservationApi.getVisitAvailabilitySettings(branch),
    enabled: !!branch,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useUpdateVisitAvailabilitySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branch, data }) =>
      reservationApi.updateVisitAvailabilitySettings(branch, data),
    onSuccess: (_data, { branch }) => {
      qc.invalidateQueries({ queryKey: queryKeys.reservations.visitAvailabilitySettings(branch) });
      qc.invalidateQueries({ queryKey: ["reservations", "visitAvailability"] });
      // Refresh history drawer
      qc.invalidateQueries({ queryKey: ["reservations", "visitAvailabilityHistory", branch] });
    },
  });
}

/**
 * Fetch paginated availability rules change history for a branch.
 * Used by VisitAvailabilityHistoryDrawer.
 *
 * @param {string} branch  - Target branch
 * @param {Object} params  - { page, limit }
 * @param {Object} options - TanStack Query options
 */
export function useVisitAvailabilityHistory(branch, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.visitAvailabilityHistory(branch, params),
    queryFn: () => reservationApi.getVisitAvailabilityHistory(branch, params),
    enabled: !!branch && options.enabled !== false,
    staleTime: 30 * 1000,
    ...options,
  });
}

/** Preflight check for visit availability rule changes */
export function useVisitAvailabilityPreflight() {
  return useMutation({
    mutationFn: ({ branch, data }) =>
      reservationApi.preflightVisitAvailabilityRules(branch, data),
  });
}

/** Get paginated visit availability conflict history */
export function useVisitConflictHistory(branch, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.visitConflictHistory(branch, params),
    queryFn: () => reservationApi.getVisitConflictHistory(branch, params),
    enabled: !!branch && options.enabled !== false,
    staleTime: 30 * 1000,
    ...options,
  });
}

/** Toggle resolution status of a visit conflict log entry */
export function useToggleResolveVisitConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branch, conflictId, resolved }) =>
      reservationApi.toggleResolveVisitConflict(branch, conflictId, resolved),
    onSuccess: (_data, { branch }) => {
      qc.invalidateQueries({
        queryKey: ["reservations", "visitConflictHistory"],
      });
    },
  });
}

/** Get booked visitors for a specific date and time slot */
export function useVisitSlotVisitors(branch, date, slot, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.visitSlotVisitors(branch, date, slot),
    queryFn: () => reservationApi.getVisitSlotVisitors(branch, date, slot),
    enabled: !!branch && !!date && !!slot && options.enabled !== false,
    staleTime: 30 * 1000,
    ...options,
  });
}

/** Get paginated scheduled users history for a branch */
export function useVisitScheduledUsers(branch, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.visitScheduledUsers(branch, params),
    queryFn: () => reservationApi.getVisitScheduledUsers(branch, params),
    enabled: !!branch && options.enabled !== false,
    staleTime: 30 * 1000,
    ...options,
  });
}

/** Create a new reservation */
export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => reservationApi.create(data),
    onSuccess: () => invalidateReservationSideEffects(qc),
  });
}

/** Update a reservation (admin) */
export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, data }) =>
      reservationApi.update(reservationId, data),
    onSuccess: (_data, { reservationId }) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}

/** Update a reservation (tenant) */
export function useUpdateReservationByUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, data }) =>
      reservationApi.updateByUser(reservationId, data),
    onSuccess: (_data, { reservationId }) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}

/** Cancel a reservation */
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId) => reservationApi.cancel(reservationId),
    onSuccess: (_data, reservationId) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}

/** Extend reservation move-in date (admin) */
export function useExtendReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, data }) =>
      reservationApi.extend(reservationId, data),
    onSuccess: (_data, { reservationId }) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}

/** Release reservation slot (admin) */
export function useReleaseReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, data }) =>
      reservationApi.release(reservationId, data),
    onSuccess: (_data, { reservationId }) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}

/** Archive reservation (admin) */
export function useArchiveReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, data }) =>
      reservationApi.archive(reservationId, data),
    onSuccess: (_data, { reservationId }) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}

/** Restore archived reservation (admin) */
export function useRestoreReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId) => reservationApi.restore(reservationId),
    onSuccess: (_data, reservationId) =>
      invalidateReservationSideEffects(qc, reservationId),
  });
}
