import { describe, expect, test } from "@jest/globals";
import {
  assertServiceIsolation,
  assertStagingWriteTarget,
  mongoDatabaseName,
  productionSignals,
} from "./environmentSafety.js";

const safe = () => ({
  NODE_ENV: "production",
  LILYCREST_ENVIRONMENT: "staging",
  STAGING_ALLOW_WRITES: "true",
  MONGODB_URI: "mongodb://127.0.0.1:27017/lilycrest-contract-staging-e2e",
  DB_NAME: "lilycrest-contract-staging-e2e",
  PUBLIC_API_URL: "https://staging-contract-api.example.test",
  PUBLIC_FRONTEND_URL: "https://staging-admin.example.test",
  FIREBASE_PROJECT_ID: "lilycrest-staging-qa",
  FIREBASE_STORAGE_BUCKET: "lilycrest-staging-qa.firebasestorage.app",
  PAYMONGO_SECRET_KEY: "sk_test_fixture",
});

describe("environment isolation", () => {
  test("accepts isolated staging configuration", () => {
    expect(assertServiceIsolation(safe())).toBe(true);
    expect(assertStagingWriteTarget(safe())).toBe(true);
  });

  test("extracts Mongo database without exposing credentials", () => {
    expect(mongoDatabaseName({ MONGODB_URI: "mongodb+srv://user:secret@example.invalid/lilycrest-staging-qa" })).toBe("lilycrest-staging-qa");
  });

  test.each([
    ["NODE_ENV without an explicit deployment identity", { LILYCREST_ENVIRONMENT: "" }],
    ["deployment", { LILYCREST_ENVIRONMENT: "production" }],
    ["API", { PUBLIC_API_URL: "https://api.lilycrest.space" }],
    ["frontend", { PUBLIC_FRONTEND_URL: "https://www.lilycrest.space" }],
    ["database", { DB_NAME: "lilycrest" }],
    ["Firebase project", { FIREBASE_PROJECT_ID: "lilycrest-production" }],
    ["Firebase bucket", { FIREBASE_STORAGE_BUCKET: "lilycrest.firebasestorage.app" }],
  ])("refuses writes when %s signals production", (_label, override) => {
    expect(() => assertStagingWriteTarget({ ...safe(), ...override }, { toolName: "fixture tool" }))
      .toThrow(/Production target detected.*no writes/);
  });

  test("does not disclose credentials in production-signal reports", () => {
    const report = productionSignals({
      ...safe(),
      LILYCREST_ENVIRONMENT: "",
      MONGODB_URI: "mongodb+srv://qa:super-secret@example.invalid/lilycrest",
    }).join(" ");
    expect(report).not.toMatch(/super-secret|qa:/);
  });
});
