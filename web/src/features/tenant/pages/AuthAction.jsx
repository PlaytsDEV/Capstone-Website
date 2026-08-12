import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { AlertCircle, CheckCircle, Clock, Loader2, MailCheck } from "lucide-react";
import { auth } from "../../../firebase/config";
import { authApi } from "../../../shared/api/authApi";
import { normalizeVerificationErrorCode } from "../../../shared/api/apiError";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import {
  EMAIL_VERIFICATION_STATES,
  classifyFailedVerification,
  classifyVerificationSession,
  cleanAuthActionUrl,
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
    message: "This verification link has already been used. Your account is verified.",
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
    message: "Too many requests were made. Please wait before trying again.",
    tone: "warning",
  },
  [EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED]: {
    title: "Account update needed",
    message: "Your email was verified, but we could not finish updating your account.",
    tone: "warning",
  },
  [EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH]: {
    title: "Different account signed in",
    message: "This verification link belongs to a different account.",
    tone: "warning",
  },
};

const getErrorState = (error) => normalizeVerificationErrorCode(
  error,
  EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK,
);

function AuthAction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processedRef = useRef("");
  const [state, setState] = useState("LOADING");
  const [details, setDetails] = useState({ maskedEmail: "", continuePath: "/signin" });
  const [resending, setResending] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [verifiedIdentityMatchesSession, setVerifiedIdentityMatchesSession] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const applyServerDetails = (data = {}) => {
    setDetails((current) => ({
      maskedEmail: data.maskedEmail || current.maskedEmail || "",
      continuePath: normalizeInternalContinuation(data.continuePath || current.continuePath),
    }));
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
    const exchangeToken = searchParams.get("exchange") || "";
    const displayState = searchParams.get("state");
    const processKey = `${mode || ""}:${oobCode || ""}:${displayState || ""}:${exchangeToken}`;
    if (processedRef.current === processKey) return;
    processedRef.current = processKey;

    const inspectSession = async () => {
      try {
        const status = await authApi.getEmailVerificationStatus();
        applyServerDetails(status);
        if (status.identityMatch === "mismatch") {
          setState(EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH);
        } else if (status.state === EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT) {
          setVerifiedIdentityMatchesSession(status.identityMatch === "match");
          setState(EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT);
        } else {
          setState(displayState === "send-failed"
            ? EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED
            : EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT);
        }
      } catch (error) {
        applyServerDetails(error.response?.data);
        setState(getErrorState(error));
      }
    };

    if (!mode && ["sent", "send-failed"].includes(displayState)) {
      inspectSession();
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

    // Values needed for Firebase are now held in memory; remove them before
    // any further navigation, analytics, referrer, or error reporting can copy them.
    cleanAuthActionUrl();

    const verify = async () => {
      let exchanged = false;
      let exchangeFailed = false;
      let exchangedIdentityMatch = "none";
      let checkedEmail = "";
      try {
        if (exchangeToken) {
          // A failed exchange (e.g. its own short-lived capability expired a
          // moment before Firebase's oobCode) must not hide the real reason
          // from the user. Fall through to checkActionCode so Firebase's own
          // verdict — expired vs. invalid — still surfaces; this mirrors the
          // already-supported "no exchange token" path below and never skips
          // any verification/reconciliation gate.
          try {
            const exchange = await authApi.exchangeEmailVerificationToken(exchangeToken);
            exchanged = true;
            exchangedIdentityMatch = exchange.identityMatch;
            applyServerDetails(exchange);
          } catch {
            exchangeFailed = true;
          }
        }

        const info = await checkActionCode(auth, oobCode);
        checkedEmail = info?.data?.email || "";
        const sessionRelationship = classifyVerificationSession({
          currentEmail: auth.currentUser?.email,
          targetEmail: checkedEmail,
          identityMatch: exchangedIdentityMatch,
        });
        const differentAccount = sessionRelationship === "mismatch";

        await applyActionCode(auth, oobCode);

        let finalized;
        if (auth.currentUser && !differentAccount && checkedEmail) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
          finalized = await authApi.reconcileEmailVerification();
          setVerifiedIdentityMatchesSession(true);
        } else if (exchanged) {
          finalized = await authApi.finalizeEmailVerification();
        } else {
          setState(differentAccount
            ? EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH
            : EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED);
          return;
        }

        applyServerDetails(finalized);
        if (!finalized?.reconciled) {
          setState(EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED);
          return;
        }
        if (checkedEmail) sessionStorage.setItem("lilycrest_verified_email", checkedEmail);
        setState(differentAccount || finalized.identityMatch === "mismatch"
          ? EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH
          : EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK);
      } catch (error) {
        let accountState = getErrorState(error);
        if (exchanged) {
          try {
            const status = await authApi.getEmailVerificationStatus();
            applyServerDetails(status);
            if (status.identityMatch === "mismatch") {
              setState(EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH);
              return;
            }
            accountState = status.state;
          } catch (statusError) {
            accountState = getErrorState(statusError);
            applyServerDetails(statusError.response?.data);
            if (checkedEmail && ![
              EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH,
              EMAIL_VERIFICATION_STATES.RATE_LIMITED_OR_COOLDOWN_ACTIVE,
            ].includes(accountState)) {
              setState(EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED);
              return;
            }
          }
        } else if (checkedEmail) {
          setState(EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED);
          return;
        }
        setState(classifyFailedVerification({
          firebaseErrorCode: error?.code,
          accountState,
          identityUnconfirmed: exchangeFailed,
        }));
      }
    };
    verify();
  }, [navigate, searchParams]);

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const result = await authApi.resendEmailVerification();
      applyServerDetails(result);
      setState(result.state);
      navigate("/auth-action?state=sent", { replace: true });
    } catch (error) {
      applyServerDetails(error.response?.data);
      setState(getErrorState(error));
    } finally {
      setResending(false);
    }
  };

  const handleReconcile = async () => {
    if (!auth.currentUser) {
      navigate("/signin", { replace: true });
      return;
    }
    setReconciling(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const result = await authApi.reconcileEmailVerification();
      applyServerDetails(result);
      setVerifiedIdentityMatchesSession(true);
      setState(EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK);
    } catch (error) {
      applyServerDetails(error.response?.data);
      setState(getErrorState(error) === EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH
        ? EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH
        : EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED);
    } finally {
      setReconciling(false);
    }
  };

  const signOutAndNavigate = async (path) => {
    if (auth.currentUser) await auth.signOut();
    navigate(path, { replace: true });
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
      {details.maskedEmail && <p className="text-sm text-gray-500 mb-5">Email: {details.maskedEmail}</p>}

      {canResend && (
        <button type="button" onClick={handleResend} disabled={resending || cooldown > 0} className="block w-full py-4 rounded-full text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed" style={{ backgroundColor: "#D4AF37" }}>
          {resending ? "Sending..." : cooldown > 0 ? `Resend available in ${cooldown}s` : "Send a new verification link"}
        </button>
      )}

      {state === EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED && (
        <button type="button" onClick={handleReconcile} disabled={reconciling} className="block w-full py-4 rounded-full text-white font-medium disabled:opacity-60" style={{ backgroundColor: "#D4AF37" }}>
          {reconciling ? "Updating account..." : "Retry account update"}
        </button>
      )}

      {state === EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH && (
        <>
          <button type="button" onClick={() => signOutAndNavigate(`/signin?${new URLSearchParams({ continue: continuation }).toString()}`)} className="block w-full py-4 rounded-full text-white font-medium" style={{ backgroundColor: "#D4AF37" }}>
            Sign out and continue with the correct account
          </button>
          <button type="button" onClick={() => signOutAndNavigate("/signin")} className="block w-full py-3 mt-3 rounded-full text-sm text-gray-700 bg-gray-100">
            Return to standard sign-in
          </button>
        </>
      )}

      {state === EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK && hasReservationContinuation && (
        <Link to={signedInContinuation} className="block w-full py-4 rounded-full text-white font-medium" style={{ backgroundColor: "#D4AF37" }}>Continue reservation</Link>
      )}

      {[EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK, EMAIL_VERIFICATION_STATES.ALREADY_USED_LINK_VERIFIED_USER, EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT].includes(state) && !hasReservationContinuation && (
        <Link to="/signin?verified=true" className="block w-full py-4 rounded-full text-white font-medium" style={{ backgroundColor: "#D4AF37" }}>Continue to login</Link>
      )}

      <Link to="/" className="block w-full py-3 mt-3 rounded-full text-sm text-gray-700 bg-gray-100">
        {state === EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH ? "Cancel" : "Return to the application"}
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
          <div className="flex items-center justify-center mx-auto mb-6 rounded-full" style={{ width: 68, height: 68, color, backgroundColor: background }}>{icon}</div>
          <h1 className="text-3xl font-light mb-3 tracking-tight" style={{ color: "#0A1628" }}>{title}</h1>
          <p className="text-gray-600 font-light mb-7 leading-relaxed">{message}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthAction;
