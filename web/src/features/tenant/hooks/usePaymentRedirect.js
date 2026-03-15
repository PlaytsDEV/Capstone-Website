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
      // Optimistic: show confirmation step immediately while we verify
      console.log("💳 Payment redirect — setting step 5 optimistically");
      setCurrentStage(5);
      setHighestStageReached(5);

      billingApi
        .checkPaymentStatus(pmSessionId)
        .then((result) => {
          if (result.status === "paid") {
            console.log("✅ Payment verified — confirmed step 5");
            setPaymentSubmitted(true);
            setPaymentApproved(true);
            setPaymentMethod(result.paymentMethod || "online");
            showNotification(
              "Payment successful! Your reservation is secured.",
              "success",
              5000,
            );
          } else {
            // Not paid yet — revert to payment step
            console.log("⏳ Payment not confirmed yet — reverting to step 4");
            setCurrentStage(4);
            setHighestStageReached(4);
            showNotification(
              "Payment is being processed. Check your profile for updates.",
              "info",
              5000,
            );
          }
        })
        .catch(() => {
          console.log("❌ Payment verification failed — reverting to step 4");
          setCurrentStage(4);
          setHighestStageReached(4);
          showNotification(
            "Could not verify payment. Please check your profile.",
            "warning",
            5000,
          );
        });
    } else if (paymentStatus === "cancelled") {
      // No valid session ID (PayMongo back button sends literal {id})
      // Don't show "cancelled" — the page's data-loading will auto-detect
      // if payment already went through and set the correct step
      console.log("🔙 Cancelled redirect (no session ID) — deferring to data-loading");
      // Silently let the page determine the correct step from reservation data
    } else if (paymentStatus === "success") {
      // Success redirect but no valid session ID — show step 5 optimistically
      console.log("💳 Payment success (no session ID) — showing step 5");
      setCurrentStage(5);
      setHighestStageReached(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { searchParams, setSearchParams };
}
