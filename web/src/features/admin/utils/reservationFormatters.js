/**
 * Formatting helpers for reservation details, quick summaries, and financial breakdowns.
 */

const PAYMENT_STATUS_MAP = {
  paid_in_full: "Fully Settled",
  paid: "Paid",
  partial: "Partially Paid",
  pending: "Pending Payment",
  payment_pending: "Payment Pending",
  proof_uploaded: "Proof Uploaded",
  verified: "Verified",
  overdue: "Overdue",
  unpaid: "Unpaid",
  refunded: "Refunded",
  failed: "Payment Failed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  not_created: "Unbilled",
};

const ROOM_TYPE_MAP = {
  "quadruple-sharing": "Quadruple Sharing",
  "quadruple_sharing": "Quadruple Sharing",
  "quadruple": "Quadruple Sharing",
  "double-sharing": "Double Sharing",
  "double_sharing": "Double Sharing",
  "double": "Double Sharing",
  "triple-sharing": "Triple Sharing",
  "triple_sharing": "Triple Sharing",
  "triple": "Triple Sharing",
  "single-sharing": "Single Sharing",
  "single_sharing": "Single Sharing",
  "single-room": "Single Room",
  "single_room": "Single Room",
  "single": "Single Room",
  "dorm-style": "Dorm Style",
  "dorm_style": "Dorm Style",
};

/**
 * Format raw payment status into a friendly, professional title.
 * e.g., "paid_in_full" -> "Paid in Full", "proof_uploaded" -> "Proof Uploaded"
 */
export function formatPaymentStatus(status) {
  if (status === null || status === undefined || status === "") return "—";
  const key = String(status).trim().toLowerCase();
  if (PAYMENT_STATUS_MAP[key]) return PAYMENT_STATUS_MAP[key];

  return String(status)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get solid badge style configuration (minimalist, strictly transparent background with semantic dot & text) for payment status.
 */
export function getPaymentStatusBadgeConfig(status) {
  if (status === null || status === undefined || status === "") {
    return {
      label: "—",
      bg: "transparent",
      color: "#64748B",
      border: "transparent",
      dot: "#94A3B8",
    };
  }

  const key = String(status).trim().toLowerCase();
  const label = formatPaymentStatus(key);

  switch (key) {
    case "paid_in_full":
    case "paid":
    case "verified":
      return {
        label,
        bg: "transparent",
        color: "#047857",
        border: "transparent",
        dot: "#10B981",
      };

    case "pending":
    case "payment_pending":
      return {
        label,
        bg: "transparent",
        color: "#B45309",
        dot: "#F59E0B",
        border: "transparent",
      };

    case "partial":
      return {
        label,
        bg: "transparent",
        color: "#92400E",
        border: "transparent",
        dot: "#D97706",
      };

    case "proof_uploaded":
      return {
        label,
        bg: "transparent",
        color: "#1D4ED8",
        border: "transparent",
        dot: "#3B82F6",
      };

    case "overdue":
    case "failed":
      return {
        label,
        bg: "transparent",
        color: "#B91C1C",
        border: "transparent",
        dot: "#EF4444",
      };

    case "refunded":
      return {
        label,
        bg: "transparent",
        color: "#475569",
        border: "transparent",
        dot: "#94A3B8",
      };

    case "cancelled":
    case "canceled":
      return {
        label,
        bg: "transparent",
        color: "#64748B",
        border: "transparent",
        dot: "#94A3B8",
      };

    default:
      return {
        label,
        bg: "transparent",
        color: "#475569",
        border: "transparent",
        dot: "#64748B",
      };
  }
}

/**
 * Format raw room type strings (e.g. "quadruple-sharing") into professional title case.
 */
export function formatRoomType(roomType) {
  if (roomType === null || roomType === undefined || roomType === "") return "—";
  const key = String(roomType).trim().toLowerCase();
  if (ROOM_TYPE_MAP[key]) return ROOM_TYPE_MAP[key];

  return String(roomType)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format PHP currency with standard 2 decimal places.
 */
export function formatPhpCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `PHP ${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Resolve the authoritative payment status for the initial reservation holding fee.
 */
export function resolveReservationFeeStatus(reservation) {
  if (!reservation) return "pending";

  const overallStatus = String(reservation.status || "").trim().toLowerCase();
  const initialStatus = String(reservation.initialPaymentStatus || "").trim().toLowerCase();
  const rawPaymentStatus = String(reservation.paymentStatus || "").trim().toLowerCase();
  const directFeeStatus = String(reservation.reservationFeePaymentStatus || "").trim().toLowerCase();

  // If the downstream Move-In Initial Payment is already settled, or overall lifecycle is reserved / moved in / checked-in,
  // or a payment timestamp exists, the holding fee has logically and authoritatively been verified.
  if (
    directFeeStatus === "verified" ||
    directFeeStatus === "paid" ||
    initialStatus === "paid" ||
    initialStatus === "paid_in_full" ||
    rawPaymentStatus === "paid" ||
    rawPaymentStatus === "paid_in_full" ||
    rawPaymentStatus === "verified" ||
    overallStatus === "reserved" ||
    overallStatus === "movein" ||
    overallStatus === "moved_in" ||
    overallStatus === "moveout" ||
    overallStatus === "checked-in" ||
    Boolean(reservation.paidAt) ||
    Boolean(reservation.reservationFeePaidAt) ||
    Boolean(reservation.paymentDate)
  ) {
    return "verified";
  }

  // Explicit non-pending statuses take precedence if not settled above
  if (directFeeStatus && directFeeStatus !== "pending") {
    return directFeeStatus;
  }

  if (reservation.paymentProof && overallStatus === "pending") {
    return "proof_uploaded";
  }
  if (rawPaymentStatus === "proof_uploaded") {
    return "proof_uploaded";
  }

  return directFeeStatus || rawPaymentStatus || "pending";
}

/**
 * Resolve the authoritative payment status for the Move-in Advance Rent & Security Deposit balance.
 */
export function resolveMoveInPaymentStatus(reservation) {
  if (!reservation) return "not_created";

  const initialStatus = String(reservation.initialPaymentStatus || "").trim().toLowerCase();
  if (initialStatus && initialStatus !== "not_created") {
    if (initialStatus === "paid" || initialStatus === "paid_in_full" || initialStatus === "verified") return "paid_in_full";
    return initialStatus;
  }

  const rawPaymentStatus = String(reservation.paymentStatus || "").trim().toLowerCase();
  const overallStatus = String(reservation.status || "").trim().toLowerCase();

  // If initialPaymentStatus is not explicitly paid, only treat as paid_in_full if explicitly paid_in_full or already moved in
  if (rawPaymentStatus === "paid_in_full" || overallStatus === "movein" || overallStatus === "moved_in") {
    return "paid_in_full";
  }
  if (rawPaymentStatus === "partial") {
    return "partial";
  }
  if (rawPaymentStatus === "proof_uploaded" && initialStatus === "proof_uploaded") {
    return "proof_uploaded";
  }

  if (
    overallStatus === "approved_for_payment" ||
    overallStatus === "contract_signed" ||
    overallStatus === "reserved" ||
    overallStatus === "payment_pending"
  ) {
    return "pending";
  }

  if (overallStatus === "pending" || overallStatus === "visit_scheduled" || overallStatus === "pending_application_review") {
    return "not_created";
  }

  return "pending";
}

