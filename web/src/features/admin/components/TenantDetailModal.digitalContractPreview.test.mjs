import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./TenantDetailModal.jsx", import.meta.url), "utf8");

// Regression guard for the defect where the Digital Contract preview
// rendered a hand-built stayData object (mismatched field names like
// `branchName`/`monthlyRent`/`securityDeposit` that DigitalContractPaper
// never reads) instead of the freshly-fetched canonical stay-proof data,
// and never cleared that state between different tenants.

test("clears previous preview state before starting a new fetch", () => {
  const openFn = source.slice(
    source.indexOf("const handleOpenDigitalContract"),
    source.indexOf("const handleWarningAction"),
  );
  assert.match(openFn, /setDigitalContractData\(null\)/);
  assert.match(openFn, /setDigitalContractError\(""\)/);
});

test("guards against a superseded (stale/out-of-order) request", () => {
  const openFn = source.slice(
    source.indexOf("const handleOpenDigitalContract"),
    source.indexOf("const handleWarningAction"),
  );
  assert.match(openFn, /digitalContractRequestRef\.current \+\+|\+\+digitalContractRequestRef\.current/);
  assert.match(openFn, /digitalContractRequestRef\.current !== requestId/);
});

test("surfaces a real error instead of silently swallowing a failed fetch", () => {
  const openFn = source.slice(
    source.indexOf("const handleOpenDigitalContract"),
    source.indexOf("const handleWarningAction"),
  );
  assert.doesNotMatch(openFn, /fallback to tenant local fields if error/);
  assert.match(openFn, /setDigitalContractError\(/);
});

test("resets Digital Contract preview state when the viewed tenant/reservation changes", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*digitalContractRequestRef\.current \+= 1;[\s\S]*?\}, \[reservationId\]\);/,
  );
});

test("renders DigitalContractPaper directly from the canonical fetch, not a hand-built fallback object", () => {
  const renderBlock = source.slice(
    source.indexOf("{showDigitalContractModal && ("),
    source.indexOf("{recordViolationOpen && ("),
  );
  assert.match(renderBlock, /stayData=\{digitalContractData\}/);
  // The mismatched ad-hoc fallback fields must not come back.
  assert.doesNotMatch(renderBlock, /branchName:/);
  assert.doesNotMatch(renderBlock, /monthlyRent:/);
  assert.doesNotMatch(renderBlock, /"LIL-CONTRACT"/);
});

test("shows a controlled error state with retry, not stale or invented data", () => {
  const renderBlock = source.slice(
    source.indexOf("{showDigitalContractModal && ("),
    source.indexOf("{recordViolationOpen && ("),
  );
  assert.match(renderBlock, /digitalContractError && !digitalContractData/);
  assert.match(renderBlock, /Try again/);
});

test("surfaces the real backend conflict reason on PDF download failure", () => {
  const downloadFn = source.slice(
    source.indexOf("const handleDownloadStayProof"),
    source.indexOf("const handleOpenDigitalContract"),
  );
  assert.match(downloadFn, /MULTIPLE_CANONICAL_CONTRACTS/);
  assert.doesNotMatch(downloadFn, /^\s*catch \{\s*$/m);
});
