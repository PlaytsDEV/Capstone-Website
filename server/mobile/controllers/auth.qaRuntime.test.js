const endpoint = require("../security/firebaseIdentityToolkitEndpoint.cjs");
const keys = [
  "NODE_ENV",
  "ALLOW_QA_FIXTURES",
  "QA_FIXTURE_MODE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_AUTH_EMULATOR_HOST",
];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test("production Firebase REST endpoint remains the default", () => {
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  expect(endpoint.signInWithPasswordUrl("normal-key")).toBe(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=normal-key",
  );
});

test("explicit isolated QA mode routes password verification to the loopback emulator", () => {
  process.env.NODE_ENV = "development";
  process.env.ALLOW_QA_FIXTURES = "true";
  process.env.QA_FIXTURE_MODE = "isolated-local";
  process.env.FIREBASE_PROJECT_ID = "demo-lilycrest-qa";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  expect(endpoint.signInWithPasswordUrl("fake key")).toBe(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake%20key",
  );
});

test.each([
  ["production", { NODE_ENV: "production" }],
  ["missing opt-in", { ALLOW_QA_FIXTURES: "false" }],
  ["remote host", { FIREBASE_AUTH_EMULATOR_HOST: "10.0.0.5:9099" }],
  ["real project", { FIREBASE_PROJECT_ID: "production-project" }],
])("refuses unsafe emulator mode: %s", (_label, override) => {
  Object.assign(process.env, {
    NODE_ENV: "development",
    ALLOW_QA_FIXTURES: "true",
    QA_FIXTURE_MODE: "isolated-local",
    FIREBASE_PROJECT_ID: "demo-lilycrest-qa",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    ...override,
  });
  expect(() => endpoint.firebaseIdentityToolkitBaseUrl()).toThrow(/Refusing unsafe/);
});
