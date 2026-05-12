export const ROOM_BRANCHES = Object.freeze(["gil-puyat", "guadalupe"]);

export const INQUIRY_BRANCHES = Object.freeze([
  ...ROOM_BRANCHES,
  "general",
]);

export const ROOM_BRANCH_LABELS = Object.freeze({
  "gil-puyat": "Gil Puyat",
  guadalupe: "Guadalupe",
});

export const isValidRoomBranch = (branch) => ROOM_BRANCHES.includes(branch);

export const isValidInquiryBranch = (branch) =>
  INQUIRY_BRANCHES.includes(branch);

/**
 * Branch-specific business rules.
 * Single source of truth — use these in controllers and middleware
 * instead of hardcoding branch strings in business logic.
 */
export const BRANCH_RULES = Object.freeze({
  "gil-puyat": {
    displayName: "Gil Puyat",
    hasSubmeter: true,
    electricityBillingMode: "submetered",
    applianceDeviceFeeEnabled: false,
    applianceDeviceFeePerUnit: 0,
    allowedRoomTypes: ["private", "double", "quadruple"],
  },
  guadalupe: {
    displayName: "Guadalupe",
    hasSubmeter: false,
    electricityBillingMode: "none",
    applianceDeviceFeeEnabled: true,
    applianceDeviceFeePerUnit: 200,
    applianceDeviceFeeOptional: true,
    applianceDeviceFeeRecurring: true,
    applianceDeviceFeeBasis: "per_active_declared_quantity",
    allowedRoomTypes: ["quadruple"],
  },
});

/** Returns true if the branch uses submeter-based electricity billing. */
export const branchHasSubmeter = (branch) =>
  !!BRANCH_RULES[String(branch || "").toLowerCase()]?.hasSubmeter;

/** Returns true if electricity utility periods are supported for this branch. */
export const branchSupportsElectricityBilling = (branch) =>
  branchHasSubmeter(branch);
