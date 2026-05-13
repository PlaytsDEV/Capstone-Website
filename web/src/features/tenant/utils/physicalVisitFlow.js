import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming";

const APPLICATION_UNLOCK_VISIT_STATUSES = new Set([
  "visit_completed",
  "allowed_without_visit",
]);

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
  const explicit = String(reservation?.visitStatus || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (reservation?.visitApproved) return "visit_completed";
  if (reservation?.scheduleRejected) return "visit_cancelled";
  if (isPhysicalVisitPreference(reservation)) return "physical_visit_scheduled";
  return "";
};

export const canProceedToApplicationAfterVisit = (reservation = {}) => {
  if (!isPhysicalVisitPreference(reservation)) return true;

  if (
    hasReservationStatus(
      normalizeReservationStatus(reservation?.status),
      "pending_application_review",
      "needs_revision",
      "approved_for_payment",
      "payment_pending",
      "reserved",
      "moveIn",
      "moveOut",
      "rejected",
    )
  ) {
    return true;
  }

  return APPLICATION_UNLOCK_VISIT_STATUSES.has(
    getReservationVisitStatus(reservation),
  );
};

export const getPhysicalVisitApplicantState = (reservation = {}) => {
  if (!isPhysicalVisitPreference(reservation)) return null;

  const status = getReservationVisitStatus(reservation);

  switch (status) {
    case "visit_completed":
      return {
        statusKey: status,
        title: "Physical Visit Confirmed",
        message:
          "Your physical visit has been confirmed. You may now complete your tenant application.",
        buttonLabel: "Fill Application ->",
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
        buttonLabel: "Fill Application ->",
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
        buttonLabel: "Request Reschedule ->",
        route: "/applicant/reservation?step=2&edit=1",
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
        buttonLabel: "Review Visit ->",
        route: "/applicant/reservation?step=2&edit=1",
        canFillApplication: false,
        isWaiting: false,
        isRejected: true,
      };
    case "rescheduled":
      return {
        statusKey: status,
        title: "Visit Rescheduled",
        message:
          "Please attend your updated room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
        buttonLabel: "Review Visit ->",
        route: "/applicant/reservation?step=2&edit=1",
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
        buttonLabel: "Review Visit ->",
        route: "/applicant/reservation?step=2&edit=1",
        canFillApplication: false,
        isWaiting: true,
        isRejected: false,
      };
  }
};
