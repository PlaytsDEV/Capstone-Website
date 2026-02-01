# Authentication Flow - Visual Guide

## 🎯 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER STARTS HERE                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Sign In/Sign Up   │
                    │       Page          │
                    └─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌──────────────────────┐
    │ Continue with     │       │  Email & Password    │
    │     Google        │       │     Registration     │
    └───────────────────┘       └──────────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌──────────────────────┐
    │ Google OAuth      │       │  Create Firebase     │
    │   Popup           │       │     Account          │
    └───────────────────┘       └──────────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌──────────────────────┐
    │ ✅ Auto-Verified  │       │  📧 Verification     │
    │ (Google verifies) │       │   Email Sent         │
    └───────────────────┘       └──────────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌──────────────────────┐
    │ Backend Creates   │       │  ⏳ Wait for User    │
    │ User (branch="")  │       │  to Verify Email     │
    └───────────────────┘       └──────────────────────┘
                │                           │
                └─────────┬─────────────────┘
                          ▼
            ┌──────────────────────────┐
            │  Is Email Verified?      │
            └──────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │           │
                   NO          YES
                    │           │
                    ▼           ▼
        ┌──────────────┐   ┌──────────────────┐
        │ ❌ Block     │   │ ✅ Allow Login    │
        │ "Verify      │   └──────────────────┘
        │  Email"      │               │
        └──────────────┘               ▼
                              ┌──────────────────┐
                              │  Check Branch    │
                              └──────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        │                             │
                   Empty Branch                   Has Branch
                        │                             │
                        ▼                             ▼
            ┌────────────────────┐       ┌────────────────────┐
            │  /branch-selection │       │   Check Role       │
            │       Page         │       └────────────────────┘
            └────────────────────┘                   │
                        │                ┌───────────┴──────────┐
                        ▼                │                      │
            ┌────────────────────┐      Admin                Tenant
            │  Select Branch:    │       │                      │
            │  • Gil Puyat       │       ▼                      ▼
            │  • Guadalupe       │  ┌──────────┐      ┌──────────────┐
            └────────────────────┘  │  Admin   │      │   Branch     │
                        │            │Dashboard │      │    Page      │
                        ▼            └──────────┘      │ /gil-puyat   │
            ┌────────────────────┐                     │ /guadalupe   │
            │ PATCH /api/auth/   │                     └──────────────┘
            │  update-branch     │
            └────────────────────┘
                        │
                        ▼
            ┌────────────────────┐
            │  Update User in    │
            │   localStorage     │
            └────────────────────┘
                        │
                        ▼
            ┌────────────────────┐
            │  Redirect to       │
            │  Selected Branch   │
            │  /gil-puyat or     │
            │  /guadalupe        │
            └────────────────────┘
