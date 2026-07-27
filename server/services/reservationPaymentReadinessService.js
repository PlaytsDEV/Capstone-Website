import { Reservation, Room, Stay, User } from "../models/index.js";
import { validateBranchRoomType } from "../config/contractConfig.js";
import {
  validateReservationPaymentQuote,
} from "./reservationPaymentPolicy.js";
import { readMoveInDate, reservationStatusesForQuery } from "../utils/lifecycleNaming.js";

const requiredText = (value) => Boolean(String(value || "").trim());
const validDate = (value) => value && !Number.isNaN(new Date(value).getTime());

const documentPrechecksPass = (reservation) => {
  const prechecks = reservation.documentPrechecks?.toObject?.()
    || reservation.documentPrechecks || {};
  const entries = [
    prechecks.selfiePhoto,
    prechecks.validIDFront,
    prechecks.validIDBack,
    ...(reservation.nbiClearanceUrl ? [prechecks.nbiClearance] : []),
    ...(reservation.companyIDUrl ? [prechecks.companyID] : []),
  ];
  return entries.length >= 3 && entries.every((entry) =>
    Boolean(entry) &&
    ["passed", "manual_review_fallback"].includes(entry.precheckStatus));
};

export async function evaluateReservationPaymentReadiness(
  reservationOrId,
  { proposedDeadline = null } = {},
) {
  const reservation = typeof reservationOrId === "string"
    ? await Reservation.findById(reservationOrId)
    : reservationOrId;
  if (!reservation) {
    return { ready: false, legacy: false, missingFields: ["reservation"], resolved: {} };
  }

  const [applicant, room, conflictingReservation, activeStay] = await Promise.all([
    User.findById(reservation.userId).lean(),
    Room.findById(reservation.roomId).lean(),
    Reservation.findOne({
      _id: { $ne: reservation._id },
      userId: reservation.userId,
      status: {
        $in: reservationStatusesForQuery(
          "approved_for_payment", "payment_pending", "reserved", "moveIn",
        ),
      },
      isArchived: { $ne: true },
    }).lean(),
    Stay.findOne({
      tenantId: reservation.userId,
      status: { $in: ["active", "ending_soon"] },
    }).lean(),
  ]);

  const missingFields = [];
  if (!reservation.applicationSubmittedAt) missingFields.push("applicationSubmittedAt");
  if (!applicant) missingFields.push("applicant");
  if (!requiredText(reservation.firstName) || !requiredText(reservation.lastName) ||
      !requiredText(reservation.mobileNumber) || !requiredText(reservation.address?.city) ||
      !requiredText(reservation.address?.region)) {
    missingFields.push("legalApplicantIdentity");
  }
  if (!room) missingFields.push("roomId");
  if (room?.isArchived || room?.available === false) missingFields.push("activeRoom");
  if (!room?.branch) missingFields.push("branch");

  const bedId = reservation.selectedBed?.id;
  const bed = room?.beds?.find((entry) => String(entry.id || entry._id) === String(bedId));
  if (!bedId) missingFields.push("bedId");
  else if (!bed) missingFields.push("bedBelongsToRoom");
  else {
    const lockOwnerMatches =
      bed.lockedBy && String(bed.lockedBy) === String(reservation.userId);
    const reusableBed = bed.status === "available" ||
      (bed.status === "locked" && lockOwnerMatches &&
        (!bed.lockExpiresAt || new Date(bed.lockExpiresAt).getTime() > Date.now()));
    if (!reusableBed) missingFields.push("bedAvailability");
  }

  if (room) {
    try {
      const canonicalRoomType = validateBranchRoomType(room.branch, room.type);
      if (reservation.preferredRoomType) {
        const requested = validateBranchRoomType(room.branch, reservation.preferredRoomType);
        if (requested !== canonicalRoomType) missingFields.push("roomType");
      }
    } catch {
      missingFields.push("roomType");
    }
  }

  const moveInDate = readMoveInDate(reservation);
  if (!validDate(moveInDate)) missingFields.push("moveInDate");
  const duration = Number(reservation.leaseDuration);
  if (!Number.isInteger(duration) || duration < 1 || duration > 24) {
    missingFields.push("leaseDuration");
  }
  const expectedLeaseType = duration >= 6 ? "long_term" : "short_term";
  if (!reservation.leaseType || reservation.leaseType !== expectedLeaseType) {
    missingFields.push("leaseType");
  }

  const quoteValidation = validateReservationPaymentQuote(
    reservation,
    { requireApproval: false },
  );
  missingFields.push(...quoteValidation.missingFields);
  const deadline = proposedDeadline || reservation.paymentExpiresAt;
  if (!validDate(deadline) || new Date(deadline).getTime() <= Date.now()) {
    missingFields.push("paymentDeadline");
  }
  if (!Array.isArray(reservation.approvedPaymentMethods) ||
      reservation.approvedPaymentMethods.length === 0) {
    missingFields.push("paymentMethod");
  }
  if (!documentPrechecksPass(reservation)) missingFields.push("requiredDocuments");
  if (conflictingReservation) missingFields.push("conflictingActiveReservation");
  if (activeStay) missingFields.push("conflictingActiveStay");

  const legacy = !reservation.paymentPricingSnapshot?.capturedAt ||
    reservation.paymentPricingSnapshot?.reservationFeeCredit === null ||
    reservation.paymentPricingSnapshot?.reservationFeeCredit === undefined;

  return {
    ready: missingFields.length === 0,
    legacy,
    missingFields: [...new Set(missingFields)],
    resolved: {
      applicantId: applicant?._id || null,
      branch: room?.branch || null,
      roomId: room?._id || null,
      bedId: bedId || null,
      moveInDate: moveInDate || null,
      leaseType: reservation.leaseType || null,
      quote: quoteValidation.quote,
      paymentDeadline: deadline || null,
    },
  };
}

export const paymentReadinessError = (readiness) => Object.assign(
  new Error(readiness.legacy
    ? "Legacy Reservation payment data requires administrator correction."
    : "The Reservation is not ready for payment."),
  {
    code: readiness.legacy
      ? "LEGACY_PAYMENT_DATA_INCOMPLETE"
      : "PAYMENT_READINESS_INCOMPLETE",
    statusCode: 422,
    details: { missingFields: readiness.missingFields },
  },
);
