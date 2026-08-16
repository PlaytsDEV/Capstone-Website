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
    title: "Contract Not Available Yet",
    message: "Your official contract or digital proof of stay has not been published yet. Once your stay is confirmed, you can view your lease details and download your official document here.",
  };
  if (contract.tenantDocument?.type === "final_notarized") {
    return {
      title: "Final Notarized Contract Available",
      message: "Your official wet-signed and notarized lease agreement is finalized and verified.",
      nextAction: "You can view, print, or download your official notarized document below.",
    };
  }
  if (contract.tenantDocument?.type === "generated_draft") {
    return {
      title: "Generated Draft — For Signing",
      message: "Your contract has been generated and is ready for in-person signing. The final notarized copy will replace this document once uploaded by the admin.",
      nextAction: "You can review and download the generated draft to check terms before signing.",
    };
  }
  if (contract.stayProofAvailable || contract.status === "active") {
    return {
      title: "Verified Active Stay",
      message: "Your official Digital Proof of Stay & Tenancy Agreement is active and verified.",
      nextAction: "You can view, print, or download your official PDF stay record below.",
    };
  }
  if (contract.status === "generated" && contract.preparedDocument?.available !== true) {
    return {
      title: "Prepared Document Temporarily Unavailable",
      message: "Your Contract record is available, but the prepared PDF cannot currently be opened. The dormitory administrator must regenerate the document.",
      nextAction: "No action is required unless the dormitory administrator contacts you.",
    };
  }
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
  if (["published", "expiring_soon", "expired"].includes(contract.status)) return {
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
