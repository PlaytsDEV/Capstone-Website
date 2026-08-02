import test from "node:test";
import assert from "node:assert/strict";
import { formatPaymentMethod } from "./formatPaymentMethod.js";

test("prospective PayMongo methods remain user-facing", () => {
  assert.equal(formatPaymentMethod("paymongo"), "Online Payment (PayMongo)");
  assert.equal(formatPaymentMethod("gcash"), "GCash");
});

for (const method of [
  "cash",
  "cash_payment",
  "manual_cash",
  "walk_in_cash",
  "petty_cash",
  "cash_on_hand",
  "cash_at_branch",
  "cash_on_move_in",
]) {
  test(`${method} renders only as neutral legacy history`, () => {
    assert.equal(formatPaymentMethod(method), "Legacy payment method");
  });
}
