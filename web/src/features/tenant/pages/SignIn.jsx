import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../../../firebase/config";
import {
  showNotification,
  showConfirmation,
} from "../../../shared/utils/notification";
import { authApi } from "../../../shared/api/apiClient";
import "../../public/styles/tenant-signin.css";
import "../../../shared/styles/notification.css";
import logoImage from "../../../assets/images/landingpage/logo.png";
import backgroundImage from "../../../assets/images/landingpage/gil-puyat-branch.png";

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get branch from URL query parameter
  const queryParams = new URLSearchParams(location.search);
  const branch = queryParams.get("branch") || "gil-puyat";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      showNotification("Email is required", "error");
      return false;
    }
    if (!formData.password) {
      showNotification("Password is required", "error");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // STEP 1: Sign in with Firebase (email/password)
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );

      // STEP 2: Check if email is verified (Firebase is source of truth)
      // This check happens BEFORE calling backend
      if (!userCredential.user.emailVerified) {
        console.log("❌ Email not verified for:", userCredential.user.email);

        // STEP 3: Show single confirmation dialog that explains and offers resend
        const shouldResend = await showConfirmation(
          "Please verify your email before logging in.\n\nHaven't received the verification email? Click OK to resend it.",
          "Resend Email",
          "Cancel",
        );

        if (shouldResend) {
          try {
            await sendEmailVerification(userCredential.user);
            showNotification(
              "Verification email sent! Please check your inbox (and spam folder).",
              "success",
            );
            console.log(
              "✅ Verification email resent to:",
              userCredential.user.email,
            );
          } catch (resendError) {
            console.error("Failed to resend verification email:", resendError);
            showNotification(
              "Failed to resend email. Please try again later.",
              "error",
            );
          }
        }

        // STEP 4: Sign out unverified user (security best practice)
        await auth.signOut();
        setLoading(false);
        return;
      }

      console.log("✅ Email verified, proceeding with login");

      // STEP 5: Get Firebase token for backend authentication
      const token = await userCredential.user.getIdToken();

      // STEP 6: Verify with backend and get user data
      let response;
      try {
        response = await authApi.login(token);
      } catch (error) {
        // If user not found in backend, sign out and show error
        await auth.signOut();
        throw error;
      }

      // Check if user's branch matches the current branch
      if (response.user.branch !== branch) {
        showNotification(
          `This account is registered for ${response.user.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe"} branch. Redirecting...`,
          "warning",
        );

        setTimeout(() => {
          localStorage.setItem("authToken", token);
          localStorage.setItem("user", JSON.stringify(response.user));
          navigate(`/${response.user.branch}`);
        }, 1500);
        return;
      }

      // Store user data
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(response.user));

      showNotification("Logged in successfully!", "success");

      // Redirect based on role
      setTimeout(() => {
        if (
          response.user.role === "admin" ||
          response.user.role === "superAdmin"
        ) {
          navigate("/admin/dashboard");
        } else {
          navigate(`/${branch}`);
        }
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
      let errorMessage = "Login failed. Please try again.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.response?.status === 404) {
        errorMessage = "User not found in database. Please register first.";
      } else if (error.response?.status === 403) {
        errorMessage = "Your account is inactive. Please contact support.";
      }

      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      try {
        // Try to login
        const response = await authApi.login(token);

        // Check if user's branch matches
        if (response.user.branch !== branch) {
          showNotification(
            `This account is registered for ${response.user.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe"} branch. Redirecting...`,
            "warning",
          );

          setTimeout(() => {
            localStorage.setItem("authToken", token);
            localStorage.setItem("user", JSON.stringify(response.user));
            navigate(`/${response.user.branch}`);
          }, 1500);
          return;
        }

        localStorage.setItem("authToken", token);
        localStorage.setItem("user", JSON.stringify(response.user));

        showNotification("Logged in successfully!", "success");

        setTimeout(() => {
          if (
            response.user.role === "admin" ||
            response.user.role === "superAdmin"
          ) {
            navigate("/admin/dashboard");
          } else {
            navigate(`/${branch}`);
          }
        }, 1000);
      } catch (error) {
        // If user not found, suggest registration
        if (error.response?.status === 404) {
          showNotification(
            "Account not found. Redirecting to sign up...",
            "info",
          );
          setTimeout(() => {
            navigate(`/signup?branch=${branch}`);
          }, 1500);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Social login error:", error);
      showNotification(
        "Social authentication failed. Please try again.",
        "error",
      );
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

  const branchDisplay =
    branch === "gil-puyat" ? "GIL PUYAT • MAKATI" : "GUADALUPE • MAKATI";

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
                <span>{branchDisplay}</span>
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
          <form className="tenant-signin-form" onSubmit={handleLogin}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="tenant-signin-input"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="tenant-signin-input"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
            <button
              type="submit"
              className="tenant-signin-submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
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
            Don&apos;t have an account?{" "}
            <span
              className="tenant-signin-link"
              onClick={() => navigate(`/signup?branch=${branch}`)}
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
