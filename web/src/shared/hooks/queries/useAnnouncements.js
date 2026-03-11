import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcementApi } from "../../api/apiClient";
import { queryKeys } from "../../lib/queryKeys";

/** Fetch announcements */
export function useAnnouncements(limit, category) {
  return useQuery({
    queryKey: [...queryKeys.announcements.all, limit, category],
    queryFn: () => announcementApi.getAll(limit, category),
  });
}

/** Fetch unacknowledged announcements */
export function useUnacknowledgedAnnouncements() {
  return useQuery({
    queryKey: ["announcements", "unacknowledged"],
    queryFn: () => announcementApi.getUnacknowledged(),
  });
}

/** Mark announcement as read */
export function useMarkAnnouncementRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcementId) => announcementApi.markAsRead(announcementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

/** Acknowledge announcement */
export function useAcknowledgeAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcementId) =>
      announcementApi.acknowledge(announcementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

/** Create announcement (admin) */
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => announcementApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}
