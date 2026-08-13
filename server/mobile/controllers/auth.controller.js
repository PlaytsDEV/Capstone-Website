const axios = require('axios');
const crypto = require('crypto');
const { getDb } = require('../config/database');
const { verifyFirebaseIdToken, verifyTenantInFirebase, admin } = require('../config/firebase');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emailService');
const { invalidateUserSessionsCore } = require('../../security/sessionInvalidationCore.cjs');
const { createSession } = require('../security/mobileSession');
const authTestDependencies = {
  getDb,
  sendLoginOtpEmail: (...args) => require('../services/emailService').sendLoginOtpEmail(...args),
  createSession,
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

function firebaseApiKey() {
  return process.env.FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || null;
}

function passwordResetBaseUrl() {
  const configured = String(process.env.PUBLIC_API_URL || process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!isProduction) return configured || 'http://localhost:8001';
  let parsed;
  try {
    parsed = new URL(configured);
  } catch (_) {
    throw new Error('PUBLIC_API_URL must be configured for production password reset links');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.origin !== 'https://api.lilycrest.space' ||
    parsed.pathname !== '/' ||
    parsed.username || parsed.password || parsed.search || parsed.hash
  ) {
    throw new Error('PUBLIC_API_URL must be https://api.lilycrest.space in production');
  }
  return parsed.origin;
}

function generateUserId() {
  return `user_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
}

const PASSWORD_LOCK_THRESHOLD = 3;
const PASSWORD_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function maskEmail(email = '') {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  return user.length <= 2 ? `${user[0]}***@${domain}` : `${user.slice(0, 2)}***@${domain}`;
}

function shortFingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

/** Case-insensitive regex for exact email match */
function emailRegex(email) {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Non-blocking audit log */
async function logAttempt(db, email, success, reason, req) {
  try {
    await db.collection('login_attempts').insertOne({
      email_hash: crypto.createHmac('sha256', otpSecret()).update(String(email || '').trim().toLowerCase()).digest('hex'),
      success,
      reason,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
    });
  } catch (_) {
    /* audit failure is non-critical */
  }
}

/** Look up a non-admin tenant by email */
async function findTenantByEmail(db, email) {
  return db.collection('users').findOne({
    $or: [
      { email: emailRegex(email) },
      { google_email: emailRegex(email) },
    ],
    role: { $nin: ['admin', 'owner', 'branch_admin'] },
  });
}

function getActivePasswordLockUntil(user) {
  if (!user?.login_lock_until) return null;
  const lockUntil = new Date(user.login_lock_until);
  if (Number.isNaN(lockUntil.getTime())) return null;
  if (lockUntil <= new Date()) return null;
  return lockUntil;
}

function buildPasswordLockMessage(lockUntil) {
  const remainingMs = lockUntil.getTime() - Date.now();
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Account temporarily locked after ${PASSWORD_LOCK_THRESHOLD} failed password attempts. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`;
}

async function clearPasswordLock(db, userId) {
  if (!userId) return;
  await db.collection('users').updateOne(
    { user_id: userId },
    {
      $set: { failed_login_attempts: 0 },
      $unset: { login_lock_until: '' },
    },
  );
}

async function registerFailedPasswordAttempt(db, user) {
  if (!user?.user_id) {
    return { locked: false, remainingAttempts: PASSWORD_LOCK_THRESHOLD };
  }

  const currentAttempts = Number.isFinite(user.failed_login_attempts)
    ? Math.max(0, Number(user.failed_login_attempts))
    : 0;
  const nextAttempts = currentAttempts + 1;

  if (nextAttempts >= PASSWORD_LOCK_THRESHOLD) {
    const lockUntil = new Date(Date.now() + PASSWORD_LOCK_DURATION_MS);
    await db.collection('users').updateOne(
      { user_id: user.user_id },
      { $set: { failed_login_attempts: 0, login_lock_until: lockUntil } },
    );
    return { locked: true, lockUntil, remainingAttempts: 0 };
  }

  await db.collection('users').updateOne(
    { user_id: user.user_id },
    {
      $set: { failed_login_attempts: nextAttempts },
      $unset: { login_lock_until: '' },
    },
  );

  return {
    locked: false,
    remainingAttempts: Math.max(0, PASSWORD_LOCK_THRESHOLD - nextAttempts),
  };
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function authenticationFailed(res) {
  return res.status(401).json({
    detail: 'Authentication failed. If you believe this account should be available, contact the administrator.',
    code: 'AUTHENTICATION_FAILED',
  });
}

async function invalidateMobileIdentity(db, user, reason, req) {
  return invalidateUserSessionsCore({
    db, adminAuth: admin.auth(), userId: user?.user_id, mongoId: user?._id,
    firebaseUid: user?.firebase_uid || user?.firebaseUid, reason, failClosed: true,
    audit: async ({ failures }) => db.collection('login_attempts').insertOne({
      user_id: user?.user_id || null, success: false, reason: `sessions_invalidated:${reason}`,
      failed_stores: failures, ip: req.ip || 'unknown', timestamp: new Date(),
    }).catch(() => {}),
  });
}

const OTP_MAX_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
let otpIndexPromise;
function ensureOtpIndexes(db) {
  otpIndexPromise ||= db.collection('otp_store').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  return otpIndexPromise;
}
function otpSecret() {
  if (process.env.MOBILE_OTP_SECRET) return process.env.MOBILE_OTP_SECRET;
  if (isProduction) throw new Error('MOBILE_OTP_SECRET is required in production');
  return process.env.JWT_SECRET || 'development-only-mobile-otp-secret';
}
function hashOtp(code) {
  return crypto.createHmac('sha256', otpSecret()).update(String(code)).digest('hex');
}
function otpMatches(storedHash, code) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(hashOtp(code), 'hex'));
}

function normalizeOtpCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

function parseDateSafe(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOtpAttempts(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Normalize camelCase admin-panel fields to the snake_case the app expects */
function normalizeUser(doc) {
  if (!doc) return doc;
  const u = { ...doc };

  const applicant = (u.applicantDetails && typeof u.applicantDetails === 'object')
    ? u.applicantDetails
    : ((u.applicant_details && typeof u.applicant_details === 'object') ? u.applicant_details : {});

  const applicantFirstName = firstNonEmptyString(
    applicant.firstName,
    applicant.first_name,
    u.firstName,
    u.first_name,
  );
  const applicantLastName = firstNonEmptyString(
    applicant.lastName,
    applicant.last_name,
    u.lastName,
    u.last_name,
  );

  if (!u.firstName && applicantFirstName) u.firstName = applicantFirstName;
  if (!u.lastName && applicantLastName) u.lastName = applicantLastName;

  if (!u.name) {
    const applicantFullName = [applicantFirstName, applicantLastName].filter(Boolean).join(' ').trim();
    if (applicantFullName) {
      u.name = applicantFullName;
    } else if (u.fullName) {
      u.name = u.fullName;
    }
  }

  if (!u.email && u.emailAddress) u.email = u.emailAddress;
  if (!u.phone && (u.contactNumber || u.phoneNumber)) u.phone = u.contactNumber || u.phoneNumber;
  if (!u.address) {
    u.address = firstNonEmptyString(
      applicant.address,
      applicant.homeAddress,
      applicant.home_address,
      applicant.currentAddress,
      applicant.current_address,
      u.homeAddress,
      u.home_address,
    );
  }
  if (!u.username && u.email) u.username = u.email.split('@')[0];
  return u;
}

/** Return user object without MongoDB _id */
async function getCleanUser(db, userId) {
  const doc = await db.collection('users').findOne(
    { user_id: userId },
    { projection: { _id: 0 } },
  );
  return normalizeUser(doc);
}

// ─── EMAIL / PASSWORD LOGIN ─────────────────────────────────────────────────

async function login(req, res) {
  const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  // Input validation
  if (!emailRaw || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 254) {
    return res.status(400).json({ detail: 'Please provide a valid email address' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ detail: 'Password must be 6 to 128 characters long' });
  }

  const apiKey = firebaseApiKey();
  if (!apiKey) {
    return res.status(500).json({ detail: 'Firebase API key not configured on backend' });
  }

  const db = getDb();
  const tenantByEmail = await findTenantByEmail(db, emailRaw);
  const activeLockUntil = getActivePasswordLockUntil(tenantByEmail);
  if (activeLockUntil) {
    logAttempt(db, emailRaw, false, 'password_locked', req);
    return res.status(429).json({ detail: buildPasswordLockMessage(activeLockUntil) });
  }
  if (tenantByEmail?.user_id && tenantByEmail?.login_lock_until) {
    await clearPasswordLock(db, tenantByEmail.user_id);
  }

  let fbUid;

  // Step 1: Authenticate with Firebase
  try {
    const resp = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      { email: emailRaw, password, returnSecureToken: true },
    );
    fbUid = resp.data.localId;
  } catch (fbErr) {
    const msg = fbErr.response?.data?.error?.message || '';

    if (msg.includes('EMAIL_NOT_FOUND')) {
      await logAttempt(db, emailRaw, false, tenantByEmail ? 'firebase_identity_missing' : 'authentication_failed', req);
      return authenticationFailed(res);
    } else if (msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
      // Check MongoDB before responding — if the account is inactive or not a tenant,
      // return the correct 403 instead of a generic 401.
      // This also covers Google-only accounts attempting email/password login.
      const mongoUser = tenantByEmail || await findTenantByEmail(db, emailRaw);
      if (!mongoUser) {
        // Has a Firebase account but is not in our system as a tenant
        logAttempt(db, emailRaw, false, 'not_tenant', req);
        return authenticationFailed(res);
      }
      if (mongoUser.is_active === false) {
        logAttempt(db, emailRaw, false, 'inactive', req);
        return authenticationFailed(res);
      }
      // User is an active tenant but the password is genuinely wrong
      const lockState = await registerFailedPasswordAttempt(db, mongoUser);
      if (lockState.locked) {
        logAttempt(db, emailRaw, false, 'password_locked', req);
        return res.status(429).json({ detail: buildPasswordLockMessage(lockState.lockUntil) });
      }
      logAttempt(db, emailRaw, false, 'invalid_password', req);
      return authenticationFailed(res);
    } else if (msg.includes('USER_DISABLED')) {
      logAttempt(db, emailRaw, false, 'user_disabled', req);
      return authenticationFailed(res);
    } else if (msg.includes('TOO_MANY_ATTEMPTS')) {
      logAttempt(db, emailRaw, false, 'too_many_attempts', req);
      return res.status(429).json({ detail: 'Too many failed attempts. Please try again later.' });
    } else {
      logAttempt(db, emailRaw, false, 'firebase_error', req);
      return authenticationFailed(res);
    }
  }

  // Step 2: Find MongoDB tenant by exact email (NOT google_email — that's for Google sign-in only)
  const tenant = await db.collection('users').findOne({
    email: emailRegex(emailRaw),
    role: { $nin: ['admin', 'owner', 'branch_admin'] },
  });
  if (!tenant) {
    logAttempt(db, emailRaw, false, 'not_tenant', req);
    return authenticationFailed(res);
  }

  if (!tenant.user_id) {
    console.error('[Login] Tenant document missing user_id', {
      record_fingerprint: shortFingerprint(tenant._id),
    });
    return res.status(500).json({ detail: 'Account configuration error. Please contact the admin office.' });
  }

  if (tenant.is_active === false) {
    logAttempt(db, emailRaw, false, 'inactive', req);
    return authenticationFailed(res);
  }

  console.log('[Login] Tenant found', { user_fingerprint: shortFingerprint(tenant.user_id) });

  if (tenant.failed_login_attempts || tenant.login_lock_until) {
    await clearPasswordLock(db, tenant.user_id);
  }

  // Login authenticates an existing identity; it never repairs identity links.
  const uidOwner = await db.collection('users').findOne({
    $or: [{ firebase_uid: fbUid }, { firebaseUid: fbUid }],
  });
  const tenantUid = tenant.firebase_uid || tenant.firebaseUid;
  if (!tenantUid || tenantUid !== fbUid || (uidOwner && uidOwner.user_id !== tenant.user_id)) {
    await logAttempt(db, emailRaw, false, 'firebase_uid_conflict', req);
    if (tenant) await invalidateMobileIdentity(db, tenant, 'identity_conflict', req);
    return res.status(401).json({ detail: 'Authentication failed. Please contact the administrator if the problem continues.', code: 'AUTHENTICATION_FAILED' });
  }
  await db.collection('users').updateOne(
    { user_id: tenant.user_id },
    { $set: { last_login: new Date() } },
  );

  // Step 4: Biometric login bypasses OTP — biometric IS the second factor
  if (req.body.biometric_login === true) {
    const session = await createSession(db, tenant.user_id);
    res.cookie('session_token', session.session_token, cookieOptions());
    const userData = await getCleanUser(db, tenant.user_id);
    logAttempt(db, emailRaw, true, 'biometric_success', req);
    console.log('[Login] Biometric login accepted', {
      user_fingerprint: shortFingerprint(tenant.user_id),
      success: true,
    });
    return res.json({ user: userData, session_token: session.session_token });
  }

  // Step 5: Password login — generate OTP and send to email
  const otpCode = generateOtpCode();
  const otpToken = crypto.randomUUID();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const securityVersion = Number(tenant.securityVersion ?? tenant.security_version ?? 0);

  const challenge = {
    otp_token: otpToken,
    otp_hash: hashOtp(otpCode),
    user_id: tenant.user_id,
    email: emailRaw,
    attempts: 0,
    expires_at: otpExpiry,
    created_at: new Date(),
    security_version: securityVersion,
    last_sent_at: new Date(),
    consumed_at: null,
  };
  await ensureOtpIndexes(db);

  const { sendLoginOtpEmail } = require('../services/emailService');
  const emailSent = await sendLoginOtpEmail(emailRaw, tenant.name || 'Tenant', otpCode);
  if (!emailSent) return res.status(503).json({
    detail: 'We could not send the verification code. Please try again later.',
    code: 'OTP_EMAIL_SEND_FAILED',
  });
  await db.collection('otp_store').deleteMany({ user_id: tenant.user_id });
  await db.collection('otp_store').insertOne(challenge);

  logAttempt(db, emailRaw, true, 'otp_sent', req);
  console.log('[Login] OTP delivery accepted', {
    user_fingerprint: shortFingerprint(tenant.user_id),
    email_fingerprint: shortFingerprint(emailRaw.trim().toLowerCase()),
    success: true,
  });
  res.json({
    otp_required: true,
    otp_token: otpToken,
    masked_email: maskEmail(emailRaw),
  });
}

// ─── VERIFY LOGIN OTP ───────────────────────────────────────────────────────

async function verifyOtp(req, res) {
  const normalizedToken = typeof req.body?.otp_token === 'string' ? req.body.otp_token.trim() : '';
  const normalizedCode = normalizeOtpCode(req.body?.otp_code);

  if (!normalizedToken || !normalizedCode) {
    return res.status(400).json({ detail: 'Verification token and code are required.' });
  }
  if (normalizedCode.length !== 6) {
    return res.status(400).json({ detail: 'Please enter the complete 6-digit code.' });
  }

  const db = authTestDependencies.getDb();
  const record = await db.collection('otp_store').findOne({ otp_token: normalizedToken });

  if (!record) {
    return res.status(400).json({ detail: 'Invalid or expired session. Please log in again.' });
  }

  const expiry = parseDateSafe(record.expires_at);
  if (!expiry || new Date() > expiry) {
    await db.collection('otp_store').deleteOne({ otp_token: normalizedToken });
    return res.status(400).json({ detail: 'Verification code has expired. Please log in again.' });
  }

  const attempts = parseOtpAttempts(record.attempts);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await db.collection('otp_store').deleteOne({ otp_token: normalizedToken });
    return res.status(400).json({ detail: 'Too many incorrect attempts. Please log in again.' });
  }

  if (!otpMatches(record.otp_hash, normalizedCode)) {
    await db.collection('otp_store').updateOne({ otp_token: normalizedToken }, { $inc: { attempts: 1 } });
    const remaining = OTP_MAX_ATTEMPTS - (attempts + 1);
    const detail = remaining > 0
      ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      : 'Too many incorrect attempts. Please log in again.';
    if (remaining <= 0) await db.collection('otp_store').deleteOne({ otp_token: normalizedToken });
    return res.status(400).json({ detail, attempts_remaining: remaining });
  }

  // Valid — delete OTP and create session
  const consumed = await db.collection('otp_store').findOneAndDelete({
    otp_token: normalizedToken, otp_hash: record.otp_hash,
    attempts: { $lt: OTP_MAX_ATTEMPTS }, expires_at: { $gt: new Date() }, consumed_at: null,
  });
  const consumedRecord = consumed?.value || consumed;
  if (!consumedRecord) return res.status(400).json({ detail: 'Invalid or expired session. Please log in again.' });

  const session = await authTestDependencies.createSession(db, record.user_id);
  res.cookie('session_token', session.session_token, cookieOptions());

  const user = await getCleanUser(db, record.user_id);
  logAttempt(db, record.email, true, 'success', req);
  console.log('[VerifyOtp] OTP consumed', {
    user_fingerprint: shortFingerprint(record.user_id),
    success: true,
  });
  res.json({ user, session_token: session.session_token });
}

