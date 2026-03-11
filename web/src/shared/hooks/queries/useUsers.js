import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/** Fetch all users with optional filters */
export function useUsers(filters) {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => userApi.getAll(filters),
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
export function useMyStays() {
  return useQuery({
    queryKey: ["users", "myStays"],
    queryFn: () => userApi.getMyStays(),
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

/** Delete user (super admin) */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => userApi.delete(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
