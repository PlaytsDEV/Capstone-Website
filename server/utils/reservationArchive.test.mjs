import { describe, expect, test } from "@jest/globals";

import {
  resolveArchivedRestoreStatus,
  resolveArchivePreviousStatus,
} from "./reservationArchive.js";

test("resolveArchivePreviousStatus reads the stored archived previous status", () => {
  expect(
    resolveArchivePreviousStatus({
      archivedPreviousStatus: "cancelled",
      status: "archived",
    })
  ).toBe("cancelled");
});

test("resolveArchivedRestoreStatus restores safe terminal statuses", () => {
  expect(
    resolveArchivedRestoreStatus({
      archivedPreviousStatus: "rejected",
      status: "archived",
    })
  ).toBe("rejected");

  expect(
    resolveArchivedRestoreStatus({
      archivedPreviousStatus: "moveOut",
      status: "archived",
    })
  ).toBe("moveOut");
});

test("resolveArchivedRestoreStatus falls back to cancelled for active previous statuses", () => {
  expect(
    resolveArchivedRestoreStatus({
      archivedPreviousStatus: "reserved",
      status: "archived",
    })
  ).toBe("cancelled");
});

test("resolveArchivedRestoreStatus uses current cancelled status when metadata is missing", () => {
  expect(
    resolveArchivedRestoreStatus({
      status: "cancelled",
    })
  ).toBe("cancelled");
});
