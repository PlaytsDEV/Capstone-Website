/**
 * =============================================================================
 * AUTH LOCKOUT & COOLDOWN MANAGEMENT UTILITY
 * =============================================================================
 *
 * Provides centralized, timestamp-persisted lockout and cooldown tracking:
 * - Persists target expiration timestamps in localStorage (survives F5 refreshes).
 * - Enforces exponential backoff on repeated failed login attempts:
 *     5 failures  -> 60 seconds
 *     6 failures  -> 120 seconds
 *     7 failures  -> 300 seconds (5 minutes)
 *     8+ failures -> 900 seconds (15 minutes)
 * - Manages resend cooldowns across OTP, email verification, and password reset.
 * - Supports real-time multi-tab synchronization via window 'storage' events.
 * - Automatically purges expired timestamps on read.
 */

const STORAGE_KEYS = {
  LOCKOUT_UNTIL: "lilycrest_auth_lockout_until",
  FAILED_ATTEMPTS: "lilycrest_auth_failed_attempts",
  LOCKOUT_IDENTITY: "lilycrest_auth_lockout_identity",
  COOLDOWN_PREFIX: "lilycrest_cooldown_",
};

/**
 * Calculates lockout duration in seconds based on failed login attempt count.
 *
 * @param {number} failedAttempts - Number of consecutive failed attempts
 * @returns {number} Cooldown duration in seconds (0 if < 5)
 */
export const calculateLockoutDurationSeconds = (failedAttempts) => {
  const count = Number(failedAttempts) || 0;
  if (count < 5) return 0;
  if (count === 5) return 60; // 1 minute
  if (count === 6) return 120; // 2 minutes
  if (count === 7) return 300; // 5 minutes
  return 900; // 15 minutes for 8 or more attempts
};

/**
 * Normalizes an identity string (e.g. email or username) for storage keys.
 *
 * @param {string} identity - Target user email or username
 * @returns {string} Normalized lowercased identity
 */
export const normalizeLockoutIdentity = (identity) =>
  String(identity || "").trim().toLowerCase();

/**
 * Safe wrapper for reading from localStorage.
 */
const safeGetStorage = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Safe wrapper for writing to localStorage.
 */
const safeSetStorage = (key, value) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage access might fail in private browsing quota limits; ignore gracefully
  }
};

/**
 * Safe wrapper for removing from localStorage.
 */
const safeRemoveStorage = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal errors
  }
};

/**
 * Retrieves the current authentication lockout state.
 *
 * @param {string} [identity] - Optional user email/username for identity check
 * @returns {{ isLockedOut: boolean, remainingSeconds: number, attempts: number, lockoutUntil: number | null }}
 */
export const getLockoutState = (identity = "") => {
  const attemptsRaw = safeGetStorage(STORAGE_KEYS.FAILED_ATTEMPTS);
  const lockoutUntilRaw = safeGetStorage(STORAGE_KEYS.LOCKOUT_UNTIL);
  const attempts = Math.max(0, parseInt(attemptsRaw, 10) || 0);

  if (!lockoutUntilRaw) {
    return {
      isLockedOut: false,
      remainingSeconds: 0,
      attempts,
      lockoutUntil: null,
    };
  }

  const lockoutUntil = parseInt(lockoutUntilRaw, 10);
  if (Number.isNaN(lockoutUntil)) {
    safeRemoveStorage(STORAGE_KEYS.LOCKOUT_UNTIL);
    return {
      isLockedOut: false,
      remainingSeconds: 0,
      attempts,
      lockoutUntil: null,
    };
  }

  const now = Date.now();
  const diffMs = lockoutUntil - now;
  const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));

  if (remainingSeconds > 0) {
    return {
      isLockedOut: true,
      remainingSeconds,
      attempts,
      lockoutUntil,
    };
  }

  // Lockout has expired — clean up expired lockout timer
  safeRemoveStorage(STORAGE_KEYS.LOCKOUT_UNTIL);
  return {
    isLockedOut: false,
    remainingSeconds: 0,
    attempts,
    lockoutUntil: null,
  };
};

/**
 * Records a failed login attempt and calculates/persists exponential backoff lockout.
 *
 * @param {string} [identity] - User email or username associated with the failed attempt
 * @returns {{ isLockedOut: boolean, remainingSeconds: number, attempts: number, lockoutUntil: number | null }}
 */
