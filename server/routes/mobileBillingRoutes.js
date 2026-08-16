/**
 * ============================================================================
 * MOBILE BILLING ROUTES (thin compatibility bridge over canonical Billing)
 * ============================================================================
 *
 * Server-side bridge so the mobile app's /api/m/billing/* and
 * /api/m/paymongo/* calls are answered from the SAME authoritative Bill
 * data, business rules, and payment workflow as the web application —
 * instead of the vendored server/mobile/controllers/billing.controller.js,
 * which reads/writes a legacy `billing` collection with its own status
 * vocabulary (see docs/reports for the audit that identified this).
 *
 * Mounted at /api/m BEFORE the vendored mobile router (server.js), so every
 * path defined here fully supersedes the vendored controller for mobile
 * billing traffic — same pattern as routes/mobileContractRoutes.js.
 * Paths NOT defined here (there are none for
 * billing after this change) would fall through to the vendored router.
 *
 * Every route derives tenant identity exclusively from the resolved mobile
 * session (req.mobileTenant / req.user.mongoId, set by mobileTenantAuth) —
 * never from a client-supplied id — and every bill lookup is scoped by
 * { _id, userId } so a tenant can only ever see their own bills.
 */

import express from "express";
import fs from "fs";
import path from "path";
import { Bill, Reservation } from "../models/index.js";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import { toMobileBill, isMobileEffectivelyPaid, toMobilePaymentMethodLabel } from "../services/mobileBillingBridge.js";
import { formatMobileElectricityBreakdown, formatMobileWaterBreakdown } from "../services/mobileBillingBridge.js";
import { getVisibleBillCharges, getVisibleBillSnapshot } from "../utils/billingPolicy.js";
import { generateBillReceiptPdf } from "../utils/pdfGenerator.js";
import {
  generateRentBillPdf,
  formatBillReference,
  buildTenantUtilityBreakdown,
  SERVER_ROOT,
  BILL_PDF_ROOT,
} from "../controllers/billing/_helpers.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// IMPORTANT: mobileTenantAuth is attached per-route below, NEVER via
// router.use() at the router level. This router is mounted at /api/m
// alongside sibling routers for /auth, /rooms, /faqs, etc. A router-level
// router.use(mobileTenantAuth) would run for EVERY /api/m/* request that
// reaches this router — including unauthenticated paths like
// /api/m/auth/login — and, since mobileTenantAuth ends the response with
// 401 instead of calling next() on failure, it would never fall through to
// the sibling router that actually owns that path. Matches the existing
// per-route convention in routes/mobileContractRoutes.js.

const NON_DRAFT_FILTER = { status: { $ne: "draft" }, isArchived: false };

async function mapMobileBillsWithBreakdowns(bills, tenantId) {
  const dbUser = { _id: tenantId };
  return Promise.all(
    bills.map(async (bill) => {
      const visibleCharges = getVisibleBillCharges(bill);
      let electricityBreakdown = null;
      let waterBreakdown = null;
      if (Number(visibleCharges.electricity || 0) > 0) {
        electricityBreakdown = await buildTenantUtilityBreakdown({ dbUser, bill, utilityType: "electricity" });
      }
      if (Number(visibleCharges.water || 0) > 0) {
        waterBreakdown = await buildTenantUtilityBreakdown({ dbUser, bill, utilityType: "water" });
      }
      return toMobileBill(bill, { electricityBreakdown, waterBreakdown });
    }),
  );
}

async function mapMobileBillWithBreakdowns(bill, tenantId) {
  if (!bill) return null;
  const [mobileBill] = await mapMobileBillsWithBreakdowns([bill], tenantId);
  return mobileBill;
}

router.get("/billing/me", mobileTenantAuth, asyncRoute(async (req, res) => {
  const bills = await Bill.find({ userId: req.mobileTenant._id, ...NON_DRAFT_FILTER })
    .sort({ billingCycleStart: -1, billingMonth: -1, createdAt: -1 });
  const mapped = await mapMobileBillsWithBreakdowns(bills, req.mobileTenant._id);
  res.json(mapped);
}));

