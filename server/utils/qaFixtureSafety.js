const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function enabled(value) {
  return TRUE_VALUES.has(String(value || "").trim().toLowerCase());
}

function parseMongoTarget(uri) {
  let parsed;
  try {
    parsed = new URL(String(uri || "").trim());
  } catch {
    throw new Error("QA fixtures require a valid local MONGODB_URI.");
  }

  if (parsed.protocol !== "mongodb:") {
    throw new Error("QA fixtures refuse non-local or mongodb+srv targets.");
  }

  const hosts = parsed.host
    .split(",")
    .map((entry) => entry.trim().replace(/:\d+$/, "").toLowerCase());
  if (hosts.length === 0 || hosts.some((host) => !LOOPBACK_HOSTS.has(host))) {
    throw new Error("QA fixtures require a loopback-only MongoDB host.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(^|[-_])qa($|[-_])/i.test(databaseName)) {
    throw new Error("QA fixture database name must contain an explicit qa segment.");
  }

  return { databaseName, hosts };
}

function parseFirebaseEmulator(hostValue) {
  const value = String(hostValue || "").trim();
  if (!value || value.includes("://")) {
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST must be a host:port value without a protocol.");
  }

  const host = value.replace(/:\d+$/, "").toLowerCase();
  const port = Number(value.match(/:(\d+)$/)?.[1]);
  if (!LOOPBACK_HOSTS.has(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("QA fixtures require a loopback Firebase Auth Emulator host and valid port.");
  }

  return { host, port };
}

export function assertIsolatedQaEnvironment(env = process.env) {
  if (String(env.NODE_ENV || "").trim().toLowerCase() === "production") {
    throw new Error("QA fixtures are disabled when NODE_ENV=production.");
  }
  if (!enabled(env.ALLOW_QA_FIXTURES)) {
    throw new Error("Set ALLOW_QA_FIXTURES=true to opt in to isolated QA fixtures.");
  }
  if (String(env.QA_FIXTURE_MODE || "").trim() !== "isolated-local") {
    throw new Error("QA_FIXTURE_MODE must be isolated-local.");
  }

  const mongo = parseMongoTarget(env.MONGODB_URI);
  const firebase = parseFirebaseEmulator(env.FIREBASE_AUTH_EMULATOR_HOST);
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  if (!projectId.startsWith("demo-")) {
    throw new Error("QA fixtures require a demo- Firebase project ID.");
  }

  const paymongoKey = String(env.PAYMONGO_SECRET_KEY || "").trim();
  if (paymongoKey && !paymongoKey.startsWith("sk_test_")) {
    throw new Error("QA fixtures refuse non-test PayMongo credentials.");
  }

  return Object.freeze({
    mode: "isolated-local",
    mongoDatabase: mongo.databaseName,
    firebaseProjectId: projectId,
    firebaseHost: firebase.host,
    firebasePort: firebase.port,
    paymongoMode: paymongoKey ? "test" : "mock",
  });
}

export const QA_FIXTURE_MARKER = "LILYCREST_ISOLATED_QA_V1";

