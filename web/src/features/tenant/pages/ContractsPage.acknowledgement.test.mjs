import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./ContractsPage.jsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/tenantContractApi.js", import.meta.url), "utf8");
const paper = readFileSync(
  new URL("../components/contracts/DigitalContractPaper.jsx", import.meta.url),
  "utf8",
);

test("acknowledge action calls the acknowledge endpoint, never a signature/legal-acceptance wording", () => {
  assert.match(api, /acknowledgeMyContract:[\s\S]*\/contracts\/my\/\$\{contractId\}\/acknowledge/);
  assert.match(page, /Acknowledge Draft|Acknowledge Contract/);
  // The confirmation modal must explicitly say this is NOT a signature.
  assert.match(page, /not<\/strong> a signature/i);
  assert.doesNotMatch(page, /electronic(ally)? (sign|accept)/i);
});

test("acknowledged state shows a timestamp, not a repeatable action", () => {
  assert.match(page, /You acknowledged this \{subject\}/);
});

test("a generated Draft gets its own 'Acknowledge Draft' affordance and distinct wording", () => {
  assert.match(page, /documentKind === "draft"/);
  assert.match(page, /Acknowledge Draft/);
  assert.match(page, /received and reviewed the generated draft/i);
});

test("acknowledgement is confirmed through a modal explaining it is not signing", () => {
  assert.match(page, /AcknowledgeConfirmModal/);
  assert.match(page, /setAckModalOpen\(true\)/);
  assert.match(page, /does <strong>not<\/strong> make\s*\n?\s*the lease binding/i);
});

test("acknowledgement status is embedded in the current-contract payload with a standalone fallback", () => {
  // Prefer the embedded state, fall back to the standalone endpoint.
  assert.match(page, /resolvedContract\?\.acknowledgement/);
  assert.match(page, /getMyContractAcknowledgement/);
  assert.match(api, /getMyContractAcknowledgement:[\s\S]*\/acknowledgement/);
});

test("after acknowledging, the page re-fetches authoritative state (reload-parity, not optimistic-only)", () => {
  assert.match(page, /performAcknowledge/);
  assert.match(
    page,
    /await tenantContractApi\.acknowledgeMyContract\(contractId\);[\s\S]*getMyContractAcknowledgement\(contractId\)/,
  );
});

test("acknowledge is guarded to real ObjectId contracts only (never the synthetic Stay-derived id)", () => {
  assert.match(page, /isRealContractId/);
  assert.match(page, /\/\^\[a-f\\d\]\{24\}\$\/i/);
});

test("Print never silently falls through to window.print() of the whole app on PDF failure", () => {
  // The catch branch surfaces a visible error instead of a bare window.print().
  assert.match(paper, /Couldn't open the print dialog|use Download instead/i);
  assert.doesNotMatch(
    paper,
    /catch \(err\) \{\s*console\.error\([^)]*\);\s*if \(isFinalDocument\) \{[\s\S]*?\} else \{\s*window\.print\(\);/,
  );
});

test("Print uses the canonical document blob via iframe, with a watchdog and retry, not a DOM rebuild", () => {
  assert.match(paper, /printBlobViaIframe/);
  assert.match(paper, /watchdog/);
  assert.match(paper, /tryPrint\(attempt \+ 1\)/);
  assert.match(paper, /fetchDocumentPdf\(contract\)/);
});

test("a synthetic contract disables the canonical-PDF Print path", () => {
  assert.match(paper, /isSyntheticContract/);
  assert.match(paper, /hasCanonicalPdf = Boolean\(fetchDocumentPdf\) && !isSyntheticContract/);
});
