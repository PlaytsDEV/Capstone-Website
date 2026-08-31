import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  executeSocialAuth,
  createSocialAuthSession,
  isPopupCancellationError,
  createDebouncedClick,
  SOCIAL_AUTH_TIMEOUT_MS,
} from "./socialAuthManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("isPopupCancellationError detects popup closed and cancelled requests", () => {
  assert.equal(isPopupCancellationError({ code: "auth/popup-closed-by-user" }), true);
  assert.equal(isPopupCancellationError({ code: "auth/cancelled-popup-request" }), true);
  assert.equal(isPopupCancellationError({ code: "AUTH_MANUAL_CANCEL" }), true);
  assert.equal(isPopupCancellationError({ code: "AUTH_POPUP_TIMEOUT" }), true);
  assert.equal(isPopupCancellationError({ code: "auth/network-request-failed" }), false);
  assert.equal(isPopupCancellationError(null), false);
});

test("executeSocialAuth successfully returns auth result on normal flow", async () => {
  const mockAuth = {};
  const mockProvider = {};
  const mockResult = { user: { email: "tenant@example.com", uid: "u123" } };

  let cancelled = false;
  let successResult = null;

  const result = await executeSocialAuth({
    auth: mockAuth,
    provider: mockProvider,
    signInFn: async () => mockResult,
    onSuccess: (res) => {
      successResult = res;
    },
    onCancel: () => {
      cancelled = true;
    },
  });

  assert.equal(cancelled, false);
  assert.deepEqual(result, mockResult);
  assert.deepEqual(successResult, mockResult);
});

test("executeSocialAuth catches auth/popup-closed-by-user and triggers onCancel immediately", async () => {
  const mockAuth = {};
  const mockProvider = {};
  const popupClosedError = new Error("Popup closed");
  popupClosedError.code = "auth/popup-closed-by-user";

  let cancelPayload = null;

  const result = await executeSocialAuth({
    auth: mockAuth,
    provider: mockProvider,
    signInFn: async () => {
      throw popupClosedError;
    },
    onCancel: (info) => {
      cancelPayload = info;
    },
  });

  assert.equal(result, null);
  assert.ok(cancelPayload);
  assert.equal(cancelPayload.cancelled, true);
  assert.equal(cancelPayload.code, "auth/popup-closed-by-user");
  assert.equal(cancelPayload.reason, "popup_closed");
});

test("createSocialAuthSession allows instant manual cancellation via abort()", async () => {
  const session = createSocialAuthSession({ timeoutMs: 5000 });
  let cancelCalled = false;

  const authPromise = session.start({
    auth: {},
    provider: {},
    signInFn: () => new Promise((resolve) => setTimeout(resolve, 3000)),
    onCancel: (info) => {
      cancelCalled = true;
      assert.equal(info.reason, "manual_abort");
    },
  });

  await new Promise((r) => setTimeout(r, 50));
  session.cancel();

  await authPromise;
  assert.equal(cancelCalled, true);
  assert.equal(session.isActive(), false);
});

test("executeSocialAuth triggers onCancel when safety timeout is reached", async () => {
  let cancelPayload = null;

  const result = await executeSocialAuth({
    auth: {},
    provider: {},
    timeoutMs: 100,
    signInFn: () => new Promise((resolve) => setTimeout(resolve, 1000)),
    onCancel: (info) => {
      cancelPayload = info;
    },
  });

  assert.equal(result, null);
  assert.ok(cancelPayload);
  assert.equal(cancelPayload.reason, "timeout");
  assert.equal(cancelPayload.code, "AUTH_POPUP_TIMEOUT");
});

test("createDebouncedClick prevents multiple rapid invocations within threshold window", () => {
  let count = 0;
  const fn = () => {
    count++;
  };
  const debounced = createDebouncedClick(fn, 1000);

  debounced();
  debounced();
  debounced();

  assert.equal(count, 1, "Should only invoke callback once during debounce window");
});

test("SocialAuthButtons integrates createDebouncedClick and accessibility tokens", () => {
  const componentPath = path.resolve(__dirname, "../components/SocialAuthButtons.jsx");
  const rawCode = fs.readFileSync(componentPath, "utf8");

  assert.match(rawCode, /createDebouncedClick/, "SocialAuthButtons must use createDebouncedClick");
  assert.match(rawCode, /aria-busy=\{loading\}/, "SocialAuthButtons must include aria-busy attribute");
  assert.match(rawCode, /aria-label=/, "SocialAuthButtons must include aria-label for screen readers");
  assert.doesNotMatch(rawCode, /cancelText/, "SocialAuthButtons must not render visible cancelText button");
});

test("SOCIAL_AUTH_TIMEOUT_MS is configured to 30 seconds for rapid auto-recovery", () => {
  assert.equal(SOCIAL_AUTH_TIMEOUT_MS, 30000);
});



