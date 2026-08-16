/**
 * Formatting helpers for reservation details, quick summaries, and financial breakdowns.
 */

const PAYMENT_STATUS_MAP = {
  paid_in_full: "Paid in Full",
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
 * Get solid badge style configuration (minimalist, strictly no gradients) for payment status.
 */
export function getPaymentStatusBadgeConfig(status) {
  if (status === null || status === undefined || status === "") {
    return {
      label: "—",
      bg: "#F1F5F9",
      color: "#64748B",
      border: "#E2E8F0",
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
        bg: "#ECFDF5",
        color: "#047857",
        border: "#A7F3D0",
        dot: "#10B981",
      };

    case "pending":
    case "payment_pending":
      return {
        label,
        bg: "#FFFBEB",
        color: "#B45309",
        border: "#FDE68A",
        dot: "#F59E0B",
      };

    case "partial":
      return {
        label,
        bg: "#FEF3C7",
        color: "#92400E",
        border: "#FCD34D",
        dot: "#D97706",
      };

    case "proof_uploaded":
      return {
        label,
        bg: "#EFF6FF",
        color: "#1D4ED8",
        border: "#BFDBFE",
        dot: "#3B82F6",
      };

    case "overdue":
    case "failed":
      return {
        label,
        bg: "#FEF2F2",
        color: "#B91C1C",
        border: "#FECACA",
        dot: "#EF4444",
      };

    case "refunded":
      return {
        label,
        bg: "#F5F3FF",
        color: "#6D28D9",
        border: "#DDD6FE",
        dot: "#8B5CF6",
      };

    case "cancelled":
    case "canceled":
      return {
        label,
        bg: "#F8FAFC",
        color: "#64748B",
        border: "#E2E8F0",
        dot: "#94A3B8",
      };

    default:
      return {
        label,
        bg: "#F1F5F9",
        color: "#334155",
        border: "#E2E8F0",
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

