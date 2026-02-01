/**
 * =============================================================================
 * SIGN IN PAGE
 * =============================================================================
 *
 * User login page with the following features:
 * - Email/password login OR username/password login
 * - Email verification check
 * - Google and Facebook social authentication
 * - Redirects to branch selection page for users without branch
 * - Show/Hide password toggle
 * - Comprehensive error handling
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { auth } from "../../../firebase/config";
import { showNotification } from "../../../shared/utils/notification";
import { authApi } from "../../../shared/api/apiClient";
import "../../public/styles/tenant-signin.css";
import "../../../shared/styles/notification.css";
import logoImage from "../../../assets/images/landingpage/logo.png";
import backgroundImage from "../../../assets/images/landingpage/gil-puyat-branch.png";

function SignIn() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [fieldValid, setFieldValid] = useState({});
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

  const handleChange = (e) => {
    const { name, value } = e.target;

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
      case "email":
        error = validateEmail(value);
        break;

      case "password":
        if (!value || !value.trim()) {
          error = "Password is required";
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
   * Check if sign-in form is valid for submission
   */
  const isFormValid = () => {
    return fieldValid.email && fieldValid.password;
  };

  /**
   * Validate login form
   * - Email is required and must be valid
   * - Password is required
   */
  const validateForm = () => {
    // Mark all fields as touched
    setTouched({
      email: true,
      password: true,
    });

    // Validate all fields
    validateField("email", formData.email);
    validateField("password", formData.password);

    const emailError = validateEmail(formData.email);
    if (emailError) {
      showNotification(emailError, "error");
      return false;
    }

    if (!formData.password || !formData.password.trim()) {
      showNotification("Password is required", "error");
      return false;
    }
    return true;
  };

  /**
   * Handle email/password login
   *
   * REQUIREMENTS:
   * 1. Support login with email/password for Google-registered users
   * 2. Check email verification before allowing login
   * 3. Check if branch selection is needed
   * 4. Redirect appropriately based on user role and branch
   * 5. Robust error handling
   */
  const handleSignIn = async (e) => {
    e.preventDefault();

    console.log("🔹 Login button clicked");
    console.log("📧 Email:", formData.email);

    if (!validateForm()) {
      console.log("❌ Form validation failed");
      return;
    }

    console.log("✅ Form validation passed, attempting login...");
    setLoading(true);

    try {
      // STEP 1: Sign in with Firebase using email and password
      console.log("🔐 Authenticating with Firebase...");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      const firebaseUser = userCredential.user;
      console.log("✅ Firebase authentication successful");

      // STEP 2: Check if email is verified
      console.log("📧 Email verified:", firebaseUser.emailVerified);
      if (!firebaseUser.emailVerified) {
        console.log("⚠️ Email not verified, signing out...");
        await auth.signOut();
        showNotification(
          "Please verify your email before logging in. Check your inbox for the verification link.",
          "warning",
        );
        setLoading(false);
        return;
      }

      // STEP 3: Get Firebase token and login to backend
      const token = await firebaseUser.getIdToken();
      console.log("🔑 Firebase token obtained");

      try {
        console.log("🔍 Logging in to backend...");
        const loginResponse = await authApi.login(token);
        console.log("✅ Backend login successful");
        console.log("👤 User branch:", loginResponse.user.branch);

        // STEP 4: Check if user needs to select branch
        // This happens when user registered with Google but hasn't selected a branch yet
        if (!loginResponse.user.branch || loginResponse.user.branch === "") {
          console.log(
            "📍 Branch not selected, redirecting to branch selection...",
          );

          // Store temporary data for branch selection
          localStorage.setItem("authToken", token);
          localStorage.setItem("user", JSON.stringify(loginResponse.user));

          // Redirect to branch selection page
          showNotification("Please select your branch to continue", "info");
          setTimeout(() => {
            navigate("/tenant/branch-selection");
          }, 500);
          setLoading(false);
          return;
        }

        // STEP 5: Store authentication data
        localStorage.setItem("authToken", token);
        localStorage.setItem("user", JSON.stringify(loginResponse.user));

        showNotification(
          `Welcome back, ${loginResponse.user.firstName}!`,
          "success",
        );

        // STEP 6: Redirect based on role
        console.log("🔄 Redirecting to appropriate page...");
        setTimeout(() => {
          if (
            loginResponse.user.role === "admin" ||
            loginResponse.user.role === "superAdmin"
          ) {
            console.log("👨‍💼 Redirecting to admin dashboard");
            navigate("/admin/dashboard");
          } else {
            console.log(
              `🏠 Redirecting to branch: ${loginResponse.user.branch}`,
            );
            navigate(`/${loginResponse.user.branch}`);
          }
        }, 800);
      } catch (backendError) {
        console.error("❌ Backend login error:", backendError);
        await auth.signOut();

        if (backendError.response?.status === 404) {
          showNotification(
            "Account not found in database. Please contact support or register again.",
            "error",
          );
        } else if (backendError.response?.status === 403) {
          showNotification(
            "Your account is inactive. Please contact support.",
            "error",
          );
        } else {
          showNotification(
            "Login failed. Please try again or contact support.",
            "error",
          );
        }
      }
    } catch (error) {
      console.error("❌ Login error:", error);
      let errorMessage = "Login failed. Please try again.";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        errorMessage =
          "Invalid email or password. Please check your credentials.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage =
          "No account found with this email. Please register first.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format. Please check your email.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage =
          "Too many failed login attempts. Please try again later or reset your password.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage =
          "This account has been disabled. Please contact support.";
      }

      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle social provider login (Google/Facebook)
   *
   * REQUIREMENTS:
   * 1. If user registered with Google, can login with Google
   * 2. Check email verification status
   * 3. Show branch selection if not yet selected
   * 4. Redirect to appropriate page based on role and branch
   * 5. If account doesn't exist, show error (no auto-registration on login)
   * 6. Comprehensive error handling
   */
  const handleSocialLogin = async (provider) => {
    setLoading(true);

    try {
      console.log("🔹 Starting Google sign-in...");

      // STEP 1: Authenticate with Firebase
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      console.log("✅ Firebase authentication successful:", firebaseUser.email);
      console.log("📧 Email verified:", firebaseUser.emailVerified);

      // STEP 2: Check email verification (required for all users including Google)
      if (!firebaseUser.emailVerified) {
        console.log("⚠️ Email not verified");
        await auth.signOut();
        showNotification(
          "Please verify your email first. Check your inbox for the verification link.",
          "warning",
        );
        setLoading(false);
        return;
      }

      // STEP 3: Get Firebase token
      const token = await firebaseUser.getIdToken();
      console.log("🔑 Firebase token obtained");

      try {
        // STEP 4: Try to login - check if account exists in backend
        console.log("🔍 Checking if account exists in backend...");
        const loginResponse = await authApi.login(token);
        console.log("✅ Account found in backend");
        console.log("👤 User branch:", loginResponse.user.branch);

        // STEP 5: Check if branch selection is needed
        if (!loginResponse.user.branch || loginResponse.user.branch === "") {
          console.log(
            "📍 Branch not selected, redirecting to branch selection page...",
          );

          // Store authentication data
          localStorage.setItem("authToken", token);
          localStorage.setItem("user", JSON.stringify(loginResponse.user));

          // Redirect to branch selection page
          showNotification("Please select your branch to continue", "info");
          setTimeout(() => {
            navigate("/tenant/branch-selection");
          }, 500);
          setLoading(false);
          return; // Stop here - don't continue with regular login
        }

        // STEP 6: Branch already assigned - login directly
        console.log("✅ Branch already selected, logging in...");
        localStorage.setItem("authToken", token);
        localStorage.setItem("user", JSON.stringify(loginResponse.user));

        showNotification(
          `Welcome back, ${loginResponse.user.firstName}!`,
          "success",
        );

        // STEP 7: Redirect based on role
        console.log("🔄 Redirecting to appropriate page...");
        setTimeout(() => {
          if (
            loginResponse.user.role === "admin" ||
            loginResponse.user.role === "superAdmin"
          ) {
            console.log("👨‍💼 Redirecting to admin dashboard");
            navigate("/admin/dashboard");
          } else {
            console.log(
              `🏠 Redirecting to branch: ${loginResponse.user.branch}`,
            );
            navigate(`/${loginResponse.user.branch}`);
          }
        }, 800);
      } catch (loginError) {
        // STEP 8: Handle login errors
        console.error("❌ Backend login error:", loginError);

        // Sign out from Firebase
        await auth.signOut();

        // If 404, account doesn't exist
        if (loginError.response?.status === 404) {
          console.log("⚠️ Account not found in backend");
          showNotification(
            "No account found. Please register first using the sign-up page.",
            "info",
          );

          // Optionally redirect to signup after a delay
          setTimeout(() => {
            navigate("/tenant/signup");
          }, 2000);
        } else if (loginError.response?.status === 403) {
          showNotification(
            "Your account is inactive. Please contact support.",
            "error",
          );
        } else {
          showNotification(
            "Login failed. Please try again or contact support.",
            "error",
          );
        }
      }
    } catch (error) {
      console.error("❌ Google sign-in error:", error);

      // Clean up Firebase session if exists
      if (auth.currentUser) {
        try {
          await auth.signOut();
          console.log("✅ Cleaned up Firebase session");
        } catch (signOutError) {
          console.error("❌ Failed to sign out:", signOutError);
        }
      }

      // Handle specific error cases
      if (error.code === "auth/popup-closed-by-user") {
        showNotification("Sign-in cancelled", "info");
      } else if (error.code === "auth/cancelled-popup-request") {
        // User cancelled - no need to show error
        console.log("ℹ️ Sign-in cancelled by user");
      } else if (error.code === "auth/popup-blocked") {
        showNotification(
          "Popup blocked by browser. Please allow popups for this site.",
          "error",
        );
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
      } else if (
        error.code === "auth/account-exists-with-different-credential"
      ) {
        showNotification(
          "An account already exists with this email using a different sign-in method.",
          "error",
        );
      } else {
        showNotification(
          "Google sign-in failed. Please try again or use email/password login.",
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    handleSocialLogin(provider);
  };

  const handleFacebookLogin = () => {
    const provider = new FacebookAuthProvider();
    handleSocialLogin(provider);
  };

  return (
    <>
      <div className="tenant-signin-page">
        <div className="tenant-signin-card">
          <div
            className="tenant-signin-left"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            <div className="tenant-signin-overlay">
              <div className="tenant-signin-brand">
                <img
                  src={logoImage}
                  alt="Lilycrest"
                  className="tenant-signin-logo"
                />
                <div className="tenant-signin-brand-text">
                  <h2>Lilycrest</h2>
                  <span>URBAN CO-LIVING</span>
                  <span>MAKATI CITY</span>
                </div>
              </div>
              <div className="tenant-signin-welcome">
                <h3>Sign In</h3>
                <p>Access Your Account</p>
              </div>
            </div>
          </div>

          <div className="tenant-signin-right">
            <h1 className="tenant-signin-title">Sign In</h1>
            <form className="tenant-signin-form" onSubmit={handleSignIn}>
              <div className="form-field">
                <div className="input-wrapper">
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className={`tenant-signin-input ${touched.email ? (fieldValid.email ? "input-valid" : "input-error") : ""}`}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="email"
                  />
                  {/* validation icons removed */}
                </div>
                {touched.email && validationErrors.email && (
                  <span className="validation-msg error">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm0 7a.75.75 0 10-1.5 0 .75.75 0 001.5 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {validationErrors.email}
                  </span>
                )}
              </div>

              {/* Password with Show/Hide Toggle */}
              <div className="form-field">
                <div className="input-wrapper tenant-signin-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    className={`tenant-signin-input ${touched.password ? (fieldValid.password ? "input-valid" : "input-error") : ""}`}
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <div className="input-icons-group">
                    <button
                      type="button"
                      className="tenant-signin-password-toggle"
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
                {touched.password && validationErrors.password && (
                  <span className="validation-msg error">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm0 7a.75.75 0 10-1.5 0 .75.75 0 001.5 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {validationErrors.password}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="tenant-signin-submit"
                disabled={!isFormValid() || loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>

              <div
                style={{
                  textAlign: "center",
                  marginTop: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate("/tenant/forgot-password")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#667eea",
                    fontSize: "14px",
                    cursor: "pointer",
                    textDecoration: "none",
                    padding: "4px 8px",
                  }}
                  onMouseOver={(e) =>
                    (e.target.style.textDecoration = "underline")
                  }
                  onMouseOut={(e) => (e.target.style.textDecoration = "none")}
                >
                  Forgot Password?
                </button>
              </div>
            </form>

            <div className="tenant-signin-divider">
              <span></span>
              <span className="tenant-signin-divider-text">Or</span>
              <span></span>
            </div>

            <div className="tenant-signin-social">
              <button
                type="button"
                className="tenant-signin-social-btn"
                onClick={handleFacebookLogin}
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
                className="tenant-signin-social-btn"
                onClick={handleGoogleLogin}
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

            <p className="tenant-signin-footer">
              Don't have an account?{" "}
              <span
                className="tenant-signin-link"
                onClick={() => navigate("/tenant/signup")}
                style={{ cursor: "pointer" }}
              >
                Sign Up
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default SignIn;
