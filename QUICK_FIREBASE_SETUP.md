# Quick Firebase Setup Instructions

## The Problem

Your `.env` file has placeholder values for Firebase credentials:

- `REACT_APP_FIREBASE_API_KEY=AIzaSyC_your_actual_api_key_here` ❌
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here` ❌
- `REACT_APP_FIREBASE_APP_ID=1:your_app_id_here` ❌

Without real credentials, Firebase authentication cannot work!

## Get Real Firebase Credentials (5 minutes)

### Step 1: Open Firebase Console

Go to: https://console.firebase.google.com/

### Step 2: Select Your Project

Click on: **dormitorymanagement-caps-572cf**

### Step 3: Go to Project Settings

1. Click the **⚙️ gear icon** next to "Project Overview"
2. Select **"Project settings"**

### Step 4: Get Web App Config

1. Scroll down to **"Your apps"** section
2. Look for a **web app** (</> icon)
   - If none exists, click **"Add app"** → Choose **Web** (</>) → Give it a name
3. Click on the web app to see the config
4. You'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCAbCdEfGh1234567890...", // ← Copy this!
  authDomain: "dormitorymanagement-caps-572cf.firebaseapp.com",
  projectId: "dormitorymanagement-caps-572cf",
  storageBucket: "dormitorymanagement-caps-572cf.appspot.com",
  messagingSenderId: "123456789012", // ← Copy this!
  appId: "1:123456789012:web:abc123def456...", // ← Copy this!
};
```

### Step 5: Update web/.env

Open `web/.env` and replace the placeholder values:

```env
REACT_APP_FIREBASE_API_KEY=AIzaSyCAbCdEfGh1234567890...  # Paste YOUR apiKey here
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012  # Paste YOUR messagingSenderId
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abc123def456...  # Paste YOUR appId
```

**IMPORTANT**:

- No quotes around the values
- No spaces before or after the = sign
- Copy the EXACT values from Firebase Console

### Step 6: Enable Email/Password Authentication

1. In Firebase Console, go to **"Authentication"** (left sidebar)
2. Click **"Sign-in method"** tab
3. Click on **"Email/Password"** provider
4. **Enable** the toggle switch
5. Click **"Save"**

### Step 7: Restart Frontend Server

```bash
# Stop the current server (Ctrl+C)
cd web
npm start
```

### Step 8: Test Registration!

1. Go to http://localhost:3000
2. Navigate to Sign Up
3. Fill in the form
4. Click "Create Account"
5. Check console for success message
6. Check Firebase Console → Authentication to see the new user

## That's It!

Once you have the real Firebase credentials, registration and login will work immediately.

---

**Current Status**:

- ✅ Backend code ready (MongoDB connected, all routes working)
- ✅ Frontend code ready (SignUp/SignIn components fully functional)
- ⏳ **Need Firebase credentials** (5 minutes to get from Console)

After adding credentials, both registration and login will work perfectly!
