import crypto from "crypto";
import { BILL_RECEIPT_TEMPLATE_VERSION } from "./billingReceiptTemplate.js";

export const SETTLED_PAYMENT_STATUSES = Object.freeze(["paid", "approved", "confirmed"]);

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function paymentIdentity(payment = {}) {
  return {
    id: String(payment._id || ""),
    paymentId: payment.paymentId || null,
    providerPaymentId: payment.providerPaymentId || null,
    referenceNumber: payment.referenceNumber || payment.paymentReference || null,
    amount: Number(payment.amount || 0),
    method: payment.method || payment.paymentMethod || null,
    status: payment.status || null,
    settledAt: iso(payment.settlementTimestamp || payment.processedAt || payment.verifiedAt || payment.createdAt),
    updatedAt: iso(payment.updatedAt),
  };
}

export function buildBillReceiptSourceVersion(bill, payments = []) {
  const source = {
    billId: String(bill?._id || ""),
    billUpdatedAt: iso(bill?.updatedAt || bill?.createdAt),
    invoiceVersion: Number(bill?.invoiceVersion || 1),
    paidAmount: Number(bill?.paidAmount || 0),
    remainingAmount: Number(bill?.remainingAmount || 0),
    payments: payments.map(paymentIdentity).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
  return crypto.createHash("sha256").update(JSON.stringify(source)).digest("hex").slice(0, 20);
}

export function isBillReceiptStale(bill, sourceVersion) {
  if (!bill?.receiptPath) return false;
  return Number(bill.receiptTemplateVersion) !== BILL_RECEIPT_TEMPLATE_VERSION
    || !bill.receiptGeneratedAt
    || String(bill.receiptSourceVersion || "") !== String(sourceVersion || "");
}

export async function recordBillReceiptGeneration(bill, receiptPath, sourceVersion, now = new Date()) {
  bill.receiptPath = receiptPath;
  bill.receiptGeneratedAt = now;
  bill.receiptTemplateVersion = BILL_RECEIPT_TEMPLATE_VERSION;
  bill.receiptSourceVersion = sourceVersion;
  await bill.save({ timestamps: false });
}
