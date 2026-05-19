/**
 * =============================================================================
 * useReservationFlow ΓÇö Custom Hook
 * =============================================================================
 *
 * Extracted from ReservationFlowPage.jsx.
 * Contains ALL state declarations, refs, effects, data loading, and
 * stage handlers for the 5-step reservation flow.
 *
 * The page component (ReservationFlowPage) calls this hook and renders
 * the JSX using the returned state and handlers.
 *
 * =============================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useAppNavigation } from "../../../shared/hooks/useAppNavigation";
import { showNotification } from "../../../shared/utils/notification";
import getFriendlyError from "../../../shared/utils/friendlyError";
import { reservationApi, roomApi, billingApi, authApi } from "../../../shared/api/apiClient";
import {
  canReservationAccessPayment,
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming";
import { usePaymentRedirect } from "./usePaymentRedirect";
import { uploadIfFile } from "../../../shared/utils/firebaseStorageUpload";
import {
  validateBirthday,
  validateEstimatedTime,
  validateTargetMoveInDate,
  validatePHPhoneLocal,
  validatePHPhoneOrLandline,
} from "../utils/reservationValidation";
import {
  PHYSICAL_VISIT_APPLICATION_LOCKED_MESSAGE,
  TENANT_APPLICATION_LOCKED_MESSAGE,
  canAccessTenantApplication,
  getReservationViewingPreference,
  isPhysicalVisitApplicationLocked,
  isTenantApplicationStageRequestBlocked,
} from "../utils/physicalVisitFlow";
import {
  ROOM_SELECTION_LOCKED_MESSAGE,
  isApplicantRoomSelectionLocked,
} from "../utils/reservationRoomLock";
import {
  VIEWING_PREFERENCE_LOCKED_MESSAGE,
  canChangeViewingPreference,
  getViewingPreferenceStepAccess,
} from "../utils/reservationViewingPreferenceLock";
import {
  DOCUMENT_PRECHECK_MESSAGES,
  getApplicantDocumentPrecheckMessage,
  getPrecheckStatus,
  hasBlockingPrecheck,
} from "../utils/documentPrecheckUtils";
import {
  APPLICATION_DRAFT_AUTOSAVE_DELAY_MS,
  canAutoSaveApplicationDraft,
  getApplicationDraftStorageKey,
  getApplicationSaveStatusText,
  getSerializableUploadUrl,
  hasRecoverableApplicationDraft,
} from "../utils/applicationDraftAutosave";

// Returns a sessionStorage key scoped to the Firebase UID when known,
// falling back to the legacy unscoped key for backward compatibility.
const getActiveResKey = (uid) =>
  uid ? `activeReservationId_${uid}` : "activeReservationId";
const PAYMENT_RETURN_PENDING_KEY = "activeReservationPaymentReturnPending";
const PAYMENT_SESSION_KEY = "activeReservationPaymongoSessionId";

const PAYMENT_RETURN_MIN_LOADING_MS = 150;
const PAYMENT_RETURN_POLL_INTERVAL_MS = 1000;
const PAYMENT_RETURN_MAX_WAIT_MS = 20000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getValidPaymentReturnSessionId = () => {
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  if (!sessionId || sessionId === "{id}" || !sessionId.startsWith("cs_")) {
    return null;
  }
  return sessionId;
};

const isReservationPaymentConfirmed = (reservation) => {
  const status = normalizeReservationStatus(reservation?.status);
  return hasReservationStatus(status, "reserved", "moveIn", "moveOut");
};

const EMPTY_DOCUMENT_PRECHECK = Object.freeze({
  precheckProvider: "ocr",
  precheckStatus: "not_checked",
  readabilityStatus: "unknown",
  documentTypeStatus: "unknown",
  canSubmit: true,
  requiresManualReview: true,
  applicantMessage: "",
  adminNote: "",
  confidence: null,
  flags: [],
  aiCheckStatus: "not_checked",
  aiCheckWarnings: [],
  aiCheckedAt: null,
  requiresAdminAttention: false,
  summaryMessage: "",
  provider: "ocr",
});

const DOCUMENT_PRECHECK_LABELS = Object.freeze({
  validIDFront: "Valid ID (Front)",
  validIDBack: "Valid ID (Back)",
  nbiClearance: "NBI Clearance",
  companyID: "Company ID",
});

const createEmptyDocumentPrechecks = () => ({
  validIDFront: { ...EMPTY_DOCUMENT_PRECHECK },
  validIDBack: { ...EMPTY_DOCUMENT_PRECHECK },
  nbiClearance: { ...EMPTY_DOCUMENT_PRECHECK },
  companyID: { ...EMPTY_DOCUMENT_PRECHECK },
});

const resolveDocumentPrecheckStatus = (entry = {}) => {
  return getPrecheckStatus(entry);
};

const normalizeDocumentPrecheckEntry = (entry) => ({
  ...EMPTY_DOCUMENT_PRECHECK,
  ...(entry || {}),
  precheckStatus: resolveDocumentPrecheckStatus(entry),
  readabilityStatus: entry?.readabilityStatus || EMPTY_DOCUMENT_PRECHECK.readabilityStatus,
  documentTypeStatus:
    entry?.documentTypeStatus || EMPTY_DOCUMENT_PRECHECK.documentTypeStatus,
  canSubmit: entry?.canSubmit !== false,
  flags: Array.isArray(entry?.flags) ? entry.flags.filter(Boolean) : [],
  aiCheckWarnings: Array.isArray(entry?.aiCheckWarnings)
    ? entry.aiCheckWarnings.filter(Boolean)
    : [],
});

const normalizeDocumentPrechecks = (prechecks = {}) => ({
  validIDFront: normalizeDocumentPrecheckEntry(prechecks.validIDFront),
  validIDBack: normalizeDocumentPrecheckEntry(prechecks.validIDBack),
  nbiClearance: normalizeDocumentPrecheckEntry(prechecks.nbiClearance),
  companyID: normalizeDocumentPrecheckEntry(prechecks.companyID),
});

const isBlockingDocumentPrecheck = (precheck = {}) => {
  return hasBlockingPrecheck(precheck);
};


const getDocumentPrecheckBlockMessage = (_label, precheck = {}) =>
  getApplicantDocumentPrecheckMessage(
    precheck,
    resolveDocumentPrecheckStatus(precheck),
  ) || DOCUMENT_PRECHECK_MESSAGES.failed;

const resolveTargetStage = (status, viewingPreference, applicationUnlockedByVisit) => {
  const map = {
    pending: 1,
    viewing_preference_selected:
      viewingPreference === "physical_visit" && !applicationUnlockedByVisit ? 2 : 3,
    visit_pending: applicationUnlockedByVisit ? 3 : 2,
    visit_approved: applicationUnlockedByVisit ? 3 : 2,
    pending_application_review: 3,
    needs_revision: 3,
    rejected: 3,
    approved_for_payment: 4,
    payment_pending: 4,
    reserved: 5,
    moveIn: 5,
  };
  return map[status] || 1;
};

const getProfileName = (profile) => {
  const displayParts = String(profile?.displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: profile?.firstName || displayParts[0] || "",
    lastName: profile?.lastName || displayParts.slice(1).join(" ") || "",
  };
};

const mergeReservationIntoQueryData = (currentData, updatedReservation) => {
  if (!updatedReservation?._id) return currentData;

  const patchList = (items) => {
    if (!Array.isArray(items)) return items;

    let changed = false;
    const nextItems = items.map((item) => {
      if (item?._id !== updatedReservation._id) return item;
      changed = true;
      return { ...item, ...updatedReservation };
    });

    return changed ? nextItems : items;
  };

  if (Array.isArray(currentData)) {
    return patchList(currentData);
  }

  if (Array.isArray(currentData?.reservations)) {
    const nextReservations = patchList(currentData.reservations);
    return nextReservations === currentData.reservations
      ? currentData
      : { ...currentData, reservations: nextReservations };
  }

  if (Array.isArray(currentData?.data)) {
    const nextData = patchList(currentData.data);
    return nextData === currentData.data
      ? currentData
      : { ...currentData, data: nextData };
  }

  if (currentData?._id === updatedReservation._id) {
    return { ...currentData, ...updatedReservation };
  }

  return currentData;

};

export default function useReservationFlow() {
  const navigate = useNavigate();
  const appNavigate = useAppNavigation();
  const location = useLocation();
  const { user } = useAuth();
  const profileName = getProfileName(user);
  const queryClient = useQueryClient();
  const stepFromState = Number(location.state?.step);
  const stepFromQuery = Number(
    new URLSearchParams(location.search).get("step"),
  );
  const forceEditMode = new URLSearchParams(location.search).get("edit") === "1";
  const stepOverride =
    Number.isInteger(stepFromState) && stepFromState > 0
      ? stepFromState
      : Number.isInteger(stepFromQuery) && stepFromQuery > 0
        ? stepFromQuery
        : null;
  const isStepMode = Boolean(stepOverride);

  // ΓöÇΓöÇ Core state ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const [reservationData, setReservationData] = useState(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [highestStageReached, setHighestStageReached] = useState(1);
  const [isLoading, setIsLoading] = useState(
    () =>
      new URLSearchParams(window.location.search).has("payment") ||
      sessionStorage.getItem(PAYMENT_RETURN_PENDING_KEY) === "1" ||
      Boolean(sessionStorage.getItem("activeReservationId")) ||
      // Also check user-scoped keys (set after login is known)
      Object.keys(sessionStorage).some((k) => k.startsWith("activeReservationId_"))
  );
  const [paymentReturnLoading, setPaymentReturnLoading] = useState(
    () =>
      new URLSearchParams(window.location.search).has("payment") ||
      sessionStorage.getItem(PAYMENT_RETURN_PENDING_KEY) === "1"
  );
  const [visitApproved, setVisitApproved] = useState(false);
  const [visitCompleted, setVisitCompleted] = useState(false);
  const [scheduleRejected, setScheduleRejected] = useState(false);
  const [scheduleRejectionReason, setScheduleRejectionReason] = useState("");
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [editingApplication, setEditingApplication] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [reservationId, setReservationId] = useState(null);
  const [_devBypassValidation, setDevBypassValidation] = useState(false);
  const devBypassValidation = import.meta.env.DEV ? _devBypassValidation : false;
  const [payingOnline, setPayingOnline] = useState(false);
  const [successOverlay, setSuccessOverlay] = useState({
    show: false,
    title: "",
    subtitle: "",
  });

  // Stage 1
  const [targetMoveInDate, setTargetMoveInDate] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("");
  const [billingEmail, setBillingEmail] = useState(user?.email || "");

  // Stage 2
  const [viewingType, setViewingType] = useState("");
  const [remoteViewingAcknowledged, setRemoteViewingAcknowledged] = useState(false);
  const [remoteViewingQuestions, setRemoteViewingQuestions] = useState("");
  const [isUrgentMoveIn, setIsUrgentMoveIn] = useState(false);
  const [applicationReviewReason, setApplicationReviewReason] = useState("");
  const [isOutOfTown, setIsOutOfTown] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("");
  const [visitorName, setVisitorName] = useState(user?.displayName || "");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorEmail, setVisitorEmail] = useState(user?.email || "");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

  // Stage 3: Photo
  const [selfiePhoto, setSelfiePhoto] = useState(null);

  // Stage 3: Personal
  const [firstName, setFirstName] = useState(profileName.firstName);
  const [lastName, setLastName] = useState(profileName.lastName);
  const [middleName, setMiddleName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [nationality, setNationality] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [addressUnitHouseNo, setAddressUnitHouseNo] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [addressBarangay, setAddressBarangay] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [validIDFront, setValidIDFront] = useState(null);
  const [validIDBack, setValidIDBack] = useState(null);
  const [validIDType, setValidIDType] = useState("");
  const [idValidationResult, setIdValidationResult] = useState(null);
  const [isValidatingId, setIsValidatingId] = useState(false);
  const [documentPrechecks, setDocumentPrechecks] = useState(
    createEmptyDocumentPrechecks,
  );
  const [runningDocumentChecks, setRunningDocumentChecks] = useState({});
  const [nbiClearance, setNbiClearance] = useState(null);
  const [nbiReason, setNbiReason] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");

  // Stage 3: Emergency
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyContactNumber, setEmergencyContactNumber] = useState("");
  const [healthConcerns, setHealthConcerns] = useState("");

  // Stage 3: Employment
  const [employerSchool, setEmployerSchool] = useState("");
  const [employerAddress, setEmployerAddress] = useState("");
  const [employerContact, setEmployerContact] = useState("");
  const [startDate, setStartDate] = useState("");
  const [occupation, setOccupation] = useState("");
  const [companyID, setCompanyID] = useState(null);
  const [companyIDReason, setCompanyIDReason] = useState("");
  const [previousEmployment, setPreviousEmployment] = useState("");

  // Stage 3: Dorm
  const [roomType, setRoomType] = useState("quadruple");
  const [preferredRoomNumber, setPreferredRoomNumber] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [estimatedMoveInTime, setEstimatedMoveInTime] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [workScheduleOther, setWorkScheduleOther] = useState("");

  // Stage 3: Agreements
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToCertification, setAgreedToCertification] = useState(false);

  // Stage 4: Payment ΓÇö tenant must acknowledge the non-refundable fee policy
  const [agreedToFeePolicy, setAgreedToFeePolicy] = useState(false);
  const [finalMoveInDate, setFinalMoveInDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  // Stage 5
  const [reservationCode, setReservationCode] = useState("");
  const [visitCode, setVisitCode] = useState("");

  // UI state
  const [showLoginConfirm, setShowLoginConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showStageConfirm, setShowStageConfirm] = useState(false);
  const [pendingStageAction, setPendingStageAction] = useState(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [scrollToSection, setScrollToSection] = useState(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [initialFormState, setInitialFormState] = useState({
    targetMoveInDate: "",
    leaseDuration: "",
    billingEmail: "",
  });

  // ΓöÇΓöÇ Capture payment redirect flag + status at render time (before effects clear URL) ΓöÇΓöÇ
  const paymentReturnStatusRef = useRef(
    new URLSearchParams(window.location.search).get("payment")
  );
  const paymentReturnSessionIdRef = useRef(getValidPaymentReturnSessionId());
  const isPaymentReturnRef = useRef(Boolean(paymentReturnStatusRef.current));

  // ΓöÇΓöÇ Payment redirect hook (must be after all useState) ΓöÇΓöÇΓöÇΓöÇ
  const { searchParams, setSearchParams } = usePaymentRedirect({
    user,
    showNotification,
    navigate,
    setPaymentSubmitted,
    setPaymentApproved,
    setPaymentMethod,
    setCurrentStage,
    setHighestStageReached,
  });
  const [saveStatus, setSaveStatus] = useState("");
  const [lastApplicationDraftSavedAt, setLastApplicationDraftSavedAt] = useState(null);
  const [hasUnsavedApplicationChanges, setHasUnsavedApplicationChanges] =
    useState(false);
  const [draftRecoveryMessage, setDraftRecoveryMessage] = useState("");
  const autoSaveTimerRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const navigatingAwayRef = useRef(false);
  const applicationDraftSaveClearTimerRef = useRef(null);
  const lastSavedApplicationDraftRef = useRef("");
  const draftRecoveryShownRef = useRef(false);

  useEffect(() => {
    if (!profileName.firstName && !profileName.lastName) return;
    if (!firstName && profileName.firstName) setFirstName(profileName.firstName);
    if (!lastName && profileName.lastName) setLastName(profileName.lastName);
  }, [
    user?.firstName,
    user?.lastName,
    user?.displayName,
    firstName,
    lastName,
    profileName.firstName,
    profileName.lastName,
  ]);

  const visitGateReservation = useMemo(() => {
    const merged = {
      ...(reservationData || {}),
      viewingPreference:
        reservationData?.viewingPreference ||
        viewingType,
      viewingType:
        reservationData?.viewingType ||
        viewingType,
      visitDate:
        reservationData?.visitDate ||
        visitDate,
      visitTime:
        reservationData?.visitTime ||
        visitTime,
      visitStatus: reservationData?.visitStatus || "",
      status: normalizeReservationStatus(reservationData?.status),
      scheduleRejected:
        reservationData?.scheduleRejected ?? scheduleRejected,
    };
    return {
      ...merged,
      viewingPreference:
        getReservationViewingPreference(merged) ||
        merged.viewingPreference ||
        merged.viewingType ||
        "",
    };
  }, [reservationData, viewingType, visitDate, visitTime, scheduleRejected]);

  const physicalVisitApplicationLocked = useMemo(
    () => isPhysicalVisitApplicationLocked(visitGateReservation),
    [visitGateReservation],
  );
  const applicationAccessAllowed = useMemo(
    () => canAccessTenantApplication(visitGateReservation),
    [visitGateReservation],
  );
  const roomSelectionLocked = useMemo(
    () => isApplicantRoomSelectionLocked(reservationData),
    [reservationData],
  );
  const viewingPreferenceStepAccess = useMemo(
    () => getViewingPreferenceStepAccess(reservationData, viewingType),
    [reservationData, viewingType],
  );

  const validateViewingPreferenceChange = useCallback(async () => {
    const targetReservationId =
      reservationId || reservationData?._id || reservationData?.id;
    if (!targetReservationId) return true;

    try {
      const latestResponse = await reservationApi.getById(targetReservationId);
      const latestReservation = latestResponse?.reservation || latestResponse;

      if (latestReservation?._id) {
        setReservationData((previous) => ({
          ...(previous || {}),
          ...latestReservation,
          room: latestReservation.roomId || latestReservation.room || previous?.room,
        }));
      }

      if (!canChangeViewingPreference(latestReservation || reservationData)) {
        showNotification(
          "Your viewing preference can no longer be changed because your reservation is already being processed.",
          "info",
          5000,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to verify viewing preference change access:", error);
      showNotification(
        "We could not verify whether your viewing preference can be changed. Please try again.",
        "error",
        5000,
      );
      return false;
    }
  }, [reservationData, reservationId]);

  const returnToDashboardForApplicationGate = useCallback(() => {
    const message = physicalVisitApplicationLocked
      ? PHYSICAL_VISIT_APPLICATION_LOCKED_MESSAGE
      : TENANT_APPLICATION_LOCKED_MESSAGE;
    showNotification(message, "info", 5000);
    appNavigate("/applicant/profile", {
      state: { tab: "dashboard" },
      flash: {
        type: "info",
        message,
      },
    });
  }, [appNavigate, physicalVisitApplicationLocked]);

  const notifyRoomSelectionLocked = useCallback(() => {
    showNotification(ROOM_SELECTION_LOCKED_MESSAGE, "info", 5000);
  }, []);
  const notifyViewingPreferenceLocked = useCallback(() => {
    showNotification(VIEWING_PREFERENCE_LOCKED_MESSAGE, "info", 5000);
  }, []);

  useEffect(() => {
    if (
      (reservationId || reservationData?._id) &&
      currentStage === 3 &&
      !applicationAccessAllowed
    ) {
      returnToDashboardForApplicationGate();
    }
  }, [
    applicationAccessAllowed,
    currentStage,
    reservationData?._id,
    reservationId,
    returnToDashboardForApplicationGate,
  ]);

  // ΓöÇΓöÇ Warn before leaving mid-flow (skip if intentional navigation) ΓöÇΓöÇ
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (navigatingAwayRef.current) return;
      if (
        isFormDirty ||
        hasUnsavedApplicationChanges ||
        saveStatus === "saving" ||
        saveStatus === "error" ||
        currentStage > 1
      ) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentStage, hasUnsavedApplicationChanges, isFormDirty, saveStatus]);

  // ΓöÇΓöÇ Stepper locking ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const isStageLocked = (stageId) => {
    const reservationStatus = normalizeReservationStatus(reservationData?.status);
    const needsRevision = hasReservationStatus(reservationStatus, "needs_revision");
    const applicationAccess = canAccessTenantApplication({
      ...reservationData,
      viewingPreference:
        reservationData?.viewingPreference || getReservationViewingPreference({
          ...reservationData,
          viewingPreference: viewingType,
          viewingType,
          visitDate,
          visitTime,
        }),
      viewingType,
      visitDate,
      visitTime,
      visitStatus: reservationData?.visitStatus,
      status: reservationStatus,
    });
    if (paymentApproved) return stageId < 5;
    if (stageId === 1) return roomSelectionLocked || visitCompleted;
    if (stageId === 2)
      return (
        viewingPreferenceStepAccess.readOnly ||
        (applicationSubmitted && !needsRevision && !scheduleRejected)
      );
    if (stageId === 3) {
      return (
        !applicationAccess ||
        (applicationSubmitted && !editingApplication && !needsRevision)
      );
    }
    if (stageId === 4) return paymentSubmitted || paymentApproved;
    return false;
  };

  const isStageClickable = (stageId) => {
    const reservationStatus = normalizeReservationStatus(reservationData?.status);
    const paymentUnlocked = canReservationAccessPayment(reservationStatus);
    if (stageId === 1) return highestStageReached >= 2;
    if (stageId <= highestStageReached) return true;
    if (stageId === 4 && (paymentUnlocked || paymentSubmitted || paymentApproved)) return true;
    if (stageId === 5 && paymentSubmitted) return true;
    return false;
  };

  const handleStepperClick = (stageId) => {
    if (!isStageClickable(stageId)) return;
    if (stageId === 1 && roomSelectionLocked) {
      setCurrentStage(1);
      notifyRoomSelectionLocked();
      return;
    }
    if (stageId === 2 && viewingPreferenceStepAccess.readOnly) {
      setCurrentStage(2);
      notifyViewingPreferenceLocked();
      return;
    }
    if (stageId === 3 && !applicationAccessAllowed) {
      returnToDashboardForApplicationGate();
      return;
    }
    if (isStageLocked(stageId)) return;
    if (stageId === 1 && reservationId) {
      navigate(
        `/applicant/check-availability?changeRoom=1&reservationId=${reservationId}`,
      );
      return;
    }
    setCurrentStage(stageId);
  };

  // ΓöÇΓöÇ Helpers to populate state from a reservation object ΓöÇΓöÇΓöÇΓöÇ
  const populateFromReservation = (r) => {
    if (r.firstName) setFirstName(r.firstName);
    if (r.lastName) setLastName(r.lastName);
    if (r.middleName) setMiddleName(r.middleName);
    if (r.nickname) setNickname(r.nickname);
    if (r.mobileNumber) setMobileNumber(r.mobileNumber);
    if (r.birthday) {
      const b = new Date(r.birthday);
      if (!isNaN(b)) setBirthday(b.toISOString().split("T")[0]);
    }
    if (r.gender) setGender(r.gender);
    if (r.maritalStatus) setMaritalStatus(r.maritalStatus);
    if (r.nationality) setNationality(r.nationality);
    if (r.educationLevel) setEducationLevel(r.educationLevel);
    if (r.address) {
      setAddressUnitHouseNo(r.address.unitHouseNo || "");
      setAddressStreet(r.address.street || "");
      setAddressRegion(r.address.region || "");
      setAddressBarangay(r.address.barangay || "");
      setAddressCity(r.address.city || "");
      setAddressProvince(r.address.province || "");
    }
    if (r.emergencyContact?.name)
      setEmergencyContactName(r.emergencyContact.name);
    if (r.emergencyContact?.relationship)
      setEmergencyRelationship(r.emergencyContact.relationship);
    if (r.emergencyContact?.contactNumber)
      setEmergencyContactNumber(r.emergencyContact.contactNumber);
    if (r.healthConcerns) setHealthConcerns(r.healthConcerns);
    if (r.employment?.employerSchool)
      setEmployerSchool(r.employment.employerSchool);
    if (r.employment?.employerAddress)
      setEmployerAddress(r.employment.employerAddress);
    if (r.employment?.employerContact)
      setEmployerContact(r.employment.employerContact);
    if (r.employment?.startDate) {
      const sd = new Date(r.employment.startDate);
      if (!isNaN(sd)) setStartDate(sd.toISOString().split("T")[0]);
    }
    if (r.employment?.occupation) setOccupation(r.employment.occupation);
    if (r.employment?.previousEmployment)
      setPreviousEmployment(r.employment.previousEmployment);
    if (r.preferredRoomType) setRoomType(r.preferredRoomType);
    if (r.preferredRoomNumber) setPreferredRoomNumber(r.preferredRoomNumber);
    if (r.referralSource) setReferralSource(r.referralSource);
    if (r.referrerName) setReferrerName(r.referrerName);
    if (r.estimatedMoveInTime) setEstimatedMoveInTime(r.estimatedMoveInTime);
    if (r.workSchedule) setWorkSchedule(r.workSchedule);
    if (r.workScheduleOther) setWorkScheduleOther(r.workScheduleOther);
    if (r.targetMoveInDate)
      setTargetMoveInDate(
        r.targetMoveInDate.split?.("T")?.[0] || r.targetMoveInDate,
      );
    if (r.leaseDuration) setLeaseDuration(String(r.leaseDuration));
    // Restore agreements ONLY if the application was previously submitted
    // (prevents step 2's agreedToPrivacy from pre-checking step 3's consent)
    const hasApplication = Boolean(r.firstName && r.lastName && r.mobileNumber);
    if (hasApplication && r.agreedToPrivacy) setAgreedToPrivacy(true);
    if (hasApplication && r.agreedToCertification) setAgreedToCertification(true);
    // File URLs
    if (r.selfiePhotoUrl) setSelfiePhoto(r.selfiePhotoUrl);
    if (r.validIDFrontUrl) setValidIDFront(r.validIDFrontUrl);
    if (r.validIDBackUrl) setValidIDBack(r.validIDBackUrl);
    if (r.nbiClearanceUrl) setNbiClearance(r.nbiClearanceUrl);
    if (r.nbiReason) setNbiReason(r.nbiReason);
    if (r.companyIDUrl) setCompanyID(r.companyIDUrl);
    if (r.companyIDReason) setCompanyIDReason(r.companyIDReason);
    if (r.personalNotes) setPersonalNotes(r.personalNotes);
    if (r.idType || r.validIDType) setValidIDType(r.idType || r.validIDType);
    if (r.idValidationStatus && r.idValidationStatus !== "not_validated") {
      setIdValidationResult({
        validationStatus: r.idValidationStatus,
        message:
          r.idValidationStatus === "passed"
            ? "ID verified successfully."
            : r.idValidationStatus === "failed"
              ? "ID image is unclear. Please upload a clearer photo."
              : r.idValidationStatus === "manual_review"
                ? "ID uploaded. It will be manually reviewed by admin."
                : "Name mismatch detected. Please review your information or upload a clearer ID.",
        extractedName: r.idExtractedName || "",
        extractedIdNumber: r.idExtractedNumber || "",
        // Force null for manual_review so historical DB rows with stored 0 don't
        // display a misleading "0%" score in the UI.
        matchScore: r.idValidationStatus === "manual_review" ? null : (r.idNameMatchScore ?? null),
        notes: r.idValidationNotes || [],
      });
    }
    setDocumentPrechecks(
      r.documentPrechecks
        ? normalizeDocumentPrechecks(r.documentPrechecks)
        : createEmptyDocumentPrechecks(),
    );
    // NOTE: agreedToPrivacy / agreedToCertification are NOT restored
    // from saved data ΓÇö consent must be re-affirmed each session.
  };

  // ΓöÇΓöÇ Pre-fill empty fields from user profile (for new reservations) ΓöÇΓöÇ
  const applyApplicationDraftPayload = (payload = {}, meta = {}) => {
    const hasPayloadField = (key) =>
      Object.prototype.hasOwnProperty.call(payload, key);
    const setStringField = (key, setter) => {
      if (hasPayloadField(key)) setter(payload[key] || "");
    };

    setStringField("firstName", setFirstName);
    setStringField("lastName", setLastName);
    setStringField("middleName", setMiddleName);
    setStringField("nickname", setNickname);
    setStringField("mobileNumber", setMobileNumber);
    setStringField("birthday", setBirthday);
    setStringField("gender", setGender);
    setStringField("maritalStatus", setMaritalStatus);
    setStringField("nationality", setNationality);
    setStringField("educationLevel", setEducationLevel);
    setStringField("addressUnitHouseNo", setAddressUnitHouseNo);
    setStringField("addressStreet", setAddressStreet);
    setStringField("addressRegion", setAddressRegion);
    setStringField("addressBarangay", setAddressBarangay);
    setStringField("addressCity", setAddressCity);
    setStringField("addressProvince", setAddressProvince);
    setStringField("emergencyContactName", setEmergencyContactName);
    setStringField("emergencyRelationship", setEmergencyRelationship);
    setStringField("emergencyContactNumber", setEmergencyContactNumber);
    setStringField("healthConcerns", setHealthConcerns);
    setStringField("employerSchool", setEmployerSchool);
    setStringField("employerAddress", setEmployerAddress);
    setStringField("employerContact", setEmployerContact);
    setStringField("startDate", setStartDate);
    setStringField("occupation", setOccupation);
    setStringField("previousEmployment", setPreviousEmployment);
    setStringField("preferredRoomNumber", setPreferredRoomNumber);
    setStringField("referralSource", setReferralSource);
    setStringField("referrerName", setReferrerName);
    setStringField("estimatedMoveInTime", setEstimatedMoveInTime);
    setStringField("workSchedule", setWorkSchedule);
    setStringField("workScheduleOther", setWorkScheduleOther);
    setStringField("targetMoveInDate", setTargetMoveInDate);
    setStringField("finalMoveInDate", setFinalMoveInDate);
    setStringField("nbiReason", setNbiReason);
    setStringField("companyIDReason", setCompanyIDReason);
    setStringField("personalNotes", setPersonalNotes);

    if (hasPayloadField("leaseDuration")) {
      setLeaseDuration(payload.leaseDuration ? String(payload.leaseDuration) : "");
    }
    if (hasPayloadField("validIDType") || hasPayloadField("idType")) {
      setValidIDType(payload.validIDType || payload.idType || "");
    }
    if (hasPayloadField("selfiePhotoUrl")) setSelfiePhoto(payload.selfiePhotoUrl || null);
    if (hasPayloadField("validIDFrontUrl")) setValidIDFront(payload.validIDFrontUrl || null);
    if (hasPayloadField("validIDBackUrl")) setValidIDBack(payload.validIDBackUrl || null);
    if (hasPayloadField("nbiClearanceUrl")) setNbiClearance(payload.nbiClearanceUrl || null);
    if (hasPayloadField("companyIDUrl")) setCompanyID(payload.companyIDUrl || null);

    if (meta.documentPrechecks) {
      setDocumentPrechecks(normalizeDocumentPrechecks(meta.documentPrechecks));
    }
    if (meta.idValidationResult) {
      setIdValidationResult(meta.idValidationResult);
    }
  };

  const markApplicationDraftRestored = (savedAt = null) => {
    if (draftRecoveryShownRef.current) return;
    draftRecoveryShownRef.current = true;
    setDraftRecoveryMessage("Your saved progress has been restored.");
    setLastApplicationDraftSavedAt(savedAt || new Date().toISOString());
    showNotification("Your saved progress has been restored.", "success", 3000);
  };

  const restoreLocalApplicationDraftIfNeeded = (reservation = {}) => {
    if (typeof window === "undefined" || !window.localStorage) return false;

    const targetReservationId =
      reservation?._id || reservation?.id || reservationId || "";
    const key = getApplicationDraftStorageKey(user?.firebaseUid, targetReservationId);
    if (!key || hasRecoverableApplicationDraft(reservation)) return false;
    if (reservation?.applicationSubmittedAt) return false;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (!draft?.payload) return false;
      if (draft.userId && draft.userId !== user?.firebaseUid) return false;
      if (draft.reservationId && draft.reservationId !== targetReservationId) return false;

      applyApplicationDraftPayload(draft.payload, draft);
      lastSavedApplicationDraftRef.current = JSON.stringify({
        payload: draft.payload,
        documentPrechecks: draft.documentPrechecks || null,
        idValidationResult: draft.idValidationResult || null,
      });
      setHasUnsavedApplicationChanges(false);
      markApplicationDraftRestored(draft.savedAt);
      return true;
    } catch (error) {
      console.warn("Could not restore local application draft:", error);
      return false;
    }
  };

  const markBackendApplicationDraftRestored = (reservation = {}) => {
    if (!hasRecoverableApplicationDraft(reservation)) return;
    markApplicationDraftRestored(reservation.updatedAt || reservation.createdAt);
  };

  const prefillFromProfile = async () => {
    try {
      const profile = await authApi.getCurrentUser();
      if (!profile) return;
      const profileName = getProfileName(profile);
      // Only fill fields that are still empty
      if (!firstName && profileName.firstName) setFirstName(profileName.firstName);
      if (!lastName && profileName.lastName) setLastName(profileName.lastName);
      if (!mobileNumber && profile.phone) setMobileNumber(profile.phone);
      if (!birthday && profile.dateOfBirth) {
        const b = new Date(profile.dateOfBirth);
        if (!isNaN(b)) setBirthday(b.toISOString().split("T")[0]);
      }
      if (!gender && profile.gender) setGender(profile.gender);
      if (!addressCity && profile.city) setAddressCity(profile.city);
      if (!addressStreet && profile.address) setAddressStreet(profile.address);
      if (!emergencyContactName && profile.emergencyContact)
        setEmergencyContactName(profile.emergencyContact);
      if (!emergencyContactNumber && profile.emergencyPhone)
        setEmergencyContactNumber(profile.emergencyPhone);
    } catch {
      // Non-critical ΓÇö silently skip if profile fetch fails
    }
  };

  const computeLockingFlags = (r) => {
    const status = normalizeReservationStatus(r.status);
    const viewingPreference = getReservationViewingPreference(r);
    const applicationAccess = canAccessTenantApplication({
      ...r,
      status,
      viewingPreference,
    });
    // Status-driven flags (primary) with data-presence fallback (backward compat)
    const VIEWING_SELECTED_STATUSES = [
      "viewing_preference_selected",
      "visit_pending",
      "visit_approved",
      "pending_application_review",
      "needs_revision",
      "approved_for_payment",
      "payment_pending",
      "reserved",
      "moveIn",
    ];
    const APPLICATION_STATUSES = [
      "pending_application_review",
      "needs_revision",
      "approved_for_payment",
      "payment_pending",
      "reserved",
      "moveIn",
    ];

    const hasViewingPreference =
      VIEWING_SELECTED_STATUSES.includes(status) ||
      Boolean(viewingPreference || r.visitDate);
    const isVisitApprovedFlag =
      Boolean(r.visitApproved === true) ||
      applicationAccess;
    const hasApplication =
      APPLICATION_STATUSES.includes(status) || Boolean(r.applicationSubmittedAt);
    const paymentUnlocked = canReservationAccessPayment(status);
    const hasPayment =
      status === "payment_pending" ||
      status === "reserved" ||
      status === "moveIn" ||
      Boolean(r.proofOfPaymentUrl);
    const isConfirmed = hasReservationStatus(status, "reserved", "moveIn", "moveOut");

    if (hasViewingPreference) setVisitCompleted(applicationAccess);
    if (isVisitApprovedFlag) setVisitApproved(true);
    if (r.scheduleRejected) setScheduleRejected(true);
    if (r.scheduleRejectionReason) setScheduleRejectionReason(r.scheduleRejectionReason);
    if (hasApplication) setApplicationSubmitted(true);
    if (hasPayment) setPaymentSubmitted(true);
    if (isConfirmed) setPaymentApproved(true);
    if (r.applicationReviewReason) setApplicationReviewReason(r.applicationReviewReason);

    // Status-driven highest stage
    let highest = resolveTargetStage(status, viewingPreference, applicationAccess);
    // Fallback: data-presence checks for legacy records still at "pending"
    if (highest === 1) {
      if (hasViewingPreference) highest = 2;
      if (hasViewingPreference && applicationAccess) highest = 3;
      if (isVisitApprovedFlag) highest = Math.max(highest, 3);
      if (hasApplication) highest = Math.max(highest, 3);
      if (paymentUnlocked) highest = Math.max(highest, 4);
      if (hasPayment) highest = Math.max(highest, 4);
      if (isConfirmed) highest = 5;
    }

    return {
      hasVisitScheduled: hasViewingPreference,
      isVisitApprovedFlag,
      hasApplication,
      hasPayment,
      isConfirmed,
      applicationUnlockedByVisit: applicationAccess,
      highest,
    };
  };

  // ΓöÇΓöÇ Data loading ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const processedKeyRef = useRef(null);
  const paymentVerifyingRef = useRef(false);
  const justPaidRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setShowLoginConfirm(true);
      return;
    }

    // Skip re-initialization if payment verification is in progress
    // (the hook's setSearchParams changes location.key, re-triggering this effect)
    if (paymentVerifyingRef.current) {
      return;
    }

    // Guard: only process each navigation once (prevents re-render loop
    // from setState calls below re-triggering this effect).
    // Uses location.key so re-navigation to the same route still re-initializes.
    if (processedKeyRef.current === location.key) return;
    processedKeyRef.current = location.key;

    const continueReservation = location.state?.continueFlow;
    const editMode = location.state?.editMode;
    const resId = location.state?.reservationId;

    // ΓöÇΓöÇ ALWAYS reset session-specific fields first ΓöÇΓöÇ
    // For new reservations, these stay blank.
    // For continuing, the async load functions below will repopulate from DB.
    setTargetMoveInDate("");
    setFinalMoveInDate("");
    setLeaseDuration("");
    setAgreedToPrivacy(false);
    setAgreedToCertification(false);

    const shouldVerifyPaymentReturn =
      isPaymentReturnRef.current ||
      sessionStorage.getItem(PAYMENT_RETURN_PENDING_KEY) === "1";

    if ((continueReservation || editMode) && resId) {
      if (shouldVerifyPaymentReturn) {
        paymentVerifyingRef.current = true;
        setPaymentReturnLoading(true);
        isPaymentReturnRef.current = false;
      }
      loadExistingReservation(resId, shouldVerifyPaymentReturn);
    } else {
      const state = location.state?.roomData;
      // Check if this is a PayMongo return ΓÇö defer stage logic to usePaymentRedirect
      const paymentParam = new URLSearchParams(window.location.search).get("payment");
      if (state) {
        setReservationData(state);
        prefillFromProfile(); // Pre-fill Step 3 from profile for new reservations
      } else if (shouldVerifyPaymentReturn) {
        // Returning from PayMongo ΓÇö load reservation data for display,
        // and verify payment using the reservation's stored session ID.
        paymentVerifyingRef.current = true; // block re-init from hook's setSearchParams
        setPaymentReturnLoading(true);
        isPaymentReturnRef.current = false; // consume the flag
        const storedResId =
          sessionStorage.getItem(getActiveResKey(user?.firebaseUid)) ||
          sessionStorage.getItem("activeReservationId"); // legacy fallback
        if (storedResId) {
          loadExistingReservation(storedResId, true);
        } else {
          loadActiveReservation(true);
        }
      } else {
        const stored = sessionStorage.getItem("pendingReservation");
        const storedResId =
          sessionStorage.getItem(getActiveResKey(user?.firebaseUid)) ||
          sessionStorage.getItem("activeReservationId"); // legacy fallback
        if (stored) {
          setReservationData(JSON.parse(stored));
        } else if (storedResId) {
          loadExistingReservation(storedResId);
        } else if (isStepMode) {
          loadActiveReservation();
        } else {
          appNavigate("/applicant/check-availability", {
            flash: { type: "warning", message: "No room selected. Redirecting..." },
          });
        }
      }
    }
    setInitialFormState({
      targetMoveInDate: "",
      leaseDuration: "",
      billingEmail: user?.email || "",
    });
    if (!continueReservation && stepOverride && stepOverride !== 3) {
      setCurrentStage(stepOverride);
    }

    // Payment redirect is handled by usePaymentRedirect hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.key]);

  const loadActiveReservation = async (verifyPaymentReturn = false) => {
    try {
      const all = await reservationApi.getAll();
      const list = Array.isArray(all)
        ? all
        : all?.reservations || all?.data || [];
      const found = list.find(
        (r) =>
          r.status !== "cancelled" &&
          r.status !== "archived" &&
          r.status !== "rejected" &&
          !r.isArchived,
      );
      if (!found) {
        appNavigate("/applicant/check-availability", {
          flash: { type: "warning", message: "No active reservation found." },
        });
        return;
      }
      if (verifyPaymentReturn) {
        await loadExistingReservation(found._id, true);
        return;
      }
      const active = await reservationApi.getById(found._id);
      if (active) {
        const room = active.roomId || {};
        setReservationId(active._id);
        if (active.reservationCode) setReservationCode(active.reservationCode);
        if (active.visitCode) setVisitCode(active.visitCode);
        setReservationData({
          _id: active._id,
          status: active.status,
          reservationCode: active.reservationCode || "",
          paymentStatus: active.paymentStatus || "",
          paymentMethod: active.paymentMethod || "",
          paymentDate: active.paymentDate || null,
          proofOfPaymentUrl: active.proofOfPaymentUrl || "",
          paymongoPaymentId: active.paymongoPaymentId || "",
          paymongoSessionId: active.paymongoSessionId || "",
          receiptSentAt: active.receiptSentAt || null,
          reservedAt: active.reservedAt || null,
          reservationFeeAmount: active.reservationFeeAmount || 2000,
          room: {
            id: room._id || room.id,
            roomId: room._id || room.id,
            name: room.name || "Room",
            title: room.name || "Room",
            branch: room.branch || "",
            type: room.type || "",
            price: room.monthlyRate || room.price || 0,
            roomNumber: room.name || "",
            floor: room.floor || "",
            images: room.images || [],
            capacity: room.capacity || 0,
            currentOccupancy: room.currentOccupancy || 0,
            description: room.description || "",
          },
          viewingPreference: active.viewingPreference || active.viewingType || "",
          viewingType: active.viewingType || active.viewingPreference || "",
          visitDate: active.visitDate || "",
          visitTime: active.visitTime || "",
          visitStatus: active.visitStatus || "",
          visitApproved: Boolean(active.visitApproved),
          scheduleApproved: Boolean(active.scheduleApproved),
          scheduleRejected: Boolean(active.scheduleRejected),
          roomConfirmed: Boolean(active.roomConfirmed),
          visitCode: active.visitCode || "",
          remoteViewingAcknowledged: Boolean(active.remoteViewingAcknowledged),
          remoteViewingQuestions: active.remoteViewingQuestions || "",
          isUrgentMoveIn: Boolean(active.isUrgentMoveIn),
          selectedBed: active.selectedBed || null,
          selectedAppliances: active.selectedAppliances || [],
          applianceFees: active.applianceFees || 0,
          applicationReviewReason: active.applicationReviewReason || "",
        });
        if (active.visitDate) setVisitDate(active.visitDate.split("T")[0]);
        if (active.visitTime) setVisitTime(active.visitTime);
        if (active.viewingPreference || active.viewingType) {
          setViewingType(active.viewingPreference || active.viewingType);
        }
        setRemoteViewingAcknowledged(Boolean(active.remoteViewingAcknowledged));
        setRemoteViewingQuestions(active.remoteViewingQuestions || "");
        setIsUrgentMoveIn(Boolean(active.isUrgentMoveIn));
        if (active.visitApproved) setVisitApproved(true);
        populateFromReservation(active);
        if (!restoreLocalApplicationDraftIfNeeded(active)) {
          markBackendApplicationDraftRestored(active);
        }
        const { highest } = computeLockingFlags(active);
        if (active.paymentMethod) setPaymentMethod(active.paymentMethod);
        if (
          active.proofOfPaymentUrl ||
          active.paymentDate ||
          active.paymongoPaymentId ||
          active.paymentStatus === "paid" ||
          active.paymentStatus === "partial"
        )
          setPaymentSubmitted(true);
        if (active.paymentStatus === "paid") setPaymentApproved(true);
        setHighestStageReached(highest);
        const activeApplicationStageBlocked =
          isTenantApplicationStageRequestBlocked(stepOverride, {
            ...active,
            viewingPreference: getReservationViewingPreference(active),
          });
        if (activeApplicationStageBlocked) {
          setCurrentStage(2);
          showNotification(TENANT_APPLICATION_LOCKED_MESSAGE, "info", 5000);
        } else if (stepOverride && stepOverride <= highest) {
          setCurrentStage(stepOverride);
        }
      }
    } catch (err) {
      console.error("Failed to load reservation:", err);
      appNavigate("/applicant/check-availability", {
        flash: { type: "warning", message: "No room selected. Redirecting..." },
      });
    }
  };

  const waitForDepositPaymentValidation = async (resId, sessionId) => {
    const startedAt = Date.now();
    let lastResult = null;

    if (!sessionId) {
      return { result: null, reservation: null };
    }

    while (Date.now() - startedAt < PAYMENT_RETURN_MAX_WAIT_MS) {
      try {
        lastResult = await billingApi.checkPaymentStatus(sessionId);
        if (lastResult?.requiresReview) {
          return {
            result: {
              ...lastResult,
              status: lastResult.status || "requires_review",
              requiresReview: true,
            },
            reservation: lastResult.reservation || null,
          };
        }
        if (lastResult?.status === "paid") {
          let confirmedReservation = lastResult.reservation || null;
          try {
            confirmedReservation = await reservationApi.getById(resId);
          } catch {
            // The payment is confirmed; profile/dashboard refresh can catch up.
          }
          return {
            result: lastResult,
            reservation: confirmedReservation,
          };
        }
      } catch (error) {
        console.warn("[PAYMENT] Session validation attempt failed:", error);
      }

      await wait(PAYMENT_RETURN_POLL_INTERVAL_MS);
    }

    return { result: lastResult, reservation: null };
  };

  const loadExistingReservation = async (resId, skipStageSet = false) => {
    try {
      setIsLoading(true);
      const reservation = await reservationApi.getById(resId);
      setReservationId(reservation._id || resId);
      if (reservation.reservationCode)
        setReservationCode(reservation.reservationCode);
      if (reservation.visitCode)
        setVisitCode(reservation.visitCode);
      setReservationData({
        _id: reservation._id || resId,
        status: reservation.status,
        reservationCode: reservation.reservationCode || "",
        paymentStatus: reservation.paymentStatus || "",
        paymentMethod: reservation.paymentMethod || "",
        paymentDate: reservation.paymentDate || null,
        proofOfPaymentUrl: reservation.proofOfPaymentUrl || "",
        paymongoPaymentId: reservation.paymongoPaymentId || "",
        paymongoSessionId: reservation.paymongoSessionId || "",
        receiptSentAt: reservation.receiptSentAt || null,
        reservedAt: reservation.reservedAt || null,
        reservationFeeAmount: reservation.reservationFeeAmount || 2000,
        room: reservation.roomId,
        viewingPreference:
          reservation.viewingPreference || reservation.viewingType || "",
        viewingType:
          reservation.viewingType || reservation.viewingPreference || "",
        visitDate: reservation.visitDate || "",
        visitTime: reservation.visitTime || "",
        visitStatus: reservation.visitStatus || "",
        visitApproved: Boolean(reservation.visitApproved),
        scheduleApproved: Boolean(reservation.scheduleApproved),
        scheduleRejected: Boolean(reservation.scheduleRejected),
        roomConfirmed: Boolean(reservation.roomConfirmed),
        visitCode: reservation.visitCode || "",
        remoteViewingAcknowledged: Boolean(reservation.remoteViewingAcknowledged),
        remoteViewingQuestions: reservation.remoteViewingQuestions || "",
        isUrgentMoveIn: Boolean(reservation.isUrgentMoveIn),
        selectedBed: reservation.selectedBed,
        selectedAppliances: reservation.selectedAppliances || [],
        applianceFees: reservation.applianceFees || 0,
        applicationReviewReason: reservation.applicationReviewReason || "",
      });
      if (reservation.targetMoveInDate) {
        const d = new Date(reservation.targetMoveInDate);
        if (!isNaN(d)) setTargetMoveInDate(d.toISOString().split("T")[0]);
      }
      if (reservation.leaseDuration)
        setLeaseDuration(reservation.leaseDuration);
      if (reservation.billingEmail) setBillingEmail(reservation.billingEmail);
      if (reservation.viewingPreference || reservation.viewingType) {
        setViewingType(reservation.viewingPreference || reservation.viewingType);
      }
      setRemoteViewingAcknowledged(Boolean(reservation.remoteViewingAcknowledged));
      setRemoteViewingQuestions(reservation.remoteViewingQuestions || "");
      setIsUrgentMoveIn(Boolean(reservation.isUrgentMoveIn));
      if (reservation.isOutOfTown !== undefined)
        setIsOutOfTown(reservation.isOutOfTown);
      if (reservation.currentLocation)
        setCurrentLocation(reservation.currentLocation);
      if (reservation.visitApproved !== undefined)
        setVisitApproved(reservation.visitApproved);
      if (reservation.paymentMethod) setPaymentMethod(reservation.paymentMethod);
      if (
        reservation.proofOfPaymentUrl ||
        reservation.paymentDate ||
        reservation.paymongoPaymentId ||
        reservation.paymentStatus === "paid" ||
        reservation.paymentStatus === "partial"
      )
        setPaymentSubmitted(true);
      if (reservation.paymentStatus === "paid") setPaymentApproved(true);
      populateFromReservation(reservation);
      if (!restoreLocalApplicationDraftIfNeeded(reservation)) {
        markBackendApplicationDraftRestored(reservation);
      }
      const {
        hasVisitScheduled,
        isVisitApprovedFlag,
        hasApplication,
        hasPayment,
        isConfirmed,
        highest,
        applicationUnlockedByVisit,
      } = computeLockingFlags(reservation);

      // Status-driven stage calculation
      const reservationStatus = normalizeReservationStatus(reservation.status);
      let targetStage = resolveTargetStage(reservationStatus, getReservationViewingPreference(reservation), applicationUnlockedByVisit);
      const applicationStageBlocked =
        isTenantApplicationStageRequestBlocked(stepOverride, {
          ...reservation,
          status: reservationStatus,
          viewingPreference: getReservationViewingPreference(reservation),
        });
      if (applicationStageBlocked) {
        targetStage = Math.min(targetStage || 2, 2);
      }

      // visit_pending: tenant must wait ΓÇö redirect to profile (unless rejected)
      if (false && reservationStatus === "visit_pending" && !reservation.scheduleRejected) {
        appNavigate("/applicant/profile", {
          flash: {
            type: "info",
            message:
              "Waiting for admin to approve your visit. Track progress on your profile.",
          },
        });
        return;
      }

      // If visit was rejected, allow user to stay on step 2 to reschedule
      if (reservation.scheduleRejected) {
        setVisitDate("");
        setVisitTime("");
        setScheduleRejected(true);
        setScheduleRejectionReason(reservation.scheduleRejectionReason || "");
        setVisitCompleted(false);
      }

      // Fallback for legacy records still at "pending" with data beyond step 1
      if (targetStage === 1) {
        if (isConfirmed) targetStage = 5;
        else if (hasPayment) targetStage = 5;
        else if (hasApplication) targetStage = 3;
        else if (isVisitApprovedFlag) targetStage = 3;
        else if (hasVisitScheduled) targetStage = 2;
      }

      if (reservation.roomConfirmed && targetStage === 1) {
        targetStage = 2;
      }
      if (skipStageSet) {
        // Payment redirect ΓÇö verify using the reservation's stored paymongoSessionId
        // Set highest to 5 immediately so the stepper renders all stages green from the start
        setHighestStageReached(5);
        const verificationSessionId =
          paymentReturnSessionIdRef.current ||
          reservation.paymongoSessionId ||
          sessionStorage.getItem(PAYMENT_SESSION_KEY) ||
          null;
        // Verify payment status with PayMongo/webhook state before leaving the loader.
        if (
          verificationSessionId ||
          isReservationPaymentConfirmed(reservation) ||
          paymentReturnStatusRef.current === "success"
        ) {
          try {
            const { result, reservation: validatedReservation } =
              isReservationPaymentConfirmed(reservation)
                ? {
                    result: {
                      status: "paid",
                      paymentMethod: reservation.paymentMethod || "paymongo",
                    },
                    reservation,
                  }
                : await waitForDepositPaymentValidation(
                    resId,
                    verificationSessionId,
                  );
            if (result?.requiresReview) {
              sessionStorage.removeItem(PAYMENT_SESSION_KEY);
              sessionStorage.removeItem(PAYMENT_RETURN_PENDING_KEY);
              await queryClient.invalidateQueries({ queryKey: ["reservations"] });
              await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              appNavigate("/applicant/profile", {
                flash: {
                  type: "warning",
                  message:
                    "Payment was received but needs admin review before your reservation can be secured.",
                },
              });
              return;
            }

            if (result?.status === "paid") {
              sessionStorage.removeItem(getActiveResKey(user?.firebaseUid));
              sessionStorage.removeItem("activeReservationId"); // legacy cleanup
              sessionStorage.removeItem(PAYMENT_SESSION_KEY);
              sessionStorage.removeItem(PAYMENT_RETURN_PENDING_KEY);
              let updatedReservation = validatedReservation || result.reservation || null;
              if (!updatedReservation?._id) {
                try {
                updatedReservation = await reservationApi.getById(resId);
                if (updatedReservation?.reservationCode) setReservationCode(updatedReservation.reservationCode);
                if (updatedReservation?.paymentMethod) setPaymentMethod(updatedReservation.paymentMethod);
              } catch { /* non-critical ΓÇö code just won't display */ }
              }
              if (updatedReservation?._id) {
                setReservationData((previous) => ({
                  ...(previous || {}),
                  ...updatedReservation,
                  room: updatedReservation.roomId || updatedReservation.room || previous?.room,
                }));
                if (updatedReservation.reservationCode) {
                  setReservationCode(updatedReservation.reservationCode);
                }
                if (updatedReservation.paymentMethod) {
                  setPaymentMethod(updatedReservation.paymentMethod);
                }
                queryClient.setQueryData(
                  ["reservations", "detail", updatedReservation._id],
                  (current) => ({ ...(current || {}), ...updatedReservation }),
                );
                queryClient.setQueriesData(
                  { queryKey: ["reservations", "list"] },
                  (current) => mergeReservationIntoQueryData(current, updatedReservation),
                );
              }
              await queryClient.invalidateQueries({ queryKey: ["reservations"] });
              await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              await wait(PAYMENT_RETURN_MIN_LOADING_MS);
              setCurrentStage(5);
              setHighestStageReached(5);
              setPaymentSubmitted(true);
              setPaymentApproved(true);
              justPaidRef.current = true;
              setPaymentMethod(result.paymentMethod || "paymongo");
              showNotification("Payment confirmed. Your reservation details are being finalized.", "success", 5000);
              return;
            } else {
              console.warn("[PAYMENT] Session not yet paid:", verificationSessionId, "status:", result?.status);
              sessionStorage.removeItem(PAYMENT_RETURN_PENDING_KEY);
              setCurrentStage(4);
              // Show appropriate toast based on how the user returned
              if (paymentReturnStatusRef.current === "cancelled") {
                showNotification("Payment was not confirmed yet. You can try again from the payment step.", "info", 5000);
              } else {
                appNavigate("/applicant/profile", {
                  flash: {
                    type: "info",
                    message:
                      "Payment is still being validated. You can retry from the payment step if needed.",
                  },
                });
              }
              return;
            }
          } catch (err) {
            console.error("Γ¥î [VERIFY] Payment check failed ΓÇö sessionId:", verificationSessionId, err);
            sessionStorage.removeItem(PAYMENT_RETURN_PENDING_KEY);
            setCurrentStage(4);
            if (paymentReturnStatusRef.current !== "cancelled") {
              showNotification("Could not verify payment. Please check your profile.", "warning", 5000);
            }
            return;
          }
        } else {
          // No stored session ID ΓÇö skip generic toast, just navigate to correct stage
          console.warn("[PAYMENT] skipStageSet=true but paymongoSessionId is empty for reservation:", resId);
          setCurrentStage(targetStage);
          return; // ΓåÉ prevent double-toast: skip the generic notification below
        }
      } else {
        if (applicationStageBlocked)
          setCurrentStage(targetStage || 2);
        else if (stepOverride && stepOverride <= highest)
          setCurrentStage(stepOverride);
        else setCurrentStage(targetStage);
      }
      showNotification(
        applicationStageBlocked
          ? TENANT_APPLICATION_LOCKED_MESSAGE
          : stepOverride
          ? "Editing your application. Make your changes and save."
          : "Reservation data loaded. Continue where you left off!",
        applicationStageBlocked ? "info" : "success",
        applicationStageBlocked ? 5000 : 3000,
      );
    } catch (err) {
      console.error("Γ¥î [LOAD_RESERVATION] Failed to load reservation id:", resId, "| status:", err?.response?.status, "| message:", err?.message, err);
      const status = err?.response?.status;
      if (status === 404) {
        sessionStorage.removeItem(getActiveResKey(user?.firebaseUid));
        sessionStorage.removeItem("activeReservationId"); // legacy cleanup
        appNavigate("/applicant/check-availability", {
          flash: {
            type: "error",
            message: "Reservation not found. It may have been removed or expired.",
          },
        });
      } else if (status === 401 || status === 403) {
        appNavigate("/signin", {
          flash: {
            type: "warning",
            message: "Please sign in to continue your reservation.",
          },
        });
      } else {
        showNotification("Failed to load reservation data", "error", 3000);
      }
    } finally {
      paymentVerifyingRef.current = false;
      setPaymentReturnLoading(false);
      setIsLoading(false);
    }
  };

  // ΓöÇΓöÇ Form change tracking (Stage 1) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (currentStage === 1) {
      setIsFormDirty(
        targetMoveInDate !== initialFormState.targetMoveInDate ||
          leaseDuration !== initialFormState.leaseDuration ||
          billingEmail !== initialFormState.billingEmail,
      );
    }
  }, [
    targetMoveInDate,
    leaseDuration,
    billingEmail,
    initialFormState,
    currentStage,
  ]);

  // ΓöÇΓöÇ API helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const advanceStage = async (nextStage, message) => {
    setHighestStageReached((prev) => Math.max(prev, nextStage));
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    appNavigate("/applicant/profile", {
      flash: {
        type: "success",
        message: message || "Step completed! Track your progress here.",
      },
    });
  };

  const getFieldValue = (value, defaultValue = "") =>
    devBypassValidation && !value ? defaultValue : value;

  const normalizeRoomName = (room) => {
    const raw = room?.id || room?.name || room?.roomNumber || room?.title;
    return raw
      ? String(raw)
          .replace(/^Room\s+/i, "")
          .trim()
      : "";
  };

  const resolveRoomId = async () => {
    const room = reservationData?.room;
    const directId = room?._id || room?.roomId;
    if (directId) return directId;
    const roomName = normalizeRoomName(room);
    if (!roomName) return null;
    const rooms = await roomApi.getAll();
    const matched = rooms.find(
      (r) =>
        r.name === roomName ||
        r.roomNumber === roomName ||
        r.name?.toLowerCase() === roomName.toLowerCase(),
    );
    return matched?._id || null;
  };

  const getMoveInDate = () => targetMoveInDate || finalMoveInDate;
  const getTotalPrice = () =>
    Number(reservationData?.room?.price || 0) +
    Number(reservationData?.applianceFees || 0);

  const createReservationDraft = async (payloadOverrides = {}) => {
    const roomId = await resolveRoomId();
    if (!roomId) {
      showNotification(
        "Room details are missing. Please reselect a room.",
        "error",
        3000,
      );
      return null;
    }
    const moveInDate = getMoveInDate();
    if (!moveInDate) {
      showNotification("Please set a move-in date.", "error", 3000);
      return null;
    }
    const totalPrice = getTotalPrice();
    if (!totalPrice || totalPrice <= 0) {
      showNotification(
        "Room pricing is unavailable. Please go back and reselect a room.",
        "error",
        4000,
      );
      return null;
    }
    try {
      const response = await reservationApi.create({
        roomId,
        selectedBed: reservationData?.selectedBed
          ? {
              id: reservationData.selectedBed.id,
              position: reservationData.selectedBed.position,
            }
          : null,
        targetMoveInDate: getFieldValue(targetMoveInDate, moveInDate),
        leaseDuration: leaseDuration || "",
        billingEmail: getFieldValue(
          billingEmail,
          user?.email || "test@example.com",
        ),
        moveInDate,
        selectedAppliances: reservationData?.selectedAppliances || [],
        totalPrice,
        applianceFees: reservationData?.applianceFees || 0,
        viewingPreference: null,
        viewingType: null,
        agreedToPrivacy: false,
        roomConfirmed: true,
        ...payloadOverrides,
      });
      const created = response?.reservation || response;
      const createdId = response?.reservationId || created?._id;
      if (createdId) setReservationId(createdId);
      if (created?.reservationCode) setReservationCode(created.reservationCode);
      return created;
    } catch (error) {
      const existingId = error?.response?.data?.existingReservationId;
      if (
        error?.response?.data?.code === "RESERVATION_ALREADY_EXISTS" &&
        existingId
      ) {
        setReservationId(existingId);
        // Update the existing reservation with new step 1 values
        try {
          await reservationApi.updateByUser(existingId, {
            roomId,
            selectedBed: reservationData?.selectedBed
              ? {
                  id: reservationData.selectedBed.id,
                  position: reservationData.selectedBed.position,
                }
              : null,
            targetMoveInDate: getFieldValue(targetMoveInDate, moveInDate),
            leaseDuration: null,
            billingEmail: getFieldValue(
              billingEmail,
              user?.email || "test@example.com",
            ),
            selectedAppliances: reservationData?.selectedAppliances || [],
            totalPrice: totalPrice > 0 ? totalPrice : 5000,
            applianceFees: reservationData?.applianceFees || 0,
            agreedToPrivacy: false,
            agreedToCertification: false,
            roomConfirmed: true,
          });
          const existing = await reservationApi.getById(existingId);
          if (existing?.reservationCode)
            setReservationCode(existing.reservationCode);
          return existing;
        } catch (e) {
          const lockCode = e?.response?.data?.code;
          showNotification(
            lockCode === "RESERVATION_ROOM_SELECTION_LOCKED"
              ? ROOM_SELECTION_LOCKED_MESSAGE
              : getFriendlyError(e, "Unable to update your selected room."),
            lockCode === "RESERVATION_ROOM_SELECTION_LOCKED" ? "info" : "error",
            4000,
          );
          return null;
        }
      }
      throw error;
    }
  };

  const updateReservationDraft = async (payloadOverrides = {}) => {
    if (!reservationId) return createReservationDraft(payloadOverrides);
    const response = await reservationApi.updateByUser(
      reservationId,
      payloadOverrides,
    );
    const updated = response?.reservation || response;
    if (updated?._id) setReservationId(updated._id);
    if (updated?.status || updated?.roomId) {
      setReservationData((previous) => ({
        ...(previous || {}),
        _id: updated._id || previous?._id,
        status: updated.status || previous?.status,
        reservationCode:
          updated.reservationCode ?? previous?.reservationCode ?? "",
        paymentStatus:
          updated.paymentStatus ?? previous?.paymentStatus ?? "",
        paymentMethod:
          updated.paymentMethod ?? previous?.paymentMethod ?? "",
        paymentDate:
          updated.paymentDate ?? previous?.paymentDate ?? null,
        proofOfPaymentUrl:
          updated.proofOfPaymentUrl ?? previous?.proofOfPaymentUrl ?? "",
        paymongoPaymentId:
          updated.paymongoPaymentId ?? previous?.paymongoPaymentId ?? "",
        paymongoSessionId:
          updated.paymongoSessionId ?? previous?.paymongoSessionId ?? "",
        receiptSentAt:
          updated.receiptSentAt ?? previous?.receiptSentAt ?? null,
        reservedAt:
          updated.reservedAt ?? previous?.reservedAt ?? null,
        reservationFeeAmount:
          updated.reservationFeeAmount ?? previous?.reservationFeeAmount ?? 2000,
        room: updated.roomId || previous?.room,
        viewingPreference:
          updated.viewingPreference ??
          updated.viewingType ??
          previous?.viewingPreference ??
          previous?.viewingType ??
          "",
        viewingType:
          updated.viewingType ??
          updated.viewingPreference ??
          previous?.viewingType ??
          previous?.viewingPreference ??
          "",
        visitDate:
          updated.visitDate ?? previous?.visitDate ?? "",
        visitTime:
          updated.visitTime ?? previous?.visitTime ?? "",
        visitStatus:
          updated.visitStatus ?? previous?.visitStatus ?? "",
        visitApproved:
          updated.visitApproved ?? previous?.visitApproved ?? false,
        scheduleApproved:
          updated.scheduleApproved ?? previous?.scheduleApproved ?? false,
        scheduleRejected:
          updated.scheduleRejected ?? previous?.scheduleRejected ?? false,
        roomConfirmed:
          updated.roomConfirmed ?? previous?.roomConfirmed ?? false,
        visitCode:
          updated.visitCode ?? previous?.visitCode ?? "",
        remoteViewingAcknowledged:
          updated.remoteViewingAcknowledged ??
          previous?.remoteViewingAcknowledged ??
          false,
        remoteViewingQuestions:
          updated.remoteViewingQuestions ??
          previous?.remoteViewingQuestions ??
          "",
        isUrgentMoveIn:
          updated.isUrgentMoveIn ?? previous?.isUrgentMoveIn ?? false,
        selectedBed: updated.selectedBed ?? previous?.selectedBed,
        selectedAppliances:
          updated.selectedAppliances ?? previous?.selectedAppliances ?? [],
        applianceFees: updated.applianceFees ?? previous?.applianceFees ?? 0,
        applicationReviewReason:
          updated.applicationReviewReason ?? previous?.applicationReviewReason ?? "",
      }));
    }
    return updated;
  };

  const returnToDashboardAfterViewingPreference = useCallback(
    ({
      viewingPreference,
      visitCode: savedVisitCode,
      visitDate: savedVisitDate,
      visitTime: savedVisitTime,
    } = {}) => {
      const feedbackByPreference = {
        physical_visit: {
          toastMessage:
            "Viewing preference submitted.",
        },
        remote_2d_viewing: {
          toastMessage:
            "Viewing preference submitted.",
        },
        urgent_move_in_review: {
          toastMessage:
            "Viewing preference submitted.",
        },
      };

      const selectedPreference = viewingPreference || viewingType;
      const feedback =
        feedbackByPreference[selectedPreference] ||
        feedbackByPreference.remote_2d_viewing;

      appNavigate("/applicant/profile", {
        state: {
          tab: "dashboard",
        },
        flash: {
          type: "success",
          message: feedback.toastMessage,
        },
      });
    },
    [appNavigate, viewingType, visitCode, visitDate, visitTime],
  );

  // ΓöÇΓöÇ Auto-save (stages 3-4) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const validateApplicantIdDocument = useCallback(
    async ({ documentUrl, idType } = {}) => {
      const targetReservationId = reservationId || reservationData?._id || reservationData?.id;
      const selectedIdType = idType || validIDType;

      if (!targetReservationId || !documentUrl || !selectedIdType) {
        const message = !selectedIdType
          ? "ID type is required."
          : "Valid ID front image is required.";
        setIdValidationResult({
          validationStatus: "failed",
          message,
          notes: [],
        });
        return null;
      }

      setIsValidatingId(true);
      setIdValidationResult({
        validationStatus: "validating",
        message: "Validating ID...",
        notes: [],
      });

      try {
        const result = await reservationApi.validateIdDocument(targetReservationId, {
          documentUrl,
          idType: selectedIdType,
          firstName,
          middleName,
          lastName,
        });
        const normalizedResult = {
          validationStatus: result.validationStatus || "manual_review",
          message:
            result.message ||
            "ID uploaded. It will be manually reviewed by admin.",
          extractedName: result.extractedName || "",
          extractedIdNumber: result.extractedIdNumber || "",
          matchScore: result.matchScore ?? null,
          notes: result.notes || [],
        };

        setIdValidationResult(normalizedResult);

        if (normalizedResult.validationStatus === "passed") {
          showNotification("ID verified successfully.", "success", 3000);
        } else if (normalizedResult.validationStatus === "failed") {
          showNotification("ID image is unclear. Please upload a clearer photo.", "error", 4000);
        } else if (normalizedResult.validationStatus === "manual_review") {
          showNotification("ID uploaded. It will be manually reviewed by admin.", "info", 4000);
        } else {
          showNotification("Name mismatch detected. Please review your information or upload a clearer ID.", "warning", 5000);
        }

        return normalizedResult;
      } catch (error) {
        const message = getFriendlyError(
          error,
          "ID requires manual verification.",
        );
        const fallback = {
          validationStatus: "manual_review",
          message,
          notes: ["ID validation could not be completed. Admin manual review is required."],
        };
        setIdValidationResult(fallback);
        showNotification(message, "warning", 4000);
        return fallback;
      } finally {
        setIsValidatingId(false);
      }
    },
    [
      firstName,
      lastName,
      middleName,
      reservationData,
      reservationId,
      validIDType,
    ],
  );

  const runDocumentPrecheck = useCallback(
    async ({ documentType, documentUrl, idType } = {}) => {
      const targetReservationId =
        reservationId || reservationData?._id || reservationData?.id;

      if (!targetReservationId || !documentType || !documentUrl) {
        return null;
      }

      const stateKeyMap = {
        valid_id_front: "validIDFront",
        valid_id_back: "validIDBack",
        nbi_clearance: "nbiClearance",
        company_id: "companyID",
      };
      const stateKey = stateKeyMap[documentType];
      if (!stateKey) {
        return null;
      }

      setRunningDocumentChecks((previous) => ({
        ...previous,
        [stateKey]: true,
      }));
      setDocumentPrechecks((previous) => ({
        ...previous,
        [stateKey]: {
          ...normalizeDocumentPrecheckEntry(previous?.[stateKey]),
          precheckStatus: "checking",
          readabilityStatus: "unknown",
          documentTypeStatus: "unknown",
          canSubmit: false,
          aiCheckStatus: "checking",
          summaryMessage: DOCUMENT_PRECHECK_MESSAGES.checking,
          applicantMessage: DOCUMENT_PRECHECK_MESSAGES.checking,
        },
      }));

      try {
        const result = await reservationApi.precheckDocument(targetReservationId, {
          documentType,
          documentUrl,
          idType: idType || validIDType,
        });
        const normalized = normalizeDocumentPrecheckEntry(result);
        setDocumentPrechecks((previous) => ({
          ...previous,
          [stateKey]: normalized,
        }));
        return normalized;
        } catch (error) {
          const fallback = normalizeDocumentPrecheckEntry({
            precheckProvider: "ocr",
            precheckStatus: "manual_review_fallback",
            readabilityStatus: "ocr_unavailable",
            documentTypeStatus: "unknown",
            canSubmit: true,
            requiresManualReview: true,
            applicantMessage: DOCUMENT_PRECHECK_MESSAGES.manualReview,
            adminNote: "OCR could not complete. Manual review required.",
            flags: ["ocr_manual_fallback"],
            aiCheckStatus: "error",
            aiCheckWarnings: [
              "OCR could not complete. Manual review required.",
            ],
           summaryMessage: DOCUMENT_PRECHECK_MESSAGES.manualReview,
            requiresAdminAttention: true,
            aiCheckedAt: new Date().toISOString(),
            provider: "ocr",
          });
        setDocumentPrechecks((previous) => ({
          ...previous,
          [stateKey]: fallback,
        }));
        return fallback;
      } finally {
        setRunningDocumentChecks((previous) => ({
          ...previous,
          [stateKey]: false,
        }));
      }
    },
    [reservationData, reservationId, validIDType],
  );

  const buildDraftPayload = useCallback(
    () => {
      const includeViewingPreferenceDraft =
        Boolean(viewingType) &&
        (currentStage === 2 || !viewingPreferenceStepAccess.submitted);
      const payload = {
        ...(includeViewingPreferenceDraft
          ? {
              visitDate,
              visitTime,
              viewingPreference: viewingType,
              viewingType:
                viewingType === "physical_visit"
                  ? "inperson"
                  : viewingType === "remote_2d_viewing"
                    ? "remote_2d"
                    : viewingType === "urgent_move_in_review"
                      ? "urgent_move_in"
                      : viewingType,
              remoteViewingAcknowledged,
              remoteViewingQuestions,
              isUrgentMoveIn,
              visitorName,
              visitorPhone,
              visitorEmail,
            }
          : {}),
        firstName,
        lastName,
        middleName,
        nickname,
        mobileNumber,
        birthday,
        gender,
        maritalStatus,
        nationality,
        educationLevel,
        addressUnitHouseNo,
        addressStreet,
        addressRegion,
        addressBarangay,
        addressCity,
        addressProvince,
        emergencyContactName,
        emergencyRelationship,
        emergencyContactNumber,
        healthConcerns,
        employerSchool,
        employerAddress,
        employerContact,
        startDate,
        occupation,
        previousEmployment,
        validIDType,
        idType: validIDType,
        nbiReason,
        companyIDReason,
        personalNotes,
        referralSource,
        referrerName,
        estimatedMoveInTime,
        workSchedule,
        workScheduleOther,
        targetMoveInDate,
        ...(leaseDuration ? { leaseDuration } : {}),
        finalMoveInDate,
        agreedToPrivacy,
        agreedToCertification,
      };

      const uploadUrls = {
        selfiePhotoUrl: getSerializableUploadUrl(selfiePhoto),
        validIDFrontUrl: getSerializableUploadUrl(validIDFront),
        validIDBackUrl: getSerializableUploadUrl(validIDBack),
        nbiClearanceUrl: getSerializableUploadUrl(nbiClearance),
        companyIDUrl: getSerializableUploadUrl(companyID),
      };
      Object.entries(uploadUrls).forEach(([key, value]) => {
        if (value) payload[key] = value;
      });

      return payload;
    },
    [
      currentStage,
      visitDate,
      visitTime,
      viewingType,
      viewingPreferenceStepAccess.submitted,
      remoteViewingAcknowledged,
      remoteViewingQuestions,
      isUrgentMoveIn,
      visitorName,
      visitorPhone,
      visitorEmail,
      firstName,
      lastName,
      middleName,
      nickname,
      mobileNumber,
      birthday,
      gender,
      maritalStatus,
      nationality,
      educationLevel,
      addressUnitHouseNo,
      addressStreet,
      addressRegion,
      addressBarangay,
      addressCity,
      addressProvince,
      emergencyContactName,
      emergencyRelationship,
      emergencyContactNumber,
      healthConcerns,
      employerSchool,
      employerAddress,
      employerContact,
      startDate,
      occupation,
      previousEmployment,
      selfiePhoto,
      validIDFront,
      validIDBack,
      validIDType,
      nbiClearance,
      nbiReason,
      companyIDReason,
      personalNotes,
      referralSource,
      referrerName,
      estimatedMoveInTime,
      workSchedule,
      workScheduleOther,
      targetMoveInDate,
      companyID,
      leaseDuration,
      finalMoveInDate,
      agreedToPrivacy,
      agreedToCertification,
    ],
  );

  useEffect(() => {
    const payload = {
      ...buildDraftPayload(),
      applicationDraftAutosave: true,
    };
    const draftSignature = JSON.stringify({
      payload,
      documentPrechecks,
      idValidationResult,
    });

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      lastSavedApplicationDraftRef.current = draftSignature;
      return;
    }

    const canAutoSave = canAutoSaveApplicationDraft({
      currentStage,
      reservationId,
      applicationAccessAllowed,
      stageLocked: isStageLocked(3),
      applicationSubmitted,
      editingApplication,
      reservationStatus: reservationData?.status,
      paymentSubmitted,
      paymentApproved,
    });

    if (!canAutoSave) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      setHasUnsavedApplicationChanges(false);
      return;
    }

    if (draftSignature === lastSavedApplicationDraftRef.current) return;

    setHasUnsavedApplicationChanges(true);
    setDraftRecoveryMessage("");

    if (typeof window !== "undefined" && window.localStorage) {
      const key = getApplicationDraftStorageKey(user?.firebaseUid, reservationId);
      if (key) {
        try {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              userId: user?.firebaseUid || "",
              reservationId,
              savedAt: new Date().toISOString(),
              payload,
              documentPrechecks,
              idValidationResult,
            }),
          );
        } catch (error) {
          console.warn("Could not write local application draft backup:", error);
        }
      }
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (applicationDraftSaveClearTimerRef.current) {
      clearTimeout(applicationDraftSaveClearTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus("saving");
        await updateReservationDraft(payload);
        const savedAt = new Date().toISOString();
        lastSavedApplicationDraftRef.current = draftSignature;
        setLastApplicationDraftSavedAt(savedAt);
        setHasUnsavedApplicationChanges(false);
        setSaveStatus("saved");
        applicationDraftSaveClearTimerRef.current = setTimeout(
          () => setSaveStatus(""),
          3000,
        );
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveStatus("error");
        setHasUnsavedApplicationChanges(true);
        applicationDraftSaveClearTimerRef.current = setTimeout(
          () => setSaveStatus(""),
          6000,
        );
      }
    }, APPLICATION_DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    applicationAccessAllowed,
    applicationSubmitted,
    buildDraftPayload,
    currentStage,
    documentPrechecks,
    editingApplication,
    idValidationResult,
    paymentApproved,
    paymentSubmitted,
    reservationData?.status,
    reservationId,
    user?.firebaseUid,
  ]);

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (applicationDraftSaveClearTimerRef.current) {
        clearTimeout(applicationDraftSaveClearTimerRef.current);
      }
    },
    [],
  );

  // ΓöÇΓöÇ Stage handler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const focusFieldByDataKey = (fieldKey) => {
    if (!fieldKey || typeof document === "undefined") return false;

    const container = document.querySelector(`[data-field="${fieldKey}"]`);
    if (!container) return false;

    container.scrollIntoView({ behavior: "smooth", block: "center" });

    const focusTarget = container.matches(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    )
      ? container
      : container.querySelector(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );

    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }

    return true;
  };

  const handleNextStage = async () => {
    clearTimeout(autoSaveTimerRef.current);
    try {
      if (currentStage === 1) {
        if (roomSelectionLocked) {
          notifyRoomSelectionLocked();
          return;
        }
        if (!reservationData?.room) {
          showNotification("Please select a room to continue", "error", 3000);
          return;
        }
        setPendingStageAction("stage1");
        setShowStageConfirm(true);
        return;
      } else if (currentStage === 2) {
        if (viewingPreferenceStepAccess.readOnly) {
          notifyViewingPreferenceLocked();
          return;
        }
        if (!applicationAccessAllowed) {
          setHighestStageReached((prev) => Math.max(prev, 2));
          returnToDashboardForApplicationGate();
          return;
        }

        setHighestStageReached((prev) => Math.max(prev, 3));
        setCurrentStage(3);
        return;
      } else if (currentStage === 3) {
        if (!applicationAccessAllowed) {
          returnToDashboardForApplicationGate();
          return;
        }

        if (!devBypassValidation) {
          const hasText = (value) => Boolean(value?.trim?.() || value);
          // 09XXXXXXXXX format ΓÇö matches backend normalization and new input constraint.
          const isValidPhone = (value) => validatePHPhoneLocal(value).valid;
          const requiredFields = [
            { key: "selfiePhoto", label: "Selfie Photo", isMissing: !selfiePhoto },
            { key: "lastName", label: "Last Name", isMissing: !hasText(lastName) },
            { key: "firstName", label: "First Name", isMissing: !hasText(firstName) },
            {
              key: "mobileNumber",
              label: "Mobile Number",
              isMissing: !isValidPhone(mobileNumber),
              message: "Enter a valid mobile number (e.g. 9123456789).",
            },
            {
              key: "birthday",
              label: "Birthday",
              isMissing: !validateBirthday(birthday).valid,
              message: "Please enter a valid birthday to continue.",
            },
            { key: "gender", label: "Gender", isMissing: !hasText(gender) },
            { key: "maritalStatus", label: "Marital Status", isMissing: !hasText(maritalStatus) },
            { key: "nationality", label: "Nationality", isMissing: !hasText(nationality) },
            { key: "educationLevel", label: "Educational Attainment", isMissing: !hasText(educationLevel) },
            { key: "addressUnitHouseNo", label: "Unit / House No.", isMissing: !hasText(addressUnitHouseNo) },
            { key: "addressStreet", label: "Street", isMissing: !hasText(addressStreet) },
            { key: "addressRegion", label: "Region", isMissing: !hasText(addressRegion) },
            { key: "addressProvince", label: "Province", isMissing: !hasText(addressProvince) },
            { key: "addressCity", label: "City / Municipality", isMissing: !hasText(addressCity) },
            { key: "addressBarangay", label: "Barangay", isMissing: !hasText(addressBarangay) },
            { key: "validIDType", label: "ID Type", isMissing: !hasText(validIDType) },
            { key: "validIDFront", label: "Valid ID (Front)", isMissing: !validIDFront },
            { key: "validIDBack", label: "Valid ID (Back)", isMissing: !validIDBack },
            {
              key: "nbiClearance",
              label: "NBI Clearance",
              isMissing: !nbiClearance && !hasText(nbiReason),
              message: "Please upload NBI Clearance or provide a reason to continue.",
            },
            {
              key: "emergencyContactName",
              label: "Emergency Contact Name",
              isMissing: !hasText(emergencyContactName),
            },
            {
              key: "emergencyRelationship",
              label: "Emergency Relationship",
              isMissing: !hasText(emergencyRelationship),
            },
            {
              key: "emergencyContactNumber",
              label: "Emergency Contact Number",
              isMissing: !isValidPhone(emergencyContactNumber),
              message: "Please enter a valid emergency contact number to continue.",
            },
            { key: "healthConcerns", label: "Health Concerns", isMissing: !hasText(healthConcerns) },
            { key: "employerSchool", label: "Current Employer", isMissing: !hasText(employerSchool) },
            { key: "employerAddress", label: "Employer Address", isMissing: !hasText(employerAddress) },
            {
              key: "employerContact",
              label: "Employer Contact Number",
              isMissing: hasText(employerContact) && !validatePHPhoneOrLandline(employerContact),
              message: "Enter a valid phone number (e.g. 09123456789 or 02-1234567).",
            },
            { key: "occupation", label: "Occupation", isMissing: !hasText(occupation) },
            {
              key: "companyID",
              label: "Company ID",
              isMissing: !companyID && !hasText(companyIDReason),
              message: "Please upload Company ID or provide a reason to continue.",
            },
            { key: "referralSource", label: "Referral Source", isMissing: !hasText(referralSource) },
            {
              key: "targetMoveInDate",
              label: "Move-in Date",
              isMissing: !validateTargetMoveInDate(targetMoveInDate).valid,
              message: "Please choose a valid target move-in date to continue.",
            },
            {
              key: "estimatedMoveInTime",
              label: "Move-in Time",
              isMissing: !validateEstimatedTime(estimatedMoveInTime).valid,
              message: "Please select a valid move-in time to continue.",
            },
            {
              key: "leaseDuration",
              label: "Duration of Lease",
              isMissing: !hasText(leaseDuration),
              message: "Please select a lease duration to continue.",
            },
            { key: "workSchedule", label: "Work Schedule", isMissing: !hasText(workSchedule) },
            {
              key: "workScheduleOther",
              label: "Work Schedule Details",
              isMissing:
                workSchedule === "others" && !hasText(workScheduleOther),
              message: "Please describe your work schedule to continue.",
            },
          ];
          const firstInvalid = requiredFields.find((field) => field.isMissing);
          const missingAgreements = !agreedToPrivacy || !agreedToCertification;

          if (firstInvalid || missingAgreements) {
            setShowValidationErrors(true);

            if (firstInvalid) {
              setTimeout(() => {
                focusFieldByDataKey(firstInvalid.key);
              }, 100);
              showNotification(
                firstInvalid.message ||
                  `"${firstInvalid.label}" is required. Please fill it in to continue.`,
                "error",
                4000,
              );
            } else {
              setTimeout(() => {
                const el = document.getElementById("section-agreements");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
                const checkbox = document.getElementById("privacy-consent");
                if (checkbox && typeof checkbox.focus === "function") {
                  checkbox.focus({ preventScroll: true });
                }
              }, 100);
              showNotification(
                "Please agree to both consent items to continue.",
                "error",
                4000,
              );
            }
            return;
          }

          const requiredDocumentChecks = [
            { key: "validIDFront", hasUpload: Boolean(validIDFront) },
            { key: "validIDBack", hasUpload: Boolean(validIDBack) },
            { key: "nbiClearance", hasUpload: Boolean(nbiClearance) },
            { key: "companyID", hasUpload: Boolean(companyID) },
          ]
            .filter((doc) => doc.hasUpload)
            .map((doc) => ({
              ...doc,
              label: DOCUMENT_PRECHECK_LABELS[doc.key],
              precheck: normalizeDocumentPrecheckEntry(documentPrechecks?.[doc.key]),
            }));
          const checkingDocument = requiredDocumentChecks.find(
            (doc) => doc.precheck.precheckStatus === "checking",
          );
          const uncheckedDocument = requiredDocumentChecks.find(
            (doc) => doc.precheck.precheckStatus === "not_checked",
          );
          const blockedDocument = requiredDocumentChecks.find((doc) =>
            isBlockingDocumentPrecheck(doc.precheck),
          );

          if (checkingDocument || uncheckedDocument || blockedDocument) {
            const problem = checkingDocument || uncheckedDocument || blockedDocument;
            const message = checkingDocument
              ? DOCUMENT_PRECHECK_MESSAGES.checkingSubmit
              : uncheckedDocument
                ? DOCUMENT_PRECHECK_MESSAGES.notChecked
                : getDocumentPrecheckBlockMessage(problem.label, problem.precheck);

            setShowValidationErrors(true);
            setTimeout(() => {
              focusFieldByDataKey(problem.key);
            }, 100);
            showNotification(message, "error", 5000);
            return;
          }
        }
        const selfiePhotoUrl = await uploadIfFile(selfiePhoto);
        const validIDFrontUrl = await uploadIfFile(validIDFront);
        const validIDBackUrl = await uploadIfFile(validIDBack);
        const nbiClearanceUrl = await uploadIfFile(nbiClearance);
        const companyIDUrl = await uploadIfFile(companyID);
        const applicationPayload = {
          firstName,
          lastName,
          middleName,
          nickname,
          mobileNumber,
          birthday,
          gender,
          maritalStatus,
          nationality,
          educationLevel,
          addressUnitHouseNo,
          addressStreet,
          addressRegion,
          addressBarangay,
          addressCity,
          addressProvince,
          emergencyContactName,
          emergencyRelationship,
          emergencyContactNumber,
          healthConcerns,
          employerSchool,
          employerAddress,
          employerContact,
          startDate,
          occupation,
          previousEmployment,
          roomType,
          preferredRoomNumber,
          referralSource,
          referrerName,
          estimatedMoveInTime,
          workSchedule,
          workScheduleOther,
          targetMoveInDate,
          leaseDuration,
          agreedToPrivacy,
          agreedToCertification,
          selfiePhotoUrl,
          validIDFrontUrl,
          validIDBackUrl,
          nbiClearanceUrl,
          nbiReason,
          personalNotes,
          companyIDUrl,
          companyIDReason,
          validIDType,
          idType: validIDType,
        };
        if (!applicationSubmitted) {
          applicationPayload.submitApplication = true;
        }
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        if (applicationDraftSaveClearTimerRef.current) {
          clearTimeout(applicationDraftSaveClearTimerRef.current);
        }
        await updateReservationDraft(applicationPayload);
        const draftKey = getApplicationDraftStorageKey(user?.firebaseUid, reservationId);
        if (draftKey && typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(draftKey);
        }
        lastSavedApplicationDraftRef.current = "";
        setHasUnsavedApplicationChanges(false);
        setSaveStatus("");
        setDraftRecoveryMessage("");
        setApplicationSubmitted(true);
        setEditingApplication(false);
        await queryClient.invalidateQueries({ queryKey: ["reservations"] });
        setSuccessOverlay({
          show: true,
          title: "Application Submitted!",
          subtitle:
            "Your application is pending review. Payment will be available once your application and documents are approved.",
        });
        appNavigate("/applicant/profile", {
          flash: {
            type: "success",
            title: "Application Submitted!",
            message:
              "Your application is pending review. Payment will be available once your application and documents are approved.",
          },
        });
      } else if (currentStage === 4) {
        // Stage 4 only uses PayMongo online checkout.
        // If user got here via the "Confirm" button, show overlay and go to profile.
        if (finalMoveInDate) {
          await updateReservationDraft({ finalMoveInDate });
        }
        setPaymentSubmitted(true);
        await queryClient.invalidateQueries({ queryKey: ["reservations"] });
        setSuccessOverlay({
          show: true,
          title: "Payment Step Ready!",
          subtitle: "Use the Pay Online button to complete your reservation.",
        });
        appNavigate("/applicant/profile", {
          flash: {
            type: "success",
            title: "Payment Step Ready!",
            message: "Use the Pay Online button to complete your reservation.",
          },
        });
      } else if (currentStage === 5) {
        navigate("/applicant/profile");
      }
    } catch (error) {
      showNotification(
        getFriendlyError(error, "Failed to process reservation. Please try again."),
        "error",
        3000,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevStage = async () => {
    if (currentStage === 1) {
      if (isFormDirty) setShowCancelConfirm(true);
      else navigate("/applicant/check-availability");
    } else {
      if (reservationId && !isStageLocked(currentStage)) {
        try {
          setSaveStatus("saving");
          await updateReservationDraft(buildDraftPayload());
          setHasUnsavedApplicationChanges(false);
          setLastApplicationDraftSavedAt(new Date().toISOString());
          setSaveStatus("saved");
          showNotification("Progress saved", "success", 2000);
          setTimeout(() => setSaveStatus(""), 3000);
        } catch (err) {
          showNotification("Could not save progress", "warning", 2000);
        }
      }
      setCurrentStage((prev) => Math.max(1, prev - 1));
    }
  };

  const handleStageConfirm = async () => {
    setShowStageConfirm(false);
    try {
      if (pendingStageAction === "stage1") {
        if (!reservationId) {
          const draft = await createReservationDraft();
          if (!draft) return;
        } else {
          await updateReservationDraft({ roomConfirmed: true });
        }
        await queryClient.invalidateQueries({ queryKey: ["reservations"] });
        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
        setSuccessOverlay({
          show: true,
          title: "Room Confirmed!",
          subtitle: "Continue from your dashboard to schedule a visit.",
        });
        appNavigate("/applicant/profile", {
          flash: {
            type: "success",
            title: "Room Confirmed!",
            message: "Continue from your dashboard to schedule a visit.",
          },
        });
      } else if (pendingStageAction === "stage4") {
        await queryClient.invalidateQueries({ queryKey: ["reservations"] });
        setSuccessOverlay({
          show: true,
          title: "Reservation Submitted!",
          subtitle: "Your reservation is being processed by admin.",
        });
        appNavigate("/applicant/profile", {
          flash: {
            type: "success",
            title: "Reservation Submitted!",
            message: "Your reservation is being processed by admin.",
          },
        });
      }
    } catch (error) {
      showNotification(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to process reservation. Please try again.",
        "error",
        3000,
      );
    }
    setPendingStageAction(null);
  };

  // ΓöÇΓöÇΓöÇ Return everything the page component needs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  return {
    // Navigation
    navigate,
    user,

    // Core state
    reservationData,
    currentStage,
    setCurrentStage,
    highestStageReached, setHighestStageReached,
    isLoading,
    paymentReturnLoading,
    visitApproved,
    visitCompleted, setVisitCompleted,
    scheduleRejected,
    scheduleRejectionReason,
    applicationSubmitted,
    editingApplication,
    paymentApproved,
    reservationId,
    devBypassValidation, setDevBypassValidation,
    payingOnline, setPayingOnline,
    successOverlay, setSuccessOverlay,

    // Stage 1
    targetMoveInDate, setTargetMoveInDate,
    leaseDuration, setLeaseDuration,
    billingEmail, setBillingEmail,

    // Stage 2
    viewingType, setViewingType,
    remoteViewingAcknowledged, setRemoteViewingAcknowledged,
    remoteViewingQuestions, setRemoteViewingQuestions,
    isUrgentMoveIn, setIsUrgentMoveIn,
    isOutOfTown, setIsOutOfTown,
    currentLocation, setCurrentLocation,
    visitorName, setVisitorName,
    visitorPhone, setVisitorPhone,
    visitorEmail, setVisitorEmail,
    visitDate, setVisitDate,
    visitTime, setVisitTime,

    // Stage 3
    selfiePhoto, setSelfiePhoto,
    firstName, setFirstName,
    lastName, setLastName,
    middleName, setMiddleName,
    nickname, setNickname,
    mobileNumber, setMobileNumber,
    birthday, setBirthday,
    gender, setGender,
    maritalStatus, setMaritalStatus,
    nationality, setNationality,
    educationLevel, setEducationLevel,
    addressUnitHouseNo, setAddressUnitHouseNo,
    addressStreet, setAddressStreet,
    addressRegion, setAddressRegion,
    addressBarangay, setAddressBarangay,
    addressCity, setAddressCity,
    addressProvince, setAddressProvince,
    validIDFront, setValidIDFront,
    validIDBack, setValidIDBack,
    validIDType, setValidIDType,
    idValidationResult,
    isValidatingId,
    documentPrechecks,
    runningDocumentChecks,
    nbiClearance, setNbiClearance,
    nbiReason, setNbiReason,
    personalNotes, setPersonalNotes,
    emergencyContactName, setEmergencyContactName,
    emergencyRelationship, setEmergencyRelationship,
    emergencyContactNumber, setEmergencyContactNumber,
    healthConcerns, setHealthConcerns,
    employerSchool, setEmployerSchool,
    employerAddress, setEmployerAddress,
    employerContact, setEmployerContact,
    startDate, setStartDate,
    occupation, setOccupation,
    companyID, setCompanyID,
    companyIDReason, setCompanyIDReason,
    previousEmployment, setPreviousEmployment,
    roomType,
    preferredRoomNumber, setPreferredRoomNumber,
    referralSource, setReferralSource,
    referrerName, setReferrerName,
    estimatedMoveInTime, setEstimatedMoveInTime,
    workSchedule, setWorkSchedule,
    workScheduleOther, setWorkScheduleOther,
    agreedToPrivacy, setAgreedToPrivacy,
    agreedToCertification, setAgreedToCertification,

    // Stage 4
    finalMoveInDate, setFinalMoveInDate,
    paymentMethod,
    paymentSubmitted,
    paymentAvailable: canReservationAccessPayment(
      normalizeReservationStatus(reservationData?.status),
    ),
    applicationReviewReason,
    agreedToFeePolicy, setAgreedToFeePolicy,

    // Stage 5
    reservationCode,
    visitCode, setVisitCode,

    // UI flags
    showLoginConfirm, setShowLoginConfirm,
    showCancelConfirm, setShowCancelConfirm,
    showStageConfirm,
    pendingStageAction,
    showValidationErrors,
    scrollToSection,
    saveStatus,
    saveStatusMessage: getApplicationSaveStatusText(
      saveStatus,
      lastApplicationDraftSavedAt,
    ),
    lastApplicationDraftSavedAt,
    hasUnsavedApplicationChanges,
    draftRecoveryMessage,
    isFormDirty,
    applicationAccessAllowed,
    physicalVisitApplicationLocked,
    roomSelectionLocked,
    viewingPreferenceStepAccess,

    // Stepper
    isStageLocked,
    isStageClickable,
    handleStepperClick,

    // Handlers
    handleNextStage,
    handlePrevStage,
    handleStageConfirm,
    validateApplicantIdDocument,
    runDocumentPrecheck,
    updateReservationDraft,
    returnToDashboardAfterViewingPreference,
    validateViewingPreferenceChange,
    forceEditMode,
    notifyRoomSelectionLocked,
    notifyViewingPreferenceLocked,
    setEditingApplication,
    setScrollToSection,
    setShowStageConfirm,
    setPendingStageAction,
    setShowValidationErrors,

    // Refs
    paymentVerifyingRef,
    justPaidRef,
    navigatingAwayRef,

    // Query client (for external cache invalidation)
    queryClient,
  };
}
