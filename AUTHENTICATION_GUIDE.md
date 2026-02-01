# Authentication Implementation Guide

## Overview

The authentication system uses **Firebase Authentication** for user authentication and **MongoDB** for storing user data. The backend verifies Firebase tokens and manages user roles.

## Authentication Flow

### Registration Flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────┐
│   Client    │      │   Firebase   │      │   Backend   │      │ MongoDB  │
│  (SignUp)   │      │     Auth     │      │     API     │      │          │
└──────┬──────┘      └──────┬───────┘      └──────┬──────┘      └────┬─────┘
       │                    │                     │                   │
       │  1. Register       │                     │                   │
       ├───────────────────>│                     │                   │
       │                    │                     │                   │
       │  2. User Created   │                     │                   │
       │  + Firebase UID    │                     │                   │
       │<───────────────────┤                     │                   │
       │                    │                     │                   │
       │  3. Get ID Token   │                     │                   │
       ├───────────────────>│                     │                   │
       │<───────────────────┤                     │                   │
       │                    │                     │                   │
       │  4. POST /auth/register                  │                   │
       │  (with token + user data)                │                   │
       ├─────────────────────────────────────────>│                   │
       │                    │                     │                   │
       │                    │      5. Verify Token│                   │
       │                    │<────────────────────┤                   │
       │                    │                     │                   │
       │                    │                     │  6. Save User     │
       │                    │                     ├──────────────────>│
       │                    │                     │                   │
       │                    │                     │  7. User Saved    │
       │                    │                     │<──────────────────┤
       │                    │                     │                   │
       │  8. Success + User Data                  │                   │
       │<─────────────────────────────────────────┤                   │
       │                    │                     │                   │
       │  9. Store user &   │                     │                   │
       │     Redirect       │                     │                   │
       └────────────────────┴─────────────────────┴───────────────────┘
```

### Login Flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────┐
│   Client    │      │   Firebase   │      │   Backend   │      │ MongoDB  │
│  (SignIn)   │      │     Auth     │      │     API     │      │          │
└──────┬──────┘      └──────┬───────┘      └──────┬──────┘      └────┬─────┘
       │                    │                     │                   │
       │  1. Sign In        │                     │                   │
       ├───────────────────>│                     │                   │
       │                    │                     │                   │
       │  2. Authenticated  │                     │                   │
       │  + Firebase UID    │                     │                   │
       │<───────────────────┤                     │                   │
       │                    │                     │                   │
       │  3. Get ID Token   │                     │                   │
       ├───────────────────>│                     │                   │
       │<───────────────────┤                     │                   │
       │                    │                     │                   │
       │  4. POST /auth/login (with token)        │                   │
       ├─────────────────────────────────────────>│                   │
       │                    │                     │                   │
       │                    │      5. Verify Token│                   │
       │                    │<────────────────────┤                   │
       │                    │                     │                   │
       │                    │                     │  6. Get User Data │
       │                    │                     ├──────────────────>│
       │                    │                     │                   │
       │                    │                     │  7. User Data     │
       │                    │                     │<──────────────────┤
       │                    │                     │                   │
       │  8. Success + User Data                  │                   │
       │<─────────────────────────────────────────┤                   │
       │                    │                     │                   │
       │  9. Store user &   │                     │                   │
       │     Redirect       │                     │                   │
       └────────────────────┴─────────────────────┴───────────────────┘
```

## Implementation Details

### Frontend (React)

#### SignUp Component

**Location**: `web/src/features/public/pages/SignUp.jsx`

**Features**:

- Email/Password registration
- Google Sign-In integration
- Facebook Sign-In integration
- Automatic backend registration
- User data storage in localStorage
- Role-based redirection

**Key Functions**:

```javascript
handleSubmit(); // Email/password registration
handleSocialSignUp(); // Google/Facebook registration
```

#### SignIn Component

**Location**: `web/src/features/public/pages/SignIn.jsx`

**Features**:

- Email/Password login
- Google Sign-In
- Facebook Sign-In
- Backend verification
- User data retrieval
- Role-based redirection (admin → /admin/dashboard, user → /)

**Key Functions**:

```javascript
handleSubmit(); // Email/password login
handleSocialSignIn(); // Google/Facebook login
```

#### Auth Utilities

**Location**: `web/src/shared/utils/auth.js`

**Functions**:

- `logout()` - Sign out and clear storage
- `getCurrentUser()` - Get user from localStorage
- `isLoggedIn()` - Check if user is authenticated
- `isAdmin()` - Check if user has admin role
- `isSuperAdmin()` - Check if user has super admin role

#### API Client

**Location**: `web/src/shared/api/apiClient.js`

**Auth Endpoints**:

```javascript
authApi.login(); // POST /auth/login
authApi.register(data); // POST /auth/register
authApi.getProfile(); // GET /auth/profile
authApi.updateProfile(); // PUT /auth/profile
```

### Backend (Express)

#### Auth Routes

**Location**: `server/routes/auth.js`

**Endpoints**:

1. **POST /api/auth/register** (Protected)
   - Requires Firebase ID token
   - Creates user record in MongoDB
   - Returns user data
   - Handles duplicate registrations

2. **POST /api/auth/login** (Protected)
   - Requires Firebase ID token
   - Verifies user exists in MongoDB
   - Checks if account is active
   - Returns user data with role

