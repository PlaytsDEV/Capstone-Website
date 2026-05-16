import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(__dirname, "../../..");

const readTenantSource = (relativePath) =>
  readFileSync(resolve(tenantRoot, relativePath), "utf8");

const personalInfoSource = readTenantSource(
  "pages/reservation-steps/components/PersonalInfoSection.jsx",
);

const getUploadFieldBlock = (label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = personalInfoSource.match(
    new RegExp(`label="${escapedLabel}"[\\s\\S]*?/>`),
  );
  assert.ok(match, `${label} upload field should exist`);
  return match[0];
};

test("personal info section receives document precheck props", () => {
  assert.match(personalInfoSource, /\bdocumentPrechecks\b/);
  assert.match(personalInfoSource, /\brunningDocumentChecks\b/);
  assert.match(personalInfoSource, /\bonRunDocumentPrecheck\b/);
});

test("valid ID front upload triggers and displays document checking", () => {
  const block = getUploadFieldBlock("Valid ID (Front)");

  assert.match(block, /documentType="valid-id-front"/);
  assert.match(block, /documentType: "valid_id_front"/);
  assert.match(block, /idType: validIDType/);
  assert.match(block, /aiCheck=\{documentPrechecks\?\.validIDFront\}/);
  assert.match(
    block,
    /isChecking=\{Boolean\(runningDocumentChecks\?\.validIDFront\)\}/,
  );
  assert.match(
    block,
    /hasBlockingPrecheck\(documentPrechecks\?\.validIDFront\)/,
  );
});

test("valid ID back upload triggers and displays document checking", () => {
  const block = getUploadFieldBlock("Valid ID (Back)");

  assert.match(block, /documentType="valid-id-back"/);
  assert.match(block, /documentType: "valid_id_back"/);
  assert.match(block, /idType: validIDType/);
  assert.match(block, /aiCheck=\{documentPrechecks\?\.validIDBack\}/);
  assert.match(
    block,
    /isChecking=\{Boolean\(runningDocumentChecks\?\.validIDBack\)\}/,
  );
  assert.match(
    block,
    /hasBlockingPrecheck\(documentPrechecks\?\.validIDBack\)/,
  );
});

test("NBI Clearance upload triggers and displays document checking", () => {
  const block = getUploadFieldBlock(
    "NBI Clearance (If unable, upload another valid ID)",
  );

  assert.match(block, /documentType="nbi-clearance"/);
  assert.match(block, /documentType: "nbi_clearance"/);
  assert.match(block, /aiCheck=\{documentPrechecks\?\.nbiClearance\}/);
  assert.match(
    block,
    /isChecking=\{Boolean\(runningDocumentChecks\?\.nbiClearance\)\}/,
  );
  assert.match(
    block,
    /hasBlockingPrecheck\(documentPrechecks\?\.nbiClearance\)/,
  );
});

test("submit validation blocks checked, unchecked, and failed document states", () => {
  const flowSource = readTenantSource("hooks/useReservationFlow.js");

  assert.match(flowSource, /precheck\.precheckStatus === "checking"/);
  assert.match(flowSource, /precheck\.precheckStatus === "not_checked"/);
  assert.match(flowSource, /DOCUMENT_PRECHECK_MESSAGES\.checkingSubmit/);
  assert.match(flowSource, /DOCUMENT_PRECHECK_MESSAGES\.notChecked/);
  assert.match(flowSource, /isBlockingDocumentPrecheck\(doc\.precheck\)/);
});
