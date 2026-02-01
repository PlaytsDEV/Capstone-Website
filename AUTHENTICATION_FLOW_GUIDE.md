# Complete Authentication Flow Guide

## Overview

This document describes the comprehensive authentication flow implemented in the Lilycrest Web application, including Firebase Authentication integration, email verification, branch selection, and error handling.

---

## Authentication Methods

### 1. Email/Password Registration (Standard Signup)

### 2. Google Sign-In (OAuth)

### 3. Email/Password Login

### 4. Google Login (OAuth)

---

## User Flows

### Flow 1: Standard Email/Password Registration

**Steps:**

1. User fills out signup form with:
   - First Name, Last Name
   - Email
   - Password, Confirm Password
   - Branch Selection (Gil Puyat or Guadalupe)
   - Agrees to Terms & Conditions

2. **Firebase Account Creation**
   - System creates Firebase account with email/password
   - Firebase sends verification email automatically

3. **Backend Registration**
   - User data saved to MongoDB
   - Branch is stored immediately
   - If backend fails, Firebase account is deleted (rollback)

4. **Email Verification Required**
   - User must verify email before logging in
   - Verification link sent to email
   - User is signed out and redirected to sign-in page

5. **Login After Verification**
   - User logs in with email/password
   - System checks email verification status
   - If verified, redirected to selected branch page
   - If not verified, shows warning message

**Error Handling:**

- Email already exists → Shows error, suggests sign-in
- Weak password → Shows specific password requirements
- Backend failure → Rolls back Firebase account
- Network errors → Clear error message with retry option

---

### Flow 2: Google Sign-Up (Continue with Google)

**Steps:**

1. User clicks "Continue with Google" on signup page

2. **Google Authentication**
   - Opens Google sign-in popup
   - User selects Google account
   - Email is automatically verified by Google

3. **Account Check**
   - System checks if account already exists in backend
   - If exists → Redirects to sign-in with info message
   - If not exists → Proceeds with auto-registration

4. **Auto-Registration**
   - Extracts name from Google profile
   - Generates unique username from email
   - Stores user with **empty branch** (to be selected later)
   - Branch selection happens on first login

5. **Redirect to Sign-In**
   - User redirected to sign-in page
   - Temporary auth data stored
   - Ready for branch selection

**Error Handling:**

- Popup closed → Shows "Sign-up cancelled" message
- Network error → Clear error message
- Backend failure → Deletes Firebase account (rollback)
- Email not available → Shows specific error

---

### Flow 3: Email/Password Login

**Steps:**

1. User enters email and password

2. **Firebase Authentication**
   - System authenticates with Firebase
   - Checks if email is verified

3. **Email Verification Check**
   - If not verified → User signed out, shows warning
   - If verified → Proceeds to backend login

4. **Backend Login**
   - Validates user exists in database
   - Checks account status (active/inactive)
   - Syncs verification status

5. **Branch Check**
   - If branch is empty → Shows branch selection modal
   - If branch exists → Redirects to branch page

6. **Redirect**
   - Admin/SuperAdmin → Admin Dashboard
   - Tenant with branch → Branch page (e.g., /gil-puyat)
   - Tenant without branch → Branch selection modal

**Error Handling:**

- Invalid credentials → Clear error message
- Email not verified → Specific instruction to check email
- Account not found → Suggests registration
- Account inactive → Contact support message
- Too many attempts → Temporary lockout message

---

### Flow 4: Google Login (Continue with Google)

**Steps:**

1. User clicks "Continue with Google" on sign-in page

2. **Google Authentication**
   - Opens Google sign-in popup
   - User selects Google account
   - Email automatically verified by Google

3. **Email Verification Check**
   - System verifies email is confirmed
   - If not → Shows warning (rare case)

4. **Backend Login**
   - Checks if account exists in backend
   - If not exists → Shows error, suggests signup
   - If exists → Proceeds with login

5. **Branch Check**
   - If branch empty → Shows branch selection modal
   - If branch exists → Direct login

6. **Branch Selection (if needed)**
   - User selects Gil Puyat or Guadalupe
   - Branch saved to database
   - User redirected to selected branch

7. **Redirect**
   - Admin/SuperAdmin → Admin Dashboard
   - Tenant → Selected branch page

**Error Handling:**

- Account not found → Redirects to signup with message
- Popup closed → Shows "Sign-in cancelled"
- Network error → Retry instruction
- Account inactive → Contact support
- Different credential method → Clear error message

---

## Branch Selection Flow

### When Branch Selection is Triggered

Branch selection modal appears when:

1. User registered with Google (branch not selected during signup)
2. User logging in for the first time after Google registration
3. User has empty/null branch value in database

### Branch Selection Process

**Steps:**

1. **Modal Display**
   - Shows two options: Gil Puyat and Guadalupe
   - Displays user's email for confirmation
   - Both options clearly described

2. **Selection**
   - User clicks on preferred branch
   - Visual feedback shows selection
   - "Continue" button activates

3. **Backend Update**
   - PATCH request to `/api/auth/update-branch`
   - Updates user's branch in MongoDB
   - Returns updated user data

4. **Success**
   - Shows success notification
   - Updates localStorage with new user data
   - Redirects to selected branch page

5. **Error Handling**
   - Network error → Shows retry message
   - Session expired → Redirects to signin
   - Other errors → Clear error message with retry

---

