import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { billingApi } from "../../../shared/api/billingApi.js";

/**
 * usePaymentRedirect — Handle PayMongo return redirects
 *
 * Detects `?payment=success|cancelled&session_id=xxx` in the URL,
 * verifies the session with the backend, and updates flow state.
 *
 * Guards against PayMongo's back button which sends literal `{id}`
 * as the session_id instead of the real checkout session ID.
 */
export function usePaymentRedirect({
  user,
  showNotification,
  navigate,
  setPaymentSubmitted,
  setPaymentApproved,
  setPaymentMethod,
  setCurrentStage,
  setHighestStageReached,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!user) return;

    const paymentStatus = searchParams.get("payment");
    const rawSessionId = searchParams.get("session_id");

    if (!paymentStatus) return;

    // PayMongo back button sends literal {id} — guard against it
    const pmSessionId =
      rawSessionId && rawSessionId !== "{id}" ? rawSessionId : null;

    // Clean URL params immediately
    setSearchParams({}, { replace: true });

    // Verify with real session ID, or skip if unavailable
    if (pmSessionId) {
      billingApi
        .checkPaymentStatus(pmSessionId)
        .then((result) => {
          if (result.status === "paid") {
            setPaymentSubmitted(true);
            setPaymentApproved(true);
            setPaymentMethod(result.paymentMethod || "online");
            showNotification(
              "Payment successful! Your reservation is secured.",
              "success",
              5000,
            );
            setCurrentStage(5);
            setHighestStageReached(5);
          } else {
            showNotification(
              "Payment is being processed. Check your profile for updates.",
              "info",
              5000,
            );
          }
        })
        .catch(() => {
          showNotification(
            "Could not verify payment. Please check your profile.",
            "warning",
            5000,
          );
        });
    } else if (paymentStatus === "cancelled") {
      showNotification(
        "Payment was cancelled. You can try again.",
        "info",
        3000,
      );
    } else {
      // Success redirect but no valid session ID — redirect to profile to verify
      showNotification(
        "Verifying payment... Please check your profile.",
        "info",
        3000,
      );
      navigate("/applicant/profile?payment=success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { searchParams, setSearchParams };
}