router.get("/billing/me/latest", mobileTenantAuth, asyncRoute(async (req, res) => {
  const bill = await Bill.findOne({ userId: req.mobileTenant._id, ...NON_DRAFT_FILTER })
    .sort({ billingCycleStart: -1, billingMonth: -1, createdAt: -1 });
  if (!bill) return res.status(404).json({ detail: "No billing found" });
  const mapped = await mapMobileBillWithBreakdowns(bill, req.mobileTenant._id);
  res.json(mapped);
}));

router.get("/billing/history", mobileTenantAuth, asyncRoute(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const bills = await Bill.find({ userId: req.mobileTenant._id, ...NON_DRAFT_FILTER })
    .sort({ billingCycleStart: -1, billingMonth: -1, createdAt: -1 })
    .limit(limit);
  const mapped = await mapMobileBillsWithBreakdowns(bills, req.mobileTenant._id);
  res.json(mapped);
}));

// Preserves the mobile app's existing bill-shaped (not ledger-shaped)
// contract for "paid history": same query as /history, filtered to bills
// whose canonical effective status is "paid" — see mobileBillingBridge.js.
router.get("/billing/history/paid", mobileTenantAuth, asyncRoute(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  const bills = await Bill.find({ userId: req.mobileTenant._id, ...NON_DRAFT_FILTER })
    .sort({ billingCycleStart: -1, billingMonth: -1, createdAt: -1 })
    .limit(limit);
  const paidBills = bills.filter(isMobileEffectivelyPaid);
  const mapped = await mapMobileBillsWithBreakdowns(paidBills, req.mobileTenant._id);
  res.json(mapped);
}));

router.get("/billing/:billingId", mobileTenantAuth, asyncRoute(async (req, res) => {
  const { billingId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(billingId)) {
    return res.status(404).json({ detail: "Bill not found" });
  }
  const bill = await Bill.findOne({ _id: billingId, userId: req.mobileTenant._id, isArchived: false });
  if (!bill) return res.status(404).json({ detail: "Bill not found" });
  const mapped = await mapMobileBillWithBreakdowns(bill, req.mobileTenant._id);
  res.json(mapped);
}));

router.get("/billing/:billingId/breakdown/:utilityType", mobileTenantAuth, asyncRoute(async (req, res) => {
  const { billingId, utilityType } = req.params;
  if (!["electricity", "water"].includes(utilityType)) {
    return res.status(400).json({ detail: "Invalid utility type" });
  }
  if (!/^[0-9a-fA-F]{24}$/.test(billingId)) {
    return res.status(404).json({ detail: "Bill not found" });
  }
  const bill = await Bill.findOne({ _id: billingId, userId: req.mobileTenant._id, isArchived: false });
  if (!bill) return res.status(404).json({ detail: "Bill not found" });

  const dbUser = { _id: req.mobileTenant._id };
  const breakdown = await buildTenantUtilityBreakdown({ dbUser, bill, utilityType });
  if (!breakdown) {
    return res.status(404).json({ detail: `No ${utilityType} breakdown found for this bill` });
  }

  if (utilityType === "electricity") {
    return res.json({
      ...breakdown,
      electricity_breakdown: formatMobileElectricityBreakdown(breakdown),
    });
  }

  return res.json({
    ...breakdown,
    water_breakdown: formatMobileWaterBreakdown(breakdown),
  });
}));

router.get("/billing/:billingId/pdf", mobileTenantAuth, asyncRoute(async (req, res) => {
  const { billingId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(billingId)) {
    return res.status(404).json({ detail: "Bill not found" });
  }
  const bill = await Bill.findOne({ _id: billingId, userId: req.mobileTenant._id, isArchived: false })
    .populate("userId", "firstName lastName email")
    .populate("roomId", "name roomNumber branch");
  if (!bill) return res.status(404).json({ detail: "Bill not found" });

  let absolutePdfPath = bill.pdfPath ? path.resolve(SERVER_ROOT, bill.pdfPath) : null;
  const safePdfRoot = path.resolve(BILL_PDF_ROOT);

  if (!absolutePdfPath || !absolutePdfPath.startsWith(safePdfRoot) || !fs.existsSync(absolutePdfPath)) {
    const reservation = bill.reservationId
      ? await Reservation.findById(bill.reservationId)
          .populate("userId", "firstName lastName email")
          .populate("roomId", "name roomNumber branch type price monthlyPrice")
      : null;

    await generateRentBillPdf({
      bill,
      reservation: reservation || { userId: bill.userId, roomId: bill.roomId },
    });
    absolutePdfPath = path.resolve(SERVER_ROOT, bill.pdfPath);
  }

  if (!absolutePdfPath.startsWith(safePdfRoot) || !fs.existsSync(absolutePdfPath)) {
    return res.status(404).json({ detail: "PDF not found" });
  }

  res.download(absolutePdfPath, `${formatBillReference(bill)}.pdf`);
}));

