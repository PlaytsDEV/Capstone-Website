export const TENANT_CONTRACT_STATUS = Object.freeze({
  draft: "Being Prepared",
  incomplete: "Being Prepared",
  ready_for_generation: "Being Prepared",
  generated: "Prepared",
  awaiting_signatures: "Awaiting Signature",
  partially_signed: "Signing in Progress",
  signed: "Signed — Awaiting Notarization",
  awaiting_notarization: "Awaiting Notarization",
  notarized: "Notarization Completed",
  ready_for_publication: "Notarization Completed",
  published: "Final Contract Available",
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  terminated: "Expired",
  cancelled: "Expired",
});

export const formatTenantContractStatus = (status) =>
  TENANT_CONTRACT_STATUS[status] || "Contract Status Unavailable";

const title = (value) => String(value || "").replaceAll("_", " ").replaceAll("-", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const formatContractType = (templateType, roomType, leaseType) => {
  const source = String(templateType || "");
  const room = roomType || (source.includes("quadruple") ? "quadruple_sharing" : source.includes("double") ? "double_sharing" : source.includes("private") ? "private_room" : "");
  const lease = leaseType || (source.includes("long") ? "long_term" : source.includes("short") ? "short_term" : "");
  const roomLabel = title(room).replace("Private Room", "Private Room");
  const leaseLabel = lease ? `${title(lease).replace("Short Term", "Short-Term").replace("Long Term", "Long-Term")} Lease` : "";
  return [roomLabel, leaseLabel].filter(Boolean).join(" — ") || "Not available";
};

export const formatRoomBed = (roomNumber, bedLabel) => {
  const bed = title(bedLabel)
    .replace(/^Upper$/, "Upper Bed")
    .replace(/^Lower$/, "Lower Bed");
  return {
    room: roomNumber || "Not available",
    bed: bed || "Not available",
    combined: [roomNumber, bed].filter(Boolean).join(" · ") || "Not available",
  };
};

export const getTenantContractMessage = (contract) => {
  if (!contract) return {
    title: "Your Contract is still being prepared.",
    message: "A dedicated Contract record is not yet available.",
  };
  if (contract.status === "generated") return {
    title: "Prepared Contract Available",
    message: "Your prepared copy is available before physical signing and notarization.",
    nextAction: "The administrator will coordinate physical signing and in-person notarization.",
  };
  if (["awaiting_signatures", "partially_signed", "signed", "awaiting_notarization"]
    .includes(contract.status)) return {
    title: "Contract Processing",
    message: "Contract Processing — Physical signing and in-person notarization are being completed.",
    nextAction: "No action is required unless the dormitory administrator contacts you.",
  };
  if (["notarized", "ready_for_publication"].includes(contract.status)) return {
    title: "Notarization Completed",
    message: "Your signed and notarized Contract is being reviewed for final publication.",
    nextAction: "The notarized scan remains private until publication.",
  };
  if (["published", "active", "expiring_soon", "expired"].includes(contract.status)) return {
    title: "Final Contract Available",
    message: "Your wet-signed and notarized Contract is available as a secure digital copy.",
    nextAction: "View or download your final Contract below.",
  };
  return {
    title: formatTenantContractStatus(contract.status),
    message: "Your Contract record is available below.",
    nextAction: "No action is required unless the dormitory administrator contacts you.",
  };
};

export const getTenantContractError = (error) => {
  const code = error?.response?.data?.code;
  if (["PREPARED_CONTRACT_NOT_FOUND", "PREPARED_DOCUMENT_UNAVAILABLE"].includes(code)) {
    return "The prepared document is temporarily unavailable. Please contact the administrator.";
  }
  return "We could not load your Contract information. Please try again.";
};
