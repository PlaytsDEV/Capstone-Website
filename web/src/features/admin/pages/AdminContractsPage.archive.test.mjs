import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const page = fs.readFileSync(path.resolve("src/features/admin/pages/AdminContractsPage.jsx"), "utf8");
const drawer = fs.readFileSync(path.resolve("src/features/admin/components/contracts/ContractDetailDrawer.jsx"), "utf8");
const api = fs.readFileSync(path.resolve("src/shared/api/contractApi.js"), "utf8");

test("Contract list defaults to Active Contracts and offers archived audit view", () => {
  assert.match(page, /archive: "active"/);
  assert.match(page, />Active Contracts</);
  assert.match(page, />Archived Contracts</);
  assert.match(page, />All Contracts</);
  assert.match(page, /Archive Reason/);
  assert.match(page, /Canonical Contract/);
});

test("drawer makes archive standard and permanent deletion owner-and-eligibility gated", () => {
  assert.match(drawer, /Archive Contract/);
  assert.match(drawer, /isOwner && contract\.isTestRecord === true/);
  assert.match(drawer, /deletionEligibility\?\.eligible === true/);
  assert.match(drawer, /Delete Test Contract Permanently/);
  assert.match(drawer, /values\.confirmationContractNumber !== contract\.contractNumber/);
});

test("frontend uses dedicated archive, eligibility, restore, and permanent endpoints", () => {
  assert.match(api, /\/archive/);
  assert.match(api, /\/restore/);
  assert.match(api, /\/deletion-eligibility/);
  assert.match(api, /method: "DELETE"/);
});
