import { authFetch, protectedFetch } from "./httpClient.js";

const queryString = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) =>
      value !== undefined && value !== null && value !== "" && value !== "all"),
  ).toString();
  return query ? `?${query}` : "";
};

const fetchPreparedBlob = async (contractId, version) => {
  const suffix = version ? `/${version}` : "";
  const response = await protectedFetch(
    `/contracts/${contractId}/documents/prepared${suffix}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || payload.message || "Prepared PDF could not be loaded.");
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return response.blob();
};

const fetchSignedBlob = async (contractId, version, download = false) => {
  const suffix = version ? `/${version}` : "";
  const response = await protectedFetch(
    `/contracts/${contractId}/documents/signed${suffix}${download ? "?download=true" : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "Signed copy could not be loaded.");
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return response.blob();
};

const fetchPrivateContractBlob = async (path) => {
  const response = await protectedFetch(path, {
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "Contract document could not be loaded.");
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return response.blob();
};

export const contractApi = {
  listContracts: (filters = {}) =>
    authFetch(`/contracts${queryString(filters)}`),
  getContract: (contractId) => authFetch(`/contracts/${contractId}`),
  getTenantCurrentContract: (tenantId) => authFetch(`/contracts/tenant/${tenantId}/current`),
  // Read-only — Admin can never acknowledge on the tenant's behalf.
  getContractAcknowledgement: (contractId) =>
    authFetch(`/contracts/${contractId}/acknowledgement`, { cache: "no-store" }),
  createContractDraft: ({ reservationId, stayId }) =>
    authFetch("/contracts", {
      method: "POST",
      body: JSON.stringify({ reservationId, ...(stayId ? { stayId } : {}) }),
    }),
  validateContract: (contractId) =>
    authFetch(`/contracts/${contractId}/validate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  approveGenerationPricing: (contractId, decision, notes = "") =>
    authFetch(`/contracts/${contractId}/approve-generation-pricing`, {
      method: "POST",
      body: JSON.stringify({ confirmed: true, decision, notes }),
    }),
  confirmLegacyReservationApproval: (contractId, reason) =>
    authFetch(`/contracts/${contractId}/confirm-legacy-reservation-approval`, {
      method: "POST",
      body: JSON.stringify({ confirmed: true, reason }),
    }),
  getGenerationPreview: (contractId) =>
    authFetch(`/contracts/${contractId}/generation-preview`),
  generatePreparedContract: (contractId, regenerationReason = "") =>
    authFetch(`/contracts/${contractId}/generate`, {
      method: "POST",
      body: JSON.stringify(
        regenerationReason ? { regenerationReason } : {},
      ),
    }),
  getPreparedContractFile: fetchPreparedBlob,
  markPrinted: (contractId) => authFetch(`/contracts/${contractId}/mark-printed`, {
    method: "POST", body: JSON.stringify({ confirmed: true }),
  }),
  updateSignature: (contractId, signer, status) =>
    authFetch(`/contracts/${contractId}/signatures/${signer}`, {
      method: "POST", body: JSON.stringify({ status }),
    }),
  uploadSignedContract: (contractId, file, replacementReason = "") => {
    const body = new FormData();
    body.append("file", file);
    if (replacementReason) body.append("replacementReason", replacementReason);
    return authFetch(`/contracts/${contractId}/documents/signed`, { method: "POST", body });
  },
  getSignedContractFile: fetchSignedBlob,
  verifySignedContract: (contractId, notes = "") =>
    authFetch(`/contracts/${contractId}/documents/signed/verify`, {
      method: "POST",
      body: JSON.stringify({
        confirmed: true, notes,
        checklist: {
          tenantSignatureVisible: true, lessorSignatureVisible: true,
          witnessesSatisfied: true, contractNumberMatches: true,
          tenantNameMatches: true, allPagesComplete: true, scanReadable: true,
          preparedVersionMatches: true, legalTextUnaltered: true,
        },
      }),
    }),
  rejectSignedContract: (contractId, reason) =>
    authFetch(`/contracts/${contractId}/documents/signed/reject`, {
      method: "POST", body: JSON.stringify({ reason }),
    }),
  deleteSignedContract: (contractId, version, reason = "") =>
    authFetch(`/contracts/${contractId}/documents/signed${version ? `/${version}` : ""}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
  uploadNotarizedContract: (
    contractId, file, preparedDocumentVersion, replacementReason = "", notarialDetails = {},
  ) => {
    const body = new FormData();
    body.append("file", file);
    body.append("preparedDocumentVersion", String(preparedDocumentVersion));
    if (replacementReason) body.append("replacementReason", replacementReason);
    body.append("notarialDetails", JSON.stringify(notarialDetails));
    return authFetch(`/contracts/${contractId}/documents/notarized`, { method: "POST", body });
  },
  uploadFinalNotarizedContract: (
    contractId, file, preparedDocumentVersion, replacementReason = "", notarialDetails = {}, notes = "",
  ) => {
    const body = new FormData();
    body.append("file", file);
    body.append("confirmed", "true");
    if (preparedDocumentVersion) body.append("preparedDocumentVersion", String(preparedDocumentVersion));
    if (replacementReason) body.append("replacementReason", replacementReason);
    if (notes) body.append("notes", notes);
    body.append("notarialDetails", typeof notarialDetails === "string" ? notarialDetails : JSON.stringify(notarialDetails));
    return authFetch(`/contracts/${contractId}/documents/final-notarized`, { method: "POST", body });
  },
  getNotarizedContractFile: (contractId, version, download = false) =>
    fetchPrivateContractBlob(`/contracts/${contractId}/documents/notarized${version ? `/${version}` : ""}${download ? "?download=true" : ""}`),
  verifyNotarizedContract: (contractId, documentVersion, checklist, notes = "") =>
    authFetch(`/contracts/${contractId}/documents/notarized/verify`, {
      method: "POST", body: JSON.stringify({
        confirmed: true, documentVersion, checklist, notes,
      }),
    }),
  rejectNotarizedContract: (contractId, documentVersion, reason) =>
    authFetch(`/contracts/${contractId}/documents/notarized/reject`, {
      method: "POST", body: JSON.stringify({ documentVersion, reason }),
    }),
  markReadyForPublication: (contractId) =>
    authFetch(`/contracts/${contractId}/ready-for-publication`, {
      method: "POST", body: JSON.stringify({ confirmed: true }),
    }),
  publishFinalContract: (contractId, checklist, notes = "") =>
    authFetch(`/contracts/${contractId}/publish`, {
      method: "POST", body: JSON.stringify({ confirmed: true, checklist, notes }),
    }),
  getFinalContractFile: (contractId, download = false) =>
    fetchPrivateContractBlob(`/contracts/${contractId}/documents/final${download ? "?download=1" : ""}`),
  replaceFinalContract: (contractId, file, replacementReason) => {
    const body = new FormData();
    body.append("file", file);
    body.append("confirmed", "true");
    body.append("replacementReason", replacementReason);
    return authFetch(`/contracts/${contractId}/documents/final/replace`, { method: "POST", body });
  },
  getFinalDocumentHistory: (contractId) =>
    authFetch(`/contracts/${contractId}/documents/final/history`, { cache: "no-store" }),
  getPreparedDocumentVersions: async (contractId) => {
    const payload = await authFetch(`/contracts/${contractId}`);
    return payload.contract?.preparedDocuments || [];
  },
  archiveContract: (contractId, reason, duplicateOfContractId = "") =>
    authFetch(`/contracts/${contractId}/archive`, {
      method: "POST",
      body: JSON.stringify({ reason, ...(duplicateOfContractId ? { duplicateOfContractId } : {}) }),
    }),
  restoreContract: (contractId, reason) =>
    authFetch(`/contracts/${contractId}/restore`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getDeletionEligibility: (contractId) =>
    authFetch(`/contracts/${contractId}/deletion-eligibility`, { cache: "no-store" }),
  permanentlyDeleteTestContract: (contractId, confirmationContractNumber, reason) =>
    authFetch(`/contracts/${contractId}/permanent`, {
      method: "DELETE",
      body: JSON.stringify({ confirmationContractNumber, reason }),
    }),
  getStayProofFile: (id, download = false) =>
    fetchPrivateContractBlob(`/contracts/${id}/stay-proof${download ? "?download=1" : ""}`),
  getStayProofData: (id) =>
    authFetch(`/contracts/${id}/stay-proof-data`),
};
