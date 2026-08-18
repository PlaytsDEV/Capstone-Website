/**
 * ============================================================================
 * PAYMENT LEDGER SERVICE
 * ============================================================================
 *
 * Transaction-safe ledger operations for applying payments to bills.
 */

import Payment from "../../models/Payment.js";
import { getBillRemainingAmount, roundMoney, syncBillAmounts } from "./billingPolicy.js";
import {
  generatePaymentReference,
  isRawPaymentGatewayId,
} from "../../utils/referenceGenerator.js";

async function rollbackCreatedPayment(payment, paymentModel) {
  if (!payment) {
    return;
  }

  if (typeof payment.deleteOne === "function") {
    await payment.deleteOne();
    return;
  }

  if (typeof paymentModel?.deleteOne === "function" && payment?._id) {
    await paymentModel.deleteOne({ _id: payment._id });
  }
}

async function findPaymentByExternalId(paymentModel, externalPaymentId, session = null) {
  if (!externalPaymentId || typeof paymentModel?.findOne !== "function") {
    return null;
  }

  const query = paymentModel.findOne({ externalPaymentId });
  if (session && query && typeof query.session === "function") {
    query.session(session);
  }

  return query;
}

async function createPaymentRecord(paymentModel, payload, session = null) {
  if (session) {
    return paymentModel.create(payload, { session });
  }

  return paymentModel.create(payload);
}

async function finalizeBillPayment({
  bill,
  amount,
  method,
  source,
  actorId,
  recordedBy,
  referenceNumber,
  externalPaymentId,
  notes,
  metadata,
  proofImageUrl,
  paymentModel,
  now,
  session,
}) {
  syncBillAmounts(bill, { preserveStatus: true });
  const remainingBefore = getBillRemainingAmount(bill);
  if (remainingBefore <= 0) {
    throw new Error("Bill has no remaining balance.");
  }

  // Phase 4: Reject overpayments — excess payment must not silently disappear.
  // 1-cent tolerance handles floating-point drift at the peso/cent boundary.
  if (amount > remainingBefore + 0.01) {
    throw new Error(
      `OVERPAYMENT_REJECTED: Payment amount (₱${amount.toFixed(2)}) exceeds remaining balance (₱${remainingBefore.toFixed(2)}). Reduce the payment amount or settle the exact balance.`,
    );
  }

  const appliedAmount = Math.min(remainingBefore, amount);
  if (appliedAmount <= 0) {
    throw new Error("Bill has no remaining balance.");
  }

  const rawExternalPaymentId =
    externalPaymentId || (isRawPaymentGatewayId(referenceNumber) ? referenceNumber : null);
  const cleanReferenceNumber =
    referenceNumber && !isRawPaymentGatewayId(referenceNumber)
      ? referenceNumber
      : generatePaymentReference({ prefix: "PAY", date: now });

  const payment = await createPaymentRecord(
    paymentModel,
    {
      tenantId: bill.userId,
      billId: bill._id,
      branch: bill.branch,
      amount: appliedAmount,
      method,
      purpose:
        bill.billType === "initial_payment"
          ? "initial_payment"
          : Number(bill?.charges?.rent || 0) > 0
            ? "regular_rent"
            : "other",
      provider: String(source || "").startsWith("paymongo") ? "paymongo" : null,
      providerPaymentId: String(source || "").startsWith("paymongo")
        ? rawExternalPaymentId
        : null,
      externalSessionId: metadata?.sessionId || null,
      webhookEventReference: metadata?.eventId || null,
      settlementTimestamp: String(source || "").startsWith("paymongo") ? now : null,
      currency: String(metadata?.currency || "PHP").toUpperCase(),
      referenceNumber: cleanReferenceNumber,
      paymentReference: cleanReferenceNumber,
      status: "paid",
      verifiedBy: actorId,
      verifiedAt: actorId ? now : null,
      source,
      externalPaymentId: rawExternalPaymentId,
      processedAt: now,
      notes,
      metadata,
      proofImageUrl,
      // Plan 3 (D5): Audit ledger snapshot — before/after balance + who recorded it
      balanceBefore: remainingBefore,
      balanceAfter: Math.max(0, roundMoney(remainingBefore - appliedAmount)),
      recordedBy: recordedBy || (actorId ? String(actorId) : "system"),
    },
    session,
  );

  try {
    bill.paidAmount = roundMoney((bill.paidAmount || 0) + appliedAmount);
    syncBillAmounts(bill);
    bill.paymentMethod = method;
    bill.paymentDate = bill.paidAmount > 0 ? now : null;
    if (session && typeof bill.save === "function") {
      await bill.save({ session });
    } else {
      await bill.save();
    }
  } catch (error) {
    if (!session) {
      await rollbackCreatedPayment(payment, paymentModel);
    }
    throw error;
  }

  return { bill, payment, appliedAmount };
}

export async function applyBillPayment({
  bill,
  amount,
  method,
  source,
  actorId = null,
  recordedBy = null,
  referenceNumber = null,
  externalPaymentId = null,
  notes = "",
  metadata = {},
  proofImageUrl = null,
  paymentModel = Payment,
  now = new Date(),
  session = null,
}) {
  const numericAmount = roundMoney(amount);
  if (numericAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const resolvedSession = session || bill?.$session?.() || null;
  const existingPayment = await findPaymentByExternalId(paymentModel, externalPaymentId, resolvedSession);
  if (existingPayment) {
    return { bill, payment: existingPayment, appliedAmount: 0, reused: true };
  }

  if (resolvedSession && typeof resolvedSession.withTransaction === "function") {
    return resolvedSession.withTransaction(async () =>
      finalizeBillPayment({
        bill,
        amount: numericAmount,
        method,
        source,
        actorId,
        recordedBy,
        referenceNumber,
        externalPaymentId,
        notes,
        metadata,
        proofImageUrl,
        paymentModel,
        now,
        session: resolvedSession,
      }),
    );
  }

  return finalizeBillPayment({
    bill,
    amount: numericAmount,
    method,
    source,
    actorId,
    recordedBy,
    referenceNumber,
    externalPaymentId,
    notes,
    metadata,
    proofImageUrl,
    paymentModel,
    now,
    session: null,
  });
}
