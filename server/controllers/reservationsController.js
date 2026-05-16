/**
 * ============================================================================
 * RESERVATION CONTROLLERS
 * ============================================================================
 *
 * Refactored to use shared helpers from reservationHelpers.js.
 * Eliminates ~200 lines of duplicated validation, error handling, and field mapping.
 */

import dayjs from "dayjs";

import {
  Reservation,
  User,
  Room,
  Bill,
  UtilityReading,
  BedHistory,
  Stay,
  ROOM_BRANCHES,
} from "../models/index.js";
import { BUSINESS } from "../config/constants.js";
import { isOwnerRole, isAdminRole, OWNER_ROLE_VALUES } from "../config/roles.js";
import logger from "../middleware/logger.js";
import auditLogger from "../utils/auditLogger.js";
import { updateOccupancyOnReservationChange } from "../utils/occupancyManager.js";
import { notify } from "../utils/notificationService.js";

import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
  checkBranchAccess,
  validateMoveInDate,
  handleStatusTransition,
  syncReservationUserLifecycle,
  reconcileTenantUsersForScope,
  buildUserUpdatePayload,
  getForbiddenTenantUpdateFields,
  getMoveInBlockers,
} from "../utils/reservationHelpers.js";
import {
  ACTIVE_OCCUPANCY_STATUS_QUERY,
  ACTIVE_STAY_STATUS_QUERY,
  canTransitionReservationStatus,
  CURRENT_RESIDENT_STATUS_QUERY,
  hasReservationStatus,
  normalizeReservationPayload,
  normalizeReservationStatus,
  readMoveInDate,
  readMoveOutDate,
  reservationStatusesForQuery,
  serializeReservation,
  serializeReservations,
  utilityEventTypesForQuery,
} from "../utils/lifecycleNaming.js";
import {
  sendReservationConfirmedEmail,
  sendVisitApprovedEmail,
  sendPhysicalVisitStatusEmail,
  sendDocumentsRejectedEmail,
} from "../config/email.js";
import {
  sendSuccess,
  sendError,
  AppError,
} from "../middleware/errorHandler.js";
import {
  buildBillingSummary,
  buildTenantWorkspaceEntry,
  buildTenantWorkspaceStats,
  computeLeaseEndDate,
} from "../utils/tenantWorkspace.js";
import {
  getTenantActionContext as loadTenantActionContext,
  moveOutStayWorkflow,
  renewStayWorkflow,
  transferStayWorkflow,
} from "../utils/tenantActionService.js";
import { ensureCurrentCycleRentBill } from "../utils/rentGenerator.js";
import { emitToUser } from "../utils/socket.js";
import {
  buildVisitAvailability,
  getVisitAvailabilitySettings,
  normalizeVisitBranch,
  serializeVisitAvailabilitySettings,
  updateVisitAvailabilitySettings,
  validateVisitSelection,
} from "../utils/visitAvailability.js";
import { ROOM_BRANCH_LABELS } from "../config/branches.js";
import {
  getBranchSettings,
  getBusinessSettings,
  RESERVATION_APPLIANCES,
} from "../utils/businessSettings.js";
import {
  isAllowedReservationDocumentUrl,
  runReservationDocumentPrecheck,
} from "../services/reservationDocumentPrecheckService.js";
/* ─── helpers ────────────────────────────────────── */
const HEAVY_FIELDS =
  "-selfiePhotoUrl -validIDFrontUrl -validIDBackUrl -nbiClearanceUrl -companyIDUrl -__v";
const ADMIN_LIST_FIELDS = [
  "_id",
  "reservationCode",
  "status",
  "paymentStatus",
  "createdAt",
  "moveInDate",
  "moveOutDate",
  "visitDate",
  "visitTime",
  "visitApproved",
  "visitScheduledAt",
  "scheduleApproved",
  "scheduleApprovedAt",
  "scheduleRejected",
  "scheduleRejectedAt",
  "scheduleRejectionReason",
  "visitStatus",
  "visitOutcomeNotes",
  "visitOutcomeUpdatedAt",
  "visitOutcomeUpdatedByName",
  "mobileNumber",
  "billingEmail",
  "viewingPreference",
  "viewingType",
  "remoteViewingAcknowledged",
  "remoteViewingQuestions",
  "isUrgentMoveIn",
  "isOutOfTown",
  "currentLocation",
  "visitHistory",
  "applicationSubmittedAt",
  "applicationReviewReason",
  "applicationReviewedAt",
  "approvedForPaymentAt",
  "cancelledAt",
  "cancelledBy",
  "cancellationSource",
  "cancellationReason",
  "cancellationRequested",
  "cancellationRequestedAt",
  "cancellationRequestedBy",
  "cancellationStatus",
  "cancellationReviewedAt",
  "cancellationReviewedBy",
  "cancellationAdminNote",
  "reservationFeeRefundable",
  "reservationFeeForfeited",
  "isArchived",
  "archivedAt",
  "idType",
  "validIDType",
].join(" ");
const POPULATE_USER = ["userId", "firstName lastName email phone"];
const POPULATE_ROOM = [
  "roomId",
  "name roomNumber branch type price monthlyPrice capacity currentOccupancy beds floor description images amenities policies intendedTenant",
];
const CURRENT_RESIDENT_FIELDS = [
  "_id",
  "reservationCode",
  "status",
  "paymentStatus",
  "moveInDate",
  "moveOutDate",
  "leaseDuration",
  "monthlyRent",
  "mobileNumber",
  "firstName",
  "lastName",
  "email",
  "gender",
  "nationality",
  "maritalStatus",
  "employment",
  "emergencyContact",
  "selectedBed",
  "userId",
  "roomId",
].join(" ");
const CURRENT_RESIDENT_USER = ["userId", "firstName lastName email phone"];
const CURRENT_RESIDENT_ROOM = ["roomId", "name roomNumber branch type price floor"];
const TENANT_WORKSPACE_FIELDS = [
  "_id",
  "reservationCode",
  "status",
  "paymentStatus",
  "moveInDate",
  "moveOutDate",
  "leaseDuration",
  "leaseExtensions",
  "monthlyRent",
  "currentStayId",
  "latestStayStatus",
  "mobileNumber",
  "firstName",
  "lastName",
  "email",
  "gender",
  "nationality",
  "maritalStatus",
  "employment",
  "emergencyContact",
  "selectedBed",
  "notes",
  "userId",
  "roomId",
].join(" ");

