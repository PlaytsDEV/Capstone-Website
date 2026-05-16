import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { userApi, authApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";
import { showNotification } from "../../utils/notification";

/** Fetch the currently authenticated user's profile */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["users", "currentUser"],
    queryFn: () => authApi.getCurrentUser(),
  });
}

/** Fetch all users with optional filters */
export function useUsers(filters) {
  return useQuery({
    queryKey: [...queryKeys.users.all, filters],
    queryFn: () => userApi.getAll(filters),
    placeholderData: keepPreviousData,
  });
}

/** Fetch user statistics */
export function useUserStats() {
  return useQuery({
    queryKey: queryKeys.users.stats,
    queryFn: () => userApi.getStats(),
  });
}

/** Fetch single user by ID */
export function useUser(userId) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => userApi.getById(userId),
    enabled: !!userId,
  });
}

/** Fetch current user's stay history */
export function useMyStays(enabled = true) {
  return useQuery({
    queryKey: ["users", "myStays"],
    queryFn: () => userApi.getMyStays(),
    enabled,
  });
}

/** Update user (admin) */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }) => userApi.update(userId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

/** Delete user (owner) */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => userApi.delete(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

/** Archive user (admin) */
export function useArchiveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => userApi.archive(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

/** Restore archived user (admin) */
export function useRestoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => userApi.restore(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

/** Update branch admin permissions */
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissions }) =>
      userApi.updatePermissions(userId, permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      showNotification("Permissions updated successfully", "success");
    },
    onError: (err) => {
      showNotification(err.message || "Failed to update permissions", "error");
    },
  });
}
