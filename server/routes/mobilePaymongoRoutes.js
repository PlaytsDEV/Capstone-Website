/**
 * ============================================================================
 * MOBILE PAYMONGO ROUTES (thin compatibility bridge over canonical PayMongo)
 * ============================================================================
 *
 * Bridges the mobile app's checkout creation / status polling calls onto the
 * SAME PayMongo integration the web app uses (config/paymongo.js,
 * services/billing/billSettlement.js) instead of the vendored
 * server/mobile/controllers/paymongo.controller.js, which resolves bills
 * against a legacy collection and re-implements checkout/settlement
 * independently.
 *
 * Deliberately does NOT re-implement (or re-mount) a webhook here: checkout
 * sessions created by this router use the exact same
 * metadata: { type: "bill", billId, userId, amountDue } shape the web
 * checkout uses, so the ALREADY-mounted, already-fail-closed canonical
 * webhook (routes/webhookRoutes.js -> controllers/webhookController.js,
 * mounted at /api/paymongo and /api/webhooks in server.js, BEFORE the
 * global JSON body parser) settles mobile-originated payments automatically
 * — there is exactly one authoritative webhook handler for the whole
 * system. The status-polling route below additionally settles idempotently
 * as a tenant-safe convenience path, mirroring paymentController.js
 * checkSessionStatus.
 *
 * The mobile app's existing browser-bounce deep-link pages
 * (GET /api/m/paymongo/redirect/success|cancel, served by the vendored
 * server/mobile/routes/paymongo.routes.js) are intentionally reused as the
 * checkout success/cancel URLs below rather than duplicated — they already
 * produce the correct frontend://... app deep link and require no auth.
 */

import express from "express";
import { createCheckoutSession, getCheckoutSession } from "../config/paymongo.js";
import { Bill } from "../models/index.js";
import { getBillRemainingAmount, getVisibleBillSnapshot } from "../utils/billingPolicy.js";
import { settlePaymongoBill } from "../utils/billSettlement.js";
import { readPaidPayments, readPaymentMethod, normalizeCheckoutStatusForClient } from "../utils/paymongoPaymentMethod.js";
import { getPublicUrlConfig } from "../config/publicUrls.js";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import { toMobileBill } from "../services/mobileBillingBridge.js";
import { NON_DRAFT_BILL_FILTER } from "../services/billing/currentBillResolver.js";
import auditLogger from "../utils/auditLogger.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const MAX_BATCH_BILLS = 100;

function normalizeBillIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_BILLS) return null;
  const normalized = value.map((id) => String(id || "").trim());
  if (normalized.some((id) => !/^[0-9a-fA-F]{24}$/.test(id))) return null;
  if (new Set(normalized).size !== normalized.length) return null;
  return normalized;
}

function readBatchBillIds(metadata = {}) {
  try {
    const raw = Array.isArray(metadata.billIds)
      ? metadata.billIds
      : JSON.parse(metadata.billIds || "[]");
    return normalizeBillIds(raw);
  } catch {
    return null;
  }
}

// IMPORTANT: mobileTenantAuth is attached per-route below, NEVER via
// router.use() at the router level — see the identical note in
// routes/mobileBillingRoutes.js. A router-level router.use() here would
// also incorrectly gate unrelated /api/m/* paths (e.g. /api/m/auth/login)
// mounted after this router in server.js.

