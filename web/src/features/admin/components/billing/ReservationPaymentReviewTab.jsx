import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  XCircle,
  Search,
  CreditCard,
  X,
  FileCheck2,
  Clock3,
} from "lucide-react";
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

const getInitials = (name) => {
  if (!name) return "AP";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const formatBranch = (slug) => {
  if (!slug) return "All Branches";
  if (slug === "gil-puyat") return "Gil Puyat";
  if (slug === "guadalupe") return "Guadalupe";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
};

export default function ReservationPaymentReviewTab({ isActive }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reasonCode, setReasonCode] = useState("UNREADABLE_PROOF");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");

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

  const confirmedCount = useMemo(
    () => payments.filter((payment) => payment.status === "confirmed" || payment.status === "approved").length,
    [payments],
  );

  const rejectedCount = useMemo(
    () => payments.filter((payment) => payment.status === "rejected").length,
    [payments],
  );

  const filteredPayments = useMemo(() => {
    let list = payments;
    if (filterTab === "under_review") list = list.filter((p) => p.status === "under_review");
    else if (filterTab === "confirmed") list = list.filter((p) => p.status === "confirmed" || p.status === "approved");
    else if (filterTab === "rejected") list = list.filter((p) => p.status === "rejected");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const name = `${p.tenantId?.firstName || ""} ${p.tenantId?.lastName || ""}`.toLowerCase();
        const code = String(p.reservationId?.reservationCode || p.reservationId?._id || "").toLowerCase();
        const branch = String(p.branch || "").toLowerCase();
        const room = String(p.reservationId?.roomId?.name || p.reservationId?.roomId?.roomNumber || "").toLowerCase();
        return name.includes(q) || code.includes(q) || branch.includes(q) || room.includes(q);
      });
    }
    return list;
  }, [payments, filterTab, searchQuery]);

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

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case "confirmed":
      case "approved":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "under_review":
      case "pending":
        return "bg-amber-50 text-amber-900 border-amber-200";
      case "rejected":
        return "bg-red-50 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Header & KPI Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <CreditCard size={18} className="text-slate-600 dark:text-slate-400" />
            Reservation Payment Review
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Review applicant payment proofs and render manual financial decisions for room bookings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-900 font-bold border border-amber-200">
              <Clock3 size={12} /> {pendingCount} Awaiting Decision
            </span>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            title="Refresh reservation payment reviews"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} className="text-red-700 hover:text-red-900">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Split-screen Master / Detail */}
      <div className="flex min-h-[540px] overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* LEFT — Master list (40%) */}
        <div className="w-full md:w-[40%] shrink-0 overflow-y-auto border-r border-border flex flex-col">
          {/* Search & Filter Toolbar */}
          <div className="border-b border-border bg-muted/20 p-2.5 space-y-2">
            <div className="relative flex items-center w-full">
              <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code or applicant..."
                className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 p-0.5 rounded-full text-muted-foreground hover:text-card-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: "all", label: "All", count: payments.length },
                { id: "under_review", label: "Pending", count: pendingCount, isAlert: pendingCount > 0 },
                { id: "confirmed", label: "Confirmed", count: confirmedCount },
                { id: "rejected", label: "Rejected", count: rejectedCount },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterTab(t.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filterTab === t.id
                      ? "bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-950 font-bold"
                      : "text-muted-foreground hover:text-card-foreground hover:bg-card"
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                      t.isAlert
                        ? "bg-amber-500 text-white"
                        : filterTab === t.id
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {!loading && filteredPayments.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <FileCheck2 size={28} className="text-slate-400 mb-2" />
                <p className="font-bold text-card-foreground">No payments found</p>
                <p className="mt-0.5 text-[11px]">
                  {searchQuery ? `No results for "${searchQuery}"` : "No reservation payment records match the current tab filter."}
                </p>
              </div>
            ) : (
              filteredPayments.map((payment) => {
                const tenant = payment.tenantId;
                const reservation = payment.reservationId;
                const isSelected = decision?.payment?._id === payment._id;
                const isUnderReview = payment.source === "manual_proof" && payment.status === "under_review";
                const fullName = [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ") || "Unknown Applicant";

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
                    className={`w-full p-3 text-left transition-colors flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-slate-100 border-l-4 border-slate-900 dark:bg-slate-800 dark:border-slate-100"
                        : "hover:bg-muted/40 border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                      {getInitials(fullName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-bold text-card-foreground">{fullName}</p>
                        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeStyles(payment.status)}`}>
                          {payment.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                        {reservation?.reservationCode || reservation?._id || "No Code"} &middot; {formatBranch(payment.branch)}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Room: <strong className="text-card-foreground font-semibold">{reservation?.roomId?.name || reservation?.roomId?.roomNumber || "TBD"}</strong>
                        </span>
                        <span className="font-bold text-card-foreground">{money(payment.paidAmount ?? payment.amount)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT — Detail panel (60%) */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-card">
          {!decision ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                <CreditCard size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-bold text-card-foreground">Select a payment to review</p>
              <p className="mt-1 max-w-xs text-[11px]">
                Click any payment record on the left master list to inspect payment proof details and submit manual financial decisions.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 p-5">
              {/* Identity Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary,#0A1628)] text-[color:var(--color-accent,#D4AF37)] text-xs font-bold shadow-xs">
                    {getInitials(
                      [decision.payment.tenantId?.firstName, decision.payment.tenantId?.lastName]
                        .filter(Boolean)
                        .join(" ") || "Unknown"
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-card-foreground">
                      {[decision.payment.tenantId?.firstName, decision.payment.tenantId?.lastName]
                        .filter(Boolean)
                        .join(" ") || "Unknown Applicant"}
                    </h4>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Reservation: <strong className="text-card-foreground">{decision.payment.reservationId?.reservationCode || decision.payment.reservationId?._id}</strong>
                      {" \u00B7 "}Stage: <span className="uppercase font-semibold">{decision.payment.reservationId?.status || "unknown"}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDecision(null)}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground transition"
                  aria-label="Close detail panel"
                  title="Close payment review panel"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Payment Summary Grid */}
              <dl className="grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-muted/20 p-3.5 text-xs">
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Expected Deposit</dt>
                  <dd className="font-bold text-card-foreground mt-0.5">{money(decision.payment.expectedAmount)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Submitted Amount</dt>
                  <dd className="font-bold text-card-foreground mt-0.5">{money(decision.payment.paidAmount ?? decision.payment.amount)}</dd>
                  <dd className={`text-[10px] font-bold mt-0.5 ${
                    Number(decision.payment.paidAmount ?? decision.payment.amount) >= Number(decision.payment.expectedAmount || 0)
                      ? "text-emerald-700" : "text-red-600"
                  }`}>
                    {Number(decision.payment.paidAmount ?? decision.payment.amount) >= Number(decision.payment.expectedAmount || 0) ? "+" : ""}
                    {money(Number(decision.payment.paidAmount ?? decision.payment.amount) - Number(decision.payment.expectedAmount || 0))} difference
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Target Branch</dt>
                  <dd className="font-medium text-card-foreground mt-0.5">{formatBranch(decision.payment.branch)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Room / Bed</dt>
                  <dd className="font-medium text-card-foreground mt-0.5">
                    {decision.payment.reservationId?.roomId?.name ||
                     decision.payment.reservationId?.roomId?.roomNumber || "—"}
                    {decision.payment.reservationId?.selectedBed?.label
                      ? ` / ${decision.payment.reservationId.selectedBed.label}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Payment Method</dt>
                  <dd className="font-medium text-card-foreground mt-0.5 uppercase">{decision.payment.method || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Reference Number</dt>
                  <dd className="font-medium text-card-foreground mt-0.5 font-mono">{decision.payment.paymentReference || decision.payment.referenceNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Submission Date</dt>
                  <dd className="font-medium text-card-foreground mt-0.5">{decision.payment.submittedAt ? new Date(decision.payment.submittedAt).toLocaleString("en-PH") : "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted-foreground">Current Status</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyles(decision.payment.status)}`}>
                      {decision.payment.status?.replace(/_/g, " ")}
                    </span>
                  </dd>
                </div>
              </dl>

              {/* Proof link */}
              {(decision.payment.proofUrl || decision.payment.proofImageUrl) ? (
                <a
                  href={decision.payment.proofUrl || decision.payment.proofImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
                  title="Open official payment proof receipt image in a new browser tab"
                >
                  <ExternalLink size={14} className="text-[color:var(--color-accent,#D4AF37)]" /> View Payment Proof Receipt
                </a>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs italic text-muted-foreground">
                  No payment proof image attached to this transaction record.
                </div>
              )}

              {/* Decision Area — only for manual_proof under_review */}
              {decision.payment.source === "manual_proof" && decision.payment.status === "under_review" ? (
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Financial Review Decision</p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision({ action: "approve", payment: decision.payment })}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition shadow-xs ${
                        decision.action === "approve"
                          ? "bg-[color:var(--color-primary,#0A1628)] text-white ring-2 ring-amber-300"
                          : "border border-border bg-card text-card-foreground hover:bg-muted"
                      }`}
                      title="Approve applicant payment proof and confirm reservation room lock"
                    >
                      <CheckCircle2 size={13} className={decision.action === "approve" ? "text-[color:var(--color-accent,#D4AF37)]" : "text-emerald-600"} /> Approve Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision({ action: "reject", payment: decision.payment })}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition shadow-xs ${
                        decision.action === "reject"
                          ? "bg-red-600 text-white"
                          : "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                      }`}
                      title="Reject invalid payment proof and request replacement"
                    >
                      <XCircle size={13} className={decision.action === "reject" ? "text-white" : "text-red-600"} /> Reject Payment
                    </button>
                  </div>

                  {decision.action === "approve" && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200 font-medium">
                      Confirming this payment approves the financial deposit and locks room occupancy for this applicant.
                    </div>
                  )}

                  {decision.action === "reject" && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-card-foreground mb-1">Rejection Category Code</label>
                        <select
                          value={reasonCode}
                          onChange={(e) => setReasonCode(e.target.value)}
                          className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-red-400 focus:outline-none"
                        >
                          {["UNREADABLE_PROOF", "AMOUNT_MISMATCH", "INVALID_REFERENCE", "DUPLICATE_PROOF", "WRONG_ACCOUNT", "PAYMENT_NOT_FOUND", "OTHER"].map(
                            (code) => <option key={code} value={code}>{code}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-card-foreground mb-1">Rejection Explanation Note</label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Explain clearly why this payment proof was rejected (min 3 characters)..."
                          className="min-h-18 w-full rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-card-foreground placeholder:text-muted-foreground focus:border-red-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {decision.action && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDecision(null)}
                        className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted shadow-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={submitDecision}
                        className={`h-8 rounded-lg px-4 text-xs font-semibold text-white shadow-xs transition active:scale-[0.98] disabled:opacity-50 ${
                          decision.action === "approve"
                            ? "bg-[color:var(--color-primary,#0A1628)] hover:bg-[#13243D]"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                        title={decision.action === "approve" ? "Confirm payment approval" : "Reject payment proof and send notice to tenant"}
                      >
                        {saving ? "Saving..." : decision.action === "approve" ? "Confirm Payment" : "Reject & Request Replacement"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs italic text-muted-foreground">
                  {decision.payment.source === "paymongo" && decision.payment.status === "confirmed"
                    ? "Automatically confirmed by PayMongo — no manual action required."
                    : decision.payment.status === "reconciliation_required"
                    ? "Administrator reconciliation required for this record."
                    : "No manual approval action available for this payment state."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
