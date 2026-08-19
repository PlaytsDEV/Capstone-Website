import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import {
  CalendarDays,
  User,
  Home,
  MapPin,
  Clock,
  Ban,
  X,
  Eye,
  Video,
  Loader2,
  AlertCircle,
} from "lucide-react";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import "../styles/reservation-details-modal.css";
import { APP_LOCALE, fmtShortDate } from "../../../shared/utils/dateFormat";

/* ─── helpers ────────────────────────────────────────── */
const fmt = (v) => (v === null || v === undefined || v === "" ? "—" : v);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(APP_LOCALE, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

const STATUS_CONFIGS = [
  {
    test: (s) => s.visitStatus === "allowed_without_visit",
    textClass: "text-teal-700 dark:text-teal-300",
    dotClass: "bg-teal-500",
    label: "Allowed Without Visit",
  },
  {
    test: (s) => s.visitStatus === "visit_completed",
    textClass: "text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    label: "Visit Completed",
  },
  {
    test: (s) => s.visitStatus === "no_show",
    textClass: "text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
    label: "No-Show",
  },
  {
    test: (s) => s.visitStatus === "rescheduled",
    textClass: "text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
    label: "Rescheduled",
  },
  {
    test: (s) => s.visitStatus === "visit_cancelled",
    textClass: "text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
    label: "Visit Cancelled",
  },
  {
    test: (s) => s.visitApproved,
    textClass: "text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    label: "Visit Completed",
  },
  {
    test: (s) => s.scheduleApproved,
    textClass: "text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-500",
    label: "Awaiting Visit",
  },
  {
    test: (s) => s.scheduleRejected,
    textClass: "text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
    label: "Schedule Rejected",
  },
];

const getStatusCfg = (schedule) =>
  STATUS_CONFIGS.find((c) => c.test(schedule)) || {
    textClass: "text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-500",
    label: "Awaiting Visit",
  };

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AP";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ─── sub-components ─────────────────────────────────── */
const InfoRow = ({ label, value, wide }) => (
  <div className="flex flex-col gap-0.5" style={wide ? { gridColumn: "span 2" } : {}}>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
    </span>
    <span className="text-xs font-medium text-slate-900 dark:text-slate-100 break-words">
      {value || "—"}
    </span>
  </div>
);

const SectionCard = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
    <h4 className="flex items-center gap-2 pb-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />}
      <span>{title}</span>
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5">
      {children}
    </div>
  </div>
);

