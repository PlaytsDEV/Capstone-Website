/**
 * PHASE 9 — Admin/Tenant Room Transfer + Contract + Billing UI.
 * Source-level assertions (house style) that the confusing/stale displays
 * are gone and the simplified ones are present.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

const transferModal = read("./TenantWorkspaceModals.jsx");
const billingTab = read("./tenants/details/TenantBillingTab.jsx");
const contractsTab = read("./tenants/details/TenantContractsTab.jsx");
const contractsPage = read("../../tenant/pages/ContractsPage.jsx");
const historyTab = read("./tenants/details/TenantHistoryTab.jsx");
const reservationApi = read("../../../shared/api/reservationApi.js");
const useReservations = read("../../../shared/hooks/queries/useReservations.js");
const contractViewSvc = read("../../../../../server/services/tenantContractViewService.js");
const tenantWorkspace = read("../../../../../server/utils/tenantWorkspace.js");
const tenantProfileSvc = read("../../../../../server/services/tenantProfileService.js");

// ── Transfer financial preview: server-computed, canonical ────────────────
test("transfer modal uses the server-computed transferPreview (not a hand-rolled front-end estimate)", () => {
  assert.match(transferModal, /useRoomTransferPreview/);
  assert.match(transferModal, /previewResp\?\.data\?\.transferPreview/);
});

test("additive preview API exists and takes targetRoomId + effectiveTransferDate + includeCandidates", () => {
  assert.match(reservationApi, /getRoomTransferPreview:\s*\(\s*reservationId,\s*\{\s*targetRoomId,\s*effectiveTransferDate,\s*includeCandidates\s*\}/s);
  assert.match(useReservations, /export function useRoomTransferPreview/);
});

test("Scheduled Room Transfer Balance is rent adjustment + additional deposit ONLY — electricity is NOT added", () => {
  // The label
  assert.match(transferModal, /Scheduled Room Transfer Balance/);
  assert.match(transferModal, /preview\.totalImmediateDue/);
  // Electricity row is explicitly muted / informational and says billed at period close
  assert.match(transferModal, /billed at period close|generated during the normal utility period close|final charge is generated during/i);
  // The old bug: estimatedTotal summed electricity + outstanding into the total.
  // The new total-row must bind to preview.totalImmediateDue, never estimatedTotal.
  assert.doesNotMatch(
    transferModal,
    /twm-settlement-row--total[\s\S]{0,200}\{fmtMoney\(estimatedTotal\)\}/,
  );
});

test("rent adjustment and additional security deposit are SEPARATE labelled lines", () => {
  assert.match(transferModal, /Rent Adjustment/);
  assert.match(transferModal, /Additional Security Deposit Due|Security Deposit — Required/);
});

test("deposit preview shows Required / Held / Balance Due (never one ambiguous figure)", () => {
  assert.match(transferModal, /Security Deposit — Required \(new room\)/);
  assert.match(transferModal, /Security Deposit — Currently Held/);
  assert.match(transferModal, /preview\.deposit\.required/);
  assert.match(transferModal, /preview\.deposit\.held/);
  assert.match(transferModal, /preview\.deposit\.balanceDue/);
  assert.match(transferModal, /Unavailable \(legacy record\)/);
});

test("excess held deposit remains held and routes any adjustment to the Administration Office", () => {
  assert.match(transferModal, /Potential Excess Held Deposit/);
  assert.match(transferModal, /Remains held\. No automatic refund or rent conversion/i);
  assert.match(transferModal, /Administration Office on the 2nd Floor/i);
});

test("excess prepaid rent is manual-review guidance, never an automatic refund or rent credit", () => {
  assert.match(transferModal, /Potential Prepaid-Rent Adjustment/);
  assert.match(transferModal, /No automatic refund or rent credit/i);
  assert.match(transferModal, /Administration Office on the 2nd Floor/i);
});

test("new monthly rent is the server-authoritative rate and applies to future bills automatically", () => {
  assert.match(transferModal, /New Monthly Rent/);
  assert.match(transferModal, /preview\?\.rent\?\.destinationApprovedRate/);
  assert.match(transferModal, /applies to every future rent bill automatically|applies to every future bill automatically/i);
});

// ── Admin billing tab: deposit Required vs Held vs Balance Due ────────────
test("TenantBillingTab shows Required / Held / Balance Due, never 'required' as 'Held'", () => {
  assert.match(billingTab, /tenant\.securityDepositHeld/);
  assert.match(billingTab, /tenant\.securityDepositBalanceDue/);
  assert.match(billingTab, /tenant\.securityDepositExcessHeld/);
  assert.match(billingTab, />Required</);
  assert.match(billingTab, />Held</);
  assert.match(billingTab, /Balance Due/);
  assert.match(billingTab, /Unavailable/); // legacy: no false ₱0
});

// ── Admin contract tab: current vs historical rate, addendum awareness ───
test("TenantContractsTab distinguishes current monthly rent from a historical document rate", () => {
  assert.match(contractsTab, /Current Monthly Rent/);
  assert.match(contractsTab, /Rate on This Document \(historical\)/);
  assert.match(contractsTab, /isCurrent === false/);
});

test("TenantContractsTab explains a Room Transfer Addendum keeps the original lease dates", () => {
  assert.match(contractsTab, /Room Transfer Addendum under the continuing lease/);
  assert.match(contractsTab, /original lease's dates and are unchanged/i);
});

// ── History tab: Addendum label, legacy replacement marked legacy ────────
test("TenantHistoryTab labels an amendment as 'Room Transfer Addendum' and marks legacy replacement", () => {
  assert.match(historyTab, /Room Transfer Addendum/);
  assert.match(historyTab, /Transfer Replacement \(legacy\)/);
  assert.match(historyTab, /purpose === "amendment"/);
});

// ── Tenant contracts page: addendum badges + acknowledgement wording ─────
test("ContractsPage badges an amendment as 'Room Transfer Addendum' / 'Superseded Addendum'", () => {
  assert.match(contractsPage, /Room Transfer Addendum/);
  assert.match(contractsPage, /Superseded Addendum/);
  assert.match(contractsPage, /contractPurpose === "amendment"/);
});

test("ContractsPage acknowledgement wording is addendum-aware and says the original lease remains in effect", () => {
  assert.match(contractsPage, /isAddendum/);
  assert.match(contractsPage, /Your original lease remains in effect|original lease stays in effect|Your original lease remains/i);
  assert.match(contractsPage, /this is not a new lease|not a new lease/i);
  assert.match(contractsPage, /Acknowledge \$\{isAddendum \? "Addendum"/);
});

// ── Backend additive exposure (no formula change) ───────────────────────
test("tenantContractViewService exposes contractPurpose + amendmentEffectiveDate + isCurrent", () => {
  assert.match(contractViewSvc, /contractPurpose: contract\.contractPurpose \|\| "initial"/);
  assert.match(contractViewSvc, /amendmentEffectiveDate: contract\.amendmentEffectiveDate/);
  assert.match(contractViewSvc, /isCurrent: contract\.isCurrent !== false/);
});

test("tenantWorkspace exposes securityDepositHeld / balanceDue / excessHeld (null on legacy, never false ₱0)", () => {
  assert.match(tenantWorkspace, /securityDepositHeld:\s*\n?\s*reservation\.securityDepositHeld === null/);
  assert.match(tenantWorkspace, /securityDepositBalanceDue:/);
  assert.match(tenantWorkspace, /securityDepositExcessHeld:/);
});

test("tenantProfileService current monthly rent prefers reservation.recurringRentRate after a transfer", () => {
  assert.match(tenantProfileSvc, /transferOverrideRate = Number\(reservation\.recurringRentRate\)/);
  assert.match(tenantProfileSvc, /transferOverrideRate > 0 \? transferOverrideRate : null,\s*\n\s*reservation\.contract\?\.approvedMonthlyRate/);
});

// ── No duplicate electricity / water in the transfer settlement UI ──────
test("transfer modal never renders electricity/water as a charged settlement line (informational only)", () => {
  // The electricity row is class twm-settlement-row--muted and states the
  // charge follows the normal utility period close (scheduled transfer).
  assert.match(transferModal, /twm-settlement-row--muted[\s\S]{0,700}billed at period close/i);
  assert.match(transferModal, /follows the normal utility period close/i);
  assert.match(transferModal, /Water[\s\S]{0,300}settled at its normal period close/i);
});

// ── Security deposit preservation & legacy clarity invariants ──────────
test("TenantBillingTab requires payment evidence when a legacy security deposit is unknown", () => {
  assert.match(billingTab, /held amount is unknown and must be verified from payment\/deposit records before completing a room transfer/i);
  assert.doesNotMatch(billingTab, /carries over automatically upon room transfer|automatically recorded upon room transfer/i);
});

test("transfer modal explicitly states security deposit is preserved intact and deductions only occur at move-out", () => {
  assert.match(transferModal, /Security deposits are carried over intact and never deducted during a room transfer/i);
  assert.match(transferModal, /Deductions only apply during final move-out clearance/i);
});

