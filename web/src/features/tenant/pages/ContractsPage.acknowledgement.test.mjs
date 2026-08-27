import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./ContractsPage.jsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/tenantContractApi.js", import.meta.url), "utf8");

test("acknowledge action calls the acknowledge endpoint, never a signature/legal-acceptance wording", () => {
  assert.match(api, /acknowledgeMyContract:[\s\S]*\/contracts\/my\/\$\{contractId\}\/acknowledge/);
  assert.match(page, /Acknowledge Contract/);
  assert.doesNotMatch(page, /sign(ature)?\b.*contract|electronic(ally)? (sign|accept)/i);
});

test("acknowledged state shows a timestamp, not a repeatable action", () => {
  assert.match(page, /You acknowledged this contract on/);
});

test("acknowledgement status is fetched alongside the current contract, per-document-version", () => {
  assert.match(page, /getMyContractAcknowledgement/);
  assert.match(api, /getMyContractAcknowledgement:[\s\S]*\/acknowledgement/);
});
