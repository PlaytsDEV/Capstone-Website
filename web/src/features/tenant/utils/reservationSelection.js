/**
 * Deterministic, testable reservation-selection logic shared by
 * useReservationFlow.js (loadActiveReservation) and ProfilePage.jsx
 * (Dashboard/Profile tab reservation resolution).
 *
 * Extracted so the "don't silently pick an arbitrary reservation when
 * multiple are active" and "re-resolve when the list changes rather than
 * caching a stale id" rules have a single, independently testable source of
 * truth instead of being duplicated inline in two different React files.
 */

const TERMINAL_STATUSES = ["cancelled", "archived", "rejected"];

const getStatus = (reservation) =>
  reservation?.reservationStatus || reservation?.status || "";

/** Reservations that are not archived and not in a terminal status. */
export const filterActiveReservations = (reservations, extraTerminalStatuses = []) => {
  const list = Array.isArray(reservations) ? reservations : [];
  const terminal = [...TERMINAL_STATUSES, ...extraTerminalStatuses];
  return list.filter((reservation) => {
    if (reservation?.isArchived) return false;
    const status = getStatus(reservation);
    return !terminal.includes(status);
  });
};

/**
 * Sort active reservations deterministically: most-recently-updated first
 * (falling back to most-recently-created). This is the single ordering rule
 * used to pick a "current" reservation everywhere in the tenant reservation
 * flow, so two different screens can never diverge on which record is
 * "current" just because they applied a different tie-break.
 */
export const sortByRecency = (reservations) =>
  (Array.isArray(reservations) ? reservations : [])
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    });

/**
 * Classifies how many active reservations a user has and what to do:
 *  - "none"     -> normal new-reservation flow
 *  - "single"   -> safe to resume automatically
 *  - "multiple" -> recovery scenario; caller must NOT silently pick one
 */
export const classifyActiveReservations = (reservations) => {
  const active = sortByRecency(filterActiveReservations(reservations));
  if (active.length === 0) return { kind: "none", reservation: null, active };
  if (active.length === 1) return { kind: "single", reservation: active[0], active };
  return { kind: "multiple", reservation: null, active };
};

/**
 * Resolves which reservation a "current reservation" view (e.g. the
 * Dashboard/Profile tabs) should show, re-resolving from the live list
 * instead of trusting a possibly-stale previously-selected id.
 *
 * Returns { reservation, nextSelectedId } — nextSelectedId is what the
 * caller should persist as its selection state, which may differ from the
 * input `selectedId` when the previous selection is no longer eligible.
 */
export const resolveCurrentReservation = (reservations, selectedId) => {
  const active = sortByRecency(filterActiveReservations(reservations));
  if (active.length === 0) {
    return { reservation: null, nextSelectedId: null };
  }
  const stillValid = active.find((reservation) => reservation._id === selectedId);
  if (stillValid) {
    return { reservation: stillValid, nextSelectedId: selectedId };
  }
  return { reservation: active[0], nextSelectedId: active[0]._id };
};
