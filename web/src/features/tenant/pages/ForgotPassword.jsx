/**
 * =============================================================================
 * FORGOT PASSWORD PAGE
 * =============================================================================
 *
 * Password reset page with the following features:
 * - Send password reset email
 * - Email validation
 * - User-friendly error messages
 * - Success confirmation
 * - Link back to sign in
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../../firebase/config";
import { showNotification } from "../../../shared/utils/notification";
import "../../../shared/styles/notification.css";
import "./ForgotPassword.css";
import logoImage from "../../../assets/images/branding/logo.png";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    // Validation
    if (!email.trim()) {
      showNotification("Please enter your email address", "error");
      return;
    }

    if (!validateEmail(email)) {
      showNotification("Please enter a valid email address", "error");
      return;
    }

    setLoading(true);

    try {
      console.log("📧 Sending password reset email to:", email);

      await sendPasswordResetEmail(auth, email);

      console.log("✅ Password reset email sent successfully");
      setEmailSent(true);
      showNotification(
        "Password reset email sent! Please check your inbox.",
        "success",
      );
    } catch (error) {
      console.error("❌ Password reset error:", error);

      let errorMessage = "Failed to send reset email. ";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection.";
      } else {
        errorMessage += error.message || "Please try again.";
      }

      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-header">
          <img src={logoImage} alt="Lilycrest Logo" className="forgot-logo" />
          <h1>Reset Password</h1>
          <p>
            {emailSent
              ? "Check your email for reset instructions"
              : "Enter your email to receive a password reset link"}
          </p>
        </div>

        {!emailSent ? (
          <form onSubmit={handleResetPassword} className="forgot-password-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                disabled={loading}
                className="email-input"
                autoComplete="email"
              />
            </div>

            <button type="submit" className="reset-button" disabled={loading}>
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                "Send Reset Link"
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate("/tenant/signin")}
              className="back-to-signin-button"
              disabled={loading}
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <p className="success-text">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="success-subtext">
              Click the link in the email to create a new password.
              <br />
              Don't forget to check your spam folder!
            </p>
            <button
              onClick={() => navigate("/tenant/signin")}
              className="back-to-signin-button"
            >
              Back to Sign In
            </button>
            <button
              onClick={() => {
                setEmailSent(false);
                setEmail("");
              }}
              className="resend-button"
            >
              Resend Email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
