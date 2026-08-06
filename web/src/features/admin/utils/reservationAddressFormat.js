// Mirrors the server's joinAddress (tenantProfileService.js) ordering so the
// admin-facing display matches what would end up on a generated contract.
// Extracted from ReservationDetailsModal.jsx into its own module so it can
// be unit-tested directly, independent of mounting the (large, heavily
// wired-up) modal component itself.
export const formatSubmittedAddress = (address) => {
  if (!address || typeof address !== "object") return "";
  return [address.unitHouseNo, address.street, address.barangay, address.city, address.province]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
};
