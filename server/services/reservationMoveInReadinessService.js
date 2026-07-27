import { Reservation, Room, Stay, User } from "../models/index.js";
import { validateBranchRoomType } from "../config/contractConfig.js";
import { resolveReservationInitialCharges } from "./reservationPaymentPolicy.js";
import { hasReservationStatus, readMoveInDate } from "../utils/lifecycleNaming.js";

const requiredText = (value) => Boolean(String(value || "").trim());

export async function evaluateReservationMoveInReadiness(reservationOrId) {
  const reservation = typeof reservationOrId === "string"
    ? await Reservation.findById(reservationOrId)
    : reservationOrId;
  const blockers = [];
  const warnings = [];
  if (!reservation) {
    return { ready: false, blockers: ["RESERVATION_NOT_FOUND"], warnings, resolvedData: {} };
  }

  const [user, room, activeStay] = await Promise.all([
    User.findById(reservation.userId).lean(),
    Room.findById(reservation.roomId).lean(),
    Stay.findOne({
      tenantId: reservation.userId,
      status: { $in: ["active", "ending_soon"] },
    }).lean(),
  ]);

  if (!hasReservationStatus(reservation.status, "reserved")) blockers.push("RESERVATION_NOT_RESERVED");
  if (
    reservation.paymentStatus !== "paid" ||
    !["paymongo_webhook", "offline_exception"].includes(reservation.paymentVerificationSource)
  ) blockers.push("PAYMONGO_PAYMENT_NOT_CONFIRMED");
  if (Number(reservation.paidAmount) <= 0) blockers.push("PAYMENT_AMOUNT_MISMATCH");
  if (String(reservation.paymentCurrency || "").toUpperCase() !== "PHP") blockers.push("PAYMENT_CURRENCY_MISMATCH");
  if (!reservation.paymongoReference && reservation.paymentVerificationSource !== "offline_exception") {
    blockers.push("PAYMONGO_REFERENCE_MISSING");
  }
  if (!reservation.applicationReviewedAt || !reservation.applicationReviewedBy) {
    blockers.push("APPLICATION_APPROVAL_MISSING");
  }
  if (!user) blockers.push("USER_REFERENCE_INVALID");
  if (!room) blockers.push("ROOM_REFERENCE_INVALID");

  const bedId = reservation.selectedBed?.id;
  const bed = room?.beds?.find((entry) => String(entry.id || entry._id) === String(bedId));
  if (!bedId || !bed) blockers.push("BED_ASSIGNMENT_INVALID");
  if (bed && bed.lockedBy && String(bed.lockedBy) !== String(reservation.userId)) {
    blockers.push("BED_ASSIGNMENT_CONFLICT");
  }
  if (room) {
    try {
      validateBranchRoomType(room.branch, room.type || reservation.preferredRoomType);
    } catch (error) {
      blockers.push(error.code || "ROOM_TYPE_NOT_ALLOWED_FOR_BRANCH");
    }
  }

  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) blockers.push("MOVE_IN_DATE_MISSING");
  if (!(Number(reservation.leaseDuration) > 0)) blockers.push("LEASE_TYPE_MISSING");
  const leaseEndDate = moveInDate && Number(reservation.leaseDuration) > 0
    ? new Date(new Date(moveInDate).setMonth(new Date(moveInDate).getMonth() + Number(reservation.leaseDuration)))
    : null;
  if (!leaseEndDate || Number.isNaN(leaseEndDate.getTime())) blockers.push("LEASE_END_DATE_MISSING");

  const pricing = resolveReservationInitialCharges(reservation);
  if (!(pricing.approvedMonthlyRate > 0)) blockers.push("PRICING_SNAPSHOT_MISSING");
  if (!(pricing.advanceRent > 0)) blockers.push("ADVANCE_RENT_MISSING");
  if (!(pricing.securityDeposit > 0)) blockers.push("SECURITY_DEPOSIT_MISSING");
  if (reservation.reservationFeeAmount == null) blockers.push("RESERVATION_FEE_MISSING");
  if (reservation.reservationFeeAppliedTo !== "initial_move_in_charges") {
    blockers.push("INITIAL_CHARGE_RECONCILIATION_INCOMPLETE");
  }

  if (!requiredText(reservation.firstName) || !requiredText(reservation.lastName)) {
    blockers.push("LEGAL_IDENTITY_MISSING");
  }
  if (
    !requiredText(reservation.mobileNumber) ||
    !requiredText(reservation.address?.city) ||
    !requiredText(reservation.address?.region)
  ) blockers.push("LEGAL_CONTACT_ADDRESS_MISSING");
  if (reservation.documentsApproved !== true) blockers.push("DOCUMENT_REVIEW_INCOMPLETE");
  if (activeStay) blockers.push("ACTIVE_STAY_EXISTS");

  return {
    ready: blockers.length === 0,
    blockers: [...new Set(blockers)],
    warnings,
    resolvedData: {
      userId: user?._id || null,
      branch: room?.branch || null,
      roomId: room?._id || null,
      bedId: bedId || null,
      moveInDate: moveInDate || null,
      leaseEndDate,
      pricing,
    },
  };
}