// ─── RESEND LOGIN OTP ───────────────────────────────────────────────────────

async function resendOtp(req, res) {
  const normalizedToken = typeof req.body?.otp_token === 'string' ? req.body.otp_token.trim() : '';

  if (!normalizedToken) {
    return res.status(400).json({ detail: 'OTP token is required.' });
  }

  const db = authTestDependencies.getDb();
  const reservationId = crypto.randomUUID();
  const cutoff = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS);
  const reservedResult = await db.collection('otp_store').findOneAndUpdate(
    { otp_token: normalizedToken, expires_at: { $gt: new Date() }, last_sent_at: { $lte: cutoff }, $or: [{ resend_reserved_at: { $exists: false } }, { resend_reserved_at: { $lte: cutoff } }] },
    { $set: { resend_reserved_at: new Date(), resend_reservation_id: reservationId } },
    { returnDocument: 'before' },
  );
  const record = reservedResult?.value || reservedResult;
  if (!record) return res.status(429).json({ detail: 'Please wait before requesting another code.', code: 'OTP_RESEND_COOLDOWN' });

  const newCode = generateOtpCode();
  const newExpiry = new Date(Date.now() + 10 * 60 * 1000);

  const sent = await authTestDependencies.sendLoginOtpEmail(record.email, 'Tenant', newCode);
  if (!sent) {
    await db.collection('otp_store').updateOne(
      { otp_token: normalizedToken, resend_reservation_id: reservationId },
      { $unset: { resend_reserved_at: '', resend_reservation_id: '' } },
    );
    return res.status(503).json({
      detail: 'We could not send the verification code. Please try again later.',
      code: 'OTP_EMAIL_SEND_FAILED',
    });
  }

  await db.collection('otp_store').updateOne(
    { otp_token: normalizedToken, resend_reservation_id: reservationId },
    { $set: { otp_hash: hashOtp(newCode), attempts: 0, expires_at: newExpiry, last_sent_at: new Date() }, $unset: { otp_code: '', resend_reserved_at: '', resend_reservation_id: '' } },
  );

  console.log('[ResendOtp] OTP delivery accepted', {
    user_fingerprint: shortFingerprint(record.user_id),
    success: true,
  });
  res.json({ message: 'A new verification code has been sent to your email.' });
}