## Cross-Login Compatibility

### Google Registration → Email/Password Login

**Scenario:** User registered with Google, wants to login with email/password

**How it works:**

1. When user registers with Google:
   - Firebase creates account with Google provider
   - Email is automatically verified
   - Password can be set later via Firebase "Reset Password"

2. To enable email/password login:
   - User must use "Forgot Password" on login page
   - Firebase sends password reset link
   - User sets password
   - Can now login with email/password

**Current Implementation:**

- Google registration creates Firebase account
- Email is verified automatically
- User CAN login with email/password if they set a password
- No password is set during Google registration
- Users need to use password reset to set initial password

---

## Email Verification

### For Email/Password Registration

- Firebase sends verification email automatically
- User must verify before logging in
- Login checks `firebaseUser.emailVerified` status
- Unverified users are signed out with warning

### For Google Registration

- Email automatically verified by Google
- No additional verification needed
- `emailVerified` is true from Google auth

---

## Error Handling Strategy

### 1. User-Friendly Messages

All errors display clear, actionable messages:

- ❌ "Invalid email or password" (not technical error codes)
- ✅ "Your email is not verified. Please check your inbox."
- ℹ️ "No account found. Please register first."

### 2. Graceful Degradation

System handles failures safely:

- Firebase failure → Clean up and show error
- Backend failure → Rollback Firebase changes
- Network error → Clear message, retry option
- Session expiry → Redirect to signin

### 3. Logging

Comprehensive console logging:

- 🔹 Info messages
- ✅ Success messages
- ⚠️ Warnings
- ❌ Errors
- All with emoji indicators for easy identification

### 4. Rollback Mechanism

If any step fails after Firebase account creation:

- System attempts to delete Firebase account
- If delete fails, user is signed out
- No orphaned accounts in Firebase
- No inconsistent state between Firebase and MongoDB

---

## Security Features

### 1. Email Verification

- Required for all email/password registrations
- Prevents spam and fake accounts
- Verified automatically for Google auth

### 2. Token-Based Authentication

- Firebase ID tokens used for API authentication
- Tokens verified on backend via Firebase Admin SDK
- Short-lived tokens, auto-refreshed

### 3. Branch Assignment

- Branch cannot be changed without authentication
- Requires valid Firebase token
- Backend validates branch values

### 4. Account Status

- Inactive accounts cannot login
- Backend checks `isActive` status
- Admin can deactivate accounts

---

## API Endpoints

### POST /api/auth/register

- Registers new user in MongoDB
- Requires valid Firebase token
- Validates branch if provided
- Returns user data

### POST /api/auth/login

- Authenticates existing user
- Syncs email verification status
- Checks account active status
- Returns user data with branch

### PATCH /api/auth/update-branch

- Updates user's branch selection
- Requires authentication
- Validates branch value
- Returns updated user data

---

## Notification Types

### Success (Green)

- ✅ Account created successfully
- ✅ Login successful
- ✅ Branch selected

### Info (Blue)

- ℹ️ Account already exists, redirecting to signin
- ℹ️ Sign-in cancelled

### Warning (Orange)

- ⚠️ Email not verified
- ⚠️ Please verify your email

### Error (Red)

- ❌ Invalid credentials
- ❌ Network error
- ❌ Registration failed

---

## Testing Scenarios

### Test Case 1: Standard Registration

1. Fill signup form
2. Verify email sent
3. Click verification link
4. Login with credentials
5. Redirected to branch page

### Test Case 2: Google Registration → Google Login

1. Click "Continue with Google"
2. Select Google account
3. Redirected to signin
4. Click "Continue with Google" again
5. Select branch
6. Redirected to branch page

### Test Case 3: Google Registration → Email Login

1. Register with Google
2. Use "Forgot Password" to set password
3. Login with email/password
4. Select branch (if not selected)
5. Redirected to branch page

### Test Case 4: Error Recovery

1. Start registration
2. Simulate network error
3. Verify Firebase account not created
4. Retry registration
5. Success

### Test Case 5: Branch Selection

1. Login as user without branch
2. Modal appears
3. Select branch
4. Branch saved
5. Redirected correctly

---

## Common Issues & Solutions

### Issue: "Email not verified" on login

**Solution:** User must click verification link in email before logging in

### Issue: Google sign-in popup blocked

**Solution:** Allow popups for the site in browser settings

### Issue: "Account not found" after Google signup

**Solution:** Wait a moment and try again; check network connection

### Issue: Branch not saving

**Solution:** Check network connection; verify authentication token is valid

### Issue: "Session expired" during branch selection

**Solution:** Re-login to get fresh authentication token

---

## Future Enhancements

1. **Password Reset Flow**
   - Implement custom password reset page
   - Email template customization

2. **Account Linking**
   - Link Google account to existing email/password account
   - Unified account management

3. **Multi-Factor Authentication**
   - SMS verification option
   - TOTP authenticator app support

4. **Social Login Expansion**
   - Facebook login
   - Apple Sign-In

5. **Branch Transfer**
   - Allow users to request branch change
   - Admin approval workflow

---

## Support & Troubleshooting

For issues with authentication:

1. Check console logs for detailed error messages
2. Verify Firebase configuration in `.env`
3. Ensure backend server is running
4. Check MongoDB connection
5. Verify Firebase Admin SDK credentials

---

**Last Updated:** February 1, 2026
**Version:** 2.0.0
