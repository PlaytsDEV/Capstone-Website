import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { destinationRoomNeedsBed } from "../utils/transferDestinationBed.js";

const modalSource = fs.readFileSync(
  new URL("./TenantWorkspaceModals.jsx", import.meta.url),
  "utf8",
);

const transferModalSource = modalSource.slice(
  modalSource.indexOf("export function TransferTenantModal"),
  modalSource.indexOf("export function MoveOutModal"),
);

// ── Pure helper logic mirroring the step-1 gate ────────────────────────────
// The FUTURE-ONLY wizard: Target Room → Review. Step 1 requires a destination
// room (+ bed for a shared destination), a future effective date, a reason,
// and an acknowledged outstanding balance. There is NO Meter Readings step and
// no front-end proration — every figure comes from the server `transferPreview`.

export function validateTransferStep1({
  roomId,
  bedId,
  destinationNeedsBed,
  effectiveTransferDate,
  minDateStr,
  reason,
  hasOutstanding,
  forceOverride,
}) {
  if (!roomId) return { valid: false, error: "Please select a target room for the transfer." };
  if (destinationNeedsBed && !bedId) {
    return { valid: false, error: "Please select an available bed in the target room." };
  }
  if (!effectiveTransferDate || effectiveTransferDate < minDateStr) {
    return { valid: false, error: "Room transfers must be scheduled at least one day in advance." };
  }
  if (!reason || !reason.trim()) {
    return { valid: false, error: "Please enter a reason for the room transfer." };
  }
  if (hasOutstanding && !forceOverride) {
    return { valid: false, error: "Please acknowledge the tenant's outstanding balance before proceeding." };
  }
  return { valid: true };
}

// ── Unit Tests ──────────────────────────────────────────────────────────────

test("Wizard is a fixed 2-step Target Room → Review (no Meter Readings step)", () => {
  assert.match(transferModalSource, /const wizardSteps = \["Target Room", "Review"\]/);
  assert.match(transferModalSource, /const reviewStep = 2/);
  assert.match(transferModalSource, /steps=\{wizardSteps\}/);
  assert.match(transferModalSource, /STEP 1: Target Room & Date/);
  assert.match(transferModalSource, /STEP 2: Review & Scheduled Transfer Balance/);
  // "Meter Readings" never appears as a wizard step or a rendered step block.
  assert.doesNotMatch(transferModalSource, /"Meter Readings"/);
  assert.doesNotMatch(transferModalSource, /STEP 2 \(immediate only\): Meter Readings/);
  assert.doesNotMatch(transferModalSource, /isScheduledTransfer/);
});

test("Every transfer is scheduled: Confirm button always reads 'Confirm Schedule'", () => {
  assert.match(transferModalSource, /<span>Confirm Schedule<\/span>/);
  assert.doesNotMatch(transferModalSource, /Confirm Transfer/);
});

test("Review says meter readings are finalized on the effective date + the Utilities note", () => {
  assert.match(transferModalSource, /Meter readings will be finalized on the effective transfer date/);
  assert.match(transferModalSource, /To be finalized on the effective transfer date/);
  assert.match(
    transferModalSource,
    /not included in the Scheduled\s*\n?\s*Room Transfer Balance/s,
  );
});

test("Submit never sends scheduling-day meter readings", () => {
  assert.match(transferModalSource, /sourceRoomMeterReading: null/);
  assert.match(transferModalSource, /targetRoomMeterReading: null/);
  assert.doesNotMatch(transferModalSource, /Number\(sourceRoomMeterReading\)/);
});

test("Date picker minimum is tomorrow (minScheduleDateStr), never today", () => {
  assert.match(modalSource, /from "\.\.\/utils\/transferScheduleDate"/);
  assert.match(modalSource, /minScheduleDateStr/);
  assert.match(transferModalSource, /min=\{minScheduleDateStr\(\)\}/);
  assert.doesNotMatch(transferModalSource, /min=\{localTodayStr\(\)\}/);
});

test("Wizard has NO replacement-contract preparation or wet-signed upload gate", () => {
  assert.doesNotMatch(transferModalSource, /prepareTransferContract/);
  assert.doesNotMatch(transferModalSource, /uploadFinalNotarizedContract|uploadSignedContract/);
  assert.doesNotMatch(transferModalSource, /Sign & Upload Contract/);
  assert.doesNotMatch(transferModalSource, /Prepare Replacement Contract/);
});

test("Step 1 gate: room + (bed for shared) + future date + reason + acknowledged balance", () => {
  const MIN = "2026-08-30";
  // No room
  assert.equal(
    validateTransferStep1({ roomId: "", destinationNeedsBed: true, effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "x" }).valid,
    false,
  );
  // Shared destination without a bed
  assert.equal(
    validateTransferStep1({ roomId: "r1", bedId: "", destinationNeedsBed: true, effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "x" }).valid,
    false,
  );
  // Private destination without a bed → allowed
  assert.equal(
    validateTransferStep1({ roomId: "r2", bedId: "", destinationNeedsBed: false, effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "x" }).valid,
    true,
  );
  // Missing effective date → blocked
  assert.equal(
    validateTransferStep1({ roomId: "r2", destinationNeedsBed: false, effectiveTransferDate: "", minDateStr: MIN, reason: "x" }).valid,
    false,
  );
  // Today / past effective date → blocked
  assert.equal(
    validateTransferStep1({ roomId: "r2", destinationNeedsBed: false, effectiveTransferDate: "2026-08-29", minDateStr: MIN, reason: "x" }).valid,
    false,
  );
  // Missing reason → blocked
  assert.equal(
    validateTransferStep1({ roomId: "r2", destinationNeedsBed: false, effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "" }).valid,
    false,
  );
  // Outstanding balance not acknowledged → blocked
  assert.equal(
    validateTransferStep1({ roomId: "r2", destinationNeedsBed: false, effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "x", hasOutstanding: true, forceOverride: false }).valid,
    false,
  );
  // Acknowledged → allowed
  assert.equal(
    validateTransferStep1({ roomId: "r2", destinationNeedsBed: false, effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "x", hasOutstanding: true, forceOverride: true }).valid,
    true,
  );
});

