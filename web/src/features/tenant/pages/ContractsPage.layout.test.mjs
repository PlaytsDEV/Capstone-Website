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
  assert.match(topBar, /user\?\.role === "tenant" \? "Resident" : "Applicant"/);
});

test("renders the three-part tenant Contract hierarchy without repetition", () => {
  assert.match(page, />Contract Summary</);
  assert.match(page, />Contract Document</);
  assert.match(page, /contract-status-title/);
  assert.ok((page.match(/contract\.contractNumber/g) || []).length >= 1);
  assert.equal((page.match(/tenant-contract-notice/g) || []).length, 1);
});

test("keeps document actions and loading feedback visible", () => {
  assert.match(page, /View Prepared Copy/);
  assert.match(page, /Download Prepared Copy/);
  assert.match(page, /Opening Contract/);
  assert.match(page, /Preparing Download/);
  assert.match(page, /final wet-signed and notarized Contract is still being processed/);
  assert.match(page, /Final Signed and Notarized Contract/);
  assert.match(page, /View Final Contract/);
  assert.match(page, /Download Final Contract/);
  assert.match(page, /Prepared Copy — Not Yet Signed or Notarized/);
});

test("uses a centered responsive layout without a heavy active border", () => {
  assert.match(css, /max-width:100%/);
  assert.match(css, /margin:0/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.doesNotMatch(css, /border:\s*2px\s+solid\s+(#000|black)/i);
});
