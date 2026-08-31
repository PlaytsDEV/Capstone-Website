/**
 * Appliance API - Surcharge catalog management and retrieval
 */

import { authFetch, publicFetch } from "./httpClient.js";

export const applianceApi = {
  /**
   * Get all active appliances (or all if includeInactive=true)
   * @param {{ includeInactive?: boolean }} params
   */
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.includeInactive) {
      query.set("includeInactive", "true");
    }
    const qs = query.toString();
    const url = qs ? `/appliances?${qs}` : "/appliances";
    return publicFetch(url);
  },

  /**
   * Create a new appliance in the catalog (Admin/Owner)
   * @param {{ name: string, code?: string, monthlyFee: number, category?: string, maxQuantity?: number, description?: string, isActive?: boolean }} payload
   */
  create: async (payload) => {
    return authFetch("/appliances", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Update an existing appliance (Admin/Owner)
   * @param {string} id
   * @param {object} updates
   */
  update: async (id, updates) => {
    return authFetch(`/appliances/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  /**
   * Archive / Soft-delete an appliance (Admin/Owner)
   * @param {string} id
   */
  archive: async (id) => {
    return authFetch(`/appliances/${id}`, {
      method: "DELETE",
    });
  },
};
