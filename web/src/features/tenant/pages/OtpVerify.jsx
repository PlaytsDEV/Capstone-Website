import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useAppNavigation } from "../../../shared/hooks/useAppNavigation";
import { authApi } from "../../../shared/api/authApi";
import { getAuthErrorCode } from "../../../shared/api/authFlowState";
import {
  getOtpPending,
  clearOtpPending,
} from "../../../shared/api/authSession";
import { showNotification } from "../../../shared/utils/notification";
import {
  AUTH_TOAST_DURATION,
  buildAuthSuccessMessage,
} from "../../../shared/utils/authToasts";
import { getAuthenticatedUserDestination } from "../../../shared/api/loginRouting";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import "../../../shared/styles/auth-forms.css";
import "../../../shared/styles/notification.css";
import {
  getResendCooldown,
  setResendCooldown as setPersistentResendCooldown,
  clearResendCooldown,
  subscribeToAuthStorage,
} from "../../../shared/utils/authLockout";
import { auth } from "../../../firebase/config";
import hero3 from "../../../assets/images/hero3.jpg";

const OTP_LENGTH = 6;
const OTP_RESEND_KEY = "otp_resend";

function OtpVerify() {
  const navigate = useNavigate();
  const appNavigate = useAppNavigation();
  const { refreshUser, setGlobalLoading } = useAuth();

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(() => getResendCooldown(OTP_RESEND_KEY));
  const inputRefs = useRef([]);

  const setResendCooldownEnd = (secondsOrTimestamp) => {
    const seconds =
      secondsOrTimestamp > 1000000000
        ? Math.max(0, Math.ceil((secondsOrTimestamp - Date.now()) / 1000))
        : Number(secondsOrTimestamp);
    setPersistentResendCooldown(OTP_RESEND_KEY, seconds);
    setResendCooldown(seconds);
  };

  const pendingData = getOtpPending();

  // Redirect if no OTP flow is active
  useEffect(() => {
    if (!pendingData) {
      navigate("/signin", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resend cooldown timer (persistent timestamp-based)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const tick = () => {
      const remaining = getResendCooldown(OTP_RESEND_KEY);
      setResendCooldown(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Multi-tab storage sync
  useEffect(() => {
    const unsubscribe = subscribeToAuthStorage(() => {
      setResendCooldown(getResendCooldown(OTP_RESEND_KEY));
    });
    return unsubscribe;
  }, []);

  const navigateAfterAuth = (user) => {
    const name = buildAuthSuccessMessage(user);
    showNotification(name, "success", AUTH_TOAST_DURATION);
    appNavigate(getAuthenticatedUserDestination(user));
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!paste) return;
    const next = Array(OTP_LENGTH).fill("");
    paste.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIndex = Math.min(paste.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      showNotification("Please enter all 6 digits", "error");
      return;
    }
    setSubmitting(true);
    setGlobalLoading(true);
    try {
      await authApi.verifyOtp(code);
      clearResendCooldown(OTP_RESEND_KEY);
      clearOtpPending();
      const user = await refreshUser();
      if (!user) {
        throw new Error("Unable to load the authenticated profile.");
      }
      navigateAfterAuth(user);
    } catch (error) {
      const errorCode = getAuthErrorCode(error);
      if (errorCode === "OTP_INVALID") {
        showNotification("Incorrect code. Please try again.", "error");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else if (errorCode === "OTP_EXPIRED") {
        showNotification("Code expired. Please request a new one.", "warning");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else if (errorCode === "OTP_ATTEMPTS_EXCEEDED") {
        showNotification("Too many attempts. Please request a new code.", "error");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else {
        showNotification("Verification failed. Please try again.", "error");
      }
    } finally {
      setSubmitting(false);
      setGlobalLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const result = await authApi.resendOtp();
      const cooldown = result?.cooldownSeconds || 60;
      setResendCooldownEnd(Date.now() + cooldown * 1000);
      showNotification("A new code has been sent to your email.", "success", 5000);
    } catch (error) {
      const errCode = getAuthErrorCode(error);
      if (errCode === "OTP_RESEND_COOLDOWN") {
        const seconds = error.response?.data?.retryAfterSeconds || 60;
        setResendCooldownEnd(Date.now() + seconds * 1000);
        showNotification(`Please wait ${seconds}s before requesting another code.`, "warning");
      } else if (errCode === "OTP_EMAIL_SEND_FAILED") {
        showNotification(
          "We could not send the verification code. Please try again later.",
          "error",
          6000,
        );
      } else {
        showNotification("Failed to resend code. Please try again.", "error");
      }
    } finally {
      setResending(false);
    }
  };

  if (!pendingData) return null;

  const email = auth.currentUser?.email || "";
  const maskedEmail = email
    ? email.replace(/^(.{2})(.+)(@.+)$/, (_, a, b, c) => a + "*".repeat(b.length) + c)
    : "";

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ backgroundColor: "#FFFFFF" }}>
      <AuthBrandingPanel
        imageUrl={hero3}
        headline="Verify Your<br/>Identity"
        subtitle="Premium living in the heart of Manila"
      />

      <div className="flex items-center justify-center p-8 lg:p-12 bg-card overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          <Link
            to="/signin"
            className="lg:hidden inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to sign in</span>
          </Link>

          <div className="auth-header text-center">
            <h1 className="auth-header__title">Check your email</h1>
            <p className="auth-header__subtitle">
              We sent a 6-digit code to{" "}
              <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                {maskedEmail || "your email"}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* OTP digit boxes */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                margin: "8px 0 24px",
              }}
            >
              {digits.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  autoFocus={i === 0}
                  disabled={submitting}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  style={{
                    width: "48px",
                    height: "56px",
                    textAlign: "center",
                    fontSize: "22px",
                    fontWeight: 600,
                    borderRadius: "12px",
                    border: digit
                      ? "2px solid var(--fi-border-focus, #D4AF37)"
                      : "2px solid var(--border)",
                    backgroundColor: "var(--muted)",
                    color: "var(--foreground)",
                    outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    caretColor: "transparent",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--fi-border-focus, #D4AF37)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = digit
                      ? "var(--fi-border-focus, #D4AF37)"
                      : "var(--border)")
                  }
                />
              ))}
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={submitting || digits.join("").length !== OTP_LENGTH}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 auth-spinner" />
                  Verifying…
                </>
              ) : (
                "Verify code"
              )}
            </button>

            <div
              style={{
                textAlign: "center",
                marginTop: "16px",
                fontSize: "14px",
                color: "var(--muted-foreground)",
              }}
            >
              <span>Didn&apos;t receive the code? </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: resending || resendCooldown > 0 ? "not-allowed" : "pointer",
                  color:
                    resending || resendCooldown > 0
                      ? "var(--muted-foreground)"
                      : "#D4AF37",
                  fontWeight: 500,
                  fontSize: "14px",
                  textDecoration: resendCooldown > 0 ? "none" : "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                {resending ? (
                  <>
                    <Loader2
                      style={{
                        display: "inline",
                        width: "12px",
                        height: "12px",
                        marginRight: "4px",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Sending…
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  "Resend"
                )}
              </button>
            </div>

            <div className="flex justify-center mt-3">
              <Link
                to="/signin"
                state={{ email }}
                onClick={clearOtpPending}
                className="auth-btn-outline"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to sign in</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default OtpVerify;
