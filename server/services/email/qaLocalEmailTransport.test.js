import { describe, expect, test } from "@jest/globals";
import { resolveQaLocalInbox } from "./qaLocalEmailTransport.js";

const safe = {
  NODE_ENV: "development",
  ALLOW_QA_FIXTURES: "true",
  QA_FIXTURE_MODE: "isolated-local",
  MONGODB_URI: "mongodb://127.0.0.1:27018/lilycrest_qa",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_PROJECT_ID: "demo-lilycrest-qa",
  PAYMONGO_SECRET_KEY: "sk_test_redacted",
  QA_LOCAL_INBOX_URL: "http://127.0.0.1:5010",
  QA_LOCAL_INBOX_TOKEN: "a".repeat(64),
};

describe("local QA email transport safety", () => {
  test("accepts the explicitly isolated loopback inbox", () => {
    expect(resolveQaLocalInbox(safe)).toEqual({ origin: "http://127.0.0.1:5010", token: "a".repeat(64) });
  });
  test("is disabled when no local inbox is configured", () => {
    expect(resolveQaLocalInbox({ ...safe, QA_LOCAL_INBOX_URL: "" })).toBeNull();
  });
  test.each([
    ["production", { NODE_ENV: "production" }],
    ["remote inbox", { QA_LOCAL_INBOX_URL: "https://qa.example.com" }],
    ["weak token", { QA_LOCAL_INBOX_TOKEN: "short" }],
    ["real Firebase project", { FIREBASE_PROJECT_ID: "production-project" }],
  ])("refuses %s", (_label, override) => {
    expect(() => resolveQaLocalInbox({ ...safe, ...override })).toThrow();
  });
});
