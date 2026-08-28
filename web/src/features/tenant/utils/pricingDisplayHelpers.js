import { resolveApplianceBreakdown, calculateRoomDetailsCost } from "./roomDetailsPricing.js";

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

/**
 * Returns a complete, synchronized monthly pricing breakdown for any reservation step.
 * Respects active lease duration (short-term vs. long-term rate calculation),
 * server pricingDisplay snapshot/preview, and itemized appliance add-ons.
 */
export const getEffectiveMonthlyStayRate = (reservationData, overrides = {}) => {
  const room = reservationData?.room || {};
  const pricingDisplay = reservationData?.pricingDisplay;
  const rawServerRate = getResolvedMonthlyRate(pricingDisplay);

  const leaseDuration =
    overrides.leaseDuration ||
    reservationData?.leaseDuration ||
    pricingDisplay?.leaseDurationMonths ||
    (pricingDisplay?.leaseType === "short_term" ? "3" : null) ||
    room?.leaseDuration ||
    "6";

  let baseMonthlyRent = null;

  // 1. If an authoritative server pricingDisplay exists, prioritize its rate
  if (rawServerRate !== null) {
    const isExplicitOverride = Boolean(overrides.leaseDuration);
    const matchesServerDuration =
      !pricingDisplay?.leaseDurationMonths ||
      String(pricingDisplay.leaseDurationMonths) === String(leaseDuration) ||
      (pricingDisplay.leaseType === "short_term" && Number(leaseDuration) < 6) ||
      (pricingDisplay.leaseType === "long_term" && Number(leaseDuration) >= 6);

    if (!isExplicitOverride || matchesServerDuration) {
      baseMonthlyRent = rawServerRate;
    }
  }

  // 2. If no server rate or an explicit duration change occurred, dynamically calculate
  if (baseMonthlyRent === null) {
    const cost = calculateRoomDetailsCost({
      room,
      roomType: room?.type || reservationData?.preferredRoomType || reservationData?.roomType,
      activeLeaseDuration: leaseDuration,
    });
    baseMonthlyRent = cost.activeMonthlyRate;
  }

  if (baseMonthlyRent === null && Number.isFinite(Number(reservationData?.monthlyRent))) {
    baseMonthlyRent = Number(reservationData.monthlyRent);
  } else if (baseMonthlyRent === null && Number.isFinite(Number(room?.monthlyPrice))) {
    baseMonthlyRent = Number(room.monthlyPrice);
  }

  const rawApplianceFees = Number(reservationData?.applianceFees) || 0;
  const selectedAppliances = reservationData?.selectedAppliances || [];
  const applianceBreakdown = resolveApplianceBreakdown(selectedAppliances, rawApplianceFees, room);
  const applianceFees = applianceBreakdown.totalApplianceFees;

  const hasResolvedRate = baseMonthlyRent !== null && Number.isFinite(baseMonthlyRent);
  const estimatedMonthlyTotal = hasResolvedRate ? baseMonthlyRent + applianceFees : null;

  const applianceNote =
    applianceFees > 0
      ? `Includes ₱${applianceFees.toLocaleString()}/mo appliance add-ons`
      : "";

  return {
    baseMonthlyRent,
    applianceFees,
    estimatedMonthlyTotal,
    hasResolvedRate,
    applianceBreakdown,
    applianceNote,
    formattedBaseRent: hasResolvedRate ? `₱${baseMonthlyRent.toLocaleString()}` : "Upon Review",
    formattedTotal: hasResolvedRate ? `₱${estimatedMonthlyTotal.toLocaleString()}` : "Upon Review",
    formattedMonthlyRate: hasResolvedRate ? `₱${estimatedMonthlyTotal.toLocaleString()} / mo` : "Upon Review",
  };
};
