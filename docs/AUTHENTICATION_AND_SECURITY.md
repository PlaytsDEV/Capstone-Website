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
3. `branch_admin` — Can manage assigned branch rooms, reservations, utilities, and billing.
4. `owner` — Unrestricted access across all branches, system settings, and audit logs.

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

### Applicant first verified login

New applicants created through the public Firebase password-registration flow
receive a backend-only `initialEmailVerifiedLoginEligibleAt` marker. After the
Firebase verification link is completed, the first password login may consume
that eligibility exactly once. MongoDB atomically records
`initialEmailVerifiedLoginCompletedAt`, invalidates obsolete login challenges,
and creates a device-bound session with `first_verified_login` assurance.

That session is not marked as OTP verified. It remains usable only while its
normal session cookie, device ID, account status, security version, and expiry
remain valid. Logout, revocation, expiry, cookie removal, or a new device does
not recreate eligibility; the next applicant password login follows the normal
OTP flow.

The claim transaction compares the security version observed by the login
controller and creates the exempt session from the authoritative user document
returned inside that transaction. A concurrent revocation therefore causes the
claim to retry or fail closed instead of committing an immediately stale
session. After the transaction commits, consumption is permanent. If the
response cookie cannot be serialized, cleanup deletes only that request's exact
active `first_verified_login` session (session ID, user, device, assurance, and
login timestamp); it never resets the completion marker or changes a newer OTP
session.

Historical applicants, OAuth registrations, administrator-created accounts,
and accounts converted into the applicant role have no eligibility marker and
therefore never receive an implicit bypass. Branch administrators and owners
retain the established no-OTP login policy. Tenant password logins retain the
existing OTP requirement.

All protected web HTTP requests and Socket.IO connections require the same
active, non-expired, device-bound application session and matching security
version. Password-authenticated branch administrators and owners use
`admin_password` assurance without OTP. Applicant and tenant OTP sessions use
`login_otp`; only applicants may use `first_verified_login`; OAuth sessions use
`oauth`. Legacy null assurance is accepted only for applicant/tenant sessions
with a valid OTP timestamp. Unknown explicit assurance values fail closed.

The web client's protected transport always sends browser credentials together
with the Firebase bearer token and device/session metadata. Credentialed CORS
reflects only configured or built-in approved origins; a standalone wildcard is
ignored and never enables credentialed requests from arbitrary origins.

Use a restricted Resend key and a sender address on a verified sender/domain. After changing either value, restart the backend because the Resend client and sender configuration are initialized when the email module is imported. Configuration presence alone does not prove that the credential or sender is valid; confirmation requires an authorized provider-accepted delivery test with a disposable test account.
