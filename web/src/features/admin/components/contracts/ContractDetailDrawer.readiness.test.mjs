import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const drawer = fs.readFileSync(new URL("./ContractDetailDrawer.jsx", import.meta.url), "utf8");
const modal = fs.readFileSync(new URL("./PricingApprovalModal.jsx", import.meta.url), "utf8");

test("detail load automatically requests backend validation", () => {
  assert.match(drawer, /contractApi\.validateContract\(contractId\)/);
  assert.match(drawer, /window\.addEventListener\("focus", refreshAfterSourceEdit\)/);
});

test("redundant technical actions are removed", () => {
  assert.doesNotMatch(drawer, />Validate Contract</);
  assert.doesNotMatch(drawer, /Review Contract Data/);
  assert.doesNotMatch(drawer, /Approve Legal Pricing/);
  assert.doesNotMatch(drawer, /Correct Source Information/);
  assert.match(drawer, /Refresh Checks/);
});

test("Contract Summary and collapsed system checks are rendered", () => {
  for (const text of ["Contract Summary", "Tenant legal name", "Room and bed/slot",
    "Approved monthly rate", "Current stage", "View System Checks"]) {
    assert.match(drawer, new RegExp(text));
  }
});

test("pricing approval uses an accessible application modal, not native prompts", () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /Review Pricing/);
  assert.match(modal, /Approval note/);
  assert.match(modal, /Approve Pricing/);
  assert.doesNotMatch(modal, /window\.(prompt|confirm|alert)/);
  assert.doesNotMatch(drawer, /window\.(prompt|confirm|alert)/);
  assert.doesNotMatch(`${drawer}\n${modal}`, /(?:^|[^\w.])(prompt|confirm|alert)\s*\(/m);
  assert.match(modal, /Correct Pricing Source/);
  assert.doesNotMatch(modal, /type="number"/);
  assert.doesNotMatch(modal, /Approval decision|Select a decision/);
  for (const group of ["Monthly pricing", "Initial charges", "Reservation credit"]) {
    assert.match(modal, new RegExp(group));
  }
  assert.match(modal, /advance \+ deposit/);
  assert.match(modal, /total - credit/);
  assert.match(modal, /Not available/);
  assert.match(modal, /rows="3"/);
  assert.match(modal, /disabledReason/);
  assert.match(modal, /createPortal\(content, document\.body\)/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /drawer\.setAttribute\("inert", ""\)/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /restoreFocus\?\.focus\?\.\(\)/);
  assert.match(modal, /aria-describedby="pricing-modal-description"/);
});
