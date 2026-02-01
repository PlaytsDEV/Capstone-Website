# Branch Selection Refactoring Summary

## Overview

Refactored the branch selection flow from a modal-based approach to a dedicated page to improve user experience and prevent runtime errors.

## Problem

- The `BranchSelectionModal` was causing a runtime error: **"onSelect is not a function"**
- Modal approach was not ideal for a critical registration step
- Branch selection should not be dismissible

## Solution

Created a dedicated **Branch Selection Page** with improved UX and error handling.

---

## Changes Made

### 1. Created New Branch Selection Page

**File:** `web/src/features/tenant/pages/BranchSelection.jsx`

**Features:**

- ✅ Full-page component (not a modal)
- ✅ Session validation on mount
- ✅ Automatic redirect if user already has a branch
- ✅ Loading states during API calls
- ✅ Error handling with user-friendly messages
- ✅ Branch selection with visual feedback
- ✅ Updates backend via `/api/auth/update-branch`
- ✅ Redirects to selected branch page after success

**Key Logic:**

```javascript
useEffect(() => {
  // Validate session on mount
  const token = localStorage.getItem("authToken");
  const userStr = localStorage.getItem("user");

  if (!token || !userStr) {
    // No session - redirect to signin
    navigate("/tenant/signin");
    return;
  }

  const user = JSON.parse(userStr);
  if (user.branch && user.branch !== "") {
    // Already has branch - redirect to branch page
    navigate(`/${user.branch}`);
  }
}, [navigate]);
```

### 2. Created Styling

**File:** `web/src/features/tenant/pages/BranchSelection.css`

**Features:**

- ✅ Gradient background (purple to violet)
- ✅ Card-based branch selection UI
- ✅ Hover effects and animations
- ✅ Loading spinner with fade-in animation
- ✅ Error message styling with shake animation
- ✅ Responsive design (mobile-friendly)

### 3. Updated App Routing

**File:** `web/src/App.js`

**Changes:**

```javascript
// Added import
import BranchSelection from "./features/tenant/pages/BranchSelection.jsx";

// Added route
<Route path="/tenant/branch-selection" element={<BranchSelection />} />;
```

### 4. Refactored SignIn.jsx

**File:** `web/src/features/tenant/pages/SignIn.jsx`

**Changes:**

- ❌ Removed `BranchSelectionModal` import
- ❌ Removed state variables: `showBranchModal`, `pendingFirebaseUser`
- ❌ Removed `handleBranchSelection` function
- ✅ Updated branch check logic to redirect instead of showing modal:

```javascript
// OLD APPROACH (Modal)
if (!loginResponse.user.branch || loginResponse.user.branch === "") {
  setPendingFirebaseUser({ firebaseUser, token });
  setShowBranchModal(true);
  return;
}

// NEW APPROACH (Page)
if (!loginResponse.user.branch || loginResponse.user.branch === "") {
  localStorage.setItem("authToken", token);
  localStorage.setItem("user", JSON.stringify(loginResponse.user));
  showNotification("Please select your branch to continue", "info");
  setTimeout(() => {
    navigate("/tenant/branch-selection");
  }, 500);
  return;
}
```

### 5. Updated SignUp.jsx

**File:** `web/src/features/tenant/pages/SignUp.jsx`

**Changes:**

- After Google registration, redirect to `/tenant/branch-selection` instead of `/tenant/signin`

```javascript
// OLD
navigate("/tenant/signin"); // Would show signin page, then modal

// NEW
navigate("/tenant/branch-selection"); // Goes directly to branch selection
```

---

## User Flow

### Before (Modal Approach)

```
Google Registration
  ↓
SignIn Page (auto-login)
  ↓
Branch Selection Modal appears
  ↓
Select branch → Update backend → Redirect
```

**Issues:**

- Modal could be dismissed accidentally
- Extra step (SignIn page)
- Caused "onSelect is not a function" error

### After (Page Approach)

```
Google Registration
  ↓
Branch Selection Page
  ↓
Select branch → Update backend → Redirect
```

**Benefits:**

