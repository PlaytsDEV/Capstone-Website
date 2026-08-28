import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const stateDir = path.resolve(String(process.env.QA_STATE_DIR || "").trim());
if (!process.env.QA_STATE_DIR || stateDir === path.parse(stateDir).root) {
  throw new Error("QA_STATE_DIR must name a dedicated non-root state directory.");
}
const envFile = path.join(stateDir, ".env.qa");
const partialEnvFile = path.join(stateDir, ".env.qa.partial");
try {
  const existing = await fs.readFile(envFile, "utf8");
  const additions = [];
  if (!/^QA_LOCAL_INBOX_URL=/m.test(existing)) additions.push("QA_LOCAL_INBOX_URL=http://127.0.0.1:5010");
  if (!/^QA_LOCAL_INBOX_TOKEN=/m.test(existing)) {
    additions.push(`QA_LOCAL_INBOX_TOKEN=${crypto.randomBytes(32).toString("hex")}`);
  }
  if (additions.length) await fs.appendFile(envFile, `${additions.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("Controlled QA inbox state already exists; credentials were preserved and local delivery state is ready.");
  process.exit(0);
} catch (_) {
  // First bootstrap.
}

const api = "https://api.mail.tm";
const domainsResponse = await fetch(`${api}/domains?page=1`);
if (!domainsResponse.ok) throw new Error(`QA inbox provider domain lookup failed (${domainsResponse.status}).`);
const domains = await domainsResponse.json();
const domain = domains["hydra:member"]?.find((entry) => entry.isActive)?.domain;
if (!domain) throw new Error("QA inbox provider returned no active domain.");

const fixtures = ["QA_ACTIVE", "QA_INACTIVE", "QA_USERNAME", "QA_MAINTENANCE", "QA_BILLING", "QA_ADMIN"];
const publicValues = {
  NODE_ENV: "development",
  ALLOW_QA_FIXTURES: "true",
  QA_FIXTURE_MODE: "isolated-local",
  MONGODB_URI: "mongodb://127.0.0.1:27018/lilycrest_qa",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_PROJECT_ID: "demo-lilycrest-qa",
  FIREBASE_API_KEY: "fake-api-key-for-auth-emulator-only",
  FIREBASE_WEB_API_KEY: "fake-api-key-for-auth-emulator-only",
  PUBLIC_FRONTEND_URL: "http://127.0.0.1:5173",
  CLIENT_URL: "http://127.0.0.1:5173",
  FRONTEND_URL: "http://127.0.0.1:5173",
  EMAIL_ACTION_URL: "http://127.0.0.1:5173/auth-action",
  PUBLIC_API_URL: "http://127.0.0.1:5001",
  BACKEND_URL: "http://127.0.0.1:5001",
  PORT: "5001",
  QA_INBOX_PROVIDER: "mail.tm",
  QA_LOCAL_INBOX_URL: "http://127.0.0.1:5010",
};
await fs.mkdir(stateDir, { recursive: true });
const values = { QA_LOCAL_INBOX_TOKEN: crypto.randomBytes(32).toString("hex") };
try {
  const partial = await fs.readFile(partialEnvFile, "utf8");
  for (const line of partial.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
} catch (_) {
  // No prior partial state.
}

async function persist(target, flag) {
  const lines = Object.entries({ ...publicValues, ...values }).map(([key, value]) => `${key}=${value}`);
  await fs.writeFile(target, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600, flag });
  await fs.chmod(target, 0o600).catch(() => undefined);
}

for (const fixture of fixtures) {
  if (values[`${fixture}_EMAIL`] && values[`${fixture}_PASSWORD`]) continue;
  let created = false;
  for (let attempt = 0; attempt < 10 && !created; attempt += 1) {
    const random = crypto.randomBytes(8).toString("hex");
    const address = `lilycrest.${fixture.toLowerCase().replace(/_/g, ".")}.${random}@${domain}`;
    const password = `Qa1!${crypto.randomBytes(18).toString("hex")}`;
    const response = await fetch(`${api}/accounts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, password }),
    });
    if (response.ok) {
      values[`${fixture}_EMAIL`] = address;
      values[`${fixture}_PASSWORD`] = password;
      await persist(partialEnvFile, "w");
      created = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else if (response.status === 429) {
      const retryAfter = Math.max(5, Number(response.headers.get("retry-after") || 5));
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    } else if (response.status !== 422) {
      throw new Error(`QA inbox provider account creation failed (${response.status}).`);
    }
  }
  if (!created) throw new Error(`Could not allocate controlled inbox for ${fixture}.`);
}

await persist(envFile, "wx");
await fs.rm(partialEnvFile, { force: true });
console.log(`Created ${fixtures.length} controlled synthetic QA inboxes; credentials are stored only in the dedicated local state file.`);
