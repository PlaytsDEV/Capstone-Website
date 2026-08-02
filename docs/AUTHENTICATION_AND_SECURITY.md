# Lilycrest DMS — Authentication & Security Architecture

This master document details the authentication models, authorization guards, security headers, rate limiting, and email/OTP infrastructure powering Lilycrest DMS.

---

## 1. Authentication Architecture

Lilycrest DMS implements a dual-token authentication model combining **Firebase Authentication** (for public user onboarding, Google OAuth, and password management) and **JWT (JSON Web Tokens)** (for API authorization and session maintenance).

```
[ User Client ] ----( Credentials / Firebase Token )----> [ Express Backend ]
                                                                |
                                                      Verify Firebase Token
                                                                |
                                                      Lookup / Create User DB Record
                                                                |
                                                      Issue Signed JWT Token
                                                                |
[ Authenticated Client ] <----( Return JWT Bearer )-------------+
```

### Role-Based Access Control (RBAC)
User roles govern resource access across the system:
1. `applicant` — Can view public rooms and manage own reservation flow.
2. `tenant` — Can view current room, pay monthly bills, submit maintenance tickets.
3. `admin` — Can manage assigned branch rooms, reservations, utilities, and billing.
4. `superadmin` / `owner` — Unrestricted access across both Gil Puyat and Guadalupe branches.

### Granular Permission Enforcement (`requirePermission`)
Admin routes use granular permission keys to enforce least-privilege security:
- `manage_users`
- `manage_rooms`
- `manage_billing`
- `manage_maintenance`
- `view_audit_logs`

---

## 2. Production Security Hardening

### Security Headers (Helmet.js)
The backend enforces HTTP security headers via `helmet()`:
- `Content-Security-Policy` (CSP) protection against XSS injections.
- `Strict-Transport-Security` (HSTS) forcing HTTPS connections.
- `X-Frame-Options: DENY` preventing clickjacking attacks.
- `X-Content-Type-Options: nosniff`.

### Tiered Rate Limiting (`express-rate-limit`)
- **Public API Rate Limiter**: 100 requests per 15-minute window per IP.
- **Authentication Limiter**: 10 failed login attempts per 15-minute window per IP to prevent brute-force attacks.
- **Payment & Checkout Limiter**: 20 requests per hour per IP.

### Request Body Sanitization & Input Validation
- Express middleware strips MongoDB query operators (`$gt`, `$where`, `$ne`) from incoming request parameters to prevent NoSQL injection.
- Request payload schemas are strictly sanitized before passing data to controller logic.

---

## 3. Email, OTP & SMTP Deployment Analysis

### Password Setup & Email Verification
When a Branch Admin or Super Admin creates a new user account:
1. The backend generates a secure, time-limited setup token.
2. An automated setup email is dispatched via SMTP (Nodemailer service).
3. The recipient opens the secure link to define their initial password.

### SMTP Production Configuration
Environment keys governing email dispatch:
- `SMTP_HOST`
- `SMTP_PORT` (587 / 465)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`

### Web Login OTP Delivery (Resend)

Web login OTP messages use `RESEND_API_KEY` and `RESEND_FROM_EMAIL` from the backend environment (normally `server/.env` for local development). The API fails closed when either value is missing or when Resend rejects or does not positively accept the request; no newly generated challenge is stored in that case.

Use a restricted Resend key and a sender address on a verified sender/domain. After changing either value, restart the backend because the Resend client and sender configuration are initialized when the email module is imported. Configuration presence alone does not prove that the credential or sender is valid; confirmation requires an authorized provider-accepted delivery test with a disposable test account.
