/**
 * ============================================================================
 * PAYMONGO PAYMENT METHOD EXTRACTION
 * ============================================================================
 *
 * Shared logic for reading the actual customer-facing payment channel
 * (gcash, card, ...) out of a PayMongo checkout-session-shaped payload.
 * Used by both the tenant-facing polling path (paymentController.js) and
 * the authoritative webhook path (webhookController.js) so the two stay
 * consistent.
 */

export const PAYMENT_METHOD_LABELS = Object.freeze({
  gcash: "GCash",
  grab_pay: "GrabPay",
  paymaya: "Maya",
  card: "Credit / Debit Card",
  dob: "Online Banking",
  billease: "BillEase",
  qrph: "QR Ph",
  online: "Online Payment (PayMongo)",
});

export const readPaidPayments = (session) => {
  const payments = [
    ...(session?.attributes?.payments || []),
    ...(session?.attributes?.payment_intent?.payments || []),
  ];
  return payments.filter((payment) => {
    const status = payment?.attributes?.status || payment?.status;
    return status === "paid";
  });
};

/**
 * Collapses a PayMongo checkout session into the stable, mobile-facing
 * status enum: paid | pending | failed | cancelled | unknown.
 *
 * Grounded in what this backend already treats as meaningful PayMongo state
 * (see webhookController.js, which acts on payment.paid / payment.failed /
 * checkout_session.payment.paid) and in the session-status semantics already
 * documented against this same API by the vendored mobile controller
 * (mobile/controllers/paymongo.controller.js): a checkout session's
 * `status` is "active" while still open and "inactive" once closed, either
 * by a successful payment or by expiry — "inactive" is not itself proof of
 * payment, only readPaidPayments() is.
 */
export const normalizeCheckoutStatusForClient = (session, paidPayments = []) => {
  if (Array.isArray(paidPayments) && paidPayments.length > 0) return "paid";

  const payments = [
    ...(session?.attributes?.payments || []),
    ...(session?.attributes?.payment_intent?.payments || []),
  ];
  const hasFailedPayment = payments.some((payment) => {
    const status = payment?.attributes?.status || payment?.status;
    return status === "failed";
  });

  const sessionStatus = session?.attributes?.status;
  if (sessionStatus === "inactive") {
    // Closed without a paid payment: either every attempt on it failed, or
    // it simply expired/was abandoned with no attempt at all.
    return hasFailedPayment ? "failed" : "cancelled";
  }
  if (sessionStatus === "active") {
    // Still open — a failed attempt on an active session just means the
    // tenant can pick another payment method, not that the checkout is done.
    return "pending";
  }
  return "unknown";
};

export const readPaymentMethod = (session, paidPayments = []) => {
  if (!paidPayments || paidPayments.length === 0) {
    const defaultType = session?.attributes?.payment_method_used;
    return {
      rawPaymentType: defaultType || "online",
      paymentMethod: defaultType ? (PAYMENT_METHOD_LABELS[defaultType] || defaultType) : "Online Payment (PayMongo)",
    };
  }

  const firstPayment = paidPayments[0];
  const payObj = firstPayment?.attributes || firstPayment;
  const rawPaymentType =
    payObj?.source?.type ||
    payObj?.attributes?.source?.type ||
    payObj?.payment_method_type ||
    payObj?.attributes?.payment_method_type ||
    session?.attributes?.payment_method_used ||
    "online";

  const key = String(rawPaymentType).toLowerCase().trim().replace(/[_\s-]/g, "");

  const mappedLabel =
    PAYMENT_METHOD_LABELS[rawPaymentType] ||
    PAYMENT_METHOD_LABELS[key] ||
    (rawPaymentType && rawPaymentType !== "online"
      ? String(rawPaymentType).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Online Payment (PayMongo)");

  return {
    rawPaymentType,
    paymentMethod: mappedLabel,
  };
};
