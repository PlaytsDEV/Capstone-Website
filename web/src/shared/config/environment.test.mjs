import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveWebEnvironment,
  validateWebFirebaseEnvironment,
  validateWebServiceEnvironment,
} from "./environment.js";

test("production builds default to production", () => {
  assert.equal(resolveWebEnvironment("", { productionBuild: true }), "production");
});

test("accepts isolated staging web services and Firebase", () => {
  assert.equal(validateWebServiceEnvironment({
    environment: "staging",
    apiUrl: "https://staging-api.example.test/api",
    socketUrl: "https://staging-api.example.test",
    appUrl: "https://staging-admin.example.test",
  }), true);
  assert.equal(validateWebFirebaseEnvironment({
    environment: "staging",
    projectId: "lilycrest-staging-qa",
    storageBucket: "lilycrest-staging-qa.firebasestorage.app",
    appId: "1:123:web:qa",
  }), true);
});

test("staging refuses every production service", () => {
  assert.throws(() => validateWebServiceEnvironment({
    environment: "staging",
    apiUrl: "https://api.lilycrest.space/api",
    socketUrl: "https://api.lilycrest.space",
    appUrl: "https://www.lilycrest.space",
  }), /Web environment isolation failed/);
});

test("production refuses staging service and Firebase configuration", () => {
  assert.throws(() => validateWebServiceEnvironment({
    environment: "production",
    apiUrl: "https://staging-api.example.test/api",
    socketUrl: "https://staging-api.example.test",
    appUrl: "https://staging-admin.example.test",
  }), /production API/);
  assert.throws(() => validateWebFirebaseEnvironment({
    environment: "production",
    projectId: "lilycrest-staging-qa",
    storageBucket: "lilycrest-staging-qa.firebasestorage.app",
    appId: "1:123:web:qa",
  }), /production contains/);
});
