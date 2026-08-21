import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DigitalContractPaper.jsx", import.meta.url), "utf8");

test("tenant address accepts the raw Contract schema field as a fallback", () => {
  // tenantContractViewService.js / digitalStayProofService.js expose the
  // computed alias `tenantResidentialAddress`, but a caller can also pass
  // the raw Contract record (schema field `tenantAddress`) before its own
  // canonical fetch resolves — both must resolve to the real address.
  assert.match(source, /stayData\?\.tenantResidentialAddress \|\| contract\?\.tenantResidentialAddress/);
  assert.match(source, /\|\| contract\?\.tenantAddress \|\| "—"/);
});

test("never falls back to a fabricated sample address", () => {
  assert.doesNotMatch(source, /SMDC JAZZ/);
  assert.doesNotMatch(source, /Bel-Air, City of Makati/);
});

test("property/branch address accepts the raw Contract field as a fallback", () => {
  assert.match(source, /stayData\?\.propertyAddress \|\| contract\?\.propertyAddress/);
});
