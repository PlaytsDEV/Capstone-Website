import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EMAIL_VERIFICATION_STATES as S,
  classifyFailedVerification,
  classifyVerificationSession,
  cleanAuthActionUrl,
  normalizeInternalContinuation,
} from "./emailVerificationFlow.js";

let cleanedUrl = "";
globalThis.document = { title: "Verify" };
globalThis.window = {
  location: { origin: "https://www.lilycrest.space" },
  history: { replaceState(_state, _title, url) { cleanedUrl = url; } },
};

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const read = (relative) => fs.readFileSync(path.join(webRoot, relative), "utf8");
const action = read("src/features/tenant/pages/AuthAction.jsx");
const routes = read("src/app/routes/publicRoutes.jsx");

test("verification states are distinct and include recovery and account mismatch", () => {
  assert.equal(new Set(Object.values(S)).size, 12);
  assert.equal(S.RECONCILIATION_REQUIRED, "RECONCILIATION_REQUIRED");
  assert.equal(S.ACCOUNT_MISMATCH, "ACCOUNT_MISMATCH");
  assert.equal(S.AUTHENTICATION_EXPIRED, "AUTHENTICATION_EXPIRED");
});

test("failed Firebase actions use authoritative account state", () => {
  assert.equal(classifyFailedVerification({ firebaseErrorCode: "auth/invalid-action-code", accountState: S.ALREADY_VERIFIED_ACCOUNT }), S.ALREADY_USED_LINK_VERIFIED_USER);
  assert.equal(classifyFailedVerification({ firebaseErrorCode: "auth/expired-action-code", accountState: S.VALID_UNUSED_LINK }), S.EXPIRED_LINK_UNVERIFIED_USER);
  assert.equal(classifyFailedVerification({ firebaseErrorCode: "auth/invalid-action-code", accountState: S.VALID_UNUSED_LINK }), S.INVALID_OR_TAMPERED_LINK);
});

test("an expired oobCode still classifies as expired when the custom exchange capability failed first", () => {
  // The exchange token and the Firebase oobCode both default to ~1h TTLs, so
  // the exchange can fail (expired/unavailable) a moment before Firebase's
  // own code does. Without backend account-state confirmation, Firebase's
  // own error code must still be trusted for this display-only distinction.
  assert.equal(
    classifyFailedVerification({ firebaseErrorCode: "auth/expired-action-code", accountState: undefined, identityUnconfirmed: true }),
    S.EXPIRED_LINK_UNVERIFIED_USER,
  );
  // But an unconfirmed identity must never promote a genuinely invalid code.
  assert.equal(
    classifyFailedVerification({ firebaseErrorCode: "auth/invalid-action-code", accountState: undefined, identityUnconfirmed: true }),
    S.INVALID_OR_TAMPERED_LINK,
  );
  // And without the flag, unconfirmed account state alone must not classify as expired.
  assert.equal(
    classifyFailedVerification({ firebaseErrorCode: "auth/expired-action-code", accountState: undefined }),
    S.INVALID_OR_TAMPERED_LINK,
  );
});

test("reservation continuation is internal and rejects open redirects", () => {
  assert.equal(normalizeInternalContinuation("/applicant/reservation?step=application"), "/applicant/reservation?step=application");
  assert.equal(normalizeInternalContinuation("https://evil.example/applicant/reservation"), "/signin");
  assert.equal(normalizeInternalContinuation("//evil.example/path"), "/signin");
  assert.equal(normalizeInternalContinuation("/admin/dashboard"), "/signin");
});

test("one action handler isolates verifyEmail and resetPassword modes", () => {
  assert.match(action, /mode === "resetPassword"[\s\S]*\/reset-password/);
  assert.match(action, /mode !== "verifyEmail"[\s\S]*INVALID_OR_TAMPERED_LINK/);
  assert.match(action, /!mode \|\| !oobCode/);
  assert.match(action, /apiKey !== import\.meta\.env\.VITE_FIREBASE_API_KEY/);
  assert.doesNotMatch(action, /Request new reset link|forgot-password/);
  assert.match(routes, /path="\/verify-email"[\s\S]*<AuthAction/);
});

test("resend remains in verification flow and prevents repeated clicks", () => {
  assert.match(action, /disabled=\{resending \|\| cooldown > 0\}/);
  assert.match(action, /navigate\("\/auth-action\?state=sent"/);
  assert.doesNotMatch(action, /verificationContext|context:/);
});

test("a failed exchange still lets checkActionCode run so Firebase's real verdict surfaces", () => {
  assert.match(action, /exchangeFailed = true/);
  assert.match(action, /exchangeFailed[\s\S]*checkActionCode\(auth, oobCode\)/);
  assert.match(action, /identityUnconfirmed: exchangeFailed/);
});

test("sensitive action URL is cleaned after parameters are read", () => {
  cleanAuthActionUrl();
  assert.equal(cleanedUrl, "/auth-action");
  assert.match(action, /exchangeToken = searchParams\.get\("exchange"\)[\s\S]*cleanAuthActionUrl\(\)/);
  assert.doesNotMatch(action, /localStorage\.setItem\([^\n]*(?:exchange|oobCode)/);
});

test("complete success requires authoritative backend reconciliation", () => {
  assert.match(action, /reconcileEmailVerification\(\)/);
  assert.match(action, /finalizeEmailVerification\(\)/);
  assert.match(action, /if \(!finalized\?\.reconciled\)[\s\S]*RECONCILIATION_REQUIRED/);
  assert.match(action, /setState\(differentAccount \|\| finalized\.identityMatch === "mismatch"/);
});

test("legacy links never claim complete success without authenticated reconciliation", () => {
  assert.match(action, /else if \(exchanged\)[\s\S]*finalizeEmailVerification/);
  assert.match(action, /else \{[\s\S]*RECONCILIATION_REQUIRED/);
  assert.match(action, /Retry account update/);
});

test("different-account state blocks reservation continuation and offers controlled actions", () => {
  assert.match(action, /This verification link belongs to a different account/);
  assert.match(action, /Sign out and continue with the correct account/);
  assert.match(action, /Return to standard sign-in/);
  assert.match(action, /ACCOUNT_MISMATCH[\s\S]*Cancel/);
  assert.match(action, /verifiedIdentityMatchesSession[\s\S]*\? continuation[\s\S]*\/signin/);
  assert.match(routes, /path="\/auth-action"[\s\S]{0,220}<AuthAction/);
  assert.doesNotMatch(routes, /path="\/auth-action"[\s\S]{0,220}<RequireNonAdmin/);
});

test("session identity classification covers correct, different, absent, and admin accounts", () => {
  assert.equal(classifyVerificationSession({ currentEmail: "target@example.com", targetEmail: "TARGET@example.com" }), "match");
  assert.equal(classifyVerificationSession({ currentEmail: "wrong@example.com", targetEmail: "target@example.com" }), "mismatch");
  assert.equal(classifyVerificationSession({ currentEmail: "admin@example.com", targetEmail: "target@example.com", identityMatch: "mismatch" }), "mismatch");
  assert.equal(classifyVerificationSession({ currentEmail: "", targetEmail: "target@example.com" }), "none");
});

test("verification page renders the normalized rate-limit message", () => {
  assert.match(action, /Too many requests were made\. Please wait before trying again\./);
});
