/**
 * LilyCrest Mobile Email Service
 *
 * Thin adapter over the single authoritative Resend service
 * (server/services/email/resendEmailService.js). Mobile controllers are
 * CommonJS, the shared service is ESM, so each call dynamically imports it —
 * this is the only difference from how the web/server side calls it.
 *
 * All public functions keep their pre-migration signatures and non-throwing
 * boolean-return contract so mobile controllers do not need to change.
 */

const crypto = require('crypto');

function emailFingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex').slice(0, 12);
}

async function loadResendEmailService() {
  return import('../../services/email/resendEmailService.js');
}

// ─── PASSWORD CHANGED EMAIL ─────────────────────────────────────────────────

/**
 * Send a "your password was changed" confirmation email.
 *
 * @param {string} toEmail   Recipient email
 * @param {string} userName  Display name (for greeting)
 * @param {string} ip        IP address of the request
 * @returns {Promise<boolean>}
 */
async function sendPasswordChangedEmail(toEmail, userName = 'Tenant', ip = 'Unknown') {
  const { sendTemplateEmail } = await loadResendEmailService();
  const now = new Date();
  const timestamp = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });

  const result = await sendTemplateEmail({
    emailType: 'MOBILE_PASSWORD_CHANGED',
    to: toEmail,
    templateKey: 'PASSWORD_CHANGED',
    variables: {
      USER_NAME: userName,
      TIMESTAMP: timestamp,
      IP_ADDRESS: String(ip || 'Unknown'),
    },
  });

  console.log(result.success ? '[Email] Password-changed email accepted' : '[Email] Password-changed email failed', {
    email_fingerprint: emailFingerprint(toEmail),
    success: result.success,
  });
  return result.success;
}

// ─── LOGIN OTP EMAIL ────────────────────────────────────────────────────────

/**
 * Send a login OTP verification email.
 *
 * @param {string} toEmail   Recipient email
 * @param {string} userName  Display name
 * @param {string} otpCode   6-digit OTP code
 * @returns {Promise<boolean>}
 */
async function sendLoginOtpEmail(toEmail, userName = 'Tenant', otpCode) {
  const { sendTemplateEmail } = await loadResendEmailService();
  const result = await sendTemplateEmail({
    emailType: 'MOBILE_LOGIN_OTP',
    to: toEmail,
    templateKey: 'LOGIN_OTP',
    variables: {
      USER_NAME: userName,
      OTP_CODE: otpCode,
      EXPIRY_MINUTES: 10,
    },
  });

  console.log(result.success ? '[Email] Login OTP accepted' : '[Email] Login OTP failed', {
    email_fingerprint: emailFingerprint(toEmail),
    success: result.success,
  });
  return result.success;
}

// ─── PAYMENT RECEIPT EMAIL ────────────────────────────────────────────────

/**
 * Send a payment receipt confirmation email.
 *
 * @param {string} toEmail   Recipient email
 * @param {string} userName  Display name
 * @param {object} receipt   Payment receipt details
 * @returns {Promise<boolean>}
 */
async function sendPaymentReceiptEmail(toEmail, userName = 'Tenant', receipt = {}) {
  const { sendTemplateEmail } = await loadResendEmailService();

  const billingId = receipt.billingId || 'N/A';
  const description = receipt.description || `Bill ${billingId}`;
  const amount = Number(receipt.amount || 0);
  const paymentMethod = receipt.paymentMethod || 'PayMongo';
  const referenceNumber = receipt.referenceNumber || receipt.paymentId || 'N/A';

  const paymentDate = (() => {
    const raw = receipt.paymentDate || new Date();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  })();
  const paymentDateText = paymentDate.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });
  const amountText = `PHP ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const idempotencyKey = referenceNumber && referenceNumber !== 'N/A'
    ? crypto.createHash('sha256').update(`payment-receipt:${referenceNumber}`).digest('hex')
    : undefined;

  const result = await sendTemplateEmail({
    emailType: 'MOBILE_PAYMENT_RECEIPT',
    to: toEmail,
    templateKey: 'PAYMENT_RECEIPT',
    idempotencyKey,
    variables: {
      TENANT_NAME: userName,
      AMOUNT: amountText,
      DESCRIPTION: description,
      BILLED_TO: userName,
      PAYMENT_METHOD: paymentMethod,
      PAYMENT_DATE: paymentDateText,
      REFERENCE_NUMBER: String(referenceNumber),
      RESERVATION_CODE: '',
      ROOM_NAME: '',
      BRANCH_NAME: 'Lilycrest',
    },
  });

  console.log(result.success
    ? `[Email] Payment receipt sent for bill ${billingId}`
    : `[Email] Payment receipt failed for bill ${billingId}`,
    { email_fingerprint: emailFingerprint(toEmail), success: result.success });
  return result.success;
}

// ─── PASSWORD RESET EMAIL ────────────────────────────────────────────────────

/**
 * Send a "reset your password" email with a deep-link button.
 * The link goes to the backend, which serves a redirect page that opens the app.
 *
 * @param {string} toEmail    Recipient email
 * @param {string} userName   Display name
 * @param {string} resetLink  Full backend URL containing the reset token
 * @returns {Promise<boolean>}
 */
async function sendPasswordResetEmail(toEmail, userName = 'Tenant', resetLink) {
  const { sendTemplateEmail } = await loadResendEmailService();
  const result = await sendTemplateEmail({
    emailType: 'MOBILE_PASSWORD_RESET',
    to: toEmail,
    templateKey: 'PASSWORD_RESET',
    variables: {
      USER_NAME: userName,
      RESET_URL: resetLink,
    },
  });

  console.log(result.success ? '[Email] Password reset email accepted' : '[Email] Password reset email failed', {
    email_fingerprint: emailFingerprint(toEmail),
    success: result.success,
  });
  return result.success;
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────

module.exports = {
  sendPasswordChangedEmail,
  sendLoginOtpEmail,
  sendPaymentReceiptEmail,
  sendPasswordResetEmail,
};