async function notifyAdminsOfCancellationRequest(reservation, dbUser) {
  const room = await Room.findById(reservation.roomId).select("branch").lean();
  const adminRecipients = room?.branch
    ? [
        { role: "branch_admin", branch: room.branch },
        { role: "owner" },
      ]
    : [
        { role: "branch_admin" },
        { role: "owner" },
      ];

  const adminUsers = await User.find({
    $or: adminRecipients,
    accountStatus: "active",
    isArchived: { $ne: true },
  }).select("_id").lean();

  const tenantName = `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() || dbUser.email;
  await Promise.all(
    adminUsers.map(async (admin) => {
      const notification = await notify.cancellationRequestAlert(
        admin._id,
        tenantName,
        reservation.reservationCode,
        reservation._id,
      );
      if (notification) {
        emitToUser(admin._id, "notification:new", notification);
      }
    }),
  );
}
const TENANT_WORKSPACE_USER = [
  "userId",
  "firstName lastName email phone role tenantStatus branch",
];
const TENANT_WORKSPACE_ROOM = ["roomId", "name roomNumber branch type price floor"];
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const BED_UNAVAILABLE_MESSAGE =
  "This bed is no longer available. Please select another bed.";
const VIEWING_PREFERENCES = Object.freeze([
  "physical_visit",
  "remote_2d_viewing",
  "urgent_move_in_review",
]);
const LEGACY_VISIT_STATUSES = Object.freeze(
  reservationStatusesForQuery("visit_pending", "visit_approved"),
);
const PAYMENT_GATED_STATUSES = Object.freeze(
  reservationStatusesForQuery("approved_for_payment", "payment_pending"),
);
const MAX_REMOTE_VIEWING_QUESTION_LENGTH = 1500;
const MAX_APPLICATION_REVIEW_REASON_LENGTH = 1500;
const MAX_VISIT_MANAGEMENT_NOTE_LENGTH = 1500;
const VISIT_MANAGEMENT_ACTIONS = Object.freeze([
  "approve_schedule",
  "reject_schedule",
  "mark_visited",
  "mark_no_show",
  "reschedule",
  "cancel_visit",
  "allow_without_visit",
]);
const VISIT_OUTCOME_STATUSES = Object.freeze([
  "physical_visit_scheduled",
  "schedule_approved",
  "visit_completed",
  "no_show",
  "rescheduled",
  "visit_cancelled",
  "allowed_without_visit",
]);
const VISIT_STATUS_ALIASES = Object.freeze({
  scheduled: "physical_visit_scheduled",
  completed: "visit_completed",
  cancelled: "visit_cancelled",
  not_required: "allowed_without_visit",
});
const VISIT_APPLICATION_UNLOCK_STATUSES = Object.freeze([
  "visit_completed",
  "allowed_without_visit",
]);
const VISIT_MANAGEMENT_ACTIONS_BY_STATUS = Object.freeze({
  // Submitted by applicant, awaiting admin review — outcome actions not yet available
  physical_visit_scheduled: Object.freeze([
    "approve_schedule",
    "reject_schedule",
    "reschedule",
    "cancel_visit",
    "allow_without_visit",
  ]),
  // Admin approved the schedule — outcome actions now available
  schedule_approved: Object.freeze([
    "mark_visited",
    "mark_no_show",
    "reschedule",
    "cancel_visit",
    "allow_without_visit",
  ]),
  // Admin rescheduled — awaiting re-approval before outcome can be recorded
  rescheduled: Object.freeze([
    "approve_schedule",
    "reject_schedule",
    "reschedule",
    "cancel_visit",
    "allow_without_visit",
  ]),
  no_show: Object.freeze(["reschedule", "allow_without_visit"]),
  visit_cancelled: Object.freeze(["reschedule", "allow_without_visit"]),
  visit_completed: Object.freeze([]),
  allowed_without_visit: Object.freeze([]),
});
const DOCUMENT_PRECHECK_TYPES = Object.freeze({
  selfie_photo: {
    reservationField: "selfiePhotoUrl",
    precheckField: "selfiePhoto",
  },
  valid_id_front: {
    reservationField: "validIDFrontUrl",
    precheckField: "validIDFront",
    requiresIdType: true,
  },
  valid_id_back: {
    reservationField: "validIDBackUrl",
    precheckField: "validIDBack",
    requiresIdType: true,
  },
  nbi_clearance: {
    reservationField: "nbiClearanceUrl",
    precheckField: "nbiClearance",
  },
  company_id: {
    reservationField: "companyIDUrl",
    precheckField: "companyID",
  },
});
const DOCUMENT_PRECHECK_LABELS = Object.freeze({
  selfie_photo: "Selfie Photo",
  valid_id_front: "Valid ID (Front)",
  valid_id_back: "Valid ID (Back)",
  nbi_clearance: "NBI Clearance",
  company_id: "Company ID",
});
const ACTIVE_BED_HOLD_STATUSES = Object.freeze(
  reservationStatusesForQuery(
    "pending",
    "viewing_preference_selected",
    "visit_pending",
    "visit_approved",
    "pending_application_review",
    "needs_revision",
    "approved_for_payment",
    "payment_pending",
    "reserved",
    "moveIn",
  ),
);
const APPLICANT_CREATE_ALLOWED_FIELDS = Object.freeze([
  "roomId",
  "roomName",
  "roomNumber",
  "selectedBed",
  "selectedAppliances",
  "targetMoveInDate",
  "leaseDuration",
  "billingEmail",
  "roomConfirmed",
  "viewingPreference",
  "viewingType",
  "visitDate",
  "visitTime",
  "visitScheduledAt",
  "remoteViewingAcknowledged",
  "remoteViewingQuestions",
  "isUrgentMoveIn",
  "isOutOfTown",
  "currentLocation",
  "selfiePhotoUrl",
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
  "addressRegion",
  "addressUnitHouseNo",
  "addressStreet",
  "addressBarangay",
  "addressCity",
  "addressProvince",
  "validIDFrontUrl",
  "validIDBackUrl",
  "validIDType",
  "idType",
  "nbiClearanceUrl",
  "nbiReason",
  "companyIDUrl",
  "companyIDReason",
  "personalNotes",
  "emergencyContactName",
  "emergencyRelationship",
  "emergencyContactNumber",
  "healthConcerns",
  "employerSchool",
  "employerAddress",
  "employerContact",
  "startDate",
  "occupation",
  "previousEmployment",
  "roomType",
  "preferredRoomNumber",
  "referralSource",
  "referrerName",
  "estimatedMoveInTime",
  "workSchedule",
  "workScheduleOther",
  "agreedToPrivacy",
  "agreedToCertification",
  "moveInDate",
  "notes",
]);
const CLIENT_PRICING_FIELDS = Object.freeze([
  "totalPrice",
  "reservationFee",
  "reservationFeeAmount",
  "amount",
  "fees",
  "applianceFees",
  "monthlyRent",
  "deposit",
]);

const normalizeViewingPreferenceInput = (value, fallback = null) => {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();

  if (VIEWING_PREFERENCES.includes(normalized)) {
    return normalized;
  }
  if (normalized === "inperson" || normalized === "physical") {
    return "physical_visit";
  }
  if (normalized === "remote" || normalized === "remote_2d" || normalized === "photo_based") {
    return "remote_2d_viewing";
  }
  if (normalized === "urgent" || normalized === "urgent_move_in") {
    return "urgent_move_in_review";
  }

  return null;
};

const normalizeDocumentPrecheckType = (value) => {
  if (value == null || value === "") return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (DOCUMENT_PRECHECK_TYPES[normalized]) return normalized;
  if (normalized === "valididfront") return "valid_id_front";
  if (normalized === "valididback") return "valid_id_back";
  if (normalized === "nbiclearance") return "nbi_clearance";
  if (normalized === "companyid" || normalized === "school_id")
    return "company_id";
  if (normalized === "selfie" || normalized === "selfiephoto")
    return "selfie_photo";
  return null;
};

const buildEmptyDocumentPrecheck = () => ({
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

const mapAiStatusToLegacyValidationStatus = (precheckOrStatus) => {
  const precheckStatus = precheckOrStatus?.precheckStatus;
  if (precheckStatus === "ready_for_submission") return "passed";
  if (precheckStatus === "needs_reupload") return "failed";
  if (precheckStatus === "manual_review_fallback") return "manual_review";

  const aiCheckStatus =
    typeof precheckOrStatus === "string"
      ? precheckOrStatus
      : precheckOrStatus?.aiCheckStatus;
  if (aiCheckStatus === "passed") return "passed";
  if (aiCheckStatus === "failed") return "failed";
  return "manual_review";
};

const getDocumentPrecheckStatus = (precheck = {}) => {
  const normalized = String(precheck?.precheckStatus || "").trim();
  if (normalized && normalized !== "not_checked") return normalized;
  if (precheck?.aiCheckStatus === "passed") return "ready_for_submission";
  if (precheck?.aiCheckStatus === "failed" || precheck?.aiCheckStatus === "warning")
    return "needs_reupload";
  if (precheck?.aiCheckStatus === "error") return "manual_review_fallback";
  return "not_checked";
};

const shouldBlockDocumentSubmission = (precheck = {}) => {
  const status = getDocumentPrecheckStatus(precheck);
  if (status === "manual_review_fallback") {
    return false;
  }

  return (
    status === "needs_reupload" ||
    precheck?.readabilityStatus === "low_readability" ||
    precheck?.readabilityStatus === "unreadable" ||
    precheck?.documentTypeStatus === "possible_mismatch" ||
    precheck?.canSubmit === false
  );
};

const deriveViewingPreference = (reservation, updates = {}) =>
  normalizeViewingPreferenceInput(
    updates.viewingPreference ??
      reservation?.viewingPreference ??
      updates.viewingType ??
      reservation?.viewingType,
    (updates.visitDate || reservation?.visitDate) ? "physical_visit" : null,
  );

const deriveViewingType = (viewingPreference) => {
  if (viewingPreference === "physical_visit") return "inperson";
  if (viewingPreference === "remote_2d_viewing") return "remote_2d";
  if (viewingPreference === "urgent_move_in_review") return "urgent_move_in";
  return null;
};

const shouldAllowPaymentAccess = (status) =>
  hasReservationStatus(status, PAYMENT_GATED_STATUSES);

const hasSubmittedField = (body, field) =>
  Object.prototype.hasOwnProperty.call(body || {}, field);

const pickAllowedFields = (source = {}, allowedFields = []) =>
  allowedFields.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const TRUSTED_RESERVATION_APPLIANCES = Object.freeze(
  RESERVATION_APPLIANCES.map((appliance) => ({
    id: String(appliance.id || "").trim().toLowerCase(),
    name: String(appliance.name || "").trim(),
  })).filter((appliance) => appliance.id && appliance.name),
);
const TRUSTED_RESERVATION_APPLIANCE_MAP = new Map(
  TRUSTED_RESERVATION_APPLIANCES.map((appliance) => [appliance.id, appliance]),
);

const normalizeSelectedApplianceEntries = (selectedAppliances) => {
  if (selectedAppliances == null) return [];

  if (Array.isArray(selectedAppliances)) {
    return selectedAppliances.map((entry) => ({
      id: entry?.id ?? entry?.applianceId,
      quantity: entry?.quantity,
    }));
  }

  if (
    typeof selectedAppliances === "object" &&
    selectedAppliances.constructor === Object
  ) {
    return Object.entries(selectedAppliances).map(([id, quantity]) => ({
      id,
      quantity,
    }));
  }

  throw new AppError(
    "Invalid selected appliances payload.",
    400,
    "INVALID_SELECTED_APPLIANCES",
  );
};

const validateSelectedAppliancesForReservation = ({
  selectedAppliances,
  branchId,
  branchSettings,
}) => {
  const normalizedBranchId = String(branchId || "").toLowerCase();
  const applianceFeesEnabled =
    normalizedBranchId === "guadalupe" && branchSettings?.isApplianceFeeEnabled;

  if (!applianceFeesEnabled) {
    return [];
  }

  const entries = normalizeSelectedApplianceEntries(selectedAppliances);
  const validatedAppliances = [];
  const quantitiesById = new Map();

  for (const entry of entries) {
    const applianceId = String(entry?.id || "").trim().toLowerCase();
    const trustedAppliance = TRUSTED_RESERVATION_APPLIANCE_MAP.get(applianceId);

    if (!trustedAppliance) {
      throw new AppError(
        "Unknown appliance selection. Please review your appliance choices and try again.",
        400,
        "INVALID_APPLIANCE_ID",
      );
    }

    if (!Number.isInteger(entry?.quantity) || entry.quantity < 0) {
      throw new AppError(
        `Invalid quantity for ${trustedAppliance.name}. Quantity must be a non-negative whole number.`,
        400,
        "INVALID_APPLIANCE_QUANTITY",
      );
    }

    quantitiesById.set(
      applianceId,
      (quantitiesById.get(applianceId) || 0) + entry.quantity,
    );
  }

  for (const appliance of TRUSTED_RESERVATION_APPLIANCES) {
    const quantity = quantitiesById.get(appliance.id) || 0;
    if (quantity > 0) {
      validatedAppliances.push({
        id: appliance.id,
        name: appliance.name,
        quantity,
      });
    }
  }

  return validatedAppliances;
};

const resolveReservationRent = ({ room, leaseDuration }) => {
  const parsedLeaseDuration = Number(leaseDuration);
  const roomPrice = Number(room?.price ?? 0);
  const roomMonthlyPrice = Number(room?.monthlyPrice ?? room?.price ?? 0);
  const shouldUseMonthlyPrice =
    Number.isFinite(parsedLeaseDuration) && parsedLeaseDuration >= 6;

  const preferredRent = shouldUseMonthlyPrice ? roomMonthlyPrice : roomPrice;
  if (Number.isFinite(preferredRent) && preferredRent >= 0) {
    return roundMoney(preferredRent);
  }

  const fallbackRent = shouldUseMonthlyPrice ? roomPrice : roomMonthlyPrice;
  return Number.isFinite(fallbackRent) && fallbackRent >= 0
    ? roundMoney(fallbackRent)
    : 0;
};

const buildReservationPricing = async ({
  room,
  leaseDuration,
  selectedAppliances,
}) => {
  const settings = await getBusinessSettings();
  const branchId = String(room?.branch || "").toLowerCase();
  const branchSettings = getBranchSettings(branchId, settings);
  const monthlyRent = resolveReservationRent({ room, leaseDuration });
  const validatedSelectedAppliances = validateSelectedAppliancesForReservation({
    selectedAppliances,
    branchId,
    branchSettings,
  });
  const totalApplianceQuantity = validatedSelectedAppliances.reduce(
    (total, appliance) => total + appliance.quantity,
    0,
  );
  const applianceFeeAmountPerUnit = roundMoney(
    Number(branchSettings?.applianceFeeAmountPerUnit ?? 0),
  );
  const applianceFees =
    branchId === "guadalupe" && branchSettings?.isApplianceFeeEnabled
      ? roundMoney(applianceFeeAmountPerUnit * totalApplianceQuantity)
      : 0;
  const totalPrice = roundMoney(monthlyRent + applianceFees);
  const reservationFeeAmount = roundMoney(
    settings?.reservationFeeAmount ?? BUSINESS.DEPOSIT_AMOUNT,
  );

  return {
    selectedAppliances: validatedSelectedAppliances,
    monthlyRent,
    applianceFees,
    totalPrice,
    reservationFeeAmount,
    breakdown: {
      monthlyRent,
      selectedAppliances: validatedSelectedAppliances,
      applianceFees,
      totalPrice,
      reservationFeeAmount,
      branchId,
      branchName: ROOM_BRANCH_LABELS[branchId] || room?.branch || "",
      pricingSource: {
        roomPrice: roundMoney(Number(room?.price ?? 0)),
        roomMonthlyPrice: roundMoney(
          Number(room?.monthlyPrice ?? room?.price ?? 0),
        ),
        leaseDuration: Number.isFinite(Number(leaseDuration))
          ? Number(leaseDuration)
          : null,
      },
      appliancePolicy: {
        branch: branchId,
        enabled: !!branchSettings?.isApplianceFeeEnabled,
        amountPerUnit: applianceFeeAmountPerUnit,
        selectedQuantity: totalApplianceQuantity,
        appliedAmount: applianceFees,
      },
      authoritative: true,
      ignoredClientFields: CLIENT_PRICING_FIELDS,
    },
  };
};

const loadReservableRoom = async ({ roomId, roomNumber, roomName }) => {
  if (roomId) {
    return Room.findById(roomId);
  }

  const legacyRoomFilter = { isArchived: false };
  if (roomNumber) {
    legacyRoomFilter.roomNumber = roomNumber;
  } else {
    legacyRoomFilter.name = roomName;
  }

  const matchedRooms = await Room.find(legacyRoomFilter).limit(2);
  if (matchedRooms.length > 1) {
    throw new AppError(
      "Room reference is ambiguous. Please retry using the room ID or branch-scoped room number.",
      400,
      "AMBIGUOUS_ROOM_REFERENCE",
    );
  }

  return matchedRooms[0] || null;
};

const ensureRoomReservationCapacity = async ({
  roomId,
  excludeReservationId = null,
}) => {
  const query = {
    roomId,
    status: {
      $in: reservationStatusesForQuery(
        "pending",
        "viewing_preference_selected",
        "visit_pending",
        "visit_approved",
        "pending_application_review",
        "needs_revision",
        "approved_for_payment",
        "payment_pending",
        "reserved",
        "moveIn",
      ),
    },
    isArchived: { $ne: true },
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  return Reservation.countDocuments(query);
};

const findActiveBedReservationConflict = async ({
  roomId,
  bedId,
  excludeReservationId = null,
}) => {
  if (!roomId || !bedId) return null;

  const query = {
    roomId,
    "selectedBed.id": String(bedId),
    status: { $in: ACTIVE_BED_HOLD_STATUSES },
    isArchived: { $ne: true },
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  return Reservation.findOne(query).select("_id status selectedBed").lean();
};

const isActiveBedAssignmentDuplicateError = (error) => {
  if (!error || error.code !== 11000) return false;

  const selectedBedKey =
    error?.keyPattern?.["selectedBed.id"] ||
    error?.keyValue?.["selectedBed.id"] ||
    String(error?.message || "").includes("unique_active_room_bed_assignment");

  return Boolean(error?.keyPattern?.roomId && selectedBedKey);
};

const validateSelectedBedForReservation = async ({
  room,
  submittedBed,
  excludeReservationId = null,
  requireBedSelection = Array.isArray(room?.beds) && room.beds.length > 0,
}) => {
  if (!room) {
    throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
  }

  const unlockedCount =
    typeof room.unlockExpiredBeds === "function" ? room.unlockExpiredBeds() : 0;
  if (unlockedCount > 0) {
    await room.save();
  }

  if (!submittedBed?.id) {
    if (requireBedSelection) {
      throw new AppError(
        "Please select an available bed to continue.",
        400,
        "BED_SELECTION_REQUIRED",
      );
    }
    return null;
  }

  const roomBed = (room.beds || []).find(
    (bed) => String(bed.id || bed._id) === String(submittedBed.id),
  );

  if (!roomBed) {
    throw new AppError(BED_UNAVAILABLE_MESSAGE, 409, "BED_NOT_FOUND");
  }

  if (roomBed.status !== "available") {
    throw new AppError(BED_UNAVAILABLE_MESSAGE, 409, "BED_UNAVAILABLE");
  }

  const conflictingReservation = await findActiveBedReservationConflict({
    roomId: room._id,
    bedId: roomBed.id || roomBed._id,
    excludeReservationId,
  });

  if (conflictingReservation) {
    throw new AppError(BED_UNAVAILABLE_MESSAGE, 409, "BED_UNAVAILABLE");
  }

  return {
    id: roomBed.id || String(roomBed._id),
    position: roomBed.position || submittedBed.position || null,
  };
};

const combineLifecycleDateTime = ({
  dateInput,
  timeInput,
  fallbackDate = new Date(),
}) => {
  const base = dateInput ? new Date(dateInput) : new Date(fallbackDate);
  if (Number.isNaN(base.getTime())) return null;

  if (timeInput == null || timeInput === "") {
    return base;
  }

  const text = String(timeInput).trim();
  const match = TIME_24H_REGEX.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  base.setHours(hours, minutes, 0, 0);
  return base;
};

const getResidentStatus = (reservation, now = new Date()) => {
  let statusLabel = "Active";

  if (
    reservation.paymentStatus === "pending" ||
    reservation.paymentStatus === "partial"
  ) {
    statusLabel = "Overdue";
  }

  const moveOutDate = readMoveOutDate(reservation);
  if (moveOutDate) {
    const daysLeft = Math.ceil(
      (new Date(moveOutDate) - now) / 86_400_000,
    );
    if (daysLeft <= 30 && daysLeft > 0) statusLabel = "Moving Out";
    if (daysLeft <= 0) statusLabel = "Overdue";
  }

  return statusLabel;
};

const mapCurrentResident = (reservation, now = new Date()) => {
  const serialized = serializeReservation(reservation);
  return {
    ...serialized,
    statusLabel: getResidentStatus(reservation, now),
  };
};

const buildResidentStats = (residents) => ({
  total: residents.length,
  active: residents.filter((resident) => resident.statusLabel === "Active")
    .length,
  overdue: residents.filter((resident) => resident.statusLabel === "Overdue")
    .length,
  movingOut: residents.filter(
    (resident) => resident.statusLabel === "Moving Out",
  ).length,
});

const buildWorkspaceRoomQuery = async ({ dbUser, requestedBranch }) => {
  if (
    requestedBranch &&
    requestedBranch !== "all" &&
    !ROOM_BRANCHES.includes(requestedBranch)
  ) {
    throw new AppError(
      `Invalid branch. Must be one of: ${ROOM_BRANCHES.join(", ")}`,
      400,
      "INVALID_BRANCH",
    );
  }

  if (dbUser.role === "branch_admin") {
    return { branch: dbUser.branch };
  }

  if (requestedBranch && requestedBranch !== "all") {
    return { branch: requestedBranch };
  }

  return {};
};

const getTenantWorkspaceReservations = async ({ roomQuery }) => {
  const roomIds = await Room.find(roomQuery).distinct("_id");
  return Reservation.find({
    status: { $in: reservationStatusesForQuery("moveIn", "moveOut") },
    roomId: { $in: roomIds },
    isArchived: { $ne: true },
  })
    .select(TENANT_WORKSPACE_FIELDS)
    .populate(...TENANT_WORKSPACE_USER)
    .populate(...TENANT_WORKSPACE_ROOM)
    .sort({ updatedAt: -1, moveInDate: -1 })
    .lean();
};

const buildWorkspaceEntries = async (reservations, now = new Date()) => {
  const visibleReservations = reservations.filter((reservation) => {
    const tenantUser = reservation?.userId;
    return Boolean(tenantUser && tenantUser.role === "tenant");
  });

  const reservationIds = visibleReservations.map((reservation) => reservation._id);
  const tenantIds = visibleReservations
    .map((reservation) => reservation.userId?._id || reservation.userId)
    .filter(Boolean);
  const branchSet = [
    ...new Set(
      visibleReservations
        .map((reservation) => reservation.roomId?.branch)
        .filter(Boolean),
    ),
  ];

  const [bills, bedHistoryRecords, stays, branchRooms] = await Promise.all([
    Bill.find({
      reservationId: { $in: reservationIds },
      isArchived: { $ne: true },
    }).lean(),
    BedHistory.find({
      $or: [
        { reservationId: { $in: reservationIds } },
        { tenantId: { $in: tenantIds } },
      ],
    })
      .populate("roomId", "name branch")
      .sort({ moveInDate: -1 })
      .lean(),
    Stay.find({
      reservationId: { $in: reservationIds },
    })
      .sort({ leaseStartDate: -1, createdAt: -1 })
      .lean(),
    Room.find({
      branch: { $in: branchSet },
      isArchived: { $ne: true },
    })
      .select("branch _id beds")
      .lean(),
  ]);

  const billsByReservationId = new Map();
  for (const bill of bills) {
    const key = String(bill.reservationId || "");
    if (!key) continue;
    if (!billsByReservationId.has(key)) billsByReservationId.set(key, []);
    billsByReservationId.get(key).push(bill);
  }

  const historyByReservationId = new Map();
  const historyByTenantId = new Map();
  const staysByReservationId = new Map();
  const branchAvailability = new Map();
  for (const record of bedHistoryRecords) {
    if (record.reservationId) {
      const reservationKey = String(record.reservationId);
      if (!historyByReservationId.has(reservationKey)) {
        historyByReservationId.set(reservationKey, []);
      }
      historyByReservationId.get(reservationKey).push(record);
    }

    if (record.tenantId) {
      const tenantKey = String(record.tenantId);
      if (!historyByTenantId.has(tenantKey)) historyByTenantId.set(tenantKey, []);
      historyByTenantId.get(tenantKey).push(record);
    }
  }
  for (const stay of stays) {
    const reservationKey = String(stay.reservationId || "");
    if (!reservationKey) continue;
    if (!staysByReservationId.has(reservationKey)) staysByReservationId.set(reservationKey, []);
    staysByReservationId.get(reservationKey).push(stay);
  }
  for (const room of branchRooms) {
    const branchKey = String(room.branch || "");
    const availableBeds = (room.beds || []).filter((bed) => bed.status === "available");
    if (!branchAvailability.has(branchKey)) branchAvailability.set(branchKey, []);
    branchAvailability.get(branchKey).push({
      roomId: String(room._id),
      bedIds: availableBeds.map((bed) => bed.id || String(bed._id)),
    });
  }

  return visibleReservations.map((reservation) => {
    const reservationKey = String(reservation._id);
    const tenantKey = String(reservation.userId?._id || reservation.userId || "");
    const stayHistory = staysByReservationId.get(reservationKey) || [];
    const currentStay =
      stayHistory.find((stay) => stay.status === "active") ||
      stayHistory[0] ||
      null;
    const branchRoomsForReservation = branchAvailability.get(String(reservation.roomId?.branch || "")) || [];
    const hasAvailableBedsInBranch = branchRoomsForReservation.some(
      (room) =>
        room.bedIds.length > 0 &&
        (room.roomId !== String(currentStay?.roomId || reservation.roomId?._id || "") ||
          room.bedIds.some((bedId) => String(bedId) !== String(currentStay?.bedId || reservation.selectedBed?.id || ""))),
    );
    return buildTenantWorkspaceEntry({
      reservation,
      currentStay,
      stayHistory,
      bills: billsByReservationId.get(reservationKey) || [],
      bedHistoryRecords:
        historyByReservationId.get(reservationKey) ||
        historyByTenantId.get(tenantKey) ||
        [],
      tenantStatus: reservation.userId?.tenantStatus || "applicant",
      hasAvailableBedsInBranch,
      now,
    });
  });
};

/* ── Cached user lookup (saves ~50-100ms per API call) ──── */
const userCache = new Map();
const USER_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const findDbUser = async (uid) => {
  const cached = userCache.get(uid);
  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) return cached.user;
  const user = await User.findOne({ firebaseUid: uid });
  if (user) userCache.set(uid, { user, ts: Date.now() });
  // Evict if too large
  if (userCache.size > 200) {
    const oldest = userCache.keys().next().value;
    userCache.delete(oldest);
  }
  return user;
};

/** Invalidate a cached user entry (call when user data changes) */
export const invalidateUserCache = (uid) => userCache.delete(uid);

const buildActorDisplayName = (user, fallbackEmail = "") => {
  const fullName =
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return fullName || user?.email || fallbackEmail || "Admin";
};

const normalizeVisitManagementNote = (value) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > MAX_VISIT_MANAGEMENT_NOTE_LENGTH) {
    const error = new Error(
      `Visit remarks must be ${MAX_VISIT_MANAGEMENT_NOTE_LENGTH} characters or fewer.`,
    );
    error.statusCode = 400;
    error.code = "VISIT_NOTE_TOO_LONG";
    throw error;
  }
  return normalized;
};

const hasPhysicalVisitPreference = (reservation) =>
  reservation?.viewingPreference === "physical_visit" ||
  reservation?.viewingType === "inperson" ||
  Boolean(reservation?.visitDate);

const appendVisitHistoryEntry = ({
  reservation,
  status,
  actorId = null,
  actorName = "",
  note = "",
  updatedAt = new Date(),
  visitDate = null,
  visitTime = "",
  rescheduledToDate = null,
  rescheduledToTime = "",
}) => {
  if (!reservation.visitHistory) reservation.visitHistory = [];
  reservation.visitHistory.push({
    visitDate: visitDate || reservation.visitDate || null,
    visitTime: visitTime || reservation.visitTime || "",
    viewingType: reservation.viewingType || "inperson",
    status,
    notes: note || "",
    scheduledAt: reservation.visitScheduledAt || reservation.createdAt || updatedAt,
    updatedAt,
    updatedBy: actorId || null,
    updatedByName: actorName || "",
    rescheduledToDate: rescheduledToDate || null,
    rescheduledToTime: rescheduledToTime || "",
  });
};

const applyVisitOutcome = ({
  reservation,
  status,
  actorId = null,
  actorName = "",
  note = "",
  updatedAt = new Date(),
}) => {
  reservation.visitStatus = status;
  reservation.visitOutcomeNotes = note;
  reservation.visitOutcomeUpdatedAt = updatedAt;
  reservation.visitOutcomeUpdatedBy = actorId || null;
  reservation.visitOutcomeUpdatedByName = actorName || "";
};

const normalizeVisitStatusKey = (value) => {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  const canonical = VISIT_STATUS_ALIASES[normalized] || normalized;
  return VISIT_OUTCOME_STATUSES.includes(canonical) ? canonical : "";
};

const isVisitApplicationUnlocked = (visitStatus) =>
  VISIT_APPLICATION_UNLOCK_STATUSES.includes(normalizeVisitStatusKey(visitStatus));

const getEffectiveVisitStatusKey = (reservation = {}) => {
  const explicit = normalizeVisitStatusKey(reservation.visitStatus);
  if (explicit) return explicit;
  if (reservation.visitApproved) return "visit_completed";
  if (reservation.scheduleRejected) return "visit_cancelled";
  // Backfill: old records have scheduleApproved=true but no visitStatus written —
  // treat them as schedule_approved so outcome actions are available.
  if (reservation.scheduleApproved) return "schedule_approved";
  if (hasPhysicalVisitPreference(reservation)) return "physical_visit_scheduled";
  return "";
};

const visitTransitionError = (error, code = "INVALID_VISIT_STATUS_TRANSITION") => ({
  ok: false,
  status: 409,
  code,
  error,
});

const validateVisitManagementAction = (reservation, action) => {
  const currentStatus = getEffectiveVisitStatusKey(reservation);
  const allowedActions =
    VISIT_MANAGEMENT_ACTIONS_BY_STATUS[currentStatus] ||
    VISIT_MANAGEMENT_ACTIONS_BY_STATUS.physical_visit_scheduled;

  if (allowedActions.includes(action)) {
    return { ok: true, currentStatus };
  }

  if (currentStatus === "visit_completed") {
    return visitTransitionError(
      "Visit is already completed and cannot be changed.",
      "VISIT_ALREADY_COMPLETED",
    );
  }

  if (currentStatus === "no_show" && action === "mark_visited") {
    return visitTransitionError(
      "Visit is already marked as no-show. Reschedule the visit or allow the applicant to proceed without a visit.",
    );
  }

  if (currentStatus === "visit_cancelled" && action !== "reschedule") {
    return visitTransitionError(
      "Visit schedule is already cancelled. Reschedule the visit before recording an outcome.",
    );
  }

  if (currentStatus === "allowed_without_visit") {
    return visitTransitionError(
      "Applicant has already been allowed to proceed without a visit.",
    );
  }

  return visitTransitionError("This visit action is not valid for the current visit status.");
};

const validateDirectVisitUpdate = (reservation, body = {}) => {
  const visitFields = [
    "visitStatus",
    "visitApproved",
    "scheduleApproved",
    "scheduleRejected",
    "visitDate",
    "visitTime",
  ];
  if (!visitFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    return { ok: true };
  }

  const currentStatus = getEffectiveVisitStatusKey(reservation);
  const nextStatus =
    Object.prototype.hasOwnProperty.call(body, "visitStatus")
      ? normalizeVisitStatusKey(body.visitStatus)
      : currentStatus;

  if (
    body.visitStatus !== undefined &&
    body.visitStatus !== null &&
    body.visitStatus !== "" &&
    !nextStatus
  ) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_VISIT_STATUS",
      error: "Invalid visit status.",
    };
  }

  if (Object.prototype.hasOwnProperty.call(body, "visitStatus")) {
    body.visitStatus = nextStatus || null;
  }

  const changesCompletedVisit =
    currentStatus === "visit_completed" &&
    ((Object.prototype.hasOwnProperty.call(body, "visitStatus") &&
      nextStatus !== "visit_completed") ||
      body.visitApproved === false ||
      body.scheduleRejected === true ||
      Object.prototype.hasOwnProperty.call(body, "visitDate") ||
      Object.prototype.hasOwnProperty.call(body, "visitTime"));

  if (changesCompletedVisit) {
    return visitTransitionError(
      "Visit is already completed and cannot be changed.",
      "VISIT_ALREADY_COMPLETED",
    );
  }

  if (
    currentStatus === "no_show" &&
    (nextStatus === "visit_completed" || body.visitApproved === true)
  ) {
    return visitTransitionError(
      "Visit is already marked as no-show. Reschedule the visit before recording a completed outcome.",
    );
  }

  if (
    currentStatus === "visit_cancelled" &&
    (nextStatus === "visit_completed" ||
      nextStatus === "no_show" ||
      body.visitApproved === true)
  ) {
    return visitTransitionError(
      "Visit schedule is already cancelled. Reschedule the visit before recording an outcome.",
    );
  }

  return { ok: true };
};

const buildVisitEmailContext = ({
  reservation,
  status,
  previousVisitDate = null,
  previousVisitTime = "",
  note = "",
}) => {
  const usePreviousSchedule =
    status === "visit_cancelled" &&
    !reservation.visitDate &&
    (previousVisitDate || previousVisitTime);

  return {
    to: reservation.userId?.email || "",
    tenantName:
      `${reservation.userId?.firstName || ""} ${reservation.userId?.lastName || ""}`.trim() ||
      reservation.userId?.email ||
      "Applicant",
    roomName:
      reservation.roomId?.roomNumber ||
      reservation.roomId?.name ||
      reservation.roomName ||
      "your room",
    branchName: reservation.roomId?.branch || reservation.branch || "Lilycrest",
    visitCode: reservation.visitCode || "",
    visitDate: usePreviousSchedule ? previousVisitDate : reservation.visitDate || null,
    visitTime: usePreviousSchedule ? previousVisitTime : reservation.visitTime || "",
    previousVisitDate,
    previousVisitTime,
    remarks: note || "",
    status,
  };
};

const buildVisitAvailabilityActor = (req, dbUser) => ({
  userId: dbUser?._id ? String(dbUser._id) : req?.user?.uid || null,
  email: dbUser?.email || req?.user?.email || "",
  role: dbUser?.role || req?.user?.role || "",
});

const resolveVisitAvailabilityBranch = (req, dbUser, fallbackBranch = "") => {
  const requestedBranch = normalizeVisitBranch(
    req.query.branch || req.body.branch || fallbackBranch,
  );

  if (!requestedBranch) {
    return { error: "A valid branch is required.", code: "INVALID_BRANCH" };
  }

  if (dbUser?.role === "branch_admin" && requestedBranch !== dbUser.branch) {
    return {
      error: `Access denied. You can only manage ${dbUser.branch} branch availability.`,
      code: "BRANCH_ACCESS_DENIED",
    };
  }

  return { branch: requestedBranch };
};

export const getVisitAvailability = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const availability = await buildVisitAvailability({
      branch: branchResult.branch,
      from: req.query.from,
      days: req.query.days,
      roomId: req.query.roomId || null,
      excludeReservationId: req.query.reservationId || null,
    });

    return sendSuccess(res, availability);
  } catch (error) {
    next(error);
  }
};

export const getVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const settings = await getVisitAvailabilitySettings(branchResult.branch);
    return sendSuccess(res, serializeVisitAvailabilitySettings(settings));
  } catch (error) {
    next(error);
  }
};

export const updateVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const beforeSettings = await getVisitAvailabilitySettings(branchResult.branch);
    const beforePayload = serializeVisitAvailabilitySettings(beforeSettings);
    const settings = await updateVisitAvailabilitySettings(
      branchResult.branch,
      req.body || {},
      buildVisitAvailabilityActor(req, dbUser),
    );
    const afterPayload = serializeVisitAvailabilitySettings(settings);

    await auditLogger.logModification(
      req,
      "visit_availability",
      branchResult.branch,
      beforePayload,
      afterPayload,
      "Updated visit availability rules",
    );

    return sendSuccess(res, afterPayload);
  } catch (error) {
    next(error);
  }
};

/* ─── GET all reservations ───────────────────────── */
export const getReservations = async (req, res, next) => {
  try {
    const isAdminListView = req.query.view === "admin-list";
    const archiveFilter = String(req.query.archive || "active").toLowerCase();
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const archiveQuery =
      isAdminListView && archiveFilter === "archived"
        ? { isArchived: true }
        : isAdminListView && archiveFilter === "all"
          ? {}
          : { isArchived: { $ne: true } };

    let query;
    if (isOwnerRole(dbUser.role)) {
      // Owner: see all branches (accepts legacy superadmin role during migration)
      query = { ...archiveQuery };
    } else if (dbUser.role === "branch_admin") {
      const roomIds = (
        await Room.find({ branch: dbUser.branch }).select("_id")
      ).map((r) => r._id);
      query = { roomId: { $in: roomIds }, ...archiveQuery };
    } else {
      query = { userId: dbUser._id, isArchived: { $ne: true } };
    }

    let reservationsQuery = Reservation.find(query)
      .populate(
        ...(isAdminListView ? ["userId", "firstName lastName email phone"] : POPULATE_USER),
      )
      .populate(
        ...(isAdminListView ? ["roomId", "name branch type"] : POPULATE_ROOM),
      )
      .sort({ createdAt: -1 });

    if (isAdminListView) {
      reservationsQuery = reservationsQuery.select(ADMIN_LIST_FIELDS).lean();
    } else {
      reservationsQuery = reservationsQuery.select(HEAVY_FIELDS);
    }

    const reservations = await reservationsQuery;

    res.json(serializeReservations(reservations));
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Fetch reservations error");
    handleReservationError(res, error, "fetch");
  }
};

export const getCurrentResidents = async (req, res) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const requestedBranch = req.query.branch;
    if (
      requestedBranch &&
      requestedBranch !== "all" &&
      !ROOM_BRANCHES.includes(requestedBranch)
    ) {
      return res.status(400).json({
        error: `Invalid branch. Must be one of: ${ROOM_BRANCHES.join(", ")}`,
        code: "INVALID_BRANCH",
      });
    }

    let roomQuery = {};
    if (dbUser.role === "branch_admin") {
      roomQuery.branch = dbUser.branch;
    } else if (requestedBranch && requestedBranch !== "all") {
      roomQuery.branch = requestedBranch;
    }

    await reconcileTenantUsersForScope({
      branch: roomQuery.branch || null,
    });

    const roomIds = await Room.find(roomQuery).distinct("_id");
    const reservations = await Reservation.find({
      status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
      roomId: { $in: roomIds },
      isArchived: { $ne: true },
    })
      .select(CURRENT_RESIDENT_FIELDS)
      .populate(...CURRENT_RESIDENT_USER)
      .populate(...CURRENT_RESIDENT_ROOM)
      .sort({ moveInDate: -1 })
      .lean();

    const now = new Date();
    const residents = reservations.map((reservation) =>
      mapCurrentResident(reservation, now),
    );

    return sendSuccess(res, {
      residents,
      stats: buildResidentStats(residents),
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Fetch current residents error",
    );
    return handleReservationError(res, error, "fetch");
  }
};

/* ─── GET single reservation ─────────────────────── */
export const getTenantWorkspace = async (req, res) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const roomQuery = await buildWorkspaceRoomQuery({
      dbUser,
      requestedBranch: req.query.branch,
    });

    await reconcileTenantUsersForScope({
      branch: roomQuery.branch || null,
    });

    const reservations = await getTenantWorkspaceReservations({ roomQuery });
    const tenants = await buildWorkspaceEntries(reservations, new Date());

    return sendSuccess(res, {
      tenants,
      stats: buildTenantWorkspaceStats(tenants),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(
        res,
        error.message,
        error.statusCode,
        error.code,
        error.details,
      );
    }
    logger.error(
      { err: error, requestId: req.id },
      "Fetch tenant workspace error",
    );
    return handleReservationError(res, error, "fetch");
  }
};

export const getTenantWorkspaceById = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const reservation = await Reservation.findById(reservationId)
      .select(TENANT_WORKSPACE_FIELDS)
      .populate(...TENANT_WORKSPACE_USER)
      .populate(...TENANT_WORKSPACE_ROOM)
      .lean();
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (
      dbUser.role === "branch_admin" &&
      reservation.roomId?.branch !== dbUser.branch
    ) {
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    const [bills, bedHistoryRecords, stayHistory, branchRooms] = await Promise.all([
      Bill.find({
        reservationId: reservation._id,
        isArchived: { $ne: true },
      }).lean(),
      BedHistory.find({
        $or: [
          { reservationId: reservation._id },
          { tenantId: reservation.userId?._id || reservation.userId },
        ],
      })
        .populate("roomId", "name branch")
        .sort({ moveInDate: -1 })
        .lean(),
      Stay.find({ reservationId: reservation._id })
        .sort({ leaseStartDate: -1, createdAt: -1 })
        .lean(),
      Room.find({
        branch: reservation.roomId?.branch || "",
        isArchived: { $ne: true },
      })
        .select("_id beds")
        .lean(),
    ]);
    const currentStay =
      stayHistory.find((stay) => stay.status === "active") ||
      stayHistory[0] ||
      null;
    const hasAvailableBedsInBranch = branchRooms.some((room) => {
      const availableBeds = (room.beds || [])
        .filter((bed) => bed.status === "available")
        .map((bed) => bed.id || String(bed._id));
      return (
        availableBeds.length > 0 &&
        (String(room._id) !== String(currentStay?.roomId || reservation.roomId?._id || "") ||
          availableBeds.some((bedId) => String(bedId) !== String(currentStay?.bedId || reservation.selectedBed?.id || "")))
      );
    });

    const tenant = buildTenantWorkspaceEntry({
      reservation,
      currentStay,
      stayHistory,
      bills,
      bedHistoryRecords,
      tenantStatus: reservation.userId?.tenantStatus || "applicant",
      hasAvailableBedsInBranch,
      now: new Date(),
    });

    return sendSuccess(res, tenant);
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(
        res,
        error.message,
        error.statusCode,
        error.code,
        error.details,
      );
    }
    logger.error(
      { err: error, requestId: req.id },
      "Fetch tenant workspace detail error",
    );
    return handleReservationError(res, error, "fetch");
  }
};

export const getTenantActionContext = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }
    if (dbUser.role !== "owner" && dbUser.role !== "branch_admin") {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        code: "ADMIN_REQUIRED",
      });
    }

    const context = await loadTenantActionContext(reservationId);
    if (!context) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }
    if (dbUser.role === "branch_admin" && context.currentStay.branch !== dbUser.branch) {
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    return sendSuccess(res, context);
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Fetch tenant action context error");
    return handleReservationError(res, error, "fetch");
  }
};

export const getReservationById = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId)
      .populate(...POPULATE_USER)
      .populate(...POPULATE_ROOM);
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    if (
      !isAdminRole(dbUser.role) &&
      String(reservation.userId?._id) !== String(dbUser._id)
    ) {
      return res.status(403).json({
        error: "Access denied. You can only view your own reservations.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    if (
      isAdminRole(dbUser.role) &&
      !isOwnerRole(dbUser.role) &&
      reservation.roomId?.branch !== dbUser.branch
    ) {
      return res.status(403).json({
        error: `Access denied. You can only view reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    res.json(serializeReservation(reservation));
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Fetch reservation error");
    handleReservationError(res, error, "fetch");
  }
};

