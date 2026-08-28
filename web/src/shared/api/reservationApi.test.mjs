import test from "node:test";
import assert from "node:assert/strict";
import { reservationApi } from "./reservationApi.js";

test("reservationApi exports prepareTransferContract and cancelTransfer functions", () => {
  assert.equal(typeof reservationApi.prepareTransferContract, "function");
  assert.equal(typeof reservationApi.cancelTransfer, "function");
});
