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

const getStayProofBlob = async (download = false) => {
  const response = await protectedFetch(
    `/contracts/my/stay-proof${download ? "?download=1" : "?download=0"}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || payload.message || "Stay Proof PDF unavailable.");
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return response.blob();
};

const getSignedBlob = async (contractId, version, download = false) => {
  const suffix = version ? `/${version}` : "";
  const response = await protectedFetch(
    `/contracts/my/${contractId}/documents/signed${suffix}${download ? "?download=1" : ""}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || payload.message || "Signed Contract copy unavailable.");
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
  getMySignedContractFile: getSignedBlob,
  getMyStayProofBlob: getStayProofBlob,
  getMyStayProofData: () => authFetch("/contracts/my/stay-proof-data", { cache: "no-store" }),
  getPublicStayVerification: (referenceId) => fetch(`/api/contracts/verify/${referenceId}`).then(r => r.json()),
  // "I confirm that I have viewed this contract." — not a signature.
  getMyContractAcknowledgement: (contractId) =>
    authFetch(`/contracts/my/${contractId}/acknowledgement`, { cache: "no-store" }),
  acknowledgeMyContract: (contractId) =>
    authFetch(`/contracts/my/${contractId}/acknowledge`, { method: "POST" }),
};
