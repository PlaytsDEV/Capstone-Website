/**
 * Reservation API - Domain-specific reservation operations
 */

import { authFetch } from "./httpClient.js";
import { normalizeLifecyclePayload } from "../utils/lifecycleNaming.js";

const withLifecycleNormalization = (promise) =>
  promise.then((payload) => normalizeLifecyclePayload(payload));

export const reservationApi = {
  /**
   * Get all reservations
   */
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/reservations?${queryString}` : "/reservations";
    return withLifecycleNormalization(authFetch(url));
  },

  /**
   * Get current moved-in residents for admin tenants page
   */
  getCurrentResidents: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.branch && params.branch !== "all") {
      searchParams.set("branch", params.branch);
    }
    const query = searchParams.toString();
    return withLifecycleNormalization(
      authFetch(`/reservations/current-residents${query ? `?${query}` : ""}`),
    );
  },

  /**
   * Get tenancy workspace rows for the admin tenants page.
   */
  getTenantWorkspace: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.branch && params.branch !== "all") {
      searchParams.set("branch", params.branch);
    }
    const query = searchParams.toString();
    return authFetch(`/reservations/tenant-workspace${query ? `?${query}` : ""}`);
  },

  /**
   * Get a single tenancy workspace detail payload.
   */
  getTenantWorkspaceById: (reservationId) =>
    authFetch(`/reservations/tenant-workspace/${reservationId}`),

  getTenantActionContext: (reservationId) =>
    authFetch(`/reservations/${reservationId}/tenant-actions/context`),

  getVisitAvailability: (params = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    ).toString();
    return authFetch(`/reservations/visit-availability${queryString ? `?${queryString}` : ""}`);
  },

  getVisitAvailabilitySettings: (branch) => {
    const queryString = new URLSearchParams({ branch }).toString();
    return authFetch(`/reservations/visit-availability/settings?${queryString}`);
  },

  updateVisitAvailabilitySettings: (branch, data) => {
    const queryString = new URLSearchParams({ branch }).toString();
    return authFetch(`/reservations/visit-availability/settings?${queryString}`, {
      method: "PUT",
      body: JSON.stringify({ ...data, weekdaySystem: "js-get-day" }),
    });
  },

  /**
   * Get reservation by ID
   */
  getById: (reservationId) =>
    withLifecycleNormalization(authFetch(`/reservations/${reservationId}`)),

  /**
   * Create new reservation
   */
  create: (reservationData) =>
    withLifecycleNormalization(
      authFetch("/reservations", {
      method: "POST",
      body: JSON.stringify(reservationData),
      }),
    ),

  /**
   * Update reservation (admin only)
   */
  update: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  reviewApplication: (reservationId, decision, reason = "") =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/application-review`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      }),
    ),

  confirmMoveIn: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/move-in`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  /**
   * Update reservation (tenant only)
   */
  updateByUser: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/user`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Update visit preference & scheduling (tenant only)
   */
  updateVisitPreference: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/visit`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ),

  /**
   * Save tenant application draft (tenant only)
   */
  saveApplicationDraft: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/application/draft`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ),

  /**
   * Submit tenant application (tenant only)
   */
  submitApplication: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/application/submit`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  /**
   * Upload proof of payment for reservation fee (tenant only)
   */
  uploadPaymentProof: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/payment`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  /**
   * Validate applicant valid ID using backend OCR/manual review fallback.
   */
  validateIdDocument: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/id-validation`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  precheckDocument: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/document-precheck`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  manageVisit: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/visit-management`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  cancelByUser: (reservationId, reason = "") =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    ),

  requestCancellation: (reservationId, reason = "") =>
    authFetch(`/reservations/${reservationId}/cancel-request`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  approveCancellationRequest: (reservationId, note = "") =>
    authFetch(`/reservations/${reservationId}/cancel-request/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  rejectCancellationRequest: (reservationId, note = "") =>
    authFetch(`/reservations/${reservationId}/cancel-request/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  requestModification: (reservationId, data = {}) =>
    authFetch(`/reservations/${reservationId}/modification-request`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveModificationRequest: (reservationId, note = "") =>
    authFetch(`/reservations/${reservationId}/modification-request/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  rejectModificationRequest: (reservationId, note = "") =>
    authFetch(`/reservations/${reservationId}/modification-request/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  /**
   * Cancel reservation — legacy alias kept for backward compatibility.
   * New code should use cancelByUser instead.
   * @deprecated Use cancelByUser
   */
  cancel: (reservationId) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    ),

  /**
   * Delete reservation
   */
  delete: (reservationId) =>
    authFetch(`/reservations/${reservationId}`, {
      method: "DELETE",
    }),

  /**
   * Extend reservation move-in date (admin only)
   */
  extend: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/extend`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Release reservation slot (admin only)
   */
  release: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/release`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Archive (soft delete) reservation (admin only)
   */
  archive: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/archive`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Restore an archived reservation (admin only)
   */
  restore: (reservationId) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/restore`, {
        method: "PATCH",
      }),
    ),

  /**
   * Renew a tenant's contract / extend lease (admin only)
   */
  renew: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/renew`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Move out a tenant (admin only)
   * Uses the legacy /checkout route for compatibility.
   */
  moveOut: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/checkout`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  // Legacy alias for the move-out route.
  checkout: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/checkout`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Transfer tenant to a different room/bed (admin only)
   */
  transfer: (reservationId, data) =>
    withLifecycleNormalization(
      authFetch(`/reservations/${reservationId}/transfer`, {
      method: "PUT",
      body: JSON.stringify(data),
      }),
    ),

  /**
   * Create lease renewal offer (admin only)
   */
  createRenewalOffer: (reservationId, data) =>
    authFetch(`/reservations/${reservationId}/renewal-offer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Cancel lease renewal offer (admin only)
   */
  cancelRenewalOffer: (reservationId, offerId) =>
    authFetch(`/reservations/${reservationId}/renewal-offer/${offerId}/cancel`, {
      method: "POST",
    }),

  /**
   * Respond to lease renewal offer (tenant or admin)
   */
  respondToRenewalOffer: (reservationId, offerId, action, tenantResponseReason = "") =>
    authFetch(`/reservations/${reservationId}/renewal-offer/${offerId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action, tenantResponseReason }),
    }),

  /**
   * Get current tenant's active renewal offers
   */
  getMyRenewalOffers: () =>
    authFetch("/reservations/my-renewal-offers"),

  // SCENARIO 1 API METHODS
  cancelTransfer: (reservationId) =>
    authFetch(`/reservations/${reservationId}/cancel-transfer`, { method: "POST" }),

  cancelMoveOut: (reservationId) =>
    authFetch(`/reservations/${reservationId}/cancel-moveout`, { method: "POST" }),

  earlyTermination: (reservationId, data = {}) =>
    authFetch(`/reservations/${reservationId}/early-termination`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  swapRooms: (reservationAId, reservationBId) =>
    authFetch("/reservations/room-swap", {
      method: "POST",
      body: JSON.stringify({ reservationAId, reservationBId }),
    }),

  triggerAbandonment: (reservationId, data = {}) =>
    authFetch(`/reservations/${reservationId}/abandonment`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkExtensionConflict: (reservationId, requestedEndDate) =>
    authFetch(`/reservations/${reservationId}/check-extension?requestedEndDate=${encodeURIComponent(requestedEndDate)}`),

  // SCENARIO 3: Deposit Reconciliation & Payouts
  processDepositRefund: (reservationId, data = {}) =>
    authFetch(`/reservations/${reservationId}/deposit-refund`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