3. **GET /api/auth/profile** (Protected)
   - Returns current user profile
   - Requires valid token

4. **PUT /api/auth/profile** (Protected)
   - Updates user profile
   - Can update: firstName, lastName, phone

5. **POST /api/auth/set-role** (Protected, Admin Only)
   - Sets user role
   - Updates Firebase custom claims
   - Updates MongoDB user record

#### Middleware

**Location**: `server/middleware/auth.js`

**Functions**:

- `verifyToken()` - Verifies Firebase ID token
- `verifyAdmin()` - Checks admin role
- `verifySuperAdmin()` - Checks super admin role

### Database Schema

#### User Model

**Location**: `server/models/User.js`

**Fields**:

```javascript
{
  firebaseUid: String (unique, required),
  email: String (unique, required),
  firstName: String (required),
  lastName: String (required),
  phone: String,
  role: String (enum: ['tenant', 'admin', 'superAdmin']),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

## Usage Examples

### Registration Example

```javascript
// Frontend - SignUp.jsx
const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Create Firebase user
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // 2. Get token
  const idToken = await userCredential.user.getIdToken();
  localStorage.setItem("authToken", idToken);

  // 3. Register with backend
  const response = await authApi.register({
    email,
    firstName,
    lastName,
    phone,
  });

  // 4. Store user data
  localStorage.setItem("user", JSON.stringify(response.user));

  // 5. Redirect
  window.location.href = "/";
};
```

### Login Example

```javascript
// Frontend - SignIn.jsx
const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Sign in with Firebase
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // 2. Get token
  const idToken = await userCredential.user.getIdToken();
  localStorage.setItem("authToken", idToken);

  // 3. Verify with backend
  const response = await authApi.login();

  // 4. Store user data
  localStorage.setItem("user", JSON.stringify(response.user));

  // 5. Redirect based on role
  if (response.user.role === "admin") {
    window.location.href = "/admin/dashboard";
  } else {
    window.location.href = "/";
  }
};
```

### Logout Example

```javascript
// Using auth utility
import { logout } from "../shared/utils/auth";

const handleLogout = async () => {
  await logout(); // Clears Firebase session and localStorage, redirects to home
};
```

### Protected API Call Example

```javascript
// API client automatically includes token
const profile = await authApi.getProfile();

// Custom API call with authentication
const response = await fetch("/api/reservations", {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    "Content-Type": "application/json",
  },
});
```

## Role-Based Access Control

### User Roles

1. **tenant** (default) - Regular users
2. **admin** - Admin users with access to dashboard
3. **superAdmin** - Super admin with full access

### Setting Roles

Only authenticated users with admin/superAdmin role can set roles:

```javascript
// Backend endpoint
POST /api/auth/set-role
{
  "userId": "mongodb_user_id",
  "role": "admin" // or "superAdmin"
}
```

### Checking Roles (Frontend)

```javascript
import { isAdmin, isSuperAdmin } from "../shared/utils/auth";

if (isAdmin()) {
  // Show admin features
}

if (isSuperAdmin()) {
  // Show super admin features
}
```

## Security Features

### Token Management

- Firebase ID tokens stored in localStorage
- Tokens automatically included in API requests
- Backend verifies tokens on every protected request
- Tokens expire after 1 hour (Firebase default)

### Password Security

- Passwords handled entirely by Firebase
- Never stored or transmitted to backend
- Firebase enforces password strength requirements

### Account Status

- Users have `isActive` flag in database
- Inactive accounts cannot log in
- Can be used to suspend accounts

## Error Handling

### Common Errors

**Registration**:

- `User already registered` - User already exists in MongoDB
- `Email already exists` - Firebase email already in use
- `Weak password` - Password doesn't meet requirements

**Login**:

- `User not found in database` - Firebase user exists but not in MongoDB
- `Account is inactive` - User account is suspended
- `Invalid email or password` - Firebase authentication failed

**Token Errors**:

- `Token expired` - Firebase token expired, user needs to re-login
- `Invalid token` - Malformed or tampered token

## Testing

### Test Registration

1. Navigate to `/signup`
2. Fill in all required fields
3. Submit form
4. Check console for success message
5. Verify user in Firebase Console → Authentication
6. Verify user in MongoDB users collection

### Test Login

1. Navigate to `/signin`
2. Enter registered email/password
3. Submit form
4. Check redirect (admin → dashboard, user → home)
5. Verify localStorage has `authToken` and `user`

### Test Social Authentication

1. Enable provider in Firebase Console
2. Click social login button
3. Complete OAuth flow
4. Verify registration/login success
5. Check user data in database

## Troubleshooting

### "User not found in database" after login

**Cause**: User created in Firebase but registration to MongoDB failed  
**Solution**: Delete user from Firebase Console and re-register

### "Invalid API key" error

**Cause**: Firebase config in `.env` is incorrect  
**Solution**: Verify `REACT_APP_FIREBASE_API_KEY` in `web/.env`

### Token expired errors

**Cause**: Firebase tokens expire after 1 hour  
**Solution**: Implement token refresh or re-login flow

### CORS errors

**Cause**: Backend CORS not configured for frontend URL  
**Solution**: Check `FRONTEND_URL` in `server/.env`

---

**Last Updated**: January 31, 2026  
**Version**: 1.0  
**Status**: ✅ Fully Implemented
