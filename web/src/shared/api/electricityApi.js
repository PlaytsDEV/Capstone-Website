/**
 * Electricity API - Segment-based electricity billing operations
 */

import { authFetch } from "./httpClient.js";

export const electricityApi = {
  // ── Meter Readings ──

  /** Record a new submeter reading */
  recordReading: (data) =>
    authFetch("/electricity/readings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Get all readings for a room (optional periodId filter) */
  getReadings: (roomId, periodId) =>
    authFetch(
      `/electricity/readings/${roomId}${periodId ? `?periodId=${periodId}` : ""}`,
    ),

  /** Get the latest reading for a room */
  getLatestReading: (roomId) =>
    authFetch(`/electricity/readings/${roomId}/latest`),

  /** Soft-delete a meter reading */
  deleteReading: (readingId) =>
    authFetch(`/electricity/readings/${readingId}`, { method: "DELETE" }),

  // ── Billing Periods ──

  /** Open a new billing period */
  openPeriod: (data) =>
    authFetch("/electricity/periods", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Close a billing period and trigger computation */
  closePeriod: (periodId, data) =>
    authFetch(`/electricity/periods/${periodId}/close`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** Get all billing periods for a room */
  getPeriods: (roomId) => authFetch(`/electricity/periods/${roomId}`),

  /** Soft-delete a billing period (only open periods) */
  deletePeriod: (periodId) =>
    authFetch(`/electricity/periods/${periodId}`, { method: "DELETE" }),

  // ── Results ──

  /** Get full billing result (segments + tenant summaries) */
  getResult: (periodId) => authFetch(`/electricity/results/${periodId}`),

  /** Re-run computation on a closed period */
  reviseResult: (periodId, revisionNote) =>
    authFetch(`/electricity/results/${periodId}/revise`, {
      method: "POST",
      body: JSON.stringify({ revisionNote }),
    }),

  // ── Rooms ──

  /** Get rooms with billing period status */
  getRooms: (branch) =>
    authFetch(`/electricity/rooms${branch ? `?branch=${branch}` : ""}`),

  // ── Tenant ──

  /** Tenant views their electricity billing summaries */
  getMyBills: () => authFetch("/electricity/my-bills"),

  /** Tenant views one period's breakdown */
  getMyBreakdown: (periodId) =>
    authFetch(`/electricity/my-bills/${periodId}`),

  /** Tenant: get electricity segment breakdown using a Bill ID */
  getBreakdownByBillId: (billId) =>
    authFetch(`/electricity/my-bills/by-bill/${billId}`),

  // ── Draft Billing (Admin) ──

  /** Get all draft bills for a closed period */
  getDraftBills: (periodId) =>
    authFetch(`/electricity/periods/${periodId}/draft-bills`),

  /** Send all draft bills for a period (flip to pending + email) */
  sendBills: (periodId, data = {}) =>
    authFetch(`/electricity/periods/${periodId}/send-bills`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** Admin adjusts charges on a draft bill */
  adjustBill: (billId, data) =>
    authFetch(`/electricity/bills/${billId}/adjust`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