export const precheckReservationDocument = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (String(reservation.userId) !== String(dbUser._id)) {
      return res.status(403).json({
        error:
          "Access denied. You can only pre-check your own reservation documents.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const documentType = normalizeDocumentPrecheckType(
      req.body.documentType || req.body.type || "valid_id_front",
    );
    if (!documentType) {
      return res.status(400).json({
        error: "Unsupported document type for document pre-check.",
        code: "INVALID_DOCUMENT_PRECHECK_TYPE",
      });
    }

    const config = DOCUMENT_PRECHECK_TYPES[documentType];
    const documentUrl =
      req.body.documentUrl || reservation[config.reservationField] || "";
    const idType =
      req.body.idType || reservation.idType || reservation.validIDType || "";

    if (!documentUrl) {
      return res.status(422).json({
        error: "Document URL is required before running the pre-check.",
        code: "DOCUMENT_URL_REQUIRED",
      });
    }
    if (!isAllowedReservationDocumentUrl(documentUrl)) {
      return res.status(400).json({
        error: "Please upload the document through the portal before running the pre-check.",
        code: "INVALID_DOCUMENT_URL",
      });
    }

    if (config.requiresIdType && !String(idType || "").trim()) {
      return res.status(422).json({
        error: "Please select the ID type before running the document pre-check.",
        code: "DOCUMENT_ID_TYPE_REQUIRED",
      });
    }

    const result = await runReservationDocumentPrecheck({
      documentType,
      documentUrl,
      idType,
    });

    reservation.set(config.reservationField, documentUrl);
    if (config.requiresIdType && String(idType || "").trim()) {
      reservation.idType = idType;
      reservation.validIDType = idType;
    }
    reservation.set(`documentPrechecks.${config.precheckField}`, result);
    await reservation.save();

    return res.json({
      documentType,
      ...result,
      message:
        result.applicantMessage ||
        result.summaryMessage ||
        "Document pre-check completed. Admin will still review the upload.",
      validationStatus: mapAiStatusToLegacyValidationStatus(result),
      warnings: result.aiCheckWarnings,
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Reservation document pre-check error",
    );
    return next(error);
  }
};

/* ─── CREATE reservation ─────────────────────────── */
export const createReservation = async (req, res, next) => {
  try {
    const payload = normalizeReservationPayload(
      pickAllowedFields(req.body, APPLICANT_CREATE_ALLOWED_FIELDS),
    );
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res.status(404).json({
        error:
          "User not found in database. Please complete registration first.",
        code: "USER_NOT_FOUND",
      });

    // Single reservation enforcement
    const existingActive = await Reservation.findOne({
      userId: dbUser._id,
      status: {
        $nin: reservationStatusesForQuery("cancelled", "archived", "moveOut"),
      },
      isArchived: { $ne: true },
    });
    if (existingActive)
      return res.status(400).json({
        error:
          "You already have an active reservation. Please complete or cancel it before creating a new one.",
        code: "RESERVATION_ALREADY_EXISTS",
        existingReservationId: existingActive._id,
        existingStatus: existingActive.status,
      });

    const { roomId, roomName, roomNumber, moveInDate } = payload;
    if ((!roomId && !roomNumber && !roomName) || !moveInDate)
      return res.status(400).json({
        error:
          "Missing required fields: roomId, roomNumber, or roomName plus moveInDate are required",
        code: "MISSING_REQUIRED_FIELDS",
      });

    // Enforce 3-month window
    if (!validateMoveInDate(moveInDate))
      return res.status(400).json({
        error: "Move-in date must be within 3 months from today.",
        code: "MOVEIN_DATE_OUT_OF_RANGE",
      });

    // Enforce 3-day minimum gap (matches frontend constraint)
    if (dayjs(moveInDate).isBefore(dayjs().add(3, "day").startOf("day")))
      return res.status(400).json({
        error: "Move-in date must be at least 3 days from today.",
        code: "MOVEIN_DATE_TOO_SOON",
      });

    // Verify room
    let room = null;
    try {
      room = await loadReservableRoom({ roomId, roomNumber, roomName });
    } catch (error) {
      if (error?.code === "AMBIGUOUS_ROOM_REFERENCE") {
        return res.status(error.statusCode || 400).json({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
    if (!room)
      return res
        .status(404)
        .json({ error: "Room not found", code: "ROOM_NOT_FOUND" });
    if (room.isArchived)
      return res.status(400).json({
        error: "Room is not available for reservation",
        code: "ROOM_NOT_AVAILABLE",
      });

    // Live occupancy check — count actual active reservations instead of
    // trusting the cached `room.available` boolean which can drift out of sync
    // (e.g. when reservations are cancelled/deleted without proper decrements).
    const activeReservationCount = await ensureRoomReservationCapacity({
      roomId: room._id,
    });
    if (activeReservationCount >= room.capacity) {
      return res.status(400).json({
        error: "Room is fully booked. Please choose a different room.",
        code: "ROOM_UNAVAILABLE",
      });
    }
    // Auto-heal: fix stale availability flag so future reads are correct
    if (!room.available && activeReservationCount < room.capacity) {
      await Room.findByIdAndUpdate(room._id, {
        currentOccupancy: activeReservationCount,
        available: true,
      });
      logger.info(
        { roomId: room._id, activeReservationCount },
        "Auto-healed stale room.available flag during reservation creation",
      );
    }

    let selectedBed = null;
    try {
      selectedBed = await validateSelectedBedForReservation({
        room,
        submittedBed: payload.selectedBed,
      });
    } catch (error) {
      if (error?.code === "BED_SELECTION_REQUIRED") {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      if (error?.code === "BED_NOT_FOUND" || error?.code === "BED_UNAVAILABLE") {
        return res.status(409).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const pricing = await buildReservationPricing({
      room,
      leaseDuration: payload.leaseDuration,
      selectedAppliances: payload.selectedAppliances,
    });

    // Create reservation with all form fields
    const b = payload;
    const viewingPreference = deriveViewingPreference(null, b);
    const reservation = new Reservation({
      userId: dbUser._id,
      roomId: room._id,
      selectedBed,
      targetMoveInDate: b.targetMoveInDate
        ? new Date(b.targetMoveInDate)
        : null,
      leaseDuration: b.leaseDuration || null,
      billingEmail: ((b.billingEmail || dbUser.email) ?? "").toLowerCase().trim() || null,
      viewingPreference,
      viewingType: deriveViewingType(viewingPreference) || b.viewingType || null,
      isOutOfTown: b.isOutOfTown || false,
      currentLocation: b.currentLocation || null,
      remoteViewingAcknowledged: b.remoteViewingAcknowledged === true,
      remoteViewingQuestions: b.remoteViewingQuestions || "",
      isUrgentMoveIn: b.isUrgentMoveIn === true,
      visitApproved: false,
      selfiePhotoUrl: b.selfiePhotoUrl || null,
      firstName: b.firstName || null,
      lastName: b.lastName || null,
      middleName: b.middleName || null,
      nickname: b.nickname || null,
      mobileNumber: b.mobileNumber || null,
      birthday: b.birthday ? new Date(b.birthday) : null,
      gender: b.gender || null,
      maritalStatus: b.maritalStatus || null,
      nationality: b.nationality || null,
      educationLevel: b.educationLevel || null,
      address: {
        region: b.addressRegion || null,
        unitHouseNo: b.addressUnitHouseNo || null,
        street: b.addressStreet || null,
        barangay: b.addressBarangay || null,
        city: b.addressCity || null,
        province: b.addressProvince || null,
      },
      validIDFrontUrl: b.validIDFrontUrl || null,
      validIDBackUrl: b.validIDBackUrl || null,
      validIDType: b.validIDType || null,
      idType: b.idType || b.validIDType || null,
      nbiClearanceUrl: b.nbiClearanceUrl || null,
      nbiReason: b.nbiReason || null,
      companyIDUrl: b.companyIDUrl || null,
      companyIDReason: b.companyIDReason || null,
      emergencyContact: {
        name: b.emergencyContactName || null,
        relationship: b.emergencyRelationship || null,
        contactNumber: b.emergencyContactNumber || null,
      },
      healthConcerns: b.healthConcerns || null,
      employment: {
        employerSchool: b.employerSchool || null,
        employerAddress: b.employerAddress || null,
        employerContact: b.employerContact || null,
        startDate: b.startDate ? new Date(b.startDate) : null,
        occupation: b.occupation || null,
        previousEmployment: b.previousEmployment || null,
      },
      preferredRoomType: b.roomType || null,
      preferredRoomNumber: b.preferredRoomNumber || null,
      referralSource: b.referralSource || null,
      referrerName: b.referrerName || null,
      estimatedMoveInTime: b.estimatedMoveInTime || null,
      workSchedule: b.workSchedule || null,
      workScheduleOther: b.workScheduleOther || null,
      agreedToPrivacy: b.agreedToPrivacy || false,
      agreedToCertification: b.agreedToCertification || false,
      proofOfPaymentUrl: null,
      reservationFeeAmount: pricing.reservationFeeAmount,
      monthlyRent: pricing.monthlyRent,
      selectedAppliances: pricing.selectedAppliances,
      applianceFees: pricing.applianceFees,
      moveInDate: b.moveInDate,
      moveOutDate: null,
      totalPrice: pricing.totalPrice,
      notes: b.notes || "",
      status: "pending",
      paymentStatus: "pending",
    });

    await reservation.save();
    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);

    await auditLogger.logModification(
      req,
      "reservation",
      reservation._id,
      null,
      reservation.toObject(),
      `Created reservation for room: ${room.name}`,
    );
    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: reservation._id,
      reservationCode: reservation.reservationCode,
      reservation: serializeReservation(reservation),
      pricing: pricing.breakdown,
    });
  } catch (error) {
    if (isActiveBedAssignmentDuplicateError(error)) {
      return res.status(409).json({
        error: BED_UNAVAILABLE_MESSAGE,
        code: "BED_UNAVAILABLE",
      });
    }
    logger.error({ err: error, requestId: req.id }, "Create reservation error");
    await auditLogger.logError(req, error, "Failed to create reservation");
    handleReservationError(res, error, "create");
  }
};

/* ─── UPDATE reservation (admin) ─────────────────── */
export const updateReservation = async (req, res, next) => {
  try {
    req.body = normalizeReservationPayload(req.body);
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const existingReservation = await Reservation.findById(
      reservationId,
    ).populate("roomId", "branch");
    if (!existingReservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    const oldData = existingReservation.toObject();
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      existingReservation.roomId?.branch,
    );
    if (denied) return;

    const rawApplicationReviewReason =
      req.body.applicationReviewReason ??
      req.body.documentRejectionReason ??
      req.body.notes;
    const normalizedApplicationReviewReason =
      rawApplicationReviewReason == null
        ? ""
        : String(rawApplicationReviewReason).trim();
    if (
      normalizedApplicationReviewReason &&
      normalizedApplicationReviewReason.length > MAX_APPLICATION_REVIEW_REASON_LENGTH
    ) {
      return res.status(400).json({
        error: `Review notes must be ${MAX_APPLICATION_REVIEW_REASON_LENGTH} characters or fewer.`,
        code: "APPLICATION_REVIEW_REASON_TOO_LONG",
      });
    }

    if (req.body.documentsApproved === true && req.body.status === undefined) {
      req.body.status = "approved_for_payment";
    }
    if (
      req.body.documentsApproved === false &&
      req.body.status === undefined &&
      normalizedApplicationReviewReason
    ) {
      req.body.status = "needs_revision";
    }
    if (
      req.body.applicationReviewReason === undefined &&
      normalizedApplicationReviewReason
    ) {
      req.body.applicationReviewReason = normalizedApplicationReviewReason;
    }

    const isMoveInTransition =
      hasReservationStatus(req.body.status, "moveIn") &&
      !hasReservationStatus(existingReservation.status, "moveIn");

    // Enforce the 3-month window only while scheduling/rescheduling a target
    // move-in. Actual move-in uses the server timestamp below.
    if (
      req.body.moveInDate &&
      !isMoveInTransition &&
      !validateMoveInDate(req.body.moveInDate)
    ) {
      return res.status(400).json({
        error: "Move-in date must be within 3 months from today.",
        code: "MOVEIN_DATE_OUT_OF_RANGE",
      });
    }

    if (
      req.body.status !== undefined &&
      !canTransitionReservationStatus(
        existingReservation.status,
        req.body.status,
      )
    ) {
      return res.status(400).json({
        error: `Invalid reservation status transition from "${normalizeReservationStatus(existingReservation.status)}" to "${normalizeReservationStatus(req.body.status)}".`,
        code: "INVALID_RESERVATION_STATUS_TRANSITION",
      });
    }

    const directVisitUpdateValidation = validateDirectVisitUpdate(
      existingReservation,
      req.body,
    );
    if (!directVisitUpdateValidation.ok) {
      return res.status(directVisitUpdateValidation.status).json({
        error: directVisitUpdateValidation.error,
        code: directVisitUpdateValidation.code,
      });
    }

    if (req.body.visitDate || req.body.visitTime) {
      const validation = await validateVisitSelection({
        branch: existingReservation.roomId?.branch,
        visitDate: req.body.visitDate || existingReservation.visitDate,
        visitTime: req.body.visitTime || existingReservation.visitTime,
        roomId: existingReservation.roomId?._id || existingReservation.roomId,
        excludeReservationId: reservationId,
      });

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          code: validation.code,
        });
      }

      if (req.body.visitDate) {
        req.body.visitDate = validation.date;
      }
    }

    // Status transition side-effects
    if (
      req.body.status === "reserved" &&
      !hasReservationStatus(existingReservation.status, "reserved")
    ) {
      req.body.paymentStatus = "paid";
      req.body.approvedDate = new Date();
      req.body.reservedAt = new Date();
      // Stamp paymentDate if not already set (e.g. admin manually confirming)
      if (!existingReservation.paymentDate) {
        req.body.paymentDate = new Date();
      }
    }

    if (
      req.body.status === "approved_for_payment" &&
      !hasReservationStatus(existingReservation.status, "approved_for_payment")
    ) {
      // Block approval if any uploaded document is flagged needs_reupload by the precheck.
      // manual_review_fallback is intentionally excluded — admin reviewing IS the manual check.
      const blockedDocs = Object.entries(DOCUMENT_PRECHECK_TYPES)
        .filter(([, config]) => Boolean(existingReservation[config.reservationField]))
        .filter(([, config]) =>
          shouldBlockDocumentSubmission(
            existingReservation.documentPrechecks?.[config.precheckField],
          ),
        )
        .map(([docKey, config]) => {
          const precheck = existingReservation.documentPrechecks?.[config.precheckField] || {};
          const label = DOCUMENT_PRECHECK_LABELS[docKey] || docKey;
          return {
            key: docKey,
            label,
            precheckStatus: precheck.precheckStatus || "needs_reupload",
            readabilityStatus: precheck.readabilityStatus || "unknown",
            documentTypeStatus: precheck.documentTypeStatus || "unknown",
            message:
              precheck.applicantMessage ||
              precheck.summaryMessage ||
              `${label} needs a clearer upload before this application can be approved.`,
          };
        });

      if (blockedDocs.length > 0) {
        return res.status(422).json({
          error: `Cannot approve: ${blockedDocs.length} document(s) must be re-uploaded before this application can be approved. Use "Request Revision" to notify the applicant.`,
          code: "DOCUMENT_PRECHECK_BLOCKS_APPROVAL",
          blockedDocuments: blockedDocs,
        });
      }

      req.body.applicationReviewedAt = new Date();
      req.body.applicationReviewedBy = req.adminId || null;
      req.body.approvedForPaymentAt = new Date();
      req.body.applicationReviewReason = null;
    }

    if (
      hasReservationStatus(req.body.status, "needs_revision", "rejected")
    ) {
      if (!normalizedApplicationReviewReason) {
        return res.status(422).json({
          error: "A reason is required when requesting revision or rejecting an application.",
          code: "APPLICATION_REVIEW_REASON_REQUIRED",
        });
      }
      req.body.applicationReviewedAt = new Date();
      req.body.applicationReviewedBy = req.adminId || null;
      req.body.approvedForPaymentAt = null;
      req.body.applicationReviewReason = normalizedApplicationReviewReason;
    }

    // ── Move-in gate: enforce full prerequisite checklist ─────────────
    // Prevents admins from bypassing the proper flow (visit → payment →
    // reservation confirmed) and jumping straight to moveIn.
    if (isMoveInTransition) {
      const blockers = getMoveInBlockers(existingReservation);
      if (blockers.length > 0) {
        return res.status(400).json({
          error:
            "Move-in prerequisites not met. Please resolve the following before moving in the tenant.",
          code: "MOVEIN_PREREQUISITES_NOT_MET",
          missing: blockers,
        });
      }

      // ── Meter reading is required at move-in ──────────────────────────
      if (
        req.body.meterReading == null ||
        isNaN(Number(req.body.meterReading))
      ) {
        return res.status(400).json({
          error: "A meter reading (kWh) is required when moving in a tenant.",
          code: "METER_READING_REQUIRED",
        });
      }

      const moveInDate = combineLifecycleDateTime({
        dateInput: null,
        timeInput: null,
        fallbackDate: new Date(),
      });
      if (!moveInDate) {
        return res.status(400).json({
          error:
            "Invalid move-in date/time. Use a valid date and HH:mm format.",
          code: "INVALID_MOVEIN_DATETIME",
        });
      }

      const duplicateMoveIn = await UtilityReading.findOne({
        utilityType: "electricity",
        roomId: existingReservation.roomId?._id || existingReservation.roomId,
        tenantId: existingReservation.userId?._id || existingReservation.userId,
        eventType: { $in: utilityEventTypesForQuery("moveIn") },
        date: moveInDate,
        isArchived: false,
      })
        .select("_id")
        .lean();
      if (duplicateMoveIn) {
        return res.status(409).json({
          error:
            "A move-in reading already exists for this tenant at the same date/time. Use a different time.",
          code: "DUPLICATE_LIFECYCLE_READING",
        });
      }

      req.body.moveInDate = moveInDate;
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    // Whitelist admin-allowed fields to prevent mass-assignment
    const ADMIN_ALLOWED = [
      "status",
      "paymentStatus",
      "paymentDate",
      "proofOfPaymentUrl",
      "notes",
      "moveInDate",
      "moveOutDate",
      "approvedDate",
      "reservedAt",
      "visitApproved",
      "scheduleApproved",
      "applicationReviewReason",
      "applicationReviewedAt",
      "applicationReviewedBy",
      "approvedForPaymentAt",
      "documentsApproved",
      "documentRejectionReason",
      "nbiApproved",
      "nbiRejectionReason",
      "companyIDApproved",
      "companyIDRejectionReason",
      "scheduleRejected",
      "scheduleRejectionReason",
      "visitStatus",
    ];

    // Remove a single visitHistory entry by index
    if (req.body.removeVisitHistoryIndex !== undefined) {
      const idx = Number(req.body.removeVisitHistoryIndex);
      const history = reservation.visitHistory || [];
      if (idx >= 0 && idx < history.length) {
        history.splice(idx, 1);
        reservation.visitHistory = history;
        reservation.markModified("visitHistory");
      }
    }

    // Auto-set rejection metadata when admin rejects a visit schedule
    if (
      req.body.scheduleRejected === true &&
      !existingReservation.scheduleRejected
    ) {
      reservation.scheduleRejectedAt = new Date();
      reservation.scheduleRejectedBy = req.adminId || null;
      // Clear visit approval so tenant can reschedule
      reservation.visitApproved = false;
      // Legacy visit records can stay in visit_pending so the tenant can reschedule.
      if (hasReservationStatus(existingReservation.status, LEGACY_VISIT_STATUSES, "pending")) {
        reservation.status = "visit_pending";
      }

      // Archive the rejected visit attempt to history
      if (existingReservation.visitDate) {
        if (!reservation.visitHistory) reservation.visitHistory = [];
        const attemptNumber = reservation.visitHistory.length + 1;
        reservation.visitHistory.push({
          visitDate: existingReservation.visitDate,
          visitTime: existingReservation.visitTime,
          viewingType: existingReservation.viewingType || "inperson",
          status: "rejected",
          rejectionReason: req.body.scheduleRejectionReason || "",
          // Use visitScheduledAt (when tenant submitted the schedule), not createdAt
          scheduledAt:
            existingReservation.visitScheduledAt ||
            existingReservation.createdAt,
          rejectedAt: new Date(),
          rejectedBy: req.adminId || null,
          attemptNumber,
        });
      }
    }

    // Auto-transition: visit_pending → visit_approved when admin approves visit
    if (req.body.visitApproved === true && !existingReservation.visitApproved) {
      if (hasReservationStatus(existingReservation.status, LEGACY_VISIT_STATUSES, "pending")) {
        reservation.status = "visit_approved";
      }
      if (
        hasPhysicalVisitPreference(existingReservation) &&
        !VISIT_OUTCOME_STATUSES.includes(existingReservation.visitStatus)
      ) {
        reservation.visitStatus = "physical_visit_scheduled";
      }
      // Stamp the approval time so the activity timeline can show it
      reservation.scheduleApprovedAt = new Date();

      // Archive the approved visit attempt to history
      if (existingReservation.visitDate) {
        if (!reservation.visitHistory) reservation.visitHistory = [];
        const attemptNumber = reservation.visitHistory.length + 1;
        reservation.visitHistory.push({
          visitDate: existingReservation.visitDate,
          visitTime: existingReservation.visitTime,
          viewingType: existingReservation.viewingType || "inperson",
          status: "approved",
          // Use visitScheduledAt (when tenant submitted the schedule), not createdAt
          scheduledAt:
            existingReservation.visitScheduledAt ||
            existingReservation.createdAt,
          approvedAt: new Date(),
          attemptNumber,
        });
      }
    }

    for (const key of ADMIN_ALLOWED) {
      if (req.body[key] !== undefined) reservation[key] = req.body[key];
    }
    const updatedReservation = await reservation.save();

    // ── Auto-record move-in meter reading when moving in ─────────────────
    // The reading is saved immediately. The billing period must be created
    // explicitly by the admin from the billing module.
    if (
      req.body.status === "moveIn" &&
      !hasReservationStatus(oldData.status, "moveIn") &&
      req.body.meterReading != null &&
      !isNaN(Number(req.body.meterReading))
    ) {
      try {
        const roomId =
          updatedReservation.roomId?._id || updatedReservation.roomId;
        const roomDoc = await Room.findById(roomId).lean();
        const adminUser = await User.findOne({
          firebaseUid: req.user.uid,
        }).lean();
        const recordedBy = req.adminId || adminUser?._id;
        const meterValue = Number(req.body.meterReading);
        const moveInDate = new Date(
          readMoveInDate(updatedReservation) || new Date(),
        );

        if (roomDoc && recordedBy) {
          const tenantUserId =
            updatedReservation.userId?._id || updatedReservation.userId;

          // Snapshot all currently moved-in tenants for this room
          const checkedInRes = await Reservation.find({
            roomId: roomId,
            status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
            isArchived: { $ne: true },
          })
            .select("userId")
            .lean();
          const activeTenantIds = checkedInRes
            .map((r) => r.userId)
            .filter(Boolean);

          const moveInReading = new UtilityReading({
            utilityType: "electricity",
            roomId: roomId,
            branch: roomDoc.branch,
            reading: meterValue,
            date: moveInDate,
            eventType: "moveIn",
            tenantId: tenantUserId,
            activeTenantIds,
            recordedBy,
            utilityPeriodId: null,
          });
          await moveInReading.save();

          logger.info(
            {
              reservationId,
              meterReading: meterValue,
            },
            "Auto-recorded move-in meter reading",
          );
        }
      } catch (elecErr) {
        logger.warn(
          { err: elecErr, requestId: req.id },
          "Auto move-in electricity record failed (non-fatal)",
        );
      }
    }

    // Occupancy tracking
    if (oldData.status !== updatedReservation.status) {
      try {
        await updateOccupancyOnReservationChange(updatedReservation, oldData);
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Occupancy update failed (non-fatal)",
        );
      }
    }

    if (req.body.status !== undefined) {
      try {
        await syncReservationUserLifecycle({
          status: updatedReservation.status,
          previousStatus: oldData.status,
          userId: updatedReservation.userId?._id || updatedReservation.userId,
          roomId: updatedReservation.roomId?._id || updatedReservation.roomId,
          reservationId: updatedReservation._id,
        });
      } catch (lifecycleErr) {
        logger.warn(
          { err: lifecycleErr, requestId: req.id, reservationId },
          "Reservation user lifecycle sync failed after admin update",
        );
      }
    }

    if (
      req.body.status === "moveIn" &&
      !hasReservationStatus(oldData.status, "moveIn") &&
      updatedReservation.selectedBed?.id
    ) {
      const existingHistory = await BedHistory.findOne({
        reservationId: updatedReservation._id,
        bedId: updatedReservation.selectedBed.id,
        moveOutDate: null,
      })
        .select("_id")
        .lean();

      if (!existingHistory) {
        await BedHistory.create({
          bedId: updatedReservation.selectedBed.id,
          roomId: updatedReservation.roomId?._id || updatedReservation.roomId,
          tenantId: updatedReservation.userId?._id || updatedReservation.userId,
          reservationId: updatedReservation._id,
          moveInDate: readMoveInDate(updatedReservation) || new Date(),
        });
      }
    }

    if (
      req.body.status === "moveIn" &&
      !hasReservationStatus(oldData.status, "moveIn")
    ) {
      try {
        const billingReservation = await Reservation.findById(
          updatedReservation._id,
        )
          .populate("userId", "firstName lastName email")
          .populate("roomId", "name roomNumber branch price monthlyPrice type");

        if (billingReservation) {
          await ensureCurrentCycleRentBill({
            reservation: billingReservation,
            referenceDate: readMoveInDate(updatedReservation) || new Date(),
            dryRun: false,
            notifyTenant: false,
            requireGenerationDateMatch: false,
          });
        }
      } catch (rentErr) {
        logger.warn(
          { err: rentErr, requestId: req.id, reservationId },
          "Current-cycle rent bill generation failed after move-in (non-fatal)",
        );
      }
    }

    await updatedReservation.populate(...POPULATE_USER);
    await updatedReservation.populate(...POPULATE_ROOM);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      updatedReservation.toObject(),
    );
    res.json({
      message: "Reservation updated successfully",
      reservation: serializeReservation(updatedReservation),
    });

    // Broadcast real-time update to all connected admins
    try {
      const { emitToAdmins } = await import("../utils/socket.js");
      const socketPayload = {
        reservationId: String(updatedReservation._id),
        status: updatedReservation.status,
        paymentStatus: updatedReservation.paymentStatus,
      };
      emitToAdmins("reservation:updated", socketPayload);
      if (req.body.paymentStatus !== undefined || req.body.proofOfPaymentUrl !== undefined) {
        emitToAdmins("payment:updated", socketPayload);
      }
    } catch (socketErr) {
      logger.warn({ err: socketErr }, "Socket emit failed after admin reservation update (non-fatal)");
    }

    // Send confirmation email if status just changed to "reserved"
    if (
      req.body.status === "reserved" &&
      !hasReservationStatus(oldData.status, "reserved") &&
      updatedReservation.userId?.email
    ) {
      try {
        await sendReservationConfirmedEmail({
          to: updatedReservation.userId.email,
          tenantName:
            `${updatedReservation.userId.firstName || ""} ${updatedReservation.userId.lastName || ""}`.trim() ||
            "Tenant",
          reservationCode: updatedReservation.reservationCode || "N/A",
          roomName: updatedReservation.roomId?.name || "N/A",
          branchName: updatedReservation.roomId?.branch || "Lilycrest",
          moveInDate: readMoveInDate(updatedReservation)
            ? new Date(readMoveInDate(updatedReservation)).toLocaleDateString(
                "en-PH",
                { year: "numeric", month: "long", day: "numeric" },
              )
            : "TBD",
        });
      } catch (emailErr) {
        logger.warn(
          { err: emailErr, requestId: req.id },
          "Confirmation email failed (non-fatal)",
        );
      }
      // In-app notification — reservation confirmed
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.reservationConfirmed(
          updatedReservation.userId._id,
          updatedReservation.reservationCode || "N/A",
          updatedReservation.roomId?.name || "your room",
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Reservation confirmed notification failed (non-fatal)",
        );
      }
    }

    // Send visit-approved email when admin approves a visit
    if (
      req.body.visitApproved === true &&
      !oldData.visitApproved &&
      updatedReservation.userId?.email
    ) {
      try {
        await sendVisitApprovedEmail({
          to: updatedReservation.userId.email,
          tenantName:
            `${updatedReservation.userId.firstName || ""} ${updatedReservation.userId.lastName || ""}`.trim() ||
            "Tenant",
          branchName: updatedReservation.roomId?.branch || "Lilycrest",
        });
      } catch (emailErr) {
        logger.warn(
          { err: emailErr, requestId: req.id },
          "Visit approved email failed (non-fatal)",
        );
      }
      // In-app notification — visit approved
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.visitApproved(
          updatedReservation.userId._id,
          updatedReservation.roomId?.branch || "the dormitory",
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Visit approved notification failed (non-fatal)",
        );
      }
    }

    // Send visit-rejected notification when admin rejects a visit
    if (
      req.body.scheduleRejected === true &&
      !oldData.scheduleRejected &&
      updatedReservation.userId?._id
    ) {
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.visitRejected(
          updatedReservation.userId._id,
          updatedReservation.scheduleRejectionReason ||
            "Please reschedule your visit.",
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Visit rejected notification failed (non-fatal)",
        );
      }
    }

    // In-app notification — payment proof rejected by admin
    if (
      req.body.status === "approved_for_payment" &&
      !hasReservationStatus(oldData.status, "approved_for_payment") &&
      updatedReservation.userId?._id
    ) {
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.general(
          updatedReservation.userId._id,
          "Application Approved for Payment",
          "Your application and documents were approved. Payment is now available in your reservation page.",
          {
            entityType: "reservation",
            entityId: String(updatedReservation._id),
            actionUrl: "/applicant/reservation",
          },
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Approved-for-payment notification failed (non-fatal)",
        );
      }
    }

    if (
      req.body.status === "needs_revision" &&
      !hasReservationStatus(oldData.status, "needs_revision") &&
      updatedReservation.userId?._id
    ) {
      const revisionReason =
        updatedReservation.applicationReviewReason ||
        normalizedApplicationReviewReason ||
        "Please review your submitted application details and documents.";
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.general(
          updatedReservation.userId._id,
          "Application Needs Revision",
          `Your application needs revision. ${revisionReason}`,
          {
            entityType: "reservation",
            entityId: String(updatedReservation._id),
            actionUrl: "/applicant/reservation",
          },
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Application revision notification failed (non-fatal)",
        );
      }
      if (updatedReservation.userId?.email) {
        try {
          await sendDocumentsRejectedEmail({
            to: updatedReservation.userId.email,
            tenantName:
              `${updatedReservation.userId.firstName || ""} ${updatedReservation.userId.lastName || ""}`.trim() ||
              "Tenant",
            rejectionReason: revisionReason,
            branchName: updatedReservation.roomId?.branch || "Lilycrest",
          });
        } catch (emailErr) {
          logger.warn(
            { err: emailErr, requestId: req.id },
            "Application revision email failed (non-fatal)",
          );
        }
      }
    }

    if (
      req.body.status === "rejected" &&
      !hasReservationStatus(oldData.status, "rejected") &&
      updatedReservation.userId?._id
    ) {
      const rejectionReason =
        updatedReservation.applicationReviewReason ||
        normalizedApplicationReviewReason ||
        "Please contact admin for more information about your application status.";
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.general(
          updatedReservation.userId._id,
          "Application Rejected",
          `Your application was rejected. ${rejectionReason}`,
          {
            entityType: "reservation",
            entityId: String(updatedReservation._id),
            actionUrl: "/applicant/reservation",
          },
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Application rejection notification failed (non-fatal)",
        );
      }
    }

    if (
      req.body.proofOfPaymentUrl === null &&
      oldData.proofOfPaymentUrl &&
      req.body.paymentStatus === "pending" &&
      updatedReservation.userId?._id
    ) {
      try {
        const { notify } = await import("../utils/notificationService.js");
        const rawNotes = req.body.notes || "";
        const reason = rawNotes.startsWith("Payment rejected: ")
          ? rawNotes.slice("Payment rejected: ".length)
          : rawNotes;
        await notify.paymentRejected(
          updatedReservation.userId._id,
          updatedReservation.reservationCode || "your reservation",
          reason || "Please resubmit your payment proof.",
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Payment rejected notification failed (non-fatal)",
        );
      }
    }
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Update reservation error");
    await auditLogger.logError(req, error, "Failed to update reservation");
    handleReservationError(res, error, "update");
  }
};

