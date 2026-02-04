/**
 * =============================================================================
 * SIGN UP PAGE
 * =============================================================================
 *
 * User registration page with the following features:
 * - Email/password registration with email verification
 * - Google and Facebook social authentication
 * - Branch selection dropdown
 * - Terms and Conditions modal
 * - Show/Hide password toggle
 * - Duplicate account prevention
 * - No phone number field
 * - Gmail registration doesn't require "Agree to Terms" checkbox
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import LilycrestLogo from "../../../shared/components/LilycrestLogo";
import TermsModal from "../modals/TermsModal";
import "../../public/styles/tenant-signup.css";
import "../../../shared/styles/notification.css";
import backgroundImage from "../../../assets/images/branding/gil-puyat-branch.png";

function SignUp() {
  const navigate = useNavigate();
  const { login: loginBackend } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    branch: "", // Branch selection field
  });

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

    setFormData({
      ...formData,
      [name]: value,
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

      case "branch":
        if (!value) error = "Please select a branch";
        break;

      case "password":
        if (!value) {
          error = "Password is required";
        } else if (value.length < 6) {
          error = "Password must be at least 6 characters";
        } else if (!SPECIAL_CHARS_REGEX.test(value)) {
          error = `Password must include a special character (e.g., ! @ # $ % ^ & * )`;
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
      "branch",
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
      branch: true,
      password: true,
      confirmPassword: true,
    });

    // Validate all fields
    validateField("firstName", formData.firstName);
    validateField("lastName", formData.lastName);
    validateField("email", formData.email);
    validateField("phone", formData.phone);
    validateField("branch", formData.branch);
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

    if (!formData.branch) {
      showNotification("Please select a branch", "error");
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
    branch,
    phone,
    firstName,
    lastName,
  ) => {
    try {
      const token = await firebaseUser.getIdToken();

      // Generate username from email
      const username =
        firebaseUser.email.split("@")[0] + Math.floor(Math.random() * 1000);

      const response = await authApi.register(
        {
          email: firebaseUser.email,
          username: username,
          firstName: firstName,
          lastName: lastName,
          phone: phone,
          branch: branch,
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
          formData.branch,
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

        setTimeout(() => {
          navigate(`/tenant/signin`);
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
   * - After successful registration, KEEP FIREBASE SESSION ACTIVE
   * - Redirect immediately to branch selection (session must persist)
   *
   * WHY THIS BEHAVIOR:
   * - Registration creates AND authenticates the user in one flow
   * - Branch selection requires active Firebase session
   * - Prevents session expiration during branch selection
   * - Seamless user experience from registration to branch selection
   *
   * REQUIREMENTS:
   * 1. Register with social provider creates account
   * 2. If account exists, redirect to sign in
   * 3. Auto-register with empty branch for branch selection
   * 4. KEEP Firebase session active after registration
   * 5. Redirect directly to branch selection
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
        // STEP 2: Check if account already exists in backend
        console.log("🔍 Checking if account exists...");
        await authApi.login(token);

        // If login succeeds, account already exists
        console.log("⚠️ Account already exists");
        await auth.signOut();
        showNotification(
          "This email is already registered. Please sign in instead.",
          "info",
        );

        // Redirect to sign in page
        setTimeout(() => {
          navigate("/tenant/signin");
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
            const displayName = firebaseUser.displayName || "";
            const nameParts = displayName.split(" ");
            const firstName = nameParts[0] || "User";
            const lastName = nameParts.slice(1).join(" ") || "Guest";

            // Generate unique username from email
            const baseUsername = firebaseUser.email.split("@")[0];
            const username = `${baseUsername}${Math.floor(Math.random() * 10000)}`;

            console.log(`📝 Creating account for: ${firstName} ${lastName}`);
            console.log(`📝 Generated username: ${username}`);

            // STEP 4: Register in backend database without branch
            // User will select branch after email verification
            await authApi.register(
              {
                email: firebaseUser.email,
                username: username,
                firstName: firstName,
                lastName: lastName,
                phone: "",
                branch: "", // Empty - will be selected after verification
              },
              token,
            );

            console.log("✅ Backend registration successful");

            // STEP 5: Social accounts are automatically verified
            // No need to send verification email - they can login immediately
            console.log("✅ Social account is automatically verified");

            // STEP 5.1: Establish backend session to avoid branch selection auth race
            try {
              await loginBackend();
              console.log("✅ Backend session established after registration");
            } catch (sessionError) {
              console.warn(
                "⚠️ Failed to establish backend session; proceeding to branch selection",
                sessionError,
              );
            }

            // STEP 6: KEEP FIREBASE SESSION ACTIVE (critical for branch selection)
            // Do NOT sign out - user needs active session for branch selection
            console.log(
              "🔄 Keeping Firebase session active for branch selection...",
            );

            // STEP 7: Redirect directly to branch selection
            // Session must remain active throughout this flow
            setTimeout(() => {
              console.log("📍 Redirecting to branch selection...");
              navigate("/tenant/branch-selection", {
                state: {
                  notice: `Welcome to Lilycrest, ${firstName}! Please select your branch to continue.`,
                },
              });
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
      <div className="tenant-signup-page">
        <div className="tenant-signup-card">
          <div className="tenant-signup-right">
            <h1 className="tenant-signup-title">Sign Up</h1>
            <p className="tenant-signup-subtitle">Create your Lilycrest account</p>
            <form className="tenant-signup-form" onSubmit={handleSignUp}>
              <div className="form-field">
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    className={`tenant-signup-input ${touched.firstName ? (fieldValid.firstName ? "input-valid" : "input-error") : ""}`}
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  {/* validation icons removed */}
                </div>
                {touched.firstName && (
                  <span
                    className={`validation-msg ${fieldValid.firstName ? "success" : "error"}`}
                  >
                    {fieldValid.firstName ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Looks good!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {validationErrors.firstName || "First name is required"}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="form-field">
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    className={`tenant-signup-input ${touched.lastName ? (fieldValid.lastName ? "input-valid" : "input-error") : ""}`}
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  {/* validation icons removed */}
                </div>
                {touched.lastName && (
                  <span
                    className={`validation-msg ${fieldValid.lastName ? "success" : "error"}`}
                  >
                    {fieldValid.lastName ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Looks good!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {validationErrors.lastName || "Last name is required"}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="form-field">
                <div className="input-wrapper">
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className={`tenant-signup-input ${touched.email ? (fieldValid.email ? "input-valid" : "input-error") : ""}`}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  {/* validation icons removed */}
                </div>
                {touched.email && (
                  <span
                    className={`validation-msg ${fieldValid.email ? "success" : "error"}`}
                  >
                    {fieldValid.email ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Looks good!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {validationErrors.email ||
                          "Please enter a valid email address"}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="form-field">
                <div className="input-wrapper">
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    className={`tenant-signup-input ${touched.phone ? (fieldValid.phone ? "input-valid" : "input-error") : ""}`}
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={loading}
                    maxLength={11}
                    inputMode="numeric"
                  />
                  {/* validation icons removed */}
                </div>
                {touched.phone && (
                  <span
                    className={`validation-msg ${fieldValid.phone ? "success" : "error"}`}
                  >
                    {fieldValid.phone ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Looks good!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {validationErrors.phone || "Phone number is required"}
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Branch Selection Dropdown */}
              <div className="form-field">
                <div className="input-wrapper">
                  <select
                    name="branch"
                    className={`tenant-signup-input tenant-signup-select ${touched.branch ? (fieldValid.branch ? "input-valid" : "input-error") : ""}`}
                    value={formData.branch}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select Branch</option>
                    <option value="gil-puyat">Gil Puyat • Makati</option>
                    <option value="guadalupe">Guadalupe • Makati</option>
                  </select>
                </div>
              </div>

              {/* Password with Show/Hide Toggle and Strength Meter */}
              <div className="form-field">
                <div className="input-wrapper tenant-signup-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    className={`tenant-signup-input ${touched.password ? (fieldValid.password ? "input-valid" : "input-error") : ""}`}
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <div className="input-icons-group">
                    <button
                      type="button"
                      className="tenant-signup-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M12 5C5.63636 5 2 12 2 12C2 12 5.63636 19 12 19C18.3636 19 22 12 22 12C22 12 18.3636 5 12 5Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M3 3L21 21"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M10.5 10.5C10.1851 10.8185 9.99222 11.2499 10 11.7C10.0078 12.1501 10.2141 12.5741 10.5 12.8838C10.7859 13.1935 11.1259 13.3619 11.5 13.3619C11.8741 13.3619 12.2141 13.1935 12.5 12.8838"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7.36182 7.37818C5.02182 8.87818 3.31818 11.1873 2.5 12C3.31818 13.8127 5.02182 16.1218 7.36182 17.6218"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M16.6382 16.6218C18.9782 15.1218 20.6818 12.8127 21.5 12C20.6818 10.1873 18.9782 7.87818 16.6382 6.37818"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>
                    {/* validation icons removed */}
                  </div>
                </div>

                {/* Password Strength Indicator with Requirements */}
                {formData.password && (
                  <div className="password-strength-container">
                    <div className="password-strength-header">
                      <span>Password strength:</span>
                      <span
                        className={`strength-level ${passwordStrength.level}`}
                      >
                        {passwordStrength.level === "weak"
                          ? "-"
                          : passwordStrength.level === "medium"
                            ? "+"
                            : "++"}
                      </span>
                    </div>
                    <div className="strength-bars">
                      <div
                        className={`strength-bar ${passwordStrength.score >= 25 ? `active ${passwordStrength.level}` : ""}`}
                      ></div>
                      <div
                        className={`strength-bar ${passwordStrength.score >= 50 ? `active ${passwordStrength.level}` : ""}`}
                      ></div>
                      <div
                        className={`strength-bar ${passwordStrength.score >= 75 ? `active ${passwordStrength.level}` : ""}`}
                      ></div>
                      <div
                        className={`strength-bar ${passwordStrength.score >= 100 ? `active ${passwordStrength.level}` : ""}`}
                      ></div>
                    </div>
                    <div className="password-requirements">
                      <div
                        className={`requirement ${passwordStrength.requirements.length ? "met" : ""}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          {passwordStrength.requirements.length ? (
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <circle
                              cx="10"
                              cy="10"
                              r="6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        At least 8 characters
                      </div>
                      <div
                        className={`requirement ${passwordStrength.requirements.uppercase ? "met" : ""}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          {passwordStrength.requirements.uppercase ? (
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <circle
                              cx="10"
                              cy="10"
                              r="6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        One uppercase letter
                      </div>
                      <div
                        className={`requirement ${passwordStrength.requirements.lowercase ? "met" : ""}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          {passwordStrength.requirements.lowercase ? (
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <circle
                              cx="10"
                              cy="10"
                              r="6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        One lowercase letter
                      </div>
                      <div
                        className={`requirement ${passwordStrength.requirements.number ? "met" : ""}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          {passwordStrength.requirements.number ? (
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <circle
                              cx="10"
                              cy="10"
                              r="6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        One number
                      </div>
                      <div
                        className={`requirement ${passwordStrength.requirements.special ? "met" : ""}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          {passwordStrength.requirements.special ? (
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <circle
                              cx="10"
                              cy="10"
                              r="6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        One special character (e.g., ! @ # $ % ^ & *)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password with Show/Hide Toggle and Matching Feedback */}
              <div className="form-field">
                <div className="input-wrapper tenant-signup-password-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    className={`tenant-signup-input ${touched.confirmPassword ? (fieldValid.confirmPassword ? "input-valid" : "input-error") : ""}`}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <div className="input-icons-group">
                    <button
                      type="button"
                      className="tenant-signup-password-toggle"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M12 5C5.63636 5 2 12 2 12C2 12 5.63636 19 12 19C18.3636 19 22 12 22 12C22 12 18.3636 5 12 5Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M3 3L21 21"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M10.5 10.5C10.1851 10.8185 9.99222 11.2499 10 11.7C10.0078 12.1501 10.2141 12.5741 10.5 12.8838C10.7859 13.1935 11.1259 13.3619 11.5 13.3619C11.8741 13.3619 12.2141 13.1935 12.5 12.8838"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7.36182 7.37818C5.02182 8.87818 3.31818 11.1873 2.5 12C3.31818 13.8127 5.02182 16.1218 7.36182 17.6218"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M16.6382 16.6218C18.9782 15.1218 20.6818 12.8127 21.5 12C20.6818 10.1873 18.9782 7.87818 16.6382 6.37818"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>
                    {/* validation icons removed */}
                  </div>
                </div>
                {touched.confirmPassword && (
                  <span
                    className={`validation-msg ${fieldValid.confirmPassword ? "success" : "error"}`}
                  >
                    {fieldValid.confirmPassword ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Passwords match!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {validationErrors.confirmPassword ||
                          "Passwords don't match"}
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Terms and Conditions Checkbox with Modal */}
              <label className="tenant-signup-checkbox">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  I agree to the{" "}
                  <span
                    className="tenant-signup-link"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                  >
                    Terms and Conditions
                  </span>
                </span>
              </label>

              <button
                type="submit"
                className="tenant-signup-submit"
                disabled={!isFormValid() || loading}
              >
                {loading ? "Creating Account..." : "Sign Up"}
              </button>
            </form>

            <div className="tenant-signup-divider">
              <span></span>
              <span className="tenant-signup-divider-text">Or</span>
              <span></span>
            </div>

            <div className="tenant-signup-social">
              <button
                type="button"
                className="tenant-signup-social-btn"
                onClick={handleFacebookSignup}
                disabled={loading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <g clipPath="url(#clip0_5_656)">
                    <path
                      d="M20 10.0608C20 4.53832 15.5225 0.0608215 10 0.0608215C4.4775 0.0608215 0 4.53832 0 10.0608C0 15.0525 3.65667 19.1892 8.4375 19.9392V12.9517H5.89833V10.06H8.4375V7.85832C8.4375 5.35249 9.93083 3.96749 12.215 3.96749C13.3083 3.96749 14.4533 4.16332 14.4533 4.16332V6.62415H13.1917C11.9492 6.62415 11.5617 7.39499 11.5617 8.18582V10.0608H14.335L13.8917 12.9525H11.5617V19.94C16.3433 19.1892 20 15.0517 20 10.0608Z"
                      fill="#1877F2"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_5_656">
                      <rect width="20" height="20" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
                <span>Continue with Facebook</span>
              </button>

              <button
                type="button"
                className="tenant-signup-social-btn"
                onClick={handleGoogleSignup}
                disabled={loading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <path
                    d="M18.8 10.2083C18.8 9.55831 18.7417 8.93331 18.6333 8.33331H10V11.8833H14.9333C14.7167 13.025 14.0667 13.9916 13.0917 14.6416V16.95H16.0667C17.8 15.35 18.8 13 18.8 10.2083Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9.99998 19.1667C12.475 19.1667 14.55 18.35 16.0667 16.95L13.0917 14.6417C12.275 15.1917 11.2333 15.525 9.99998 15.525C7.61665 15.525 5.59165 13.9167 4.86665 11.75H1.81665V14.1167C3.32498 17.1083 6.41665 19.1667 9.99998 19.1667Z"
                    fill="#34A853"
                  />
                  <path
                    d="M4.86671 11.7417C4.68337 11.1917 4.57504 10.6083 4.57504 10C4.57504 9.39166 4.68337 8.80833 4.86671 8.25833V5.89166H1.81671C1.19171 7.125 0.833374 8.51666 0.833374 10C0.833374 11.4833 1.19171 12.875 1.81671 14.1083L4.19171 12.2583L4.86671 11.7417Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9.99998 4.48331C11.35 4.48331 12.55 4.94998 13.5083 5.84998L16.1333 3.22498C14.5417 1.74165 12.475 0.833313 9.99998 0.833313C6.41665 0.833313 3.32498 2.89165 1.81665 5.89165L4.86665 8.25831C5.59165 6.09165 7.61665 4.48331 9.99998 4.48331Z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            <p className="tenant-signup-footer">
              Have an account?{" "}
              <span
                className="tenant-signup-link"
                onClick={() => navigate("/tenant/signin")}
                style={{ cursor: "pointer" }}
              >
                Sign In
              </span>
            </p>
          </div>

          <div
            className="tenant-signup-left"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            <div className="tenant-signup-overlay">
              <div className="tenant-signup-brand">
                <LilycrestLogo className="tenant-signup-logo-icon" aria-label="Lilycrest Logo" />
                <div className="tenant-signup-brand-text">
                  <h2>Lilycrest</h2>
                  <span>URBAN CO-LIVING</span>
                  <span>MAKATI CITY</span>
                </div>
              </div>
              <div className="tenant-signup-welcome">
                <h3>Join Lilycrest</h3>
                <p>Find Your Perfect Space</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </>
  );
}

export default SignUp;