export const recordFailedLoginAttempt = (identity = "") => {
  const currentAttempts = Math.max(0, parseInt(safeGetStorage(STORAGE_KEYS.FAILED_ATTEMPTS), 10) || 0);
  const nextAttempts = currentAttempts + 1;
  safeSetStorage(STORAGE_KEYS.FAILED_ATTEMPTS, nextAttempts);

  if (identity) {
    safeSetStorage(STORAGE_KEYS.LOCKOUT_IDENTITY, normalizeLockoutIdentity(identity));
  }

  const durationSeconds = calculateLockoutDurationSeconds(nextAttempts);

  if (durationSeconds > 0) {
    const lockoutUntil = Date.now() + durationSeconds * 1000;
    safeSetStorage(STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil);
    return {
      isLockedOut: true,
      remainingSeconds: durationSeconds,
      attempts: nextAttempts,
      lockoutUntil,
    };
  }

  return {
    isLockedOut: false,
    remainingSeconds: 0,
    attempts: nextAttempts,
    lockoutUntil: null,
  };
};

/**
 * Manually sets a lockout period (e.g. from a backend HTTP 429 response or server retryAfter).
 *
 * @param {number} durationSeconds - Lockout duration in seconds
 * @param {string} [identity] - User email or username
 * @returns {{ isLockedOut: boolean, remainingSeconds: number, lockoutUntil: number }}
 */
export const setManualLockout = (durationSeconds, identity = "") => {
  const secs = Math.max(0, Number(durationSeconds) || 0);
  if (secs <= 0) return getLockoutState(identity);

  const lockoutUntil = Date.now() + secs * 1000;
  safeSetStorage(STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil);

  const currentAttempts = Math.max(0, parseInt(safeGetStorage(STORAGE_KEYS.FAILED_ATTEMPTS), 10) || 0);
  if (currentAttempts < 5) {
    safeSetStorage(STORAGE_KEYS.FAILED_ATTEMPTS, 5);
  }

  if (identity) {
    safeSetStorage(STORAGE_KEYS.LOCKOUT_IDENTITY, normalizeLockoutIdentity(identity));
  }

  return {
    isLockedOut: true,
    remainingSeconds: secs,
    attempts: Math.max(5, currentAttempts),
    lockoutUntil,
  };
};

/**
 * Clears all authentication lockout and attempt tracking upon successful authentication.
 *
 * @param {string} [identity] - Optional user email/username
 */
export const resetLockoutState = (identity = "") => {
  safeRemoveStorage(STORAGE_KEYS.LOCKOUT_UNTIL);
  safeRemoveStorage(STORAGE_KEYS.FAILED_ATTEMPTS);
  safeRemoveStorage(STORAGE_KEYS.LOCKOUT_IDENTITY);
};

/**
 * Persists an absolute expiration timestamp for a specific action resend cooldown.
 *
 * @param {string} cooldownType - Key identifier (e.g. 'otp_resend', 'email_verification', 'pw_reset_<email>')
 * @param {number} durationSeconds - Number of seconds to enforce cooldown
 * @returns {number} Expiration timestamp in milliseconds
 */
export const setResendCooldown = (cooldownType, durationSeconds) => {
  const key = `${STORAGE_KEYS.COOLDOWN_PREFIX}${cooldownType}`;
  const secs = Math.max(0, Number(durationSeconds) || 0);

  if (secs <= 0) {
    safeRemoveStorage(key);
    return 0;
  }

  const expiresAt = Date.now() + secs * 1000;
  safeSetStorage(key, expiresAt);
  return expiresAt;
};

/**
 * Retrieves the remaining cooldown seconds for a given action.
 *
 * @param {string} cooldownType - Key identifier (e.g. 'otp_resend', 'email_verification', 'pw_reset_<email>')
 * @returns {number} Remaining seconds (0 if expired or not set)
 */
export const getResendCooldown = (cooldownType) => {
  const key = `${STORAGE_KEYS.COOLDOWN_PREFIX}${cooldownType}`;
  const raw = safeGetStorage(key);

  if (!raw) return 0;

  const expiresAt = parseInt(raw, 10);
  if (Number.isNaN(expiresAt)) {
    safeRemoveStorage(key);
    return 0;
  }

  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  if (remaining > 0) {
    return remaining;
  }

  // Cooldown expired; clean up
  safeRemoveStorage(key);
  return 0;
};

/**
 * Clears an active resend cooldown.
 *
 * @param {string} cooldownType - Key identifier
 */
export const clearResendCooldown = (cooldownType) => {
  const key = `${STORAGE_KEYS.COOLDOWN_PREFIX}${cooldownType}`;
  safeRemoveStorage(key);
};

/**
 * Subscribes to storage events across tabs to synchronize lockout and cooldown state in real time.
 *
 * @param {Function} callback - Invoked when an auth storage key changes
 * @returns {Function} Unsubscribe function
 */
export const subscribeToAuthStorage = (callback) => {
  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {};
  }

  const handler = (event) => {
    if (!event.key) return;
    if (
      event.key === STORAGE_KEYS.LOCKOUT_UNTIL ||
      event.key === STORAGE_KEYS.FAILED_ATTEMPTS ||
      event.key.startsWith(STORAGE_KEYS.COOLDOWN_PREFIX)
    ) {
      callback(event);
    }
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
};
