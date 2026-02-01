# Quick Testing Guide - Branch Selection Page

## Test the Complete Flow

### 1. Test Google Registration → Branch Selection

```
1. Navigate to http://localhost:3000/tenant/signup
2. Click "Sign up with Google"
3. Complete Google authentication
4. Should redirect to: /tenant/branch-selection
5. Select "Gil Puyat" or "Guadalupe"
6. Should redirect to: /gil-puyat or /guadalupe
```

**Expected Results:**

- ✅ Smooth transition from signup to branch selection
- ✅ Branch selection page loads without errors
- ✅ Can select and submit branch
- ✅ Redirects to selected branch page

---

### 2. Test Google Login (No Branch)

```
1. Use a Google account that was registered but hasn't selected branch
2. Navigate to http://localhost:3000/tenant/signin
3. Click "Sign in with Google"
4. Should redirect to: /tenant/branch-selection
5. Select branch
6. Should redirect to branch page
```

---

### 3. Test Direct Navigation (No Auth)

```
1. Clear localStorage (or use incognito)
2. Navigate to http://localhost:3000/tenant/branch-selection
3. Should redirect to: /tenant/signin
4. Should show notification: "Please sign in first"
```

---

### 4. Test Direct Navigation (Already Has Branch)

```
1. Login with account that already has branch
2. Manually navigate to: /tenant/branch-selection
3. Should auto-redirect to: /gil-puyat or /guadalupe
```

---

### 5. Test Error Handling

```
1. Navigate to branch selection page
2. Turn off backend server (kill port 5000)
3. Try to select a branch
4. Should show error: "Network error. Please check your connection."
5. Should NOT crash or freeze
```

---

## Common Issues & Fixes

### Issue: "Cannot GET /tenant/branch-selection"

**Cause:** React Router not handling route  
**Fix:** Make sure you're using the dev server (npm start), not opening HTML directly

### Issue: Page immediately redirects to signin

**Cause:** No auth token in localStorage  
**Fix:** Complete signup/signin first before accessing branch selection

### Issue: Page redirects to branch page automatically

**Cause:** User already has branch selected  
**Fix:** This is expected behavior - use a fresh account without branch

### Issue: "Network error" when selecting branch

**Cause:** Backend server not running  
**Fix:** Start backend server: `cd server && npm start`

---

## Browser Console Logs

### Successful Flow

```
📍 Session validated. User: user@example.com
🏢 Branch selected: gil-puyat
📍 Updating branch in backend...
✅ Branch updated successfully!
🔄 Redirecting to /gil-puyat
```

### No Authentication

```
⚠️ No authentication found, redirecting to signin
```

### Already Has Branch

```
ℹ️ User already has branch: gil-puyat. Redirecting...
```

---

## API Calls to Verify

Open Network tab in DevTools:

### 1. Branch Selection

```
Request:
PATCH http://localhost:5000/api/auth/update-branch
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
  { "branch": "gil-puyat" }

Response (200):
  {
    "message": "Branch updated successfully",
    "user": { ...user data with branch... }
  }
```

---

## Quick Checklist

- [ ] Can register with Google
- [ ] Redirects to branch selection after Google signup
- [ ] Can select Gil Puyat branch
- [ ] Can select Guadalupe branch
- [ ] Shows loading spinner during API call
- [ ] Redirects to correct branch page after selection
- [ ] Session validation works (redirects if no auth)
- [ ] Error messages appear when backend is down
- [ ] Mobile responsive (test on small screen)
- [ ] No console errors

---

## Reset Test Data

To test again with the same Google account:

```javascript
// In browser console
localStorage.clear();

// Or manually set branch to empty:
const user = JSON.parse(localStorage.getItem("user"));
user.branch = "";
localStorage.setItem("user", JSON.stringify(user));
```

Then reload the page or navigate to `/tenant/branch-selection`.

---

**Pro Tip:** Use Chrome DevTools Device Toolbar to test mobile responsiveness (F12 → Toggle Device Toolbar or Ctrl+Shift+M)
