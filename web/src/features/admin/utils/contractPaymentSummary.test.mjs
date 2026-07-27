import assert from "node:assert/strict";
import test from "node:test";
import { resolveContractPaymentSummary } from "./contractPaymentSummary.mjs";

test("calculates missing initial-payment totals from the contract snapshot", () => {
  assert.deepEqual(resolveContractPaymentSummary({
    advanceRentAmount: 5400,
    securityDepositAmount: 5400,
    reservationFeeCreditAmount: 2000,
  }), {
    valid: true,
    totalInitialCharges: 10800,
    reservationFeeCreditApplied: 2000,
    remainingInitialAmountDue: 8800,
    source: "contract_snapshot_fallback",
  });
});

test("does not override a server-provided invalid summary", () => {
  const summary = { valid: false, code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" };
  assert.equal(resolveContractPaymentSummary({
    initialPaymentSummary: summary,
    advanceRentAmount: 5400,
    securityDepositAmount: 5400,
    reservationFeeCreditAmount: 2000,
  }), summary);
});

test("still provides total charges when the approved credit is unavailable", () => {
  assert.deepEqual(resolveContractPaymentSummary({
    advanceRentAmount: 5400,
    securityDepositAmount: 5400,
  }), {
    valid: false,
    totalInitialCharges: 10800,
    reservationFeeCreditApplied: null,
    remainingInitialAmountDue: null,
    source: "contract_snapshot_fallback",
  });
});
