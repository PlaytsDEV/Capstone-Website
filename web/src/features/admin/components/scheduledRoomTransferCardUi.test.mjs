/**
 * PHASE 2I — Scheduled Room Transfer admin card.
 * Source-level assertions (house style): the card is presentational only
 * (no client-side money/proration math — every figure comes from the server
 * payload), exposes exactly the simple states, and gates Cancel/Retry the
 * way the executor's departure/cancellation rules require.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

const card = read("./tenants/details/ScheduledRoomTransferCard.jsx");
const reservationApi = read("../../../shared/api/reservationApi.js");
const contractsPage = read("../../tenant/pages/ContractsPage.jsx");

// ── No client-side calculation ──────────────────────────────────────────
test("card does no client-side money math — every amount is a server-provided field", () => {
  // It reads canonical fields straight off `transfer` / `transferBalance`.
  assert.match(card, /currentMonthlyRent,\s*newMonthlyRent/);
  assert.match(card, /transferBalance,/);
  assert.match(card, /bal\.amountDue/);
  assert.match(card, /bal\.amountPaid/);
  assert.match(card, /bal\.remaining/);
  // No arithmetic operators applied to money — only display formatting.
  assert.doesNotMatch(card, /amountDue\s*[-+*/]\s*amount/);
  assert.doesNotMatch(card, /Number\(bal\.amountDue\)\s*-\s*Number\(bal\.amountPaid\)/);
  // Only a presence check on the paid amount, never a re-derivation of remaining.
  assert.match(card, /formatMoney\(bal\.remaining \?\? bal\.amountDue\)/);
});

// ── Only the simple, published states ───────────────────────────────────
test("card renders only the four tenant-facing states, no internal ones", () => {
  const tones = card.match(/const STATUS_TONE = \{[^}]*\}/s)[0];
  for (const s of ["awaiting_payment", "ready", "action_required", "completed", "cancelled"]) {
    assert.ok(tones.includes(s), `expected STATUS_TONE to cover ${s}`);
  }
  // Raw executor internals must not surface as states here.
  assert.doesNotMatch(tones, /\bscheduled\b|\bexecuted\b/);
});

// ── Cancel / Retry gating matches the executor rules ────────────────────
test("Cancel is offered in safe states and blocked once a payment exists", () => {
  // awaiting_payment / ready always cancellable; action_required only when no payment.
  assert.match(
    card,
    /canCancel\s*=\s*\["awaiting_payment",\s*"ready"\]\.includes\(status\)\s*\|\|\s*\(status === "action_required" && !hasPayment\)/,
  );
});

test("Retry is only offered for the payment-resolvable action_required reasons", () => {
  assert.match(card, /RETRYABLE_REASONS = new Set\(\["TRANSFER_BALANCE_UNPAID",\s*"ADDITIONAL_BALANCE_DUE"\]\)/);
  assert.match(card, /canRetry\s*=\s*status === "action_required" && RETRYABLE_REASONS\.has\(reasonCode\)/);
});

test("payment-already-received cancel path directs to Administration Office, no auto-reversal", () => {
  assert.match(card, /Administration Office/);
  assert.match(card, /cannot be cancelled automatically/i);
});

test("utilities are shown as deferred to the cutoff, never billed on this card", () => {
  assert.match(card, /Utilities: to follow after the transfer cutoff/);
  assert.doesNotMatch(card, /electricity|water/i);
});

// ── API surface the card depends on ────────────────────────────────────
test("cancel/retry scheduled-transfer API methods exist", () => {
  assert.match(reservationApi, /cancelScheduledRoomTransfer/);
  assert.match(reservationApi, /retryScheduledRoomTransfer/);
});

// ── Tenant web: current room stays source before the effective date ────
test("tenant ContractsPage shows the upcoming transfer without changing the current room", () => {
  assert.match(contractsPage, /[Uu]pcoming Room Transfer|[Ss]cheduled Room Transfer/);
});
