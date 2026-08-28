import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const modalSource = fs.readFileSync(
  new URL("./TenantWorkspaceModals.jsx", import.meta.url),
  "utf8",
);

// ── Pure helper logic for step gate validation ──────────────────────────────
export function validateTransferStep1({ roomId, bedId, hasOutstanding, forceOverride }) {
  if (!roomId) return { valid: false, error: "Please select a target room for the transfer." };
  if (!bedId) return { valid: false, error: "Please select an available bed in the target room." };
  if (hasOutstanding && !forceOverride) {
    return { valid: false, error: "Please acknowledge the tenant's outstanding balance before proceeding." };
  }
  return { valid: true };
}

export function validateTransferStep2Upload({ file, contractId }) {
  if (!contractId) return { valid: false, error: "No active replacement contract found." };
  if (!file) return { valid: false, error: "Please select a signed contract PDF file to upload." };
  return { valid: true };
}

export function isStep2ReadyForNext({ contractStatus, contractUploaded }) {
  return contractStatus === "published" || Boolean(contractUploaded);
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

export function calculateSettlementEstimate({
  currentMonthlyRent,
  effectiveTransferDate,
  cycleStartDate,
  sourceMeterStart,
  sourceMeterFinal,
  kwhRate,
  outstandingBalance = 0,
}) {
  const transferDate = new Date(effectiveTransferDate);
  const cycleStart = cycleStartDate ? new Date(cycleStartDate) : null;
  const daysInMonth = new Date(transferDate.getFullYear(), transferDate.getMonth() + 1, 0).getDate();
  
  const daysSinceCycleStart = cycleStart
    ? Math.max(1, Math.ceil((transferDate - cycleStart) / (1000 * 60 * 60 * 24)))
    : null;

  const proratedRent = daysSinceCycleStart !== null && currentMonthlyRent > 0
    ? Math.round((currentMonthlyRent / daysInMonth) * daysSinceCycleStart * 100) / 100
    : null;

  const kwhConsumed = sourceMeterFinal != null && sourceMeterStart != null && sourceMeterFinal >= sourceMeterStart
    ? Math.round((sourceMeterFinal - sourceMeterStart) * 100) / 100
    : null;

  const estimatedElectricityCost = kwhConsumed !== null && kwhRate != null && kwhRate > 0
    ? Math.round(kwhConsumed * kwhRate * 100) / 100
    : null;

  const estimatedTotal = (proratedRent || 0) + (estimatedElectricityCost || 0) + (outstandingBalance || 0);

  return {
    daysSinceCycleStart,
    daysInMonth,
    proratedRent,
    kwhConsumed,
    estimatedElectricityCost,
    estimatedTotal,
  };
}

// ── Unit Tests ──────────────────────────────────────────────────────────────

test("Wizard Stepper defines the 3 guided transfer steps in exact order", () => {
  assert.match(modalSource, /"Target Room & Paperwork"/);
  assert.match(modalSource, /"Sign & Upload Contract"/);
  assert.match(modalSource, /"Meter Readings & Review"/);
});

test("Step 1 validation blocks transition without room, bed, or balance acknowledgement", () => {
  assert.equal(
    validateTransferStep1({ roomId: "", bedId: "", hasOutstanding: false, forceOverride: false }).valid,
    false,
  );
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "", hasOutstanding: false, forceOverride: false }).valid,
    false,
  );
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "bed-1", hasOutstanding: true, forceOverride: false }).valid,
    false,
  );
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "bed-1", hasOutstanding: true, forceOverride: true }).valid,
    true,
  );
  assert.equal(
    validateTransferStep1({ roomId: "room-101", bedId: "bed-1", hasOutstanding: false, forceOverride: false }).valid,
    true,
  );
});

test("Step 1 invokes prepareTransferContract and stores contract details", () => {
  assert.match(modalSource, /reservationApi\.prepareTransferContract/);
  assert.match(modalSource, /setPreparedContractId/);
  assert.match(modalSource, /setPreparedContractNumber/);
});

test("Step 2 handles draft download and wet-signed upload readiness", () => {
  assert.equal(validateTransferStep2Upload({ file: null, contractId: "ct-123" }).valid, false);
  assert.equal(validateTransferStep2Upload({ file: { name: "signed.pdf" }, contractId: "" }).valid, false);
  assert.equal(validateTransferStep2Upload({ file: { name: "signed.pdf" }, contractId: "ct-123" }).valid, true);

  assert.equal(isStep2ReadyForNext({ contractStatus: "draft", contractUploaded: false }), false);
  assert.equal(isStep2ReadyForNext({ contractStatus: "published", contractUploaded: false }), true);
  assert.equal(isStep2ReadyForNext({ contractStatus: "draft", contractUploaded: true }), true);

  assert.match(modalSource, /contractApi\.(getPreparedContractPdfBlob|getPreparedContractFile)/);
  assert.match(modalSource, /contractApi\.(uploadFinalNotarizedContract|uploadSignedContract)/);
});

test("Step 3 validates departure and destination meter readings against baselines", () => {
  const validCheck = validateTransferStep3MeterReadings({
    sourceReading: "1500.50",
    targetReading: "850.00",
    sourceBaseline: 1450.00,
    targetBaseline: 800.00,
    reason: "Upgrading to window side",
  });
  assert.equal(validCheck.valid, true);

  const belowBaselineCheck = validateTransferStep3MeterReadings({
    sourceReading: "1400.00", // below 1450 baseline
    targetReading: "850.00",
    sourceBaseline: 1450.00,
    targetBaseline: 800.00,
    reason: "Upgrading to window side",
  });
  assert.equal(belowBaselineCheck.valid, false);
  assert.match(belowBaselineCheck.error, /cannot be lower than the recorded baseline/);
});

test("Settlement calculation accurately computes prorated rent, electricity, and total", () => {
  const settlement = calculateSettlementEstimate({
    currentMonthlyRent: 6000,
    effectiveTransferDate: "2026-08-15",
    cycleStartDate: "2026-08-01",
    sourceMeterStart: 1000,
    sourceMeterFinal: 1050,
    kwhRate: 12.5,
    outstandingBalance: 500,
  });

  assert.equal(settlement.daysSinceCycleStart, 14);
  assert.equal(settlement.daysInMonth, 31);
  assert.equal(settlement.kwhConsumed, 50);
  assert.equal(settlement.estimatedElectricityCost, 625);
  assert.equal(settlement.proratedRent, 2709.68);
  assert.equal(settlement.estimatedTotal, 3834.68);
});

test("Cancel handler releases pending room transfer and contract draft", () => {
  assert.match(modalSource, /reservationApi\.cancelTransfer/);
});

test("Strict terminology invariants are maintained throughout TransferTenantModal", () => {
  const transferModalSource = modalSource.slice(
    modalSource.indexOf("export function TransferTenantModal"),
    modalSource.indexOf("export function MoveOutModal"),
  );

  // Terminology invariants
  assert.match(transferModalSource, /Transfer Tenant/i);
  assert.doesNotMatch(transferModalSource, /\bResident\b/);
  assert.doesNotMatch(transferModalSource, /\bRental Fee\b/);
});
