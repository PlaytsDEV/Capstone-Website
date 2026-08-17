const crypto = require('crypto');

// Single definition of "this password-reset token may still be used", shared
// by the consuming POST /auth/reset-password (mobile/controllers/
// auth.controller.js) and the non-consuming POST /auth/reset-password/status
// bridge (routes/mobileAuthRoutes.js) so the two can never drift apart.
//
// Deliberately dependency-free (only Node's built-in crypto) so it can be
// required in isolation — by a route file or a test — without pulling in the
// vendored auth controller's config/database, config/firebase, or
// emailService dependency chain.

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function resetTokenEligibilityFilter(hashedToken, asOf = new Date()) {
  return {
    hashedToken,
    used: false,
    expiresAt: { $gt: asOf },
    processingId: { $exists: false },
  };
}

module.exports = { hashResetToken, resetTokenEligibilityFilter };
