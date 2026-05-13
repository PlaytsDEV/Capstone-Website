export function normalizeReservationVisitDate(value) {
  if (!value) return "";
  return String(value).split("T")[0];
}

export function getPersistedPhysicalVisitState(
  reservationData = {},
  selectedVisit = "",
  scheduleRejected = false,
) {
  const persistedPreference =
    reservationData?.viewingPreference || reservationData?.viewingType || "";
  const savedVisitDate = normalizeReservationVisitDate(reservationData?.visitDate);
  const savedVisitTime = String(reservationData?.visitTime || "").trim();
  const hasPersistedPhysicalPreference =
    persistedPreference === "physical_visit" ||
    persistedPreference === "inperson" ||
    Boolean(reservationData?.visitDate);

  return {
    savedVisitDate,
    savedVisitTime,
    hasSavedPhysicalVisit:
      selectedVisit === "physical_visit" &&
      hasPersistedPhysicalPreference &&
      Boolean(savedVisitDate && savedVisitTime) &&
      !scheduleRejected,
  };
}
