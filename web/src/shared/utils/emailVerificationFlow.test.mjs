import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EMAIL_VERIFICATION_STATES as S,
  classifyFailedVerification,
  normalizeInternalContinuation,
} from "./emailVerificationFlow.js";

globalThis.window = { location: { origin: "https://www.lilycrest.space" } };

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const read = (relative) => fs.readFileSync(path.join(webRoot, relative), "utf8");
const action = read("src/features/tenant/pages/AuthAction.jsx");
const routes = read("src/app/routes/publicRoutes.jsx");

test("verification states are distinct and complete", () => {
  assert.equal(new Set(Object.values(S)).size, 9);
  for (const name of [
    "VALID_UNUSED_LINK", "EXPIRED_LINK_UNVERIFIED_USER", "ALREADY_USED_LINK_VERIFIED_USER",
    "INVALID_OR_TAMPERED_LINK", "USER_NOT_FOUND", "VERIFICATION_EMAIL_RESENT",
    "VERIFICATION_EMAIL_SEND_FAILED", "ALREADY_VERIFIED_ACCOUNT", "RATE_LIMITED_OR_COOLDOWN_ACTIVE",
  ]) assert.equal(S[name], name);
});

test("failed Firebase actions use authoritative account state", () => {
  assert.equal(classifyFailedVerification({ firebaseErrorCode: "auth/invalid-action-code", accountState: S.ALREADY_VERIFIED_ACCOUNT }), S.ALREADY_USED_LINK_VERIFIED_USER);
  assert.equal(classifyFailedVerification({ firebaseErrorCode: "auth/expired-action-code", accountState: S.VALID_UNUSED_LINK }), S.EXPIRED_LINK_UNVERIFIED_USER);
  assert.equal(classifyFailedVerification({ firebaseErrorCode: "auth/invalid-action-code", accountState: S.VALID_UNUSED_LINK }), S.INVALID_OR_TAMPERED_LINK);
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
  assert.match(action, /navigate\(`\/auth-action\?\$\{params\.toString\(\)\}`/);
  assert.match(action, /New link sent/);
  assert.doesNotMatch(action, /window\.location\.href|location\.replace/);
});

test("refreshable result states retain only signed context in the URL", () => {
  assert.match(action, /displayState === "send-failed"/);
  assert.match(action, /getEmailVerificationStatus\(verificationContext\)/);
  assert.doesNotMatch(action, /localStorage\.setItem\([^\n]*context|localStorage\.setItem\([^\n]*oobCode/);
});

test("successful verification refreshes Firebase state before backend finalization", () => {
  assert.match(action, /auth\.currentUser\.reload\(\)[\s\S]*getIdToken\(true\)[\s\S]*finalizeEmailVerification/);
});
