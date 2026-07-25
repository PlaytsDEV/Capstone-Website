import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

export const APPLICATION_DRAFT_AUTOSAVE_DELAY_MS = 2000;
export const APPLICATION_DRAFT_STORAGE_PREFIX = "applicantApplicationDraft";

const DRAFT_LOCKED_STATUSES = [
  "pending_application_review",
  "approved_for_payment",
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
  "rejected",
  "cancelled",
  "archived",
];

const DRAFT_FIELD_PATHS = [
  "firstName",
  "lastName",
  "middleName",
  "nickname",
  "mobileNumber",
  "birthday",
  "gender",
  "maritalStatus",
  "nationality",
  "educationLevel",
  "address.unitHouseNo",
  "address.street",
  "address.region",
  "address.barangay",
  "address.city",
  "address.province",
  "selfiePhotoUrl",
  "validIDFrontUrl",
  "validIDBackUrl",
  "validIDType",
  "idType",
  "nbiClearanceUrl",
  "nbiReason",
  "companyIDUrl",
  "companyIDReason",
  "personalNotes",
  "emergencyContact.name",
  "emergencyContact.relationship",
  "emergencyContact.contactNumber",
  "healthConcerns",
  "employment.employerSchool",
  "employment.employerAddress",
  "employment.employerContact",
  "employment.startDate",
  "employment.occupation",
  "employment.previousEmployment",
  "preferredRoomNumber",
  "referralSource",
  "referrerName",
  "targetMoveInDate",
  "estimatedMoveInTime",
  "leaseDuration",
  "workSchedule",
  "workScheduleOther",
];

export const SUBSTANTIVE_DRAFT_FIELD_PATHS = [
  "middleName",
  "nickname",
  "birthday",
  "gender",
  "maritalStatus",
  "nationality",
  "educationLevel",
  "address.unitHouseNo",
  "address.street",
  "address.region",
  "address.barangay",
  "address.city",
  "address.province",
  "selfiePhotoUrl",
  "validIDFrontUrl",
  "validIDBackUrl",
  "validIDType",
  "idType",
  "nbiClearanceUrl",
  "nbiReason",
  "companyIDUrl",
  "companyIDReason",
  "personalNotes",
  "emergencyContact.name",
  "emergencyContact.relationship",
  "emergencyContact.contactNumber",
  "healthConcerns",
  "employment.employerSchool",
  "employment.employerAddress",
  "employment.employerContact",
  "employment.startDate",
  "employment.occupation",
  "employment.previousEmployment",
  "referralSource",
  "referrerName",
  "estimatedMoveInTime",
  "workSchedule",
  "workScheduleOther",
];

const getByPath = (source, path) =>
  path.split(".").reduce((current, key) => current?.[key], source);

const hasValue = (value) => {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

export const getApplicationDraftStorageKey = (uid, reservationId) =>
  reservationId
    ? `${APPLICATION_DRAFT_STORAGE_PREFIX}:${uid || "anonymous"}:${reservationId}`
    : "";

export const getSerializableUploadUrl = (value) =>
  typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";

export const hasRecoverableApplicationDraft = (reservation = {}) => {
  if (!reservation || typeof reservation !== "object") return false;
  if (reservation.applicationSubmittedAt) return false;
  return DRAFT_FIELD_PATHS.some((path) => hasValue(getByPath(reservation, path)));
};

export const hasSubstantiveApplicationDraft = (reservation = {}) => {
  if (!reservation || typeof reservation !== "object") return false;
  if (reservation.applicationSubmittedAt) return false;
  return SUBSTANTIVE_DRAFT_FIELD_PATHS.some((path) => hasValue(getByPath(reservation, path)));
};

export const canAutoSaveApplicationDraft = ({
  currentStage,
  reservationId,
  applicationAccessAllowed,
  stageLocked,
  applicationSubmitted,
  editingApplication,
  reservationStatus,
  paymentSubmitted,
  paymentApproved,
} = {}) => {
  if (Number(currentStage) !== 3) return false;
  if (!reservationId || !applicationAccessAllowed || stageLocked) return false;
  if (paymentSubmitted || paymentApproved) return false;

  const status = normalizeReservationStatus(reservationStatus);
  if (hasReservationStatus(status, DRAFT_LOCKED_STATUSES)) {
    return status === "needs_revision" && Boolean(editingApplication);
  }

  if (applicationSubmitted && !editingApplication) return false;
  return true;
};

export const getApplicationSaveStatusText = (saveStatus, lastSavedAt = null) => {
  if (saveStatus === "saving") return "Saving your progress...";
  if (saveStatus === "error") {
    return "We could not save your latest changes. Please check your connection.";
  }
  if (saveStatus === "saved") return "Progress saved.";
  if (!lastSavedAt) return "";

  const savedAt = lastSavedAt instanceof Date ? lastSavedAt : new Date(lastSavedAt);
  if (Number.isNaN(savedAt.getTime())) return "";
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 1000));
  if (elapsedSeconds < 60) return "Last saved: just now";
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  return `Last saved: ${elapsedMinutes} min ago`;
};
