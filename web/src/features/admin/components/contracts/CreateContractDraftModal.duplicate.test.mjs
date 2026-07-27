import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("./CreateContractDraftModal.jsx", import.meta.url),
  "utf8",
);

test("duplicate API conflicts show the existing Contract without create-anyway", () => {
  assert.match(source, /payload\?\.code === "DUPLICATE_CONTRACT"/);
  assert.match(source, /Contract Already Exists/);
  assert.match(source, /View Existing Contract/);
  assert.match(source, /disabled=\{!selected \|\| saving \|\| Boolean\(existingContract\)\}/);
  assert.doesNotMatch(source, /Create Anyway/);
});
