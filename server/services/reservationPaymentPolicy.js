import crypto from "crypto";
import { roundMoney } from "./billing/billingPolicy.js";

export const RESERVATION_PAYMENT_CURRENCY = "PHP";
export const RESERVATION_PRICING_VERSION = 1;

const finiteMoney = (value) =>
  value !== null && value !== undefined && Number.isFinite(Number(value))
    ? roundMoney(value)
    : null;

const hashQuote = (quote) =>
  crypto.createHash("sha256").update(JSON.stringify({
    monthlyRent: quote.monthlyRent,
    advanceRent: quote.advanceRent,
    securityDeposit: quote.securityDeposit,
    reservationFeeCredit: quote.reservationFeeCredit,
    amountDue: quote.amountDue,
    currency: quote.currency,
    pricingVersion: quote.pricingVersion,
  })).digest("hex");

export function buildReservationPaymentPricingSnapshot(pricing = {}, capturedAt = new Date()) {
  const monthlyRent = finiteMoney(pricing.monthlyRent);
  const advanceRent = finiteMoney(pricing.moveInCashOut?.monthlyAdvance);
  const securityDeposit = finiteMoney(pricing.moveInCashOut?.securityDeposit);
  const reservationFeeCredit = finiteMoney(pricing.reservationFeeAmount);
  const amountDue = finiteMoney(pricing.moveInCashOut?.netAmountDue);
  const snapshot = {
    monthlyRent,
    advanceRent,
    securityDeposit,
    reservationFeeCredit,
    amountDue,
    currency: RESERVATION_PAYMENT_CURRENCY,
    pricingVersion: RESERVATION_PRICING_VERSION,
    source: "reservation_pricing_policy",
    capturedAt,
  };
  return { ...snapshot, quoteHash: hashQuote(snapshot) };
}
export function resolveReservationInitialCharges(reservation = {}) {
  const snapshot = reservation.paymentPricingSnapshot || {};
  return {
    monthlyRent: finiteMoney(snapshot.monthlyRent),
    advanceRent: finiteMoney(snapshot.advanceRent),
    securityDeposit: finiteMoney(snapshot.securityDeposit),
    reservationFeeCredit: finiteMoney(snapshot.reservationFeeCredit),
    amountDue: finiteMoney(snapshot.amountDue),
    currency: String(snapshot.currency || "").toUpperCase(),
    pricingVersion: Number(snapshot.pricingVersion) || null,
    quoteHash: snapshot.quoteHash || null,
    approvedAt: snapshot.approvedAt || null,
    expiresAt: reservation.paymentExpiresAt || null,
  };
}

export function validateReservationPaymentQuote(reservation = {}, { requireApproval = true } = {}) {
  const quote = resolveReservationInitialCharges(reservation);
  const missingFields = [];
  if (!(quote.monthlyRent > 0)) missingFields.push("approvedMonthlyRent");
  if (!(quote.advanceRent > 0)) missingFields.push("approvedAdvanceRent");
  if (!(quote.securityDeposit > 0)) missingFields.push("approvedSecurityDeposit");
  if (quote.reservationFeeCredit === null) missingFields.push("approvedReservationFee");
  if (!(quote.amountDue > 0)) missingFields.push("approvedAmountDue");
  if (quote.currency !== RESERVATION_PAYMENT_CURRENCY) missingFields.push("paymentCurrency");
  if (!quote.pricingVersion) missingFields.push("pricingVersion");
  if (!quote.quoteHash || quote.quoteHash !== hashQuote(quote)) missingFields.push("pricingQuoteHash");
  if (requireApproval && !quote.approvedAt) missingFields.push("pricingApproval");
  return { valid: missingFields.length === 0, missingFields, quote };
}

export function getReservationCheckoutBlockers(reservation = {}, now = new Date()) {
  const validation = validateReservationPaymentQuote(reservation);
  const blockers = [...validation.missingFields];
  if (!reservation.applicationReviewedAt || !reservation.applicationReviewedBy) {
    blockers.push("applicationApproval");
  }
  if (!reservation.approvedForPaymentAt) blockers.push("paymentApproval");
  if (!reservation.paymentExpiresAt) blockers.push("paymentDeadline");
  else if (new Date(reservation.paymentExpiresAt).getTime() <= now.getTime()) {
    blockers.push("PAYMENT_DEADLINE_EXPIRED");
  }
  if (!Array.isArray(reservation.approvedPaymentMethods) ||
      !reservation.approvedPaymentMethods.includes("paymongo")) {
    blockers.push("paymentMethod");
  }
  return { blockers: [...new Set(blockers)], quote: validation.quote };
}
