import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(__dirname, "ReservationPaymentStep.jsx");
const cssPath = path.resolve(__dirname, "../../styles/reservation-flow.css");

test("ReservationPaymentStep: adheres strictly to friendly typography, clear Total Due Today, and hierarchy invariants", () => {
  const code = fs.readFileSync(componentPath, "utf-8");
  const css = fs.readFileSync(cssPath, "utf-8");

  // 1. Prohibit legacy confusing terms
  assert.ok(!code.includes("Initial Reservation Deposit"), 'Must not use "Initial Reservation Deposit"');
  assert.ok(!code.includes("pre-move-in balance"), 'Must not use "pre-move-in balance"');
  assert.ok(!code.includes("I understand that the"), 'Must use formal "I acknowledge that the"');

  // 2. Enforce friendly Title Case labels & Total Due Today
  assert.ok(code.includes("Total Due Today"), 'Total row must clearly state "Total Due Today"');
  assert.ok(code.includes("Slot Reservation Fee"), 'Must retain "Slot Reservation Fee" as sub-descriptor');
  assert.ok(code.includes("Accepted Payment Methods:"), 'Payment methods label must be "Accepted Payment Methods:"');
  assert.ok(code.includes("Bed Slot"), 'Bed label should be friendly "Bed Slot"');
  assert.ok(code.includes("Intended Move-In Date"), 'Intended Move-In Date label should be "Intended Move-In Date"');
  assert.ok(code.includes("Lease Duration"), 'Lease label should be "Lease Duration"');

  // 3. Enforce Bed icon presence for visual consistency
  assert.ok(code.includes("<BedDouble ") || code.includes("<Bed "), "Bed Slot row must include a Bed or BedDouble icon for visual alignment");

  // 4. Enforce concise single-line monthly stay rate subtext format
  assert.ok(
    code.includes("Starts Month 2") &&
    code.includes("Incl. ₱") &&
    !code.includes("Starts on Month 2 (excludes utilities)"),
    "Subtext must use concise 'Starts Month 2 · Incl. ₱{applianceFees}/mo appliances' format"
  );

  // 5. Enforce CSS friendliness (no rigid all-caps transform on summary rows and payment methods bar)
  assert.ok(!css.includes(".rf-uc-label {\n  font-weight: 600;\n  font-size: 12px;\n  text-transform: uppercase;"), "Summary labels should not have uppercase transform");

  // 6. Enforce unified policy container structure
  assert.ok(code.includes("rf-policy-unified-card"), 'Must wrap policy rows in "rf-policy-unified-card"');
  assert.ok(code.includes("rf-policy-credit-row"), 'Must have "rf-policy-credit-row"');
  assert.ok(code.includes("rf-policy-divider"), 'Must have "rf-policy-divider"');
  assert.ok(code.includes("rf-policy-check-row"), 'Must have "rf-policy-check-row"');

  // 7. Enforce sequence: Unified Policy -> Payment Methods Bar -> Pay Button
  const policyIndex = code.indexOf("rf-policy-unified-card");
  const methodsIndex = code.indexOf("rf-payment-methods-bar");
  const buttonIndex = code.indexOf("btn-pay-online-reservation");

  assert.ok(policyIndex > 0, "Policy card must exist");
  assert.ok(methodsIndex > policyIndex, "Payment methods must appear after policy container");
  assert.ok(buttonIndex > methodsIndex, "Pay button must appear after payment methods");
});
