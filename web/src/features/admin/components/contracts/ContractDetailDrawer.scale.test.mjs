import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const drawer = fs.readFileSync(new URL("./ContractDetailDrawer.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../styles/admin-contracts.css", import.meta.url), "utf8");
const readiness = fs.readFileSync(new URL("../../utils/contractReadiness.mjs", import.meta.url), "utf8");

test("drawer uses compact business-facing header and labels", () => {
  assert.match(drawer, /className="contract-detail-drawer"/);
  assert.match(drawer, /getContractStage\(contract\.status\)/);
  assert.match(readiness, /action: "Review Pricing"/);
  assert.match(drawer, /Refresh Checks/);
  assert.match(drawer, /View full details/);
  assert.doesNotMatch(drawer, /Resolve Contract Issues/);
});

test("empty prepared document state is a compact row and history is collapsed", () => {
  assert.match(drawer, /contract-document-empty/);
  assert.match(drawer, /Prepared document<\/strong><span>Not yet generated/);
  assert.match(drawer, /<details><summary>Prepared document history/);
  assert.doesNotMatch(drawer, /<h3>Prepared Document Versions<\/h3>/);
});

test("drawer-scoped CSS enforces the requested compact scale", () => {
  assert.match(css, /\.contract-detail-drawer > div:first-child h2[\s\S]*font-size: 17px !important/);
  assert.match(css, /\.contract-detail-drawer \.contract-panel h3[\s\S]*font-size: 13\.5px/);
  assert.match(css, /min-height: 33px/);
  assert.match(css, /font-size: 12px/);
  assert.match(css, /\.contract-detail-drawer \.contract-blocker-list article[\s\S]*padding: 10px 12px/);
});
