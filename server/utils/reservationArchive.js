import { normalizeReservationStatus } from "./lifecycleNaming.js";

export const SAFE_ARCHIVE_RESTORE_STATUSES = Object.freeze([
  "cancelled",
  "rejected",
  "moveOut",
]);

const safeRestoreStatuses = new Set(SAFE_ARCHIVE_RESTORE_STATUSES);

export const resolveArchivePreviousStatus = (reservation = {}) => {
  const previousStatus = normalizeReservationStatus(
    reservation.archivedPreviousStatus ||
      reservation.previousStatus ||
      reservation.status,
  );

  return previousStatus || "cancelled";
};

export const resolveArchivedRestoreStatus = (reservation = {}) => {
  const previousStatus = resolveArchivePreviousStatus(reservation);
  if (safeRestoreStatuses.has(previousStatus)) return previousStatus;

  const currentStatus = normalizeReservationStatus(reservation.status);
  if (safeRestoreStatuses.has(currentStatus)) return currentStatus;

  return "cancelled";
};
