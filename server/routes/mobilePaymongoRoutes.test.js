import fs from "fs";

describe("mobile PayMongo route safety", () => {
  const routes = fs.readFileSync(new URL("./mobilePaymongoRoutes.js", import.meta.url), "utf8");

  test("never attaches mobileTenantAuth via router-level router.use() — only per-route", () => {
    // See the identical rationale in mobileBillingRoutes.test.js: a
    // router-level router.use(mobileTenantAuth) would incorrectly 401 every
    // /api/m/* request routed through this file's mount point, including
    // sibling paths unrelated to PayMongo.
    expect(routes).not.toMatch(/^router\.use\(mobileTenantAuth\)/m);
    // /paymongo/webhook is deliberately public (a webhook has no mobile
    // session to authenticate) and deliberately a no-op — see the dedicated
    // test below for why it's safe to leave unauthenticated.
    const routeDeclarations = [...routes.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)",\s*([^,]+)/g)]
      .filter(([, , p]) => p !== "/paymongo/webhook");
    expect(routeDeclarations.length).toBeGreaterThan(0);
    for (const [, , p, nextArg] of routeDeclarations) {
      expect(nextArg.trim()).toBe("mobileTenantAuth");
    }
  });

  test("checkout amount is computed server-side from the canonical bill snapshot, never taken from the client", () => {
    expect(routes).toContain("const amountDue = visible.remainingAmount;");
    expect(routes).not.toMatch(/amount:\s*req\.body/);
    expect(routes).not.toMatch(/amountDue:\s*req\.body/);
  });

  test("checkout creation is scoped to the authenticated tenant's own bill", () => {
    expect(routes).toMatch(/Bill\.findOne\(\{\s*_id:\s*billingId,\s*userId:\s*req\.mobileTenant\._id/);
  });

  test("status polling re-verifies bill ownership from the resolved session, not from the PayMongo session alone", () => {
    const statusHandler = routes.split('router.get("/paymongo/checkout/:checkoutId/status"')[1] || "";
    expect(statusHandler).toMatch(/Bill\.findOne\(\{\s*_id:\s*metadata\.billId,\s*userId:\s*req\.mobileTenant\._id/);
  });

  test("intercepts /paymongo/webhook as a safe no-op — neutralizes the vendored router's independent settlement path, never re-implements signature verification or settlement here", () => {
    // The vendored mobile backend (mobile/routes/paymongo.routes.js) defines
    // its own POST /paymongo/webhook with independent, DB-mutating
    // settlement logic that bypasses settlePaymongoBill entirely. Nothing
    // previously defined this path in THIS router, so that vendored handler
    // was reachable (not shadowed) — a second live settlement engine. This
    // router now intercepts the path and acknowledges without processing,
    // so the vendored handler never runs for mobile traffic. The real,
    // single settlement authority stays the canonical webhook mounted at
    // /api/paymongo and /api/webhooks (routes/webhookRoutes.js).
    expect(routes).toMatch(/router\.post\("\/paymongo\/webhook"/);
    expect(routes).not.toMatch(/verifyWebhookSignature/);
    const webhookHandler = routes.split('router.post("/paymongo/webhook"')[1]?.split("router.")[0] || "";
    expect(webhookHandler.length).toBeGreaterThan(0);
    expect(webhookHandler).not.toMatch(/settlePaymongoBill/);
    expect(webhookHandler).not.toMatch(/Bill\.(find|update|save)/);
    expect(webhookHandler).toMatch(/status\(200\)/);
  });

  test("uses the shared canonical settlement function rather than a second implementation of payment truth", () => {
    expect(routes).toContain('import { settlePaymongoBill } from "../utils/billSettlement.js"');
  });

  test("checkout status is reported through the shared paid/pending/failed/cancelled/unknown normalizer, not a bare paid/pending literal", () => {
    expect(routes).toContain("normalizeCheckoutStatusForClient");
    expect(routes).not.toMatch(/status:\s*isPaid\s*\?\s*"paid"\s*:\s*"pending"/);
    // The unreachable-session-fetch fallback must stay inside the same
    // stable enum instead of leaking a one-off "unpaid" string.
    expect(routes).not.toMatch(/status:\s*"unpaid"/);
  });
});
