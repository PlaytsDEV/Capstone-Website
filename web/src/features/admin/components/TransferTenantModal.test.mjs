import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const modalSource = fs.readFileSync(
  new URL("./TenantWorkspaceModals.jsx", import.meta.url),
  "utf8",
);

const transferModalSource = modalSource.slice(
  modalSource.indexOf("export function TransferTenantModal"),
  modalSource.indexOf("export function MoveOutModal"),
);

// ── Pure helper logic for step-gate validation ─────────────────────────────
// R1 hybrid reconciliation: the transfer wizard no longer has a "prepare
// replacement Contract / wet-sign upload" step. Bed selection is required
// only when the DESTINATION room type needs a bed (shared rooms); a private
// destination has no bed to pick. There is NO front-end proration — every
// rent/deposit/utility figure comes from the server `transferPreview`.

export function validateTransferStep1({ roomId, bedId, destinationNeedsBed, hasOutstanding, forceOverride }) {
  if (!roomId) return { valid: false, error: "Please select a target room for the transfer." };
  if (destinationNeedsBed && !bedId) {
    return { valid: false, error: "Please select an available bed in the target room." };
  }
  if (hasOutstanding && !forceOverride) {
    return { valid: false, error: "Please acknowledge the tenant's outstanding balance before proceeding." };
  }
  return { valid: true };
}

export function validateTransferStep3MeterReadings({
  sourceReading,
  targetReading,
  sourceBaseline,
  targetBaseline,
  reason,
}) {
  const sourceNum = Number(sourceReading);
  const targetNum = Number(targetReading);

  if (sourceReading === "" || isNaN(sourceNum) || sourceNum < 0) {
    return { valid: false, error: "Please enter a valid final meter reading (kWh) for the current room." };
  }
  if (targetReading === "" || isNaN(targetNum) || targetNum < 0) {
    return { valid: false, error: "Please enter a valid opening meter reading (kWh) for the new room." };
  }
  if (sourceBaseline !== null && sourceNum < sourceBaseline) {
    return {
      valid: false,
      error: `Current room meter reading (${sourceNum} kWh) cannot be lower than the recorded baseline (${sourceBaseline} kWh).`,
    };
  }
  if (targetBaseline !== null && targetNum < targetBaseline) {
    return {
      valid: false,
      error: `New room opening meter reading (${targetNum} kWh) cannot be lower than the recorded baseline (${targetBaseline} kWh).`,
    };
  }
  if (!reason || !reason.trim()) {
    return { valid: false, error: "Please enter a reason for the room transfer." };
  }
  return { valid: true };
}

// ── Unit Tests ──────────────────────────────────────────────────────────────

test("Transfer wizard is adaptive: 3 steps immediate (incl. Meter Readings), 2 steps future scheduled", () => {
  // Immediate: Target Room → Meter Readings → Review.
  assert.match(
    transferModalSource,
    /wizardSteps = isScheduledTransfer\s*\?\s*\["Target Room", "Review"\]\s*:\s*\["Target Room", "Meter Readings", "Review"\]/s,
  );
  assert.match(transferModalSource, /steps=\{wizardSteps\}/);
  assert.match(transferModalSource, /STEP 1: Target Room & Date/);
  // Meter Readings step is rendered ONLY for an immediate transfer.
  assert.match(transferModalSource, /STEP 2 \(immediate only\): Meter Readings/);
  assert.match(transferModalSource, /\{step === 2 && !isScheduledTransfer &&/);
  // Review renders at step 3 (immediate) OR step 2 (scheduled).
  assert.match(transferModalSource, /const reviewStep = isScheduledTransfer \? 2 : 3/);
  assert.match(transferModalSource, /\{isReviewStep &&/);
});

test("Future scheduled transfer omits the Meter Readings step and says readings are finalized on the effective date", () => {
  assert.match(transferModalSource, /Meter readings will be finalized on the effective transfer date/);
  assert.match(transferModalSource, /To be finalized on \{fmtDate\(effectiveTransferDate\)\}/);
  // Scheduled review carries the concise Utilities note excluding electricity/water from the balance.
  assert.match(
    transferModalSource,
    /not included in the Scheduled\s*\n?\s*Room Transfer Balance/s,
  );
});

test("Scheduled transfer never submits scheduling-day meter readings", () => {
  assert.match(
    transferModalSource,
    /sourceRoomMeterReading:\s*\n?\s*isScheduledTransfer \|\| !sourceRoomMeterReading \? null : Number\(sourceRoomMeterReading\)/s,
  );
  assert.match(
    transferModalSource,
    /targetRoomMeterReading:\s*\n?\s*isScheduledTransfer \|\| !targetRoomMeterReading \? null : Number\(targetRoomMeterReading\)/s,
  );
});

test("Meter-reading state is cleared when switching immediate → scheduled and restored when switching back", () => {
  // The mode-switch effect clears readings + attempted flag in scheduled mode
  // and clamps the step, and re-seeds + forces the Meter Readings step back.
  assert.match(transferModalSource, /Meter-reading STATE SAFETY on immediate ⇄ scheduled switching/);
  assert.match(transferModalSource, /if \(isScheduledTransfer\) \{\s*\n\s*setSourceRoomMeterReading\(""\);\s*\n\s*setTargetRoomMeterReading\(""\);/s);
  assert.match(transferModalSource, /setStep\(\(s\) => \(s > reviewStep \? reviewStep : s\)\)/);
});

test("Wizard has NO replacement-contract preparation or wet-signed upload gate", () => {
  assert.doesNotMatch(transferModalSource, /prepareTransferContract/);
  assert.doesNotMatch(transferModalSource, /uploadFinalNotarizedContract|uploadSignedContract/);
  assert.doesNotMatch(transferModalSource, /Sign & Upload Contract/);
  assert.doesNotMatch(transferModalSource, /Prepare Replacement Contract/);
  assert.doesNotMatch(transferModalSource, /step2Ready/);
});

test("Step 1 validation: room required; bed required only for a shared destination", () => {
  assert.equal(
    validateTransferStep1({ roomId: "", bedId: "", destinationNeedsBed: true, hasOutstanding: false, forceOverride: false }).valid,
    false,
  );
  // Shared destination without a bed → blocked
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "", destinationNeedsBed: true, hasOutstanding: false, forceOverride: false }).valid,
    false,
  );
  // Private destination without a bed → allowed
  assert.equal(
    validateTransferStep1({ roomId: "room-205", bedId: "", destinationNeedsBed: false, hasOutstanding: false, forceOverride: false }).valid,
    true,
  );
  // Outstanding balance not acknowledged → blocked
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "bed-1", destinationNeedsBed: true, hasOutstanding: true, forceOverride: false }).valid,
    false,
  );
  // Acknowledged → allowed
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "bed-1", destinationNeedsBed: true, hasOutstanding: true, forceOverride: true }).valid,
    true,
  );
});

