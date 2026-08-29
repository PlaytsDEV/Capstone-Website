import { assertIsolatedQaEnvironment } from "../../utils/qaFixtureSafety.js";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function resolveQaLocalInbox(env = process.env) {
  const value = String(env.QA_LOCAL_INBOX_URL || "").trim();
  if (!value) return null;
  assertIsolatedQaEnvironment(env);
  const token = String(env.QA_LOCAL_INBOX_TOKEN || "").trim();
  if (token.length < 32) throw new Error("QA_LOCAL_INBOX_TOKEN must be at least 32 characters.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("QA_LOCAL_INBOX_URL must be a valid URL.");
  }
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) || !parsed.port) {
    throw new Error("QA local inbox must use an HTTP loopback URL with an explicit port.");
  }
  return { origin: parsed.origin, token };
}

export async function sendQaLocalEmail({ to, templateKey, variables, subject, html }, env = process.env) {
  const inbox = resolveQaLocalInbox(env);
  if (!inbox) return null;
  const response = await fetch(`${inbox.origin}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${inbox.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ to, templateKey, variables, subject, html }),
  });
  if (!response.ok) {
    return { success: false, provider: "local-qa-inbox", category: "delivery", code: "QA_INBOX_DELIVERY_FAILED" };
  }
  return { success: true, provider: "local-qa-inbox", category: "accepted", code: "QA_INBOX_ACCEPTED" };
}
