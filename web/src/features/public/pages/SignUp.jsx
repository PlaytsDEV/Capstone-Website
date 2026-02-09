/**
 * =============================================================================
 * SIGN UP PAGE
 * =============================================================================
 *
 * User registration page with the following features:
 * - Email/password registration with email verification
 * - Google and Facebook social authentication
 * - Terms and Conditions modal
 * - Show/Hide password toggle
 * - Duplicate account prevention
 * - No phone number field
 * - Gmail registration doesn't require "Agree to Terms" checkbox
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Home } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../../../firebase/config";
import { showNotification } from "../../../shared/utils/notification";
import { authApi } from "../../../shared/api/apiClient";
import { useAuth } from "../../../shared/hooks/useAuth";
import TermsModal from "../../tenant/modals/TermsModal";
import "../styles/tenant-signup.css";
import "../../../shared/styles/notification.css";

function SignUp() {
  const navigate = useNavigate();
  const {
    login: loginBackend,
    setGlobalLoading,
    isAuthenticated,
    user,
    loading: authLoading,
  } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Session lock: Redirect if already logged in based on role
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      // If already authenticated, redirect based on role
      if (user.role === "admin" || user.role === "superAdmin") {
        console.log("🔒 Admin already logged in, redirecting to dashboard...");
        navigate("/admin/dashboard", { replace: true });
      } else {
        console.log("🔒 User already logged in, redirecting to home...");
        navigate("/", { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [fieldValid, setFieldValid] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    level: "weak",
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });
  const [debounceTimer, setDebounceTimer] = useState(null);

  /**
   * Advanced email validation
   * Checks for:
   * - Proper format
   * - Valid domain structure
   * - No consecutive dots
   * - Valid characters
   */
  const validateEmail = (email) => {
    if (!email || !email.trim()) return "Email is required";

    // Basic format check
    const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicRegex.test(email)) {
      return "Invalid email format";
    }

    // Advanced validation
    const parts = email.split("@");
    if (parts.length !== 2) return "Invalid email format";

    const [localPart, domain] = parts;

    // Check local part (before @)
    if (localPart.length === 0 || localPart.length > 64) {
      return "Invalid email format";
    }

    // Check domain part (after @)
    if (domain.length === 0 || domain.length > 255) {
      return "Invalid email domain";
    }

    // Check for valid domain structure
    const domainParts = domain.split(".");
    if (domainParts.length < 2) {
      return "Invalid email domain";
    }

    // Check each domain part
    for (let part of domainParts) {
      if (part.length === 0 || !/^[a-zA-Z0-9-]+$/.test(part)) {
        return "Invalid email domain";
      }
      if (part.startsWith("-") || part.endsWith("-")) {
        return "Invalid email domain";
      }
    }

    // Check TLD (top-level domain)
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      return "Invalid email domain";
    }

    // Check for consecutive dots
    if (email.includes("..")) {
      return "Invalid email format";
    }

    return null; // Valid
  };

  /**
   * Calculate password strength
   * Note: Special characters are encouraged but not required
   */
  const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?/]/;

  const calculatePasswordStrength = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: SPECIAL_CHARS_REGEX.test(password),
    };

    const metRequirements = Object.values(requirements).filter(Boolean).length;
    let score = 0;
    let level = "weak";

    // Minimum requirement: 6 characters
    // Strong password: 5/5 requirements
    // Medium password: 3-4 requirements
    // Weak password: 1-2 requirements
    if (metRequirements >= 5) {
      score = 100;
      level = "strong";
    } else if (metRequirements >= 3) {
      score = 60;
      level = "medium";
    } else if (metRequirements >= 1) {
      score = 30;
      level = "weak";
    }

    return { score, level, requirements };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Restrict phone field to numbers only
    if (name === "phone" && value && !/^[0-9]*$/.test(value)) {
      return; // Don't update if non-numeric
    }

    if (name === "phone" && value.length > 11) {
      return; // Enforce max 11 digits
    }

    // Sanitize name fields - allow only letters, spaces, hyphens, and apostrophes
    let sanitizedValue = value;
    if (name === "firstName" || name === "lastName") {
      sanitizedValue = value.replace(/[^a-zA-Z\s'-]/g, "");
    }

    setFormData({
      ...formData,
      [name]: sanitizedValue,
    });

    // Mark field as touched
    setTouched({
      ...touched,
      [name]: true,
    });

    // Clear previous debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Special handling for password field
    if (name === "password") {
      const strength = calculatePasswordStrength(value);
      setPasswordStrength(strength);
    }

    // Debounced validation (300ms delay)
    const timer = setTimeout(() => {
      validateField(name, value);
    }, 300);

    setDebounceTimer(timer);
  };

  /**
   * Real-time field validation
   */
  const validateField = (fieldName, value) => {
    let error = null;

    switch (fieldName) {
      case "firstName":
        if (!value.trim()) error = "First name is required";
        break;

      case "lastName":
        if (!value.trim()) error = "Last name is required";
        break;

      case "email":
        error = validateEmail(value);
        break;

      case "phone":
        if (!value.trim()) {
          error = "Phone number is required";
        } else if (!/^[0-9]{11}$/.test(value)) {
          error = "Phone must be exactly 11 digits";
        }
        break;

      case "password":
        if (!value) {
          error = "Password is required";
        } else if (value.length < 6) {
          error = "Password must be at least 6 characters";
        }
        // Re-validate confirm password if it's already filled
        if (formData.confirmPassword) {
          validateField("confirmPassword", formData.confirmPassword);
        }
        break;

      case "confirmPassword":
        if (!value) {
          error = "Please confirm your password";
        } else if (value !== formData.password) {
          error = "Passwords do not match";
        }
        break;

      default:
        // No validation for other fields
        break;
    }

    setValidationErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));

    setFieldValid((prev) => ({
      ...prev,
      [fieldName]: !error,
    }));
  };

  /**
   * Check if form is valid for submission
   */
  const isFormValid = () => {
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",

      "password",
      "confirmPassword",
    ];
    return requiredFields.every((field) => fieldValid[field]) && agreedToTerms;
  };

  /**
   * Validate registration form
   * - All fields required
   * - Email must be valid
   * - Password minimum 6 characters
   * - Passwords must match
   * - Terms must be agreed to
   * - Branch must be selected
   */
  const validateForm = () => {
    // Mark all fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });

    // Validate all fields
    validateField("firstName", formData.firstName);
    validateField("lastName", formData.lastName);
    validateField("email", formData.email);
    validateField("phone", formData.phone);
    validateField("password", formData.password);
    validateField("confirmPassword", formData.confirmPassword);

    if (!formData.firstName.trim()) {
      showNotification("First name is required", "error");
      return false;
    }
    if (!formData.lastName.trim()) {
      showNotification("Last name is required", "error");
      return false;
    }

    const emailError = validateEmail(formData.email);
    if (emailError) {
      showNotification(emailError, "error");
      return false;
    }

    if (!formData.phone.trim()) {
      showNotification("Phone number is required", "error");
      return false;
    }

    // Validate phone format (numbers only, 11 digits max)
    const phoneRegex = /^[0-9]{1,11}$/;
    if (!phoneRegex.test(formData.phone)) {
      showNotification("Phone number must be 1-11 digits only", "error");
      return false;
    }

    if (!formData.password) {
      showNotification("Password is required", "error");
      return false;
    }
    if (formData.password.length < 6) {
      showNotification("Password must be at least 6 characters", "error");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      showNotification("Passwords do not match", "error");
      return false;
    }
    if (!agreedToTerms) {
      showNotification("Please agree to Terms and Conditions", "error");
      return false;
    }
    return true;
  };

  /**
   * Register user in backend database
   */
  const registerUserInBackend = async (
    firebaseUser,
    phone,
    firstName,
    lastName,
  ) => {
    try {
      const token = await firebaseUser.getIdToken();

      // Generate safe username from email - sanitize to alphanumeric and underscore
      const emailBase = firebaseUser.email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_]/g, "");
      const username = emailBase + Math.floor(Math.random() * 1000);

      // Sanitize names - remove any potentially dangerous characters
      // Add safety check for undefined values
      const sanitizedFirstName = (firstName || "")
        .replace(/[^a-zA-Z\s'-]/g, "")
        .trim();
      const sanitizedLastName = (lastName || "")
        .replace(/[^a-zA-Z\s'-]/g, "")
        .trim();

      const response = await authApi.register(
        {
          email: firebaseUser.email,
          username: username,
          firstName: sanitizedFirstName,
          lastName: sanitizedLastName,
          phone: phone,
        },
        token,
      );

      // Store user data
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(response.user));

      return response.user;
    } catch (error) {
      console.error("❌ Backend registration error:", error);
      throw error;
    }
  };

  /**
   * Handle email/password registration
   * - Create Firebase account
   * - Send email verification
   * - Register in backend
   * - Email verification REQUIRED before login
   */
  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    let firebaseUser = null;

    try {
      // STEP 1: Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      firebaseUser = userCredential.user;

      // STEP 2: Register in backend - if this fails, rollback Firebase user
      try {
        await registerUserInBackend(
          firebaseUser,

          formData.phone,
          formData.firstName,
          formData.lastName,
        );

        // STEP 3: Send Firebase email verification link
        try {
          await sendEmailVerification(firebaseUser);
          console.log("✅ Verification email sent to:", firebaseUser.email);
        } catch (emailError) {
          console.error("⚠️ Failed to send verification email:", emailError);
          // Don't fail registration if email sending fails
        }

        showNotification(
          "Account created successfully! Please check your email and verify before logging in.",
          "success",
        );

        // STEP 4: Sign out user after registration
        // They must verify email before logging in
        await auth.signOut();

        // Set global loading before redirect
        setTimeout(() => {
          setGlobalLoading(true);
          navigate("/signin");
        }, 2500);
      } catch (backendError) {
        // Rollback: Delete the Firebase user if backend registration fails
        console.error(
          "❌ Backend registration failed, rolling back Firebase user:",
          backendError,
        );
        if (firebaseUser) {
          await firebaseUser.delete();
        }
        throw backendError;
      }
    } catch (error) {
      console.error("❌ Signup error:", error);
      let errorMessage = "Registration failed. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage =
          "This email is already registered. Please login instead.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle social provider signup (Google/Facebook)
   *
   * GOOGLE REGISTRATION FLOW (ACCOUNT CREATION + IMMEDIATE AUTH):
   * - Creates Firebase Auth user and MongoDB record for new users
   * - If account already exists, redirects to sign-in page
   * - Social accounts are pre-verified, so no email verification needed
   * - After successful registration, logs in and redirects to home page
   *
   * REQUIREMENTS:
   * 1. Register with social provider creates account
   * 2. If account exists, redirect to sign in
   * 3. Auto-register for seamless user experience
   * 4. Keep Firebase session active after registration
   * 5. Redirect to home page after successful registration
   * 6. Robust error handling with user-friendly messages
   * 7. Rollback on failures
   */
  const handleSocialSignup = async (provider, providerName = "Google") => {
    setLoading(true);

    try {
      console.log(`🔹 Starting ${providerName} sign-up...`);

      // STEP 1: Authenticate with Firebase
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      console.log("✅ Firebase authentication successful:", firebaseUser.email);

      // Validate email exists
      if (!firebaseUser.email) {
        await auth.signOut();
        showNotification(
          "Unable to get email from your Google account. Please try again or contact support.",
          "error",
        );
        setLoading(false);
        return;
      }

      const token = await firebaseUser.getIdToken();

      try {
        // STEP 2: Check if account already exists in backend (without logging)
        console.log("🔍 Checking if account exists...");
        await authApi.checkUser(token);

        // If checkUser succeeds, account already exists
        console.log("⚠️ Account already exists");
        await auth.signOut();
        showNotification(
          "This email is already registered. Please sign in instead.",
          "info",
        );

        // Redirect to sign in page
        setTimeout(() => {
          navigate("/signin");
        }, 1500);

        setLoading(false);
        return;
      } catch (loginError) {
        // STEP 3: If 404, account doesn't exist - proceed with registration
        if (loginError.response?.status === 404) {
          console.log(
            "✅ Account doesn't exist, proceeding with registration...",
          );

          try {
            // Extract name from Google display name
            // 🔒 Normalize and sanitize Google display name
            const rawDisplayName = firebaseUser.displayName || "";

            // Remove unwanted characters and normalize spaces
            const cleanedDisplayName = rawDisplayName
              .replace(/[^a-zA-Z\s'-]/g, "") // Keep only letters, spaces, hyphens, apostrophes
              .replace(/\s+/g, " ") // Normalize multiple spaces to single space
              .trim();

            const nameParts = cleanedDisplayName.split(" ");

            const firstName = nameParts[0] || "User";
            const lastName = nameParts.slice(1).join(" ") || "Guest";

            console.log(`📝 Creating account for: ${firstName} ${lastName}`);

            // Generate safe unique username from email
            const rawBaseUsername = firebaseUser.email.split("@")[0];

            // Sanitize username to alphanumeric, underscore, and hyphen only
            const safeBaseUsername = rawBaseUsername
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "");

            const username = `${safeBaseUsername}${Math.floor(Math.random() * 10000)}`;

            // STEP 4: Register in backend database
            await authApi.register(
              {
                email: firebaseUser.email,
                username: username,
                firstName: firstName,
                lastName: lastName,
                phone: "",
              },
              token,
            );

            console.log("✅ Backend registration successful");

            // STEP 5: Social accounts are automatically verified
            // No need to send verification email - they can login immediately
            console.log("✅ Social account is automatically verified");

            // STEP 5.1: Establish backend session to avoid auth race
            try {
              await loginBackend();
              console.log("✅ Backend session established after registration");
            } catch (sessionError) {
              console.warn(
                "⚠️ Failed to establish backend session; proceeding anyway",
                sessionError,
              );
            }

            // STEP 6: Show success notification
            showNotification(`Welcome to Lilycrest, ${firstName}!`, "success");

            // STEP 7: Redirect to check availability page
            console.log("🔄 Redirecting to check availability...");
            setTimeout(() => {
              navigate("/check-availability");
            }, 2000);
          } catch (registerError) {
            console.error("❌ Backend registration error:", registerError);

            // Get detailed error message
            let errorMessage = "Registration failed. ";

            if (registerError.response?.data?.error) {
              errorMessage = registerError.response.data.error;
            } else if (
              registerError.response?.data?.code === "USERNAME_TAKEN"
            ) {
              errorMessage = "Username already taken. Please try again.";
            } else if (registerError.message) {
              errorMessage = registerError.message;
            } else {
              errorMessage = "An unexpected error occurred. Please try again.";
            }

            // CRITICAL: Rollback - Delete Firebase account if backend registration fails
            // Must happen BEFORE sign out to have access to delete
            console.log("🔄 Rolling back Firebase account...");
            try {
              // Re-authenticate to get fresh credentials for delete
              const currentUser = auth.currentUser;
              if (currentUser) {
                await currentUser.delete();
                console.log("✅ Firebase account deleted successfully");
              } else {
                console.warn("⚠️ No current user to delete");
              }
            } catch (deleteError) {
              console.error(
                "❌ Failed to delete Firebase account:",
                deleteError,
              );
              // If delete fails, sign out
              try {
                await auth.signOut();
                console.log("✅ User signed out");
              } catch (signOutError) {
                console.error("❌ Failed to sign out:", signOutError);
              }
            }

            showNotification(errorMessage, "error");
            setLoading(false);
          }
        } else {
          // Other login errors (not 404)
          console.error("❌ Unexpected login error:", loginError);

          // Sign out to clean state
          try {
            await auth.signOut();
          } catch (signOutError) {
            console.error("❌ Failed to sign out:", signOutError);
          }

          showNotification(
            "An error occurred while checking your account. Please try again.",
            "error",
          );
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("❌ Google sign-up error:", error);

      // Clean up Firebase session if exists
      if (auth.currentUser) {
        try {
          await auth.signOut();
          console.log("✅ Cleaned up Firebase session");
        } catch (signOutError) {
          console.error("❌ Failed to clean up session:", signOutError);
        }
      }

      // Handle specific error cases
      if (error.code === "auth/popup-closed-by-user") {
        showNotification("Sign-up cancelled", "info");
      } else if (error.code === "auth/cancelled-popup-request") {
        // User cancelled - no need to show error
        console.log("ℹ️ Sign-up cancelled by user");
      } else if (error.code === "auth/network-request-failed") {
        showNotification(
          "Network error. Please check your internet connection and try again.",
          "error",
        );
      } else if (error.code === "auth/too-many-requests") {
        showNotification(
          "Too many attempts. Please wait a moment and try again.",
          "error",
        );
      } else {
        showNotification(
          "Google sign-up failed. Please try again or contact support.",
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const provider = new GoogleAuthProvider();
    handleSocialSignup(provider, "Google");
  };

  const handleFacebookSignup = () => {
    const provider = new FacebookAuthProvider();
    handleSocialSignup(provider, "Facebook");
  };

  return (
    <>
      <div
        className="min-h-screen grid lg:grid-cols-2"
        style={{ backgroundColor: "#0C375F" }}
      >
        {/* Left Side - Image & Branding */}
        <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-black/60 z-10"></div>
          <img
            src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBkb3JtJTIwcm9vbXxlbnwwfHx8fDE3NzAyNjI4Nzh8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Lilycrest Dormitory"
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="relative z-20">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-light">Back to website</span>
            </Link>
          </div>

          <div className="relative z-20">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Home className="w-6 h-6" style={{ color: "#0C375F" }} />
              </div>
              <span className="font-semibold text-2xl text-white tracking-wide">
                Lilycrest
              </span>
            </div>
            <h2 className="text-5xl font-light text-white mb-4 leading-tight">
              Start Your Journey
              <br />
              With Us
            </h2>
            <p className="text-white/70 font-light text-lg">
              Join hundreds of students living their best life
            </p>
          </div>

          <div className="relative z-20 flex gap-2"></div>
        </div>

        {/* Right Side - Register Form */}
        <div className="flex items-center justify-center p-8 lg:p-12 bg-white">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="lg:hidden inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-light">Back to website</span>
            </Link>

            <div className="mb-10">
              <h1
                className="text-4xl font-light mb-3 tracking-tight"
                style={{ color: "#0C375F" }}
              >
                Create an account
              </h1>
              <p className="text-gray-600 font-light">
                Already have an account?{" "}
                <Link
                  to="/signin"
                  className="hover:underline"
                  style={{ color: "#E7710F" }}
                >
                  Log in
                </Link>
              </p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-light text-gray-700 mb-2"
                  >
                    First name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={loading}
                    className={`w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${
                      touched.firstName
                        ? fieldValid.firstName
                          ? "border-green-500"
                          : "border-red-500"
                        : "border-gray-200 focus:border-gray-300"
                    }`}
                    placeholder="First name"
                  />
                  {touched.firstName && validationErrors.firstName && (
                    <span className="validation-msg error">
                      {validationErrors.firstName}
                    </span>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-light text-gray-700 mb-2"
                  >
                    Last name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={loading}
                    className={`w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${
                      touched.lastName
                        ? fieldValid.lastName
                          ? "border-green-500"
                          : "border-red-500"
                        : "border-gray-200 focus:border-gray-300"
                    }`}
                    placeholder="Last name"
                  />
                  {touched.lastName && validationErrors.lastName && (
                    <span className="validation-msg error">
                      {validationErrors.lastName}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-light text-gray-700 mb-2"
                >
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  className={`w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${
                    touched.email
                      ? fieldValid.email
                        ? "border-green-500"
                        : "border-red-500"
                      : "border-gray-200 focus:border-gray-300"
                  }`}
                  placeholder="your.email@example.com"
                />
                {touched.email && validationErrors.email && (
                  <span className="validation-msg error">
                    {validationErrors.email}
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-light text-gray-700 mb-2"
                >
                  Phone number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={11}
                  className={`w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${
                    touched.phone
                      ? fieldValid.phone
                        ? "border-green-500"
                        : "border-red-500"
                      : "border-gray-200 focus:border-gray-300"
                  }`}
                  placeholder="123-456-7890"
                />
                {touched.phone && validationErrors.phone && (
                  <span className="validation-msg error">
                    {validationErrors.phone}
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-light text-gray-700 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    className={`w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${
                      touched.password
                        ? fieldValid.password
                          ? "border-green-500"
                          : "border-red-500"
                        : "border-gray-200 focus:border-gray-300"
                    }`}
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {touched.password && validationErrors.password && (
                  <span className="validation-msg error">
                    {validationErrors.password}
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-light text-gray-700 mb-2"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className={`w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${
                      touched.confirmPassword
                        ? fieldValid.confirmPassword
                          ? "border-green-500"
                          : "border-red-500"
                        : "border-gray-200 focus:border-gray-300"
                    }`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {touched.confirmPassword &&
                  validationErrors.confirmPassword && (
                    <span className="validation-msg error">
                      {validationErrors.confirmPassword}
                    </span>
                  )}
              </div>

              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    disabled={loading}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 flex-shrink-0"
                    style={{ accentColor: "#E7710F" }}
                  />
                  <span className="text-sm text-gray-600 font-light">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                      className="hover:underline"
                      style={{ color: "#E7710F" }}
                    >
                      Terms & Conditions
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                      className="hover:underline"
                      style={{ color: "#E7710F" }}
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-6 rounded-xl text-white font-light hover:opacity-90 transition-opacity text-base"
                style={{ backgroundColor: "#E7710F" }}
                disabled={!isFormValid() || loading}
              >
                {loading ? "Creating Account..." : "Create account"}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-light">
                    Or register with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className="flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"
                    />
                    <path
                      fill="#34A853"
                      d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"
                    />
                  </svg>
                  <span className="text-gray-700 font-light text-sm">
                    Google
                  </span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                  onClick={handleFacebookSignup}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M20 12.06C20 6.54 15.52 2.06 10 2.06S0 6.54 0 12.06C0 17.05 3.66 21.19 8.44 21.94V14.95H5.9V12.06H8.44V9.86C8.44 7.35 9.93 5.97 12.22 5.97C13.31 5.97 14.45 6.16 14.45 6.16V8.62H13.19C11.95 8.62 11.56 9.39 11.56 10.18V12.06H14.34L13.9 14.95H11.56V21.94C16.34 21.19 20 17.05 20 12.06Z" />
                  </svg>
                  <span className="text-gray-700 font-light text-sm">
                    Facebook
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </>
  );
}

export default SignUp;
