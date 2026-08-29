// Canonical "does the transfer DESTINATION room need an individual bed?" rule
// for the Transfer Tenant wizard.
//
// Kept deliberately in lockstep with the backend authority,
// `roomRequiresIndividualBed` in
// server/services/reservationContractEligibilityService.js:
//   - "private" is the ONLY room type that needs no individual bed;
//   - every other / unknown / empty-but-present room type requires one
//     (fail-safe, not fail-open).
//
// The client MUST NOT keep its own enumerated list of shared room types — a
// new shared type added server-side would silently bypass a hard-coded
// ["double-sharing", "quadruple-sharing"] check and let the wizard submit a
// bed-less transfer, which the backend Contract validation then rejects with
// ROOM_TRANSFER_CONTRACT_INCOMPLETE. Anything that is not literally "private"
// needs a bed here.
//
// Extracted from TenantWorkspaceModals so the exact predicate the wizard runs
// is unit-testable without mounting React.

/**
 * @param {string|null|undefined} roomType - the DESTINATION room's type
 * @returns {boolean} true when a target bed must be selected before the
 *   transfer can be scheduled; false only for a private destination (or when
 *   no room / room type is known yet).
 */
export const destinationRoomNeedsBed = (roomType) => {
  const t = String(roomType ?? "").trim().toLowerCase();
  return t !== "" && t !== "private";
};
