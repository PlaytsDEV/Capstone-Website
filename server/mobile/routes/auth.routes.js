const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const legacyPasswordResetController = require('../controllers/legacyPasswordReset.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: { detail: 'Too many authentication attempts. Please try again later.' }
});

router.post('/google', authLimiter, authController.googleSignIn);
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/login/verify-otp', authLimiter, authController.verifyOtp);
router.post('/login/resend-otp', authLimiter, authController.resendOtp);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);
router.post('/change-password', authLimiter, authMiddleware, activeTenantMiddleware, authController.changePassword);
// Forgot Password is intentionally absent here. The canonical ESM bridge
// mounted before this vendored router maps /api/m/auth/forgot-password to
// controllers/passwordResetController.js, so no new custom Mongo reset token
// can be issued. These routes exist only for already-issued 15-minute tokens.
router.get('/reset-password/legacy.js', legacyPasswordResetController.getLegacyResetScript);
router.get('/reset-password', legacyPasswordResetController.getResetPasswordPage);
router.post('/reset-password', authLimiter, legacyPasswordResetController.resetPassword);

module.exports = router;