/* ─── CANCEL reservation (applicant self-cancel) ───── */
// Statuses the applicant is allowed to cancel from.
export const manageReservationVisit = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("roomId")
      .populate("userId", "firstName lastName email");
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    if (!hasPhysicalVisitPreference(reservation)) {
      return res.status(409).json({
        error: "Visit outcome tracking is only available for physical visit reservations.",
        code: "VISIT_MANAGEMENT_NOT_APPLICABLE",
      });
    }

    const action = String(req.body?.action || "").trim().toLowerCase();
    if (!VISIT_MANAGEMENT_ACTIONS.includes(action)) {
      return res.status(400).json({
        error:
          "Invalid visit action. Use mark_visited, mark_no_show, reschedule, cancel_visit, or allow_without_visit.",
        code: "INVALID_VISIT_MANAGEMENT_ACTION",
      });
    }

    const actor = await findDbUser(req.user.uid);
    const actorId = actor?._id || null;
    const actorName = buildActorDisplayName(actor, req.user?.email);
    const note = normalizeVisitManagementNote(req.body?.note);
    const now = new Date();
    const previousSnapshot = reservation.toObject();
    const roomId = reservation.roomId?._id || reservation.roomId || null;
    const branch = reservation.roomId?.branch || "";
    const previousVisitDate = reservation.visitDate || null;
    const previousVisitTime = reservation.visitTime || "";
    let applicantNotificationTitle = "";
    let applicantNotificationMessage = "";
    let applicantEmailStatus = "";

    const visitActionValidation = validateVisitManagementAction(reservation, action);
    if (!visitActionValidation.ok) {
      return res.status(visitActionValidation.status).json({
        error: visitActionValidation.error,
        code: visitActionValidation.code,
      });
    }

    if (
      (action === "mark_visited" || action === "mark_no_show" || action === "approve_schedule") &&
      (!reservation.visitDate || !reservation.visitTime)
    ) {
      return res.status(422).json({
        error: "A visit date and time must be set before this action.",
        code: "VISIT_SCHEDULE_REQUIRED",
      });
    }

    if (
      (action === "mark_visited" || action === "mark_no_show") &&
      !reservation.scheduleApproved
    ) {
      return res.status(422).json({
        error: "The visit schedule must be approved before recording an outcome. Approve the schedule first.",
        code: "SCHEDULE_NOT_APPROVED",
      });
    }

    if (action === "approve_schedule") {
      if (reservation.scheduleApproved) {
        return res.status(409).json({
          error: "Visit schedule has already been approved.",
          code: "SCHEDULE_ALREADY_APPROVED",
        });
      }
      if (reservation.scheduleRejected) {
        return res.status(409).json({
          error: "Visit schedule was rejected and cannot be approved. Use reschedule instead.",
          code: "SCHEDULE_REJECTED",
        });
      }
      reservation.scheduleApproved = true;
      reservation.scheduleApprovedAt = reservation.scheduleApprovedAt || now;
      if (hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES, "pending", "viewing_preference_selected")) {
        reservation.status = "visit_approved";
      }
      applyVisitOutcome({
        reservation,
        status: "schedule_approved",
        actorId,
        actorName,
        note: "",
        updatedAt: now,
      });
      appendVisitHistoryEntry({
        reservation,
        status: "schedule_approved",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "Visit Schedule Confirmed";
      applicantNotificationMessage = `Your physical visit on ${
        reservation.visitDate
          ? new Date(reservation.visitDate).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "the scheduled date"
      }${reservation.visitTime ? ` at ${reservation.visitTime}` : ""} has been confirmed. Please be on time.`;
      applicantEmailStatus = "approved";
    }

    if (action === "reject_schedule") {
      if (reservation.scheduleRejected) {
        return res.status(409).json({
          error: "Visit schedule has already been rejected.",
          code: "SCHEDULE_ALREADY_REJECTED",
        });
      }
      reservation.scheduleRejected = true;
      reservation.scheduleRejectedAt = now;
      reservation.scheduleRejectedBy = actorId || null;
      reservation.scheduleRejectionReason = note || "";
      reservation.visitApproved = false;
      reservation.scheduleApproved = false;
      reservation.scheduleApprovedAt = null;
      if (hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES, "approved")) {
        reservation.status = "visit_pending";
      }
      applyVisitOutcome({
        reservation,
        status: "visit_cancelled",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      if (reservation.visitDate) {
        appendVisitHistoryEntry({
          reservation,
          status: "rejected",
          actorId,
          actorName,
          note,
          updatedAt: now,
        });
      }
      applicantNotificationTitle = "Visit Schedule Rejected";
      applicantNotificationMessage = note
        ? `Your scheduled visit was rejected: ${note} Please reschedule.`
        : "Your scheduled visit was rejected. Please choose a new date and time.";
      applicantEmailStatus = "rejected";
    }

    if (action === "reschedule") {
      const nextVisitDate = req.body?.visitDate;
      const nextVisitTime =
        typeof req.body?.visitTime === "string" ? req.body.visitTime.trim() : "";

      if (!nextVisitDate || !nextVisitTime) {
        return res.status(422).json({
          error: "A new visit date and time slot are required when rescheduling a physical visit.",
          code: "VISIT_RESCHEDULE_DETAILS_REQUIRED",
        });
      }

      const validation = await validateVisitSelection({
        branch,
        visitDate: nextVisitDate,
        visitTime: nextVisitTime,
        roomId,
        excludeReservationId: reservationId,
      });

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          code: validation.code,
        });
      }

      if (reservation.visitDate || reservation.visitTime) {
        appendVisitHistoryEntry({
          reservation,
          status: "rescheduled",
          actorId,
          actorName,
          note,
          updatedAt: now,
          visitDate: reservation.visitDate,
          visitTime: reservation.visitTime,
          rescheduledToDate: validation.date,
          rescheduledToTime: nextVisitTime,
        });
      }

      reservation.visitDate = validation.date;
      reservation.visitTime = nextVisitTime;
      reservation.visitScheduledAt = now;
      reservation.scheduleApproved = false;
      reservation.scheduleApprovedAt = null;
      reservation.visitApproved = false;
      reservation.scheduleRejected = false;
      reservation.scheduleRejectedAt = null;
      reservation.scheduleRejectedBy = null;
      reservation.scheduleRejectionReason = null;
      applyVisitOutcome({
        reservation,
        status: "rescheduled",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "Physical Visit Rescheduled";
      applicantNotificationMessage = `Your physical visit was rescheduled to ${
        validation.date
          ? new Date(validation.date).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "a new date"
      }${nextVisitTime ? ` at ${nextVisitTime}` : ""}. Your tenant application will stay locked until the visit is completed or admin allows you to proceed.`;
      applicantEmailStatus = "rescheduled";
    }

    if (action === "mark_visited") {
      reservation.scheduleApproved = true;
      reservation.scheduleApprovedAt = reservation.scheduleApprovedAt || now;
      reservation.visitApproved = true;
      appendVisitHistoryEntry({
        reservation,
        status: "completed",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applyVisitOutcome({
        reservation,
        status: "visit_completed",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "Physical Visit Completed";
      applicantNotificationMessage =
        "Your physical visit has been recorded. You may now continue to your tenant application. Payment remains locked until your application and required documents are approved.";
      applicantEmailStatus = "visit_completed";
    }

    if (action === "mark_no_show") {
      reservation.scheduleApproved = false;
      reservation.visitApproved = false;
      appendVisitHistoryEntry({
        reservation,
        status: "no_show",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applyVisitOutcome({
        reservation,
        status: "no_show",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "Missed Physical Visit";
      applicantNotificationMessage =
        "You missed your scheduled visit. Please reschedule your visit or contact admin before continuing. Your tenant application remains locked.";
      applicantEmailStatus = "no_show";
    }

    if (action === "cancel_visit") {
      if (reservation.visitDate || reservation.visitTime) {
        appendVisitHistoryEntry({
          reservation,
          status: "visit_cancelled",
          actorId,
          actorName,
          note,
          updatedAt: now,
        });
      }

      reservation.visitDate = null;
      reservation.visitTime = "";
      reservation.visitScheduledAt = null;
      reservation.scheduleApproved = false;
      reservation.scheduleApprovedAt = null;
      reservation.visitApproved = false;
      reservation.scheduleRejected = false;
      reservation.scheduleRejectedAt = null;
      reservation.scheduleRejectedBy = null;
      reservation.scheduleRejectionReason = null;
      applyVisitOutcome({
        reservation,
        status: "visit_cancelled",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "Physical Visit Cancelled";
      applicantNotificationMessage =
        "Your physical visit schedule was cancelled. Your reservation is still active, but your tenant application remains locked unless admin separately allows you to proceed without a visit.";
      applicantEmailStatus = "visit_cancelled";
    }

    if (action === "allow_without_visit") {
      appendVisitHistoryEntry({
        reservation,
        status: "allowed_without_visit",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      reservation.scheduleApproved = false;
      reservation.visitApproved = false;
      applyVisitOutcome({
        reservation,
        status: "allowed_without_visit",
        actorId,
        actorName,
        note,
        updatedAt: now,
      });
      applicantNotificationTitle = "You May Continue Your Tenant Application";
      applicantNotificationMessage =
        "Admin has allowed you to continue your tenant application without a completed physical visit. Payment remains locked until your application and required documents are approved.";
      applicantEmailStatus = "allowed_without_visit";
    }

    await reservation.save();
    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);

    const successMessage =
      action === "approve_schedule"
        ? "Visit schedule approved. Tenant has been notified."
        : action === "reject_schedule"
          ? "Visit schedule rejected. Tenant has been notified."
          : action === "mark_visited"
            ? "Visit marked as completed"
            : action === "mark_no_show"
              ? "Visit marked as no-show"
              : action === "reschedule"
                ? "Visit schedule updated"
                : action === "allow_without_visit"
                  ? "Applicant may proceed without a completed visit"
                  : "Visit schedule cancelled";

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      previousSnapshot,
      reservation.toObject(),
      `Visit management action: ${action}`,
    );

    let emailWarning = "";

    if (reservation.userId?._id && applicantNotificationTitle && applicantNotificationMessage) {
      try {
        const { notify } = await import("../utils/notificationService.js");
        await notify.general(
          reservation.userId._id,
          applicantNotificationTitle,
          applicantNotificationMessage,
          {
            entityType: "reservation",
            entityId: String(reservation._id),
            actionUrl: "/applicant/reservation",
          },
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Visit management notification failed (non-fatal)",
        );
      }
    }

    if (reservation.userId?.email && applicantEmailStatus) {
      try {
        const emailResult = await sendPhysicalVisitStatusEmail(
          buildVisitEmailContext({
            reservation,
            status: applicantEmailStatus,
            previousVisitDate,
            previousVisitTime,
            note,
          }),
        );
        if (!emailResult?.success) {
          emailWarning = "Visit status updated, but email notification could not be sent.";
        }
      } catch (emailErr) {
        logger.warn(
          { err: emailErr, requestId: req.id },
          "Visit management email failed (non-fatal)",
        );
        emailWarning = "Visit status updated, but email notification could not be sent.";
      }
    }

    res.json({
      message: successMessage,
      reservation: serializeReservation(reservation),
      ...(emailWarning ? { emailWarning } : {}),
    });

    try {
      const { emitToAdmins } = await import("../utils/socket.js");
      emitToAdmins("reservation:updated", {
        reservationId: String(reservation._id),
        status: reservation.status,
        paymentStatus: reservation.paymentStatus,
      });
    } catch (socketErr) {
      logger.warn(
        { err: socketErr, requestId: req.id },
        "Socket emit failed after visit management update (non-fatal)",
      );
    }
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Manage visit error");
    await auditLogger.logError(req, error, "Failed to manage reservation visit");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code || "VISIT_MANAGEMENT_FAILED",
      });
    }
    handleReservationError(res, error, "manage visit");
  }
};

const APPLICANT_CANCELLABLE_STATUSES = new Set([
  "pending",
  "viewing_preference_selected",
  "visit_pending",
  "visit_approved",
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "payment_pending",
  "reserved",
]);

export const cancelReservationByUser = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res.status(404).json({ error: "User not found.", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found.", code: "RESERVATION_NOT_FOUND" });

    // Ownership check — applicant can only cancel their own reservation.
    if (String(reservation.userId) !== String(dbUser._id))
      return res.status(403).json({
        error: "You can only cancel your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });

    // Idempotent: already cancelled → return current state without error.
    if (normalizeReservationStatus(reservation.status) === "cancelled") {
      return res.status(409).json({
        error: "This reservation is already cancelled.",
        code: "ALREADY_CANCELLED",
      });
    }

    // Paid reservations must go through the request flow (admin review required, no refund).
    if (reservation.paymentStatus === "paid") {
      return res.status(409).json({
        error: "This reservation has a paid reservation fee. Please use the cancellation request process.",
        code: "PAID_RESERVATION_MUST_USE_REQUEST_FLOW",
      });
    }

    // Block if status is not cancellable by applicant.
    if (!APPLICANT_CANCELLABLE_STATUSES.has(normalizeReservationStatus(reservation.status))) {
      return res.status(409).json({
        error: `A reservation with status "${reservation.status}" cannot be cancelled by the applicant.`,
        code: "CANCELLATION_NOT_ALLOWED",
      });
    }

    const now = new Date();

    // Archive any active visit to history before cancelling.
    const visitHistoryUpdate = [];
    if (reservation.visitDate) {
      visitHistoryUpdate.push(...(reservation.visitHistory || []), {
        visitDate: reservation.visitDate,
        visitTime: reservation.visitTime,
        viewingType: reservation.viewingType || "inperson",
        status: "cancelled",
        scheduledAt: reservation.visitScheduledAt || reservation.createdAt,
      });
    }

    const updates = {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: dbUser._id,
      cancellationSource: "applicant",
      cancellationReason: req.body.reason || null,
      // Reservation fee is non-refundable on applicant cancellation.
      reservationFeeRefundable: false,
      reservationFeeForfeited: true,
      ...(visitHistoryUpdate.length > 0 && { visitHistory: visitHistoryUpdate }),
    };

    const updated = await Reservation.findByIdAndUpdate(
      reservationId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch type");

    // Release occupancy if a bed was locked/reserved for this applicant.
    try {
      await updateOccupancyOnReservationChange(updated, { status: reservation.status });
    } catch (occupancyErr) {
      logger.warn({ err: occupancyErr, reservationId }, "Cancel: occupancy update failed (non-fatal)");
    }

    // Sync user lifecycle (e.g. revert tenantStatus to applicant).
    try {
      await syncReservationUserLifecycle({
        status: "cancelled",
        previousStatus: reservation.status,
        userId: dbUser._id,
        roomId: reservation.roomId,
        reservationId: reservation._id,
      });
    } catch (lifecycleErr) {
      logger.warn({ err: lifecycleErr, reservationId }, "Cancel: lifecycle sync failed (non-fatal)");
    }

    // Fire notification — placed BEFORE the response so it is never unreachable.
    const notifCode = updated.reservationCode || "N/A";
    const { notify: notifySvc } = await import("../utils/notificationService.js").catch(() => ({ notify: null }));
    if (notifySvc) {
      notifySvc
        .reservationCancelled(dbUser._id, notifCode, req.body.reason || "Cancelled by applicant")
        .catch((e) => logger.warn({ err: e }, "Cancel notification failed (non-fatal)"));
    }

    return res.json({
      message: "Reservation cancelled. The reservation fee is non-refundable.",
      reservation: updated,
      feeForfeited: true,
    });
  } catch (error) {
    next(error);
  }
};

/* ─── VALIDATE reservation ID (user self-update) ───── */
/* ─── UPDATE reservation (user self-update) ──────── */
export const updateReservationByUser = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    if (String(reservation.userId) !== String(dbUser._id))
      return res.status(403).json({
        error: "Access denied. You can only update your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });

    const forbiddenFields = getForbiddenTenantUpdateFields(req.body);
    if (forbiddenFields.length > 0) {
      return res.status(400).json({
        error: `Tenant updates cannot set protected reservation fields: ${forbiddenFields.join(", ")}.`,
        code: "TENANT_FIELD_NOT_ALLOWED",
        fields: forbiddenFields,
      });
    }

    // Build update payload from config-driven field mapping
    const updates = buildUserUpdatePayload(req.body);
    let appliedPricing = null;
    const hasBodyField = (field) => Object.prototype.hasOwnProperty.call(req.body, field);

    // ── Legacy soft-cancel path: redirect to dedicated cancel endpoint ─────
    // The new PATCH /:id/cancel endpoint is the canonical path.
    // This legacy branch is kept for backward compatibility but routes cleanly.
    if (req.body.cancelReservation === true) {
      // Delegate to the dedicated cancel handler logic rather than duplicating it.
      // Re-use req/res so the response format stays consistent.
      req.params.reservationId = reservationId;
      return cancelReservationByUser(req, res, next);
    }

    // Notification for cancellation now fires inside cancelReservationByUser,
    // which is called above when cancelReservation=true. No dead code here.

    const requestedRoomId = updates.roomId || reservation.roomId;
    const shouldRevalidateBedSelection =
      req.body.roomId !== undefined ||
      req.body.selectedBed !== undefined ||
      req.body.selectedAppliances !== undefined ||
      req.body.leaseDuration !== undefined ||
      CLIENT_PRICING_FIELDS.some((field) => req.body[field] !== undefined);

    if (shouldRevalidateBedSelection) {
      const room = await Room.findById(requestedRoomId);
      if (!room) {
        return res.status(404).json({
          error: "Room not found",
          code: "ROOM_NOT_FOUND",
        });
      }
      if (room.isArchived) {
        return res.status(400).json({
          error: "Room is not available for reservation",
          code: "ROOM_NOT_AVAILABLE",
        });
      }

      const activeReservationCount = await ensureRoomReservationCapacity({
        roomId: room._id,
        excludeReservationId: reservationId,
      });
      if (activeReservationCount >= room.capacity) {
        return res.status(400).json({
          error: "Room is fully booked. Please choose a different room.",
          code: "ROOM_UNAVAILABLE",
        });
      }

      try {
        const submittedBed =
          req.body.selectedBed !== undefined
            ? req.body.selectedBed
            : reservation.selectedBed;
        updates.selectedBed = await validateSelectedBedForReservation({
          room,
          submittedBed,
          excludeReservationId: reservationId,
        });
      } catch (error) {
        if (error?.code === "BED_SELECTION_REQUIRED") {
          return res.status(400).json({
            error: error.message,
            code: error.code,
          });
        }
        if (error?.code === "BED_NOT_FOUND" || error?.code === "BED_UNAVAILABLE") {
          return res.status(409).json({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }

      appliedPricing = await buildReservationPricing({
        room,
        leaseDuration: updates.leaseDuration ?? reservation.leaseDuration,
        selectedAppliances:
          req.body.selectedAppliances !== undefined
            ? req.body.selectedAppliances
            : reservation.selectedAppliances,
      });
      updates.roomId = room._id;
      updates.monthlyRent = appliedPricing.monthlyRent;
      updates.selectedAppliances = appliedPricing.selectedAppliances;
      updates.applianceFees = appliedPricing.applianceFees;
      updates.totalPrice = appliedPricing.totalPrice;
      updates.reservationFeeAmount = appliedPricing.reservationFeeAmount;
    }

    const rawViewingPreference = hasBodyField("viewingPreference")
      ? req.body.viewingPreference
      : hasBodyField("viewingType")
        ? req.body.viewingType
        : undefined;

    if (rawViewingPreference !== undefined) {
      const normalizedViewingPreference = normalizeViewingPreferenceInput(
        rawViewingPreference,
      );
      if (!normalizedViewingPreference) {
        return res.status(400).json({
          error:
            "Invalid viewing preference. Please choose Physical Visit, 2D Remote Viewing, or Urgent Move-in Review.",
          code: "INVALID_VIEWING_PREFERENCE",
        });
      }
      updates.viewingPreference = normalizedViewingPreference;
      updates.viewingType = deriveViewingType(normalizedViewingPreference);
    }

    if (hasBodyField("remoteViewingQuestions")) {
      const normalizedQuestions =
        typeof req.body.remoteViewingQuestions === "string"
          ? req.body.remoteViewingQuestions.trim()
          : "";
      if (normalizedQuestions.length > MAX_REMOTE_VIEWING_QUESTION_LENGTH) {
        return res.status(400).json({
          error: `Remote viewing questions must be ${MAX_REMOTE_VIEWING_QUESTION_LENGTH} characters or fewer.`,
          code: "REMOTE_VIEWING_QUESTIONS_TOO_LONG",
        });
      }
      updates.remoteViewingQuestions = normalizedQuestions;
    }

    if (hasBodyField("visitTime") && req.body.visitTime == null) {
      updates.visitTime = "";
    }

    const effectiveViewingPreference = deriveViewingPreference(reservation, updates);
    const preferenceRelatedUpdate =
      rawViewingPreference !== undefined ||
      hasBodyField("visitDate") ||
      hasBodyField("visitTime") ||
      hasBodyField("remoteViewingAcknowledged") ||
      hasBodyField("remoteViewingQuestions") ||
      hasBodyField("isUrgentMoveIn");

    if (effectiveViewingPreference) {
      updates.viewingPreference = effectiveViewingPreference;
      updates.viewingType = deriveViewingType(effectiveViewingPreference);
    }

    if (effectiveViewingPreference === "urgent_move_in_review") {
      updates.isUrgentMoveIn = true;
    } else if (preferenceRelatedUpdate || hasBodyField("isUrgentMoveIn")) {
      updates.isUrgentMoveIn = false;
    }

    if (
      effectiveViewingPreference !== "remote_2d_viewing" &&
      (rawViewingPreference !== undefined || hasBodyField("remoteViewingAcknowledged"))
    ) {
      updates.remoteViewingAcknowledged = false;
    }

    if (
      effectiveViewingPreference !== "remote_2d_viewing" &&
      rawViewingPreference !== undefined &&
      !hasBodyField("remoteViewingQuestions")
    ) {
      updates.remoteViewingQuestions = "";
    }

    const effectiveRemoteViewingAcknowledged =
      updates.remoteViewingAcknowledged ?? reservation.remoteViewingAcknowledged;
    const effectiveVisitDate = updates.visitDate ?? reservation.visitDate;
    const effectiveVisitTime = updates.visitTime ?? reservation.visitTime;
    const resetDocumentPrecheck = (bodyField, precheckField) => {
      if (!hasBodyField(bodyField)) return;
      const nextUrl = updates[bodyField] ?? req.body[bodyField] ?? "";
      const currentUrl = reservation[bodyField] ?? "";
      if (String(nextUrl || "") === String(currentUrl || "")) return;
      updates[`documentPrechecks.${precheckField}`] = buildEmptyDocumentPrecheck();
    };

    resetDocumentPrecheck("validIDFrontUrl", "validIDFront");
    resetDocumentPrecheck("validIDBackUrl", "validIDBack");
    resetDocumentPrecheck("nbiClearanceUrl", "nbiClearance");
    resetDocumentPrecheck("companyIDUrl", "companyID");

    if (
      effectiveViewingPreference === "physical_visit" &&
      (rawViewingPreference !== undefined || hasBodyField("visitDate") || hasBodyField("visitTime"))
    ) {
      if (!effectiveVisitDate || !effectiveVisitTime) {
        return res.status(422).json({
          error:
            "Preferred visit date and time slot are required when scheduling a physical visit.",
          code: "PHYSICAL_VISIT_DETAILS_REQUIRED",
        });
      }
    }

    if (
      effectiveViewingPreference === "remote_2d_viewing" &&
      (rawViewingPreference !== undefined ||
        hasBodyField("remoteViewingAcknowledged") ||
        hasBodyField("remoteViewingQuestions"))
    ) {
      if (effectiveRemoteViewingAcknowledged !== true) {
        return res.status(422).json({
          error:
            "Please confirm the photo-based 2D remote viewing acknowledgement before continuing.",
          code: "REMOTE_VIEWING_ACKNOWLEDGEMENT_REQUIRED",
        });
      }
    }

    if (
      rawViewingPreference !== undefined &&
      effectiveViewingPreference !== "physical_visit"
    ) {
      updates.visitDate = null;
      updates.visitTime = "";
      updates.visitCode = null;
      updates.visitScheduledAt = null;
      updates.visitApproved = false;
      updates.scheduleApproved = false;
      updates.scheduleApprovedAt = null;
      updates.scheduleRejected = false;
      updates.scheduleRejectedAt = null;
      updates.scheduleRejectedBy = null;
      updates.scheduleRejectionReason = null;
      updates.visitStatus = null;
      updates.visitOutcomeNotes = "";
      updates.visitOutcomeUpdatedAt = null;
      updates.visitOutcomeUpdatedBy = null;
      updates.visitOutcomeUpdatedByName = "";
    }

    // Generate visitCode when visitDate is first set (bypassed by findByIdAndUpdate)
    if (effectiveViewingPreference === "physical_visit" && updates.visitDate) {
      const existingForCode = await Reservation.findById(reservationId)
        .select("visitCode visitScheduledAt")
        .lean();
      if (!existingForCode?.visitCode) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let visitCode = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          let code = "VIS-";
          for (let i = 0; i < 6; i++)
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          const taken = await Reservation.findOne({ visitCode: code })
            .select("_id")
            .lean();
          if (!taken) {
            visitCode = code;
            break;
          }
        }
        updates.visitCode =
          visitCode || "VIS-" + Date.now().toString(36).toUpperCase().slice(-6);
      }
      // Stamp the submission time — this is "when the tenant scheduled the visit",
      // NOT the visit appointment date. Always refresh on rescheduling too.
      updates.visitScheduledAt = new Date();
      updates.visitStatus = "physical_visit_scheduled";
      updates.visitOutcomeNotes = "";
      updates.visitOutcomeUpdatedAt = null;
      updates.visitOutcomeUpdatedBy = null;
      updates.visitOutcomeUpdatedByName = "";
    }

    if (
      effectiveViewingPreference === "physical_visit" &&
      (updates.visitDate || updates.visitTime)
    ) {
      const targetVisitDate = updates.visitDate || reservation.visitDate;
      const targetVisitTime = updates.visitTime || reservation.visitTime;
      const room = await Room.findById(reservation.roomId).select("branch").lean();
      if (!room?.branch) {
        return res.status(400).json({
          error: "Unable to resolve the room branch for this visit.",
          code: "ROOM_BRANCH_REQUIRED",
        });
      }

      const validation = await validateVisitSelection({
        branch: room.branch,
        visitDate: targetVisitDate,
        visitTime: targetVisitTime,
        roomId: reservation.roomId,
        excludeReservationId: reservationId,
      });

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          code: validation.code,
        });
      }

      if (updates.visitDate) {
        updates.visitDate = validation.date;
      }
    }

    // ── Visit date: reject past dates ───────────────────────
    if (effectiveViewingPreference === "physical_visit" && updates.visitDate) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (new Date(updates.visitDate) < todayStart) {
        return res.status(400).json({
          error: "Visit date cannot be in the past. Please select a future date.",
          code: "VISIT_DATE_IN_PAST",
        });
      }
    }

    // ── Visit time-slot collision check ─────────────────────
    // Prevent two applicants from booking the same room at the same date/time
    if (effectiveViewingPreference === "physical_visit" && updates.visitDate) {
      const targetVisitTime = updates.visitTime || reservation.visitTime;

      // Configured capacity is validated by validateVisitSelection above.
      // Keep the room-specific conflict check for existing audit behavior.
      const conflicting = await Reservation.findOne({
        _id: { $ne: reservationId },
        roomId: reservation.roomId,
        visitDate: updates.visitDate,
        visitTime: targetVisitTime,
        status: {
          $in: reservationStatusesForQuery("visit_pending", "visit_approved"),
        },
        isArchived: { $ne: true },
      })
        .select("_id visitDate visitTime")
        .lean();

      if (conflicting) {
        return res.status(409).json({
          error:
            "This time slot is already taken. Please choose a different date or time.",
          code: "VISIT_SLOT_CONFLICT",
          conflict: {
            visitDate: conflicting.visitDate,
            visitTime: conflicting.visitTime,
          },
        });
      }
    }

    // ── Status-driven auto-transitions ──────────────────────
    // Reset rejection state when tenant reschedules after a rejection
    if (
      effectiveViewingPreference === "physical_visit" &&
      updates.visitDate &&
      updates.agreedToPrivacy &&
      reservation.scheduleRejected
    ) {
      updates.scheduleRejected = false;
      updates.scheduleRejectionReason = null;
      updates.scheduleRejectedAt = null;
      if (hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES, "pending")) {
        updates.status = "visit_pending";
      }
      // Don't push "pending" to visitHistory — the active visit row shows the current attempt.
      // Only terminal outcomes (rejected, approved, cancelled) belong in visitHistory.
    }
    // pending → visit_pending: when tenant first schedules a visit
    const effectiveAgreedToPrivacy =
      updates.agreedToPrivacy ?? reservation.agreedToPrivacy;
    const submittedPhysicalVisitSchedule =
      effectiveViewingPreference === "physical_visit" &&
      preferenceRelatedUpdate &&
      Boolean(effectiveVisitDate && effectiveVisitTime) &&
      effectiveAgreedToPrivacy === true;

    if (
      submittedPhysicalVisitSchedule &&
      hasReservationStatus(
        reservation.status,
        "pending",
        "viewing_preference_selected",
        LEGACY_VISIT_STATUSES,
      )
    ) {
      updates.status = "visit_pending";
    } else if (
      effectiveViewingPreference &&
      preferenceRelatedUpdate &&
      hasReservationStatus(reservation.status, "pending")
    ) {
      updates.status = "viewing_preference_selected";
    }
    if (
      effectiveViewingPreference === "physical_visit" &&
      updates.visitDate &&
      updates.agreedToPrivacy &&
      hasReservationStatus(reservation.status, LEGACY_VISIT_STATUSES)
    ) {
      updates.status = "visit_pending";
    }
    if (false && updates.visitDate && updates.agreedToPrivacy) {
      if (hasReservationStatus(reservation.status, "pending")) {
        updates.status = "visit_pending";
        // Don't push "pending" to visitHistory here — the active visit row shows current state.
        // History only records terminal outcomes (rejected, approved, cancelled).
      }
    }
    // visit_approved → payment_pending: when tenant submits full application
    const isApplicationSubmission = req.body.submitApplication === true;

    if (isApplicationSubmission) {
      const previouslySubmittedApplication = Boolean(reservation.applicationSubmittedAt);
      // Use getEffectiveVisitStatusKey so old records where visitApproved=true
      // but visitStatus was never written still resolve to "visit_completed".
      const effectiveVisitStatus = getEffectiveVisitStatusKey({
        visitStatus: updates.visitStatus ?? reservation.visitStatus,
        visitApproved: reservation.visitApproved,
        scheduleRejected: reservation.scheduleRejected,
        scheduleApproved: reservation.scheduleApproved,
        viewingPreference: reservation.viewingPreference,
        viewingType: reservation.viewingType,
        visitDate: reservation.visitDate,
      });

      if (
        effectiveViewingPreference === "physical_visit" &&
        !previouslySubmittedApplication &&
        !isVisitApplicationUnlocked(effectiveVisitStatus)
      ) {
        return res.status(403).json({
          error:
            "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
          code: "PHYSICAL_VISIT_APPLICATION_LOCKED",
          visitStatus: effectiveVisitStatus || "physical_visit_scheduled",
        });
      }

      // Enforce minimum required fields before accepting the application.
      // Mirrors client-side validation in useReservationFlow stage 3 so direct
      // API calls cannot bypass the form.
      //
      // Each check uses (updates.<field> ?? reservation.<field>) so partial
      // auto-saves are tolerated — only the final merged value is validated.
      //
      // NOTE: buildUserUpdatePayload stores emergency contact under dot-notation
      // keys ("emergencyContact.name") for MongoDB $set — NOT as flat JS props.
      const missingRequired = [];
      const hasVal = (v) => v != null && String(v).trim().length > 0;
      const isValidPHPhone = (v) => v != null && /^09\d{9}$/.test(String(v));
      const isValidTargetMoveInDate = (value) => {
        if (!hasVal(value)) return false;
        const date = dayjs(value);
        if (!date.isValid()) return false;
        const minDate = dayjs().add(3, "day").startOf("day");
        return validateMoveInDate(value) && !date.isBefore(minDate);
      };
      const isAdultBirthday = (value) => {
        if (!hasVal(value)) return false;
        const birthdayDate = dayjs(value);
        if (!birthdayDate.isValid()) return false;
        return !birthdayDate.isAfter(dayjs().subtract(18, "year"), "day");
      };
      const isValidMoveInTime = (value) => {
        if (!hasVal(value)) return false;
        const match = /^(\d{2}):(\d{2})$/.exec(String(value).trim());
        if (!match) return false;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        const totalMinutes = hours * 60 + minutes;
        return minutes >= 0 && minutes < 60 && totalMinutes >= 480 && totalMinutes <= 1080;
      };
      const effectiveFirstName = updates.firstName ?? reservation.firstName;
      const effectiveLastName = updates.lastName ?? reservation.lastName;
      const effectiveMobileNumber = updates.mobileNumber ?? reservation.mobileNumber;
      const effectiveBirthday = updates.birthday ?? reservation.birthday;
      const effectiveMaritalStatus = updates.maritalStatus ?? reservation.maritalStatus;
      const effectiveNationality = updates.nationality ?? reservation.nationality;
      const effectiveEducationLevel = updates.educationLevel ?? reservation.educationLevel;
      const effectiveAddressRegion =
        updates["address.region"] ?? reservation.address?.region;
      const effectiveAddressUnit =
        updates["address.unitHouseNo"] ?? reservation.address?.unitHouseNo;
      const effectiveAddressStreet =
        updates["address.street"] ?? reservation.address?.street;
      const effectiveAddressProvince =
        updates["address.province"] ?? reservation.address?.province;
      const effectiveAddressCity =
        updates["address.city"] ?? reservation.address?.city;
      const effectiveAddressBarangay =
        updates["address.barangay"] ?? reservation.address?.barangay;
      const effectiveEmergencyName =
        updates["emergencyContact.name"] ?? reservation.emergencyContact?.name;
      const effectiveEmergencyRelationship =
        updates["emergencyContact.relationship"] ??
        reservation.emergencyContact?.relationship;
      const effectiveEmergencyPhone =
        updates["emergencyContact.contactNumber"] ??
        reservation.emergencyContact?.contactNumber;
      const effectiveHealthConcerns =
        updates.healthConcerns ?? reservation.healthConcerns;
      const effectiveEmployerSchool =
        updates["employment.employerSchool"] ??
        reservation.employment?.employerSchool;
      const effectiveEmployerAddress =
        updates["employment.employerAddress"] ??
        reservation.employment?.employerAddress;
      const effectiveOccupation =
        updates["employment.occupation"] ?? reservation.employment?.occupation;
      const effectiveReferralSource =
        updates.referralSource ?? reservation.referralSource;
      const effectiveTargetMoveInDate =
        updates.targetMoveInDate ?? reservation.targetMoveInDate;
      const effectiveEstimatedMoveInTime =
        updates.estimatedMoveInTime ?? reservation.estimatedMoveInTime;
      const effectiveLeaseDuration =
        updates.leaseDuration ?? reservation.leaseDuration;
      const effectiveWorkSchedule =
        updates.workSchedule ?? reservation.workSchedule;
      const effectiveWorkScheduleOther =
        updates.workScheduleOther ?? reservation.workScheduleOther;
      const submittedPrivacyAgreement =
        hasSubmittedField(req.body, "agreedToPrivacy") &&
        req.body.agreedToPrivacy === true;
      const submittedCertificationAgreement =
        hasSubmittedField(req.body, "agreedToCertification") &&
        req.body.agreedToCertification === true;

      if (!hasVal(effectiveViewingPreference))
        missingRequired.push("viewing / move-in preference");
      if (!hasVal(effectiveFirstName)) missingRequired.push("first name");
      if (!hasVal(effectiveLastName)) missingRequired.push("last name");
      if (!isValidPHPhone(effectiveMobileNumber))
        missingRequired.push("mobile number");
      if (!isAdultBirthday(effectiveBirthday))
        missingRequired.push("birthday (applicant must be at least 18)");
      if (!hasVal(effectiveMaritalStatus)) missingRequired.push("marital status");
      if (!hasVal(effectiveNationality)) missingRequired.push("nationality");
      if (!hasVal(effectiveEducationLevel))
        missingRequired.push("educational attainment");
      if (!hasVal(effectiveAddressUnit)) missingRequired.push("unit / house no.");
      if (!hasVal(effectiveAddressStreet)) missingRequired.push("street");
      if (!hasVal(effectiveAddressRegion)) missingRequired.push("region");
      if (!hasVal(effectiveAddressProvince)) missingRequired.push("province");
      if (!hasVal(effectiveAddressCity)) missingRequired.push("city / municipality");
      if (!hasVal(effectiveAddressBarangay)) missingRequired.push("barangay");
      if (!hasVal(updates.selfiePhotoUrl || reservation.selfiePhotoUrl))
        missingRequired.push("profile photo");
      if (!hasVal(effectiveEmergencyName))
        missingRequired.push("emergency contact name");
      if (!hasVal(effectiveEmergencyRelationship))
        missingRequired.push("emergency contact relationship");
      if (!isValidPHPhone(effectiveEmergencyPhone))
        missingRequired.push("emergency contact phone");
      if (!hasVal(effectiveHealthConcerns)) missingRequired.push("health concerns");
      if (!hasVal(effectiveEmployerSchool))
        missingRequired.push("current employer / school");
      if (!hasVal(effectiveEmployerAddress)) missingRequired.push("employer address");
      if (!hasVal(effectiveOccupation)) missingRequired.push("occupation");
      if (!hasVal(effectiveReferralSource)) missingRequired.push("referral source");
      if (!isValidTargetMoveInDate(effectiveTargetMoveInDate))
        missingRequired.push("target move-in date");
      if (!isValidMoveInTime(effectiveEstimatedMoveInTime))
        missingRequired.push("estimated move-in time");
      if (
        !Number.isFinite(Number(effectiveLeaseDuration)) ||
        Number(effectiveLeaseDuration) <= 0
      ) {
        missingRequired.push("duration of lease");
      }
      if (!hasVal(effectiveWorkSchedule)) missingRequired.push("work schedule");
      if (
        effectiveWorkSchedule === "others" &&
        !hasVal(effectiveWorkScheduleOther)
      ) {
        missingRequired.push("work schedule details");
      }
      const effectiveValidIDFrontUrl =
        updates.validIDFrontUrl ?? reservation.validIDFrontUrl;
      const effectiveValidIDBackUrl =
        updates.validIDBackUrl ?? reservation.validIDBackUrl;
      if (!hasVal(effectiveValidIDFrontUrl))
        missingRequired.push("valid ID (front)");
      if (!hasVal(effectiveValidIDBackUrl))
        missingRequired.push("valid ID (back)");
      const submittedIdType =
        updates.idType ||
        updates.validIDType ||
        reservation.idType ||
        reservation.validIDType;
      if (!hasVal(submittedIdType))
        missingRequired.push("ID type");

      if (
        effectiveViewingPreference === "physical_visit" &&
        (!effectiveVisitDate || !effectiveVisitTime)
      ) {
        missingRequired.push("preferred physical visit schedule");
      }
      if (
        effectiveViewingPreference === "remote_2d_viewing" &&
        effectiveRemoteViewingAcknowledged !== true
      ) {
        missingRequired.push("2D remote viewing acknowledgement");
      }

      // — NBI clearance: upload or written reason required
      const effectiveNbiUrl = updates.nbiClearanceUrl ?? reservation.nbiClearanceUrl;
      const effectiveNbiReason = updates.nbiReason ?? reservation.nbiReason;
      if (!hasVal(effectiveNbiUrl) && !hasVal(effectiveNbiReason))
        missingRequired.push("NBI clearance (upload or provide a reason)");

      // — Company ID: upload or written reason required
      const effectiveCompanyUrl = updates.companyIDUrl ?? reservation.companyIDUrl;
      const effectiveCompanyReason = updates.companyIDReason ?? reservation.companyIDReason;
      if (!hasVal(effectiveCompanyUrl) && !hasVal(effectiveCompanyReason))
        missingRequired.push("company ID (upload or provide a reason)");

      // — Employer contact: optional, but must be a valid PH number if provided
      const effectiveEmployerContact =
        updates["employment.employerContact"] ?? reservation.employment?.employerContact;
      if (effectiveEmployerContact) {
        const d = String(effectiveEmployerContact).replace(/[\s\-()]/g, "");
        const isValidEmployerPhone = /^09\d{9}$/.test(d) || /^0[2-8]\d{7,8}$/.test(d);
        if (!isValidEmployerPhone) {
          missingRequired.push(
            "employer contact number (invalid format — must be a valid Philippine mobile or landline)",
          );
        }
      }

      // — Agreements must be explicitly true
      if (!submittedPrivacyAgreement)
        missingRequired.push("privacy policy agreement");
      if (!submittedCertificationAgreement)
        missingRequired.push("certification agreement");

      if (missingRequired.length > 0) {
        return res.status(422).json({
          error: `Application cannot be submitted. The following required fields are missing or invalid: ${missingRequired.join(", ")}.`,
          code: "APPLICATION_INCOMPLETE",
          missingFields: missingRequired,
        });
      }

      const runRequiredDocumentPrecheck = async ({
        documentType,
        documentUrl,
        idType,
      }) => {
        const config = DOCUMENT_PRECHECK_TYPES[documentType];
        if (!config || !documentUrl) return null;

        const nextUrl = String(documentUrl || "");
        const currentUrl = String(reservation[config.reservationField] || "");
        const urlChanged = nextUrl !== currentUrl;
        let precheck =
          updates[`documentPrechecks.${config.precheckField}`] ||
          reservation.documentPrechecks?.[config.precheckField] ||
          buildEmptyDocumentPrecheck();
        const status = getDocumentPrecheckStatus(precheck);
        const urlAllowed = isAllowedReservationDocumentUrl(nextUrl);

        if (
          !urlAllowed ||
          urlChanged ||
          status === "not_checked" ||
          status === "checking"
        ) {
          precheck = await runReservationDocumentPrecheck({
            documentType,
            documentUrl: nextUrl,
            idType,
          });
          updates[`documentPrechecks.${config.precheckField}`] = precheck;
        }

        return precheck;
      };

      const requiredDocumentPrechecks = [
        {
          key: "validIDFront",
          label: "Valid ID (Front)",
          documentType: "valid_id_front",
          documentUrl: effectiveValidIDFrontUrl,
          idType: submittedIdType,
        },
        {
          key: "validIDBack",
          label: "Valid ID (Back)",
          documentType: "valid_id_back",
          documentUrl: effectiveValidIDBackUrl,
          idType: submittedIdType,
        },
        effectiveNbiUrl
          ? {
              key: "nbiClearance",
              label: "NBI Clearance",
              documentType: "nbi_clearance",
              documentUrl: effectiveNbiUrl,
            }
          : null,
        effectiveCompanyUrl
          ? {
              key: "companyID",
              label: "Company ID",
              documentType: "company_id",
              documentUrl: effectiveCompanyUrl,
            }
          : null,
      ].filter(Boolean);

      const documentIssues = [];
      for (const target of requiredDocumentPrechecks) {
        const precheck = await runRequiredDocumentPrecheck(target);
        if (shouldBlockDocumentSubmission(precheck)) {
          documentIssues.push({
            key: target.key,
            label: target.label,
            precheckStatus: precheck?.precheckStatus || "needs_reupload",
            readabilityStatus: precheck?.readabilityStatus || "unknown",
            documentTypeStatus: precheck?.documentTypeStatus || "unknown",
            message:
              precheck?.applicantMessage ||
              precheck?.summaryMessage ||
              `${target.label} needs a clearer upload before submission.`,
          });
        }
      }

      if (documentIssues.length > 0) {
        return res.status(422).json({
          error: `Please fix the following document before submitting: ${documentIssues
            .map((issue) => `${issue.label} - ${issue.message}`)
            .join("; ")}`,
          code: "DOCUMENT_PRECHECK_BLOCKED",
          documentIssues,
        });
      }

      if (submittedIdType) {
        updates.idType = submittedIdType;
        updates.validIDType = submittedIdType;
      }

      updates.status = "pending_application_review";
      updates.applicationSubmittedAt = new Date();
      if (previouslySubmittedApplication) {
        updates.applicationResubmittedAt = new Date();
      }
      updates.applicationReviewReason = null;
      updates.applicationReviewedAt = null;
      updates.applicationReviewedBy = null;
      updates.approvedForPaymentAt = null;
    }

    // Payment proof handling
    if (req.body.proofOfPaymentUrl) {
      const effectiveStatusForPayment = normalizeReservationStatus(
        updates.status ?? reservation.status,
      );
      if (!shouldAllowPaymentAccess(effectiveStatusForPayment)) {
        return res.status(403).json({
          error:
            "Payment is still locked. It will only be available after your application and documents are approved.",
          code: "PAYMENT_LOCKED_PENDING_APPLICATION_REVIEW",
        });
      }
      updates.paymentStatus = "pending";
      updates.paymentDate = new Date();
      updates.status = "payment_pending";
      const existing = await Reservation.findById(reservationId);
      if (!existing.paymentReference) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let ref = "PAY-";
        for (let i = 0; i < 6; i++)
          ref += chars.charAt(Math.floor(Math.random() * chars.length));
        updates.paymentReference = ref;
      }
    }

    if (
      updates.status !== undefined &&
      !canTransitionReservationStatus(reservation.status, updates.status)
    ) {
      return res.status(400).json({
        error: `Invalid reservation status transition from "${normalizeReservationStatus(reservation.status)}" to "${normalizeReservationStatus(updates.status)}".`,
        code: "INVALID_RESERVATION_STATUS_TRANSITION",
      });
    }

    if (
      updates.status === "reserved" &&
      !reservation.reservationCode &&
      !updates.reservationCode
    ) {
      updates.reservationCode = await Reservation.generateUniqueReservationCode();
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate(...POPULATE_USER)
      .populate(...POPULATE_ROOM);

    res.json({
      message: "Reservation updated successfully",
      reservation: updatedReservation,
      ...(appliedPricing ? { pricing: appliedPricing.breakdown } : {}),
    });

    if (updatedReservation.userId?._id) {
      if (isApplicationSubmission) {
        try {
          const { notify } = await import("../utils/notificationService.js");
          await notify.general(
            updatedReservation.userId._id,
            "Application Pending Review",
            "Your application is pending review. Payment will be available once your application and documents are approved.",
            {
              entityType: "reservation",
              entityId: String(updatedReservation._id),
              actionUrl: "/applicant/reservation",
            },
          );
        } catch (notifyErr) {
          logger.warn(
            { err: notifyErr, requestId: req.id },
            "Pending-review notification failed (non-fatal)",
          );
        }
      } else if (
        preferenceRelatedUpdate &&
        effectiveViewingPreference &&
        !req.body.proofOfPaymentUrl
      ) {
        try {
          const { notify } = await import("../utils/notificationService.js");
          if (effectiveViewingPreference === "physical_visit") {
            const visitDateLabel = updatedReservation.visitDate
              ? new Date(updatedReservation.visitDate).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "your preferred date";
            const visitTimeLabel = updatedReservation.visitTime || "your preferred time slot";
            await notify.general(
              updatedReservation.userId._id,
              "Physical Visit Preference Saved",
              `Your preferred visit schedule for ${visitDateLabel} at ${visitTimeLabel} was recorded. Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.`,
              {
                entityType: "reservation",
                entityId: String(updatedReservation._id),
                actionUrl: "/applicant/reservation",
              },
            );
            if (updatedReservation.userId?.email) {
              await sendPhysicalVisitStatusEmail(
                buildVisitEmailContext({
                  reservation: updatedReservation,
                  status: "scheduled",
                }),
              );
            }
          } else if (effectiveViewingPreference === "remote_2d_viewing") {
            await notify.general(
              updatedReservation.userId._id,
              "2D Remote Viewing Request Submitted",
              "Your photo-based viewing preference was saved. Payment will only be available after your application and documents are approved.",
              {
                entityType: "reservation",
                entityId: String(updatedReservation._id),
                actionUrl: "/applicant/reservation",
              },
            );
          } else if (effectiveViewingPreference === "urgent_move_in_review") {
            await notify.general(
              updatedReservation.userId._id,
              "Urgent Move-in Review Requested",
              "Your urgent move-in request was recorded for admin review. Payment will only be available after your application and documents are approved.",
              {
                entityType: "reservation",
                entityId: String(updatedReservation._id),
                actionUrl: "/applicant/reservation",
              },
            );
          }
        } catch (notifyErr) {
          logger.warn(
            { err: notifyErr, requestId: req.id },
            "Viewing preference notification failed (non-fatal)",
          );
        }
      }
    }

    // Notify admins when tenant submits payment proof so the payment tab refreshes
    if (req.body.proofOfPaymentUrl) {
      try {
        const { emitToAdmins } = await import("../utils/socket.js");
        emitToAdmins("payment:updated", {
          reservationId: String(updatedReservation._id),
          paymentStatus: updatedReservation.paymentStatus,
        });
      } catch (socketErr) {
        logger.warn({ err: socketErr }, "Socket emit failed after tenant proof upload (non-fatal)");
      }
    }
  } catch (error) {
    if (isActiveBedAssignmentDuplicateError(error)) {
      return res.status(409).json({
        error: BED_UNAVAILABLE_MESSAGE,
        code: "BED_UNAVAILABLE",
      });
    }
    logger.error(
      { err: error, requestId: req.id },
      "User reservation update error",
    );
    handleReservationError(res, error, "update");
  }
};

/* ─── DELETE reservation ─────────────────────────── */
export const deleteReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const isHardDelete = String(req.query?.hardDelete || "").toLowerCase() === "true";
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });

    const reservation =
      await Reservation.findById(reservationId).populate("roomId");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    const isOwner = String(reservation.userId) === String(dbUser._id);
    const isAdmin =
      isAdminRole(dbUser.role);
    if (!isOwner && !isAdmin)
      return res.status(403).json({
        error: "Access denied. You can only delete your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    if (
      dbUser.role === "branch_admin" &&
      reservation.roomId?.branch !== dbUser.branch
    )
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${dbUser.branch} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });

    const [issuedBillCount, draftBillCount] = await Promise.all([
      Bill.countDocuments({
        reservationId: reservation._id,
        isArchived: false,
        status: { $ne: "draft" },
      }),
      Bill.countDocuments({
        reservationId: reservation._id,
        isArchived: false,
        status: "draft",
      }),
    ]);

    if (isHardDelete && issuedBillCount > 0) {
      return res.status(409).json({
        error:
          "Hard delete blocked. This reservation has issued bills and must be archived instead.",
        code: "HARD_DELETE_BLOCKED",
        safeguards: {
          issuedBills: issuedBillCount,
          draftBills: draftBillCount,
        },
      });
    }

    const reservationData = reservation.toObject();

    // Release occupancy — use toObject() to avoid Mongoose getter issues with spread
    const hadOccupancy = hasReservationStatus(
      reservation.status,
      ACTIVE_STAY_STATUS_QUERY,
    );
    if (hadOccupancy) {
      try {
        await updateOccupancyOnReservationChange(
          { ...reservationData, status: "cancelled" },
          reservationData,
        );
        logger.info(
          { requestId: req.id, reservationId },
          `Occupancy released (was ${reservation.status})`,
        );
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Occupancy release during deletion failed",
        );
      }
    }

    if (!isHardDelete) {
      if (hadOccupancy && reservation.status !== "cancelled") {
        reservation.status = "cancelled";
      }
      reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Archived via delete endpoint`;
      await reservation.archive(dbUser._id);

      await syncReservationUserLifecycle({
        status: "archived",
        previousStatus: reservationData.status,
        userId: reservation.userId?._id || reservation.userId,
        roomId: reservation.roomId?._id || reservation.roomId,
        reservationId: reservation._id,
        force: true,
      });

      if (reservation.roomId?._id) {
        try {
          const { recalculateRoomOccupancy } =
            await import("../utils/occupancyManager.js");
          await recalculateRoomOccupancy(reservation.roomId._id);
          logger.info(
            { requestId: req.id, roomId: reservation.roomId._id },
            "Recalculated room occupancy after archive",
          );
        } catch (e) {
          logger.warn(
            { err: e, requestId: req.id },
            "Occupancy recalculation failed",
          );
        }
      }

      await auditLogger.logModification(
        req,
        "reservation",
        reservationId,
        reservationData,
        reservation.toObject(),
        "Reservation archived via delete endpoint",
      );

      return res.json({
        message: "Reservation archived successfully",
        reservationId,
        archived: true,
        hardDelete: false,
        safeguards: {
          issuedBills: issuedBillCount,
          draftBills: draftBillCount,
        },
      });
    }

    if (draftBillCount > 0) {
      await Bill.deleteMany({
        reservationId: reservation._id,
        isArchived: false,
        status: "draft",
      });
    }

    // Delete the reservation FIRST, then recalculate occupancy
    await Reservation.findByIdAndDelete(reservationId);

    await syncReservationUserLifecycle({
      status: "archived",
      previousStatus: reservationData.status,
      userId: reservation.userId?._id || reservation.userId,
      roomId: reservation.roomId?._id || reservation.roomId,
      reservationId: reservation._id,
      force: true,
    });

    // Safety net: recalculate room occupancy from remaining reservations
    // MUST run AFTER deletion — otherwise it recounts the deleted reservation
    if (reservation.roomId?._id) {
      try {
        const { recalculateRoomOccupancy } =
          await import("../utils/occupancyManager.js");
        await recalculateRoomOccupancy(reservation.roomId._id);
        logger.info(
          { requestId: req.id, roomId: reservation.roomId._id },
          "Recalculated room occupancy after deletion",
        );
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Occupancy recalculation failed",
        );
      }
    }

    await auditLogger.logDeletion(
      req,
      "reservation",
      reservationId,
      reservationData,
    );
    res.json({
      message: "Reservation permanently deleted",
      reservationId,
      hardDelete: true,
      cleanup: {
        deletedDraftBills: draftBillCount,
      },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Delete reservation error");
    await auditLogger.logError(req, error, "Failed to delete reservation");
    handleReservationError(res, error, "delete");
  }
};

/* ─── EXTEND reservation ─────────────────────────── */
export const extendReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { extensionDays = 3 } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate(
      "roomId",
      "branch",
    );
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const moveOutBills = await Bill.find({
      reservationId: reservation._id,
      isArchived: { $ne: true },
    }).lean();
    const moveOutBilling = buildBillingSummary(moveOutBills, new Date());
    if (
      moveOutBilling.hasOutstanding ||
      moveOutBilling.hasPendingVerification
    ) {
      return res.status(409).json({
        error:
          "Move-out is blocked until the tenant's billing is fully settled.",
        code: "UNSETTLED_BILLING",
        billing: {
          currentBalance: moveOutBilling.currentBalance,
          pendingVerification: moveOutBilling.hasPendingVerification,
          paymentStatus: moveOutBilling.paymentStatus,
        },
      });
    }

    const oldData = reservation.toObject();
    const newMoveIn = new Date(
      readMoveInDate(reservation) || reservation.finalMoveInDate,
    );
    newMoveIn.setDate(newMoveIn.getDate() + extensionDays);

    reservation.moveInDate = newMoveIn;
    reservation.finalMoveInDate = newMoveIn;
    reservation.moveInExtendedTo = newMoveIn;
    // Keep status as reserved — admin extended the deadline
    if (reservation.status !== "reserved") {
      reservation.status =
        reservation.paymentStatus === "paid" ? "reserved" : "pending";
    }

    await reservation.save();
    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Extended move-in date by ${extensionDays} days`,
    );
    res.json({
      message: `Reservation extended by ${extensionDays} days`,
      newMoveInDate: newMoveIn,
      reservation: serializeReservation(reservation),
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Extend reservation error");
    await auditLogger.logError(req, error, "Failed to extend reservation");
    handleReservationError(res, error, "extend");
  }
};

/* ─── RELEASE SLOT ───────────────────────────────── */
export const releaseSlot = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { reason = "No-show after move-in date" } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation =
      await Reservation.findById(reservationId).populate("roomId");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const oldData = reservation.toObject();
    reservation.status = "cancelled";
    reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Released: ${reason}`;
    await reservation.save();

    // Reset user
    await syncReservationUserLifecycle({
      status: "cancelled",
      previousStatus: oldData.status,
      userId: reservation.userId,
      roomId: reservation.roomId,
      reservationId: reservation._id,
    });

    try {
      await updateOccupancyOnReservationChange(
        {
          ...reservation.toObject(),
          roomId: reservation.roomId?._id || reservation.roomId,
        },
        oldData,
      );
    } catch (occupancyErr) {
      logger.warn(
        { err: occupancyErr, requestId: req.id },
        "Occupancy update during slot release failed",
      );
    }

    await reservation.populate(...POPULATE_USER);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Slot released: ${reason}`,
    );
    res.json({
      message: "Reservation slot released successfully",
      reason,
      reservation,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Release slot error");
    await auditLogger.logError(
      req,
      error,
      "Failed to release reservation slot",
    );
    handleReservationError(res, error, "release slot");
  }
};

