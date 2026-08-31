import { authFetch } from "./httpClient.js";

export const tenantTransferApi = {
  getCurrent: () => authFetch("/tenant/room-transfer-request/current"),
  getPreferences: () => authFetch("/tenant/room-transfer-preferences"),
  create: (payload) =>
    authFetch("/tenant/room-transfer-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cancel: (requestId) =>
    authFetch(`/tenant/room-transfer-requests/${requestId}/cancel`, {
      method: "PATCH",
    }),
};
