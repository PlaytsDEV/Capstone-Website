import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const REQUIRED_ENV = {
  FIREBASE_PROJECT_ID: "dormitorymanagement-caps-572cf",
  FIREBASE_PRIVATE_KEY_ID: "key-id",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  FIREBASE_CLIENT_EMAIL: "svc@example.iam.gserviceaccount.com",
  FIREBASE_CLIENT_ID: "client-id",
  FIREBASE_CLIENT_CERT_URL: "https://example.com/cert",
};

const ENV_KEYS = [
  ...Object.keys(REQUIRED_ENV),
  "FIREBASE_STORAGE_BUCKET",
  "GCLOUD_STORAGE_BUCKET",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
];

let savedEnv;

function setEnv(overrides = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, REQUIRED_ENV, overrides);
}

async function loadFirebaseConfig({ bucketFn } = {}) {
  jest.resetModules();
  const initializeApp = jest.fn();
  const bucket = jest.fn(bucketFn || ((name) => ({ name })));
  const apps = [];
  jest.unstable_mockModule("dotenv", () => ({
    default: { config: jest.fn() },
  }));
  jest.unstable_mockModule("firebase-admin", () => ({
    default: {
      apps,
      initializeApp: (...args) => {
        initializeApp(...args);
        apps.push({});
      },
      credential: { cert: jest.fn((sa) => sa) },
      storage: () => ({ bucket }),
      auth: () => ({}),
    },
  }));
  const mod = await import("./firebase.js");
  return { ...mod, initializeApp, bucket };
}

describe("resolveFirebaseStorageBucket", () => {
  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = savedEnv;
    jest.resetModules();
  });

  test("explicit FIREBASE_STORAGE_BUCKET wins over everything else", async () => {
    setEnv({ FIREBASE_STORAGE_BUCKET: "explicit-bucket.firebasestorage.app" });
    const { resolveFirebaseStorageBucket } = await loadFirebaseConfig();
    expect(resolveFirebaseStorageBucket()).toBe("explicit-bucket.firebasestorage.app");
  });

  test("no explicit bucket + FIREBASE_PROJECT_ID present → derives verified `${projectId}.firebasestorage.app`", async () => {
    setEnv({});
    const { resolveFirebaseStorageBucket } = await loadFirebaseConfig();
    expect(resolveFirebaseStorageBucket()).toBe("dormitorymanagement-caps-572cf.firebasestorage.app");
  });

  test("leading gs:// is stripped from an explicit bucket value", async () => {
    setEnv({ FIREBASE_STORAGE_BUCKET: "gs://explicit-bucket.firebasestorage.app" });
    const { resolveFirebaseStorageBucket } = await loadFirebaseConfig();
    expect(resolveFirebaseStorageBucket()).toBe("explicit-bucket.firebasestorage.app");
  });

  test("GCLOUD_STORAGE_BUCKET is honored when FIREBASE_STORAGE_BUCKET is absent", async () => {
    setEnv({ GCLOUD_STORAGE_BUCKET: "gcloud-bucket.firebasestorage.app" });
    const { resolveFirebaseStorageBucket } = await loadFirebaseConfig();
    expect(resolveFirebaseStorageBucket()).toBe("gcloud-bucket.firebasestorage.app");
  });

  test("does not fall back to .appspot.com as the primary derived guess for this project", async () => {
    setEnv({});
    const { resolveFirebaseStorageBucket } = await loadFirebaseConfig();
    expect(resolveFirebaseStorageBucket()).not.toMatch(/\.appspot\.com$/);
  });
});

describe("getFirebaseStorage", () => {
  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = savedEnv;
    jest.resetModules();
  });

  test("no FIREBASE_STORAGE_BUCKET, FIREBASE_PROJECT_ID present → resolves and passes the verified bucket name explicitly to admin.storage().bucket()", async () => {
    setEnv({});
    const { getFirebaseStorage, bucket } = await loadFirebaseConfig();
    getFirebaseStorage();
    expect(bucket).toHaveBeenCalledWith("dormitorymanagement-caps-572cf.firebasestorage.app");
  });

  test("explicit FIREBASE_STORAGE_BUCKET present → explicit value wins and is passed explicitly", async () => {
    setEnv({ FIREBASE_STORAGE_BUCKET: "explicit-bucket.firebasestorage.app" });
    const { getFirebaseStorage, bucket } = await loadFirebaseConfig();
    getFirebaseStorage();
    expect(bucket).toHaveBeenCalledWith("explicit-bucket.firebasestorage.app");
  });

  test("never calls the bare admin.storage().bucket() with no argument", async () => {
    setEnv({});
    const { getFirebaseStorage, bucket } = await loadFirebaseConfig();
    getFirebaseStorage();
    expect(bucket).not.toHaveBeenCalledWith();
    expect(bucket.mock.calls[0].length).toBe(1);
  });
});
