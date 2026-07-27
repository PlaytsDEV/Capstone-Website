import test from "node:test";
import assert from "node:assert/strict";
import {
  contractMatchesFilters,
  formatContractStatus,
  getContractErrorMessage,
  getContractNextAction,
  getContractStage,
} from "./contractUi.mjs";

const contract = {
  contractNumber: "LC-GP-2026-0001",
  tenantLegalName: "Maria Santos",
  branch: "gil_puyat",
  status: "ready_for_generation",
  roomType: "private",
  leaseType: "long_term",
};

test("formats contract lifecycle statuses and next actions", () => {
  assert.equal(formatContractStatus("ready_for_generation"), "Ready for Generation");
  assert.equal(getContractNextAction("generated"), "Print, sign, notarize, and upload");
});

test("maps grouped stages to concise next actions", () => {
  assert.equal(getContractNextAction("draft"), "Complete Missing Information");
  assert.equal(getContractNextAction("ready_for_generation"), "Review and Generate Contract");
  assert.equal(getContractNextAction("partially_signed"), "Complete wet signing and notarization");
  assert.equal(getContractNextAction("signed"), "Upload notarized copy");
  assert.equal(getContractNextAction("notarized"), "Review and publish final Contract");
  assert.equal(getContractNextAction("active"), "No immediate action");
  assert.equal(getContractNextAction("terminated"), "Review Contract History");
});

test("maps detailed statuses into administrator-facing stages", () => {
  assert.equal(getContractStage("incomplete"), "Needs Attention");
  assert.equal(getContractStage("ready_for_generation"), "Ready to Generate");
  assert.equal(getContractStage("generated"), "Prepared");
  assert.equal(getContractStage("awaiting_signatures"), "Pending Completion");
  assert.equal(getContractStage("awaiting_notarization"), "Pending Notarization");
  assert.equal(getContractStage("notarized"), "Ready to Publish");
  assert.equal(getContractStage("ready_for_publication"), "Ready to Publish");
  assert.equal(getContractStage("published"), "Published");
  assert.equal(getContractStage("active"), "Active");
  assert.equal(getContractStage("expiring_soon"), "Expiring Soon");
  assert.equal(getContractStage("expired"), "Expired / Closed");
});

test("matches contract search and exact filters", () => {
  assert.equal(contractMatchesFilters(contract, { search: "maria" }), true);
  assert.equal(contractMatchesFilters(contract, { search: "LC-GP" }), true);
  assert.equal(contractMatchesFilters(contract, { branch: "guadalupe" }), false);
  assert.equal(contractMatchesFilters(contract, { roomType: "private", leaseType: "long_term" }), true);
});

test("maps backend contract errors to actionable messages", () => {
  const message = getContractErrorMessage({
    response: { data: { code: "DUPLICATE_CURRENT_CONTRACT" } },
  });
  assert.match(message, /already exists/i);
});

test("hides Contract PDF browser paths behind a safe administrator message", () => {
  assert.equal(
    getContractErrorMessage({
      response: { data: { code: "CONTRACT_PDF_BROWSER_UNAVAILABLE" } },
    }),
    "Contract PDF generation is temporarily unavailable because the document renderer is not configured on the server.",
  );
});