/* ─── ARCHIVE reservation ────────────────────────── */
export const archiveReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { reason = "Archived by admin" } = req.body;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate(
      "roomId",
      "branch",
    );
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const oldData = reservation.toObject();
    const dbUser = await findDbUser(req.user.uid);

    // Release occupancy if was active
    if (hasReservationStatus(reservation.status, ACTIVE_STAY_STATUS_QUERY)) {
      const prevStatus = reservation.status;
      reservation.status = "cancelled";
      await reservation.save();
      try {
        await updateOccupancyOnReservationChange(reservation, {
          ...oldData,
          status: prevStatus,
        });
      } catch (e) {
        logger.warn(
          { err: e, requestId: req.id },
          "Occupancy update during archive failed",
        );
      }
    }

    reservation.isArchived = true;
    reservation.archivedAt = new Date();
    reservation.archivedBy = dbUser?._id || null;
    reservation.notes = `${reservation.notes ? reservation.notes + " | " : ""}Archived: ${reason}`;
    await reservation.save();

    await syncReservationUserLifecycle({
      status: "archived",
      previousStatus: oldData.status,
      userId: reservation.userId,
      roomId: reservation.roomId,
      reservationId: reservation._id,
    });

    await reservation.populate(...POPULATE_USER);
    await reservation.populate(...POPULATE_ROOM);
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      reservation.toObject(),
      `Reservation archived: ${reason}`,
    );
    res.json({
      message: "Reservation archived successfully",
      reason,
      reservation,
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Archive reservation error",
    );
    await auditLogger.logError(req, error, "Failed to archive reservation");
    handleReservationError(res, error, "archive");
  }
};

