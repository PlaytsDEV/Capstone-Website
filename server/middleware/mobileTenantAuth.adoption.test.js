import fs from "fs";
import { describe, expect, test } from "@jest/globals";

/**
 * Phase 24/14 cross-domain regression (source-level, complementing the real
 * HTTP tests in routes/mobileAuthMount.test.js and each bridge's own mount
 * test): proves every canonical /api/m bridge router authenticates through
 * the SAME imported mobileTenantAuth function — one canonical mobile session
 * authority — rather than any bridge re-implementing its own session lookup.
 * This is exactly the drift Auth/Session Consolidation eliminated: before
 * this phase, mobileContractRoutes.js and mobileSurveyRoutes.js each carried
 * an independent (and, in the survey case, silently drifted) inline copy of
 * this logic that never checked account-restriction or securityVersion
 * revocation, unlike the vendored mobile backend's own validator.
 */

const BRIDGE_FILES = [
  "mobileContractRoutes.js",
  "mobileSurveyRoutes.js",
  "mobileBillingRoutes.js",
  "mobilePaymongoRoutes.js",
  "mobileDocumentRoutes.js",
];

describe("every canonical mobile bridge authenticates through the one shared mobileTenantAuth", () => {
  const sources = Object.fromEntries(
    BRIDGE_FILES.map((name) => [
      name,
      fs.readFileSync(new URL(`../routes/${name}`, import.meta.url), "utf8"),
    ]),
  );

  test.each(BRIDGE_FILES)("%s imports mobileTenantAuth from the canonical middleware", (name) => {
    const source = sources[name];
    expect(source).toMatch(
      /import\s*\{\s*mobileTenantAuth(?:\s+as\s+\w+)?\s*\}\s*from\s*"\.\.\/middleware\/mobileTenantAuth\.js"/,
    );
  });

  test.each(BRIDGE_FILES)("%s does not re-implement its own user_sessions lookup", (name) => {
    const source = sources[name];
    expect(source).not.toMatch(/collection\(["']user_sessions["']\)/);
  });

  test.each(BRIDGE_FILES)("%s never attaches auth via a router-level router.use()", (name) => {
    const source = sources[name];
    expect(source).not.toMatch(/^router\.use\(mobileTenant/m);
  });
});
