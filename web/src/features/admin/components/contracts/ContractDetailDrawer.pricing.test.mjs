import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ContractDetailDrawer.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./PricingApprovalModal.jsx", import.meta.url), "utf8");

test("pricing review prioritizes concise amounts and readable status", () => {
  assert.match(source, /Pricing Valid/);
  assert.match(source, /Pricing Needs Review/);
  assert.match(source, /Remaining Initial Amount Due/);
  assert.doesNotMatch(source, />Reservation Fee Paid</);
  assert.doesNotMatch(source, />Reservation Fee Credit Applied</);
  assert.doesNotMatch(source, /PRICING_VALID/);
});

test("pricing sources are collapsed by default and correction remains available", () => {
  assert.match(source, /<details className="contract-pricing-sources">/);
  assert.match(source, /<summary>View Pricing Sources<\/summary>/);
  assert.doesNotMatch(source, /<details[^>]*\sopen/);
  assert.match(modal, /Correct Pricing Source/);
  assert.match(source, /section=pricing/);
});
