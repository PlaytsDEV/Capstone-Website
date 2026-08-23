const PRODUCTION_HOSTS = new Set(["api.lilycrest.space", "www.lilycrest.space", "lilycrest.space"]);
const NON_PRODUCTION_MARKER = /(?:^|[-.])(staging|stage|qa|e2e|test|dev)(?:[-.]|$)/i;
const text = (value) => String(value || "").trim();

function host(value) {
  try {
    return new URL(text(value)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function resolveWebEnvironment(value, { productionBuild = false } = {}) {
  const configured = text(value).toLowerCase();
  if (configured) return configured;
  return productionBuild ? "production" : "development";
}

export function validateWebServiceEnvironment({ environment, apiUrl, socketUrl, appUrl }) {
  const target = text(environment).toLowerCase();
  if (!["development", "staging", "production"].includes(target)) {
    throw new Error(`Unsupported LilyCrest web environment: ${target || "missing"}`);
  }

  const failures = [];
  const urls = { apiUrl, socketUrl, appUrl };
  if (target === "staging") {
    for (const [name, value] of Object.entries(urls)) {
      const valueHost = host(value);
      if (!valueHost || PRODUCTION_HOSTS.has(valueHost) || !NON_PRODUCTION_MARKER.test(valueHost)) {
        failures.push(`${name} must identify a clearly named staging/QA host`);
      }
    }
  }
  if (target === "production") {
    if (text(apiUrl).replace(/\/+$/, "") !== "https://api.lilycrest.space/api") {
      failures.push("production API must equal https://api.lilycrest.space/api");
    }
    for (const [name, value] of Object.entries(urls)) {
      if (NON_PRODUCTION_MARKER.test(host(value))) failures.push(`${name} contains a staging/QA marker`);
    }
  }

  if (failures.length) throw new Error(`Web environment isolation failed: ${failures.join("; ")}`);
  return true;
}

export function validateWebFirebaseEnvironment({ environment, projectId, storageBucket, appId }) {
  const target = text(environment).toLowerCase();
  const failures = [];
  if (target === "staging") {
    if (!NON_PRODUCTION_MARKER.test(text(projectId))) failures.push("Firebase project must be explicitly staging/QA");
    if (!NON_PRODUCTION_MARKER.test(text(storageBucket))) failures.push("Firebase bucket must be explicitly staging/QA");
    if (!text(appId)) failures.push("Firebase app id is required");
  }
  if (target === "production") {
    if (NON_PRODUCTION_MARKER.test(text(projectId))) failures.push("production contains a staging/QA Firebase project");
    if (NON_PRODUCTION_MARKER.test(text(storageBucket))) failures.push("production contains a staging/QA Firebase bucket");
  }
  if (failures.length) throw new Error(`Web Firebase isolation failed: ${failures.join("; ")}`);
  return true;
}
