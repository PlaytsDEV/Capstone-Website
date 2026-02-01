# 🔐 AUTHENTICATION QUICK REFERENCE

## 📋 10 REQUIREMENTS CHECKLIST

### ✅ 1. No Redirect on Gmail Signup (404 Error)

**When**: User clicks "Continue with Google" on signup page, but account doesn't exist  
**Expected**: Show error "No account found. Please register using the form above and select your branch."  
**NOT**: Redirect to signup page  
**File**: [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx) - Line 288

---

### ✅ 2. Email Verification Required

**When**: User registers with email/password  
**Expected**:

- Send verification email via Firebase
- Sign out user immediately
- Must verify email before login allowed
  **File**: [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx) - Lines 190-195

---

### ✅ 3. Branch Dropdown in Registration

**Field**: `<select name="branch">`  
**Options**:

- `gil-puyat` → "Gil Puyat • Makati"
- `guadalupe` → "Guadalupe • Makati"  
  **Validation**: Required field  
  **File**: [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx) - Lines 419-427

---

### ✅ 4. Branch Selection Modal for Gmail Login

**When**: Gmail login successful, but user.branch is null/empty  
**Component**: `<BranchSelectionModal />`  
**Action**: User selects branch → Calls `PATCH /api/auth/update-branch` → Redirects  
**Files**:

- [SignIn.jsx](web/src/features/tenant/pages/SignIn.jsx) - Lines 232-280
- [BranchSelectionModal.jsx](web/src/features/tenant/modals/BranchSelectionModal.jsx)

---

### ✅ 5. Phone Number Removed

**Removed From**:

- ❌ `formData.phone` state
- ❌ Phone input field
- ❌ Phone validation  
  **Backend**: Still accepts `phone` but sends empty string `""`  
  **File**: [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx)

---

### ✅ 6. Terms and Conditions Modal

**Component**: `<TermsModal isOpen={showTermsModal} onClose={...} />`  
**Trigger**: Click "Terms and Conditions" link (`.tenant-signup-link`)  
**Type**: Full-screen overlay with scrollable content  
**Sections**: 15 T&C sections  
**Files**:

- [TermsModal.jsx](web/src/features/tenant/modals/TermsModal.jsx)
- [TermsModal.css](web/src/features/tenant/modals/TermsModal.css)

---

### ✅ 7. Show/Hide Password Toggle

**Fields**:

- Password (signup)
- Confirm Password (signup)
- Password (signin)  
  **Icon**:
- 👁️ Eye (visible)
- 👁️‍🗨️ Eye-slash (hidden)  
  **Implementation**:

```jsx
<button onClick={() => setShowPassword(!showPassword)}>
  {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
</button>
```

**Files**:

- [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx) - Lines 431-467
- [SignIn.jsx](web/src/features/tenant/pages/SignIn.jsx) - Lines 391-427

---

### ✅ 8. Gmail Signup No Terms Checkbox Required

**Behavior**: Social signup bypasses `agreedToTerms` validation  
**Flow**: `handleSocialSignup()` does NOT check `agreedToTerms` state  
**Only Required For**: Email/password registration via `handleSignUp()`  
**File**: [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx)

---

### ✅ 9. Duplicate Account Prevention

**Check 1**: Firebase auth error `auth/email-already-in-use`  
**Message**: "This email is already registered. Please login instead."

**Check 2**: Social signup tries login first  
**If exists**: "Account already registered. Logging you in..."  
**Action**: Auto-login to existing account

**Backend**: MongoDB unique constraint on `email` field  
**File**: [SignUp.jsx](web/src/features/tenant/pages/SignUp.jsx) - Lines 217-220

---

### ✅ 10. Login with Username OR Email

**Field**: `<input name="identifier" placeholder="Email or Username" />`  
**Logic**:

1. Check if `identifier` matches email format (regex)
2. **If email**: Use directly for Firebase login
3. **If username**: Call `GET /api/users/email-by-username?username=...` → Get email → Use for Firebase login

**Helper Function**:

```javascript
const isEmail = (value) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};
```

**Files**:

- Frontend: [SignIn.jsx](web/src/features/tenant/pages/SignIn.jsx) - Lines 92-115
- Backend: [users.js](server/routes/users.js) - Lines 22-60

---

## 🔄 AUTHENTICATION FLOWS

### 📧 Email/Password Registration

```
1. Fill form (username, firstName, lastName, email, branch, password, confirmPassword)
2. Agree to Terms checkbox ✓
3. Click "Sign Up"
4. Create Firebase account → Register in backend → Send verification email
5. Sign out → Redirect to signin
6. Check email → Click verification link
7. Go to signin → Login with email + password
8. Check emailVerified === true → Allow login
```

### 🔑 Email/Password Login

```
1. Enter email/username + password
2. If username: GET /api/users/email-by-username → Get email
3. Firebase login with email
4. Check emailVerified
5. If verified: POST /api/auth/login → Store token → Redirect
6. If not verified: Sign out → Show warning
```

### 🔵 Gmail Login (Existing Account)

