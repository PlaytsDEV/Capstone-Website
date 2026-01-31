/**
 * ============================================================================
 * FIREBASE EMAIL VERIFICATION - COMPLETE IMPLEMENTATION GUIDE
 * ============================================================================
 *
 * This guide shows how to implement email verification using Firebase Authentication
 * for an email/password login system.
 *
 * KEY PRINCIPLES:
 * 1. Firebase Auth is the SINGLE SOURCE OF TRUTH
 * 2. NO passwords are stored in the database
 * 3. Email verification is handled entirely by Firebase
 * 4. Backend syncs verification status from Firebase
 * ============================================================================
 */

// ============================================================================
// PART 1: FIREBASE CONFIGURATION
// ============================================================================

// File: firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export default app;

// ============================================================================
// PART 2: USER REGISTRATION WITH EMAIL VERIFICATION
// ============================================================================

/**
 * REGISTRATION FLOW:
 * 1. Create user in Firebase Auth
 * 2. Send verification email (Firebase handles this)
 * 3. Register user in backend database
 * 4. Sign out user (force them to verify before login)
 * 5. Redirect to login page
 */

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

const handleSignUp = async (email, password, userData) => {
  try {
    // STEP 1: Create user in Firebase Auth
    // Firebase automatically handles password hashing - NEVER store passwords yourself
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const firebaseUser = userCredential.user;
    console.log("✅ Firebase user created:", firebaseUser.uid);

    // STEP 2: Send verification email
    // Firebase sends a secure link to the user's email
    // User clicks link -> Firebase marks email as verified
    try {
      await sendEmailVerification(firebaseUser);
      console.log("✅ Verification email sent to:", firebaseUser.email);
    } catch (emailError) {
      console.error("⚠️ Failed to send verification email:", emailError);
      // Don't fail registration - user can resend from login page
    }

    // STEP 3: Register user in your backend database
    // Get Firebase token to authenticate with your backend
    const token = await firebaseUser.getIdToken();

    try {
      await registerUserInBackend(
        {
          ...userData,
          email: firebaseUser.email,
          firebaseUid: firebaseUser.uid,
        },
        token,
      );

      console.log("✅ User registered in backend database");
    } catch (backendError) {
      // IMPORTANT: If backend registration fails, rollback Firebase user
      console.error("❌ Backend registration failed, rolling back...");
      await firebaseUser.delete(); // Remove Firebase user
      throw backendError;
    }

    // STEP 4: Sign out user after registration
    // SECURITY: Force user to verify email before accessing the app
    await auth.signOut();
    console.log("✅ User signed out - must verify email before login");

    // STEP 5: Show success message and redirect
    alert(
      "Account created! Please check your email and click the verification link.",
    );
    // Redirect to login page
  } catch (error) {
    console.error("Registration error:", error);

    // Handle common Firebase errors
    if (error.code === "auth/email-already-in-use") {
      alert("This email is already registered. Please login instead.");
    } else if (error.code === "auth/weak-password") {
      alert("Password is too weak. Please use a stronger password.");
    } else if (error.code === "auth/invalid-email") {
      alert("Invalid email address.");
    } else {
      alert("Registration failed. Please try again.");
    }
  }
};

// ============================================================================
// PART 3: USER LOGIN WITH EMAIL VERIFICATION CHECK
// ============================================================================

/**
 * LOGIN FLOW:
 * 1. Sign in with Firebase
 * 2. Check if email is verified (CRITICAL SECURITY CHECK)
 * 3. If not verified: block access + offer resend option
 * 4. If verified: authenticate with backend and grant access
 */

import { signInWithEmailAndPassword } from "firebase/auth";

const handleLogin = async (email, password) => {
  try {
    // STEP 1: Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;
    console.log("✅ Firebase sign-in successful");

    // STEP 2: Check if email is verified
    // THIS IS THE KEY SECURITY CHECK - FIREBASE IS THE SOURCE OF TRUTH
    if (!user.emailVerified) {
      console.log("❌ Email not verified for:", user.email);

      // Show user-friendly message
      alert(
        "Please verify your email before logging in. Check your inbox for the verification link.",
      );

      // STEP 3: Offer to resend verification email
      const shouldResend = confirm(
        "Haven't received the verification email?\\n\\nClick OK to resend the verification link.",
      );

      if (shouldResend) {
        try {
          await sendEmailVerification(user);
          alert(
            "Verification email sent! Please check your inbox (and spam folder).",
          );
          console.log("✅ Verification email resent to:", user.email);
        } catch (resendError) {
          console.error("Failed to resend verification email:", resendError);
          alert("Failed to resend email. Please try again later.");
        }
      }

      // STEP 4: Sign out unverified user (SECURITY BEST PRACTICE)
      await auth.signOut();
      return; // Block access
    }

    console.log("✅ Email verified, proceeding with login");

    // STEP 5: Get Firebase token for backend authentication
    const token = await user.getIdToken();

    // STEP 6: Authenticate with backend
    // Your backend will verify the token and return user data
    try {
      const response = await loginToBackend(token);

      // Store user data and token
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(response.user));

      console.log("✅ Login successful");

      // Redirect to dashboard or home page
    } catch (backendError) {
      // If backend authentication fails, sign out from Firebase
      await auth.signOut();
      throw backendError;
    }
  } catch (error) {
    console.error("Login error:", error);

    // Handle common Firebase errors
    if (error.code === "auth/user-not-found") {
      alert("No account found with this email.");
    } else if (error.code === "auth/wrong-password") {
      alert("Incorrect password.");
    } else if (error.code === "auth/invalid-email") {
      alert("Invalid email address.");
    } else if (error.code === "auth/too-many-requests") {
      alert("Too many failed attempts. Please try again later.");
    } else {
      alert("Login failed. Please try again.");
    }
  }
};

