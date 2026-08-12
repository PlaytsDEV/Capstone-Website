/**
 * Single Resend client factory. Every backend email — auth, transactional,
 * mobile — goes through this client. There is no SMTP/Nodemailer fallback:
 * Resend acceptance or rejection is the only delivery signal callers get.
 */
import { Resend } from "resend";

let cachedClient = null;
let cachedApiKey = null;

export const getResendApiKey = (environment = process.env) =>
  String(environment.RESEND_API_KEY || "").trim();

export const getResendFromEmail = (environment = process.env) =>
  String(environment.RESEND_FROM_EMAIL || "").trim();

export const isResendConfigured = (environment = process.env) =>
  Boolean(getResendApiKey(environment) && getResendFromEmail(environment));

/** Lazily builds (and caches) the Resend SDK client for the current API key. */
export const getResendClient = (environment = process.env) => {
  const apiKey = getResendApiKey(environment);
  if (!apiKey) return null;
  if (cachedClient && cachedApiKey === apiKey) return cachedClient;
  cachedClient = new Resend(apiKey);
  cachedApiKey = apiKey;
  return cachedClient;
};

/** Test-only: forces the next getResendClient() call to build a fresh client. */
export const __resetResendClientCache = () => {
  cachedClient = null;
  cachedApiKey = null;
};
