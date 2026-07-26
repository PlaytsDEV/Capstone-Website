import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const list = readFileSync(new URL("./AdminContractsPage.jsx", import.meta.url), "utf8");
const detail = readFileSync(
  new URL("../components/contracts/ContractDetailDrawer.jsx", import.meta.url),
  "utf8",
);

test("main Contract list renders one simplified lifecycle stage", () => {
  assert.match(list, /label=\{getContractStage\(row\.status\)\}/);
  assert.doesNotMatch(list, /formatContractStatus\(row\.status\)/);
  assert.doesNotMatch(list, /contract-table-sub.*formatContractStatus/);
});

test("Contract detail retains the exact backend status presentation", () => {
  assert.match(detail, /<dt>Status<\/dt><dd>\{formatContractStatus\(contract\.status\)\}<\/dd>/);
  assert.match(detail, /formatContractStatus\(entry\.status\)/);
});

test("main table keeps the requested operational columns", () => {
  for (const label of [
    "Contract No.", "Tenant", "Branch", "Room / Bed",
    "Current Stage", "Next Action", "Updated",
  ]) {
    assert.match(list, new RegExp(`label: "${label.replace("/", "\\/")}"`));
  }
});
