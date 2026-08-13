import fs from "fs";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

describe("mobile Notification route safety (source inspection)", () => {
  const routes = fs.readFileSync(new URL("./mobileNotificationRoutes.js", import.meta.url), "utf8");

  test("never attaches mobileTenantAuth via router-level router.use() — only per-route", () => {
    expect(routes).not.toMatch(/^router\.use\(mobileTenantAuth\)/m);
    const routeDeclarations = [...routes.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)",\s*([^,]+)/g)];
    expect(routeDeclarations.length).toBeGreaterThan(0);
    for (const [, , , nextArg] of routeDeclarations) {
      expect(nextArg.trim()).toBe("mobileTenantAuth");
    }
  });

  test("does not read tenantId/userId out of the request body/query as an authorization input", () => {
    expect(routes).not.toMatch(/req\.(body|query)\.(tenantId|userId|user_id|branchId)/);
  });

  test("every handler is keyed off req.mobileTenant.user_id, never a client-supplied id", () => {
    expect(routes).toContain("req.mobileTenant.user_id");
    expect(routes).not.toMatch(/req\.params\.userId/);
  });
});

describe("mobile Notification routes (HTTP behavior)", () => {
  let server;
  let baseUrl;

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    jest.resetModules();
  });

  async function startApp({ user_id = "tenant-a" } = {}) {
    jest.resetModules();
    jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
      mobileTenantAuth: (req, res, next) => {
        req.mobileTenant = { user_id, _id: "mongo-id" };
        next();
      },
    }));
    jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db: {} } } }));
    jest.unstable_mockModule("../services/mobileNotificationBridge.js", () => ({
      listUserNotifications: jest.fn(async (db, userId) => [{ notification_id: "n1", title: `for ${userId}` }]),
      markNotificationRead: jest.fn(async (db, userId, id) => (id === "n1"
        ? { status: 200, value: { status: "read", notification_id: id } }
        : { status: 404, detail: "Notification not found." })),
      markAllNotificationsRead: jest.fn(async (db, userId) => ({ status: "all_read", read_at: new Date().toISOString() })),
    }));

    const { default: mobileNotificationRoutes } = await import("./mobileNotificationRoutes.js");
    const app = express();
    app.use(express.json());
    app.use("/api/m", mobileNotificationRoutes);
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  test("GET /api/m/notifications returns the resolved tenant's notifications", async () => {
    await startApp({ user_id: "tenant-a" });
    const res = await fetch(`${baseUrl}/api/m/notifications`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].title).toBe("for tenant-a");
  });

  test("PATCH /api/m/notifications/read-all succeeds", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/notifications/read-all`, { method: "PATCH" });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("all_read");
  });

  test("PATCH /api/m/notifications/:id/read returns 404 for an unknown id", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/notifications/does-not-exist/read`, { method: "PATCH" });
    expect(res.status).toBe(404);
  });

  test("PATCH /api/m/notifications/:id/read succeeds for a known id", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/notifications/n1/read`, { method: "PATCH" });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("read");
  });
});
