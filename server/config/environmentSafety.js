const PRODUCTION_HOSTS = new Set([
  "api.lilycrest.space",
  "www.lilycrest.space",
  "lilycrest.space",
]);

const NON_PRODUCTION_MARKER = /(?:^|[-_.])(staging|stage|qa|e2e|test|dev|local)(?:$|[-_.])/i;
const text = (value) => String(value || "").trim();

export function deploymentEnvironment(env = process.env) {
  const explicit = text(env.LILYCREST_ENVIRONMENT || env.DEPLOYMENT_ENV || env.APP_ENV);
  if (explicit) return explicit.toLowerCase();
  const nodeEnvironment = text(env.NODE_ENV).toLowerCase();
  return ["production", "staging"].includes(nodeEnvironment) ? nodeEnvironment : "development";
}

export function urlHost(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.replace(/^\w+:\/\//, "").split("/")[0].split(":")[0].toLowerCase();
  }
}

export function mongoDatabaseName(env = process.env) {
  if (text(env.DB_NAME)) return text(env.DB_NAME);
  const uri = text(env.MONGODB_URI || env.MONGO_URI || env.MONGO_URL);
  if (!uri) return "";
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, "").split("/")[0] || "");
  } catch {
    return "";
  }
}

export function hasNonProductionMarker(value) {
  return NON_PRODUCTION_MARKER.test(text(value));
}

function configuredProductionHosts(env = process.env) {
  return text(env.PRODUCTION_RESOURCE_HOSTS)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function productionSignals(env = process.env) {
  const reasons = [];
  if (deploymentEnvironment(env) === "production") reasons.push("deployment environment is production");

  const productionHosts = new Set([...PRODUCTION_HOSTS, ...configuredProductionHosts(env)]);
  for (const name of [
    "API_HOST",
    "PUBLIC_API_URL",
    "API_PUBLIC_URL",
    "PUBLIC_FRONTEND_URL",
    "FRONTEND_URL",
    "EMAIL_ACTION_URL",
    "RESERVATION_CONTINUATION_URL",
  ]) {
    const host = urlHost(env[name]);
    if (host && productionHosts.has(host)) reasons.push(`${name} targets production host ${host}`);
  }

  const dbName = mongoDatabaseName(env);
  if (dbName && !hasNonProductionMarker(dbName)) reasons.push(`database name is not explicitly non-production (${dbName})`);

  for (const name of ["FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET"]) {
    const value = text(env[name]);
    if (value && !hasNonProductionMarker(value)) reasons.push(`${name} is not explicitly non-production`);
  }
  return [...new Set(reasons)];
}

export function stagingConfigurationFailures(env = process.env) {
  const failures = [];
  if (deploymentEnvironment(env) !== "staging") failures.push("LILYCREST_ENVIRONMENT must equal staging");
  if (text(env.STAGING_ALLOW_WRITES).toLowerCase() !== "true") failures.push("STAGING_ALLOW_WRITES must equal true");
  if (!text(env.MONGODB_URI || env.MONGO_URI || env.MONGO_URL)) failures.push("an explicit staging MongoDB URI is required");
  const dbName = mongoDatabaseName(env);
  if (!dbName || !hasNonProductionMarker(dbName)) failures.push("the database name must contain a staging/qa/e2e/test marker");

  for (const name of ["FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET"]) {
    const value = text(env[name]);
    if (!value || !hasNonProductionMarker(value)) failures.push(`${name} must identify a non-production resource`);
  }

  for (const name of ["PUBLIC_API_URL", "PUBLIC_FRONTEND_URL"]) {
    const host = urlHost(env[name]);
    if (!host || PRODUCTION_HOSTS.has(host) || !hasNonProductionMarker(host)) {
      failures.push(`${name} must identify a clearly named staging/QA host`);
    }
  }

  const paymongoKey = text(env.PAYMONGO_SECRET_KEY);
  if (paymongoKey && !paymongoKey.startsWith("sk_test_")) failures.push("PAYMONGO_SECRET_KEY must be a test key in staging");

  return [...new Set([...productionSignals({ ...env, NODE_ENV: "" }), ...failures])];
}

export function productionConfigurationFailures(env = process.env) {
  if (deploymentEnvironment(env) !== "production") return [];
  const failures = [];
  for (const name of ["PUBLIC_API_URL", "PUBLIC_FRONTEND_URL", "FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET"]) {
    if (hasNonProductionMarker(env[name])) failures.push(`${name} contains a staging/QA marker`);
  }
  if (hasNonProductionMarker(mongoDatabaseName(env))) failures.push("production database name contains a staging/QA marker");
  return failures;
}

export function assertServiceIsolation(env = process.env) {
  const target = deploymentEnvironment(env);
  const failures = target === "staging"
    ? stagingConfigurationFailures(env)
    : productionConfigurationFailures(env);
  if (failures.length) {
    const error = new Error(`${target || "unknown"} service isolation failed: ${failures.join("; ")}`);
    error.code = "SERVICE_ISOLATION_FAILED";
    throw error;
  }
  return true;
}

export function assertStagingWriteTarget(env = process.env, { toolName = "write tool" } = {}) {
  const signals = productionSignals(env);
  if (signals.length) {
    const error = new Error(`Production target detected; ${toolName} aborted with no writes: ${signals.join("; ")}`);
    error.code = "PRODUCTION_TARGET_DETECTED";
    throw error;
  }
  const failures = stagingConfigurationFailures(env);
  if (failures.length) {
    const error = new Error(`Staging write guard blocked ${toolName} with no writes: ${failures.join("; ")}`);
    error.code = "STAGING_WRITE_BLOCKED";
    throw error;
  }
  return true;
}

export { PRODUCTION_HOSTS };
