import { resolveSecurityDeposit } from "../utils/depositUtils.js";
import { resolveRoomDiscountPricing } from "./contractPricingResolver.js";

/**
 * Canonical applicant-to-tenant profile mapping.
 *
 * User is authoritative for current personal data. Reservation remains the
 * application-history fallback, while Stay is authoritative for occupancy.
 */
const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  (typeof value !== "string" || value.trim() !== "");

const firstValue = (...values) => values.find(hasValue) ?? null;

// Collapses accidental runs of whitespace (e.g. an applicant typing "Juan  Dela
// Cruz" with a double space) into a single space and trims the ends. This is
// the ONLY normalization applied to identity text: it never removes letters,
// hyphens, suffixes, or accented characters, and never reorders/reconstructs
// name parts — see resolveTenantPersonalDetails below for how firstName /
// middleName / lastName are joined (unchanged, one space between parts).
const collapseWhitespace = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const joinAddress = (address = {}) =>
  [
    address.unitHouseNo,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .filter(hasValue)
    .map((value) => collapseWhitespace(value))
    .join(", ");

export function resolveTenantPersonalDetails({ user = {}, reservation = {} } = {}) {
  const reservationAddress = reservation.address || {};
  const emergency = reservation.emergencyContact || {};
  const employment = reservation.employment || {};
  const approvedApplication = Boolean(
    reservation.applicationReviewedAt &&
    reservation.applicationReviewedBy &&
    !["needs_revision", "rejected"].includes(reservation.applicationStatus),
  );
  const preferred = (applicationValue, profileValue) =>
    approvedApplication
      ? firstValue(applicationValue, profileValue)
      : firstValue(profileValue, applicationValue);
  const firstName = collapseWhitespace(preferred(reservation.firstName, user.firstName)) || null;
  const middleName = collapseWhitespace(firstValue(reservation.middleName)) || null;
  const lastName = collapseWhitespace(preferred(reservation.lastName, user.lastName)) || null;
  const fullName = [firstName, middleName, lastName].filter(hasValue).join(" ");

  return {
    fullName: fullName || firstValue(user.email, reservation.email),
    firstName,
    middleName,
    lastName,
    email: preferred(reservation.email || reservation.billingEmail, user.email),
    phone: preferred(reservation.mobileNumber, user.phone),
    birthDate: preferred(reservation.birthday, user.dateOfBirth),
    gender: preferred(reservation.gender, user.gender),
    civilStatus: preferred(reservation.maritalStatus, user.civilStatus),
    nationality: preferred(reservation.nationality, user.nationality),
    occupation: preferred(employment.occupation, user.occupation),
    currentAddress: collapseWhitespace(preferred(joinAddress(reservationAddress), user.address)) || null,
    city: preferred(reservationAddress.city, user.city),
    province: preferred(reservationAddress.province, user.province),
    profileImage: user.profileImage || null,
    emergencyContact: {
      name: firstValue(user.emergencyContact, emergency.name),
      relationship: firstValue(
        user.emergencyRelationship,
        emergency.relationship,
      ),
      phone: firstValue(user.emergencyPhone, emergency.contactNumber),
      address: null,
    },
  };
}

export function buildTenantProfileSyncUpdates({ user = {}, reservation = {} } = {}) {
  const resolved = resolveTenantPersonalDetails({ user, reservation });
  const candidates = {
    firstName: resolved.firstName,
    lastName: resolved.lastName,
    phone: resolved.phone,
    profileImage: resolved.profileImage,
    gender: resolved.gender,
    civilStatus: resolved.civilStatus,
    nationality: resolved.nationality,
    occupation: resolved.occupation,
    address: resolved.currentAddress,
    city: resolved.city,
    province: resolved.province,
    dateOfBirth: resolved.birthDate,
    emergencyContact: resolved.emergencyContact.name,
    emergencyRelationship: resolved.emergencyContact.relationship,
    emergencyPhone: resolved.emergencyContact.phone,
  };

  return Object.fromEntries(
    Object.entries(candidates).filter(
      ([field, value]) => !hasValue(user[field]) && hasValue(value),
    ),
  );
}

export function resolveTenantOccupancyDetails({
  reservation = {},
  currentStay = null,
} = {}) {
  const room = reservation.roomId || {};
  const isPrivate =
    String(room.type || reservation.preferredRoomType || reservation.roomType || "").toLowerCase().includes("private") ||
    room.capacity === 1;

  return {
    branch: currentStay?.branch || room.branch || null,
    room: room.name || room.roomNumber || null,
    roomId: currentStay?.roomId || room._id || null,
    bed: isPrivate
      ? "Private Room"
      : (currentStay?.bedCode ||
         reservation.selectedBed?.position ||
         reservation.selectedBed?.code ||
         reservation.selectedBed?.id ||
         null),
    bedId: isPrivate
      ? ""
      : (currentStay?.bedId || reservation.selectedBed?.id || null),
    moveInDate:
      currentStay?.leaseStartDate ||
      reservation.confirmedMoveInDate ||
      reservation.moveInDate ||
      reservation.intendedMoveInDate ||
      reservation.targetMoveInDate ||
      null,
    status: currentStay?.status || reservation.status || null,
  };
}

export function resolveTenantFinancialSummary({
  reservation = {},
  currentBalance = 0,
  paymentStatus = null,
} = {}) {
  const room = reservation.roomId || {};
  const rawRoomType = String(room.type || reservation.preferredRoomType || reservation.roomType || "").toLowerCase();
  const isPrivate = rawRoomType.includes("private") || room.capacity === 1;

  let monthlyRate = firstValue(
    reservation.contract?.approvedMonthlyRate,
    reservation.pricingSnapshot?.finalMonthlyRate,
    reservation.pricingDisplay?.finalMonthlyRate,
    reservation.monthlyRent,
    reservation.totalPrice,
  );

  // If this is a private room, but stored monthlyRent was stale/quadruple (e.g. <= 7000):
  if (isPrivate && Number(monthlyRate) > 0 && Number(monthlyRate) < 10000) {
    const roomPricing = resolveRoomDiscountPricing("private", {}, room);
    const leaseDuration = Number(reservation.leaseDuration || 12);
    monthlyRate = leaseDuration >= (roomPricing.longTermLeaseMinMonths || 6)
      ? roomPricing.monthlyPrice
      : roomPricing.shortTermRate;
  } else if (monthlyRate == null && rawRoomType) {
    const roomPricing = resolveRoomDiscountPricing(rawRoomType, {}, room);
    const leaseDuration = Number(reservation.leaseDuration || 12);
    monthlyRate = leaseDuration >= (roomPricing.longTermLeaseMinMonths || 6)
      ? roomPricing.monthlyPrice
      : roomPricing.shortTermRate;
  }

  const approvedRate = hasValue(monthlyRate) ? Number(monthlyRate) : null;
  const reservationFee = hasValue(reservation.reservationFeeAmount)
    ? Number(reservation.reservationFeeAmount)
    : null;

  return {
    monthlyRate: Number.isFinite(approvedRate) ? approvedRate : null,
    advanceRent: Number.isFinite(approvedRate) ? approvedRate : null,
    securityDeposit: resolveSecurityDeposit(reservation),
    reservationFee: Number.isFinite(reservationFee) ? reservationFee : null,
    paymentStatus: paymentStatus || reservation.paymentStatus || null,
    currentBalance: Number.isFinite(Number(currentBalance))
      ? Number(currentBalance)
      : null,
  };
}

