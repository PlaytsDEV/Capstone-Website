import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./BillingTab.jsx", import.meta.url), "utf8");

test("transfer_settlement is labeled Room Transfer Settlement while recurring rent keeps its rent presentation", () => {
  assert.match(source, /bill\.billType === "transfer_settlement"/);
  assert.match(source, /title: "Room Transfer Settlement"/);
  assert.match(source, /title: `\$\{monthText\} Rent Statement`/);
});

test("Room Transfer breakdown identifies rent, deposit top-up, and finalized electricity", () => {
  assert.match(source, /Rent Adjustment/);
  assert.match(source, /Security Deposit Top-up/);
  assert.match(source, /Finalized Electricity/);
});