/* ─── RENEW CONTRACT ─────────────────────────────── */
export const renewContract = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId).populate("roomId", "branch");
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND" });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const actor = await findDbUser(req.user.uid);
    const previousStaySnapshot = await Stay.findOne({
      reservationId,
      status: "active",
    }).lean();
    const result = await renewStayWorkflow({
      reservationId,
      payload: req.body,
      actorId: actor?._id || null,
    });

    const { notify } = await import("../utils/notificationService.js");
    const roomName = result.reservation.roomId?.name || "your room";
    notify.general(
      result.reservation.userId?._id || result.reservation.userId,
      "Contract Renewed",
      `Your lease for ${roomName} has been renewed through ${dayjs(result.stay.leaseEndDate).format("MMM D, YYYY")}.`,
      { entityType: "stay" },
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      { reservation: reservation.toObject(), stay: previousStaySnapshot },
      { reservation: result.reservation.toObject(), stay: result.stay },
      "Tenant stay renewed",
    );

    res.json({
      message: "Lease renewed successfully",
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Renew contract error");
    await auditLogger.logError(req, error, "Failed to renew contract");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || "RENEW_FAILED" });
    }
    handleReservationError(res, error, "renew");
  }
};

/* ─── MOVE-OUT ───────────────────────────────────── */
export const moveOutReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { meterReading } = req.body || {};
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("roomId")
      .populate("userId", "firstName lastName email");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    if (!hasReservationStatus(reservation.status, "moveIn")) {
      return res.status(400).json({
        error: "Only moved-in tenants can be moved out.",
        code: "INVALID_STATUS_FOR_MOVEOUT",
      });
    }

    // Meter reading is required at move-out
    if (meterReading == null || isNaN(Number(meterReading))) {
      return res.status(400).json({
        error: "A meter reading (kWh) is required when moving out a tenant.",
        code: "METER_READING_REQUIRED",
      });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const actor = await findDbUser(req.user.uid);
    const oldData = reservation.toObject();
    const result = await moveOutStayWorkflow({
      reservationId,
      payload: req.body,
      actorId: actor?._id || null,
    });

    const { notify } = await import("../utils/notificationService.js");
    const roomName = result.reservation.roomId?.name || "your room";
    notify.general(
      result.reservation.userId?._id || result.reservation.userId,
      "Move-Out Complete",
      `You have been moved out from ${roomName}. Thank you for staying at Lilycrest!`,
      { entityType: "stay" },
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      {
        reservation: result.reservation.toObject(),
        stay: result.stay,
        billingSummary: result.billingSummary,
      },
      `Tenant moved out from ${roomName}`,
    );

    res.json({
      message: "Tenant moved out successfully",
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
      finalBillingSummary: result.billingSummary,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Move-out error");
    await auditLogger.logError(req, error, "Failed to move out reservation");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code || "MOVEOUT_FAILED",
        // Include billing context so the frontend can show the balance
        // and offer an admin override without a separate API call.
        ...(error.outstandingBalance !== undefined && {
          outstandingBalance: error.outstandingBalance,
          paymentStatus: error.paymentStatus,
        }),
      });
    }
    handleReservationError(res, error, "move out");
  }
};

