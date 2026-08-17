import fs from "fs";

describe("mobile Billing route safety", () => {
  const routes = fs.readFileSync(new URL("./mobileBillingRoutes.js", import.meta.url), "utf8");
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const vendoredBilling = fs.readFileSync(
    new URL("../mobile/controllers/billing.controller.js", import.meta.url),
    "utf8",
  );

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
    const bridgeImportBlock = routes.match(/import \{([^}]*)\} from "\.\.\/services\/mobileBillingBridge\.js";/s)?.[1] || "";
    for (const name of ["toMobileBill", "isMobileEffectivelyPaid", "toMobilePaymentMethodLabel"]) {
      expect(bridgeImportBlock).toContain(name);
    }
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
        "GET /billing/:billingId/breakdown/:utilityType",
        "GET /billing/:billingId/pdf",
        "GET /billing/:billingId/receipt",
        "POST /billing/:billingId/payment-proof",
      ]),
    );
  });

  test("the breakdown route is scoped by tenant and delegates to buildTenantUtilityBreakdown", () => {
    const breakdownHandler = routes.split('router.get("/billing/:billingId/breakdown/:utilityType"')[1]?.split("router.")[0] || "";
    expect(breakdownHandler.length).toBeGreaterThan(0);
    expect(breakdownHandler).toMatch(/buildTenantUtilityBreakdown/);
    expect(breakdownHandler).toMatch(/req\.mobileTenant\._id/);
  });

  // Phase: distinct Payment Receipt endpoint, separate from the Billing
  // Statement PDF above — matches the LilyCrest-Mobile Phase 2 reference
  // implementation this reconciliation phase ported: 404 for an unpaid
  // bill (never a fabricated receipt), no charges table / TOTAL DUE /
  // payment instructions in its content (see generateBillReceiptPdf).
  test("the receipt route checks isMobileEffectivelyPaid before generating anything", () => {
    const receiptHandler = routes.split('router.get("/billing/:billingId/receipt"')[1]?.split("router.")[0] || "";
    expect(receiptHandler.length).toBeGreaterThan(0);
    expect(receiptHandler).toMatch(/if\s*\(!isMobileEffectivelyPaid\(bill\)\)/);
    expect(receiptHandler).toMatch(/status\(404\)/);
  });

  test("the receipt route generates a distinct PDF from the statement route (generateBillReceiptPdf, not generateRentBillPdf)", () => {
    const receiptHandler = routes.split('router.get("/billing/:billingId/receipt"')[1]?.split("router.")[0] || "";
    expect(receiptHandler).toContain("generateBillReceiptPdf");
    expect(receiptHandler).not.toContain("generateRentBillPdf");
  });

  test("the statement route delegates stale-cache detection to the shared canonical resolver", () => {
    const pdfHandler = routes.split('router.get("/billing/:billingId/pdf"')[1]?.split("router.")[0] || "";
    expect(pdfHandler.length).toBeGreaterThan(0);
    expect(routes).toContain('import { isBillPdfStale } from "../services/billPdfCache.js"');
    expect(pdfHandler).toMatch(/isBillPdfStale\(bill\)/);
  });

  test("server mount precedence makes the canonical statement route shadow the vendored PDF generator", () => {
    expect(server.indexOf('app.use("/api/m", mobileBillingRoutes)')).toBeGreaterThan(-1);
    expect(server.indexOf('app.use("/api/m", mobileBillingRoutes)')).toBeLessThan(
      server.indexOf('app.use("/api/m", mobileRoutes)'),
    );
    const pdfHandler = routes.split('router.get("/billing/:billingId/pdf"')[1]?.split("router.")[0] || "";
    expect(pdfHandler).toContain("generateRentBillPdf");
    expect(vendoredBilling).toContain("buildBrandedPdf");
    expect(routes).not.toContain("buildBrandedPdf");
  });
});
