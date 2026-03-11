import { useQuery } from "@tanstack/react-query";
import {
  roomApi,
  inquiryApi,
  userApi,
  reservationApi,
} from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Fetch all admin dashboard data in parallel.
 * Returns individual query results for occupancy, inquiries, users, and reservations.
 */
export function useDashboardData() {
  const occupancy = useQuery({
    queryKey: queryKeys.rooms.branchOccupancy("all"),
    queryFn: () => roomApi.getBranchOccupancy(),
  });

  const inquiryStats = useQuery({
    queryKey: queryKeys.inquiries.stats,
    queryFn: () => inquiryApi.getStats(),
  });

  const userStats = useQuery({
    queryKey: queryKeys.users.stats,
    queryFn: () => userApi.getStats(),
  });

  const reservations = useQuery({
    queryKey: queryKeys.reservations.all,
    queryFn: () => reservationApi.getAll(),
  });

  const inquiries = useQuery({
    queryKey: queryKeys.inquiries.all({ limit: 6, sort: "createdAt", order: "desc" }),
    queryFn: () =>
      inquiryApi.getAll({ limit: 6, sort: "createdAt", order: "desc" }),
  });

  const isLoading =
    occupancy.isLoading ||
    inquiryStats.isLoading ||
    userStats.isLoading ||
    reservations.isLoading ||
    inquiries.isLoading;

  const isError =
    occupancy.isError ||
    inquiryStats.isError ||
    userStats.isError ||
    reservations.isError ||
    inquiries.isError;

  return {
    occupancy,
    inquiryStats,
    userStats,
    reservations,
    inquiries,
    isLoading,
    isError,
  };
}