// ============================================================================
// PART 4: EDGE CASE HANDLING
// ============================================================================

/**
 * EDGE CASE 1: User closes app before verifying
 * SOLUTION: Email verification link remains valid
 * User can verify anytime, then login
 */

/**
 * EDGE CASE 2: User tries to login without verifying
 * SOLUTION: Login check blocks access and offers resend option
 * Implemented in handleLogin above
 */

/**
 * EDGE CASE 3: User verified email but status not updated
 * SOLUTION: Call user.reload() to refresh verification status
 */

import { reload } from "firebase/auth";

const checkVerificationStatus = async () => {
  const user = auth.currentUser;
  if (user) {
    // Reload user data from Firebase to get latest verification status
    await reload(user);
    console.log("Email verified:", user.emailVerified);
    return user.emailVerified;
  }
  return false;
};

/**
 * EDGE CASE 4: Verification email not received
 * SOLUTION: Resend functionality (implemented in login above)
 */

/**
 * EDGE CASE 5: User wants to change email
 * SOLUTION: Update email in Firebase, send new verification
 */

import { updateEmail, sendEmailVerification } from "firebase/auth";

const changeEmail = async (newEmail) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");

  try {
    // Update email in Firebase
    await updateEmail(user, newEmail);

    // Send verification to new email
    await sendEmailVerification(user);

    console.log("✅ Email updated, verification sent to:", newEmail);
  } catch (error) {
    console.error("Failed to update email:", error);
    throw error;
  }
};

// ============================================================================
// PART 5: BACKEND INTEGRATION (Node.js/Express)
// ============================================================================

/**
 * BACKEND RESPONSIBILITIES:
 * 1. Verify Firebase token
 * 2. Sync email verification status from Firebase
 * 3. Store user data (NO PASSWORDS!)
 * 4. Return user profile
 */

// File: server/routes/auth.js
import { auth } from "../config/firebase-admin.js"; // Firebase Admin SDK

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken; // Contains: uid, email, email_verified, etc.
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Registration endpoint
router.post("/register", verifyToken, async (req, res) => {
  try {
    const { username, firstName, lastName, phone, branch } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ firebaseUid: req.user.uid });
    if (existingUser) {
      return res.status(400).json({ error: "User already registered" });
    }

    // Create user in database
    // NOTE: Firebase is source of truth for email verification
    const user = new User({
      firebaseUid: req.user.uid,
      email: req.user.email, // From Firebase token
      username,
      firstName,
      lastName,
      phone,
      branch,
      role: "tenant",
      isEmailVerified: req.user.email_verified || false, // Synced from Firebase
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login endpoint
router.post("/login", verifyToken, async (req, res) => {
  try {
    // Find user in database
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found. Please register first." });
    }

    // Sync email verification status from Firebase (source of truth)
    const firebaseEmailVerified = req.user.email_verified || false;
    if (user.isEmailVerified !== firebaseEmailVerified) {
      user.isEmailVerified = firebaseEmailVerified;
      await user.save();
      console.log(
        "✅ Synced email verification for " +
          user.email +
          ": " +
          firebaseEmailVerified,
      );
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        branch: user.branch,
        role: user.role,
        isEmailVerified: user.isEmailVerified, // Synced from Firebase
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// ============================================================================
// PART 6: PROTECTING ROUTES
// ============================================================================

/**
 * Protect routes by checking authentication AND email verification
 */

import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Not logged in - redirect to login
        navigate("/signin");
      } else if (!user.emailVerified) {
        // Logged in but email not verified - redirect to verification page
        alert("Please verify your email before accessing this page.");
        navigate("/signin");
        auth.signOut(); // Sign out unverified user
      }
      // User is logged in AND email is verified - allow access
    });

    return () => unsubscribe();
  }, [navigate]);

  return children;
};

// Usage in routes:
// <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

// ============================================================================
// PART 7: FIREBASE BEST PRACTICES CHECKLIST
// ============================================================================

/**
 * ✅ DO:
 * - Use Firebase Auth as the single source of truth
 * - Send verification email immediately after registration
 * - Block unverified users from accessing protected routes
 * - Offer resend verification email option
 * - Sign out unverified users on login attempt
 * - Sync verification status from Firebase to your database
 * - Use Firebase Admin SDK on backend to verify tokens
 * - Handle all edge cases (email not received, user closes app, etc.)
 *
 * ❌ DON'T:
 * - Store passwords in your database (Firebase handles this)
 * - Trust client-side verification checks alone
 * - Allow unverified users to access protected routes
 * - Forget to handle verification email send failures
 * - Skip token verification on backend
 * - Store verification status only in your database (Firebase is source of truth)
 */

// ============================================================================
// PART 8: TESTING CHECKLIST
// ============================================================================

/**
 * Test these scenarios:
 *
 * 1. New user registration:
 *    - ✅ User receives verification email
 *    - ✅ User cannot login before verification
 *    - ✅ Verification link works correctly
 *
 * 2. Login attempts:
 *    - ✅ Unverified users are blocked
 *    - ✅ Verified users can login
 *    - ✅ Resend email option works
 *
 * 3. Edge cases:
 *    - ✅ User closes app before verifying
 *    - ✅ User tries multiple login attempts
 *    - ✅ Verification email not received
 *    - ✅ User verifies then logs in
 *
 * 4. Security:
 *    - ✅ Unverified users cannot access protected routes
 *    - ✅ Firebase token is required for backend calls
 *    - ✅ Email verification status is synced from Firebase
 */

// ============================================================================
// END OF GUIDE
// ============================================================================

export {
  handleSignUp,
  handleLogin,
  checkVerificationStatus,
  changeEmail,
  ProtectedRoute,
};
