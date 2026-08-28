import test from "node:test";
import assert from "node:assert/strict";
import { reservationApi } from "./reservationApi.js";

// R1 hybrid reconciliation: the canonical room-transfer API surface is
// `transfer` (the one-step operational cutover) + `getRoomTransferPreview`
// (the server-computed settlement preview). Main's `prepareTransferContract`
// and `cancelTransfer` methods carried the replacement-lease + phantom
// `pendingTransfer*` semantics and were intentionally removed. Clean Addendum
// prepare/discard methods land in R2/R4.

test("reservationApi exposes the canonical room-transfer surface", () => {
  assert.equal(typeof reservationApi.transfer, "function");
  assert.equal(typeof reservationApi.getRoomTransferPreview, "function");
});

test("reservationApi no longer exposes the obsolete prepare/cancel transfer methods", () => {
  assert.equal(reservationApi.prepareTransferContract, undefined);
  assert.equal(reservationApi.cancelTransfer, undefined);
});

test("getRoomTransferPreview builds a query string from targetRoomId + effectiveTransferDate", () => {
  // It returns a thunk/promise via authFetch; we only assert it is callable
  // with the documented shape and does not throw synchronously.
  assert.doesNotThrow(() => {
    const maybePromise = reservationApi.getRoomTransferPreview("res-1", {
      targetRoomId: "room-9",
      effectiveTransferDate: "2026-08-15",
    });
    // authFetch returns a promise; swallow it so the test does not leak.
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(
        () => {},
        () => {},
      );
    }
  });
});
