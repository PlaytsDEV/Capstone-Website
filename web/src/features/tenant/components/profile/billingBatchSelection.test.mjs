import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../..");
const read = (relative) => fs.readFileSync(path.join(srcDir, relative), "utf8");

test("tenant web batch selection toolbar uses borderless inline header instead of card container", () => {
  const tab = read("features/tenant/components/profile/BillingTab.jsx");
  const css = read("features/tenant/styles/tenant-billing.css");

  // Must not have card container styling (no white background card, no border-radius 10 with border card) in toolbar markup
  assert.doesNotMatch(
    tab,
    /className=["']ledger-selection-toolbar["'][^>]*style=\{\{[^}]*background:\s*["']#ffffff["'][^}]*border:\s*["']1px solid #e2e8f0["']/,
    "Selection toolbar should not use inline card styles with white card background and border"
  );

  // Must have dynamic selection counter and deselect all button
  assert.match(
    tab,
    /Deselect all|Deselect/i,
    "Selection toolbar must include a quick Deselect action when items are selected"
  );
  assert.match(
    tab,
    /selectedBillIds\.length\s*===\s*0|selectedBills\.length\s*===\s*0|\bselectedBillIds\.length\s*>\s*0|\bselectedBills\.length\s*>\s*0/,
    "Selection toolbar must dynamically branch on whether items are selected"
  );

  // Contextual Pay Selected: only show Pay Selected button when items are selected (> 0)
  assert.match(
    tab,
    /selectedBill(Id)?s\.length\s*>\s*0\s*&&[\s\S]*?(?:btn-review-pay|Pay Selected)/,
    "Pay Selected button should be contextually rendered only when at least 1 statement is selected"
  );

  // CSS assertions: ledger-selection-toolbar must not be a boxed card
  assert.match(
    css,
    /\.ledger-selection-toolbar\s*\{[\s\S]*?background:\s*(?:transparent|none)/,
    "CSS .ledger-selection-toolbar must have transparent background"
  );
  assert.match(
    css,
    /\.ledger-deselect-btn/,
    "CSS must define .ledger-deselect-btn for the deselect helper"
  );
});
