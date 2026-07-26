const CONTRACT_BRANCHES = Object.freeze({
  "gil-puyat": Object.freeze({
    code: "GP",
    propertyName: "LILYCREST GIL PUYAT",
    propertyAddress: "#7 Gil Puyat Ave. corner Marconi St., Makati City",
    allowedRoomTypes: Object.freeze([
      "private",
      "double-sharing",
      "quadruple-sharing",
    ]),
  }),
  guadalupe: Object.freeze({
    code: "GUAD",
    propertyName: "LILYCREST GUADALUPE",
    propertyAddress: "9431 Magallanes Street, 1212 Makati, Metro Manila",
    allowedRoomTypes: Object.freeze(["quadruple-sharing"]),
  }),
});

export const CONTRACT_LESSOR = Object.freeze({
  businessName: "FIRST JRAC PARTNERSHIP CO.",
  representative: "JOANNE ONG",
  position: "General Partner – LESSOR",
  principalOffice: "9431 Magallanes Street, 1212 Makati, Metro Manila",
});

export const resolveContractBranch = (branch) => {
  const normalized = String(branch || "").trim().toLowerCase();
  const config = CONTRACT_BRANCHES[normalized];
  if (!config) {
    const error = new Error("A verified contract property configuration is required.");
    error.code = "CONTRACT_BRANCH_NOT_CONFIGURED";
    error.statusCode = 400;
    throw error;
  }
  return { branch: normalized, ...config, lessor: CONTRACT_LESSOR };
};

const CONTRACT_ROOM_TYPE_ALIASES = Object.freeze({
  private: "private",
  "private-room": "private",
  private_room: "private",
  double: "double-sharing",
  "double-sharing": "double-sharing",
  double_sharing: "double-sharing",
  quadruple: "quadruple-sharing",
  "quadruple-sharing": "quadruple-sharing",
  quadruple_sharing: "quadruple-sharing",
  "four-sharing": "quadruple-sharing",
  four_sharing: "quadruple-sharing",
  "4-sharing": "quadruple-sharing",
  "4_sharing": "quadruple-sharing",
});

export const normalizeContractRoomType = (roomType) => {
  const normalized = String(roomType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return CONTRACT_ROOM_TYPE_ALIASES[normalized] || null;
};

export const resolveAllowedContractRoomTypes = (branch) =>
  [...resolveContractBranch(branch).allowedRoomTypes];

export const isRoomTypeAllowedForBranch = (branch, roomType) => {
  const canonicalRoomType = normalizeContractRoomType(roomType);
  return Boolean(
    canonicalRoomType &&
    resolveAllowedContractRoomTypes(branch).includes(canonicalRoomType),
  );
};

export const validateBranchRoomType = (branch, roomType) => {
  const branchConfig = resolveContractBranch(branch);
  const canonicalRoomType = normalizeContractRoomType(roomType);
  if (
    !canonicalRoomType ||
    !branchConfig.allowedRoomTypes.includes(canonicalRoomType)
  ) {
    const message =
      branch === "guadalupe"
        ? "Lilycrest Guadalupe only supports Quadruple Sharing contracts."
        : "The assigned room type is not supported for this branch.";
    const error = new Error(message);
    error.code = "ROOM_TYPE_NOT_ALLOWED_FOR_BRANCH";
    error.statusCode = 409;
    error.details = {
      branch,
      roomType: canonicalRoomType || String(roomType || ""),
      allowedRoomTypes: [...branchConfig.allowedRoomTypes],
    };
    throw error;
  }
  return canonicalRoomType;
};

export { CONTRACT_BRANCHES };