router.post("/paymongo/checkout", mobileTenantAuth, asyncRoute(async (req, res) => {
  const billingId = String(req.body?.billingId || "").trim();
  if (!billingId || !/^[0-9a-fA-F]{24}$/.test(billingId)) {
    return res.status(400).json({ detail: "billingId is required" });
  }

  const bill = await Bill.findOne({ _id: billingId, userId: req.mobileTenant._id, isArchived: false });
  if (!bill) return res.status(404).json({ detail: "Bill not found" });

  const visible = getVisibleBillSnapshot(bill);
  if (visible.status === "paid") {
    return res.status(400).json({ detail: "This bill has already been paid" });
  }

  // Trusted amount — computed server-side from canonical Bill charges, never
  // accepted from the client.
  const amountDue = visible.remainingAmount;
  if (amountDue <= 0) {
    return res.status(400).json({ detail: "No visible balance is currently due" });
  }

  const { publicApiUrl } = getPublicUrlConfig();
  const monthLabel = bill.billingMonth
    ? new Date(bill.billingMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Bill";
  const checkoutIdempotencyKey = `mobile-bill:${bill._id}:balance:${Math.round(amountDue * 100)}`;

  const { checkoutUrl, sessionId } = await createCheckoutSession({
    amount: amountDue,
    description: `Lilycrest Dormitory - ${monthLabel} Bill`,
    metadata: {
      type: "bill",
      purpose: "regular_bill",
      billId: String(bill._id),
      userId: String(req.mobileTenant._id),
      amountDue: String(amountDue),
    },
    successUrl: `${publicApiUrl}/api/m/paymongo/redirect/success?billing_id=${bill._id}`,
    cancelUrl: `${publicApiUrl}/api/m/paymongo/redirect/cancel?billing_id=${bill._id}`,
    idempotencyKey: checkoutIdempotencyKey,
  });

  bill.paymongoSessionId = sessionId;
  bill.paymongoCheckoutIdempotencyKey = checkoutIdempotencyKey;
  await bill.save();

  await auditLogger.log({
    req,
    type: "data_modification",
    action: "payment.mobile_paymongo_checkout_created",
    severity: "info",
    entityType: "bill",
    entityId: bill._id,
    details: "Created a PayMongo Bill checkout from the mobile app.",
    metadata: { billId: String(bill._id), amount: amountDue, currency: "PHP" },
  });

  res.json({
    checkout_url: checkoutUrl,
    checkout_id: sessionId,
    reference: sessionId,
  });
}));

// The web tenant app already uses the canonical multi_bill PayMongo workflow.
// Mobile exposes that same metadata + webhook settlement contract so an
// Outstanding Balance card can pay the complete selected obligation instead
// of silently collapsing to the first unpaid bill. Bill IDs only identify the
// selection; ownership, payable status, and amount are re-resolved here from
// canonical Bill records at checkout time.
router.post("/paymongo/checkout-batch", mobileTenantAuth, asyncRoute(async (req, res) => {
  const billIds = normalizeBillIds(req.body?.billIds);
  if (!billIds) {
    return res.status(400).json({
      code: "INVALID_BILL_IDS",
      detail: `billIds must contain 1-${MAX_BATCH_BILLS} unique bill IDs.`,
    });
  }

  const bills = await Bill.find({
    _id: { $in: billIds },
    userId: req.mobileTenant._id,
    ...NON_DRAFT_BILL_FILTER,
  });
  if (bills.length !== billIds.length) {
    return res.status(404).json({ detail: "One or more selected bills were not found" });
  }

  const payableBills = bills.filter((bill) => {
    const visible = getVisibleBillSnapshot(bill);
    return visible.status !== "paid" && visible.remainingAmount > 0;
  });
  if (payableBills.length !== bills.length) {
    return res.status(409).json({
      code: "OUTSTANDING_BALANCE_CHANGED",
      detail: "Your outstanding balance changed. Refresh Billing before continuing.",
    });
  }

  const totalDue = Math.round(payableBills.reduce(
    (sum, bill) => sum + getVisibleBillSnapshot(bill).remainingAmount,
    0,
  ) * 100) / 100;
  if (totalDue <= 0) {
    return res.status(400).json({ detail: "No visible balance is currently due" });
  }

  const payableBillIds = payableBills.map((bill) => String(bill._id));
  const checkoutIdempotencyKey = `multi_bill:${[...payableBillIds].sort().join("_")}:balance:${Math.round(totalDue * 100)}`;
  const { publicApiUrl } = getPublicUrlConfig();
  const { checkoutUrl, sessionId } = await createCheckoutSession({
    amount: totalDue,
    description: `Lilycrest Dormitory - Outstanding Balance (${payableBills.length} Bill${payableBills.length === 1 ? "" : "s"})`,
    metadata: {
      type: "multi_bill",
      billIds: JSON.stringify(payableBillIds),
      userId: String(req.mobileTenant._id),
      amountDue: String(totalDue),
    },
    successUrl: `${publicApiUrl}/api/m/paymongo/redirect/success?billing_id=outstanding`,
    cancelUrl: `${publicApiUrl}/api/m/paymongo/redirect/cancel?billing_id=outstanding`,
    idempotencyKey: checkoutIdempotencyKey,
  });

  await Bill.updateMany(
    { _id: { $in: payableBillIds }, userId: req.mobileTenant._id },
    {
      $set: {
        paymongoSessionId: sessionId,
        paymongoCheckoutIdempotencyKey: checkoutIdempotencyKey,
      },
    },
  );

  await auditLogger.log({
    req,
    type: "data_modification",
    action: "payment.mobile_paymongo_multi_bill_checkout_created",
    severity: "info",
    entityType: "bill",
    entityId: payableBills[0]._id,
    details: `Created a mobile PayMongo checkout for ${payableBills.length} outstanding bills.`,
    metadata: { billIds: payableBillIds, amount: totalDue, currency: "PHP" },
  });

  res.json({
    checkout_url: checkoutUrl,
    checkout_id: sessionId,
    reference: sessionId,
    total_amount: totalDue,
    bill_count: payableBills.length,
  });
}));

// The vendored mobile backend (mobile/routes/paymongo.routes.js, loaded via
// mobile/mobileRoutes.mjs and mounted AFTER this router) defines its own
// POST /paymongo/webhook with INDEPENDENT settlement logic — it writes
// directly to db.collection('bills')/('billing') with its own idempotency
// key, entirely bypassing settlePaymongoBill(). Unlike POST /paymongo/checkout
// and GET /paymongo/checkout/:id/status above, nothing in this router
// previously defined /paymongo/webhook, so that vendored handler was NOT
// shadowed and remained live and reachable — a second, independent,
// DB-mutating webhook path alongside the canonical one (routes/webhookRoutes.js
// -> controllers/webhookController.js -> settlePaymongoBill, mounted at
// /api/paymongo and /api/webhooks). See docs/reports for the audit that
// found this.
//
// Mobile-originated checkout sessions created above already settle
// exclusively through that canonical webhook (same metadata shape as web:
// { type: "bill", billId, userId, amountDue }) and never depend on this
// path being live. Intercepting it here removes the vendored handler from
// service for mobile traffic instead of leaving a second settlement engine
// reachable. Acknowledge-without-processing (200, not 404) so PayMongo is
// never prompted to retry/flag this URL if it is still registered anywhere.
router.post("/paymongo/webhook", (req, res) => {
  res.status(200).json({
    received: true,
    note: "This path no longer processes payments. The canonical webhook is POST /api/webhooks/paymongo.",
  });
});

router.get("/paymongo/checkout/:checkoutId/status", mobileTenantAuth, asyncRoute(async (req, res) => {
  const { checkoutId } = req.params;

  let session;
  try {
    session = await getCheckoutSession(checkoutId);
  } catch (err) {
    return res.json({ status: "unknown", paid: false, message: err.message || "Could not retrieve checkout session" });
  }

  const metadata = session.attributes?.metadata || {};
  const isSingleBill = metadata.type === "bill" && metadata.billId;
  const batchBillIds = metadata.type === "multi_bill" ? readBatchBillIds(metadata) : null;
  if (!isSingleBill && !batchBillIds) {
    return res.status(404).json({ detail: "Checkout session not found for this bill" });
  }

  const bills = isSingleBill
    ? [await Bill.findOne({ _id: metadata.billId, userId: req.mobileTenant._id, isArchived: false })].filter(Boolean)
    : await Bill.find({
        _id: { $in: batchBillIds },
        userId: req.mobileTenant._id,
        isArchived: false,
      });
  if (bills.length !== (isSingleBill ? 1 : batchBillIds.length)) {
    // Ownership check: the session's metadata.billId does not belong to the
    // caller — never confirm or deny the existence of another tenant's bill.
    return res.status(404).json({ detail: "Checkout session not found for this bill" });
  }

  const paidPayments = readPaidPayments(session);
  const isPaid = paidPayments.length > 0;

  if (isPaid) {
    const paymentReference = paidPayments[0]?.id || checkoutId;
    const sessionPaidAmount = Number(paidPayments[0]?.attributes?.amount || 0);
    const settledAmount = Number(metadata.amountDue || 0) > 0
      ? Number(metadata.amountDue)
      : sessionPaidAmount > 0 ? sessionPaidAmount / 100 : null;
    const { rawPaymentType } = readPaymentMethod(session, paidPayments);

    for (const bill of bills) {
      const amountForBill = isSingleBill ? settledAmount : getBillRemainingAmount(bill);
      if (amountForBill <= 0) continue;
      await settlePaymongoBill({
        bill,
        paymentReference,
        settledAmount: amountForBill,
        paymentMethod: rawPaymentType,
        source: "paymongo-polling",
        metadata: {
          sessionId: checkoutId,
          sessionType: isSingleBill ? "bill" : "multi_bill",
          currency: "PHP",
        },
      });
    }
  }

  const refreshedBills = isPaid
    ? await Bill.find({ _id: { $in: bills.map((bill) => bill._id) }, userId: req.mobileTenant._id })
    : bills;

  res.json({
    status: normalizeCheckoutStatusForClient(session, paidPayments),
    paid: isPaid,
    payments_count: paidPayments.length,
    checkout_url: session?.attributes?.checkout_url,
    bill: isSingleBill ? toMobileBill(refreshedBills[0]) : null,
    bills: isSingleBill ? undefined : refreshedBills.map((bill) => toMobileBill(bill)),
  });
}));

export default router;
