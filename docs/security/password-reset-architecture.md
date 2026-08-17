# Password reset authority

Firebase Authentication is Lilycrest's credential and password-reset action-code authority.

New requests from both clients follow one flow:

1. Web calls `POST /api/auth/request-password-reset`.
2. Mobile calls `POST /api/m/auth/forgot-password`, whose server-side eligibility wrapper accepts only an authoritative active-tenant profile before delegating to the same controller. Applicant, admin/owner/staff, missing-profile, and spoofed client-role requests receive the identical enumeration-safe response without email generation.
3. `server/controllers/passwordResetController.js` generates a real Firebase password-reset link, rewrites only its trusted action parameters onto the canonical Lilycrest `/auth-action` URL, and sends the branded email through the Lilycrest Resend/SMTP service.
4. `/auth-action?mode=resetPassword&oobCode=...` dispatches to the web reset page.
5. The reset page calls Firebase `verifyPasswordResetCode` before rendering an enabled form, enforces the canonical new-password contract, and calls `confirmPasswordReset` once.
6. A transient sign-in obtains a verified Firebase token for `POST /api/auth/finalize-password-reset`, which advances Lilycrest's security version, revokes Firebase refresh tokens, and invalidates web and mobile sessions. The user returns to Login; reset never auto-logs them in.

## Transitional custom-token compatibility

The old `password_reset_tokens` generator is no longer mounted. No new custom reset credentials can be issued.

`GET|POST /api/m/auth/reset-password` and `POST /api/m/auth/reset-password/status` remain temporarily for custom links issued immediately before deployment. The compatibility page is inactive until the token status endpoint verifies the token, uses only an external same-origin script permitted by the backend CSP, and applies an exclusive processing claim before changing the Firebase password. Provider failure releases the claim; successful credential update precedes final token consumption.

Removal condition: after the deployment has been live longer than the former 15-minute token TTL, verify production access logs show no legitimate compatibility traffic, then remove the three legacy routes, controller, script, token helper, and collection/index maintenance. The compatibility code must not be extended or used for new requests.

## New-password contract

- 8–128 characters
- at least one uppercase ASCII letter
- at least one lowercase ASCII letter
- at least one ASCII digit
- at least one non-alphanumeric, non-whitespace character
- no whitespace

The five positive composition requirements are visible in checklists. The whitespace and maximum-length rules remain enforced defense-in-depth checks and are not checklist rows.

Login Password and Change Password's Current Password are legacy credentials. Clients and the mobile backend pass them to Firebase exactly as entered, with no trimming, whitespace removal, or new-password complexity checks.
