import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readRouteFile(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

describe("utility route parity", () => {
  test("water routes expose the same lifecycle endpoints as electricity", () => {
    const electricityRoutes = readRouteFile("electricityRoutes.js");
    const waterRoutes = readRouteFile("waterRoutes.js");

    const lifecycleFragments = [
      '"/rooms"',
      '"/periods"',
      '"/periods/:roomId"',
      '"/periods/:id"',
      '"/periods/:id/close"',
      '"/results/:periodId"',
      '"/results/:periodId/revise"',
      '"/periods/:periodId/draft-bills"',
      '"/periods/:periodId/send-bills"',
      '"/my-bills"',
      '"/my-bills/by-bill/:billId"',
    ];

    for (const fragment of lifecycleFragments) {
      expect(electricityRoutes).toContain(fragment);
      expect(waterRoutes).toContain(fragment);
    }
  });
});