export const checkoutReservation = moveOutReservation;

/* ─── TRANSFER TENANT ────────────────────────────── */
export const transferTenant = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const reservation = await Reservation.findById(reservationId)
      .populate("roomId")
      .populate("userId", "firstName lastName email");
    if (!reservation)
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });

    if (!hasReservationStatus(reservation.status, "moveIn")) {
      return res.status(400).json({
        error: "Only moved-in tenants can be transferred.",
        code: "INVALID_STATUS_FOR_TRANSFER",
      });
    }

    const denied = checkBranchAccess(
      res,
      req.branchFilter,
      reservation.roomId?.branch,
    );
    if (denied) return;

    const oldData = reservation.toObject();
    const actor = await findDbUser(req.user.uid);
    const result = await transferStayWorkflow({
      reservationId,
      payload: {
        ...req.body,
        targetRoomId: req.body.targetRoomId || req.body.newRoomId,
        targetBedId: req.body.targetBedId || req.body.newBedId,
      },
      actorId: actor?._id || null,
    });

    const { notify } = await import("../utils/notificationService.js");
    notify.general(
      result.reservation.userId?._id || result.reservation.userId,
      "Room Transfer",
      `You have been transferred from ${result.fromRoomName} to ${result.toRoomName}.`,
      { entityType: "stay" },
    );

    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldData,
      { reservation: result.reservation.toObject(), stay: result.stay },
      `Tenant transferred: ${result.fromRoomName} → ${result.toRoomName}`,
    );

    res.json({
      message: `Tenant transferred from ${result.fromRoomName} to ${result.toRoomName}`,
      reservation: serializeReservation(result.reservation),
      stay: result.stay,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Transfer error");
    await auditLogger.logError(req, error, "Failed to transfer tenant");
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || "TRANSFER_FAILED" });
    }
    handleReservationError(res, error, "transfer");
  }
};