test("Step 1 gate honours the canonical bed rule for EVERY non-private destination type", () => {
  const MIN = "2026-08-30";
  const base = { roomId: "r1", effectiveTransferDate: "2026-09-05", minDateStr: MIN, reason: "x" };
  const gate = (roomType, bedId) =>
    validateTransferStep1({
      ...base,
      bedId,
      destinationNeedsBed: destinationRoomNeedsBed(roomType),
    }).valid;

  // Private destination — schedulable with no bed.
  assert.equal(gate("private", ""), true);

  // Double / quadruple / any other non-private type — blocked until a bed is set.
  for (const t of ["double-sharing", "quadruple-sharing", "triple-sharing", "bunk", "some-new-shared-type"]) {
    assert.equal(gate(t, ""), false, `${t} with no bed must be blocked`);
    assert.equal(gate(t, "bed-123"), true, `${t} with a bed must be allowed`);
  }
});

test("Room-type transitions: shared↔private flips the bed requirement", () => {
  // Shared → private: requirement drops, a bed is no longer needed and the
  // payload sends no targetBedId (the modal passes `destinationNeedsBed ? bedId : undefined`).
  assert.equal(destinationRoomNeedsBed("double-sharing"), true);
  assert.equal(destinationRoomNeedsBed("private"), false);

  // Private → shared: requirement returns immediately; with the bed cleared on
  // room change, step1Valid is false until the admin picks one.
  const MIN = "2026-08-30";
  const afterSwitchToShared = validateTransferStep1({
    roomId: "r-shared",
    bedId: "", // cleared by onChange when the room changed
    destinationNeedsBed: destinationRoomNeedsBed("quadruple-sharing"),
    effectiveTransferDate: "2026-09-05",
    minDateStr: MIN,
    reason: "x",
  }).valid;
  assert.equal(afterSwitchToShared, false);
});

test("Settlement is server-canonical: transferPreview, no front-end proration", () => {
  assert.match(transferModalSource, /useRoomTransferPreview/);
  assert.match(transferModalSource, /transferPreview/);
  assert.match(transferModalSource, /preview\.totalImmediateDue/);
  assert.doesNotMatch(transferModalSource, /const proRataPreview =/);
  assert.doesNotMatch(transferModalSource, /const estimatedTotal =/);
  assert.match(transferModalSource, /billed at period close/i);
});

test("Estimate PDF is generated from the same canonical transferPreview", () => {
  assert.match(transferModalSource, /transferPreview: preview/);
  assert.doesNotMatch(transferModalSource, /estimatedTotal,/);
});

test("Review offers a Room Transfer Addendum preview using the prepare-addendum endpoint", () => {
  assert.match(transferModalSource, /reservationApi\.prepareRoomTransferAddendum/);
  assert.match(transferModalSource, /Room Transfer Addendum/);
  assert.match(transferModalSource, /Preview \/ Download Addendum/);
  assert.doesNotMatch(transferModalSource, /Replacement Contract/i);
  assert.match(transferModalSource, /not a replacement lease/i);
  assert.match(transferModalSource, /nothing is changed for the tenant until you press/i);
});

test("Review shows original lease dates as unchanged + canonical rent/deposit", () => {
  assert.match(transferModalSource, /Original lease dates/);
  assert.match(transferModalSource, /does not start a new lease or reset the term/i);
  assert.match(transferModalSource, /Old rent → New rent|Old room → New room/);
});

test("Strict terminology invariants are maintained throughout TransferTenantModal", () => {
  assert.match(transferModalSource, /Transfer Tenant/i);
  assert.doesNotMatch(transferModalSource, /\bResident\b/);
  assert.doesNotMatch(transferModalSource, /\bRental Fee\b/);
});

test("New Room onChange has NO leftover meter-baseline fetch (undefined `fetchTargetBaseline` was stranding the dropdown open on first click)", () => {
  // The future-only rewrite deleted the `fetchTargetBaseline` useCallback but
  // left its call in the SearchableRoomSelect onChange. It threw a
  // ReferenceError before `setIsOpen(false)` could run, so a room pick only
  // visibly settled after an outside click. The call must be gone.
  assert.doesNotMatch(modalSource, /fetchTargetBaseline/);
  // The onChange still commits the room and clears any stale bed.
  assert.match(
    transferModalSource,
    /onChange=\{\(newRoomId\) => \{\s*setRoomId\(newRoomId\);[\s\S]*?setBedId\(""\);\s*\}\}/,
  );
});

test("New Room field uses the shared SearchableRoomSelect (pointer-down commit, keyboard support)", () => {
  assert.match(modalSource, /import SearchableRoomSelect from "\.\/SearchableRoomSelect\.jsx"/);
  assert.match(transferModalSource, /<SearchableRoomSelect/);
  // The inline copy is gone from this file.
  assert.doesNotMatch(modalSource, /function SearchableRoomSelect\(/);
});
