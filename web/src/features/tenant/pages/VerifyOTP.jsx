import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../../../firebase/config";
import { showNotification } from "../../../shared/utils/notification";
import { authApi } from "../../../shared/api/apiClient";
import "../styles/tenant-verify-otp.css";
import "../../../shared/styles/notification.css";
import logoImage from "../../../assets/images/landingpage/logo.png";
import backgroundImage from "../../../assets/images/landingpage/gil-puyat-branch.png";

function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const branch = queryParams.get("branch") || "gil-puyat";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Get email from sessionStorage
    const storedEmail = sessionStorage.getItem("verificationEmail");
    if (!storedEmail) {
      showNotification(
        "No verification email found. Please sign up first.",
        "error",
      );
      navigate(`/signup?branch=${branch}`);
      return;
    }
    setEmail(storedEmail);
  }, [navigate, branch]);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      showNotification("Please enter the OTP", "error");
      return;
    }

    if (otp.length !== 6) {
      showNotification("OTP must be 6 digits", "error");
      return;
    }

    setLoading(true);

    try {
      // Get current user's token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found");
      }

      const token = await currentUser.getIdToken();

      // Verify OTP with backend
      await authApi.verifyOtp(otp, token);

      showNotification("Email verified successfully!", "success");

      // Clear session storage
      sessionStorage.removeItem("verificationEmail");
      sessionStorage.removeItem("verificationBranch");

      setTimeout(() => {
        navigate(`/signin?branch=${branch}`);
      }, 1500);
    } catch (error) {
      console.error("OTP verification error:", error);
      let errorMessage = "Verification failed. Please try again.";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);

    try {
      // Get current user's token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found");
      }

      const token = await currentUser.getIdToken();

      // Request new OTP from backend
      await authApi.resendOtp(token);

      showNotification("New OTP sent to your email!", "success");
    } catch (error) {
      console.error("Resend OTP error:", error);
      let errorMessage = "Failed to resend OTP. Please try again.";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      showNotification(errorMessage, "error");
    } finally {
      setResending(false);
    }
  };

  const branchDisplay =
    branch === "gil-puyat" ? "GIL PUYAT • MAKATI" : "GUADALUPE • MAKATI";

  return (
    <div className="tenant-verify-otp-page">
      <div className="tenant-verify-otp-card">
        <div
          className="tenant-verify-otp-left"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="tenant-verify-otp-overlay">
            <div className="tenant-verify-otp-brand">
              <img
                src={logoImage}
                alt="Lilycrest"
                className="tenant-verify-otp-logo"
              />
              <div className="tenant-verify-otp-brand-text">
                <h2>Lilycrest</h2>
                <span>URBAN CO-LIVING</span>
                <span>{branchDisplay}</span>
              </div>
            </div>
            <div className="tenant-verify-otp-welcome">
              <h3>Verify Your Email</h3>
              <p>Check your inbox for the verification code</p>
            </div>
          </div>
        </div>

        <div className="tenant-verify-otp-right">
          <h1 className="tenant-verify-otp-title">Enter OTP</h1>
          <p className="tenant-verify-otp-subtitle">
            We've sent a 6-digit verification code to
            <br />
            <strong>{email}</strong>
          </p>

          <form className="tenant-verify-otp-form" onSubmit={handleVerify}>
            <input
              type="text"
              name="otp"
              placeholder="Enter 6-digit OTP"
              className="tenant-verify-otp-input"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ""); // Only allow digits
                if (value.length <= 6) {
                  setOtp(value);
                }
              }}
              maxLength={6}
              disabled={loading}
              autoFocus
            />

            <button
              type="submit"
              className="tenant-verify-otp-submit"
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <div className="tenant-verify-otp-resend">
            <p>Didn't receive the code?</p>
            <button
              type="button"
              className="tenant-verify-otp-resend-btn"
              onClick={handleResendOTP}
              disabled={resending || loading}
            >
              {resending ? "Sending..." : "Resend OTP"}
            </button>
          </div>

          <div className="tenant-verify-otp-back">
            <button
              type="button"
              className="tenant-verify-otp-back-btn"
              onClick={() => navigate(`/signup?branch=${branch}`)}
              disabled={loading}
            >
              ← Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyOTP;
