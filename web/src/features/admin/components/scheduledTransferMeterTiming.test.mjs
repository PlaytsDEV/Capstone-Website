/**
 * FUTURE-ONLY ADMIN ROOM TRANSFER WIZARD
 *
 * Focused source-assertion coverage (house style): every new Admin Room
 * Transfer is scheduled for a future date, so the wizard is permanently
 * 2 steps (Target Room → Review), never asks for meter readings, always
 * labels the Confirm button "Confirm Schedule", never submits scheduling-day
 * readings, and its date picker's `min` is tomorrow (minScheduleDateStr).
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
  assert.doesNotMatch(transfer, /isScheduledTransfer/);
  // The only allowed occurrence of the meter keys is the constant null payload.
  const meterKeyHits = transfer.match(/sourceRoomMeterReading/g) || [];
  assert.equal(meterKeyHits.length, 1); // `sourceRoomMeterReading: null`
});

test("Confirm button always reads 'Confirm Schedule'", () => {
  assert.match(transfer, /<span>Confirm Schedule<\/span>/);
  assert.doesNotMatch(transfer, /Confirm Transfer/);
});

test("submit always sends null meter readings", () => {
  assert.match(transfer, /sourceRoomMeterReading: null/);
  assert.match(transfer, /targetRoomMeterReading: null/);
});

test("date picker minimum is tomorrow via minScheduleDateStr()", () => {
  assert.match(modalSource, /from "\.\.\/utils\/transferScheduleDate"/);
  assert.match(modalSource, /minScheduleDateStr/);
  assert.match(transfer, /min=\{minScheduleDateStr\(\)\}/);
  assert.doesNotMatch(transfer, /min=\{localTodayStr\(\)\}/);
});

test("review shows meter readings are finalized on the effective date + the Utilities note", () => {
  assert.match(transfer, /To be finalized on the effective transfer date/);
  assert.match(transfer, /Electricity and applicable water charges will follow the normal/);
  assert.match(transfer, /not included in the Scheduled\s*\n?\s*Room Transfer Balance/s);
});

test("effective date is a required, future-validated field with a future-only hint", () => {
  assert.match(transfer, /Room transfers must be scheduled at\s*\n?\s*least one day in advance/s);
  assert.match(transfer, /effectiveTransferDate < minScheduleDateStr\(\)/);
});

test("preview query requires a destination room AND a future effective date", () => {
  assert.match(transfer, /enabled: !!reservationId && !!roomId && !!effectiveTransferDate && isReviewStep/);
});
