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

// ── Derived UI states from the server view ──────────────────────────────
test("card renders the derived scheduled-transfer UI states, no raw record status", () => {
  const tones = card.match(/const STATUS_TONE = \{[\s\S]*?\n\};/)[0];
  for (const s of [
    "scheduled",
    "ready_for_transfer",
    "awaiting_settlement",
    "action_required",
    "completed",
    "cancelled",
  ]) {
    assert.ok(tones.includes(s), `expected STATUS_TONE to cover ${s}`);
  }
  // The raw orchestration status ("executed") must not surface as a UI state.
  assert.doesNotMatch(tones, /\bexecuted\b/);
});

// ── Cancel / Reschedule / Complete gating ──────────────────────────────
test("Cancel is offered while the record is open and no payment exists yet", () => {
  assert.match(card, /const isOpenRecord = !\["completed", "cancelled"\]\.includes\(status\)/);
  assert.match(card, /const canCancel = isOpenRecord && !hasPayment/);
});

test("Reschedule is offered while the record is open; Complete Transfer follows the server `completable` flag", () => {
  assert.match(card, /const canReschedule = isOpenRecord/);
  assert.match(card, /const canComplete = !!completable/);
  assert.match(card, /The scheduled transfer date has not been reached yet/);
  assert.doesNotMatch(card, /scheduled transfer date\/time has not been reached/i);
  // Reschedule sends date + time on the same destination.
  assert.match(card, /reservationApi\.rescheduleRoomTransfer\(/);
  assert.match(card, /effectiveTransferTimeMinutes: mins/);
  // Complete Transfer calls the completion endpoint and handles the
  // awaiting-settlement / 409 outcomes without exposing internal machinery.
  assert.match(card, /reservationApi\.completeRoomTransfer\(/);
  assert.match(card, /TRANSFER_SETTLEMENT_UNPAID/);
  assert.doesNotMatch(card, /UtilityFinalization|reconciliationVariance/);
});

test("payment-already-received cancel path directs to Administration Office, no auto-reversal", () => {
  assert.match(card, /Administration Office/);
  assert.match(card, /2nd Floor/);
  assert.match(card, /cannot be cancelled automatically/i);
  assert.match(card, /PAID_TRANSFER_CANNOT_COMPLETE/);
});

test("utilities are shown as deferred to period close, entered at Complete Transfer", () => {
  assert.match(card, /boundary meter readings are entered at Complete Transfer/);
  assert.match(card, /follow the normal period close/);
});

// ── Audit item 4: meter inputs are rendered from server applicability flags ──
test("CompleteTransferDialog renders meter inputs from the server preview's electricity flags, not branch rules", () => {
  // The dialog fetches the server-authoritative preview.
  assert.match(card, /reservationApi\.getRoomTransferPreview\(/);
  // Applicability comes straight from the preview payload.
  assert.match(card, /preview\.electricity\?\.subMetered/);
  assert.match(card, /preview\.destinationElectricity\?\.subMetered/);
  // Each input is conditionally rendered on its own sub-metered flag.
  assert.match(card, /sourceSubMetered \? \(/);
  assert.match(card, /destSubMetered \? \(/);
  // No branch names hard-coded in the dialog (rules stay on the server).
  assert.doesNotMatch(card, /guadalupe|gil-puyat/i);
  // A fixed-rate branch (neither sub-metered) shows the "no meter reading" copy.
  assert.match(card, /no meter reading is needed/i);
});

// ── API surface the card depends on ────────────────────────────────────
test("cancel / reschedule / complete scheduled-transfer API methods exist", () => {
  assert.match(reservationApi, /cancelScheduledRoomTransfer/);
  assert.match(reservationApi, /rescheduleRoomTransfer/);
  assert.match(reservationApi, /completeRoomTransfer/);
});

// ── Tenant web: current room stays source before the effective date ────
test("tenant ContractsPage shows the upcoming transfer without changing the current room", () => {
  assert.match(contractsPage, /[Uu]pcoming Room Transfer|[Ss]cheduled Room Transfer/);
});
