import { describe, expect, test } from "@jest/globals";
import { assertIsolatedQaEnvironment } from "./qaFixtureSafety.js";

const safeEnv = {
  NODE_ENV: "development",
  ALLOW_QA_FIXTURES: "true",
  QA_FIXTURE_MODE: "isolated-local",
  MONGODB_URI: "mongodb://127.0.0.1:27018/lilycrest_qa",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_PROJECT_ID: "demo-lilycrest-qa",
  PAYMONGO_SECRET_KEY: "sk_test_redacted",
};

describe("isolated QA fixture safety gate", () => {
  test("accepts an explicitly enabled loopback-only emulator stack", () => {
    expect(assertIsolatedQaEnvironment(safeEnv)).toMatchObject({
      mongoDatabase: "lilycrest_qa",
      firebaseProjectId: "demo-lilycrest-qa",
      paymongoMode: "test",
    });
  });

  test.each([
    ["production runtime", { NODE_ENV: "production" }],
    ["missing opt-in", { ALLOW_QA_FIXTURES: "false" }],
    ["remote MongoDB", { MONGODB_URI: "mongodb+srv://cluster.example/lilycrest_qa" }],
    ["non-QA database", { MONGODB_URI: "mongodb://127.0.0.1:27018/lilycrest" }],
    ["remote auth emulator", { FIREBASE_AUTH_EMULATOR_HOST: "10.0.0.5:9099" }],
    ["real Firebase project", { FIREBASE_PROJECT_ID: "lilycrest-production" }],
    ["live PayMongo key", { PAYMONGO_SECRET_KEY: "sk_live_redacted" }],
  ])("refuses %s", (_label, override) => {
    expect(() => assertIsolatedQaEnvironment({ ...safeEnv, ...override })).toThrow();
  });
});

