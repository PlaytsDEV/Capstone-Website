import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./ContractsPage.jsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/tenantContractApi.js", import.meta.url), "utf8");

test("resident page only renders the server-resolved current Contract", () => {
  assert.match(page, /getMyCurrentContract\(\)/);
  assert.doesNotMatch(page, /localStorage.*contract|cachedContractId|contracts\[0\]/);
});

test("current Contract refetch bypasses stale browser caches", () => {
  assert.match(api, /getMyCurrentContract:[\s\S]*cache:\s*"no-store"/);
});

test("invalid internal Contract details are not rendered in the empty state", () => {
  assert.match(page, /!contract \? <div className="contracts-empty"/);
  assert.match(page, /\{notice\.title\}/);
  assert.match(page, /\{notice\.message\}/);
});
