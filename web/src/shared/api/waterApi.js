import { authFetch } from "./httpClient.js";

export const waterApi = {
  getMyBills: () => authFetch("/water/my-bills"),

  getMyRecords: () => authFetch("/water/my-records"),

  getMyBreakdown: (periodId) => authFetch(`/water/my-bills/${periodId}`),

  getMyBreakdownByBillId: (billId) => authFetch(`/water/my-records/by-bill/${billId}`),

  getRooms: (branch) =>
    authFetch(`/water/rooms${branch ? `?branch=${branch}` : ""}`),

  openPeriod: (data) =>
    authFetch("/water/periods", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPeriods: (roomId) => authFetch(`/water/periods/${roomId}`),

  updatePeriod: (periodId, data) =>
    authFetch(`/water/periods/${periodId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  closePeriod: (periodId, data) =>
    authFetch(`/water/periods/${periodId}/close`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getResult: (periodId) => authFetch(`/water/results/${periodId}`),

  reviseResult: (periodId, data = {}) =>
    authFetch(`/water/results/${periodId}/revise`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDraftBills: (periodId) => authFetch(`/water/periods/${periodId}/draft-bills`),

  sendBills: (periodId, data = {}) =>
    authFetch(`/water/periods/${periodId}/send-bills`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  exportRows: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });
    const query = search.toString();
    return authFetch(`/water/export${query ? `?${query}` : ""}`);
  },

  getRecords: (roomId) => authFetch(`/water/records/${roomId}`),

  getLatestRecord: (roomId) => authFetch(`/water/records/${roomId}/latest`),

  createRecord: (data) =>
    authFetch("/water/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteRecord: (recordId) =>
    authFetch(`/water/records/${recordId}`, {
      method: "DELETE",
    }),

  updateRecord: (recordId, data) =>
    authFetch(`/water/records/${recordId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  finalizeRecord: (recordId) =>
    authFetch(`/water/records/${recordId}/finalize`, {
      method: "PATCH",
    }),
};
