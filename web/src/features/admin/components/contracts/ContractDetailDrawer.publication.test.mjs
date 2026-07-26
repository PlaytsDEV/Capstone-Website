import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const drawer = fs.readFileSync(new URL("./ContractDetailDrawer.jsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../../../../shared/api/contractApi.js", import.meta.url), "utf8");

test("notarized and ready states expose one clear publication action", () => {
  assert.match(drawer, /contract\.status === "notarized"[\s\S]*Review for Publication/);
  assert.match(drawer, /contract\.status === "ready_for_publication"[\s\S]*Publish Final Contract/);
  assert.match(drawer, /Mark Ready for Publication/);
});

test("publication review is server-backed and requires all checklist confirmations", () => {
  assert.match(drawer, /publicationChecks/);
  assert.match(drawer, /correct wet-signed and notarized Contract will be published/);
  assert.match(drawer, /contractApi\.publishFinalContract/);
  assert.match(api, /ready-for-publication/);
  assert.match(api, /\/publish/);
});

test("published panel exposes final metadata without an unpublish action", () => {
  assert.match(drawer, /Final Contract Published/);
  assert.match(drawer, /Published date/);
  assert.match(drawer, /Source notarized version/);
  assert.match(drawer, /View Final Contract/);
  assert.doesNotMatch(drawer, /Unpublish/);
});
