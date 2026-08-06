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
