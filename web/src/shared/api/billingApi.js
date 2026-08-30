/**
 * Billing API - Domain-specific billing operations
 */

import { authFetch, protectedFetch } from "./httpClient.js";

const getDownloadFilename = (response, fallback) => {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const billingApi = {
  // ── Tenant Endpoints ──

  /**
   * Get current month's billing for logged-in tenant
   */
  getCurrentBilling: () => authFetch("/billing/current"),

  /**
   * Get billing history
   */
  getHistory: (limit = 50) => authFetch(`/billing/history?limit=${limit}`),

  /**
   * Get all bills for logged-in tenant with full breakdown
   */
  getMyBills: () => authFetch("/billing/my-bills"),

  getMyUtilityBreakdownByBillId: (billId, utilityType) =>
    authFetch(`/billing/${billId}/utility-breakdown/${utilityType}`),

  // ── Admin Endpoints ──

  /**
   * Get billing statistics by branch (admin only)
   */
  getStats: () => authFetch("/billing/stats"),

  /**
   * Mark a bill as paid (admin only)
   */
  markAsPaid: (billId, amount, note) =>
    authFetch(`/billing/${billId}/mark-paid`, {
      method: "POST",
      body: JSON.stringify({ amount, note }),
    }),

  /**
   * Get all bills for a branch (admin only)
   */
  getBillsByBranch: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        ([, value]) => value != null && value !== "" && value !== "undefined" && value !== "null",
      ),
    ).toString();
    return authFetch(`/billing/branch${query ? `?${query}` : ""}`);
  },

  /**
   * Get rooms with occupants for bill generation (admin only)
   */
  getRoomsWithTenants: (branch) =>
    authFetch(`/billing/rooms${branch && branch !== "all" && branch !== "undefined" ? `?branch=${branch}` : ""}`),

  /**
   * Apply penalties to overdue bills (admin only)
   */
  applyPenalties: () =>
    authFetch("/billing/apply-penalties", { method: "POST" }),

  /**
   * Get billing report (admin only)
   */
  getBillingReport: () => authFetch("/billing/report"),

  getPendingVerifications: (branch = null) =>
    authFetch(`/billing/pending-verifications${branch && branch !== "all" && branch !== "undefined" ? `?branch=${branch}` : ""}`),

  getAdminPayments: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        ([, value]) => value != null && value !== "" && value !== "undefined" && value !== "null",
      ),
    ).toString();
    return authFetch(`/payments/admin/ledger${query ? `?${query}` : ""}`);
  },

  getRentBills: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        ([, value]) => value != null && value !== "" && value !== "undefined" && value !== "null",
      ),
    ).toString();
    return authFetch(`/billing/rent${query ? `?${query}` : ""}`);
  },

  getRentBillableTenants: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        ([, value]) => value != null && value !== "" && value !== "undefined" && value !== "null",
      ),
    ).toString();
    return authFetch(`/billing/rent/tenants${query ? `?${query}` : ""}`);
  },

  generateRentBill: (data) =>
    authFetch("/billing/rent/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  previewRentBill: (data) =>
    authFetch("/billing/rent/preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateAllRentBills: (data) =>
    authFetch("/billing/rent/generate-all", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateBatchRentBills: (data) =>
    authFetch("/billing/rent/generate-batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  sendRentBill: (billId) =>
    authFetch(`/billing/rent/${billId}/send`, {
      method: "POST",
    }),

  sendBillReminder: (billId, payload = {}) =>
    authFetch(`/billing/${billId}/remind`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  batchSendBillReminders: (billIds, payload = {}) =>
    authFetch("/billing/batch-remind", {
      method: "POST",
      body: JSON.stringify({ billIds, ...payload }),
    }),

  downloadBillPdf: async (billId, fallbackFilename = "billing-statement.pdf") => {
    const response = await protectedFetch(`/billing/${billId}/pdf`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || error.message || "Failed to download PDF.");
    }

    const blob = await response.blob();
    const filename = getDownloadFilename(response, fallbackFilename);
    downloadBlob(blob, filename);
    return { filename };
  },

  downloadBillReceipt: async (billId, fallbackFilename = "payment-receipt.pdf") => {
    const response = await protectedFetch(`/billing/${billId}/receipt`, { method: "GET" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || error.message || "Failed to download Receipt.");
    }
    const blob = await response.blob();
    const filename = getDownloadFilename(response, fallbackFilename);
    downloadBlob(blob, filename);
    return { filename };
  },

  verifyPayment: (billId, data) =>
    authFetch(`/billing/${billId}/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── PayMongo Online Payment ──

  /**
   * Create a PayMongo checkout session for a bill
   */
  createCheckout: (billId) =>
    authFetch(`/payments/bill/${billId}/checkout`, { method: "POST" }),

  /**
   * Create a PayMongo checkout session for multiple selected bills (consolidated checkout)
   */
  createBatchCheckout: (billIds) =>
    authFetch("/payments/bills/checkout-batch", {
      method: "POST",
      body: JSON.stringify({ billIds }),
    }),

  /**
   * Check PayMongo session payment status
   */
  checkPaymentStatus: (sessionId) =>
    authFetch(`/payments/session/${sessionId}/status`),

  /**
   * Create a PayMongo checkout session for a Reservation Fee
   */
  createDepositCheckout: (reservationId) =>
    authFetch(`/payments/deposit/${reservationId}/checkout`, { method: "POST" }),

  /**
   * Create a PayMongo checkout session for remaining Move-In Requirements
   */
  createMoveInCheckout: (reservationId) =>
    authFetch(`/payments/reservation/${reservationId}/move-in-checkout`, { method: "POST" }),

  // ── Payment History ──

  /**
   * Get payment history for the logged-in tenant
   */
  getPaymentHistory: (limit = 50) =>
    authFetch(`/payments/history?limit=${limit}`),

  /**
   * Get all payments for a specific bill
   */
  getPaymentsForBill: (billId) =>
    authFetch(`/payments/bill/${billId}/payments`),

  // ── Admin Export & Utilities ──

  /**
   * Get flattened billing data for CSV export (admin only)
   */
  getExportData: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/export?${query}`);
  },

  /**
   * Get expected vacancy dates for all beds (admin only)
   */
  getVacancyDates: () =>
    authFetch("/payments/vacancy-dates"),

  // SCENARIO 2 API METHODS
  createMilestoneArrangement: (parentBillId, milestones) =>
    authFetch("/billing/milestone-arrangement", {
      method: "POST",
      body: JSON.stringify({ parentBillId, milestones }),
    }),

  runLatePenaltyJob: () =>
    authFetch("/billing/late-penalties/run", { method: "POST" }),

  getPriorityQueue: () =>
    authFetch("/billing/priority-queue"),

  // ── Billing Dispute Engine (P3-03) ──
  submitDispute: (billId, payload) =>
    authFetch(`/billing/${billId}/dispute`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDisputes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/disputes${query ? `?${query}` : ""}`, {
      preserveEnvelope: true,
    });
  },

  resolveDispute: (disputeId, payload) =>
    authFetch(`/billing/disputes/${disputeId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── Overdue 3-Notice Machine & Case Review (P3-01, P3-02) ──
  getOverdueNotices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/overdue-notices${query ? `?${query}` : ""}`, {
      preserveEnvelope: true,
    });
  },

  sendOverdueNotice: (billId, payload) => {
    const body = typeof payload === "string" ? { noticeType: payload } : payload;
    return authFetch(`/billing/${billId}/send-overdue-notice`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  batchSendOverdueNotices: (payload) =>
    authFetch("/billing/overdue-notices/batch-send", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getTerminationCases: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/termination-reviews${query ? `?${query}` : ""}`, {
      preserveEnvelope: true,
    });
  },

  createTerminationCase: (payload) =>
    authFetch("/billing/termination-reviews", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTerminationDecision: (id, payload) =>
    authFetch(`/billing/termination-reviews/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteTerminationCase: (id) =>
    authFetch(`/billing/termination-reviews/${id}`, {
      method: "DELETE",
    }),

  // ── Tenant Violation & Warning Log (P4-01) ──
  getViolations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/violations${query ? `?${query}` : ""}`, {
      preserveEnvelope: true,
    });
  },

  getActiveTenantsForViolations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/violations/active-tenants${query ? `?${query}` : ""}`, {
      preserveEnvelope: true,
    });
  },

  getViolationById: (id) =>
    authFetch(`/billing/violations/${id}`),

  logViolation: (payload) =>
    authFetch("/billing/violations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  recordViolation: (payload) =>
    authFetch("/billing/violations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateViolation: (id, payload) =>
    authFetch(`/billing/violations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  updateViolationDecision: (id, payload) =>
    authFetch(`/billing/violations/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  adjudicateViolation: (id, payload) =>
    authFetch(`/billing/violations/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteViolation: (id) =>
    authFetch(`/billing/violations/${id}`, {
      method: "DELETE",
    }),

  archiveViolation: (id) =>
    authFetch(`/billing/violations/${id}`, {
      method: "DELETE",
    }),

  // ── Consolidated Billing & Payments Monitor ──
  getConsolidatedBillingMonitor: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return authFetch(`/billing/consolidated-monitor${query ? `?${query}` : ""}`, {
      preserveEnvelope: true,
    });
  },
};


