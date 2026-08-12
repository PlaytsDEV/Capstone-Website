/**
 * Move-Out Clearance API - Deposit Settlement & Former Tenant Portal Operations
 */

import { authFetch } from "./httpClient.js";

export const moveOutApi = {
  /**
   * Get clearance details for a reservation or former tenant
   */
  getClearance: (reservationId) =>
    authFetch(`/reservations/${reservationId}/move-out-clearance`),

  /**
   * Calculate deposit settlement breakdown (inspection, rent, utilities, RFID)
   */
  calculateSettlement: (reservationId, payload) =>
    authFetch(`/reservations/${reservationId}/calculate-settlement`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Submit inspection report and final deposit sign-off (admin only)
   */
  submitClearanceSignOff: (reservationId, payload) =>
    authFetch(`/reservations/${reservationId}/clearance-sign-off`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * Former Tenant Portal: View final statement & refund receipt
   */
  getFormerTenantSummary: () =>
    authFetch("/reservations/former-tenant/summary"),
};
