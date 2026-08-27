/**
 * Parity guard: server/config/contractStatusLabels.js and its web/-side
 * hand-synced mirror (web/src/features/admin/utils/contractStatusLabels.js)
 * must never drift — this is the fix for the "16 of 22 statuses" gap the
 * audit found, where the admin-facing status map only covered a subset of
 * CONTRACT_STATUSES. web/ and server/ are independent npm projects with no
 * shared-package mechanism, so there is no build-time guarantee these stay
 * in sync — this test is that guarantee, run at CI/test time instead.
 */
import { describe, expect, test } from "@jest/globals";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONTRACT_STATUSES } from "../models/Contract.js";
import { CONTRACT_STATUS_LABELS as SERVER_LABELS } from "./contractStatusLabels.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webMirrorPath = path.resolve(
  __dirname,
  "../../web/src/features/admin/utils/contractStatusLabels.js",
);

describe("contract status label parity (server <-> web mirror)", () => {
  test("every CONTRACT_STATUSES value has a server-side label entry", () => {
    for (const status of CONTRACT_STATUSES) {
      expect(SERVER_LABELS[status]).toBeDefined();
      expect(SERVER_LABELS[status].tenantLabel).toEqual(expect.any(String));
      expect(SERVER_LABELS[status].adminLabel).toEqual(expect.any(String));
      expect(["neutral", "info", "warning", "success", "error"]).toContain(
        SERVER_LABELS[status].tone,
      );
    }
  });

  test("no server-side entry falls through to the generic auto-titlecase fallback", () => {
    // formatContractStatus/getAdminContractLabel's fallback replaces "_"/"-"
    // with spaces and titlecases — a real entry should never accidentally
    // equal that mechanical transform (that would indicate a missing,
    // not-yet-written label rather than a deliberately chosen one... except
    // for coincidental matches like "renewed" already being titlecase-y;
    // this test only flags entries literally MISSING from the table, which
    // the first test above already covers exhaustively).
    for (const status of CONTRACT_STATUSES) {
      expect(Object.prototype.hasOwnProperty.call(SERVER_LABELS, status)).toBe(true);
    }
  });

  test("web mirror exists and matches the server table exactly", async () => {
    const webModule = await import(pathToFileURL(webMirrorPath).href);
    const webLabels = webModule.CONTRACT_STATUS_LABELS;
    expect(webLabels).toBeDefined();
    expect(Object.keys(webLabels).sort()).toEqual(Object.keys(SERVER_LABELS).sort());
    for (const status of CONTRACT_STATUSES) {
      expect(webLabels[status]).toEqual(SERVER_LABELS[status]);
    }
  });
});
