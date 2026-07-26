const source = (item) => `${item?.code || ""} ${item?.field || ""} ${item?.message || ""}`.toUpperCase();

export const mapContractBlocker = (item = {}) => {
  const value = source(item);
  if (value.includes("RESERVATION_LEGACY_VERIFICATION_REQUIRED")) return {
    kind: "reservation", title: "Reservation record needs verification",
    description: "This tenant is already marked as moved in, but the Reservation is missing approval metadata required for Contract generation.",
    action: "Verify Reservation Record",
  };
  if (value.includes("PRIC") || value.includes("RATE") || value.includes("DISCOUNT")) return {
    kind: "pricing", title: "Approve Contract Pricing",
    description: "The monthly rental rate requires an authorized pricing approval record.",
    action: "Review Pricing",
  };
  if (value.includes("ROOM") || value.includes("BED") || value.includes("ASSIGN")) return {
    kind: "assignment", title: "Complete Tenant Assignment",
    description: "The tenant does not have a complete room and bed assignment.",
    action: "Open Tenant Assignment",
  };
  if (value.includes("NAME") || value.includes("ADDRESS") || value.includes("TENANT")) return {
    kind: "profile", title: "Correct Tenant Legal Information",
    description: "Verified tenant legal information is incomplete or inconsistent.",
    action: "Open Tenant Profile",
  };
  if (value.includes("TEMPLATE") || value.includes("ROOM_TYPE") || value.includes("LEASE_TYPE")) return {
    kind: "reservation", title: "Review Room and Lease Type",
    description: "No official Contract template matches the current room and lease type.",
    action: "Open Reservation",
  };
  if (value.includes("REGENERATION")) return {
    kind: "refresh", title: "Refresh Prepared Contract",
    description: "Source information changed. Generate a new prepared Contract after resolving the remaining issues.",
    action: "Refresh Contract Checks",
  };
  return {
    kind: "reservation", title: "Approve Reservation and Application",
    description: "The reservation and application must be approved before Contract generation.",
    action: "Open Reservation",
  };
};

export const getContractBlockers = (validation) => {
  if (!validation || validation.valid) return [];
  const items = [
    ...(validation.missingFields || []), ...(validation.conflicts || []),
    ...(validation.warnings || []), ...(validation.errors || []),
    ...(validation.pricingValidation?.warnings || []),
  ];
  const mapped = items.map(mapContractBlocker);
  return mapped.filter((item, index) =>
    mapped.findIndex((candidate) => candidate.kind === item.kind && candidate.title === item.title) === index);
};

export const getReadinessCopy = (contract, validation, hasUnverifiedNotarized = false) => {
  if (["notarized", "ready_for_publication"].includes(contract?.status)) {
    return { title: "Ready to Publish", message: "The verified scan is ready for final publication review." };
  }
  if (["published", "active"].includes(contract?.status)) return { title: "Published", message: "The final Contract is available." };
  if (hasUnverifiedNotarized) return { title: "Pending Physical Completion", message: "Verify the uploaded signed-and-notarized copy." };
  if (["generated", "awaiting_signatures", "partially_signed", "signed", "awaiting_notarization"].includes(contract?.status)) {
    return { title: contract.status === "generated" ? "Prepared Contract Available" : "Pending Physical Completion", message: "Complete physical signing and in-person notarization." };
  }
  if (validation?.valid) return { title: "Ready to Generate", message: "Approved information is complete and ready for the prepared Contract." };
  const count = getContractBlockers(validation).length;
  return { title: "Contract Needs Attention", message: `Complete ${count || "the"} item${count === 1 ? "" : "s"} below before generating the prepared Contract.` };
};

export const formatContractHistoryReason = (reason) => {
  const value = String(reason || "");
  if (/new official version 1 template requires approved legal pricing review/i.test(value)) {
    return "Contract returned for pricing approval before generation.";
  }
  if (/prepared test-document reset|replace obsolete unsigned generated copy/i.test(value)) {
    return "Prepared test copy was reset for regeneration using the updated official template.";
  }
  return value || "Status updated";
};
