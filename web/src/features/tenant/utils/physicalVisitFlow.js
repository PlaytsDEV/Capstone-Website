import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

const APPLICATION_UNLOCK_VISIT_STATUSES = new Set([
  "visit_completed",
  "allowed_without_visit",
]);
const APPLICATION_LOCK_RESERVATION_STATUSES = [
  "rejected",
  "cancelled",
  "expired",
  "archived",
];
const APPLICATION_UNLOCK_RESERVATION_STATUSES = [
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
];
const VISIT_APPLICATION_LOCK_STATUSES = new Set([
  "no_show",
  "rescheduled",
  "visit_cancelled",
]);

export const PHYSICAL_VISIT_APPLICATION_LOCKED_MESSAGE =
  "Tenant application will be available after the admin marks your physical visit as completed.";
export const TENANT_APPLICATION_LOCKED_MESSAGE =
  "Tenant application is locked for this reservation status.";

const VISIT_STATUS_ALIASES = Object.freeze({
  application_unlocked: "allowed_without_visit",
  allowed: "allowed_without_visit",
  completed: "visit_completed",
  approved: "visit_completed",
  cancelled: "visit_cancelled",
  canceled: "visit_cancelled",
  not_required: "allowed_without_visit",
});

export const normalizeVisitStatusKey = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return VISIT_STATUS_ALIASES[normalized] || normalized;
};

export const getReservationViewingPreference = (reservation = {}) =>
  (() => {
    const rawPreference = String(
      reservation?.viewingPreference || reservation?.viewingType || "",
    )
      .trim()
      .toLowerCase();

    if (rawPreference === "physical_visit" || rawPreference === "inperson") {
      return "physical_visit";
    }
    if (
      rawPreference === "remote_2d_viewing" ||
      rawPreference === "remote_2d" ||
      rawPreference === "virtual"
    ) {
      return "remote_2d_viewing";
    }
    if (
      rawPreference === "urgent_move_in_review" ||
      rawPreference === "urgent_move_in"
    ) {
      return "urgent_move_in_review";
    }
    if (reservation?.isUrgentMoveIn) {
      return "urgent_move_in_review";
    }
    if (reservation?.visitDate || reservation?.visitTime) {
      return "physical_visit";
    }
    return null;
  })();

export const isPhysicalVisitPreference = (reservation = {}) =>
  getReservationViewingPreference(reservation) === "physical_visit";

export const getReservationVisitStatus = (reservation = {}) => {
  const explicit = normalizeVisitStatusKey(reservation?.visitStatus);
  if (VISIT_APPLICATION_LOCK_STATUSES.has(explicit)) return explicit;
  if (APPLICATION_UNLOCK_VISIT_STATUSES.has(explicit)) return explicit;
  if (reservation?.visitApproved) return "visit_completed";
  if (explicit) return explicit;
  if (reservation?.scheduleRejected) return "visit_cancelled";
  if (isPhysicalVisitPreference(reservation)) return "physical_visit_scheduled";
  return "";
};

export const canAccessTenantApplication = (reservation = {}) => {
  const status = normalizeReservationStatus(
    reservation?.reservationStatus || reservation?.status,
  );

  if (hasReservationStatus(status, APPLICATION_LOCK_RESERVATION_STATUSES)) {
    return false;
  }

  if (
    hasReservationStatus(
      status,
      APPLICATION_UNLOCK_RESERVATION_STATUSES,
    )
    || reservation?.applicationSubmittedAt
  ) {
    return true;
  }

  const viewingPreference = getReservationViewingPreference(reservation);
  if (!viewingPreference) return false;
  if (viewingPreference !== "physical_visit") return true;

  return APPLICATION_UNLOCK_VISIT_STATUSES.has(getReservationVisitStatus(reservation));
};

export const canProceedToApplicationAfterVisit = canAccessTenantApplication;

export const isPhysicalVisitApplicationLocked = (reservation = {}) =>
  isPhysicalVisitPreference(reservation) &&
  !canAccessTenantApplication(reservation);

export const isPhysicalVisitApplicationStageRequestBlocked = (
  requestedStage,
  reservation = {},
) => Number(requestedStage) === 3 && isPhysicalVisitApplicationLocked(reservation);

export const isTenantApplicationStageRequestBlocked = (
  requestedStage,
  reservation = {},
) => Number(requestedStage) === 3 && !canAccessTenantApplication(reservation);

export const getPhysicalVisitApplicantState = (reservation = {}) => {
  if (!isPhysicalVisitPreference(reservation)) return null;

  if (
    hasReservationStatus(
      normalizeReservationStatus(reservation?.reservationStatus || reservation?.status),
      APPLICATION_LOCK_RESERVATION_STATUSES,
    )
  ) {
    return {
      statusKey: "application_locked",
      title: "Application Locked",
      message: TENANT_APPLICATION_LOCKED_MESSAGE,
      buttonLabel: "View Status",
      route: "/applicant/profile",
      canFillApplication: false,
      isWaiting: false,
      isRejected: true,
    };
  }

  const status = getReservationVisitStatus(reservation);

  switch (status) {
    case "visit_completed":
      return {
        statusKey: status,
        title: "Physical Visit Confirmed",
        message:
          "Your physical visit has been confirmed. You may now complete your tenant application.",
        buttonLabel: "Fill Application",
        route: "/applicant/reservation?step=3",
        canFillApplication: true,
        isWaiting: false,
        isRejected: false,
      };
    case "allowed_without_visit":
      return {
        statusKey: status,
        title: "Application Access Granted",
        message:
          "Admin has allowed you to continue your tenant application without a completed physical visit.",
        buttonLabel: "Fill Application",
        route: "/applicant/reservation?step=3",
        canFillApplication: true,
        isWaiting: false,
        isRejected: false,
      };
    case "no_show":
      return {
        statusKey: status,
        title: "Visit Marked as No-Show",
        message:
          "You missed your scheduled visit. Please reschedule your visit or contact admin.",
        buttonLabel: "View Status",
        route: "/applicant/reservation?step=2",
        canFillApplication: false,
        isWaiting: false,
        isRejected: true,
      };
    case "visit_cancelled":
      return {
        statusKey: status,
        title: "Visit Schedule Cancelled",
        message:
          "Your physical visit schedule was cancelled. Please contact admin or request a new visit schedule before continuing.",
        buttonLabel: "Review Visit",
        route: "/applicant/reservation?step=2",
        canFillApplication: false,
        isWaiting: false,
        isRejected: true,
      };
    case "schedule_approved":
      return {
        statusKey: status,
        title: "Visit Confirmed — Attend Your Visit",
        message:
          "Your visit schedule has been confirmed. Please attend on the scheduled date. You may continue to the tenant application after admin records your visit.",
        buttonLabel: "Review Visit",
        route: "/applicant/reservation?step=2",
        canFillApplication: false,
        isWaiting: true,
        isRejected: false,
      };
    case "rescheduled":
      return {
        statusKey: status,
        title: "Visit Rescheduled",
        message:
          "Please attend your updated room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
        buttonLabel: "Review Visit",
        route: "/applicant/reservation?step=2",
        canFillApplication: false,
        isWaiting: true,
        isRejected: false,
      };
    case "physical_visit_scheduled":
    default:
      return {
        statusKey: status || "physical_visit_scheduled",
        title: "Physical Visit Scheduled",
        message:
          "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
        buttonLabel: "Review Visit",
        route: "/applicant/reservation?step=2",
        canFillApplication: false,
        isWaiting: true,
        isRejected: false,
      };
  }
};
