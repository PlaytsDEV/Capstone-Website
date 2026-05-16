import {
  PHYSICAL_VISIT_APPLICATION_LOCKED_MESSAGE,
  canProceedToApplicationAfterVisit,
  getPhysicalVisitApplicantState,
} from "./physicalVisitFlow.js";

export const CONFIRM_VISIT_SCHEDULE_LABEL = "Confirm Visit Schedule";
export const SAVE_VIEWING_PREFERENCE_LABEL = "Save and Return to Dashboard";

export function getVisitScheduleSubmitLabel(selectedVisit) {
  return selectedVisit === "physical_visit"
    ? CONFIRM_VISIT_SCHEDULE_LABEL
    : SAVE_VIEWING_PREFERENCE_LABEL;
}

export function canFreelyEditViewingPreference({
  selectedVisit,
  hasSavedPhysicalVisit = false,
} = {}) {
  return selectedVisit !== "physical_visit" || !hasSavedPhysicalVisit;
}

export function getVisitSummaryUiState({
  selectedVisit,
  reservation,
  allowApplicantReschedule = false,
} = {}) {
  const isPhysicalVisit = selectedVisit === "physical_visit";
  const physicalVisitState = isPhysicalVisit
    ? getPhysicalVisitApplicantState(reservation)
    : null;
  const canProceedToApplication =
    !isPhysicalVisit || canProceedToApplicationAfterVisit(reservation);
  const isLockedPhysicalVisit = isPhysicalVisit && !canProceedToApplication;

  if (!isPhysicalVisit) {
    return {
      canProceedToApplication: true,
      isLockedPhysicalVisit: false,
      lockedMessage: "",
      physicalVisitState: null,
      showBack: true,
      showChangeViewingPreference: true,
      showReturnToDashboard: true,
      showRequestReschedule: false,
      applicationCtaLabel: "Proceed to Application",
    };
  }

  return {
    canProceedToApplication,
    isLockedPhysicalVisit,
    lockedMessage: isLockedPhysicalVisit
      ? PHYSICAL_VISIT_APPLICATION_LOCKED_MESSAGE
      : "",
    physicalVisitState,
    showBack: false,
    showChangeViewingPreference: false,
    showReturnToDashboard: true,
    showRequestReschedule: Boolean(allowApplicantReschedule && isLockedPhysicalVisit),
    applicationCtaLabel: canProceedToApplication
      ? "Proceed to Application"
      : "Application Locked",
  };
}