// ─── GOOGLE SIGN-IN ─────────────────────────────────────────────────────────

async function googleSignIn(req, res) {
  // Stage timing — diagnostic only, no tokens/PII. Added to correlate
  // intermittent client-observed timeouts against backend-side stage
  // durations (see Phase 5.7 investigation notes).
  const stageStart = process.hrtime.bigint();
  const stageLog = { start: 0 };
  const markStage = (name) => {
    stageLog[name] = Number(process.hrtime.bigint() - stageStart) / 1e6;
  };

  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ detail: 'Firebase ID token is required' });
    }

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch {
      return res.status(401).json({ detail: 'Invalid Firebase ID token' });
    }
    markStage('firebase_verify_ms');

    const { email, uid: fbUid } = decoded;
    if (!email) {
      return res.status(400).json({ detail: 'No email associated with this Google account' });
    }

    const db = getDb();
    console.log('[GoogleSignIn] Login attempt', { email_fingerprint: shortFingerprint(email) });

    // Lookup — ordered by precision to avoid cross-user contamination
    // 1. Exact email match (most reliable)
    let tenant = await db.collection('users').findOne({
      email: emailRegex(email),
      role: { $nin: ['admin', 'owner', 'branch_admin'] },
    });
    if (tenant) {
      console.log('[GoogleSignIn] Found by email', { user_fingerprint: shortFingerprint(tenant.user_id) });
    }

    // 2. google_email match (secondary)
    if (!tenant) {
      tenant = await db.collection('users').findOne({
        google_email: emailRegex(email),
        role: { $nin: ['admin', 'owner', 'branch_admin'] },
      });
      if (tenant) console.log('[GoogleSignIn] Found by linked email', { user_fingerprint: shortFingerprint(tenant.user_id) });
    }

    // 3. firebase_uid match (last resort)
    if (!tenant) {
      tenant = await db.collection('users').findOne({
        firebase_uid: fbUid,
        role: { $nin: ['admin', 'owner', 'branch_admin'] },
      });
      if (tenant) console.log('[GoogleSignIn] Found by Firebase identity', { user_fingerprint: shortFingerprint(tenant.user_id) });
    }

    markStage('mongo_user_lookup_ms');

    // Not found → not a registered tenant
    if (!tenant) {
      console.log('[GoogleSignIn] Tenant lookup failed', { email_fingerprint: shortFingerprint(email) });
      return authenticationFailed(res);
    }

    if (tenant.is_active === false) {
      return authenticationFailed(res);
    }

    if (!tenant.user_id) {
      console.error('[GoogleSignIn] Tenant document missing user_id', {
        record_fingerprint: shortFingerprint(tenant._id),
      });
      return res.status(500).json({ detail: 'Account configuration error. Please contact the admin office.' });
    }

    const uidOwner = await db.collection('users').findOne({ $or: [{ firebase_uid: fbUid }, { firebaseUid: fbUid }] });
    const tenantUid = tenant.firebase_uid || tenant.firebaseUid;
    if (!tenantUid || tenantUid !== fbUid || (uidOwner && uidOwner.user_id !== tenant.user_id)) {
      await logAttempt(db, email, false, 'firebase_uid_conflict', req);
      await invalidateMobileIdentity(db, tenant, 'identity_conflict', req);
      return res.status(401).json({ detail: 'Authentication failed. Please contact the administrator if the problem continues.', code: 'AUTHENTICATION_FAILED' });
    }
    markStage('identity_conflict_check_ms');

    // Build update — only set email if it won't conflict with another user
    const updateFields = {
      google_email: email,
      name: decoded.name || tenant.name || email.split('@')[0],
      picture: decoded.picture || tenant.picture || null,
      last_login: new Date(),
    };

    // Only update email if this tenant already owns it (was found by email match)
    const tenantEmail = (tenant.email || '').toLowerCase();
    if (tenantEmail === email.toLowerCase()) {
      updateFields.email = email;
    }

    try {
      await db.collection('users').updateOne(
        { user_id: tenant.user_id },
        { $set: updateFields },
      );
    } catch (updateErr) {
      if (updateErr.code === 11000) {
        // Duplicate key — strip conflicting fields and retry
        console.warn('[GoogleSignIn] Duplicate key, retrying without email/firebase_uid');
        delete updateFields.email;
        delete updateFields.firebase_uid;
        await db.collection('users').updateOne(
          { user_id: tenant.user_id },
          { $set: updateFields },
        );
      } else {
        throw updateErr;
      }
    }
    markStage('user_update_ms');

    // Idempotency guard: if this exact user already has a session minted in
    // the last few seconds, reuse it instead of unconditionally rotating.
    // This exists so that a client-side connection-timeout retry (the
    // mobile client retries this endpoint once on a connect failure — see
    // AuthContext.signInWithGoogle) can never invalidate a session whose
    // success response the client simply never received, or race-create a
    // second one. Outside this narrow window, behavior is unchanged: a
    // fresh login always rotates the session as before.
    const RECENT_SESSION_WINDOW_MS = 10_000;
    const recentSession = await db.collection('user_sessions').findOne(
      { user_id: tenant.user_id, created_at: { $gt: new Date(Date.now() - RECENT_SESSION_WINDOW_MS) } },
      { sort: { created_at: -1 } },
    );
    const session = recentSession
      ? { session_token: recentSession.session_token, expires_at: recentSession.expires_at }
      : await createSession(db, tenant.user_id);
    res.cookie('session_token', session.session_token, cookieOptions());
    markStage('session_create_ms');

    // Build the response user from the already-fetched `tenant` doc plus the
    // exact fields we just wrote, instead of a redundant findOne — we know
    // precisely what changed, so there is nothing a fresh fetch would add.
    const { _id, ...tenantWithoutId } = tenant;
    const user = normalizeUser({ ...tenantWithoutId, ...updateFields });
    markStage('response_ready_ms');

    console.log('[GoogleSignIn] Success', {
      user_fingerprint: shortFingerprint(tenant.user_id),
      success: true,
    });
    console.log('mobile_google_auth_stage', stageLog);
    res.json({ user, session_token: session.session_token });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ detail: 'Authentication service error' });
  }
}

