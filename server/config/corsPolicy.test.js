import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCorsOriginPolicy } from "./corsPolicy.js";

describe("credentialed CORS origin policy", () => {
  test("accepts exact official production origins when explicitly configured", () => {
    const policy = createCorsOriginPolicy({
      NODE_ENV: "production",
      ALLOWED_FRONTEND_ORIGINS: "https://www.lilycrest.space,https://lilycrest.space",
      PUBLIC_API_URL: "https://api.lilycrest.space",
    });
    expect(policy.isOriginAllowed("https://www.lilycrest.space")).toBe(true);
    expect(policy.isOriginAllowed("https://lilycrest.space")).toBe(true);
    expect(policy.isOriginAllowed("https://api.lilycrest.space")).toBe(true);
    expect(policy.isOriginAllowed(undefined)).toBe(true);
  });

  test("allows the exact canonical API origin for same-origin browser POSTs", () => {
    const policy = createCorsOriginPolicy({
      NODE_ENV: "production",
      ALLOWED_FRONTEND_ORIGINS: "https://www.lilycrest.space",
      PUBLIC_API_URL: "https://api.lilycrest.space",
    });
    expect(policy.isOriginAllowed("https://api.lilycrest.space")).toBe(true);
    expect(policy.isOriginAllowed("https://api.lilycrest.space.attacker.invalid")).toBe(false);
  });

  test("rejects unapproved and substring-matched origins", () => {
    const policy = createCorsOriginPolicy({ NODE_ENV: "production", CORS_ORIGINS: "https://www.lilycrest.space" });
    expect(policy.isOriginAllowed("https://attacker.example.test")).toBe(false);
    expect(policy.isOriginAllowed("https://www.lilycrest.space.attacker.invalid")).toBe(false);
  });

  test.each(["*", "https://*.example.test"])("rejects production wildcard configuration %s", (rule) => {
    expect(() => createCorsOriginPolicy({ NODE_ENV: "production", CORS_ORIGINS: rule })).toThrow(/wildcard/i);
  });

  test.each(["https://preview-59.vercel.app", "http://localhost:3000"])("rejects unsafe production origin %s", (rule) => {
    expect(() => createCorsOriginPolicy({ NODE_ENV: "production", CORS_ORIGINS: rule })).toThrow();
  });

  test("rejects an unapproved production API origin", () => {
    expect(() => createCorsOriginPolicy({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://www.lilycrest.space",
      PUBLIC_API_URL: "https://attacker.example.test",
    })).toThrow(/approved Lilycrest origin/i);
  });

  test("allows exact localhost origins only outside production", () => {
    const policy = createCorsOriginPolicy({ NODE_ENV: "development", CORS_ORIGINS: "http://localhost:8080" });
    expect(policy.isOriginAllowed("http://localhost:8080")).toBe(true);
    expect(policy.isOriginAllowed("http://localhost:8081")).toBe(false);
    expect(policy.isOriginAllowed("http://localhost:3000")).toBe(true);
  });

  test("never returns a wildcard rule for credentialed HTTP or Socket.IO consumers", () => {
    const policy = createCorsOriginPolicy({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://www.lilycrest.space",
      PUBLIC_API_URL: "https://api.lilycrest.space",
    });
    expect(policy.allowedOriginRules).toEqual([
      "https://www.lilycrest.space",
      "https://api.lilycrest.space",
    ]);
    expect(policy.allowedOriginRules).not.toContain("*");
  });

  test("HTTP and Socket.IO receive the same exact production policy", () => {
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const serverSource = fs.readFileSync(path.join(serverRoot, "server.js"), "utf8");
    const socketSource = fs.readFileSync(path.join(serverRoot, "utils/socket.js"), "utf8");
    expect(serverSource).toMatch(/createCorsOriginPolicy\(\)[\s\S]*cors\(\{[\s\S]*isOriginAllowed/);
    expect(serverSource).toMatch(/initSocket\(server, \{[\s\S]*allowedOriginRules,[\s\S]*isOriginAllowed/);
    expect(socketSource).toMatch(/cors:\s*\{[\s\S]*isOriginAllowed\(origin\)[\s\S]*credentials:\s*true/);
  });
});
