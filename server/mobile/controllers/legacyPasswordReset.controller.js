'use strict';

const crypto = require('crypto');
const path = require('path');
const { getDb } = require('../config/database');
const { admin } = require('../config/firebase');
const { sendPasswordChangedEmail } = require('../services/emailService');
const { invalidateUserSessionsCore } = require('../../security/sessionInvalidationCore.cjs');
const { validateNewPassword } = require('../../security/passwordPolicy.cjs');
const { evaluateTenant } = require('../../security/mobileTenantEligibility.cjs');
const { hashResetToken, resetTokenEligibilityFilter } = require('../security/resetTokenEligibility');

const LEGACY_RESET_RETIREMENT_NOTE =
  'No new custom reset tokens are issued. Remove this compatibility route after the 15-minute pre-cutover token window and production access-log review.';

function getLegacyResetScript(_req, res) {
  res.type('application/javascript').sendFile(
    path.join(__dirname, '..', 'public', 'legacy-password-reset.js'),
  );
}

function getResetPasswordPage(_req, res) {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Reset Password — Lilycrest</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f6fa;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#17233d}.card{width:min(100%,440px);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(20,39,70,.12)}.head{padding:22px 28px;background:#17233d;border-bottom:3px solid #d4af37;color:#fff;text-align:center}.head strong{color:#d4af37;letter-spacing:.08em}.body{padding:30px}.center{text-align:center}.muted{color:#64748b;line-height:1.55}.field{margin-top:18px}.field label{display:block;margin-bottom:7px;font-size:13px;font-weight:650}.input-row{display:flex;gap:8px}.input-row input{width:100%;padding:13px;border:1px solid #cbd5e1;border-radius:10px;font:inherit}.eye{width:46px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;cursor:pointer}.rules{display:grid;gap:6px;margin:13px 0 0;padding:13px;border:1px solid #eadba7;border-radius:10px;background:#fbf7ea;font-size:13px}.rule.met{color:#15803d}.rule::before{content:"○";margin-right:7px}.rule.met::before{content:"✓"}.error{margin-top:16px;padding:11px;border:1px solid #fecaca;border-radius:9px;background:#fef2f2;color:#991b1b}.success{padding:12px;border:1px solid #bbf7d0;border-radius:9px;background:#f0fdf4;color:#166534}.button{display:block;width:100%;margin-top:20px;padding:14px;border:0;border-radius:10px;background:#d4af37;color:#17233d;font:inherit;font-weight:700;cursor:pointer}.button:disabled{background:#cbd5e1;color:#64748b;cursor:not-allowed}.link{display:block;margin-top:14px;text-align:center;color:#1d4ed8}.hidden{display:none!important}
  </style>
</head>
<body>
  <main class="card">
    <header class="head"><strong>LILYCREST</strong><div>Password Reset</div></header>
    <section class="body">
      <div id="checking" class="center"><h1>Checking reset link</h1><p class="muted">Please wait while we verify this one-time link.</p></div>
      <div id="invalid" class="center hidden"><h1>Reset link unavailable</h1><p class="muted">This password reset link has already been used or is no longer valid.</p><a class="link" href="https://www.lilycrest.space/forgot-password">Request a new reset link</a></div>
      <div id="network" class="center hidden"><h1>Unable to verify link</h1><p class="muted">We couldn't verify this reset link. Check your connection and try again.</p><button id="retry" class="button" type="button">Try again</button></div>
      <form id="reset-form" class="hidden" novalidate>
        <h1>Choose a new password</h1>
        <p class="muted">For your security, this reset link expires and can only be used once.</p>
        <div class="field"><label for="new-password">New Password</label><div class="input-row"><input id="new-password" type="password" maxlength="128" autocomplete="new-password" disabled><button class="eye" type="button" data-target="new-password" aria-label="Show password" disabled>Show</button></div></div>
        <div class="rules" aria-label="Password requirements">
          <div class="rule" data-rule="minLength">At least 8 characters</div><div class="rule" data-rule="uppercase">One uppercase letter</div><div class="rule" data-rule="lowercase">One lowercase letter</div><div class="rule" data-rule="number">One number</div><div class="rule" data-rule="special">One special character</div>
        </div>
        <div class="field"><label for="confirm-password">Confirm New Password</label><div class="input-row"><input id="confirm-password" type="password" maxlength="128" autocomplete="new-password" disabled><button class="eye" type="button" data-target="confirm-password" aria-label="Show password" disabled>Show</button></div></div>
        <div id="form-error" class="error hidden" role="alert"></div>
        <button id="submit" class="button" type="submit" disabled>Reset Password</button>
      </form>
      <div id="success" class="center hidden"><h1>Password updated successfully</h1><p class="success">Your password was changed. Sign in again with your new password.</p><a class="link" href="https://www.lilycrest.space/signin">Back to Login</a></div>
    </section>
  </main>
  <script src="/api/m/auth/reset-password/legacy.js" defer></script>
</body>
</html>`);
}

async function resetPassword(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const newPassword = req.body?.newPassword;
  if (!token || typeof newPassword !== 'string') {
    return res.status(400).json({ code: 'INVALID_RESET_REQUEST', detail: 'Reset token and new password are required.' });
  }

  const passwordErrors = validateNewPassword(newPassword);
  if (passwordErrors.length) {
    return res.status(400).json({ code: 'PASSWORD_POLICY_FAILED', detail: passwordErrors[0], errors: passwordErrors });
  }

  const db = getDb();
  const hashedToken = hashResetToken(token);
  const processingId = crypto.randomUUID();
  const now = new Date();
  const claimedResult = await db.collection('password_reset_tokens').findOneAndUpdate(
    {
      ...resetTokenEligibilityFilter(hashedToken, now),
      processingId: { $exists: false },
    },
    { $set: { processingId, processingAt: now } },
    { returnDocument: 'after' },
  );
  const record = claimedResult?.value || claimedResult;

  if (!record?.uid) {
    return res.status(400).json({ code: 'RESET_LINK_INVALID', detail: 'This password reset link has already been used or is no longer valid.' });
  }

  let identity;
  try {
    identity = record.user_id
      ? await db.collection('users').findOne({ user_id: record.user_id })
      : null;
  } catch (error) {
    await db.collection('password_reset_tokens').updateOne(
      { hashedToken, processingId, used: false },
      { $unset: { processingId: '', processingAt: '' } },
    ).catch(() => undefined);
    console.error('[legacy-password-reset] Tenant eligibility lookup failed:', error?.code || error?.message);
    return res.status(503).json({ code: 'RESET_VERIFICATION_UNAVAILABLE', detail: 'We could not verify this reset link right now. Please try again.' });
  }

  if (!evaluateTenant(identity).allowed) {
    await db.collection('password_reset_tokens').updateOne(
      { hashedToken, processingId, used: false },
      { $set: { used: true, usedAt: new Date() }, $unset: { processingId: '', processingAt: '' } },
    ).catch(() => undefined);
    return res.status(400).json({ code: 'RESET_LINK_INVALID', detail: 'This password reset link has already been used or is no longer valid.' });
  }

  try {
    await admin.auth().updateUser(record.uid, { password: newPassword });
  } catch (error) {
    await db.collection('password_reset_tokens').updateOne(
      { hashedToken, processingId, used: false },
      { $unset: { processingId: '', processingAt: '' } },
    ).catch(() => undefined);
    console.error('[legacy-password-reset] Firebase update failed:', error?.code || error?.message);
    return res.status(502).json({ code: 'PASSWORD_PROVIDER_FAILURE', detail: 'We could not update your password right now. Please try again.' });
  }

  const consumed = await db.collection('password_reset_tokens').updateOne(
    { hashedToken, processingId, used: false },
    { $set: { used: true, usedAt: new Date() }, $unset: { processingId: '', processingAt: '' } },
  ).catch(() => ({ matchedCount: 0 }));
  if (!consumed?.matchedCount) {
    console.error('[legacy-password-reset] Password changed but token finalization did not persist');
  }

  let sessionCleanupComplete = true;
  try {
    const invalidation = await invalidateUserSessionsCore({
      db,
      adminAuth: admin.auth(),
      userId: record.user_id,
      mongoId: identity?._id,
      firebaseUid: record.uid,
      reason: 'legacy_password_reset',
      failClosed: true,
    });
    sessionCleanupComplete = !invalidation.failures.length;
  } catch (error) {
    sessionCleanupComplete = false;
    console.error('[legacy-password-reset] Session finalization incomplete:', error?.code || error?.message);
  }

  sendPasswordChangedEmail(record.email, identity?.name || 'Tenant', 'password reset').catch(() => undefined);
  return res.json({
    message: 'Password reset successfully. You can now sign in with your new password.',
    sessionCleanupComplete,
  });
}

module.exports = {
  LEGACY_RESET_RETIREMENT_NOTE,
  getLegacyResetScript,
  getResetPasswordPage,
  resetPassword,
};