- ✅ Cleaner flow (one less step)
- ✅ Cannot be dismissed
- ✅ Better UX (dedicated page)
- ✅ No runtime errors
- ✅ Automatic session validation

---

## API Integration

The branch selection page uses the existing backend endpoint:

**Endpoint:** `PATCH /api/auth/update-branch`

**Headers:**

```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"
}
```

**Request Body:**

```json
{
  "branch": "gil-puyat" | "guadalupe"
}
```

**Response:**

```json
{
  "message": "Branch updated successfully",
  "user": {
    "id": "...",
    "email": "...",
    "branch": "gil-puyat",
    ...
  }
}
```

---

## Testing Checklist

### ✅ Google Registration Flow

1. Click "Sign up with Google" on SignUp page
2. Complete Google authentication
3. Backend auto-registration with empty branch
4. Should redirect to `/tenant/branch-selection`
5. Select a branch (Gil Puyat or Guadalupe)
6. Should update backend and redirect to `/gil-puyat` or `/guadalupe`

### ✅ Google Login Without Branch

1. Use existing Google account (no branch selected)
2. Login on SignIn page
3. Should redirect to `/tenant/branch-selection`
4. Select branch → Redirect to branch page

### ✅ Email/Password Login Without Branch

1. Register with email/password
2. Verify email
3. Login on SignIn page
4. Should redirect to `/tenant/branch-selection`
5. Select branch → Redirect to branch page

### ✅ Session Validation

1. Navigate to `/tenant/branch-selection` without auth token
2. Should redirect to `/tenant/signin`

### ✅ Already Has Branch

1. Login with account that already has branch
2. Should NOT show branch selection page
3. Should redirect directly to branch page or admin dashboard

---

## Error Handling

The branch selection page handles:

### Network Errors

```javascript
if (
  error.message.includes("Failed to fetch") ||
  error.message.includes("Network")
) {
  showNotification("Network error. Please check your connection.", "error");
}
```

### Session Expiry

```javascript
if (response.status === 401 || response.status === 403) {
  showNotification("Session expired. Please sign in again.", "error");
  localStorage.clear();
  navigate("/tenant/signin");
}
```

### Backend Validation Errors

```javascript
if (response.status === 400) {
  const errorData = await response.json();
  showNotification(errorData.error || "Invalid branch selection", "error");
}
```

---

## Files Modified

| File                  | Changes                                    |
| --------------------- | ------------------------------------------ |
| `App.js`              | Added route and import for BranchSelection |
| `SignIn.jsx`          | Removed modal logic, added page redirect   |
| `SignUp.jsx`          | Updated Google registration redirect       |
| `BranchSelection.jsx` | **NEW** - Dedicated page component         |
| `BranchSelection.css` | **NEW** - Page styling                     |

---

## Cleanup Recommendations

### Optional (Low Priority)

You can delete the old modal files if not used elsewhere:

- `web/src/features/tenant/modals/BranchSelectionModal.jsx`
- `web/src/features/tenant/modals/BranchSelectionModal.css`

**Check first:**

```bash
# Search for any remaining usage
grep -r "BranchSelectionModal" web/src/
```

---

## Benefits Summary

✅ **Better UX** - Full-page experience instead of modal  
✅ **No Runtime Errors** - Eliminated "onSelect is not a function" error  
✅ **Cleaner Code** - Removed complex modal state management  
✅ **Session Security** - Automatic validation on page load  
✅ **Responsive Design** - Mobile-friendly layout  
✅ **Error Resilience** - Comprehensive error handling  
✅ **Faster Flow** - Direct navigation after Google registration

---

## Next Steps

1. ✅ Test the complete authentication flow
2. ✅ Verify mobile responsiveness
3. ⏳ Consider deleting old modal files (after verifying no usage)
4. ⏳ Add analytics tracking for branch selection
5. ⏳ Add loading skeletons for better perceived performance

---

## Notes

- The branch selection page validates the session on mount using `useEffect`
- If user manually navigates to `/tenant/branch-selection` without auth, they are redirected to signin
- If user already has a branch and navigates to this page, they are redirected to their branch page
- All notifications use the existing `showNotification` utility for consistency

---

**Date:** 2024  
**Status:** ✅ Complete and tested
