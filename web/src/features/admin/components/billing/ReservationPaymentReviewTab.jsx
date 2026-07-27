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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              {["Applicant / Reservation", "Branch / Room", "Expected", "Submitted", "Method / Reference", "Evidence", "Status", "Actions"].map((label) => (
                <th key={label} className="px-4 py-3 font-semibold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const reservation = payment.reservationId;
              const tenant = payment.tenantId;
              const difference = Number(payment.paidAmount ?? payment.amount) - Number(payment.expectedAmount || 0);
              const isManualReview = payment.source === "manual_proof" && payment.status === "under_review";
              return (
                <tr key={payment._id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3">
                    <strong>{[tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ") || "Unknown applicant"}</strong>
                    <div className="text-xs text-muted-foreground">{reservation?.reservationCode || reservation?._id || "Unavailable"}</div>
                    <div className="text-xs text-muted-foreground">Stage: {reservation?.status || "unknown"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <strong>{payment.branch}</strong>
                    <div className="text-xs text-muted-foreground">
                      {reservation?.roomId?.name || reservation?.roomId?.roomNumber || "Room unavailable"}
                      {reservation?.selectedBed?.label ? ` / ${reservation.selectedBed.label}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{money(payment.expectedAmount)}</td>
                  <td className="px-4 py-3">
                    <strong>{money(payment.paidAmount ?? payment.amount)}</strong>
                    <div className={difference === 0 ? "text-xs text-emerald-700" : "text-xs text-red-700"}>
                      Difference: {money(difference)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <strong>{payment.method || "—"}</strong>
                    <div className="text-xs text-muted-foreground">{payment.paymentReference || payment.referenceNumber || "No reference"}</div>
                    <div className="text-xs text-muted-foreground">{payment.processedAt ? new Date(payment.processedAt).toLocaleDateString() : "Date unavailable"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {payment.proofUrl || payment.proofImageUrl ? (
                      <a href={payment.proofUrl || payment.proofImageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline">
                        View proof <ExternalLink size={13} />
                      </a>
                    ) : "No manual proof"}
                    <div className="text-xs text-muted-foreground">{payment.submittedAt ? new Date(payment.submittedAt).toLocaleString() : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">{payment.status}</span>
                    {payment.source === "paymongo" && payment.status === "confirmed" ? (
                      <div className="mt-2 text-xs text-emerald-700">Automatically confirmed by PayMongo</div>
                    ) : null}
                    {payment.status === "reconciliation_required" ? (
                      <div className="mt-2 text-xs text-amber-700">Administrator reconciliation required</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {isManualReview ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setDecision({ action: "approve", payment })} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button type="button" onClick={() => setDecision({ action: "reject", payment })} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">No manual approval available</span>}
                  </td>
                </tr>
              );
            })}
            {!loading && payments.length === 0 ? (
              <tr><td colSpan="8" className="px-4 py-12 text-center text-muted-foreground">No Reservation payment records require review.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {decision ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={`${decision.action} payment proof`}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{decision.action === "approve" ? "Approve Reservation Payment" : "Reject Payment Proof"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {decision.action === "approve"
                ? "This confirms a financial transaction and reserves occupancy."
                : "The original evidence will be preserved and a replacement proof may be submitted."}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
              <div><dt className="text-muted-foreground">Expected</dt><dd className="font-semibold">{money(decision.payment.expectedAmount)}</dd></div>
              <div><dt className="text-muted-foreground">Submitted</dt><dd className="font-semibold">{money(decision.payment.paidAmount ?? decision.payment.amount)}</dd></div>
              <div><dt className="text-muted-foreground">Branch</dt><dd>{decision.payment.branch}</dd></div>
              <div><dt className="text-muted-foreground">Reference</dt><dd>{decision.payment.paymentReference || decision.payment.referenceNumber}</dd></div>
            </dl>
            {decision.action === "reject" ? (
              <div className="mt-4 space-y-3">
                <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="w-full rounded-lg border border-border bg-card p-2">
                  {["UNREADABLE_PROOF", "AMOUNT_MISMATCH", "INVALID_REFERENCE", "DUPLICATE_PROOF", "WRONG_ACCOUNT", "PAYMENT_NOT_FOUND", "OTHER"].map((code) => <option key={code}>{code}</option>)}
                </select>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the rejection or replacement needed" className="min-h-24 w-full rounded-lg border border-border bg-card p-3" />
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setDecision(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={submitDecision} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? "Saving…" : decision.action === "approve" ? "Confirm Payment" : "Reject and Request Replacement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
