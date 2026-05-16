import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { showNotification } from "../../../../shared/utils/notification";

/* ── SVG path data ─────────────────────────────────────────── */
const svgPaths = {
  p3e8e8100: "M2.33333 9.33333H23.3333C23.9522 9.33333 24.5457 9.57917 24.9832 10.0168C25.4208 10.4543 25.6667 11.0478 25.6667 11.6667V23.3333",
  p1da67b80: "M15.8333 3.33333H4.16667C3.24619 3.33333 2.5 4.07953 2.5 5V16.6667C2.5 17.5871 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5871 17.5 16.6667V5C17.5 4.07953 16.7538 3.33333 15.8333 3.33333Z",
  p14d24500: "M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z",
  p3713e00:  "M12.5 1.66667H5C4.55797 1.66667 4.13405 1.84226 3.82149 2.15482C3.50893 2.46738 3.33333 2.89131 3.33333 3.33333V16.6667C3.33333 17.1087 3.50893 17.5326 3.82149 17.8452C4.13405 18.1577 4.55797 18.3333 5 18.3333H15C15.442 18.3333 15.866 18.1577 16.1785 17.8452C16.4911 17.5326 16.6667 17.1087 16.6667 16.6667V5.83333L12.5 1.66667Z",
  pd2076c0:  "M11.6667 1.66667V5C11.6667 5.44203 11.8423 5.86595 12.1548 6.17851C12.4674 6.49107 12.8913 6.66667 13.3333 6.66667H16.6667",
};

const TIME_SLOTS = [
  { label: "08:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "09:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "10:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "11:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "01:00 PM", available: true, capacity: 5, remaining: 5 },
  { label: "02:00 PM", available: true, capacity: 5, remaining: 5 },
  { label: "03:00 PM", available: true, capacity: 5, remaining: 5 },
  { label: "04:00 PM", available: true, capacity: 5, remaining: 5 },
];

