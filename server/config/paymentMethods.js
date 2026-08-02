/**
 * Canonical list of payment methods supported across the system.
 * Import this constant into every model that carries a paymentMethod /
 * method field so that adding a new channel requires a single edit here.
 */
export const PAYMENT_METHODS = Object.freeze([
  "bank",
  "gcash",
  "card",
  "check",
  "paymongo",
  "paymaya",
  "grab_pay",
  "maya",
  "online",
]);

export const PROHIBITED_CASH_PAYMENT_METHODS = Object.freeze([
  "cash",
  "cash_payment",
  "manual_cash",
  "walk_in_cash",
  "petty_cash",
  "cash_on_hand",
  "counter_payment",
  "cash_at_branch",
  "cash_on_move_in",
]);

export const isProhibitedCashPaymentMethod = (value) =>
  PROHIBITED_CASH_PAYMENT_METHODS.includes(
    String(value || "").trim().toLowerCase(),
  );
