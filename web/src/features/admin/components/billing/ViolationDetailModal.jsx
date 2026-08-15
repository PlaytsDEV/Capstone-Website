import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  User,
  ShieldAlert,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Loader2,
  ShieldCheck,
  Send,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

function ResidentAvatar({ avatarUrl, name, className = "h-10 w-10 text-xs" }) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Resident"}
        onError={() => setImgError(true)}
        className={`${className} rounded-full object-cover border border-border shrink-0`}
      />
    );
  }

  return (
    <div
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700`}
    >
      {getInitials(name || "")}
    </div>
  );
}

const getStatusBadge = (status) => {
  switch (status) {
    case "confirmed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "warning_issued":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "penalty_issued":
      return "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300";
    case "escalated":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";
    case "dismissed":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
    case "resolved":
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";
    case "under_review":
    case "awaiting_response":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
  }
};

export default function ViolationDetailModal({ isOpen, violation, onClose, onRefresh }) {
  const [adjudicating, setAdjudicating] = useState(false);
  const [decision, setDecision] = useState("confirmed");
  const [targetStatus, setTargetStatus] = useState("warning_issued");
  const [decisionReason, setDecisionReason] = useState("");
  const [chargeToBill, setChargeToBill] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen || !violation) return null;

  const isPendingDecision = !violation.adminDecision;

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!decisionReason.trim()) {
      setError("Please provide a detailed formal reason for the administrative decision.");
      return;
    }

    try {
      setAdjudicating(true);
      await billingApi.updateViolationDecision(violation._id, {
        decision,
        decisionReason: decisionReason.trim(),
        status: decision === "dismissed" ? "dismissed" : targetStatus,
        penaltyApplied: violation.penaltyApplied,
        penaltyReason: violation.penaltyReason,
        chargeToBill: chargeToBill && Number(violation.penaltyApplied) > 0,
      });

      setSuccessMsg("Violation decision updated and recorded successfully.");
      onRefresh?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Adjudication error:", err);
      setError(err.message || "Failed to update violation decision.");
    } finally {
      setAdjudicating(false);
    }
  };

  const formattedDate = violation.dateOfIncident
    ? new Date(violation.dateOfIncident).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  const primaryPhoto = violation.evidenceUrls?.[0] || violation.evidenceUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-card-foreground">
                  Infraction Record #{String(violation._id).slice(-6).toUpperCase()}
                </h2>
                <span
                  className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                    violation.status,
                  )}`}
                >
                  {violation.status?.replace(/_/g, " ")}
                </span>
                {violation.warningNumber && (
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Warning #{violation.warningNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Logged on {new Date(violation.createdAt).toLocaleDateString("en-PH")} by {violation.reportedByName || "Admin"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tenant & Room Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <ResidentAvatar
                avatarUrl={violation.tenantAvatar || violation.tenantProfileImage || violation.tenantId?.profileImage}
                name={violation.tenantName}
                className="h-10 w-10 text-xs"
              />
              <div>
                <p className="text-xs font-bold text-card-foreground">{violation.tenantName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {violation.roomName} · {violation.branch}
                </p>
                {violation.tenantEmail && (
                  <p className="text-[11px] text-muted-foreground">{violation.tenantEmail}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block font-medium">Assessed Penalty</span>
              <span className="text-sm font-bold text-red-600">
                ₱{Number(violation.penaltyApplied || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Incident Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold mb-1 text-[11px]">
                <Calendar size={13} /> Date & Time
              </div>
              <p className="font-bold text-card-foreground">{formattedDate}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {violation.timeOfIncident ? `${violation.timeOfIncident}` : "Time unspecified"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold mb-1 text-[11px]">
                <MapPin size={13} /> Location
              </div>
              <p className="font-bold text-card-foreground truncate">
                {violation.locationOfIncident || "Assigned Room"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{violation.branch}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold mb-1 text-[11px]">
                <ShieldAlert size={13} /> Category
              </div>
              <p className="font-bold text-card-foreground capitalize truncate">
                {violation.violationType?.replace(/_/g, " ")}
              </p>
              {violation.customViolationDescription && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={violation.customViolationDescription}>
                  {violation.customViolationDescription}
                </p>
              )}
            </div>
          </div>

          {/* Incident Description Notes */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Incident Evidence & Observation Notes
            </p>
            <p className="text-xs text-card-foreground leading-relaxed whitespace-pre-wrap">
              {violation.evidenceNotes || violation.description || "No written notes provided."}
            </p>
          </div>

          {/* Photo Evidence Viewer */}
          {primaryPhoto ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Photo Evidence
                </p>
                <a
                  href={primaryPhoto}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  <ExternalLink size={13} /> View Full Resolution
                </a>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
                <img
                  src={primaryPhoto}
                  alt="Incident Photo Evidence"
                  className="max-h-64 w-full object-contain mx-auto"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/10 p-3 text-center text-xs text-muted-foreground italic">
              No photo evidence attached to this infraction record.
            </div>
          )}

          {/* Penalty & Billing Status */}
          {Number(violation.penaltyApplied) > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-card-foreground">Penalty Assessment Details</span>
                <span className="text-xs font-bold text-red-600">
                  ₱{Number(violation.penaltyApplied).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {violation.penaltyReason && (
                <p className="text-xs text-muted-foreground">
                  <strong className="text-card-foreground">Basis:</strong> {violation.penaltyReason}
                </p>
              )}
            </div>
          )}

          {/* Adjudication Decision Section */}
          {isPendingDecision ? (
            <form onSubmit={handleDecisionSubmit} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                Administrative Adjudication & Action
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-card-foreground mb-1">Board Decision</label>
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                  >
                    <option value="confirmed">Confirm Infraction (Substantiated)</option>
                    <option value="dismissed">Dismiss Infraction (Unsubstantiated)</option>
                  </select>
                </div>

                {decision === "confirmed" && (
                  <div>
                    <label className="block font-semibold text-card-foreground mb-1">Enforcement Action</label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                      className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    >
                      <option value="warning_issued">Issue Formal Written Warning</option>
                      <option value="penalty_issued">Enforce Penalty Fee on Ledger</option>
                      <option value="escalated">Escalate to Termination Review Board</option>
                      <option value="resolved">Mark Resolved / Closed</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-card-foreground mb-1">
                  Administrative Decision Rationale <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Record formal administrative findings, evidence evaluation, or warning notice delivery details..."
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                />
              </div>

              {decision === "confirmed" && Number(violation.penaltyApplied) > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-xs">
                  <input
                    type="checkbox"
                    id="adjudicateChargeToBill"
                    checked={chargeToBill}
                    onChange={(e) => setChargeToBill(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border"
                  />
                  <label htmlFor="adjudicateChargeToBill" className="cursor-pointer text-[11px] text-card-foreground">
                    Append penalty fee (₱{Number(violation.penaltyApplied).toFixed(2)}) to resident's current/next billing statement
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={adjudicating}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                >
                  {adjudicating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Recording Decision...
                    </>
                  ) : (
                    "Save & Action Decision"
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Historical Decision Summary */
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-card-foreground flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  Decision: {violation.adminDecision === "confirmed" ? "Confirmed (Substantiated)" : "Dismissed"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Decided by {violation.decidedByName || "Administrator"} on{" "}
                  {violation.decidedAt ? new Date(violation.decidedAt).toLocaleDateString("en-PH") : "Recorded"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                <strong className="text-card-foreground">Findings & Basis:</strong> {violation.adminDecisionReason || violation.resolution || "Case closed."}
              </p>
              {violation.status === "escalated" && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 font-medium">
                  ⚠️ This case has been formally escalated to the Administrative Termination Review Board.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-6 py-3 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-xl border border-border bg-card px-4 text-xs font-bold text-card-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