test("Step 2 validates departure and destination meter readings against baselines", () => {
  const validCheck = validateTransferStep3MeterReadings({
    sourceReading: "1500.50",
    targetReading: "850.00",
    sourceBaseline: 1450.0,
    targetBaseline: 800.0,
    reason: "Upgrading to window side",
  });
  assert.equal(validCheck.valid, true);

  const belowBaselineCheck = validateTransferStep3MeterReadings({
    sourceReading: "1400.00",
    targetReading: "850.00",
    sourceBaseline: 1450.0,
    targetBaseline: 800.0,
    reason: "Upgrading to window side",
  });
  assert.equal(belowBaselineCheck.valid, false);
  assert.match(belowBaselineCheck.error, /cannot be lower than the recorded baseline/);
});

test("Step 3 settlement is server-canonical: transferPreview, no front-end proration", () => {
  assert.match(transferModalSource, /useRoomTransferPreview/);
  assert.match(transferModalSource, /transferPreview/);
  assert.match(transferModalSource, /preview\.totalImmediateDue/);
  // The old front-end estimate must not drive anything here.
  assert.doesNotMatch(transferModalSource, /const proRataPreview =/);
  assert.doesNotMatch(transferModalSource, /const estimatedTotal =/);
  // Electricity/water are informational only.
  assert.match(transferModalSource, /billed at period close|generated during the normal utility period close|final charge is generated during/i);
});

test("Estimate PDF is generated from the same canonical transferPreview", () => {
  assert.match(transferModalSource, /transferPreview: preview/);
  assert.doesNotMatch(transferModalSource, /estimatedTotal,/);
});

test("R2 — Step 3 offers a Room Transfer Addendum preview using the prepare-addendum endpoint", () => {
  assert.match(transferModalSource, /reservationApi\.prepareRoomTransferAddendum/);
  assert.match(transferModalSource, /Room Transfer Addendum/);
  assert.match(transferModalSource, /Preview \/ Download Addendum/);
  // It must be labelled an Addendum, never a replacement lease.
  assert.doesNotMatch(transferModalSource, /Replacement Contract/i);
  assert.match(transferModalSource, /not a replacement lease/i);
  // Preview must NOT run the cutover — the prepare call is separate from onSubmit.
  assert.match(transferModalSource, /nothing is changed for the tenant until you press/i);
});

test("R3 — Step 2 (Review) shows original lease dates as unchanged + canonical rent/deposit", () => {
  assert.match(transferModalSource, /Original lease dates/);
  assert.match(transferModalSource, /does not start a new lease or reset the term/i);
  assert.match(transferModalSource, /Old rent → New rent|Old room → New room/);
});

test("Strict terminology invariants are maintained throughout TransferTenantModal", () => {
  assert.match(transferModalSource, /Transfer Tenant/i);
  assert.doesNotMatch(transferModalSource, /\bResident\b/);
  assert.doesNotMatch(transferModalSource, /\bRental Fee\b/);
});