// ─── REGISTER ───────────────────────────────────────────────────────────────

async function register(req, res) {
  return res.status(410).json({
    detail: 'Mobile registration is temporarily unavailable. Please use the web applicant registration flow.',
    code: 'MOBILE_REGISTRATION_DISABLED',
  });
}

// ─── GET CURRENT USER ───────────────────────────────────────────────────────

async function getMe(req, res) {
  const normalizedUser = normalizeUser(req.user);
  const { _id, ...user } = normalizedUser;
  res.json(user);
}

// ─── LOGOUT ─────────────────────────────────────────────────────────────────

async function logout(req, res) {
  try {
    const db = getDb();
    await db.collection('user_sessions').deleteMany({ user_id: req.user.user_id });
    res.clearCookie('session_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ detail: 'Logout failed' });
  }
}

// ─── CHANGE PASSWORD ────────────────────────────────────────────────────────

// Common weak passwords to reject (top offenders)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty123', 'abc12345', 'iloveyou', 'sunshine',
  'princess', 'football', 'charlie', 'access14', 'trustno1',
  'letmein1', 'baseball', 'dragon12', 'master12', 'monkey12',
  'lilycrest', 'lilycrest1', 'lilycrest123', 'dormitory', 'tenant123',
]);

function validateNewPassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return ['New password is required'];
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (password.length > 128) {
    errors.push('Password must be 128 characters or fewer');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(password)) {
    errors.push('Password must contain at least one special character (e.g. !@#$%^&*)');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger one');
  }

  return errors;
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password, notify_email, notify_app } = req.body;
    const userEmail = req.user.email;
    const userId = req.user.user_id;
    const userName = req.user.name || 'Tenant';
    const requestIp = req.ip || req.headers['x-forwarded-for'] || 'Unknown';

    // ── Input validation ──────────────────────────────────────────────────
    if (!current_password || !new_password) {
      return res.status(400).json({ detail: 'Current password and new password are required' });
    }

    // Server-side complexity checks (mirrors frontend rules)
    const validationErrors = validateNewPassword(new_password);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        detail: validationErrors[0],
        errors: validationErrors,
      });
    }

    // Prevent reusing the same password
    if (current_password === new_password) {
      return res.status(400).json({ detail: 'New password must be different from your current password' });
    }

    // ── Verify current password via Firebase ──────────────────────────────
    const apiKey = firebaseApiKey();
    if (!apiKey) {
      return res.status(500).json({ detail: 'Firebase API key not configured' });
    }

    try {
      await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        { email: userEmail, password: current_password, returnSecureToken: false },
      );
    } catch (fbErr) {
      const msg = fbErr.response?.data?.error?.message || '';
      if (msg.includes('TOO_MANY_ATTEMPTS')) {
        return res.status(429).json({ detail: 'Too many attempts. Please try again later.' });
      }
      return res.status(401).json({ detail: 'Current password is incorrect' });
    }

    // ── Update password in Firebase ───────────────────────────────────────
    const uid = req.user.firebase_uid;
    if (!uid) {
      return res.status(400).json({ detail: 'No Firebase account linked. Cannot change password.' });
    }
    const db = getDb();
    await invalidateMobileIdentity(db, req.user, 'password_changed', req);
    await admin.auth().updateUser(uid, { password: new_password });

    console.log('[ChangePassword] Password updated', {
      user_fingerprint: shortFingerprint(userId),
      email_fingerprint: shortFingerprint(userEmail),
      success: true,
    });

    const changeTimestamp = new Date();

    // ── In-app audit announcement ─────────────────────────────────────────
    if (notify_app !== false) {
      try {
        await db.collection('announcements').insertOne({
          announcement_id: `ann_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
          title: 'Password changed',
          content: `Your password was updated for ${maskEmail(userEmail)} on ${changeTimestamp.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })}. If this wasn't you, reset your password immediately or contact admin.`,
          category: 'Security',
          priority: 'high',
          author_id: 'system',
          user_id: userId,
          is_private: true,
          is_active: true,
          created_at: changeTimestamp,
        });
      } catch (annErr) {
        console.warn('[ChangePassword] Announcement insert failed:', annErr?.message);
      }
    }

    // ── Email confirmation (non-blocking) ─────────────────────────────────
    if (notify_email !== false) {
      sendPasswordChangedEmail(userEmail, userName, requestIp)
        .catch(err => console.warn('[ChangePassword] Email failed:', err?.message));
    }

    // ── Push notification (non-blocking) ──────────────────────────────────
    try {
      const { sendPushToUser } = require('../services/pushService');
      sendPushToUser(userId, {
        title: '🔒 Password Changed',
        body: 'Your LilyCrest account password was just updated. If this wasn\'t you, contact admin immediately.',
        data: { type: 'security_alert', action: 'password_changed' },
      }).catch(() => {});
    } catch (_) { /* push service may not be available */ }

    // ── Invalidate all existing sessions (force re-login with new password) ──
    // ── Audit log entry ───────────────────────────────────────────────────
    try {
      await db.collection('login_attempts').insertOne({
        email_hash: crypto.createHmac('sha256', otpSecret()).update(userEmail.toLowerCase()).digest('hex'),
        success: true,
        reason: 'password_changed',
        ip: requestIp,
        user_agent: req.headers['user-agent'] || 'unknown',
        timestamp: changeTimestamp,
      });
    } catch (err) { console.warn('[ChangePassword] Audit log warning:', err.message); }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ detail: 'Failed to change password. Please try again.' });
  }
}

