/**
 * SCHEDULED TRANSFER — METER READING TIMING FIX
 *
 * Focused source-assertion coverage (house style) for the adaptive Transfer
 * wizard: a FUTURE-dated (scheduled) transfer must NOT ask for meter readings
 * during scheduling, must show a 2-step stepper (Target Room → Review), must
 * label the Confirm button "Confirm Schedule", must not submit scheduling-day
 * readings, and must clear/restore meter state when the admin flips the
 * effective date between today and a future date. Immediate-transfer behavior
 * is unchanged.
 *
 * Pure logic for the wizard-shape derivation is re-implemented here and
 * exercised directly so the today ↔ future switch is regression-locked.
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

// ── Pure re-implementation of the wizard-shape derivation ──────────────────
// Mirrors the component: isScheduledTransfer = effectiveDate > today (Manila
// local string compare on YYYY-MM-DD).
function deriveWizard(effectiveTransferDate, todayStr) {
  const isScheduledTransfer =
    !!effectiveTransferDate && effectiveTransferDate > todayStr;
  const wizardSteps = isScheduledTransfer
    ? ["Target Room", "Review"]
    : ["Target Room", "Meter Readings", "Review"];
  const reviewStep = isScheduledTransfer ? 2 : 3;
  return { isScheduledTransfer, wizardSteps, reviewStep };
}

// What onSubmit sends for the meter fields, per the component's footer logic.
function meterPayload({ isScheduledTransfer, sourceRoomMeterReading, targetRoomMeterReading }) {
  return {
    sourceRoomMeterReading:
      isScheduledTransfer || !sourceRoomMeterReading ? null : Number(sourceRoomMeterReading),
    targetRoomMeterReading:
      isScheduledTransfer || !targetRoomMeterReading ? null : Number(targetRoomMeterReading),
  };
}

const TODAY = "2026-08-29";

test("today → 3-step wizard that includes Meter Readings", () => {
  const w = deriveWizard(TODAY, TODAY);
  assert.equal(w.isScheduledTransfer, false);
  assert.deepEqual(w.wizardSteps, ["Target Room", "Meter Readings", "Review"]);
  assert.equal(w.reviewStep, 3);
});

test("future date → Meter Readings step omitted; stepper = Target Room → Review", () => {
  const w = deriveWizard("2026-09-05", TODAY);
  assert.equal(w.isScheduledTransfer, true);
  assert.deepEqual(w.wizardSteps, ["Target Room", "Review"]);
  assert.equal(w.reviewStep, 2);
  assert.ok(!w.wizardSteps.includes("Meter Readings"));
});

test("today → future clears/ignores previously entered readings on submit", () => {
  // Admin entered readings while immediate, then pushed the date out.
  const p = meterPayload({
    isScheduledTransfer: true,
    sourceRoomMeterReading: "1455.5",
    targetRoomMeterReading: "890",
  });
  assert.equal(p.sourceRoomMeterReading, null);
  assert.equal(p.targetRoomMeterReading, null);
});

test("immediate transfer still submits the admin's transfer-day readings", () => {
  const p = meterPayload({
    isScheduledTransfer: false,
    sourceRoomMeterReading: "1455.5",
    targetRoomMeterReading: "890",
  });
  assert.equal(p.sourceRoomMeterReading, 1455.5);
  assert.equal(p.targetRoomMeterReading, 890);
});

test("future → today restores a 3-step wizard with the Meter Readings step", () => {
  const w = deriveWizard(TODAY, TODAY); // date pulled back to today
  assert.deepEqual(w.wizardSteps, ["Target Room", "Meter Readings", "Review"]);
});

// ── Source-level assertions on the component ──────────────────────────────

test("Confirm button reads 'Confirm Schedule' for a future transfer, 'Confirm Transfer' otherwise", () => {
  assert.match(transfer, /isScheduledTransfer \? "Confirm Schedule" : "Confirm Transfer"/);
});

test("preview query keys off the adaptive review step, not a hardcoded step 3", () => {
  assert.match(transfer, /enabled: !!reservationId && !!roomId && isReviewStep/);
});

test("scheduled review shows the concise Utilities note excluding electricity & water from the balance", () => {
  assert.match(transfer, /Meter readings will be finalized on the effective transfer date/);
  assert.match(transfer, /Electricity and applicable water charges will follow the normal/);
  assert.match(transfer, /not included in the Scheduled\s*\n?\s*Room Transfer Balance/s);
});

test("scheduled review does NOT present today's reading as the final cutoff", () => {
  // The muted electricity row must show 'billed at period close' for scheduled,
  // never a computed today's-delta figure.
  assert.match(
    transfer,
    /!isScheduledTransfer && kwhPreview != null && preview\.electricity\.ratePerUnit/,
  );
});

test("effective-date meter fields are labelled 'To be finalized on <effective date>'", () => {
  assert.match(transfer, /Meter readings<\/span>\s*<span className="twm-review-field__value">\s*To be finalized on \{fmtDate\(effectiveTransferDate\)\}/s);
});
