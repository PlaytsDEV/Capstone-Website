/**
 * =============================================================================
 * BACKUP API SERVICE
 * =============================================================================
 *
 * Owner-only API calls for system backup management.
 *
 * =============================================================================
 */

import { authFetch, API_URL, getFreshToken } from "./httpClient.js";

export const backupApi = {
  /** Get the current auto-backup configuration. */
  getConfig: () => authFetch("/backups/config"),

  /** Update auto-backup configuration (autoBackupEnabled, intervalDays). */
  updateConfig: (payload) =>
    authFetch("/backups/config", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  /** Trigger a manual backup immediately. */
  triggerBackup: () =>
    authFetch("/backups/trigger", { method: "POST" }),

  /** Get paginated backup history. */
  getHistory: (page = 1, limit = 20) =>
    authFetch(`/backups/history?page=${page}&limit=${limit}`),

  /** Delete a backup record and its file. */
  deleteBackup: (id) =>
    authFetch(`/backups/${id}`, { method: "DELETE" }),

  /** Restore the database from a completed backup. */
  restoreBackup: (id) =>
    authFetch(`/backups/${id}/restore`, { method: "POST" }),

  /** Upload a .json.gz backup file and restore from it. */
  uploadAndRestore: async (file) => {
    const token = await getFreshToken();
    const formData = new FormData();
    formData.append("backupFile", file);

    const response = await fetch(`${API_URL}/backups/upload-restore`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Upload failed");
    }

    const json = await response.json();
    return json.data || json;
  },

  /** Get an authenticated download URL for a backup. */
  getDownloadUrl: async (id) => {
    const token = await getFreshToken();
    return `${API_URL}/backups/${id}/download?token=${encodeURIComponent(token || "")}`;
  },
};
