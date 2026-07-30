import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { reservationApi } from "../../../../shared/api/reservationApi";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value || 0));

const errorMessage = (error) => {
  const code = error?.data?.code || error?.code;
  const message = error?.data?.message || error?.message;
  return [code, message].filter(Boolean).join(": ") || "The payment decision could not be saved.";
};

export default function ReservationPaymentReviewTab({ isActive }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reasonCode, setReasonCode] = useState("UNREADABLE_PROOF");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await reservationApi.listPaymentProofReviews();
      setPayments(response?.payments || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  const pendingCount = useMemo(
    () => payments.filter((payment) => payment.status === "under_review").length,
    [payments],
  );

  const submitDecision = async () => {
    if (!decision || saving) return;
    if (decision.action === "reject" && reason.trim().length < 3) {
      setError("PAYMENT_REJECTION_REASON_REQUIRED: Enter a clear rejection reason.");
      return;
    }
    setSaving(true);
    setError("");
    const reservationId = decision.payment.reservationId?._id;
    try {
      if (decision.action === "approve") {
        await reservationApi.approvePaymentProof(reservationId, decision.payment._id);
      } else {
        await reservationApi.rejectPaymentProof(reservationId, decision.payment._id, {
          reasonCode,
          reason: reason.trim(),
        });
      }
      setDecision(null);
      setReason("");
      await load();
      window.dispatchEvent(new CustomEvent("reservation-payment-updated"));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold text-foreground">Reservation Payment Review</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingCount} manual proof{pendingCount === 1 ? "" : "s"} awaiting a financial decision.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={18} className="shrink-0" /> {error}
        </div>
      ) : null}

      {/* Split-screen master / detail */}
      <div className="flex min-h-[520px] overflow-hidden rounded-xl border border-border bg-card">

        {/* LEFT — Scrollable payment list (40%) */}
        <div className="w-[40%] shrink-0 overflow-y-auto border-r border-border">
          {!loading && payments.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              No reservation payment records require review.
            </div>
          ) : (
            payments.map((payment) => {
              const tenant = payment.tenantId;
              const reservation = payment.reservationId;
              const isSelected = decision?.payment?._id === payment._id;
              const isUnderReview = payment.source === "manual_proof" && payment.status === "under_review";
              const statusColor =
                payment.status === "confirmed" || payment.status === "approved"
                  ? "bg-success-light text-success-dark"
                  : payment.status === "rejected"
                  ? "bg-error-light text-error-dark"
                  : payment.status === "under_review"
                  ? "bg-warning-light text-warning-dark"
                  : "bg-muted text-muted-foreground";

              return (
                <button
                  key={payment._id}
                  type="button"
                  onClick={() =>
                    setDecision(
                      isSelected
                        ? null
                        : { action: isUnderReview ? "approve" : null, payment }
                    )
                  }
                  className={`w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 ${
                    isSelected ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {[tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ") || "Unknown applicant"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {reservation?.reservationCode || reservation?._id || "No code"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {payment.branch} &middot; {reservation?.roomId?.name || reservation?.roomId?.roomNumber || "Room TBD"}
                      </p>
                    </div>
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>
                      {payment.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Expected: <strong className="text-foreground">{money(payment.expectedAmount)}</strong></span>
                    <span>Paid: <strong className="text-foreground">{money(payment.paidAmount ?? payment.amount)}</strong></span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT — Detail panel (60%) */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {!decision ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <div>
                <p className="font-semibold">Select a payment to review</p>
                <p className="mt-1 text-xs">Click any entry on the left to inspect its details and take action.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 p-5">
              {/* Identity header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {[decision.payment.tenantId?.firstName, decision.payment.tenantId?.lastName]
                      .filter(Boolean)
                      .join(" ") || "Unknown applicant"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {decision.payment.reservationId?.reservationCode || decision.payment.reservationId?._id}
                    {" \u00B7 "}Stage: {decision.payment.reservationId?.status || "unknown"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDecision(null)}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  aria-label="Close detail panel"
                >
                  &times;
                </button>
              </div>

              {/* Payment summary grid */}
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Expected</dt>
                  <dd className="font-semibold">{money(decision.payment.expectedAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Submitted</dt>
                  <dd className="font-semibold">{money(decision.payment.paidAmount ?? decision.payment.amount)}</dd>
                  <dd className={`text-xs ${
                    Number(decision.payment.paidAmount ?? decision.payment.amount) >= Number(decision.payment.expectedAmount || 0)
                      ? "text-success-dark" : "text-error-dark"
                  }`}>
                    {Number(decision.payment.paidAmount ?? decision.payment.amount) >= Number(decision.payment.expectedAmount || 0) ? "+" : ""}
                    {money(Number(decision.payment.paidAmount ?? decision.payment.amount) - Number(decision.payment.expectedAmount || 0))} difference
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Branch</dt>
                  <dd>{decision.payment.branch || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Room / Bed</dt>
                  <dd>
                    {decision.payment.reservationId?.roomId?.name ||
                     decision.payment.reservationId?.roomId?.roomNumber || "—"}
                    {decision.payment.reservationId?.selectedBed?.label
                      ? ` / ${decision.payment.reservationId.selectedBed.label}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Method</dt>
                  <dd>{decision.payment.method || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Reference</dt>
                  <dd>{decision.payment.paymentReference || decision.payment.referenceNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Submitted At</dt>
                  <dd>{decision.payment.submittedAt ? new Date(decision.payment.submittedAt).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="capitalize">{decision.payment.status?.replace(/_/g, " ")}</dd>
                </div>
              </dl>

              {/* Proof link */}
              {(decision.payment.proofUrl || decision.payment.proofImageUrl) ? (
                <a
                  href={decision.payment.proofUrl || decision.payment.proofImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-muted"
                >
                  <ExternalLink size={14} /> View Payment Proof
                </a>
              ) : (
                <p className="text-xs italic text-muted-foreground">No proof image attached.</p>
              )}

              {/* Decision area — only for manual_proof under_review */}
              {decision.payment.source === "manual_proof" && decision.payment.status === "under_review" ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Decision</p>

                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision({ action: "approve", payment: decision.payment })}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        decision.action === "approve"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision({ action: "reject", payment: decision.payment })}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        decision.action === "reject"
                          ? "bg-red-600 text-white"
                          : "border border-red-300 text-red-700 hover:bg-red-50"
                      }`}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>

                  {decision.action === "approve" && (
                    <p className="mb-3 text-xs text-muted-foreground">
                      This confirms a financial transaction and reserves occupancy.
                    </p>
                  )}

                  {decision.action === "reject" && (
                    <div className="space-y-2">
                      <select
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value)}
                        className="w-full rounded-lg border border-border bg-card p-2 text-sm"
                      >
                        {["UNREADABLE_PROOF", "AMOUNT_MISMATCH", "INVALID_REFERENCE", "DUPLICATE_PROOF", "WRONG_ACCOUNT", "PAYMENT_NOT_FOUND", "OTHER"].map(
                          (code) => <option key={code}>{code}</option>
                        )}
                      </select>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain the rejection or replacement needed"
                        className="min-h-20 w-full rounded-lg border border-border bg-card p-3 text-sm"
                      />
                    </div>
                  )}

                  {decision.action && (
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDecision(null)}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={submitDecision}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {saving ? "Saving..." : decision.action === "approve" ? "Confirm Payment" : "Reject & Request Replacement"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  {decision.payment.source === "paymongo" && decision.payment.status === "confirmed"
                    ? "Automatically confirmed by PayMongo — no manual action required."
                    : decision.payment.status === "reconciliation_required"
                    ? "Administrator reconciliation required for this record."
                    : "No manual approval action available for this payment."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
