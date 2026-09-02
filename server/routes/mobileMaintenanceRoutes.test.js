import fs from "fs";
import { describe, expect, test } from "@jest/globals";
import router from "./mobileMaintenanceRoutes.js";

const routeTable = router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
    middleware: layer.route.stack.map((entry) => entry.name),
  }));

describe("canonical mobile maintenance adapter", () => {
  test("every mobile route uses canonical session authentication", () => {
    expect(routeTable.length).toBeGreaterThanOrEqual(15);
    for (const route of routeTable) {
      expect(route.middleware).toContain("mobileTenantAuth");
    }
  });

  test.each([
    ["get", "/maintenance/me"],
    ["post", "/maintenance"],
    ["get", "/maintenance/:requestId"],
    ["patch", "/maintenance/:requestId/cancel"],
    ["patch", "/maintenance/:requestId/reopen"],
    ["post", "/maintenance/:requestId/confirm"],
    ["post", "/maintenance/:requestId/reschedule-request"],
    ["patch", "/maintenance/:requestId/read"],
  ])("owns %s %s before the vendored router", (method, path) => {
    expect(routeTable).toContainEqual(expect.objectContaining({
      path,
      methods: expect.arrayContaining([method]),
    }));
  });

  test("server mounts the canonical adapter before the vendored mobile router", () => {
    const source = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
    expect(source.indexOf('app.use("/api/m", mobileMaintenanceRoutes)'))
      .toBeLessThan(source.indexOf('app.use("/api/m", mobileRoutes)'));
  });
});
