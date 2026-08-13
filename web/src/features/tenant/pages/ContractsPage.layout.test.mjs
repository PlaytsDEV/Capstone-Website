import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./ContractsPage.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/contracts.css", import.meta.url), "utf8");
const topBar = readFileSync(
  new URL("../../../shared/components/ApplicantTopBar.jsx", import.meta.url),
  "utf8",
);

test("uses the resident breadcrumb for tenant sessions", () => {
  assert.match(topBar, /user\?\.role === "tenant" \? "(Tenant|Resident)" : "Applicant"/);
});

const digitalPaper = readFileSync(new URL("../components/contracts/DigitalContractPaper.jsx", import.meta.url), "utf8");

test("renders tenant Contract hierarchy with DigitalContractPaper integration", () => {
  assert.match(page, /DigitalContractPaper/);
  assert.match(page, /Official Lease Contract/);
  assert.match(digitalPaper, /CONTRACT OF LEASE/);
  assert.match(digitalPaper, /POPULATED_COLOR/);
});

test("keeps document actions and signed contract handling available", () => {
  assert.match(page, /handleViewSignedCopy/);
  assert.match(page, /handleDownloadSignedCopy/);
  assert.match(digitalPaper, /onViewSigned/);
  assert.match(digitalPaper, /onDownloadSigned/);
});

test("uses a centered responsive layout without a heavy active border", () => {
  assert.match(css, /max-width:100%/);
  assert.match(css, /margin:0/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.doesNotMatch(css, /border:\s*2px\s+solid\s+(#000|black)/i);
});
