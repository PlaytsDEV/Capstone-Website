import { API_URL, authFetch, getFreshToken } from "../../../shared/api/httpClient";
import { getSessionHeaders } from "../../../shared/api/authSession";

const getPreparedBlob = async (contractId, download = false) => {
  const token = await getFreshToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(
    `${API_URL}/contracts/my/${contractId}/documents/prepared${download ? "?download=1" : ""}`,
    {
      headers: { Authorization: `Bearer ${token}`, ...getSessionHeaders() },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || payload.message || "Prepared Contract unavailable.");
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return response.blob();
};

const getFinalBlob = async (contractId, download = false) => {
  const token = await getFreshToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(
    `${API_URL}/contracts/my/${contractId}/documents/final${download ? "?download=1" : ""}`,
    {
      headers: { Authorization: `Bearer ${token}`, ...getSessionHeaders() },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "Final Contract unavailable.");
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return response.blob();
};

export const tenantContractApi = {
  getMyCurrentContract: () => authFetch("/contracts/my/current", { cache: "no-store" }),
  getMyContractHistory: () => authFetch("/contracts/my/history"),
  getMyContractDetails: (contractId) => authFetch(`/contracts/my/${contractId}`),
  getMyPreparedContractFile: getPreparedBlob,
  getMyFinalContractFile: getFinalBlob,
};
