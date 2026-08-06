/**
 * Admin approval gating logic for reservation.pricingDisplay, extracted out
 * of ReservationDetailsModal.jsx so it's independently testable and the
 * component can't drift from what's actually tested.
 *
 * Must fail closed: approval is blocked whenever pricingDisplay isn't a
 * usable preview/snapshot, INCLUDING when it's entirely absent (e.g. a
 * reservation object sourced from the admin-list endpoint via the
 * ReservationsPage.jsx getById-failure fallback, which never carries
 * pricingDisplay — see reservationCrudController.js's getReservations,
 * which only attaches it when `view` is not "admin-list"). The backend
 * independently rejects an approval with unresolved pricing regardless of
 * this gate, but the UI must never imply it's safe to try.
 */
export const resolveReservationApprovalPricingGate = (pricingDisplay) => {
  const pricingIsUsable =
    pricingDisplay?.status === "preview" || pricingDisplay?.status === "snapshotted";
  return {
    pricingIsUsable,
    pricingIsMissing: !pricingDisplay,
    pricingBlocksApproval: !pricingIsUsable,
  };
};
