import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./TenantDetailModal.jsx", import.meta.url), "utf8");

// Regression guard for the defect where Tenant Details picked its "current"
// Contract via ad-hoc client-side guessing (fetchedDetail?.dedicatedContract,
// matchingContracts.find(isCurrent), matchingContracts[0]) instead of the
// backend's canonical resolver (resolveTenantCanonicalContract, surfaced via
// GET /contracts/tenant/:tenantId/current). The frontend must never guess.

test("no longer guesses the current Contract from a client-side fallback chain", () => {
  assert.doesNotMatch(source, /fetchedDetail\?\.dedicatedContract/);
  assert.doesNotMatch(source, /initialTenant\?\.dedicatedContract/);
  assert.doesNotMatch(source, /matchingContracts\.find\(\(item\) => item\.isCurrent/);
  assert.doesNotMatch(source, /matchingContracts\[0\]\s*\|\|\s*null/);
});

test("resolves the current Contract via the backend canonical endpoint", () => {
  assert.match(source, /contractApi\s*\n?\s*\.getTenantCurrentContract\(/);
});

test("surfaces a controlled error, not a guess, when the backend reports conflicting canonical Contracts", () => {
  assert.match(source, /dedicatedContractError/);
  assert.match(source, /"MULTIPLE_CANONICAL_CONTRACTS"/);
  // Summary card must substitute a controlled label instead of an arbitrary contract number.
  assert.match(source, /dedicatedContractError === "MULTIPLE_CANONICAL_CONTRACTS" \? "Conflicting records"/);
});

test("short-circuits opening the Digital Contract preview on ambiguity instead of guessing a contract id", () => {
  const openFn = source.slice(
    source.indexOf("const handleOpenDigitalContract"),
    source.indexOf("const handleWarningAction"),
  );
  assert.match(openFn, /dedicatedContractError === "MULTIPLE_CANONICAL_CONTRACTS"/);
});

test("short-circuits the PDF download on ambiguity instead of attempting a guessed request", () => {
  const downloadFn = source.slice(
    source.indexOf("const handleDownloadStayProof"),
    source.indexOf("const handleOpenDigitalContract"),
  );
  assert.match(downloadFn, /dedicatedContractError === "MULTIPLE_CANONICAL_CONTRACTS"/);
});
