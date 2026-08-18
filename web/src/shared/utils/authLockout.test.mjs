import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLockoutDurationSeconds,
  normalizeLockoutIdentity,
  getLockoutState,
  recordFailedLoginAttempt,
  setManualLockout,
  resetLockoutState,
  setResendCooldown,
  getResendCooldown,
  clearResendCooldown,
  subscribeToAuthStorage,
} from "./authLockout.js";

// In-memory mock localStorage implementation for Node test runtime
class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new LocalStorageMock();
const listeners = [];

if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    localStorage: mockStorage,
    addEventListener: (type, handler) => {
      if (type === "storage") listeners.push(handler);
    },
    removeEventListener: (type, handler) => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    },
  };
} else if (!globalThis.window.localStorage) {
  globalThis.window.localStorage = mockStorage;
}

test("calculateLockoutDurationSeconds enforces exponential backoff tiers", () => {
  assert.equal(calculateLockoutDurationSeconds(0), 0);
  assert.equal(calculateLockoutDurationSeconds(4), 0);
  assert.equal(calculateLockoutDurationSeconds(5), 60); // 1 min
  assert.equal(calculateLockoutDurationSeconds(6), 120); // 2 mins
  assert.equal(calculateLockoutDurationSeconds(7), 300); // 5 mins
  assert.equal(calculateLockoutDurationSeconds(8), 900); // 15 mins
  assert.equal(calculateLockoutDurationSeconds(15), 900); // 15 mins
});

test("normalizeLockoutIdentity trims and lowercases inputs", () => {
  assert.equal(normalizeLockoutIdentity("  Tenant@Example.COM "), "tenant@example.com");
  assert.equal(normalizeLockoutIdentity(null), "");
});

test("recordFailedLoginAttempt tracks attempts and locks out at 5th attempt", () => {
  mockStorage.clear();

  // Attempts 1 to 4: not locked out
  for (let i = 1; i <= 4; i++) {
    const state = recordFailedLoginAttempt("user@example.com");
    assert.equal(state.isLockedOut, false);
    assert.equal(state.attempts, i);
    assert.equal(state.remainingSeconds, 0);
  }

  // 5th attempt: 60s lockout
  const state5 = recordFailedLoginAttempt("user@example.com");
  assert.equal(state5.isLockedOut, true);
  assert.equal(state5.attempts, 5);
  assert.equal(state5.remainingSeconds, 60);
  assert.ok(state5.lockoutUntil > Date.now());

  // Check getLockoutState recovers identical state (simulating page reload F5)
  const recovered = getLockoutState("user@example.com");
  assert.equal(recovered.isLockedOut, true);
  assert.equal(recovered.attempts, 5);
  assert.ok(recovered.remainingSeconds >= 59 && recovered.remainingSeconds <= 60);
});

test("subsequent failed attempts escalate exponential backoff duration", () => {
  mockStorage.clear();
  mockStorage.setItem("lilycrest_auth_failed_attempts", "5");

  // 6th attempt: 120s lockout
  const state6 = recordFailedLoginAttempt("user@example.com");
  assert.equal(state6.isLockedOut, true);
  assert.equal(state6.attempts, 6);
  assert.equal(state6.remainingSeconds, 120);

  // 7th attempt: 300s lockout
  const state7 = recordFailedLoginAttempt("user@example.com");
  assert.equal(state7.isLockedOut, true);
  assert.equal(state7.attempts, 7);
  assert.equal(state7.remainingSeconds, 300);

  // 8th attempt: 900s lockout
  const state8 = recordFailedLoginAttempt("user@example.com");
  assert.equal(state8.isLockedOut, true);
  assert.equal(state8.attempts, 8);
  assert.equal(state8.remainingSeconds, 900);
});

test("resetLockoutState clears all stored lockout data on successful login", () => {
  mockStorage.clear();
  recordFailedLoginAttempt("user@example.com");
  recordFailedLoginAttempt("user@example.com");
  recordFailedLoginAttempt("user@example.com");
  recordFailedLoginAttempt("user@example.com");
  recordFailedLoginAttempt("user@example.com");

  assert.equal(getLockoutState().isLockedOut, true);

  resetLockoutState("user@example.com");

  const state = getLockoutState("user@example.com");
  assert.equal(state.isLockedOut, false);
  assert.equal(state.attempts, 0);
  assert.equal(state.remainingSeconds, 0);
});

test("resend cooldown management accurately persists and purges timestamps", () => {
  mockStorage.clear();

  assert.equal(getResendCooldown("otp_resend"), 0);

  setResendCooldown("otp_resend", 45);
  const remaining = getResendCooldown("otp_resend");
  assert.ok(remaining >= 44 && remaining <= 45);

  // Clearing cooldown resets immediately
  clearResendCooldown("otp_resend");
  assert.equal(getResendCooldown("otp_resend"), 0);

  // Expired cooldowns auto-cleanup
  mockStorage.setItem("lilycrest_cooldown_expired_key", String(Date.now() - 5000));
  assert.equal(getResendCooldown("expired_key"), 0);
  assert.equal(mockStorage.getItem("lilycrest_cooldown_expired_key"), null);
});

test("setManualLockout allows server-driven retryAfter enforcement", () => {
  mockStorage.clear();
  const state = setManualLockout(30, "user@example.com");
  assert.equal(state.isLockedOut, true);
  assert.equal(state.remainingSeconds, 30);
  assert.ok(state.lockoutUntil > Date.now());

  const readState = getLockoutState("user@example.com");
  assert.equal(readState.isLockedOut, true);
  assert.ok(readState.remainingSeconds >= 29 && readState.remainingSeconds <= 30);
});

test("subscribeToAuthStorage triggers callback on relevant storage events", () => {
  let receivedEvent = null;
  const unsubscribe = subscribeToAuthStorage((e) => {
    receivedEvent = e;
  });

  // Trigger relevant storage event
  listeners.forEach((fn) =>
    fn({ key: "lilycrest_auth_lockout_until", newValue: "12345" })
  );
  assert.ok(receivedEvent);
  assert.equal(receivedEvent.key, "lilycrest_auth_lockout_until");

  // Unrelated event is ignored
  receivedEvent = null;
  listeners.forEach((fn) => fn({ key: "other_random_key", newValue: "abc" }));
  assert.equal(receivedEvent, null);

  unsubscribe();
});
