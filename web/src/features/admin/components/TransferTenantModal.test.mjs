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
// The SCHEDULE wizard: Target Room, Date & Time → Review. Step 1 requires a
// destination room (+ bed for a shared destination), an effective date of
// today or later, a transfer time that passes the same-day office-hours
// advisory, a selectable destination candidate, and a reason. There is NO
// outstanding-balance acknowledgement / force-proceed — the current balance is
// tracked separately and the transfer's own settlement is paid at the Complete
// Transfer step. Every figure comes from the server `transferPreview`.

export function validateTransferStep1({
  roomId,
  bedId,
  destinationNeedsBed,
  effectiveTransferDate,
  minDateStr,
  effectiveTransferTime,
  officeHoursOk = true,
  candidateSelectable = true,
  reason,
}) {
  if (!roomId) return { valid: false, error: "Please select a target room for the transfer." };
  if (destinationNeedsBed && !bedId) {
    return { valid: false, error: "Please select an available bed in the target room." };
  }
  if (!effectiveTransferDate || effectiveTransferDate < minDateStr) {
    return { valid: false, error: "Pick an effective date of today or later." };
  }
  if (!effectiveTransferTime) {
    return { valid: false, error: "Please pick a transfer time." };
  }
  if (!officeHoursOk) {
    return { valid: false, error: "Same-day transfers must be within office hours." };
  }
  if (!candidateSelectable) {
    return { valid: false, error: "That room is not available for this date." };
  }
  if (!reason || !reason.trim()) {
    return { valid: false, error: "Please enter a reason for the room transfer." };
  }
  return { valid: true };
}

// ── Unit Tests ──────────────────────────────────────────────────────────────

test("Wizard is a fixed 2-step Target Room → Review (no Meter Readings step in the SCHEDULE modal)", () => {
  assert.match(transferModalSource, /const wizardSteps = \["Target Room", "Review"\]/);
  assert.match(transferModalSource, /const reviewStep = 2/);
  assert.match(transferModalSource, /steps=\{wizardSteps\}/);
  assert.match(transferModalSource, /STEP 1: Target Room & Date/);
  assert.match(transferModalSource, /STEP 2: Review & Scheduled Transfer Balance/);
  // "Meter Readings" never appears as a wizard step in the SCHEDULE modal — the
  // admin enters boundary readings in the separate Complete Transfer step.
  assert.doesNotMatch(transferModalSource, /"Meter Readings"/);
  assert.doesNotMatch(transferModalSource, /STEP 2 \(immediate only\): Meter Readings/);
});

test("Every transfer is scheduled: Confirm button always reads 'Confirm Schedule'", () => {
  assert.match(transferModalSource, /<span>Confirm Schedule<\/span>/);
  assert.doesNotMatch(transferModalSource, /Confirm Transfer/);
});

test("Review says meter readings are entered at the Complete Transfer step + the Utilities note", () => {
  assert.match(transferModalSource, /Meter readings are entered at the Complete Transfer step/);
  assert.match(transferModalSource, /Entered by the admin at the Complete Transfer step/);
  assert.match(
    transferModalSource,
    /Neither is part of this\s*\n?\s*scheduled balance/s,
  );
});

test("Submit never sends scheduling-day meter readings", () => {
  assert.match(transferModalSource, /sourceRoomMeterReading: null/);
  assert.match(transferModalSource, /targetRoomMeterReading: null/);
  assert.doesNotMatch(transferModalSource, /Number\(sourceRoomMeterReading\)/);
});

