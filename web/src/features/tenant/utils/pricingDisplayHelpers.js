/**
 * Shared, testable helpers for consuming the server-derived
 * reservation.pricingDisplay field (see buildPricingDisplay in
 * server/services/contractPricingResolver.js). Used by
 * ReservationSummaryStep.jsx, RoomInfoBanner.jsx, and
 * ReservationAgreementPage.jsx so none of them recompute a rate client-side.
 */

export const isPricingDisplayUsable = (pricingDisplay) =>
  pricingDisplay?.status === "preview" || pricingDisplay?.status === "snapshotted";

/**
 * Returns the resolved final monthly rate as a finite number, or null when
 * no server-resolved rate exists yet (caller must show a neutral state, not
 * guess a number).
 */
export const getResolvedMonthlyRate = (pricingDisplay) => {
  if (!isPricingDisplayUsable(pricingDisplay)) return null;
  const rate = Number(pricingDisplay?.finalMonthlyRate);
  return Number.isFinite(rate) ? rate : null;
};
