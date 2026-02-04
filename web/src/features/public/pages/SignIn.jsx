import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../../../firebase/config";
import { authApi } from "../../../shared/api/apiClient";
import { useAuth } from "../../../shared/hooks/useAuth";
import "../styles/tenant-signin.css";
import logoImage from "../../../assets/images/branding/logo.png";
import backgroundImage from "../../../assets/images/branding/gil-puyat-branch.png";

function SignIn() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [fieldValid, setFieldValid] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  // Email validation
  const validateEmail = (email) => {
    if (!email || !email.trim()) return "Email is required";
    const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicRegex.test(email)) return "Please enter a valid email address";
    return null;
  };

  // Real-time field validation
  const validateField = (fieldName, value) => {
    let error = null;
    if (fieldName === "email") {
      error = validateEmail(value);
    } else if (fieldName === "password") {
      if (!value) error = "Password is required";
    }
    setValidationErrors((prev) => ({ ...prev, [fieldName]: error }));
    setFieldValid((prev) => ({ ...prev, [fieldName]: !error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );

      // Step 2: Login to backend using useAuth hook
      const response = await login();

      console.log("User signed in successfully:", response.user);

      // Redirect based on user role
      if (
        response.user.role === "admin" ||
        response.user.role === "superAdmin"
      ) {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (error) {
      setError(error.message || "Sign-in failed. Please try again.");
      console.error("Sign-in error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (provider, providerName) => {
    setError("");
    setLoading(true);

    try {
      // Step 1: Temporary authentication for account verification
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      console.log(
        `✅ Firebase authentication successful: ${firebaseUser.email}`,
      );

      // Step 2: Verify account exists in backend (registration-first policy)
      try {
        const response = await login();
        console.log(
          `${providerName} account verified - user is registered:`,
          response.user,
        );

        // Check if branch selection is needed
        if (!response.user.branch || response.user.branch === "") {
          console.log(
            "📍 Branch not selected - redirecting to branch selection",
          );
          setError("Welcome! Please select your branch to continue");
          setTimeout(() => {
            navigate("/tenant/branch-selection");
          }, 1000);
          return;
        }

        // Redirect based on role
        if (
          response.user.role === "admin" ||
          response.user.role === "superAdmin"
        ) {
          navigate("/admin/dashboard");
        } else {
          navigate("/");
        }
      } catch (loginError) {
        // Account not found - BLOCK ACCESS (registration required)
        console.error(`❌ Backend login error:`, loginError);

        const isNotRegistered =
          loginError.response?.status === 404 ||
          /not found|not registered|register first/i.test(loginError.message);

        if (isNotRegistered) {
          console.log(
            `🚫 ${providerName} account not registered - blocking access`,
          );

          // Delete the Firebase user to prevent orphaned accounts
          if (firebaseUser) {
            try {
              await firebaseUser.delete();
              console.log("🗑️ Removed unregistered Firebase user");
            } catch (deleteError) {
              console.warn("⚠️ Failed to delete Firebase user:", deleteError);
            }
          }

          // Terminate Firebase session
          await auth.signOut();

          setError(
            `This ${providerName} account isn't registered yet. Please sign up first.`,
          );
        } else {
          // Other login errors (403 inactive, etc.)
          await auth.signOut();
          if (loginError.response?.status === 403) {
            setError("Your account is inactive. Please contact support.");
          } else {
            setError("Login failed. Please try again or contact support.");
          }
        }
      }
    } catch (error) {
      console.error(`${providerName} sign-in error:`, error);

      // Handle popup cancelled by user
      if (
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        setLoading(false);
        console.log("ℹ️ Sign-in cancelled by user");
        return;
      }

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
      if (error.code === "auth/popup-blocked") {
        setError(
          "Popup blocked by browser. Please allow popups for this site.",
        );
      } else if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else if (error.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else if (
        error.code === "auth/account-exists-with-different-credential"
      ) {
        setError(
          "An account already exists with this email using a different sign-in method.",
        );
      } else {
        setError(
          error.message || `${providerName} sign-in failed. Please try again.`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    await handleSocialSignIn(provider, "Google");
  };

  const handleFacebookSignIn = async () => {
    const provider = new FacebookAuthProvider();
    await handleSocialSignIn(provider, "Facebook");
  };

  return (
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
                <span>GIL PUYAT • MAKATI</span>
              </div>
            </div>
            <div className="tenant-signin-welcome">
              <h3>Welcome to Lilycrest</h3>
              <p>Your Urban Co-Living Space</p>
            </div>
          </div>
        </div>

        <div className="tenant-signin-right">
          <h1 className="tenant-signin-title">Sign In</h1>
          {error && (
            <div
              style={{
                color: "#ef4444",
                marginBottom: "10px",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
          <form className="tenant-signin-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="input-wrapper">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  className={`tenant-signin-input ${touched.email ? (fieldValid.email ? "input-valid" : "input-error") : ""}`}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                {touched.email && (
                  <div className="input-icon show">
                    {fieldValid.email ? (
                      <svg
                        className="check-icon"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="x-icon"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                )}
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
            <div className="form-group">
              <div className="input-wrapper tenant-signin-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  className={`tenant-signin-input ${touched.password ? (fieldValid.password ? "input-valid" : "input-error") : ""}`}
                  value={formData.password}
                  onChange={handleChange}
                  required
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
                  {touched.password && (
                    <div className="input-icon-inline">
                      {fieldValid.password ? (
                        <svg
                          className="check-icon"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="x-icon"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {touched.password && (
                <span
                  className={`validation-msg ${fieldValid.password ? "success" : "error"}`}
                >
                  {fieldValid.password ? (
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
                      {validationErrors.password || "Password is required"}
                    </>
                  )}
                </span>
              )}
            </div>
            <button
              type="submit"
              className={`tenant-signin-submit ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="forgot-password-link">
            <button type="button" onClick={() => navigate("/forgot-password")}>
              Forgot Password?
            </button>
          </div>

          <div className="tenant-signin-divider">
            <span className="tenant-signin-divider-text">Or</span>
          </div>

          <div className="tenant-signin-social">
            <button
              type="button"
              className="tenant-signin-social-btn"
              onClick={handleFacebookSignIn}
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
              onClick={handleGoogleSignIn}
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
            Don&apos;t have an account?{" "}
            <span
              className="tenant-signin-link"
              onClick={() => navigate("/tenant/signup")}
              style={{ cursor: "pointer" }}
            >
              Sign Up Here
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignIn;
