import crypto from "crypto";
import { getPublicUrlConfig } from "../config/publicUrls.js";

export const EMAIL_VERIFICATION_STATES = Object.freeze({
  VALID_UNUSED_LINK: "VALID_UNUSED_LINK",
  EXPIRED_LINK_UNVERIFIED_USER: "EXPIRED_LINK_UNVERIFIED_USER",
  ALREADY_USED_LINK_VERIFIED_USER: "ALREADY_USED_LINK_VERIFIED_USER",
  INVALID_OR_TAMPERED_LINK: "INVALID_OR_TAMPERED_LINK",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  VERIFICATION_EMAIL_RESENT: "VERIFICATION_EMAIL_RESENT",
  VERIFICATION_EMAIL_SEND_FAILED: "VERIFICATION_EMAIL_SEND_FAILED",
  ALREADY_VERIFIED_ACCOUNT: "ALREADY_VERIFIED_ACCOUNT",
  RATE_LIMITED_OR_COOLDOWN_ACTIVE: "RATE_LIMITED_OR_COOLDOWN_ACTIVE",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  ACCOUNT_MISMATCH: "ACCOUNT_MISMATCH",
});

export const EMAIL_VERIFICATION_COOLDOWN_SECONDS = Math.max(
  30,
  Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS || 60),
);

const boundedTtl = (value, fallback) => {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(300, Math.floor(parsed)) : fallback;
};

export const getExchangeTtlSeconds = (environment = process.env) =>
  boundedTtl(environment.EMAIL_VERIFICATION_CONTEXT_TTL_SECONDS, 60 * 60);

export const getSessionTtlSeconds = (environment = process.env) =>
  boundedTtl(environment.EMAIL_VERIFICATION_SESSION_TTL_SECONDS, 15 * 60);

const getSigningSecret = (environment = process.env) => {
  const dedicated = String(environment.EMAIL_VERIFICATION_SECRET || "").trim();
  if (dedicated) return dedicated;
  if (environment.NODE_ENV === "production") {
    throw new Error("EMAIL_VERIFICATION_SECRET is required");
  }
  return "lilycrest-development-email-verification-secret";
};

export const emailFingerprint = (email) =>
  crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");

export const createOpaqueExchangeToken = () => crypto.randomBytes(32).toString("base64url");

export const hashExchangeToken = (token, environment = process.env) => {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("INVALID_EXCHANGE_TOKEN");
  }
  return crypto.createHmac("sha256", getSigningSecret(environment)).update(token).digest("hex");
};

export const getExchangeExpiry = (environment = process.env, now = Date.now()) =>
  new Date(now + getExchangeTtlSeconds(environment) * 1000);

export const getSessionExpiry = (environment = process.env, now = Date.now()) =>
  new Date(now + getSessionTtlSeconds(environment) * 1000);

export const maskEmail = (email) => {
  const [local = "", domain = ""] = String(email || "").split("@");
  if (!local || !domain) return "your email address";
  return `${local.slice(0, 1)}${"*".repeat(Math.min(Math.max(local.length - 1, 1), 4))}@${domain}`;
};

const BASE_CONTINUATION_PATHS = [
  "/signin",
  "/applicant/check-availability",
  "/applicant/reservation",
];

export const normalizeVerificationContinuation = (value, environment = process.env) => {
  if (!value || typeof value !== "string" || /[\r\n]/.test(value)) return "/signin";
  const urls = getPublicUrlConfig(environment);
  const knownContinuationPaths = new Set([
    ...BASE_CONTINUATION_PATHS,
    new URL(urls.reservationContinuationUrl).pathname,
  ]);
  let parsed;
  try {
    parsed = new URL(value, `${urls.publicFrontendUrl}/`);
  } catch {
    return "/signin";
  }

  if (parsed.origin !== new URL(urls.publicFrontendUrl).origin) return "/signin";
  if (!knownContinuationPaths.has(parsed.pathname)) return "/signin";
  return `${parsed.pathname}${parsed.search}`;
};

export const buildCustomEmailVerificationLink = ({ firebaseLink, exchangeToken }, environment = process.env) => {
  const { emailActionUrl } = getPublicUrlConfig(environment);
  const generated = new URL(firebaseLink);
  const handler = new URL(emailActionUrl);
  for (const name of ["mode", "oobCode", "apiKey", "lang"]) {
    const value = generated.searchParams.get(name);
    if (value) handler.searchParams.set(name, value);
  }
  handler.searchParams.set("exchange", exchangeToken);
  return handler.toString();
};
