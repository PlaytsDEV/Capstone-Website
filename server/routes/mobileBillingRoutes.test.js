import fs from "fs";

describe("mobile Billing route safety", () => {
  const routes = fs.readFileSync(new URL("./mobileBillingRoutes.js", import.meta.url), "utf8");

  test("never attaches mobileTenantAuth via router-level router.use() — only per-route", () => {
    // router.use(mobileTenantAuth) would run for every /api/m/* request that
    // reaches this router, including unrelated sibling paths like
    // /api/m/auth/login, and — since mobileTenantAuth ends the response with
    // 401 instead of calling next() — would prevent those requests from
    // ever falling through to the router that actually owns them. See
    // mobileBillingRoutes.mount.test.js for the real-HTTP regression test.
    expect(routes).not.toMatch(/^router\.use\(mobileTenantAuth\)/m);
    const routeDeclarations = [...routes.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)",\s*([^,]+)/g)];
    expect(routeDeclarations.length).toBeGreaterThan(0);
    for (const [, , p, nextArg] of routeDeclarations) {
      expect(nextArg.trim()).toBe("mobileTenantAuth");
    }
  });

  test("every bill lookup is scoped by the authenticated tenant's own userId — never a client-supplied id", () => {
    // Every Bill.find/findOne call in this file must filter on
    // req.mobileTenant._id (server-resolved from the session), not on
    // anything read from req.body/req.params/req.query.
    const billLookups = routes.match(/Bill\.find(One)?\(\{[^}]*\}\)/gs) || [];
    expect(billLookups.length).toBeGreaterThan(0);
    for (const lookup of billLookups) {
      expect(lookup).toMatch(/userId:\s*req\.mobileTenant\._id/);
    }
  });

  test("does not read tenantId/userId/branchId out of the request body/query as an authorization input", () => {
    expect(routes).not.toMatch(/req\.(body|query)\.(tenantId|userId|branchId|user_id|branch_id)/);
  });

  test("reads canonical billing status/amounts through billingPolicy — never re-derives its own status math", () => {
    expect(routes).toContain('import { toMobileBill, isMobileEffectivelyPaid } from "../services/mobileBillingBridge.js"');
    expect(routes).not.toMatch(/function\s+(normalizeBillStatus|getEffectiveBillStatus)/);
  });

  test("does not touch the legacy 'billing' collection", () => {
    expect(routes).not.toMatch(/collection\(['"]billing['"]\)/);
  });

  test("payment-proof submission never sets an authoritative bill status from client input", () => {
    const proofHandler = routes.split('router.post("/billing/:billingId/payment-proof"')[1]?.split("router.")[0] || "";
    expect(proofHandler.length).toBeGreaterThan(0);
    expect(proofHandler).not.toMatch(/bill\.status\s*=/);
    expect(proofHandler).not.toMatch(/\$set:\s*\{[^}]*status/s);
    expect(proofHandler).toMatch(/status\(409\)/);
  });

  test("blocks arbitrary client-controlled bill status mutation and self-service bill creation for mobile", () => {
    expect(routes).toMatch(/router\.put\("\/billing\/:billingId",\s*mobileTenantAuth,\s*\(req, res\) => \{\s*res\.status\(403\)/);
    expect(routes).toMatch(/router\.post\("\/billing",\s*mobileTenantAuth,\s*\(req, res\) => \{\s*res\.status\(403\)/);
  });

  test("only exposes the read + payment-proof-rejection routes the mobile app actually needs", () => {
    const methodPathPairs = [...routes.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)"/g)]
      .map(([, method, p]) => `${method.toUpperCase()} ${p}`);
    expect(methodPathPairs).toEqual(
      expect.arrayContaining([
        "GET /billing/me",
        "GET /billing/me/latest",
        "GET /billing/history",
        "GET /billing/history/paid",
        "GET /billing/:billingId",
        "GET /billing/:billingId/pdf",
        "POST /billing/:billingId/payment-proof",
      ]),
    );
  });
});
