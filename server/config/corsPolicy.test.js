import { describe, expect, test } from "@jest/globals";
import { createCorsOriginPolicy } from "./corsPolicy.js";

describe("credentialed CORS origin policy", () => {
  test("accepts explicitly configured production origins", () => {
    const policy = createCorsOriginPolicy({
      NODE_ENV: "production",
      ALLOWED_FRONTEND_ORIGINS: "https://app.example.test,https://lilycrest.space",
      FRONTEND_URL: "https://portal.example.test/",
    });
    expect(policy.isOriginAllowed("https://app.example.test")).toBe(true);
    expect(policy.isOriginAllowed("https://portal.example.test")).toBe(true);
    expect(policy.isOriginAllowed("https://lilycrest.space")).toBe(true);
    expect(policy.isOriginAllowed(undefined)).toBe(true);
  });

  test("rejects unapproved browser origins", () => {
    const policy = createCorsOriginPolicy({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.test",
    });
    expect(policy.isOriginAllowed("https://attacker.example.test")).toBe(false);
  });

  test("never treats a standalone wildcard as approval with credentials", () => {
    const policy = createCorsOriginPolicy({ NODE_ENV: "production", CORS_ORIGINS: "*" });
    expect(policy.allowedOriginRules).not.toContain("*");
    expect(policy.isOriginAllowed("https://attacker.example.test")).toBe(false);
  });

  test("supports explicitly scoped wildcard deployments", () => {
    const policy = createCorsOriginPolicy({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://*.preview.example.test",
    });
    expect(policy.isOriginAllowed("https://pr-58.preview.example.test")).toBe(true);
    expect(policy.isOriginAllowed("https://preview.example.test.attacker.invalid")).toBe(false);
  });

  test("allows localhost defaults only outside production", () => {
    expect(createCorsOriginPolicy({ NODE_ENV: "development" }).isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(createCorsOriginPolicy({ NODE_ENV: "production" }).isOriginAllowed("http://localhost:3000")).toBe(false);
  });
});
