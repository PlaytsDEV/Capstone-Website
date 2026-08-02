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
});

export const EMAIL_VERIFICATION_COOLDOWN_SECONDS = Math.max(
  30,
  Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS || 60),
);

const CONTEXT_TTL_SECONDS = Math.max(
  3600,
  Number(process.env.EMAIL_VERIFICATION_CONTEXT_TTL_SECONDS || 7 * 24 * 60 * 60),
);

const getSigningSecret = (environment = process.env) => {
  const dedicated = String(environment.EMAIL_VERIFICATION_SECRET || "").trim();
  if (dedicated) return dedicated;
  if (environment.NODE_ENV === "production") {
    throw new Error("EMAIL_VERIFICATION_SECRET is required");
  }
  return "lilycrest-development-email-verification-secret";
};

const encode = (value) => Buffer.from(value).toString("base64url");
const sign = (encodedPayload, secret) =>
  crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

export const emailFingerprint = (email) =>
  crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");

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

export const createVerificationContext = ({ uid, email, continuePath }, environment = process.env) => {
  if (!uid || !email) throw new Error("A Firebase identity is required");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    u: String(uid),
    h: emailFingerprint(email),
    c: normalizeVerificationContinuation(continuePath, environment),
    iat: issuedAt,
    exp: issuedAt + CONTEXT_TTL_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, getSigningSecret(environment))}`;
};

export const verifyVerificationContext = (token, environment = process.env) => {
  if (typeof token !== "string" || token.length > 4096) throw new Error("INVALID_CONTEXT");
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) throw new Error("INVALID_CONTEXT");
  const expected = sign(encodedPayload, getSigningSecret(environment));
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("INVALID_CONTEXT");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new Error("INVALID_CONTEXT");
  }
  if (payload.v !== 1 || !payload.u || !payload.h || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("INVALID_CONTEXT");
  }
  return { uid: payload.u, emailHash: payload.h, continuePath: normalizeVerificationContinuation(payload.c, environment) };
};

export const buildCustomEmailVerificationLink = ({ firebaseLink, verificationContext }, environment = process.env) => {
  const { emailActionUrl } = getPublicUrlConfig(environment);
  const generated = new URL(firebaseLink);
  const handler = new URL(emailActionUrl);
  for (const name of ["mode", "oobCode", "apiKey", "lang"]) {
    const value = generated.searchParams.get(name);
    if (value) handler.searchParams.set(name, value);
  }
  const continuation = new URL(emailActionUrl);
  continuation.searchParams.set("context", verificationContext);
  handler.searchParams.set("continueUrl", continuation.toString());
  return handler.toString();
};
