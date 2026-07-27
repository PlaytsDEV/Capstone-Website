import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  getTenantContractError,
  getTenantContractMessage,
} from "./tenantContractUi.mjs";

test("generated Contract with verified document is presented as an available prepared copy", () => {
  assert.deepEqual(getTenantContractMessage({
    status: "generated",
    preparedDocument: { available: true },
  }), {
    title: "Prepared Contract Available",
    message: "Your prepared copy is available before physical signing and notarization.",
    nextAction: "The administrator will coordinate physical signing and in-person notarization.",
  });
});

test("prepared missing-file response has a distinct tenant-safe message", () => {
  assert.equal(getTenantContractError({
    response: { data: { code: "PREPARED_DOCUMENT_UNAVAILABLE" } },
  }), "The prepared document is temporarily unavailable. Please contact the administrator.");
});

test("tenant web uses distinct prepared view and download actions", () => {
  const page = fs.readFileSync(
    new URL("../pages/ContractsPage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /View Prepared Copy/);
  assert.match(page, /Download Prepared Copy/);
  assert.match(page, /mode === "download"/);
});
