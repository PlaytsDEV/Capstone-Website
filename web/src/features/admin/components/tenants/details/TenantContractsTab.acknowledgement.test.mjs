import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tab = readFileSync(new URL("./TenantContractsTab.jsx", import.meta.url), "utf8");
const api = readFileSync(
  new URL("../../../../../shared/api/contractApi.js", import.meta.url),
  "utf8",
);

test("admin reads the ONE canonical acknowledgement state (read-only endpoint), no local-only state", () => {
  assert.match(api, /getContractAcknowledgement:[\s\S]*\/contracts\/\$\{contractId\}\/acknowledgement/);
  assert.match(tab, /contractApi\s*\.\s*getContractAcknowledgement\(displayContractId\)/);
  // Read-only: admin never POSTs an acknowledgement on the tenant's behalf.
  assert.doesNotMatch(tab, /acknowledgeMyContract|\/acknowledge['"`]/);
});

test("admin prefers the acknowledgement embedded in the current-contract payload", () => {
  assert.match(tab, /displayContract\?\.acknowledgement/);
});

test("admin shows Pending acknowledgement vs Acknowledged + timestamp, for drafts and finals", () => {
  assert.match(tab, /Pending acknowledgement/);
  assert.match(tab, /Acknowledged/);
  assert.match(tab, /acknowledgement\.acknowledgedAt/);
  assert.match(tab, /documentKind === "draft"[\s\S]*Draft/);
  assert.match(tab, /acknowledgement\.documentVersion \? ` . v\$\{acknowledgement\.documentVersion\}`/);
});

test("an open admin page re-fetches acknowledgement on the app-wide contract-updated event", () => {
  assert.match(tab, /addEventListener\("lilycrest:contract-updated", refetch\)/);
  assert.match(tab, /removeEventListener\("lilycrest:contract-updated", refetch\)/);
});

test("admin acknowledgement fetch is guarded to real ObjectId contract ids", () => {
  assert.match(tab, /isRealContractId/);
  assert.match(tab, /\/\^\[a-f\\d\]\{24\}\$\/i/);
});
