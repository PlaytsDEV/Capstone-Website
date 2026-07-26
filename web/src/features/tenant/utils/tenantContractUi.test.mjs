import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTenantContractStatus,
  getTenantContractError,
  getTenantContractMessage,
  formatContractType,
  formatRoomBed,
} from "./tenantContractUi.mjs";

test("formats tenant Contract statuses without raw enum values", () => {
  assert.equal(formatTenantContractStatus("ready_for_generation"), "Being Prepared");
  assert.equal(formatTenantContractStatus("signed"), "Signed — Awaiting Notarization");
});

test("does not infer an active Contract when no dedicated record exists", () => {
  const message = getTenantContractMessage(null);
  assert.equal(message.title, "Contract Record Not Yet Available");
  assert.doesNotMatch(message.title, /active/i);
});

test("prepared copies are explicitly unsigned and unnotarized", () => {
  const message = getTenantContractMessage({ status: "generated" });
  assert.equal(message.title, "Prepared");
  assert.match(message.message, /physical signing and notarization are pending/i);
});

test("notarized status remains publication-pending and exposes no file details", () => {
  const message = getTenantContractMessage({ status: "notarized" });
  assert.equal(message.title, "Notarization Completed");
  assert.match(message.message, /being reviewed for final publication/i);
  assert.doesNotMatch(JSON.stringify(message), /notary|file|download|verification checklist/i);
});

test("published status announces secure final document availability", () => {
  const message = getTenantContractMessage({ status: "published" });
  assert.equal(message.title, "Final Contract Available");
  assert.match(message.message, /wet-signed and notarized Contract/i);
});

test("formats Contract type and assignment naturally", () => {
  assert.equal(
    formatContractType("quadruple-sharing-short-term", "quadruple_sharing", "short_term"),
    "Quadruple Sharing — Short-Term Lease",
  );
  assert.deepEqual(formatRoomBed("TEST-305", "upper"), {
    room: "TEST-305", bed: "Upper Bed", combined: "TEST-305 · Upper Bed",
  });
});

test("maps missing prepared files to a safe tenant message", () => {
  assert.match(getTenantContractError({
    response: { data: { code: "PREPARED_CONTRACT_NOT_FOUND" } },
  }), /contact the dormitory administrator/i);
});
