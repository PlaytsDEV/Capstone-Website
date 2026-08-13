const fs = require("fs");
const path = require("path");

describe("vendored mobile PayMongo webhook — fail-closed signature verification", () => {
  const source = fs.readFileSync(path.join(__dirname, "paymongo.controller.js"), "utf8");

  test("rejects (fails closed) when the webhook secret is unavailable, instead of auto-passing", () => {
    const fn = source.split("function verifyWebhookSignature(req) {")[1]?.split("\nfunction ")[0] || "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/if\s*\(!_webhookSecret\)\s*\{[\s\S]*?return false;/);
    expect(fn).not.toMatch(/if\s*\(!_webhookSecret\)\s*\{[\s\S]*?return true;/);
  });
});
