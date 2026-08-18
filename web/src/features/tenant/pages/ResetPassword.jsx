import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, signInWithEmailAndPassword, signOut, verifyPasswordResetCode } from "firebase/auth";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import PasswordVisibilityButton from "../../../shared/components/PasswordVisibilityButton";
import { auth } from "../../../firebase/config";
import { authApi } from "../../../shared/api/authApi";
import { clearApplicationSession } from "../../../shared/api/authSession";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import Lounge from "../../../assets/images/facilities/RD Lounge Area.jpg";
import {
  NEW_PASSWORD_MAX_LENGTH,
  PASSWORD_RULES,
  evaluateNewPassword,
} from "../../../shared/utils/authValidation";

export const classifyResetActionError = (error) => {
  if (error?.code === "auth/expired-action-code") return "expired";
  if (error?.code === "auth/invalid-action-code") return "invalid";
  if (error?.code === "auth/network-request-failed") return "network";
  return "provider";
};

const RESET_ERROR_CONTENT = {
  expired: {
    title: "Reset link expired",
    message: "This password reset link has expired. Request a new one to continue.",
  },
  invalid: {
    title: "Reset link unavailable",
    message: "This password reset link has already been used or is no longer valid.",
  },
  network: {
    title: "Unable to verify link",
    message: "We couldn't verify this reset link. Check your connection and try again.",
  },
  provider: {
    title: "Unable to verify link",
    message: "We couldn't verify this reset link right now. Please try again.",
  },
};

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");
  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // A ref, not state, so a second submit that lands before React commits the
  // `submitting` update (fast double-click, or Enter + a click on the same
  // frame) can't slip past a state-only guard and fire confirmPasswordReset
  // twice for the same one-time-use oobCode.
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    if (!oobCode) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStatus("ready");
      })
      .catch((error) => {
        setStatus(classifyResetActionError(error));
      });
  }, [oobCode, verificationAttempt]);

  useEffect(() => {
    if (status !== "success") return undefined;
    const timer = window.setTimeout(() => {
      navigate("/signin", { replace: true, state: { email } });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [email, navigate, status]);

  const ruleState = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password],
  );
  const passwordValid = evaluateNewPassword(password).valid;
  const confirmValid = Boolean(confirmPassword) && confirmPassword === password;
  const canSubmit = status === "ready" && passwordValid && confirmValid && !submitting;
  const resetErrorContent = RESET_ERROR_CONTENT[status];

  const handleSubmit = async (event) => {
    event.preventDefault();
    const currentPasswordValid = evaluateNewPassword(password).valid;
    const currentConfirmationValid = Boolean(confirmPassword) && confirmPassword === password;
    if (status !== "ready" || !currentPasswordValid || !currentConfirmationValid || !oobCode || submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setSubmitting(true);
    setErrorMessage("");
    try {
      await confirmPasswordReset(auth, oobCode, password);
    } catch (error) {
      // Only a genuine failure of the reset call itself means the oobCode
      // was invalid/expired/already used. A weak-password rejection or a
      // network blip here means the password was NOT changed, but it says
      // nothing about the link — keep the form up so the user can retry,
      // instead of sending them to a dead-end "link unavailable" screen.
      if (error?.code === "auth/weak-password") {
        setErrorMessage("Please choose a stronger password that meets all the requirements below.");
      } else if (error?.code === "auth/network-request-failed") {
        setErrorMessage("We couldn't update your password. Check your connection and try again.");
      } else {
        setStatus(classifyResetActionError(error));
      }
      submitInFlightRef.current = false;
      setSubmitting(false);
      return;
    }

    // The password has already been changed at this point via Firebase's
    // one-time oobCode — that is the terminal success condition. Everything
    // below is best-effort cleanup (revoking sessions on other devices) and
    // must never downgrade the user's view of an already-successful reset
    // back to an "invalid/expired link" state if it happens to fail.
    setStatus("success");
    setPassword("");
    setConfirmPassword("");
    // If this browser tab already had an established Lilycrest session
    // (SESSION_ESTABLISHED_KEY) from *before* this reset — e.g. the user
    // opened "Forgot Password" while still signed in, or reused an
    // already-logged-in tab — that marker must not survive a password
    // reset. useAuth's checkAuth() treats a still-set marker as "just
    // restore the existing session" and skips calling the OTP-gated
    // /login endpoint entirely, so a stale marker here would let the very
    // next sign-in (even with the new password) silently skip OTP. This
    // mirrors what authApi.logout() already does on a normal sign-out;
    // the transient signInWithEmailAndPassword/signOut pair below never
    // goes through that helper, so it has to be cleared explicitly here.
    clearApplicationSession();
    // Signing in here is transient - only to obtain a fresh ID token for
    // finalizePasswordReset(). Guard it the same way SignIn.jsx guards its
    // resend-verification sign-in, or useAuth's onAuthStateChanged listener
    // will treat it as a real login and RequireNonAdmin will navigate the
    // user away before finalizePasswordReset()/signOut() complete.
    sessionStorage.setItem("resendInProgress", "1");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      try { await authApi.finalizePasswordReset(); }
      finally { await signOut(auth); }
    } catch {
      // Non-critical: cross-device session invalidation may not have
      // completed, but the password reset itself already succeeded above.
      // Nothing user-facing to show — status stays "success".
    } finally {
      sessionStorage.removeItem("resendInProgress");
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const renderPasswordInput = ({
    id,
    label,
    value,
    onChange,
    visible,
    setVisible,
    autoComplete,
  }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-light text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => {
            if (!/\s/.test(event.target.value)) onChange(event);
          }}
          onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
          onPaste={(e) => { if (/\s/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
          autoComplete={autoComplete}
          maxLength={NEW_PASSWORD_MAX_LENGTH}
          className="w-full px-4 py-4 pr-12 rounded-xl bg-gray-50 border border-gray-200 focus:border-gray-300 focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors"
          disabled={submitting}
        />
        <PasswordVisibilityButton
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ backgroundColor: "#0A1628" }}>
      <AuthBrandingPanel
        imageUrl={Lounge}
        headline="Create A<br/>New Password"
        subtitle="Secure your Lilycrest account"
      />

      <div className="flex items-start justify-center p-8 lg:p-12 lg:py-16 bg-white overflow-y-auto">
        <div className="w-full max-w-md">
          {status === "checking" && (
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto mb-5" style={{ width: 36, height: 36, color: "#D4AF37" }} />
              <h1 className="text-3xl font-light mb-3 tracking-tight" style={{ color: "#0A1628" }}>
                Checking reset link
              </h1>
              <p className="text-gray-600 font-light">Please wait while we verify your request.</p>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-light mb-3 tracking-tight" style={{ color: "#0A1628" }}>
                  Reset password
                </h1>
                <p className="text-gray-600 font-light" style={{ lineHeight: 1.6 }}>
                  Enter a new password for {email || "your account"}.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {renderPasswordInput({
                  id: "new-password",
                  label: "New password",
                  value: password,
                  onChange: (event) => setPassword(event.target.value),
                  visible: showPassword,
                  setVisible: setShowPassword,
                  autoComplete: "new-password",
                })}

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2">
                  {ruleState.map((rule) => (
                    <div
                      key={rule.label}
                      className="flex items-center gap-2 text-sm"
                      style={{ color: rule.passed ? "#10B981" : "#6B7280" }}
                    >
                      <span>{rule.passed ? "✓" : "•"}</span>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>

                {renderPasswordInput({
                  id: "confirm-password",
                  label: "Confirm password",
                  value: confirmPassword,
                  onChange: (event) => setConfirmPassword(event.target.value),
                  visible: showConfirm,
                  setVisible: setShowConfirm,
                  autoComplete: "new-password",
                })}

                {confirmPassword && !confirmValid && (
                  <p className="text-sm" style={{ color: "#EF4444" }}>
                    Confirm password must match.
                  </p>
                )}

                {errorMessage && (
                  <p className="text-sm" style={{ color: "#EF4444" }}>
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-4 rounded-xl text-white font-light hover:opacity-90 transition-opacity text-base flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#D4AF37", opacity: canSubmit ? 1 : 0.65 }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>
              </form>
            </>
          )}

          {status === "success" && (
            <div className="text-center">
              <CheckCircle className="mx-auto mb-5" style={{ width: 56, height: 56, color: "#10B981" }} />
              <h1 className="text-3xl font-light mb-3 tracking-tight" style={{ color: "#0A1628" }}>
                Password reset successfully.
              </h1>
              <p className="text-gray-600 font-light mb-8">Redirecting to sign in in 3 seconds.</p>
              <Link
                to="/signin"
                state={{ email }}
                className="block w-full py-4 rounded-xl text-white font-light hover:opacity-90 transition-opacity text-base"
                style={{ backgroundColor: "#D4AF37" }}
              >
                Back to sign in
              </Link>
            </div>
          )}

          {resetErrorContent && (
            <div className="text-center">
              <XCircle className="mx-auto mb-5" style={{ width: 56, height: 56, color: "#EF4444" }} />
              <h1 className="text-3xl font-light mb-3 tracking-tight" style={{ color: "#0A1628" }}>
                {resetErrorContent.title}
              </h1>
              <p className="text-gray-600 font-light mb-8">
                {resetErrorContent.message}
              </p>
              <div className="space-y-3">
                {(status === "network" || status === "provider") && (
                  <button
                    type="button"
                    onClick={() => setVerificationAttempt((attempt) => attempt + 1)}
                    className="block w-full py-4 rounded-xl text-white font-light hover:opacity-90 transition-opacity text-base"
                    style={{ backgroundColor: "#0A1628" }}
                  >
                    Try again
                  </button>
                )}
                <Link
                  to="/forgot-password"
                  className="block w-full py-4 rounded-xl text-white font-light hover:opacity-90 transition-opacity text-base"
                  style={{ backgroundColor: "#D4AF37" }}
                >
                  Request new reset link
                </Link>
                <Link
                  to="/signin"
                  className="block w-full py-3 rounded-xl text-sm font-light text-gray-700 hover:text-gray-900 transition-colors"
                  style={{ backgroundColor: "#F3F4F6" }}
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
