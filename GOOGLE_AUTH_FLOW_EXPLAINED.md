# Google Authentication Flow - Complete Guide

## 🔐 How Google Authentication Works

### Important Clarification

**You CANNOT get passwords from Google OAuth.** Google authentication works differently:

- Google handles all password security
- Your app receives a verified token from Google
- Firebase creates an account using Google's authentication
- **Google accounts are automatically email-verified** ✅

---

## 📋 Complete User Flows

### Flow 1: New User Signs Up with Google

```
User clicks "Continue with Google"
    ↓
Google OAuth popup appears
    ↓
User selects Google account
    ↓
✅ Firebase creates account (emailVerified = true automatically)
    ↓
Backend creates user record (branch = "")
    ↓
SUCCESS: "Account created successfully!"
    ↓
Redirect to /tenant/branch-selection
    ↓
User selects branch (Gil Puyat or Guadalupe)
    ↓
Backend updates user.branch
    ↓
Redirect to /{selectedBranch} (e.g., /gil-puyat)
```

**Key Points:**

- ✅ Email is **automatically verified** (Google verifies it)
- ✅ No verification email needed
- ✅ Branch is empty initially
- ✅ Must select branch before accessing site

---

### Flow 2: Existing Google User Logs In (Has Branch)

```
User clicks "Continue with Google" on Sign In page
    ↓
Google OAuth popup appears
    ↓
User selects Google account
    ↓
Firebase authenticates (emailVerified = true)
    ↓
Backend checks user exists ✅
    ↓
Backend checks user.branch ✅ (e.g., "gil-puyat")
    ↓
SUCCESS: "Welcome back, John!"
    ↓
Redirect to /gil-puyat (or /guadalupe based on branch)
```

**Key Points:**

- ✅ No email verification needed (Google handles it)
- ✅ No branch selection needed (already has branch)
- ✅ Direct login to branch page

---

### Flow 3: Existing Google User Logs In (No Branch Yet)

This happens when:

- User registered with Google earlier
- User closed browser before selecting branch
- User never completed the branch selection

```
User clicks "Continue with Google" on Sign In page
    ↓
Google OAuth popup appears
    ↓
User selects Google account
    ↓
Firebase authenticates (emailVerified = true)
    ↓
Backend checks user exists ✅
    ↓
Backend checks user.branch ❌ (empty string "")
    ↓
NOTIFICATION: "Please select your branch to continue"
    ↓
Redirect to /tenant/branch-selection
    ↓
User selects branch
    ↓
Backend updates user.branch
    ↓
Redirect to /{selectedBranch}
```

**Key Points:**

- ✅ Email already verified (from initial Google signup)
- ❌ Must select branch to proceed
- ✅ After selection, can login normally

---

### Flow 4: User Tries Email/Password After Google Signup

**This will NOT work by default.**

```
User registered with Google (email: john@gmail.com)
    ↓
User tries to login with email/password
    ↓
❌ FAILS: "Wrong password" or "User not found"
```

**Why?** Firebase keeps Google authentication and email/password authentication separate.

**Solution:** User must use "Continue with Google" to login if they registered with Google.

---

## 🔄 Can Google Users Use Email/Password Login?

### Option 1: Link Accounts (Advanced - Not Currently Implemented)

Firebase allows linking authentication methods:

- User signs up with Google
- Later, user can set a password
- Then user can login with either Google OR email/password

**This requires additional implementation.**

### Option 2: Current Behavior (Simple)

- **Google signup → Must use Google to login**
- **Email/password signup → Must use email/password to login**

**This is the current implementation** and is the standard approach for most applications.

---

## ✅ Current Implementation Status

### What's Working

#### Google Registration (SignUp.jsx)

```javascript
✅ User clicks "Continue with Google"
✅ Google popup authenticates user
✅ Firebase account created (emailVerified = true automatically)
✅ Backend creates user with branch = ""
✅ Redirects to /tenant/branch-selection
✅ Rollback: If backend fails, Firebase account is deleted
```

#### Google Login (SignIn.jsx)

```javascript
✅ User clicks "Continue with Google"
✅ Firebase authenticates
✅ Checks emailVerified (always true for Google)
✅ Backend checks if user exists
✅ If no branch → Redirect to /tenant/branch-selection
✅ If has branch → Redirect to branch page or /admin/dashboard
✅ If account doesn't exist → Show "Please register first"
```

#### Branch Selection (BranchSelection.jsx)

```javascript
✅ Validates auth token on mount
✅ If no auth → Redirect to /tenant/signin
✅ If already has branch → Redirect to branch page
✅ User selects branch
✅ PATCH /api/auth/update-branch
✅ Updates localStorage with new user data
✅ Redirects to selected branch page
```

---

## 🚨 Important Security Notes

### Email Verification

- **Google accounts:** Automatically verified ✅
- **Email/password accounts:** Must verify via email link ✅
- **Verification enforced:** Cannot login until verified ✅

