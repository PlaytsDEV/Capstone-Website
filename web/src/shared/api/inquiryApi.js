/**
 * Inquiry API - Domain-specific inquiry operations
 */

import { auth } from "../../firebase/config";
import { authFetch, publicFetch } from "./httpClient.js";

export const inquiryApi = {
  /**
   * Get all inquiries (admin only)
   */
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/inquiries?${queryString}` : "/inquiries";
    return authFetch(url);
  },

  /**
   * Get inquiry by ID (admin only)
   */
  getById: (inquiryId) => authFetch(`/inquiries/${inquiryId}`),

  /**
   * Get inquiry statistics (admin only)
   */
  getStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/inquiries/stats?${queryString}` : "/inquiries/stats";
    return authFetch(url);
  },

  /**
   * Create new inquiry (supports both authenticated users and public guests)
   */
  create: async (inquiryData) => {
    try {
      if (auth.currentUser) {
        return await authFetch("/inquiries", {
          method: "POST",
          body: JSON.stringify(inquiryData),
        });
      }
    } catch (_err) {
      // Fall through to public fetch if auth header/session fails
    }
    return publicFetch("/inquiries", {
      method: "POST",
      body: JSON.stringify(inquiryData),
    });
  },

  /**
   * Update inquiry (admin only)
   */
  update: (inquiryId, data) =>
    authFetch(`/inquiries/${inquiryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /**
   * Archive inquiry (admin only) - soft delete
   */
  archive: (inquiryId) =>
    authFetch(`/inquiries/${inquiryId}`, { method: "DELETE" }),

  /**
   * Respond to inquiry (admin only)
   */
  respond: (inquiryId, response) =>
    authFetch(`/inquiries/${inquiryId}`, {
      method: "PUT",
      body: JSON.stringify({ response }),
    }),

  /**
   * Retry email dispatch for an inquiry response (admin only)
   */
  retryEmail: (inquiryId) =>
    authFetch(`/inquiries/${inquiryId}/retry-email`, {
      method: "POST",
    }),

  /**
   * Get Kanban board categorized by status (admin only)
   */
  getKanbanBoard: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return authFetch(`/inquiries/kanban${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * Schedule viewing for inquiry (admin only)
   */
  scheduleViewing: (inquiryId, viewingData) =>
    authFetch(`/inquiries/${inquiryId}/viewing`, {
      method: "POST",
      body: JSON.stringify(viewingData),
    }),

  /**
   * 1-Click convert inquiry to tenant application (admin only)
   */
  convertToApplication: (inquiryId, payload = {}) =>
    authFetch(`/inquiries/${inquiryId}/convert`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Get Marketing Source ROI Report (admin only)
   */
  getMarketingRoi: () => authFetch("/inquiries/marketing-roi"),
};
