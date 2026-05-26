/**
 * Maintenance API - Domain-specific maintenance operations
 */

import { authFetch } from "./httpClient.js";

const buildQueryString = (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const maintenanceApi = {
  /**
   * Get current tenant's maintenance requests
   */
  getMyRequests: (filters = {}) =>
    authFetch(`/maintenance/me${buildQueryString(filters)}`),

  /**
   * Create maintenance request
   */
  createRequest: (requestData) =>
    authFetch("/maintenance", {
      method: "POST",
      body: JSON.stringify(requestData),
    }),

  /**
   * Update a pending maintenance request
   */
  updateMyRequest: (requestId, requestData) =>
    authFetch(`/maintenance/${requestId}`, {
      method: "PUT",
      body: JSON.stringify(requestData),
    }),

  /**
   * Cancel a pending maintenance request
   */
  cancelRequest: (requestId) =>
    authFetch(`/maintenance/${requestId}/cancel`, {
      method: "PATCH",
    }),

  /**
   * Reopen a resolved/completed maintenance request
   */
  reopenRequest: (requestId, note) =>
    authFetch(`/maintenance/${requestId}/reopen`, {
      method: "PATCH",
      body: JSON.stringify({ reopen_note: note }),
    }),

  /**
   * Send a tenant reply with optional attachments.
   */
  sendTenantReply: (requestId, payload) =>
    authFetch(`/maintenance/${requestId}/reply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Get maintenance request details
   */
  getRequest: (requestId) => authFetch(`/maintenance/${requestId}`),

  /**
   * Get all admin maintenance requests
   */
  getAdminAll: (filters = {}) =>
    authFetch(`/maintenance/admin/all${buildQueryString(filters)}`),

  getAdminAnalytics: (filters = {}) =>
    authFetch(`/maintenance/admin/analytics${buildQueryString(filters)}`),

  getAdminBranchReport: (filters = {}) =>
    authFetch(`/maintenance/admin/reports/branch${buildQueryString(filters)}`),

  getAdminProviderReport: (filters = {}) =>
    authFetch(`/maintenance/admin/reports/providers${buildQueryString(filters)}`),

  /**
   * Update maintenance request status/notes/assignment (admin only)
   */
  updateAdminRequestStatus: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  /**
   * Send a tenant-facing admin reply with optional attachments.
   */
  sendAdminReply: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/reply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Upload an admin maintenance attachment. Branch is resolved server-side from
   * the maintenance request and related tenant/room/reservation records.
   */
  uploadAdminMaintenanceAttachment: (
    requestId,
    file,
    { visibility = "tenant_visible" } = {},
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("maintenanceRequestId", requestId);
    formData.append("visibility", visibility);

    return authFetch(`/maintenance/admin/${requestId}/attachments`, {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Save already-uploaded admin-only proof attachments into the work log.
   */
  saveAdminProof: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/proof`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Soft-remove an attachment from tenant view or normal request display.
   */
  removeAdminAttachment: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/attachments/remove`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  assignAdminProvider: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/assign-provider`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  assignAdminBranch: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/branch`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  generateAdminUpdate: (requestId) =>
    authFetch(`/maintenance/admin/${requestId}/generate-update`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  generateAdminReport: (requestId, payload) =>
    authFetch(`/maintenance/admin/${requestId}/generate-report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  sendAdminTenantSummary: (requestId) =>
    authFetch(`/maintenance/admin/${requestId}/send-tenant-summary`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  suggestAdminProvider: (requestId) =>
    authFetch(`/maintenance/admin/${requestId}/suggest-provider`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getServiceProviders: (filters = {}) =>
    authFetch(`/service-providers${buildQueryString(filters)}`),

  createServiceProvider: (payload) =>
    authFetch("/service-providers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateServiceProvider: (providerId, payload) =>
    authFetch(`/service-providers/${providerId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  archiveAdminRequest: (requestId, payload = {}) =>
    authFetch(`/maintenance/admin/${requestId}/archive`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  restoreAdminRequest: (requestId, payload = {}) =>
    authFetch(`/maintenance/admin/${requestId}/restore`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  /**
   * Bulk update maintenance requests (admin only)
   */
  bulkUpdateAdminRequests: (payload) =>
    authFetch("/maintenance/admin/bulk", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  /**
   * Legacy compatibility methods retained for untouched callers.
   */
  getByBranch: (filters = {}) =>
    authFetch(`/maintenance/branch${buildQueryString(filters)}`),

  updateRequest: (requestId, status, completionNote) =>
    authFetch(`/maintenance/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, completionNote }),
    }),

  getCompletionStats: (days = 30) =>
    authFetch(`/maintenance/stats/completion?days=${days}`),

  getIssueFrequency: (limit = 12, months = 6) =>
    authFetch(
      `/maintenance/stats/issue-frequency?limit=${limit}&months=${months}`,
    ),
};
