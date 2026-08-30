/**
 * ADMIN ROOM TRANSFER — SCHEDULE WIZARD
 *
 * Focused source-assertion coverage (house style): scheduling only places a
 * destination hold, so the wizard is permanently 2 steps (Target Room →
 * Review), never asks for meter readings (the admin enters boundary readings
 * in the separate Complete Transfer step), always labels the Confirm button
 * "Confirm Schedule", never submits scheduling-day readings. Same-day
 * transfers are allowed within office hours, so the date picker's `min` is
 * TODAY (minScheduleDateStr) and a transfer TIME is also collected.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const modalSource = fs.readFileSync(
  new URL("./TenantWorkspaceModals.jsx", import.meta.url),
  "utf8",
);
const transfer = modalSource.slice(
  modalSource.indexOf("export function TransferTenantModal"),
  modalSource.indexOf("export function MoveOutModal"),
);

test("wizard is a fixed 2-step Target Room → Review (no Meter Readings step)", () => {
  assert.match(transfer, /const wizardSteps = \["Target Room", "Review"\]/);
  assert.match(transfer, /const reviewStep = 2/);
  assert.doesNotMatch(transfer, /"Meter Readings"/);
});

test("no immediate-transfer / meter-reading state remains", () => {
  // No meter-reading state, validation, or immediate/scheduled branching.
  assert.doesNotMatch(transfer, /useState\(""\);\s*\/\/ sourceRoomMeterReading/);
  assert.doesNotMatch(transfer, /setSourceRoomMeterReading/);
  assert.doesNotMatch(transfer, /setTargetRoomMeterReading/);
  assert.doesNotMatch(transfer, /Number\(sourceRoomMeterReading\)/);
  assert.doesNotMatch(transfer, /Number\(targetRoomMeterReading\)/);
  assert.doesNotMatch(transfer, /meterStepValid/);
  assert.doesNotMatch(transfer, /attemptedStep2/);
  assert.doesNotMatch(transfer, /handleNextStep2/);
  // The meter keys appear only in the comment + the constant null payload.
  const meterKeyHits = transfer.match(/sourceRoomMeterReading/g) || [];
  assert.ok(meterKeyHits.length <= 2, `expected ≤2 sourceRoomMeterReading hits, got ${meterKeyHits.length}`);
  assert.match(transfer, /sourceRoomMeterReading: null/);
});

test("Confirm button always reads 'Confirm Schedule'", () => {
  assert.match(transfer, /<span>Confirm Schedule<\/span>/);
  assert.doesNotMatch(transfer, /Confirm Transfer/);
});

test("submit always sends null meter readings", () => {
  assert.match(transfer, /sourceRoomMeterReading: null/);
  assert.match(transfer, /targetRoomMeterReading: null/);
});

test("date picker minimum is TODAY via minScheduleDateStr(); a transfer TIME is also collected", () => {
  assert.match(modalSource, /from "\.\.\/utils\/transferScheduleDate"/);
  assert.match(modalSource, /minScheduleDateStr/);
  assert.match(transfer, /min=\{minScheduleDateStr\(\)\}/);
  assert.match(transfer, /type="time"/);
  assert.match(transfer, /effectiveTransferTime/);
});

test("review shows meter readings are entered at the Complete Transfer step + the Utilities note", () => {
  assert.match(transfer, /Entered by the admin at the Complete Transfer step/);
  assert.match(transfer, /Meter readings are entered at the Complete Transfer step/);
  assert.match(transfer, /Neither is part of this\s*\n?\s*scheduled balance/s);
});

test("effective date is required (today or later) with a same-day office-hours advisory", () => {
  assert.match(transfer, /Same-day transfers are allowed\s*\n?\s*within office hours/s);
  assert.match(transfer, /effectiveTransferDate < minScheduleDateStr\(\)/);
  assert.match(transfer, /checkSameDayOfficeHours/);
});

test("preview query enables on a reservation + effective date and includes room candidates", () => {
  assert.match(transfer, /includeCandidates: true/);
  assert.match(transfer, /enabled: !!reservationId && !!effectiveTransferDate/);
});
