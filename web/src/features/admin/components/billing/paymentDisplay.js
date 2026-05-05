const LEGACY_PAID_FALLBACK_LABEL = "Paid - legacy/no ledger record";

const PAYMENT_STATUS_PRIORITY = {
  paid: 3,
  approved: 3,
  pending: 2,
  rejected: 1,
};

const getId = (value) => String(value?._id || value?.id || value || "");

const getPaymentSortTime = (payment) => {
  const raw = payment?.processedAt || payment?.createdAt || null;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const pickLatestPaymentRecord = (records = []) =>
  [...records].sort((left, right) => {
    const priorityDelta =
      (PAYMENT_STATUS_PRIORITY[right?.status] || 0) -
      (PAYMENT_STATUS_PRIORITY[left?.status] || 0);
    if (priorityDelta !== 0) return priorityDelta;
    return getPaymentSortTime(right) - getPaymentSortTime(left);
  })[0] || null;

export const buildPaymentLedgerByBillId = (payments = []) => {
  const groupedPayments = new Map();
  for (const payment of payments) {
    const billId = getId(payment?.billId);
    if (!billId) continue;
    const current = groupedPayments.get(billId) || [];
    current.push(payment);
    groupedPayments.set(billId, current);
  }

  return new Map(
    [...groupedPayments.entries()].map(([billId, records]) => [
      billId,
      pickLatestPaymentRecord(records),
    ]),
  );
};

export const isSettledPaymentRecord = (paymentRecord) =>
  ["paid", "approved"].includes(
    String(paymentRecord?.status || "").trim().toLowerCase(),
  );

export const getNormalizedPaidState = (bill, paymentRecord = null) => {
  if (!bill) {
    return {
      isPaid: false,
      evidence: [],
    };
  }

  const evidence = [];
  if (String(bill?.status || "").trim().toLowerCase() === "paid") evidence.push("status");
  if (String(bill?.paymentStatus || "").trim().toLowerCase() === "paid") {
    evidence.push("paymentStatus");
  }
  if (bill?.paidAt) evidence.push("paidAt");
  if (bill?.paymentDate) evidence.push("paymentDate");
  if (isSettledPaymentRecord(paymentRecord)) evidence.push("paymentLedger");

  return {
    isPaid: evidence.length > 0,
    evidence,
  };
};

export const getNormalizedBillSnapshot = (
  bill,
  paymentRecord = null,
  { isSent = () => false, getDaysOverdue = () => 0 } = {},
) => {
  const paidState = getNormalizedPaidState(bill, paymentRecord);
  const rawStatus = String(bill?.status || "").trim().toLowerCase();
  const sent = isSent(bill);
  const daysOverdue = paidState.isPaid ? 0 : getDaysOverdue(bill);
  const status =
    paidState.isPaid
      ? "paid"
      : rawStatus === "overdue" || daysOverdue > 0
        ? "overdue"
        : rawStatus === "partially-paid"
          ? "partially_paid"
          : sent
            ? "sent"
            : bill
              ? "generated"
              : "ready";

  return {
    status,
    isPaid: paidState.isPaid,
    rawStatus,
    sent,
    daysOverdue,
    balance: bill
      ? paidState.isPaid
        ? 0
        : Number(bill?.remainingAmount ?? bill?.totalAmount ?? 0)
      : 0,
    paidEvidence: paidState.evidence,
  };
};

const getCandidatePaymentValues = (source) => {
  if (!source) return [];
  return [
    source.paymentMethod,
    source.method,
    source.paymentChannel,
    source.channel,
    source.sourceType,
    source.wallet,
    source.type,
    source?.metadata?.paymentMethod,
    source?.metadata?.method,
    source?.metadata?.paymentChannel,
    source?.metadata?.channel,
    source?.metadata?.sourceType,
    source?.metadata?.wallet,
    source?.metadata?.type,
  ].filter(Boolean);
};

export const formatAdminPaymentMode = (...sources) => {
  const rawValue = sources.flatMap(getCandidatePaymentValues).find(Boolean);
  if (!rawValue) return "Online Payment";

  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized.includes("gcash")) return "GCash";
  if (normalized.includes("grabpay")) return "GrabPay";
  if (
    normalized.includes("card") ||
    normalized.includes("visa") ||
    normalized.includes("mastercard") ||
    normalized.includes("credit") ||
    normalized.includes("debit")
  ) {
    return "Card";
  }
  if (
    normalized.includes("paymongo") ||
    normalized.includes("gateway") ||
    normalized.includes("checkout") ||
    normalized.includes("online")
  ) {
    return "Online Payment";
  }

  return String(rawValue)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const resolvePaymentDetails = (bill, paymentRecord) => {
  if (paymentRecord) {
    const ledgerRecordedAt = paymentRecord.processedAt || paymentRecord.createdAt || null;
    return {
      paymentMethodLabel: formatAdminPaymentMode(paymentRecord, bill),
      paymentRecordedAt: ledgerRecordedAt,
      paymentFallbackLabel: null,
    };
  }

  if (getNormalizedPaidState(bill, paymentRecord).isPaid) {
    const paymentRecordedAt = bill?.paymentDate || bill?.paidAt || null;
    const hasMetadata = Boolean(
      paymentRecordedAt || getCandidatePaymentValues(bill).length > 0,
    );

    return {
      paymentMethodLabel: hasMetadata ? formatAdminPaymentMode(bill) : null,
      paymentRecordedAt,
      paymentFallbackLabel: hasMetadata ? null : LEGACY_PAID_FALLBACK_LABEL,
    };
  }

  return {
    paymentMethodLabel: null,
    paymentRecordedAt: null,
    paymentFallbackLabel: null,
  };
};

export { LEGACY_PAID_FALLBACK_LABEL };