// Payment Receipt — a distinct document from the Billing Statement above.
// Only ever generated for a bill with confirmed payment evidence (the same
// isMobileEffectivelyPaid() check /history/paid uses); an unpaid/partially
// paid bill gets 404, never a fabricated receipt. Content is deliberately
// narrower than the statement — payment evidence only, no charges table,
// no TOTAL DUE, no payment instructions (see generateBillReceiptPdf).
router.get("/billing/:billingId/receipt", mobileTenantAuth, asyncRoute(async (req, res) => {
  const { billingId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(billingId)) {
    return res.status(404).json({ detail: "Bill not found" });
  }
  const bill = await Bill.findOne({ _id: billingId, userId: req.mobileTenant._id, isArchived: false })
    .populate("userId", "firstName lastName email");
  if (!bill) return res.status(404).json({ detail: "Bill not found" });

  if (!isMobileEffectivelyPaid(bill)) {
    return res.status(404).json({ detail: "No payment receipt is available for this bill yet." });
  }

  const visible = getVisibleBillSnapshot(bill);
  const billReference = `RCPT-${formatBillReference(bill)}`;
  const receiptPath = await generateBillReceiptPdf({
    bill,
    tenant: bill.userId,
    billReference,
    amountPaid: visible.totalAmount,
    remainingAmount: visible.remainingAmount,
    paymentMethodLabel: toMobilePaymentMethodLabel(bill.paymentMethod),
  });

  const absoluteReceiptPath = path.resolve(SERVER_ROOT, receiptPath);
  const safePdfRoot = path.resolve(BILL_PDF_ROOT);
  if (!absoluteReceiptPath.startsWith(safePdfRoot) || !fs.existsSync(absoluteReceiptPath)) {
    return res.status(404).json({ detail: "Receipt not found" });
  }

  res.download(absoluteReceiptPath, `${billReference}.pdf`);
}));

// Payment-proof submission: bridged to the SAME canonical workflow the web
// app uses. The web app has retired manual proof-of-payment for monthly
// bills in favor of PayMongo checkout (see paymentVerificationController.js
// submitPaymentProof, which now unconditionally returns 409) — so the
// canonical answer here is authoritative and identical: mobile is pointed
// at online checkout instead of being allowed to self-report a payment.
// This also closes the audit-flagged unvalidated-status-write route (the
// old PUT /:billingId with a raw client-supplied `status`), since this
// handler never mutates the bill at all.
router.post("/billing/:billingId/payment-proof", mobileTenantAuth, asyncRoute(async (req, res) => {
  const { billingId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(billingId)) {
    return res.status(404).json({ detail: "Bill not found" });
  }
  const bill = await Bill.findOne({ _id: billingId, userId: req.mobileTenant._id, isArchived: false });
  if (!bill) return res.status(404).json({ detail: "Bill not found" });

  return res.status(409).json({
    detail:
      "Manual payment-proof uploads are no longer supported for monthly bills. " +
      "Please pay online through the app's checkout instead.",
    code: "PAYMONGO_SETTLEMENT_REQUIRED",
    bill: toMobileBill(bill),
  });
}));

// The vendored mobile billing controller exposed:
//   POST /billing         (createBilling — writes an arbitrary bill into the
//                           legacy collection with no admin check, letting
//                           any authenticated tenant fabricate billing
//                           history for themselves)
//   PUT  /billing/:billingId (updateBilling — accepted a raw client-supplied
//                           `status` with no enum validation)
// Neither is called by the current mobile frontend (see audit's endpoint
// inventory). Both are intercepted here and explicitly rejected so they can
// no longer be reached through the vendored fallback for mobile traffic.
router.post("/billing", mobileTenantAuth, (req, res) => {
  res.status(403).json({ detail: "Not permitted from the mobile app." });
});
router.put("/billing/:billingId", mobileTenantAuth, (req, res) => {
  res.status(403).json({ detail: "Not permitted from the mobile app." });
});

export default router;