```
1. Click "Continue with Google"
2. Google popup → Select account
3. Get Firebase token
4. POST /api/auth/login
5. If success + branch exists → Redirect to /{branch}
6. If success + no branch → Show BranchSelectionModal
```

### 🔵 Gmail Login (New User)

```
1. Click "Continue with Google"
2. Google popup → Select account
3. Get Firebase token
4. POST /api/auth/login
5. If 404 → Sign out → Show error "No account found"
6. User stays on signin page (NO REDIRECT)
```

### 🔵 Gmail Signup (Existing Account)

```
1. Click "Continue with Google" on signup page
2. Google popup → Select account
3. Try POST /api/auth/login
4. If exists → Auto-login → Redirect
5. Show "Account already registered. Logging you in..."
```

### 🔵 Gmail Signup (New User)

```
1. Click "Continue with Google" on signup page
2. Google popup → Select account
3. Try POST /api/auth/login
4. If 404 → Sign out → Show error
5. "No account found. Please register using the form above and select your branch."
6. NO AUTO-REGISTRATION
```

---

## 🎯 KEY COMPONENTS

### 1. TermsModal.jsx

```jsx
<TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
```

- Full-screen overlay
- 15 sections of T&C
- Scrollable content
- Close button (X)

### 2. BranchSelectionModal.jsx

```jsx
<BranchSelectionModal
  isOpen={showBranchModal}
  onClose={() => setShowBranchModal(false)}
  onSelectBranch={(branch) => handleBranchSelection(branch)}
/>
```

- Radio button selection
- Two options: gil-puyat, guadalupe
- Confirm button
- Calls PATCH /api/auth/update-branch

---

## 🛠️ API ENDPOINTS

### GET /api/users/email-by-username

**Purpose**: Get email by username for login  
**Access**: Public (no auth)  
**Query**: `?username=johndoe`  
**Response**: `{ "email": "user@example.com" }`

### PATCH /api/auth/update-branch

**Purpose**: Update user branch for Gmail users  
**Access**: Authenticated (requires Firebase token)  
**Body**: `{ "branch": "gil-puyat" }`  
**Response**: `{ "message": "...", "user": {...} }`

---

## 🎨 CSS CLASSES

### Password Toggle

```css
.tenant-signup-password-wrapper    /* Wrapper for input + toggle */
.tenant-signup-password-toggle     /* Eye icon button */
.tenant-signin-password-wrapper    /* Signin wrapper */
.tenant-signin-password-toggle     /* Signin toggle */
```

### Branch Dropdown

```css
.tenant-signup-select              /* Branch select styling */
```

### Links

```css
.tenant-signup-link                /* Orange clickable text */
.tenant-signin-link                /* Orange clickable text */
```

---

## 🔍 VALIDATION RULES

### Registration Form

- ✅ Username: Required, min 3 characters
- ✅ First Name: Required
- ✅ Last Name: Required
- ✅ Email: Required, valid email format
- ✅ Branch: Required, must select one
- ✅ Password: Required, min 6 characters
- ✅ Confirm Password: Required, must match password
- ✅ Terms: Checkbox must be checked

### Login Form

- ✅ Email/Username: Required
- ✅ Password: Required

---

## 🐛 ERROR HANDLING

### Firebase Errors

- `auth/email-already-in-use` → "This email is already registered. Please login instead."
- `auth/invalid-email` → "Invalid email address."
- `auth/weak-password` → "Password is too weak. Please use a stronger password."
- `auth/invalid-credential` → "Invalid email/username or password"
- `auth/user-not-found` → "No account found with this email"
- `auth/wrong-password` → "Invalid password"
- `auth/too-many-requests` → "Too many failed login attempts. Please try again later."

### Backend Errors

- `404 USER_NOT_FOUND` → "Account not found in database. Please contact support."
- `400 DUPLICATE_FIELD` → "Email/Username already exists"
- `400 VALIDATION_ERROR` → "Validation failed"
- `404 USERNAME_NOT_FOUND` → "Username not found"

---

## 📱 RESPONSIVE DESIGN

### Signup/Signin Pages

- Desktop: Two-column layout (left = image, right = form)
- Mobile: Single column (image top, form bottom)
- Breakpoint: 900px

### Modals

- Terms: Full-screen on all devices
- Branch Selection: Centered modal (max-width: 500px)

---

## ✅ TESTING CHECKLIST

- [ ] Email registration → Verification email sent → Verify → Login
- [ ] Login with email → Success
- [ ] Login with username → Success (backend lookup)
- [ ] Login without verification → Error
- [ ] Gmail login (existing account) → Success
- [ ] Gmail login (new user) → Error shown, no redirect
- [ ] Gmail signup (existing account) → Auto-login
- [ ] Gmail signup (new user) → Error shown, no auto-register
- [ ] Duplicate email → Error
- [ ] Branch selection modal → Updates branch → Redirects
- [ ] Password toggle → Shows/hides password
- [ ] Terms modal → Opens → Scrolls → Closes
- [ ] Form validation → All fields required → Branch required

---

**Status**: ✅ All 10 Requirements Implemented  
**Last Updated**: 2024  
**Version**: 2.0.0