/* ─── main component ──────────────────────────────────── */
export default function VisitDetailsModal({ schedule, onClose, onUpdate }) {
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useBodyScrollLock(!!schedule);
  useEscapeClose(!!schedule, onClose);

  useEffect(() => {
    if (schedule) {
      setRejectReason("");
      setHasAttemptedSubmit(false);
    }
  }, [schedule]);

  if (!schedule) return null;

  const handleRejectSubmit = async () => {
    setHasAttemptedSubmit(true);
    const trimmedReason = rejectReason.trim();

    if (!trimmedReason) {
      showNotification("Please select a preset reason or enter an explanation before rejecting.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      await reservationApi.manageVisit(schedule.id, {
        action: "reject_schedule",
        note: trimmedReason,
      });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      showNotification("Visit schedule rejected successfully. The applicant has been notified.", "success");
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Error rejecting schedule:", error);
      showNotification("Unable to reject the visit schedule. Please check your connection and try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showRejectBtn =
    !schedule?.visitApproved &&
    !schedule?.scheduleRejected &&
    !["visit_completed", "no_show", "visit_cancelled"].includes(
      schedule?.visitStatus,
    );

  const cfg = getStatusCfg(schedule);

  const REJECT_PRESETS = [
    { label: "Schedule conflict", text: "The selected date/time conflicts with an existing schedule. Please choose a different slot." },
    { label: "Branch unavailable", text: "The branch is temporarily unavailable for visits on the selected date. Please pick another date." },
    { label: "Capacity reached", text: "Visit capacity has been reached for this date. Please select an alternative date." },
    { label: "Incomplete info", text: "We need additional information before approving your visit. Please update your reservation details." },
  ];

  const initials = getInitials(schedule.customer);
  const isReasonEmpty = !rejectReason.trim();

  // Dynamic counter threshold color
  const charLength = rejectReason.length;
  const counterColorClass =
    charLength >= 480
      ? "text-rose-600 dark:text-rose-400 font-semibold"
      : charLength >= 400
      ? "text-amber-600 dark:text-amber-400"
      : "text-slate-400 dark:text-slate-500";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="visit-details-modal-title"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Executive Header ── */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-sm font-bold tracking-wide shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0">
              <h2
                id="visit-details-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                {fmt(schedule.customer)}
              </h2>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {schedule.reservationCode && schedule.reservationCode !== "—" && (
                  <>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {schedule.reservationCode}
                    </span>
                    <span>&bull;</span>
                  </>
                )}
                <span className="truncate">{fmt(schedule.email)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Status Badge with Transparent Background & Semantic Status Dot */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-transparent ${cfg.textClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dotClass} shrink-0`} />
              <span>{cfg.label}</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {/* Rejection reason banner (if already rejected) */}
          {schedule.scheduleRejected && schedule.scheduleRejectionReason && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-1">
              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Ban size={13} className="shrink-0" />
                <span>Rejection Reason</span>
              </p>
              <p className="text-xs font-medium text-rose-900 dark:text-rose-200 leading-relaxed">
                {schedule.scheduleRejectionReason}
              </p>
            </div>
          )}

          {/* Applicant Information */}
          <SectionCard icon={User} title="Applicant Information">
            <InfoRow label="Full Name" value={fmt(schedule.customer)} />
            <InfoRow label="Email" value={fmt(schedule.email)} />
            <InfoRow label="Phone Number" value={fmt(schedule.phone)} />
            <InfoRow label="Billing Email" value={fmt(schedule.billingEmail)} />
          </SectionCard>

          {/* Room Information */}
          <SectionCard icon={Home} title="Room Information">
            <InfoRow label="Room" value={fmt(schedule.room)} />
            <InfoRow label="Branch" value={fmt(schedule.branch)} />
          </SectionCard>

          {/* Visit Details */}
          <SectionCard icon={CalendarDays} title="Visit Details">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Visit Type
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {schedule.viewingType === "remote_2d" || schedule.viewingType === "remote_2d_viewing" ? (
                  <>
                    <Video size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>2D Remote Viewing</span>
                  </>
                ) : schedule.viewingType === "urgent_movein" ? (
                  <>
                    <CalendarDays size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Urgent Move-in Review</span>
                  </>
                ) : (
                  <>
                    <Eye size={14} className="text-slate-600 dark:text-slate-300 shrink-0" />
                    <span>Physical Visit</span>
                  </>
                )}
              </span>
            </div>
            <InfoRow label="Schedule Requested On" value={formatDate(schedule.scheduledDate)} />
            <InfoRow label="Visit Date" value={formatDate(schedule.visitDate)} />
            <InfoRow label="Visit Time" value={fmt(schedule.visitTime)} />
            {schedule.isOutOfTown && (
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current Location (Out of Town)
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 mt-0.5">
                  <MapPin size={13} className="text-slate-500 shrink-0" />
                  {schedule.currentLocation || "Not specified"}
                </span>
              </div>
            )}
          </SectionCard>

          {/* Rejection Reasons Section (Interactive Action Card) */}
          {showRejectBtn && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  <Ban size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Rejection Reason & Presets</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Select a preset reason below or write a custom explanation for the applicant.
                </p>
              </div>

              {/* Preset Reason Chips */}
              <div className="flex flex-wrap gap-2">
                {REJECT_PRESETS.map((t) => {
                  const isActive = rejectReason === t.text;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setRejectReason(isActive ? "" : t.text);
                        setHasAttemptedSubmit(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                        isActive
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Textarea Input with Real-time Ergonomics */}
              <div className="space-y-1.5">
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value.slice(0, 500));
                    if (hasAttemptedSubmit) setHasAttemptedSubmit(false);
                  }}
                  placeholder="Type specific reason for rejection..."
                  maxLength={500}
                  rows={3}
                  className={`w-full p-3 rounded-lg border text-xs font-normal text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all resize-y ${
                    hasAttemptedSubmit && isReasonEmpty
                      ? "border-rose-500 ring-rose-500/20 dark:border-rose-500"
                      : "border-slate-300 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                  }`}
                />

                <div className="flex items-center justify-between text-[11px]">
                  {hasAttemptedSubmit && isReasonEmpty ? (
                    <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>Please select a preset or type a rejection reason.</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">
                      Applicant will receive this explanation via email & system notification.
                    </span>
                  )}
                  <span className={`tabular-nums ${counterColorClass}`}>
                    {charLength}/500
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Visit History Timeline */}
          {schedule.visitHistory && schedule.visitHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
              <h4 className="flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800">
                <Clock size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span>Visit Schedule History</span>
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {schedule.visitHistory
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.scheduledAt || b.rejectedAt || 0) -
                      new Date(a.scheduledAt || a.rejectedAt || 0),
                  )
                  .map((entry, idx) => {
                    const MAP = {
                      pending: { textClass: "text-amber-700 dark:text-amber-300", dotClass: "bg-amber-500", label: "Scheduled" },
                      schedule_approved: { textClass: "text-emerald-700 dark:text-emerald-300", dotClass: "bg-emerald-500", label: "Schedule Approved" },
                      rejected: { textClass: "text-rose-700 dark:text-rose-400", dotClass: "bg-rose-500", label: "Rejected" },
                      approved: { textClass: "text-emerald-700 dark:text-emerald-300", dotClass: "bg-emerald-500", label: "Completed" },
                      cancelled: { textClass: "text-slate-600 dark:text-slate-400", dotClass: "bg-slate-400", label: "Cancelled" },
                      rescheduled: { textClass: "text-amber-700 dark:text-amber-300", dotClass: "bg-amber-500", label: "Rescheduled" },
                      completed: { textClass: "text-emerald-700 dark:text-emerald-300", dotClass: "bg-emerald-500", label: "Completed" },
                      no_show: { textClass: "text-amber-700 dark:text-amber-300", dotClass: "bg-amber-500", label: "No-Show" },
                      visit_cancelled: { textClass: "text-rose-700 dark:text-rose-400", dotClass: "bg-rose-500", label: "Visit Cancelled" },
                      allowed_without_visit: { textClass: "text-teal-700 dark:text-teal-300", dotClass: "bg-teal-500", label: "Allowed Without Visit" },
                    };
                    const s = MAP[entry.status] || MAP.pending;
                    const entryDate = entry.visitDate ? fmtShortDate(entry.visitDate) : "N/A";
                    const actionDate = entry.rejectedAt || entry.approvedAt || entry.updatedAt || entry.scheduledAt;
                    const actionDateStr = actionDate
                      ? new Date(actionDate).toLocaleDateString(APP_LOCALE, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div key={idx} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className={`w-2 h-2 rounded-full ${s.dotClass} mt-1.5 shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              Visit on {entryDate}
                              {entry.visitTime ? ` at ${entry.visitTime}` : ""}
                            </span>
                            <span className={`text-[11px] font-semibold uppercase tracking-wider bg-transparent ${s.textClass}`}>
                              {s.label}
                            </span>
                          </div>
                          {entry.rejectionReason && (
                            <div className="text-xs text-rose-700 dark:text-rose-400 mt-1 font-medium leading-relaxed">
                              Reason: {entry.rejectionReason}
                            </div>
                          )}
                          {actionDateStr && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {actionDateStr}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── Executive Footer Controls ── */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3 shrink-0">
          {showRejectBtn ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isSubmitting || isReasonEmpty}
                title={
                  isReasonEmpty
                    ? "Please select a preset reason or enter an explanation before confirming rejection"
                    : "Confirm visit schedule rejection"
                }
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isSubmitting || isReasonEmpty
                    ? "bg-rose-100 text-rose-400 dark:bg-rose-950/40 dark:text-rose-500 cursor-not-allowed border border-transparent"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-xs active:scale-[0.98] cursor-pointer"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Rejecting Visit…</span>
                  </>
                ) : (
                  <>
                    <Ban size={14} />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body,
  );
}
