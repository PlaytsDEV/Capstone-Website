import { authFetch, protectedFetch } from "../../../shared/api/httpClient";

const getPreparedBlob = async (contractId, download = false) => {
  const response = await protectedFetch(
    `/contracts/my/${contractId}/documents/prepared${download ? "?download=1" : ""}`,
    {
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
  const response = await protectedFetch(
    `/contracts/my/${contractId}/documents/final${download ? "?download=1" : ""}`,
    {
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
