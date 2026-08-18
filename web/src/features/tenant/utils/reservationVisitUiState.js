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

export function formatVisitSlotLabel(value, fallback = "Not scheduled") {
  if (!value) return fallback;
  if (typeof value === "object") {
    const raw =
      value?.label ??
      value?.time ??
      value?.slot ??
      value?.value ??
      value?.displayName ??
      value?.name;
    return formatVisitSlotLabel(raw, fallback);
  }
  const str = String(value).trim();
  if (!str) return fallback;

  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    const hour = ampmMatch[1].padStart(2, "0");
    const minute = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    return `${hour}:${minute} ${period}`;
  }

  const time24Match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (time24Match) {
    const hourNum = parseInt(time24Match[1], 10);
    const minute = time24Match[2];
    if (hourNum >= 0 && hourNum <= 23) {
      const period = hourNum >= 12 ? "PM" : "AM";
      const hour12 = String(hourNum % 12 || 12).padStart(2, "0");
      return `${hour12}:${minute} ${period}`;
    }
  }

  return str;
}

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