### Branch Selection

- **Required step** for all users
- Cannot access branch pages without selecting branch
- Cannot dismiss or skip branch selection
- Session validated on branch selection page

### Token Management

```javascript
// Stored in localStorage
authToken: "Firebase JWT token"
user: {
  id: "...",
  email: "user@gmail.com",
  firstName: "John",
  lastName: "Doe",
  branch: "gil-puyat", // or "guadalupe" or ""
  role: "tenant", // or "admin", "superAdmin"
  isEmailVerified: true
}
```

---

## 📱 User Experience Summary

### For Google Users

| Action             | Result                           |
| ------------------ | -------------------------------- |
| First time signup  | → Branch selection → Branch page |
| Login (has branch) | → Branch page directly           |
| Login (no branch)  | → Branch selection → Branch page |
| Try email/password | ❌ Fails (must use Google)       |

### For Email/Password Users

| Action                          | Result                            |
| ------------------------------- | --------------------------------- |
| Signup                          | → Verification email sent         |
| Try login before verify         | ❌ Blocked: "Please verify email" |
| Login after verify (has branch) | → Branch page                     |
| Login after verify (no branch)  | → Branch selection → Branch page  |

---

## 🛠️ Testing Instructions

### Test 1: Google Registration Flow

1. Go to `/tenant/signup`
2. Click "Continue with Google"
3. Select Google account
4. **Expected:** Redirect to `/tenant/branch-selection`
5. Select a branch
6. **Expected:** Redirect to `/gil-puyat` or `/guadalupe`

### Test 2: Google Login (Existing User with Branch)

1. Go to `/tenant/signin`
2. Click "Continue with Google"
3. Select same Google account from Test 1
4. **Expected:** Direct redirect to your branch page

### Test 3: Google Login (User Without Branch)

1. In browser console: `localStorage.setItem('user', JSON.stringify({...JSON.parse(localStorage.getItem('user')), branch: ''}))`
2. Refresh page
3. Click "Continue with Google"
4. **Expected:** Redirect to `/tenant/branch-selection`
5. Select branch
6. **Expected:** Redirect to branch page

### Test 4: Email Verification Enforcement

1. Create new account with email/password
2. Try to login immediately
3. **Expected:** "Please verify your email" error
4. Check email and click verification link
5. Login again
6. **Expected:** Success → Branch selection or branch page

---

## 🔍 Troubleshooting

### "No account found" after Google signup

- **Cause:** Backend registration failed
- **Check:** Server logs for errors
- **Fix:** Check MongoDB connection and User model

### Email not verified for Google users

- **This should never happen** - Google accounts are auto-verified
- **If it does:** Check Firebase console > Authentication > User
- **Verify:** `emailVerified` should be `true`

### User stuck on branch selection

- **Cause:** Branch update failing
- **Check:** Browser console for network errors
- **Verify:** PATCH `/api/auth/update-branch` endpoint is working
- **Check:** Auth token is valid

### Google popup blocked

- **Cause:** Browser blocking popups
- **Fix:** Allow popups for your site
- **Alternative:** Use redirect-based auth instead of popup

---

## 📊 Backend API Endpoints

### POST /api/auth/register

Used for: Email/password AND Google registration

```javascript
Request:
{
  email: "user@gmail.com",
  firstName: "John",
  lastName: "Doe",
  phone: "1234567890",
  branch: "", // Empty for Google, selected for email/password
  firebaseUid: "firebase-uid-here"
}

Response:
{
  message: "User registered successfully",
  user: { id, email, firstName, lastName, branch, role, isEmailVerified }
}
```

### POST /api/auth/login

Used for: Both Google and email/password login

```javascript
Request:
{
  token: "firebase-jwt-token"
}

Response:
{
  message: "Login successful",
  user: { id, email, firstName, lastName, branch, role, isEmailVerified }
}
```

### PATCH /api/auth/update-branch

Used for: Branch selection after login

```javascript
Request:
{
  branch: "gil-puyat" | "guadalupe"
}

Headers:
{
  Authorization: "Bearer <firebase-token>"
}

Response:
{
  message: "Branch updated successfully",
  user: { ...updatedUser }
}
```

---

## 📝 Summary

### ✅ What Works

- Google registration with auto-verification
- Google login with branch checking
- Email verification enforcement
- Branch selection flow
- Proper redirects based on user state

### ❌ What Doesn't Work (By Design)

- Using email/password to login after Google signup
- Skipping email verification
- Skipping branch selection
- Accessing branch pages without authentication

### 🎯 Key Takeaways

1. **Google = Auto Verified** - No verification emails needed
2. **Branch Selection = Required** - All users must select branch
3. **Separate Auth Methods** - Google signup = Google login only
4. **Session Validation** - Branch selection page validates auth state
5. **Security First** - Email verification and branch validation enforced

---

**Last Updated:** February 1, 2026  
**Status:** ✅ Fully Implemented and Tested
