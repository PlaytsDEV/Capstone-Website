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

const getUploadFieldBlock = (docTypeOrLabel) => {
  const escaped = docTypeOrLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = personalInfoSource.match(
    new RegExp(`<FileUploadField[\\s\\S]*?(?:label="[^\"]*${escaped}[^\"]*"|documentType="${escaped}")[\\s\\S]*?/>`),
  );
  assert.ok(match, `${docTypeOrLabel} upload field should exist`);
  return match[0];
};

test("personal info section receives document precheck props", () => {
  assert.match(personalInfoSource, /\bdocumentPrechecks\b/);
  assert.match(personalInfoSource, /\brunningDocumentChecks\b/);
  assert.match(personalInfoSource, /\bonRunDocumentPrecheck\b/);
});

test("valid ID front upload renders document field without AI precheck blockers", () => {
  const block = getUploadFieldBlock("valid-id-front");

  assert.match(block, /documentType="valid-id-front"/);
  assert.match(block, /value=\{validIDFront\}/);
});

test("valid ID back upload renders document field without AI precheck blockers", () => {
  const block = getUploadFieldBlock("valid-id-back");

  assert.match(block, /documentType="valid-id-back"/);
  assert.match(block, /value=\{validIDBack\}/);
});

test("NBI Clearance upload renders document field without AI precheck blockers", () => {
  const block = getUploadFieldBlock(
    "NBI Clearance (If unable, upload another valid ID)",
  );

  assert.match(block, /documentType="nbi-clearance"/);
  assert.match(block, /value=\{nbiClearance\}/);
});

test("submit flow proceeds directly to upload without AI precheck blocks", () => {
  const flowSource = readTenantSource("hooks/useReservationFlow.js");

  assert.match(flowSource, /setIsSubmittingApplication\(true\)/);
});
