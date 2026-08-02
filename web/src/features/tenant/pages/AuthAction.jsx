import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { AlertCircle, CheckCircle, Clock, Loader2, MailCheck } from "lucide-react";
import { auth } from "../../../firebase/config";
import { authApi } from "../../../shared/api/authApi";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import {
  EMAIL_VERIFICATION_STATES,
  classifyFailedVerification,
  getVerificationContext,
  normalizeInternalContinuation,
} from "../../../shared/utils/emailVerificationFlow";
import Lounge from "../../../assets/images/facilities/RD Lounge Area.jpg";

const COPY = {
  [EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK]: {
    title: "Email verified",
    message: "Your email has been verified successfully.",
    tone: "success",
  },
  [EMAIL_VERIFICATION_STATES.EXPIRED_LINK_UNVERIFIED_USER]: {
    title: "Link expired",
    message: "This verification link has expired.",
    tone: "warning",
  },
  [EMAIL_VERIFICATION_STATES.ALREADY_USED_LINK_VERIFIED_USER]: {
    title: "Link already used",
    message: "This verification link has already been used. Your email is already verified.",
    tone: "success",
  },
  [EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT]: {
    title: "Account already verified",
    message: "This email address has already been verified.",
    tone: "success",
  },
  [EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK]: {
    title: "Invalid link",
    message: "This verification link is invalid or incomplete.",
    tone: "error",
  },
  [EMAIL_VERIFICATION_STATES.USER_NOT_FOUND]: {
    title: "Link unavailable",
    message: "We could not safely resolve the account for this verification link.",
    tone: "error",
  },
  [EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT]: {
    title: "New link sent",
    message: "A new verification link has been sent. Please check your inbox and spam folder.",
    tone: "success",
  },
  [EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED]: {
    title: "Email not sent",
    message: "We could not send a new verification link right now. Please try again.",
    tone: "error",
  },
  [EMAIL_VERIFICATION_STATES.RATE_LIMITED_OR_COOLDOWN_ACTIVE]: {
    title: "Please wait",
    message: "Please wait before requesting another verification email.",
    tone: "warning",
  },
};

const getErrorState = (error) =>
  error?.response?.data?.state || error?.code || EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK;