test("Date picker minimum is TODAY (minScheduleDateStr) — same-day allowed; a transfer TIME is collected", () => {
  assert.match(modalSource, /from "\.\.\/utils\/transferScheduleDate"/);
  assert.match(modalSource, /minScheduleDateStr/);
  assert.match(transferModalSource, /min=\{minScheduleDateStr\(\)\}/);
  // A time input backs `effectiveTransferTime`.
  assert.match(transferModalSource, /type="time"/);
  assert.match(transferModalSource, /effectiveTransferTime/);
  // Office-hours advisory is wired for EVERY planned date (not just same-day).
  assert.match(transferModalSource, /checkScheduleWithinOfficeHours/);
  assert.doesNotMatch(transferModalSource, /checkSameDayOfficeHours/);
  assert.match(modalSource, /useBusinessSettings/);
});

test("Wizard has NO replacement-contract preparation or wet-signed upload gate", () => {
  assert.doesNotMatch(transferModalSource, /prepareTransferContract/);
  assert.doesNotMatch(transferModalSource, /uploadFinalNotarizedContract|uploadSignedContract/);
  assert.doesNotMatch(transferModalSource, /Sign & Upload Contract/);
  assert.doesNotMatch(transferModalSource, /Prepare Replacement Contract/);
});

test("Step 1 gate: room + (bed for shared) + date≥today + time + office-hours + selectable candidate + reason", () => {
  const MIN = "2026-08-29";
  const OK = {
    roomId: "r2",
    destinationNeedsBed: false,
    effectiveTransferDate: "2026-09-05",
    minDateStr: MIN,
    effectiveTransferTime: "10:00",
    reason: "x",
  };
  // Happy path
  assert.equal(validateTransferStep1(OK).valid, true);
  // No room
  assert.equal(validateTransferStep1({ ...OK, roomId: "" }).valid, false);
  // Shared destination without a bed
  assert.equal(
    validateTransferStep1({ ...OK, roomId: "r1", destinationNeedsBed: true, bedId: "" }).valid,
    false,
  );
  // Shared destination WITH a bed → allowed
  assert.equal(
    validateTransferStep1({ ...OK, roomId: "r1", destinationNeedsBed: true, bedId: "b1" }).valid,
    true,
  );
  // Missing effective date → blocked
  assert.equal(validateTransferStep1({ ...OK, effectiveTransferDate: "" }).valid, false);
  // Past effective date → blocked; SAME-DAY (today) is allowed by the gate
  assert.equal(validateTransferStep1({ ...OK, effectiveTransferDate: "2026-08-28" }).valid, false);
  assert.equal(validateTransferStep1({ ...OK, effectiveTransferDate: "2026-08-29" }).valid, true);
  // Missing time → blocked
  assert.equal(validateTransferStep1({ ...OK, effectiveTransferTime: "" }).valid, false);
  // Same-day outside office hours → blocked
  assert.equal(validateTransferStep1({ ...OK, officeHoursOk: false }).valid, false);
  // Unavailable destination candidate → blocked
  assert.equal(validateTransferStep1({ ...OK, candidateSelectable: false }).valid, false);
  // Missing reason → blocked
  assert.equal(validateTransferStep1({ ...OK, reason: "" }).valid, false);
});

test("No outstanding-balance force-proceed remains in the SCHEDULE modal", () => {
  assert.doesNotMatch(transferModalSource, /forceOverride/);
  assert.doesNotMatch(transferModalSource, /I acknowledge the outstanding balance/);
  assert.doesNotMatch(transferModalSource, /force-proceeding/);
});

test("Step 1 gate honours the canonical bed rule for EVERY non-private destination type", () => {
  const MIN = "2026-08-29";
  const base = {
    roomId: "r1",
    effectiveTransferDate: "2026-09-05",
    minDateStr: MIN,
    effectiveTransferTime: "10:00",
    reason: "x",
  };
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
  const MIN = "2026-08-29";
  const afterSwitchToShared = validateTransferStep1({
    roomId: "r-shared",
    bedId: "", // cleared by onChange when the room changed
    destinationNeedsBed: destinationRoomNeedsBed("quadruple-sharing"),
    effectiveTransferDate: "2026-09-05",
    minDateStr: MIN,
    effectiveTransferTime: "10:00",
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
