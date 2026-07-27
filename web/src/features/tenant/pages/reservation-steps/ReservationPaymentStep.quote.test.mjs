import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./ReservationPaymentStep.jsx", import.meta.url),
  "utf8",
);

test("loads the authoritative payment quote for the current reservation", () => {
  assert.match(source, /billingApi\.getDepositPaymentQuote\(reservationId\)/);
  assert.match(source, /paymentQuote\?\.amountDue/);
  assert.doesNotMatch(source, /monthlyRent\s*\*\s*2/);
});

test("requires a ready, unexpired quote before enabling checkout", () => {
  assert.match(source, /paymentQuote\?\.ready === true/);
  assert.match(source, /paymentQuote\?\.expired !== true/);
  assert.match(source, /disabled=\{!canPay\}/);
});

test("shows quote readiness failures without discarding local acknowledgement state", () => {
  assert.match(source, /paymentQuote\?\.missingFields\?\.length/);
  assert.match(source, /Payment deadline expired/);
  assert.match(source, /agreedToFeePolicy/);
  assert.doesNotMatch(source, /setAgreedToFeePolicy\(false\)/);
});