/* ── Helpers ─────────────────────────────────────────────── */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function getFallbackAvailabilityDates(count = 10) {
  const dates = [];
  let added = 0, offset = 1;
  while (added < count) {
    const date = addDays(new Date(), offset);
    if (![0, 6].includes(date.getDay())) {
      dates.push({
        date: toISODate(date),
        available: true,
        slots: TIME_SLOTS.map((s) => ({ ...s })),
      });
      added++;
    }
    offset++;
  }
  return dates;
}
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatDateFull(dateStr) {
  if (!dateStr) return "N/A";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function getSlotMeta(slot) {
  const capacity  = Number.isFinite(slot.capacity)  ? slot.capacity  : 5;
  const remaining = Number.isFinite(slot.remaining) ? slot.remaining : capacity;
  const isFull    = remaining <= 0 || slot.available === false;
  const pct       = remaining / capacity;
  const colorClass = isFull ? "text-red-400" : pct > 0.6 ? "text-green-600" : pct > 0.2 ? "text-yellow-600" : "text-red-500";
  return { isFull, colorClass, label: isFull ? "Full" : `${remaining}/${capacity}` };
}

/* ── SVG Icons ───────────────────────────────────────────── */
function CalSVG({ color = "#0C375F", size = 18 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 20 20">
      <path d="M6.66667 1.66667V5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d="M13.3333 1.66667V5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d={svgPaths.p1da67b80} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d="M2.5 8.33333H17.5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
    </svg>
  );
}
function ClockSVG({ color = "#0C375F", size = 18 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 20 20">
      <path d={svgPaths.p14d24500} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d="M10 5V10L13.3333 11.6667" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
    </svg>
  );
}
function DocSVG({ color = "#0C375F", size = 18 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 20 20">
      <path d={svgPaths.p3713e00} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d={svgPaths.pd2076c0} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d="M8.33333 7.5H6.66667" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d="M13.3333 10.8333H6.66667" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
      <path d="M13.3333 14.1667H6.66667" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
    </svg>
  );
}

/* ── Sub-components ─────────────────────────────────────── */
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(12,55,95,0.08)" }}>
        {icon}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold text-[#0c375f] leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Modal — rendered via React Portal directly into document.body
   so it is completely outside any scrollable/overflow container
   and can never be clipped by an ancestor stacking context.
   ───────────────────────────────────────────────────────────── */
function Modal({ show, onBackdropClick, children, animate = true }) {
  // Track mount state for enter animation
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (show) {
      // Next tick so CSS transition fires
      timerRef.current = requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
    return () => cancelAnimationFrame(timerRef.current);
  }, [show]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (show) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [show]);

  if (!show) return null;

  const overlayStyle = {
    // Fixed to the viewport — completely unaffected by any ancestor
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    // Fade in/out
    transition: "opacity 0.2s ease",
    opacity: visible ? 1 : 0,
  };

  const backdropStyle = {
    position: "absolute",
    inset: 0,
    // Full-screen frosted glass — this is the key fix
    background: "rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  const cardStyle = {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "380px",
    background: "#fff",
    borderRadius: "20px",
    boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
    // Slide up + fade
    transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease",
    opacity: visible ? 1 : 0,
  };

  return createPortal(
    <div style={overlayStyle} onClick={onBackdropClick} aria-modal="true" role="dialog">
      {/* Full-viewport blurred backdrop */}
      <div style={backdropStyle} aria-hidden="true" />
      {/* Modal card — stopPropagation so clicking inside doesn't close */}
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body   // ← Mounted on body, outside every container
  );
}

/* ── Main Component ────────────────────────────────────── */
export default function ScheduleVisit({
  reservationData,
  visitDate,
  setVisitDate = () => {},
  visitTime,
  setVisitTime = () => {},
  onPrev,
  onSaveVisit,
  onAfterClose,
  readOnly = false,
  agreedToPrivacy = false,
}) {
  const [policiesAccepted, setPoliciesAccepted] = useState(agreedToPrivacy || readOnly);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const availableDates   = useMemo(() => getFallbackAvailabilityDates(10), []);
  const selectedDateData = useMemo(
    () => availableDates.find((d) => d.date === visitDate),
    [availableDates, visitDate]
  );

  const canSubmit = policiesAccepted && visitDate && visitTime && !isSubmitted;

  const handleDateSelect = (date) => {
    setVisitDate(date);
    if (visitTime) setVisitTime("");
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setIsSaving(true);
    let saved = false;

    try {
      if (onSaveVisit) await onSaveVisit();
      setIsSubmitted(true);
      saved = true;
    } catch (err) {
      console.error("Failed to save visit:", err);
      showNotification(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to schedule your visit. Please try again.",
        "error",
        4000,
      );
    } finally {
      setIsSaving(false);
    }

    if (saved && onAfterClose) {
      try {
        await onAfterClose();
      } catch (err) {
        console.error("Failed to complete visit flow:", err);
      }
    }
  };

  const submitLabel = !visitDate
    ? "Select a date to continue"
    : !visitTime
    ? "Select a time to continue"
    : !policiesAccepted
    ? "Accept policies to continue"
    : "Confirm Visit";

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">

        {/* ── Page title ── */}
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="w-11 h-11 bg-[#e7710f] rounded-xl flex items-center justify-center flex-shrink-0">
            <CalSVG color="white" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0c375f] leading-tight">Schedule Your Visit</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose a date and time, then review our policies.</p>
          </div>
        </div>

        {/* ── Date Selection ── */}
        <Card className="p-5">
          <SectionHeader
            icon={<CalSVG />}
            title="Choose a Date"
            subtitle="Weekdays available for the next 2 weeks"
          />
          <div className="grid grid-cols-5 gap-2">
            {availableDates.map((dateData) => {
              const date       = new Date(dateData.date + "T00:00:00");
              const weekday    = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
              const isSelected = visitDate === dateData.date;
              return (
                <button
                  key={dateData.date}
                  type="button"
                  onClick={() => handleDateSelect(dateData.date)}
                  className={`flex flex-col items-center gap-0.5 py-3.5 rounded-xl border-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e7710f]/50
                    ${isSelected
                      ? "border-[#e7710f] bg-[#fff7ed]"
                      : "border-gray-100 bg-gray-50 hover:bg-[#fff7ed] hover:border-[#e7710f]/40"
                    }`}
                >
                  <span className="text-[10px] font-semibold text-gray-400 tracking-wider">{weekday}</span>
                  <span className={`text-sm font-bold mt-0.5 ${isSelected ? "text-[#e7710f]" : "text-[#0c375f]"}`}>
                    {formatDate(dateData.date)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Time Selection ── */}
        <Card className="p-5">
          <SectionHeader
            icon={<ClockSVG />}
            title="Choose a Time"
            subtitle="Select your preferred arrival slot"
          />
          <div className="grid grid-cols-4 gap-2">
            {(selectedDateData?.slots || TIME_SLOTS).map((slot) => {
              const isSelected = visitTime === slot.label;
              const meta       = getSlotMeta(slot);
              return (
                <button
                  key={slot.label}
                  type="button"
                  onClick={() => !meta.isFull && setVisitTime(slot.label)}
                  disabled={meta.isFull}
                  className={`flex flex-col items-center py-3 rounded-xl border-2 text-sm transition-all
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e7710f]/50
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${isSelected
                      ? "border-[#e7710f] bg-[#fff7ed] text-[#e7710f]"
                      : "border-gray-100 bg-gray-50 text-gray-700 hover:bg-[#fff7ed] hover:border-[#e7710f]/40 cursor-pointer"
                    }`}
                >
                  <span className="font-semibold text-[13px]">{slot.label}</span>
                  <span className={`text-[10px] mt-0.5 font-medium ${meta.colorClass}`}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Policies ── */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <SectionHeader
            icon={<DocSVG color="#92400e" />}
            title="Policies & Terms"
            subtitle="Please read and accept before confirming"
          />
          <label htmlFor="policies-checkbox" className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                id="policies-checkbox"
                checked={policiesAccepted}
                onChange={(e) => setPoliciesAccepted(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                ${policiesAccepted ? "bg-[#e7710f] border-[#e7710f]" : "bg-white border-gray-300 group-hover:border-[#e7710f]/60"}`}>
                {policiesAccepted && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <p className="text-sm text-amber-900 leading-relaxed">
              I have read and agree to the{" "}
              <span className="font-semibold text-[#e7710f]">dormitory policies</span>,{" "}
              <span className="font-semibold text-[#e7710f]">terms & conditions</span>, and{" "}
              <span className="font-semibold text-[#e7710f]">privacy policy</span>
            </p>
          </label>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pb-2">
          {onPrev && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 px-5 rounded-xl border-2 border-gray-200 text-[#0c375f] font-medium text-sm hover:bg-gray-50 transition-colors cursor-pointer flex-shrink-0"
              style={{ height: 50 }}
            >
              <ChevronLeft size={15} />
              Back
            </button>
          )}
          <button
            onClick={() => canSubmit && setShowConfirmModal(true)}
            disabled={!canSubmit}
            className={`flex-1 rounded-xl font-semibold text-sm text-white transition-all
              ${canSubmit
                ? "bg-[#e7710f] hover:bg-[#cc6309] cursor-pointer shadow-sm hover:shadow-md"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            style={{ height: 50 }}
          >
            {submitLabel}
          </button>
        </div>
      </div>

      {/* ── Confirm Modal ──────────────────────────────────────
          Rendered via createPortal into document.body.
          The backdrop covers 100vw × 100vh regardless of any
          ancestor overflow / transform / stacking context.
          ─────────────────────────────────────────────────── */}
      <Modal show={showConfirmModal} onBackdropClick={() => setShowConfirmModal(false)}>
        <div className="p-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(231,113,15,0.1)" }}>
              <CalSVG color="#e7710f" size={28} />
            </div>
            <h3 className="text-lg font-bold text-[#0c375f]">Confirm Your Visit</h3>
            <p className="text-sm text-gray-400 mt-1">You're scheduling a visit on:</p>
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-5">
            <p className="text-[#0c375f] font-semibold text-sm">{formatDateFull(visitDate || "")}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <ClockSVG color="#9ca3af" size={13} />
              <span className="text-gray-500 text-xs">{visitTime}</span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 h-11 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleConfirmSubmit}
              className="flex-1 h-11 bg-[#e7710f] rounded-xl text-sm font-semibold text-white hover:bg-[#cc6309] transition-colors"
            >
              Yes, Book Visit
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Saving Modal ── */}
      <Modal show={isSaving} onBackdropClick={() => {}}>
        <div className="p-8 text-center">
          <div className="w-14 h-14 border-4 border-[#e7710f]/20 border-t-[#e7710f] rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-base font-bold text-[#0c375f] mb-1">Preparing Your Visit Pass</h3>
          <p className="text-gray-400 text-sm">Generating your visit code…</p>
        </div>
      </Modal>
    </div>
  );
}
