import { Bill, Payment } from "../../models/index.js";
import { roundMoney } from "./billingPolicy.js";

const SETTLED_PAYMENT_STATUSES = new Set(["approved", "paid", "confirmed"]);
const PROVING_LEDGER_KINDS = new Set([
  "move_in",
  "transfer_deposit_settlement",
  "backfill",
  "manual_correction",
]);

const finiteMoney = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? roundMoney(amount) : null;
};

const id = (value) => (value ? String(value) : null);

function ledgerEntryIsStructurallyProvable(entry) {
  const resultingHeld = finiteMoney(entry?.resultingHeld);
  const previousHeld = entry?.previousHeld === null || entry?.previousHeld === undefined
    ? null
    : finiteMoney(entry.previousHeld);
  const adjustmentAmount = Number(entry?.adjustmentAmount);
  const sourceKind = String(entry?.sourceRef?.kind || "").trim();
  const hasFinancialSource = Boolean(
    entry?.paymentId ||
    entry?.billId ||
    (entry?.sourceRef?.id && ["bill", "payment"].includes(sourceKind)),
  );
  const hasAuditedManualSource = Boolean(
    entry?.kind === "manual_correction" &&
    entry?.sourceRef?.id &&
    sourceKind === "scheduled_room_transfer",
  );
  const arithmeticBaseline = previousHeld ?? 0;
  return (
    resultingHeld !== null &&
    Number.isFinite(adjustmentAmount) &&
    PROVING_LEDGER_KINDS.has(entry?.kind) &&
    (hasFinancialSource || hasAuditedManualSource) &&
    Boolean(String(entry?.idempotencyKey || "").trim()) &&
    Math.abs(roundMoney(arithmeticBaseline + adjustmentAmount) - resultingHeld) < 0.01
  );
}

function explicitDepositFromBill(bill) {
  return finiteMoney(bill?.initialPaymentBreakdown?.securityDeposit);
}

function billIsFullySettled(bill) {
  const remaining = finiteMoney(bill?.remainingAmount);
  const total = finiteMoney(bill?.totalAmount);
  const paid = finiteMoney(bill?.paidAmount);
  return (
    bill?.billType === "initial_payment" &&
    bill?.status === "paid" &&
    remaining === 0 &&
    total !== null &&
    paid !== null &&
    paid + 0.01 >= total
  );
}

/**
 * Classify the evidence for actual security-deposit cash already held.
 *
 * Contract/pricing requirements and approvedMonthlyRate are deliberately not
 * accepted here. They describe what should have been paid, not what was paid.
 */
export async function resolveVerifiedSecurityDepositHeld({
  reservation,
  bills = null,
  payments = null,
  session = null,
  ignoreCanonical = false,
  ignoreLedger = false,
} = {}) {
  if (!reservation) {
    return { classification: "UNKNOWN", heldKnown: false, amount: null, evidence: [], paymentIds: [], billIds: [] };
  }

  const canonical = finiteMoney(reservation.securityDepositHeld);
  if (!ignoreCanonical && canonical !== null) {
    return {
      classification: "VERIFIED",
      heldKnown: true,
      amount: canonical,
      source: "reservation.securityDepositHeld",
      evidence: [{ kind: "reservation", id: id(reservation._id), field: "securityDepositHeld" }],
      paymentIds: [],
      billIds: [],
    };
  }

  const ledger = Array.isArray(reservation.securityDepositLedger)
    ? reservation.securityDepositLedger
    : [];
  const provingLedger = [...ledger].reverse().find(ledgerEntryIsStructurallyProvable);
  if (!ignoreLedger && provingLedger) {
    const amount = finiteMoney(provingLedger.resultingHeld);
    return {
      classification: "VERIFIED",
      heldKnown: true,
      amount,
      source: `securityDepositLedger.${provingLedger.kind}`,
      evidenceSourceRef: provingLedger.sourceRef || null,
      evidence: [{
        kind: "security_deposit_ledger",
        ledgerKind: provingLedger.kind,
        idempotencyKey: provingLedger.idempotencyKey || null,
        sourceRef: provingLedger.sourceRef || null,
      }],
      paymentIds: provingLedger.paymentId ? [id(provingLedger.paymentId)] : [],
      billIds: provingLedger.billId ? [id(provingLedger.billId)] : [],
    };
  }

  const reservationId = reservation._id;
  const initialBills = bills || await Bill.find({
    reservationId,
    billType: "initial_payment",
    isArchived: { $ne: true },
    status: { $ne: "voided" },
  }).sort({ createdAt: 1 }).session(session || null).lean();

  const explicitBills = initialBills.filter((bill) => explicitDepositFromBill(bill) !== null);
  const fullySettledBills = explicitBills.filter(billIsFullySettled);
  if (fullySettledBills.length === 1) {
    const bill = fullySettledBills[0];
    const amount = explicitDepositFromBill(bill);
    const suppliedPayments = Array.isArray(payments)
      ? payments.filter((payment) => !payment.billId || id(payment.billId) === id(bill._id))
      : null;
    const billPayments = suppliedPayments || await Payment.find({ billId: bill._id })
      .session(session || null)
      .lean();
    const settledPayments = billPayments.filter((payment) => SETTLED_PAYMENT_STATUSES.has(payment.status));
    return {
      classification: "VERIFIED",
      heldKnown: true,
      amount,
      source: "paid_initial_payment_bill.initialPaymentBreakdown.securityDeposit",
      evidenceSourceRef: { kind: "bill", id: id(bill._id) },
      evidence: [{
        kind: "initial_payment_bill",
        id: id(bill._id),
        status: bill.status,
        totalAmount: finiteMoney(bill.totalAmount),
        paidAmount: finiteMoney(bill.paidAmount),
        remainingAmount: finiteMoney(bill.remainingAmount),
        explicitSecurityDeposit: amount,
      }],
      paymentIds: settledPayments.map((payment) => id(payment._id)),
      billIds: [id(bill._id)],
    };
  }

  if (fullySettledBills.length > 1) {
    return {
      classification: "PARTIALLY_PROVABLE",
      heldKnown: false,
      amount: null,
      source: "multiple_paid_initial_payment_bills",
      evidence: fullySettledBills.map((bill) => ({
        kind: "initial_payment_bill",
        id: id(bill._id),
        explicitSecurityDeposit: explicitDepositFromBill(bill),
      })),
      paymentIds: [],
      billIds: fullySettledBills.map((bill) => id(bill._id)),
    };
  }

  if (explicitBills.length > 0 || ledger.length > 0) {
    return {
      classification: "PARTIALLY_PROVABLE",
      heldKnown: false,
      amount: null,
      source: explicitBills.length > 0 ? "unsettled_initial_payment_evidence" : "incomplete_deposit_ledger",
      evidence: explicitBills.map((bill) => ({
        kind: "initial_payment_bill",
        id: id(bill._id),
        status: bill.status,
        explicitSecurityDeposit: explicitDepositFromBill(bill),
        remainingAmount: finiteMoney(bill.remainingAmount),
      })),
      paymentIds: [],
      billIds: explicitBills.map((bill) => id(bill._id)),
    };
  }

  return {
    classification: "UNKNOWN",
    heldKnown: false,
    amount: null,
    source: "no_paid_deposit_evidence",
    evidence: [],
    paymentIds: [],
    billIds: [],
  };
}

export const securityDepositEvidenceInternals = {
  billIsFullySettled,
  explicitDepositFromBill,
  finiteMoney,
  ledgerEntryIsStructurallyProvable,
};
