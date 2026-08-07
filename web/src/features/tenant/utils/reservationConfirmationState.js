import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

const EMPTY_CODE_VALUES = new Set(["", "-", "—", "n/a", "na", "null", "undefined"]);

export const hasValidReservationCode = (value) => {
  const normalized = String(value || "").trim();
  return normalized.length > 0 && !EMPTY_CODE_VALUES.has(normalized.toLowerCase());
};

export const isPaymentConfirmed = (reservation = {}, options = {}) => {
  const paymentStatus = String(reservation?.paymentStatus || "")
    .trim()
    .toLowerCase();

  if (paymentStatus === "paid") return true;
  if (reservation?.paymongoPaymentId && reservation?.paymentDate) return true;
  if (hasReservationStatus(reservation?.status, "reserved", "moveIn", "moveOut")) return true;
  if (options.paymentApproved === true) return true;
  return false;
};

export const hasReservationReceipt = (reservation = {}, options = {}) =>
  isPaymentConfirmed(reservation, options) &&
  Boolean(
    reservation?.receiptUrl ||
      reservation?.receiptPdfUrl ||
      reservation?.receiptSentAt ||
      reservation?.paymongoPaymentId ||
      reservation?.paymentDate,
  );

export const getReservationConfirmationState = (
  reservation = {},
  options = {},
) => {
  const status = normalizeReservationStatus(reservation?.status);
  const reservationCode = options.reservationCode || reservation?.reservationCode || "";
  const hasReservationCode = hasValidReservationCode(reservationCode);
  const paymentConfirmed = isPaymentConfirmed(reservation, options);
  const hasReceipt = hasReservationReceipt(reservation, options);
  const isRoomReserved = hasReservationStatus(status, "reserved");
  const isActiveTenant = hasReservationStatus(status, "moveIn", "moveOut");
  const isSecured =
    paymentConfirmed &&
    hasReservationCode &&
    hasReservationStatus(status, "reserved", "moveIn", "moveOut");

  if (isSecured) {
    return {
      state: "secured",
      title: "You're All Set",
      message: "Your room has been reserved. Here is a summary of your reservation.",
      nextSteps: [
        {
          step: "Check your email for the reservation confirmation and receipt.",
          detail: "Keep the confirmation available for move-in day.",
        },
        {
          step: "Save your reservation code for move-in day.",
          detail: "Admin may ask for this code during verification.",
        },
        {
          step: "Bring a valid government-issued ID on move-in day.",
          detail: "Use the same ID details you submitted in your application.",
        },
      ],
      hasReservationCode,
      paymentConfirmed,
      hasReceipt,
      showPaymentCard: true,
      showReceiptAction: hasReceipt,
      showReservationCodeCard: true,
      showFinalizingCodeMessage: false,
      isRoomReserved,
      isActiveTenant,
    };
  }

  if (isRoomReserved) {
    return {
      state: "reserved_no_code",
      title: "Room Reserved",
      message:
        "Your room reservation has been recorded. You will be notified once your reservation code and move-in details are available.",
      nextSteps: [
        {
          step: "Wait for your reservation code.",
          detail: "You will be notified once admin finalizes the reservation details.",
        },
        {
          step: "Check your notifications and email for updates.",
          detail: "Important reservation updates will be sent there.",
        },
        {
          step: "Prepare your required documents for move-in.",
          detail: "Admin will provide further instructions when ready.",
        },
      ],
      hasReservationCode,
      paymentConfirmed,
      hasReceipt,
      showPaymentCard: paymentConfirmed,
      showReceiptAction: hasReceipt,
      showReservationCodeCard: false,
      showFinalizingCodeMessage: true,
      isRoomReserved,
      isActiveTenant,
    };
  }

  return {
    state: "pending_finalization",
    title: "Reservation Submitted",
    message:
      "Your reservation is being finalized. Please wait for further instructions from the admin.",
    nextSteps: [
      {
        step: "Wait for an update from the admin.",
        detail: "Your reservation status will update once admin finishes review.",
      },
      {
        step: "Check your notifications for reservation updates.",
        detail: "You will be notified if more information is needed.",
      },
      {
        step: "Contact admin if you need to make changes.",
        detail: "Use the available support channel for reservation concerns.",
      },
    ],
    hasReservationCode,
    paymentConfirmed,
    hasReceipt,
    showPaymentCard: paymentConfirmed,
    showReceiptAction: hasReceipt,
    showReservationCodeCard: hasReservationCode,
    showFinalizingCodeMessage: !hasReservationCode,
    isRoomReserved,
    isActiveTenant,
  };
};
