import { describe, expect, test } from "@jest/globals";
import mobileRouter from "./mobileTenantTransferRequestRoutes.js";
import webRouter from "./tenantTransferRequestRoutes.js";

const routeTable = (router) => router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
    middleware: layer.route.stack.map((entry) => entry.name),
  }));

describe("tenant room transfer request route authorization", () => {
  test("web create/read/cancel require authenticated applicant-or-tenant identity", () => {
    const routes = routeTable(webRouter);
    for (const path of [
      "/room-transfer-requests",
      "/room-transfer-request/current",
      "/room-transfer-requests/:id/cancel",
    ]) {
      const route = routes.find((entry) => entry.path === path);
      expect(route.middleware).toEqual(expect.arrayContaining(["verifyToken", "verifyApplicant"]));
    }
  });

  test("decline is Admin-only and permission-gated", () => {
    const decline = routeTable(webRouter).find((entry) => entry.path === "/room-transfer-requests/:id/decline");
    expect(decline.middleware).toEqual(expect.arrayContaining(["verifyToken", "verifyAdmin"]));
    expect(decline.middleware.length).toBeGreaterThanOrEqual(4);
  });

  test("every mobile lifecycle route uses canonical session authentication", () => {
    const routes = routeTable(mobileRouter);
    expect(routes).toHaveLength(4);
    expect(routes.find((route) => route.path === "/room-transfer-preferences"))
      .toBeDefined();
    for (const route of routes) expect(route.middleware).toContain("mobileTenantAuth");
  });
});
