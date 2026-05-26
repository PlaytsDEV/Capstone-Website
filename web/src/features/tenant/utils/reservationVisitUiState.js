import {
  PHYSICAL_VISIT_APPLICATION_LOCKED_MESSAGE,
  canAccessTenantApplication,
  getPhysicalVisitApplicantState,
} from "./physicalVisitFlow.js";
import {
  SUBMIT_VIEWING_PREFERENCE_LABEL,
  VIEWING_PREFERENCE_LOCKED_MESSAGE,
} from "./reservationViewingPreferenceLock.js";

export const CONFIRM_VISIT_SCHEDULE_LABEL = "Confirm Visit Schedule";
export const SAVE_VIEWING_PREFERENCE_LABEL = SUBMIT_VIEWING_PREFERENCE_LABEL;

export function getVisitScheduleSubmitLabel(selectedVisit) {
  if (selectedVisit === "physical_visit") return "Submit";
  if (selectedVisit === "remote_2d_viewing") return "Submit Remote Viewing Request";
  if (selectedVisit === "urgent_move_in_review") return "Submit Priority Review Request";
  return SUBMIT_VIEWING_PREFERENCE_LABEL;
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
  viewingPreferenceLocked = false,
} = {}) {
  const isPhysicalVisit = selectedVisit === "physical_visit";
  const physicalVisitState = isPhysicalVisit
    ? getPhysicalVisitApplicantState(reservation)
    : null;
  const canProceedToApplication =
    !isPhysicalVisit || canAccessTenantApplication(reservation);
  const isLockedPhysicalVisit = isPhysicalVisit && !canProceedToApplication;

  if (!isPhysicalVisit) {
    return {
      canProceedToApplication: !viewingPreferenceLocked,
      isLockedPhysicalVisit: false,
      lockedMessage: viewingPreferenceLocked ? VIEWING_PREFERENCE_LOCKED_MESSAGE : "",
      physicalVisitState: null,
      showBack: !viewingPreferenceLocked,
      showChangeViewingPreference: !viewingPreferenceLocked,
      showReturnToDashboard: true,
      showRequestReschedule: false,
      applicationCtaLabel: viewingPreferenceLocked
        ? "View Reservation Status"
        : "Proceed to Application",
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