// ─── FORGOT PASSWORD ────────────────────────────────────────────────────────

async function forgotPassword(req, res) {
  // Always return same message to prevent email enumeration
  const successMsg = 'If your email is registered, you will receive a password reset link.';
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ detail: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const db = getDb();

    // Check for 30-second cooldown on reset attempts
    const recentToken = await db.collection('password_reset_tokens').findOne({
      email: normalizedEmail,
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
    }).catch(() => null);

    if (recentToken) {
      const elapsed = Date.now() - new Date(recentToken.createdAt).getTime();
      const retryAfterSeconds = Math.max(1, Math.ceil((30000 - elapsed) / 1000));
      return res.status(429).json({
        detail: `Please wait ${retryAfterSeconds}s before requesting another password reset email.`,
        code: 'PASSWORD_RESET_COOLDOWN',
        retryAfterSeconds,
      });
    }

    const tenantData = await verifyTenantInFirebase(normalizedEmail);

    if (tenantData) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const db = getDb();
      // Look up MongoDB user_id for session invalidation later
      const dbUser = await db.collection('users').findOne({ email: normalizedEmail }).catch(() => null);
      const mongoUserId = dbUser?.user_id || null;

      // Invalidate any prior unused tokens for this email
      await db.collection('password_reset_tokens').updateMany(
        { email: normalizedEmail, used: false },
        { $set: { used: true } }
      );
      await db.collection('password_reset_tokens').insertOne({
        hashedToken,
        email: normalizedEmail,
        uid: tenantData.firebase_id,   // verifyTenantInFirebase returns firebase_id, not uid
        user_id: mongoUserId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        createdAt: new Date(),
      });

      const backendUrl = passwordResetBaseUrl();
      const resetLink = `${backendUrl}/api/auth/reset-password?token=${rawToken}`;
      const userName = tenantData.name || 'Tenant';

      sendPasswordResetEmail(normalizedEmail, userName, resetLink).catch(() => {});

      // Audit log
      try {
        await db.collection('announcements').insertOne({
          announcement_id: `ann_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
          title: 'Password reset requested',
          content: `A password reset link was sent to ${maskEmail(normalizedEmail)}.`,
          category: 'Account',
          priority: 'normal',
          author_id: 'system',
          user_id: tenantData.user_id || null,
          is_private: true,
          is_active: true,
          created_at: new Date(),
        });
      } catch (err) { console.warn('[ForgotPassword] Audit log warning:', err.message); }
    }

    res.json({ message: successMsg });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ message: successMsg });
  }
}

// ─── RESET PASSWORD (GET — serve deep-link redirect page) ───────────────────

function getResetPasswordPage(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid Link</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F3F4F6;padding:24px}
.card{background:#fff;border-radius:20px;padding:40px 32px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}
h1{color:#1E3A5F;font-size:20px;margin-bottom:8px}p{color:#6B7280;font-size:14px}</style></head>
<body><div class="card"><div style="font-size:48px;margin-bottom:16px">⚠️</div>
<h1>Invalid Reset Link</h1><p>This link is missing a reset token. Please request a new password reset from the app.</p></div></body></html>`);
  }

  const safeToken = encodeURIComponent(token);
  const prodLink  = `frontend://reset-password?token=${safeToken}`;
  const devLink   = `exp+frontend://reset-password?token=${safeToken}`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset Password — LilyCrest</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,Roboto,"Segoe UI",sans-serif;background:#F3F4F6;
         display:flex;flex-direction:column;align-items:center;justify-content:center;
         min-height:100vh;padding:24px}
    .card{background:#fff;border-radius:20px;padding:40px 32px;max-width:440px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,.10);text-align:center}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:22px;font-weight:700;color:#1E3A5F;margin-bottom:8px}
    .sub{font-size:14px;color:#6B7280;line-height:1.6;margin-bottom:28px}

    /* ── mobile section ── */
    .mobile-section{margin-bottom:28px}
    .divider{display:flex;align-items:center;gap:12px;margin-bottom:24px}
    .divider hr{flex:1;border:none;border-top:1px solid #E5E7EB}
    .divider span{font-size:12px;color:#9CA3AF;white-space:nowrap}

    /* ── form ── */
    .form-label{display:block;font-size:12px;font-weight:600;color:#1E3A5F;
                letter-spacing:.5px;text-align:left;margin-bottom:6px}
    .input-wrap{position:relative;margin-bottom:16px}
    .input-wrap input{width:100%;padding:13px 56px 13px 14px;font-size:15px;color:#1F2937;
                      border:1.5px solid #E5E7EB;border-radius:12px;background:#F8FAFC;outline:none}
    .input-wrap input:focus{border-color:#1E3A5F}
    .eye{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:44px;height:44px;
         background:none;border:none;cursor:pointer;font-size:18px;line-height:1}
    .eye svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .err{background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;
         padding:10px 14px;font-size:13px;color:#B91C1C;margin-bottom:14px;text-align:left}
    .ok{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;
        padding:10px 14px;font-size:13px;color:#15803D;margin-bottom:14px;text-align:left}

    /* ── buttons ── */
    .btn{display:block;width:100%;padding:15px;border-radius:13px;font-size:15px;
         font-weight:700;text-decoration:none;border:none;cursor:pointer;text-align:center}
    .btn+.btn{margin-top:10px}
    .btn-orange{background:#D4682A;color:#fff}
    .btn-navy{background:#1E3A5F;color:#fff}
    .btn-submit{background:#1E3A5F;color:#fff;margin-top:4px}
    .btn-submit:disabled{opacity:.55;cursor:not-allowed}
    .note{font-size:12px;color:#9CA3AF;margin-top:10px;line-height:1.5}
  </style>
</head>
<body>
<div class="card">
  <div class="icon">🔑</div>
  <h1>Reset Your Password</h1>
  <p class="sub">This link expires in <strong>15 minutes</strong> and can only be used once.</p>

  <!-- ─── Mobile: open in app ─── -->
  <div class="mobile-section" id="mobileSection" style="display:none">
    <a class="btn btn-orange" href="${prodLink}" id="openApp">Open LilyCrest App</a>
    <a class="btn btn-navy" href="${devLink}" style="margin-top:10px">Open Dev Build</a>
    <p class="note">On your phone? Tap above to set your password inside the app.</p>
  </div>

  <div class="divider" id="divider" style="display:none">
    <hr><span>or reset here</span><hr>
  </div>

  <!-- ─── Web form (works on all devices) ─── -->
  <div id="formSection">
    <div id="msg"></div>
    <label class="form-label" for="pw">NEW PASSWORD</label>
    <div class="input-wrap">
      <input id="pw" type="password" placeholder="At least 8 characters" autocomplete="new-password">
      <button class="eye" type="button" onclick="toggleEye('pw','eye1')" id="eye1" aria-label="Show password" title="Show password" aria-pressed="false"><svg class="eye-open" aria-hidden="true" hidden viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" aria-hidden="true" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M6.7 6.7C3.9 8.5 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1.1"/><path d="M10.7 5.1C11.1 5 11.5 5 12 5c6.5 0 10 7 10 7s-.8 1.6-2.3 3.3"/></svg></button>
    </div>
    <label class="form-label" for="pw2">CONFIRM PASSWORD</label>
    <div class="input-wrap">
      <input id="pw2" type="password" placeholder="Repeat your password" autocomplete="new-password">
      <button class="eye" type="button" onclick="toggleEye('pw2','eye2')" id="eye2" aria-label="Show password" title="Show password" aria-pressed="false"><svg class="eye-open" aria-hidden="true" hidden viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" aria-hidden="true" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M6.7 6.7C3.9 8.5 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1.1"/><path d="M10.7 5.1C11.1 5 11.5 5 12 5c6.5 0 10 7 10 7s-.8 1.6-2.3 3.3"/></svg></button>
    </div>
    <button class="btn btn-submit" id="submitBtn" onclick="doReset()">Reset Password</button>
  </div>

  <div id="successSection" style="display:none">
    <div class="ok" style="text-align:center;font-size:15px">✅ Password reset successfully!<br>You can now log in with your new password.</div>
    <p style="font-size:13px;color:#6B7280;margin-top:12px">You may close this tab.</p>
  </div>
</div>

<script>
  var TOKEN = ${JSON.stringify(token)};

  // Show mobile section only on actual mobile devices
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    document.getElementById('mobileSection').style.display = 'block';
    document.getElementById('divider').style.display = 'flex';
    // Auto-attempt deep link on mobile; fallback form stays visible
    setTimeout(function(){ window.location.replace(${JSON.stringify(prodLink)}); }, 300);
  }

  function toggleEye(inputId, btnId) {
    var inp = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    var visible = inp.type === 'password';
    inp.type = visible ? 'text' : 'password';
    btn.querySelector('.eye-open').hidden = !visible;
    btn.querySelector('.eye-closed').hidden = visible;
    btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    btn.setAttribute('title', visible ? 'Hide password' : 'Show password');
    btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
  }

  async function doReset() {
    var pw  = document.getElementById('pw').value;
    var pw2 = document.getElementById('pw2').value;
    var msg = document.getElementById('msg');
    msg.innerHTML = '';

    if (!pw || !pw2) { return showErr('Please fill in both fields.'); }
    if (pw !== pw2)  { return showErr('Passwords do not match.'); }
    if (pw.length < 8) { return showErr('Password must be at least 8 characters.'); }

    var btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Resetting…';

    try {
      var resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, newPassword: pw })
      });
      var data = await resp.json();
      if (resp.ok) {
        document.getElementById('formSection').style.display  = 'none';
        document.getElementById('mobileSection').style.display = 'none';
        document.getElementById('divider').style.display = 'none';
        document.getElementById('successSection').style.display = 'block';
      } else {
        showErr(data.detail || 'Failed to reset password. Please try again.');
        btn.disabled = false; btn.textContent = 'Reset Password';
      }
    } catch(e) {
      showErr('Network error. Please check your connection and try again.');
      btn.disabled = false; btn.textContent = 'Reset Password';
    }
  }

  function showErr(msg) {
    document.getElementById('msg').innerHTML = '<div class="err">' + msg + '</div>';
  }
</script>
</body>
</html>`);
}

// ─── RESET PASSWORD (POST — validate token & update Firebase password) ───────

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ detail: 'Token and new password are required.' });
    }

    const passwordErrors = validateNewPassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ detail: passwordErrors[0] });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const db = getDb();
    const record = await db.collection('password_reset_tokens').findOne({
      hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({ detail: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    // Mark token used before touching Firebase (prevent replay on failure)
    await db.collection('password_reset_tokens').updateOne(
      { hashedToken },
      { $set: { used: true, usedAt: new Date() } }
    );

    const identity = await db.collection('users').findOne({ user_id: record.user_id });
    await invalidateMobileIdentity(db, identity || { user_id: record.user_id, firebase_uid: record.uid }, 'password_reset', req);
    // Update password only after old authorization state is logically invalidated.
    await admin.auth().updateUser(record.uid, { password: newPassword });

    // Send confirmation email
    sendPasswordChangedEmail(record.email, 'Tenant', 'app').catch(() => {});

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ detail: 'Failed to reset password. Please try again.' });
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────

module.exports = {
  googleSignIn,
  register,
  login,
  verifyOtp,
  resendOtp,
  getMe,
  logout,
  changePassword,
  forgotPassword,
  getResetPasswordPage,
  resetPassword,
  __test: {
    hashOtp,
    otpMatches,
    verifyOtp,
    resendOtp,
    setDependencies(overrides) { Object.assign(authTestDependencies, overrides); },
    createSession,
  },
};
