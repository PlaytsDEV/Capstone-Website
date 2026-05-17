import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveArchivedRestoreStatus,
  resolveArchivePreviousStatus,
} from "./reservationArchive.js";

test("resolveArchivePreviousStatus reads the stored archived previous status", () => {
  assert.equal(
    resolveArchivePreviousStatus({
      archivedPreviousStatus: "cancelled",
      status: "archived",
    }),
    "cancelled",
  );
});
test("resolveArchivedRestoreStatus restores safe terminal statuses", () => {
  assert.equal(
    resolveArchivedRestoreStatus({
      archivedPreviousStatus: "rejected",
      status: "archived",
    }),
    "rejected",
  );

  assert.equal(
    resolveArchivedRestoreStatus({
      archivedPreviousStatus: "moveOut",
      status: "archived",
    }),
    "moveOut",
  );
});

test("resolveArchivedRestoreStatus falls back to cancelled for active previous statuses", () => {
  assert.equal(
    resolveArchivedRestoreStatus({
      archivedPreviousStatus: "reserved",
      status: "archived",
    }),
    "cancelled",
  );
});

test("resolveArchivedRestoreStatus uses current cancelled status when metadata is missing", () => {
  assert.equal(
    resolveArchivedRestoreStatus({
      status: "cancelled",
    }),
    "cancelled",
  );
});
