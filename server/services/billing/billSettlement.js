/**
 * ============================================================================
 * BILL SETTLEMENT SERVICE
 * ============================================================================
 *
 * Automated payment settlement processors (PayMongo webhook, online gateways).
 */

import { getVisibleBillSnapshot, roundMoney } from "./billingPolicy.js";
import { applyBillPayment } from "./paymentLedger.js";
import {
  syncStructuredReservationAfterBillSettlement,
  quarantineStructuredSettlementMismatch,
} from "../structuredInitialPaymentService.js";
import { STRUCTURED_INITIAL_PAYMENT_WORKFLOW } from "../../config/structuredInitialPayment.js";

export async function settlePaymongoBill({
  bill,
  paymentReference,
  settledAmount = null,
  paymentMethod = "paymongo",
  source = "paymongo-webhook",
  metadata = {},
  now = new Date(),
} = {}) {
  const visible = getVisibleBillSnapshot(bill, now);

  if (
    bill?.paymongoPaymentId === paymentReference ||
    visible.status === "paid"
  ) {
    // A retry must also heal Reservation state when the Bill write succeeded
    // but the post-settlement projection update was interrupted.
    await syncStructuredReservationAfterBillSettlement(bill);
    return {
      applied: false,
      reason: "already_applied",
      bill,
      appliedAmount: 0,
    };
  }

  const normalizedSettledAmount = roundMoney(settledAmount);
  const isStructuredInitialPayment =
    bill?.billType === "initial_payment" &&
    bill?.structuredWorkflowVersion === STRUCTURED_INITIAL_PAYMENT_WORKFLOW;
  const currency = String(metadata?.currency || "PHP").toUpperCase();
  if (isStructuredInitialPayment && currency !== "PHP") {
    await quarantineStructuredSettlementMismatch({
      bill,
      paymentReference,
      settledAmount: normalizedSettledAmount,
      currency,
      source,
      metadata,
      reason: "currency_mismatch",
      now,
    });
    return {
      applied: false,
      reason: "currency_mismatch_reconciliation_required",
      bill,
      appliedAmount: 0,
    };
  }
  if (
    isStructuredInitialPayment &&
    normalizedSettledAmount !== visible.remainingAmount
  ) {
    await quarantineStructuredSettlementMismatch({
      bill,
      paymentReference,
      settledAmount: normalizedSettledAmount,
      currency,
      source,
      metadata,
      reason: "amount_mismatch",
      now,
    });
    return {
      applied: false,
      reason: "amount_mismatch_reconciliation_required",
      bill,
      appliedAmount: 0,
    };
  }
  const appliedAmount =
    normalizedSettledAmount > 0
      ? roundMoney(Math.min(visible.remainingAmount, normalizedSettledAmount))
      : visible.remainingAmount;

  if (appliedAmount <= 0) {
    return {
      applied: false,
      reason: "no_balance_due",
      bill,
      appliedAmount: 0,
    };
  }

  const paymentResult = await applyBillPayment({
    bill,
    amount: appliedAmount,
    method: paymentMethod,
    source,
    referenceNumber: paymentReference,
    externalPaymentId: paymentReference,
    metadata: {
      ...metadata,
      provider: "paymongo",
    },
    now,
  });

  if (paymentResult?.reused) {
    return {
      applied: false,
      reason: "already_applied",
      bill,
      appliedAmount: 0,
    };
  }

  bill.paymongoPaymentId = paymentReference;
  bill.paymentProof = {
    verificationStatus: "approved",
    verifiedAt: now,
    submittedAmount: paymentResult.appliedAmount,
  };
  await bill.save();
  await syncStructuredReservationAfterBillSettlement(bill);

  return {
    applied: true,
    reason: "settled",
    bill,
    appliedAmount: paymentResult.appliedAmount,
    payment: paymentResult.payment,
  };
}

export default {
  settlePaymongoBill,
};
