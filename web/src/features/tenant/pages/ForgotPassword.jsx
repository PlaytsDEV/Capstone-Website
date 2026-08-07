/**
 * =============================================================================
 * FORGOT PASSWORD PAGE
 * =============================================================================
 *
 * Professional minimalist password reset page matching the SignIn/SignUp design.
 * Features AuthBrandingPanel on the left, clean form on the right.
 * Two states: email form → success confirmation.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { Mail, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { auth } from "../../../firebase/config";
import { EMAIL_ACTION_URL, isAppUrlConfigured } from "../../../shared/api/publicUrls";
import { showNotification } from "../../../shared/utils/notification";
import { validateEmail } from "../../../shared/utils/authValidation";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import "../../../shared/styles/notification.css";
import Lounge from "../../../assets/images/facilities/RD Lounge Area.jpg"; 

const RESET_IMAGE = Lounge; 
function ForgotPassword() {
 const navigate = useNavigate();
 const [email, setEmail] = useState("");
 const [loading, setLoading] = useState(false);
 const [emailSent, setEmailSent] = useState(false);
 const [touched, setTouched] = useState(false);
 const [validationError, setValidationError] = useState(null);
 const [fieldValid, setFieldValid] = useState(false);
 const [resending, setResending] = useState(false);
 const [resendCooldown, setResendCooldown] = useState(0);
 // A ref, not state, because state updates aren't visible to a second click
 // that lands before React commits the re-render — that's how a fast
 // double-click sneaks past a state-only guard and fires two sends.
 const resendInFlightRef = useRef(false);

 useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const interval = setInterval(() => {
      setResendCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (!email) return;
    const key = `pw_reset_cooldown_${email.trim().toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const endTime = parseInt(stored, 10);
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      if (remaining > 0) {
        setResendCooldown(remaining);
      } else {
        localStorage.removeItem(key);
      }
    }
  }, [email]);

 const handleChange = (e) => {
 const value = e.target.value;
 setEmail(value);
 setTouched(true);
 const error = validateEmail(value);
 setValidationError(error);
 setFieldValid(!error);
 };

 // Shared by the initial submit and the "Resend email" action so both paths
 // apply the same enumeration-safe success/error handling and audit logging.
 const requestPasswordReset = async (targetEmail) => {
 // Without an explicit, code-controlled action URL, Firebase falls back to
 // whichever domain happens to be configured as the project's default in
 // the Firebase Console — that's how reset links ended up pointing at a
 // Vercel preview/default domain instead of the canonical production one.
 // Fail closed here rather than silently sending a link to the wrong host.
 if (!isAppUrlConfigured) {
 showNotification(
 "Password reset is temporarily unavailable. Please try again later.",
 "error",
 );
 return false;
 }

    const normEmail = targetEmail.trim().toLowerCase();
    const storageKey = `pw_reset_cooldown_${normEmail}`;

    // Pre-flight check against server-side cooldown limit
    try {
      const preflightRes = await fetch("/api/auth/log-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, checkOnly: true }),
      });
      if (preflightRes.status === 429) {
        const data = await preflightRes.json().catch(() => ({}));
        const retrySecs = data.retryAfterSeconds || 30;
        const endTime = Date.now() + retrySecs * 1000;
        localStorage.setItem(storageKey, endTime.toString());
        showNotification(
          data.error || `Please wait ${retrySecs}s before requesting another reset email.`,
          "error",
        );
        return false;
      }
    } catch (_) {
      /* non-critical preflight check */
    }

 try {
 await sendPasswordResetEmail(auth, targetEmail, {
 url: EMAIL_ACTION_URL,
 handleCodeInApp: false,
 });
 setEmailSent(true);
 showNotification("Password reset email sent!", "success");
      const endTime = Date.now() + 30000;
      localStorage.setItem(storageKey, endTime.toString());
      setResendCooldown(30);
 try {
 await fetch("/api/auth/log-password-reset", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email: targetEmail, success: true }),
 });
 } catch (_) {
 /* non-critical */
 }
 return true;
 } catch (error) {
 // Do not reveal whether an email is registered: show the same
 // "check your email" success state as a real send, not an error.
 if (error.code === "auth/user-not-found") {
 setEmailSent(true);
 showNotification("Password reset email sent!", "success");
        const endTime = Date.now() + 30000;
        localStorage.setItem(storageKey, endTime.toString());
        setResendCooldown(30);
 try {
 await fetch("/api/auth/log-password-reset", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email: targetEmail, success: false }),
 });
 } catch (_) {
 /* non-critical */
 }
 return true;
 }

 let msg = "Failed to send reset email. ";
 if (error.code === "auth/invalid-email")
 msg = "Invalid email address format.";
 else if (error.code === "auth/too-many-requests")
 msg = "Too many requests. Please try again later.";
 else if (error.code === "auth/network-request-failed")
 msg = "Network error. Please check your connection.";
 else msg += error.message || "Please try again.";
 showNotification(msg, "error");
 // Log failed password reset attempt
 try {
 await fetch("/api/auth/log-password-reset", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email: targetEmail, success: false }),
 });
 } catch (_) {
 /* non-critical */
 }
 return false;
 }
 };

 const handleResetPassword = async (e) => {
 e.preventDefault();

 if (!email.trim()) {
 showNotification("Please enter your email address", "error");
 return;
 }
 if (validationError) {
 showNotification("Please enter a valid email address", "error");
 return;
 }

 setLoading(true);
 try {
 await requestPasswordReset(email);
 } finally {
 setLoading(false);
 }
 };

 const handleResend = async () => {
 if (resendInFlightRef.current || resendCooldown > 0 || !email) return;
 resendInFlightRef.current = true;
 setResending(true);
 try {
 await requestPasswordReset(email);
 } finally {
 resendInFlightRef.current = false;
 setResending(false);
 }
 };

 const inputClass = `w-full px-4 py-4 rounded-xl bg-muted border focus:outline-none text-foreground font-light placeholder:text-muted-foreground transition-colors ${touched ? (fieldValid ? "border-green-500" : "border-red-500") : "border-border focus:border-border"}`;

 return (
 <div
 className="min-h-screen grid lg:grid-cols-2"
 style={{ backgroundColor: "#0A1628" }}
 >
 <AuthBrandingPanel
 imageUrl={RESET_IMAGE}
 headline="Forgot Your<br/>Password?"
 subtitle="No worries — we'll help you get back in"
 />

 <div className="flex items-center justify-center p-8 lg:p-12 bg-card">
 <div className="w-full max-w-md">
 <Link
 to="/"
 className="lg:hidden inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
 >
 <span className="text-sm font-light">← Back to website</span>
 </Link>

 {!emailSent ? (
 <>
 {/* Header */}
 <div className="mb-10">
 <h1
 className="text-4xl font-light mb-3 tracking-tight"
 style={{ color: "#0A1628" }}
 >
 Reset password
 </h1>
 <p className="text-muted-foreground font-light">
 Enter the email associated with your account and we'll send a
 link to reset your password.
 </p>
 </div>

 {/* Form */}
 <form onSubmit={handleResetPassword} className="space-y-6">
 <div>
 <label
 htmlFor="email"
 className="block text-sm font-light text-card-foreground mb-2"
 >
 Email address
 </label>
 <div className="relative">
 <input
 type="email"
 id="email"
 value={email}
 onChange={handleChange}
 placeholder="your.email@example.com"
 disabled={loading}
 autoComplete="email"
 autoFocus
 className={inputClass}
 />
 <Mail
 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
 style={{ width: "18px", height: "18px" }}
 />
 </div>
 {touched && validationError && (
 <span
 style={{
 display: "block",
 marginTop: "6px",
 fontSize: "12px",
 color: "#EF4444",
 fontWeight: "400",
 }}
 >
 {validationError}
 </span>
 )}
 </div>

 <button
 type="submit"
 className="w-full py-4 rounded-xl text-primary-foreground font-light hover:opacity-90 transition-opacity text-base flex items-center justify-center gap-2"
 style={{ backgroundColor: "#D4AF37" }}
 disabled={!fieldValid || loading}
 >
 {loading ? (
 <>
 <Loader2
 className="w-4 h-4 animate-spin"
 style={{ animation: "spin 1s linear infinite" }}
 />
 Sending...
 </>
 ) : (
 "Send reset link"
 )}
 </button>

 <button
 type="button"
 onClick={() => navigate("/signin")}
 className="w-full flex items-center justify-center gap-2 py-3 text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
 >
 <ArrowLeft style={{ width: "16px", height: "16px" }} />
 Back to sign in
 </button>
 </form>
 </>
 ) : (
 /* Success State */
 <div className="text-center">
 <div
 style={{
 width: "64px",
 height: "64px",
 borderRadius: "50%",
 backgroundColor: "#ECFDF5",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 margin: "0 auto 24px",
 }}
 >
 <CheckCircle
 style={{ width: "28px", height: "28px", color: "#10B981" }}
 />
 </div>

 <h1
 className="text-3xl font-light mb-3 tracking-tight"
 style={{ color: "#0A1628" }}
 >
 Check your email
 </h1>
 <p
 className="text-muted-foreground font-light mb-2"
 style={{ lineHeight: "1.6" }}
 >
 We've sent a password reset link to
 </p>
 <p
 className="mb-8"
 style={{
 fontWeight: "500",
 color: "#0A1628",
 fontSize: "15px",
 }}
 >
 {email}
 </p>

 <p
 className="text-muted-foreground font-light mb-8"
 style={{ fontSize: "13px", lineHeight: "1.6" }}
 >
 Click the link in the email to create a new password.
 <br />
 Don't forget to check your spam folder.
 </p>

 <div className="space-y-3">
 <button
 onClick={() => navigate("/signin")}
 className="w-full py-4 rounded-xl text-primary-foreground font-light hover:opacity-90 transition-opacity text-base"
 style={{ backgroundColor: "#D4AF37" }}
 >
 Back to sign in
 </button>

 <button
 onClick={handleResend}
 disabled={resending || resendCooldown > 0}
 className="w-full py-3 rounded-xl text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
 style={{
 backgroundColor: "#F3F4F6",
 cursor: resending || resendCooldown > 0 ? "not-allowed" : "pointer",
 opacity: resending || resendCooldown > 0 ? 0.7 : 1,
 }}
 >
 {resending
 ? "Resending…"
 : resendCooldown > 0
 ? `Resend email in ${resendCooldown}s`
 : "Didn't receive it? Resend email"}
 </button>
 <button
 type="button"
 disabled={resending}
  onClick={() => {
    if (email) {
      localStorage.removeItem(`pw_reset_cooldown_${email.trim().toLowerCase()}`);
    }
    setEmailSent(false);
    setEmail("");
    setTouched(false);
    setFieldValid(false);
    setResendCooldown(0);
  }}
 className="w-full py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors underline"
 style={{ opacity: resending ? 0.5 : 1, cursor: resending ? "not-allowed" : "pointer" }}
 >
 Use a different email
 </button>
 </div>
 </div>
 )}
 </div>
 </div>

 <style>
 {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
 </style>
 </div>
 );
}

export default ForgotPassword;
