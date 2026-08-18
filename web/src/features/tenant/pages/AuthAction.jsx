import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { AlertCircle, CheckCircle, Clock, ExternalLink, Info, Loader2, MailCheck } from "lucide-react";
import { auth } from "../../../firebase/config";
import { authApi } from "../../../shared/api/authApi";
import { normalizeVerificationErrorCode } from "../../../shared/api/apiError";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import {
  getResendCooldown,
  setResendCooldown as setPersistentResendCooldown,
  subscribeToAuthStorage,
} from "../../../shared/utils/authLockout";
import {
  EMAIL_VERIFICATION_STATES,
  classifyFailedVerification,
  classifyVerificationSession,
  cleanAuthActionUrl,
  normalizeInternalContinuation,
} from "../../../shared/utils/emailVerificationFlow";

const EMAIL_ACTION_COOLDOWN_KEY = "email_action_verification";
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
  const location = useLocation();
  const navigate = useNavigate();
  const processedRef = useRef("");
  const [state, setState] = useState("LOADING");
  const [verifiedEmail, setVerifiedEmail] = useState(
    () =>
      location.state?.email ||
      sessionStorage.getItem("lilycrest_verified_email") ||
      sessionStorage.getItem("lilycrest_pending_verification_email") ||
      "",
  );
  const [details, setDetails] = useState({
    maskedEmail:
      location.state?.email ||
      sessionStorage.getItem("lilycrest_pending_verification_email") ||
      "",
    continuePath: "/signin",
  });
  const [resending, setResending] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [verifiedIdentityMatchesSession, setVerifiedIdentityMatchesSession] = useState(false);
  const [cooldown, setCooldown] = useState(() => getResendCooldown(EMAIL_ACTION_COOLDOWN_KEY));

  const applyServerDetails = (data = {}) => {
    setDetails((current) => ({
      maskedEmail:
        data.maskedEmail ||
        current.maskedEmail ||
        location.state?.email ||
        sessionStorage.getItem("lilycrest_pending_verification_email") ||
        "",
      continuePath: normalizeInternalContinuation(data.continuePath || current.continuePath),
    }));
    if (data.retryAfterSeconds > 0) {
      setPersistentResendCooldown(EMAIL_ACTION_COOLDOWN_KEY, data.retryAfterSeconds);
      setCooldown(data.retryAfterSeconds);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const tick = () => {
      const remaining = getResendCooldown(EMAIL_ACTION_COOLDOWN_KEY);
      setCooldown(remaining);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthStorage(() => {
      setCooldown(getResendCooldown(EMAIL_ACTION_COOLDOWN_KEY));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    const apiKey = searchParams.get("apiKey");
    const exchangeToken = searchParams.get("exchange") || "";
    const rawDisplayState = (searchParams.get("state") || "").trim();
    const normalizedDisplayState = rawDisplayState.replace(/_/g, "-").toLowerCase();
    const isSendFailedState = ["send-failed", "sendfailed", "failed", "error"].includes(normalizedDisplayState);
    const isSentState = ["sent", "resent", "resend", "success"].includes(normalizedDisplayState);

    const displayState = rawDisplayState;
    const processKey = `${mode || ""}:${oobCode || ""}:${normalizedDisplayState}:${exchangeToken}`;
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
          setState(isSendFailedState
            ? EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED
            : EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT);
        }
      } catch (error) {
        applyServerDetails(error.response?.data);
        if (isSendFailedState) {
          setState(EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED);
        } else if (isSentState) {
          setState(EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT);
        } else {
          setState(getErrorState(error));
        }
      }
    };

    if (!mode && (isSentState || isSendFailedState)) {
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
        if (checkedEmail) {
          setVerifiedEmail(checkedEmail);
          sessionStorage.setItem("lilycrest_verified_email", checkedEmail);
          sessionStorage.setItem("lilycrest_pending_email", checkedEmail);
        }
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
        if (checkedEmail) {
          sessionStorage.setItem("lilycrest_verified_email", checkedEmail);
          sessionStorage.setItem("lilycrest_pending_email", checkedEmail);
        }
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
      if (!result?.retryAfterSeconds) {
        setPersistentResendCooldown(EMAIL_ACTION_COOLDOWN_KEY, 60);
        setCooldown(60);
      }
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

  const targetEmail =
    details.maskedEmail ||
    location.state?.email ||
    sessionStorage.getItem("lilycrest_pending_verification_email") ||
    "";

  return (
    <VerificationLayout icon={icon} title={copy.title} message={copy.message} tone={copy.tone}>
      {targetEmail ? (
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 mb-5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700 max-w-full">
          <span className="text-slate-500 font-normal">Sent to:</span>
          <strong className="text-slate-900 font-semibold truncate">{targetEmail}</strong>
        </div>
      ) : null}

      {state === EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT && (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 text-left mb-4 flex items-start gap-2.5">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Can't find the email?</span> Please check your <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> folder. Verification emails usually arrive within 30–60 seconds.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-5">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 border border-slate-200 hover:border-slate-400 bg-white rounded-lg text-xs font-medium text-slate-700 text-center transition flex items-center justify-center gap-1"
            >
              Gmail <ExternalLink size={11} className="text-slate-400" />
            </a>
            <a
              href="https://outlook.live.com"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 border border-slate-200 hover:border-slate-400 bg-white rounded-lg text-xs font-medium text-slate-700 text-center transition flex items-center justify-center gap-1"
            >
              Outlook <ExternalLink size={11} className="text-slate-400" />
            </a>
            <a
              href="https://mail.yahoo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 border border-slate-200 hover:border-slate-400 bg-white rounded-lg text-xs font-medium text-slate-700 text-center transition flex items-center justify-center gap-1"
            >
              Yahoo <ExternalLink size={11} className="text-slate-400" />
            </a>
          </div>
        </>
      )}

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
        <Link
          to={signedInContinuation}
          state={{ email: verifiedEmail || sessionStorage.getItem("lilycrest_verified_email") || "" }}
          className="block w-full py-4 rounded-full text-white font-medium"
          style={{ backgroundColor: "#D4AF37" }}
        >
          Continue reservation
        </Link>
      )}

      {[EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK, EMAIL_VERIFICATION_STATES.ALREADY_USED_LINK_VERIFIED_USER, EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT].includes(state) && !hasReservationContinuation && (
        <Link
          to={{
            pathname: "/signin",
            search: "?verified=true",
          }}
          state={{ email: verifiedEmail || sessionStorage.getItem("lilycrest_verified_email") || sessionStorage.getItem("lilycrest_pending_verification_email") || "" }}
          className="block w-full py-4 rounded-full text-white font-medium"
          style={{ backgroundColor: "#D4AF37" }}
        >
          Continue to login
        </Link>
      )}

      {canResend && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 mb-1">Entered the wrong email address?</p>
          <Link
            to="/signup"
            onClick={() => {
              sessionStorage.removeItem("lilycrest_pending_verification_email");
            }}
            className="text-xs font-semibold text-slate-700 hover:text-amber-700 hover:underline"
          >
            Return to registration
          </Link>
        </div>
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