/* ─── GET MY CONTRACT (tenant) ─────────────────────── */
// ============================================================================
// POST-PAYMENT CANCELLATION REQUEST FLOW
// ============================================================================

/**
 * Tenant: submit a cancellation request for a paid reservation.
 * Does NOT cancel the reservation yet — marks it as pending admin review.
 * Bed is NOT released until admin approves.
 */
export const requestCancellationByUser = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res.status(404).json({ error: "User not found.", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found.", code: "NOT_FOUND" });

    if (String(reservation.userId) !== String(dbUser._id))
      return res.status(403).json({ error: "Unauthorized.", code: "UNAUTHORIZED" });

    if (reservation.paymentStatus !== "paid") {
      return res.status(409).json({
        error: "This reservation has not been paid. Use the direct cancel instead.",
        code: "NOT_PAID_USE_DIRECT_CANCEL",
      });
    }

    const normalizedStatus = normalizeReservationStatus(reservation.status);
    if (!APPLICANT_CANCELLABLE_STATUSES.has(normalizedStatus)) {
      return res.status(409).json({
        error: `A reservation with status "${reservation.status}" cannot be cancelled.`,
        code: "CANCELLATION_NOT_ALLOWED",
      });
    }

    if (reservation.cancellationRequested && reservation.cancellationStatus === "pending") {
      notifyAdminsOfCancellationRequest(reservation, dbUser).catch((notifyErr) => {
        logger.warn({ err: notifyErr }, "[CancelRequest] Pending request admin notification failed (non-fatal)");
      });
      return res.status(409).json({
        error: "A cancellation request is already pending review.",
        code: "CANCELLATION_REQUEST_ALREADY_PENDING",
      });
    }

    const oldData = reservation.toObject();
    const now = new Date();
    reservation.cancellationRequested = true;
    reservation.cancellationRequestedAt = now;
    reservation.cancellationRequestedBy = dbUser._id;
    reservation.cancellationStatus = "pending";
    reservation.cancellationReason = req.body.reason || null;
    await reservation.save();

    await auditLogger.logModification(
      req,
      "reservation",
      reservation._id,
      oldData,
      reservation.toObject(),
      "Cancellation request submitted",
    );

    // Notify tenant. Do not fail the already-saved request if notification delivery breaks.
    await notify.cancellationRequested(dbUser._id, reservation.reservationCode).catch((notifyErr) => {
      logger.warn({ err: notifyErr }, "[CancelRequest] Tenant notification failed (non-fatal)");
    });

    // Notify all admins for this branch
    try {
      await notifyAdminsOfCancellationRequest(reservation, dbUser);
    } catch (notifyErr) {
      logger.warn({ err: notifyErr }, "[CancelRequest] Admin notification failed (non-fatal)");
    }

    res.json({ message: "Cancellation request submitted. Pending admin review.", reservation });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "requestCancellationByUser error");
    next(error);
  }
};

/**
 * Admin: approve a pending cancellation request.
 * Cancels the reservation + releases the bed. No refund issued.
 */
export const approveCancellationRequest = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res.status(404).json({ error: "User not found.", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId).populate("roomId");
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found.", code: "NOT_FOUND" });

    if (!reservation.cancellationRequested || reservation.cancellationStatus !== "pending") {
      return res.status(409).json({
        error: "No pending cancellation request found for this reservation.",
        code: "NO_PENDING_REQUEST",
      });
    }

    const now = new Date();
    const adminNote = req.body.note || null;
    const oldData = reservation.toObject();
    const previousStatus = reservation.status;

    // Archive any active visit to history
    const visitHistoryUpdate = [];
    if (reservation.visitDate) {
      visitHistoryUpdate.push(...(reservation.visitHistory || []), {
        visitDate: reservation.visitDate,
        visitTime: reservation.visitTime,
        viewingType: reservation.viewingType || "inperson",
        status: "cancelled",
        scheduledAt: reservation.visitScheduledAt || reservation.createdAt,
      });
    }

    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    reservation.cancelledBy = dbUser._id;
    reservation.cancellationSource = "admin";
    reservation.reservationFeeRefundable = false;
    reservation.reservationFeeForfeited = true;
    reservation.cancellationStatus = "approved";
    reservation.cancellationReviewedAt = now;
    reservation.cancellationReviewedBy = dbUser._id;
    reservation.cancellationAdminNote = adminNote;
    if (visitHistoryUpdate.length > 0) reservation.visitHistory = visitHistoryUpdate;
    reservation.visitDate = null;
    reservation.visitTime = null;
    reservation.visitScheduledAt = null;
    await reservation.save();

    try {
      await updateOccupancyOnReservationChange(
        {
          ...reservation.toObject(),
          roomId: reservation.roomId?._id || reservation.roomId,
        },
        oldData,
      );
    } catch (occupancyErr) {
      logger.warn(
        { err: occupancyErr, requestId: req.id },
        "[ApproveCancellation] Occupancy update failed (non-fatal)",
      );
    }

    // Sync user lifecycle to reflect cancellation
    await syncReservationUserLifecycle({
      status: "cancelled",
      previousStatus,
      userId: reservation.userId,
      roomId: reservation.roomId,
      reservationId: reservation._id,
    }).catch((err) => logger.warn({ err }, "[ApproveCancellation] User lifecycle sync failed (non-fatal)"));

    await auditLogger.logModification(
      req,
      "reservation",
      reservation._id,
      oldData,
      reservation.toObject(),
      "Cancellation request approved",
    );

    await notify.cancellationApproved(reservation.userId, reservation.reservationCode).catch((notifyErr) => {
      logger.warn({ err: notifyErr }, "[ApproveCancellation] Tenant notification failed (non-fatal)");
    });

    res.json({ message: "Cancellation request approved. Reservation cancelled and bed released.", reservation });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "approveCancellationRequest error");
    next(error);
  }
};

/**
 * Admin: reject a pending cancellation request.
 * Reservation remains active — no status change, bed not released.
 */
export const rejectCancellationRequest = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser)
      return res.status(404).json({ error: "User not found.", code: "USER_NOT_FOUND" });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found.", code: "NOT_FOUND" });

    if (!reservation.cancellationRequested || reservation.cancellationStatus !== "pending") {
      return res.status(409).json({
        error: "No pending cancellation request found for this reservation.",
        code: "NO_PENDING_REQUEST",
      });
    }

    const now = new Date();
    const adminNote = req.body.note || null;
    const oldData = reservation.toObject();

    reservation.cancellationStatus = "rejected";
    reservation.cancellationReviewedAt = now;
    reservation.cancellationReviewedBy = dbUser._id;
    reservation.cancellationAdminNote = adminNote;
    // Reset the request flag so tenant can re-request if needed
    reservation.cancellationRequested = false;
    await reservation.save();

    await auditLogger.logModification(
      req,
      "reservation",
      reservation._id,
      oldData,
      reservation.toObject(),
      "Cancellation request rejected",
    );

    await notify.cancellationRejected(reservation.userId, reservation.reservationCode, adminNote).catch((notifyErr) => {
      logger.warn({ err: notifyErr }, "[RejectCancellation] Tenant notification failed (non-fatal)");
    });

    res.json({ message: "Cancellation request rejected. Reservation remains active.", reservation });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "rejectCancellationRequest error");
    next(error);
  }
};

export const getMyContract = async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const user = await getOrSetUser(firebaseUid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "tenant" || user.tenantStatus !== "active") {
      return res.status(404).json({ error: "No active contract found" });
    }

    // Find the tenant's active moved-in reservation
    const reservation = await Reservation.findOne({
      userId: user._id,
      status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
      isArchived: false,
    }).populate("roomId", "name branch type price floor");

    if (!reservation) {
      return res.status(404).json({ error: "No active contract found" });
    }

    const moveInDate = readMoveInDate(reservation);
    if (!moveInDate) {
      return res.status(404).json({ error: "No active contract found" });
    }

    const dayjs = (await import("dayjs")).default;
    const now = dayjs();
    const leaseStart = dayjs(moveInDate);
    const leaseDuration = reservation.leaseDuration || 12;
    const leaseEnd = leaseStart.add(leaseDuration, "month");
    const monthsCompleted = Math.min(
      now.diff(leaseStart, "month"),
      leaseDuration,
    );
    const daysRemaining = Math.max(leaseEnd.diff(now, "day"), 0);
    const totalDays = leaseEnd.diff(leaseStart, "day");
    const daysElapsed = now.diff(leaseStart, "day");
    const progressPercent = Math.min(
      Math.round((daysElapsed / totalDays) * 100),
      100,
    );

    // Determine contract status
    let contractStatus = "active";
    if (daysRemaining <= 0) contractStatus = "expired";
    else if (daysRemaining <= 30) contractStatus = "expiring";

    const monthlyRent =
      reservation.monthlyRent ||
      reservation.totalPrice ||
      reservation.roomId?.price ||
      0;

    res.json({
      contractStatus,
      room: reservation.roomId?.name || "N/A",
      bed: reservation.selectedBed?.position || "N/A",
      branch: reservation.roomId?.branch || "N/A",
      roomType: reservation.roomId?.type || "N/A",
      floor: reservation.roomId?.floor || 1,
      monthlyRent,
      leaseStart: leaseStart.format("MMMM D, YYYY"),
      leaseEnd: leaseEnd.format("MMMM D, YYYY"),
      leaseDuration,
      monthsCompleted,
      daysRemaining,
      progressPercent,
      reservationId: reservation._id,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, "Get contract error");
    res.status(500).json({ error: "Failed to fetch contract" });
  }
};