```

---

## 🔄 Detailed Flow Steps

### Step 1: User Chooses Authentication Method

**Option A: Continue with Google**

```
✅ Instant verification (Google handles it)
✅ No password needed
✅ Secure OAuth flow
✅ Can login with Google anytime
❌ Cannot use email/password later (unless linked)
```

**Option B: Email & Password**

```
✅ Create custom password
✅ Can reset password if forgotten
✅ Full control over credentials
❌ Must verify email via link
⏳ Extra step: email verification
```

---

### Step 2: Email Verification Check

```javascript
// SignIn.jsx - Lines 140-165
if (!firebaseUser.emailVerified) {
  console.log("⚠️ Email not verified");

  // For email/password users
  if (firebaseUser.providerData[0]?.providerId === "password") {
    showNotification(
      "Please verify your email. Check your inbox for verification link.",
      "warning",
    );
  }

  // Sign out and prevent login
  await auth.signOut();
  setLoading(false);
  return;
}
```

**For Google:** `emailVerified = true` automatically ✅  
**For Email/Password:** `emailVerified = false` until user clicks link ❌

---

### Step 3: Branch Selection Check

```javascript
// SignIn.jsx - Lines 385-400
if (!loginResponse.user.branch || loginResponse.user.branch === "") {
  console.log("📍 Branch not selected, redirecting...");

  // Store auth data
  localStorage.setItem("authToken", token);
  localStorage.setItem("user", JSON.stringify(loginResponse.user));

  // Redirect to branch selection
  navigate("/tenant/branch-selection");
  return; // Stop execution - don't login yet
}
```

**Branch Empty:** → `/tenant/branch-selection` page  
**Branch Selected:** → Continue to appropriate page

---

### Step 4: Branch Selection Page

```javascript
// BranchSelection.jsx - Lines 40-70
useEffect(() => {
  const token = localStorage.getItem("authToken");
  const userStr = localStorage.getItem("user");

  // No auth - redirect to signin
  if (!token || !userStr) {
    navigate("/tenant/signin");
    return;
  }

  const user = JSON.parse(userStr);

  // Already has branch - redirect to branch page
  if (user.branch && user.branch !== "") {
    navigate(`/${user.branch}`);
  }
}, [navigate]);
```

**Session Validation:**

- ❌ No auth token → Redirect to `/tenant/signin`
- ✅ Has branch → Redirect to `/{branch}`
- ⏳ No branch → Show selection UI

---

### Step 5: Update Branch in Backend

```javascript
// BranchSelection.jsx - Lines 100-140
const handleContinue = async () => {
  const response = await fetch(`${API_URL}/api/auth/update-branch`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ branch: selectedBranch }),
  });

  const updatedUser = await response.json();

  // Update localStorage
  localStorage.setItem("user", JSON.stringify(updatedUser.user));

  // Redirect to selected branch
  navigate(`/${selectedBranch}`);
};
```

**Backend Updates:**

- MongoDB: `user.branch = "gil-puyat"` or `"guadalupe"`
- Returns updated user object
- Frontend stores in localStorage

---

### Step 6: Final Redirect

```javascript
// Based on user role and branch
if (user.role === "admin" || user.role === "superAdmin") {
  navigate("/admin/dashboard");
} else {
  navigate(`/${user.branch}`); // /gil-puyat or /guadalupe
}
```

**Possible Destinations:**

- `/admin/dashboard` - For admin users
- `/gil-puyat` - For tenants in Gil Puyat branch
- `/guadalupe` - For tenants in Guadalupe branch

---

## 🛡️ Security Checkpoints

### Checkpoint 1: Email Verification

```
Google Users:    ✅ Auto-passed (Google verifies)
Email/Password:  ⏳ Must click email link
Blocked Until:   Email verified = true
```

### Checkpoint 2: Backend Registration

```
Check:          User exists in MongoDB
If Not:         Show "Please register first"
If Yes:         Proceed to next checkpoint
```

### Checkpoint 3: Branch Assignment

```
Check:          user.branch !== ""
If Empty:       Redirect to branch selection
If Assigned:    Allow access to branch
Blocked Until:  Branch selected
```

### Checkpoint 4: Authentication Token

```
Check:          Valid Firebase JWT token
Stored In:      localStorage.authToken
Validated:      On every API request
Expires:        After 1 hour (Firebase default)
```

---

## 📊 State Management

### localStorage Keys

```javascript
{
  "authToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "1234567890",
    "branch": "gil-puyat",
    "role": "tenant",
    "isEmailVerified": true,
    "firebaseUid": "abc123xyz..."
  }
}
```

### Session Lifecycle

```
User Registers/Logs In
    ↓
authToken + user → localStorage
    ↓
Token valid for ~1 hour
    ↓
After expiry:
  • API requests fail with 401
  • User must login again
  • localStorage cleared
  • Redirect to /tenant/signin
```

---

## 🎭 User Scenarios

### Scenario 1: First-Time Google User

```
1. Click "Continue with Google" on signup
2. ✅ Account created (auto-verified)
3. → Redirect to /tenant/branch-selection
4. Select "Gil Puyat"
5. ✅ Branch updated
6. → Redirect to /gil-puyat
7. ✅ Can now access branch features
```

### Scenario 2: Returning Google User

```
1. Click "Continue with Google" on signin
2. ✅ Authenticated
3. ✅ Email verified (auto)
4. ✅ Branch exists (gil-puyat)
5. → Direct redirect to /gil-puyat
6. ✅ Instant access (no extra steps)
```

### Scenario 3: Google User Never Selected Branch

```
1. Registered with Google 2 days ago
2. Closed browser before selecting branch
3. Returns today, clicks "Continue with Google"
4. ✅ Authenticated
5. ❌ Branch empty
6. → Redirect to /tenant/branch-selection
7. Select "Guadalupe"
8. ✅ Branch updated
9. → Redirect to /guadalupe
```

### Scenario 4: Email/Password User

```
1. Register with email + password
2. 📧 Verification email sent
3. ⏳ Try to login immediately
4. ❌ Blocked: "Please verify your email"
5. ✅ Click link in email
6. ✅ Email verified
7. Login again
8. ❌ Branch empty
9. → Redirect to /tenant/branch-selection
10. Select branch
11. ✅ Branch updated
12. → Redirect to branch page
```

---

## 🚀 Quick Testing Commands

### Test Google Flow

```javascript
// In browser console after Google signup
console.log("Auth Token:", localStorage.getItem("authToken"));
console.log("User:", JSON.parse(localStorage.getItem("user")));
console.log(
  "Email Verified:",
  JSON.parse(localStorage.getItem("user")).isEmailVerified,
);
console.log("Branch:", JSON.parse(localStorage.getItem("user")).branch);
```

### Simulate Empty Branch

```javascript
// Force redirect to branch selection
const user = JSON.parse(localStorage.getItem("user"));
user.branch = "";
localStorage.setItem("user", JSON.stringify(user));
window.location.reload();
```

### Clear Session

```javascript
// Logout and clear all data
localStorage.removeItem("authToken");
localStorage.removeItem("user");
window.location.href = "/tenant/signin";
```

---

**Last Updated:** February 1, 2026  
**Visual Guide Version:** 1.0