function AuthAction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processedRef = useRef("");
  const [state, setState] = useState("LOADING");
  const [details, setDetails] = useState({ maskedEmail: "", continuePath: "/signin" });
  const [resending, setResending] = useState(false);
  const [verifiedIdentityMatchesSession, setVerifiedIdentityMatchesSession] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const verificationContext = useMemo(() => getVerificationContext(searchParams), [searchParams]);

  const applyServerDetails = (data = {}) => {
    setDetails({
      maskedEmail: data.maskedEmail || "",
      continuePath: normalizeInternalContinuation(data.continuePath),
    });
    if (data.retryAfterSeconds > 0) {
      setCooldownEnd(Date.now() + data.retryAfterSeconds * 1000);
    }
  };

  useEffect(() => {
    if (!cooldownEnd) {
      setCooldown(0);
      return undefined;
    }
    const tick = () => {
      const next = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
      setCooldown(next);
      if (!next) setCooldownEnd(0);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [cooldownEnd]);

  useEffect(() => {
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    const apiKey = searchParams.get("apiKey");
    const displayState = searchParams.get("state");
    const processKey = `${mode || ""}:${oobCode || ""}:${displayState || ""}:${verificationContext}`;
    if (processedRef.current === processKey) return;
    processedRef.current = processKey;

    const inspectContext = async () => {
      if (!verificationContext) {
        setState(EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK);
        return;
      }
      try {
        const status = await authApi.getEmailVerificationStatus(verificationContext);
        applyServerDetails(status);
        if (status.state === EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT) {
          setState(EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT);
        } else {
          setState(
            displayState === "send-failed"
              ? EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED
              : EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT,
          );
        }
      } catch (error) {
        applyServerDetails(error.response?.data);
        setState(getErrorState(error));
      }
    };

    if (!mode && ["sent", "send-failed"].includes(displayState)) {
      inspectContext();
      return;
    }
    if (!mode || !oobCode) {
      setState(EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK);
      return;
    }
    if (!apiKey || apiKey !== import.meta.env.VITE_FIREBASE_API_KEY) {
      setState(EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK);
      return;
    }
    if (mode === "resetPassword") {
      navigate(`/reset-password?${new URLSearchParams({ oobCode }).toString()}`, { replace: true });
      return;
    }
    if (mode !== "verifyEmail") {
      setState(EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK);
      return;
    }

    const verify = async () => {
      let checkedEmail = "";
      try {
        const info = await checkActionCode(auth, oobCode);
        checkedEmail = info?.data?.email || "";
        await applyActionCode(auth, oobCode);
        if (auth.currentUser && (!checkedEmail || auth.currentUser.email === checkedEmail)) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
          setVerifiedIdentityMatchesSession(Boolean(checkedEmail && auth.currentUser.email === checkedEmail));
        }
        if (verificationContext) {
          const finalized = await authApi.finalizeEmailVerification(verificationContext);
          applyServerDetails(finalized);
        }
        if (checkedEmail) sessionStorage.setItem("lilycrest_verified_email", checkedEmail);
        setState(EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK);
      } catch (error) {
        let accountState = EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK;
        if (verificationContext) {
          try {
            const status = await authApi.getEmailVerificationStatus(verificationContext);
            accountState = status.state;
            applyServerDetails(status);
          } catch (statusError) {
            accountState = getErrorState(statusError);
            applyServerDetails(statusError.response?.data);
          }
        }
        setState(classifyFailedVerification({ firebaseErrorCode: error?.code, accountState }));
      }
    };
    verify();
  }, [navigate, searchParams, verificationContext]);

  const handleResend = async () => {
    if (!verificationContext || resending || cooldown > 0) return;
    setResending(true);
    try {
      const result = await authApi.resendEmailVerification(verificationContext);
      applyServerDetails(result);
      setState(result.state);
      const params = new URLSearchParams({ state: "sent", context: result.verificationContext || verificationContext });
      navigate(`/auth-action?${params.toString()}`, { replace: true });
    } catch (error) {
      applyServerDetails(error.response?.data);
      setState(getErrorState(error));
    } finally {
      setResending(false);
    }
  };

  if (state === "LOADING") {
    return <VerificationLayout icon={<Loader2 className="animate-spin" />} title="Verifying your email" message="Please wait while we confirm your email address." />;
  }

  const copy = COPY[state] || COPY[EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK];
  const canResend = [
    EMAIL_VERIFICATION_STATES.EXPIRED_LINK_UNVERIFIED_USER,
    EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT,
    EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED,
    EMAIL_VERIFICATION_STATES.RATE_LIMITED_OR_COOLDOWN_ACTIVE,
  ].includes(state);
  const continuation = normalizeInternalContinuation(details.continuePath);
  const hasReservationContinuation = continuation.startsWith("/applicant/") && continuation !== "/signin";
  const signedInContinuation = verifiedIdentityMatchesSession
    ? continuation
    : `/signin?${new URLSearchParams({ continue: continuation }).toString()}`;

  const icon = copy.tone === "success"
    ? <CheckCircle />
    : copy.tone === "warning"
      ? <Clock />
      : state === EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT
        ? <MailCheck />
        : <AlertCircle />;

  return (
    <VerificationLayout icon={icon} title={copy.title} message={copy.message} tone={copy.tone}>
      {details.maskedEmail && (
        <p className="text-sm text-gray-500 mb-5">Email: {details.maskedEmail}</p>
      )}

      {canResend && (
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="block w-full py-4 rounded-xl text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#D4AF37" }}
        >
          {resending ? "Sending..." : cooldown > 0 ? `Resend available in ${cooldown}s` : "Send a new verification link"}
        </button>
      )}

      {state === EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK && hasReservationContinuation && (
        <Link to={signedInContinuation} className="block w-full py-4 rounded-xl text-white font-medium" style={{ backgroundColor: "#D4AF37" }}>
          Continue reservation
        </Link>
      )}

      {[
        EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
        EMAIL_VERIFICATION_STATES.ALREADY_USED_LINK_VERIFIED_USER,
        EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT,
      ].includes(state) && !hasReservationContinuation && (
        <Link to="/signin?verified=true" className="block w-full py-4 rounded-xl text-white font-medium" style={{ backgroundColor: "#D4AF37" }}>
          Continue to login
        </Link>
      )}

      <Link to={state === EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT ? "/signin" : "/"} className="block w-full py-3 mt-3 rounded-xl text-sm text-gray-700 bg-gray-100">
        {state === EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT ? "Return to login" : "Return to the application"}
      </Link>
    </VerificationLayout>
  );
}

function VerificationLayout({ icon, title, message, tone = "loading", children }) {
  const color = tone === "success" ? "#10B981" : tone === "error" ? "#EF4444" : "#D4AF37";
  const background = tone === "success" ? "#ECFDF5" : tone === "error" ? "#FEF2F2" : "#FEF6E0";
  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ backgroundColor: "#0A1628" }}>
      <AuthBrandingPanel imageUrl={Lounge} headline="Secure<br/>Access" subtitle="Lilycrest account verification" />
      <div className="flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center mx-auto mb-6 rounded-full" style={{ width: 68, height: 68, color, backgroundColor: background }}>
            {icon}
          </div>
          <h1 className="text-3xl font-light mb-3 tracking-tight" style={{ color: "#0A1628" }}>{title}</h1>
          <p className="text-gray-600 font-light mb-7 leading-relaxed">{message}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthAction;
