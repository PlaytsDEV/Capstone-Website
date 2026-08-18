import React, { useState } from "react";
import { Calendar, Clock, CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";
import { chatbotApi } from "../../../../../shared/api/chatbotApi";

const TIME_SLOTS = ["10:00 AM", "2:00 PM", "4:00 PM", "6:00 PM"];

/**
 * Helper to get tomorrow's date formatted as YYYY-MM-DD for min date constraint.
 */
function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper to get date 3 months from today formatted as YYYY-MM-DD for max date constraint.
 */
function getThreeMonthsLaterDateString() {
  const max = new Date();
  max.setMonth(max.getMonth() + 3);
  const year = max.getFullYear();
  const month = String(max.getMonth() + 1).padStart(2, "0");
  const day = String(max.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * ChatViewingBookingCard
 *
 * In-chat dormitory tour appointment scheduler widget.
 */
export function ChatViewingBookingCard({ data = {}, onBookingComplete }) {
  const initialBranch = data.branch === "guadalupe" ? "guadalupe" : "gil_puyat";

  const [branch, setBranch] = useState(initialBranch);
  const [date, setDate] = useState(getTomorrowDateString());
  const [timeSlot, setTimeSlot] = useState("2:00 PM");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Field validation rules
  const errors = {};
  if (!name.trim()) {
    errors.name = "Full name is required";
  } else if (name.trim().length < 2) {
    errors.name = "Please enter a valid name";
  }

  if (!email.trim()) {
    errors.email = "Email address is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!phone.trim()) {
    errors.phone = "Mobile phone number is required";
  } else if (phone.trim().replace(/\D/g, "").length < 10) {
    errors.phone = "Enter a valid 10-11 digit contact number";
  }

  if (!date) {
    errors.date = "Tour date is required";
  } else {
    const minD = new Date(getTomorrowDateString());
    const maxD = new Date(getThreeMonthsLaterDateString());
    const selectedD = new Date(date);
    if (isNaN(selectedD.getTime()) || selectedD < minD || selectedD > maxD) {
      errors.date = "Tour date must be between tomorrow and 3 months from today";
    }
  }

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setTouched({ name: true, email: true, phone: true, date: true });

    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");

    const branchLabel = branch === "guadalupe" ? "Guadalupe (Makati)" : "Gil Puyat (Pasay)";
    const messageDetails = `Scheduled In-Person Dormitory Tour for ${branchLabel} on ${date} at ${timeSlot}. Prospective Tenant: ${name.trim()} (${email.trim()}, ${phone.trim()}).`;

    try {
      const response = await chatbotApi.escalateChatbotLead({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferredBranch: branch,
        preferredRoomType: "undecided",
        message: messageDetails,
        source: "chatbot_tour_booking_widget",
      });

      const inquiryId = response?.data?.inquiryId || response?.inquiryId || `TOUR-${Date.now().toString().slice(-6)}`;
      const resultPayload = {
        inquiryId,
        branch: branchLabel,
        date,
        timeSlot,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      };

      setBookingSuccess(resultPayload);
      if (onBookingComplete) {
        onBookingComplete(resultPayload);
      }
    } catch (err) {
      console.error("Tour booking submission failed:", err);
      setSubmitError(err?.message || "Failed to schedule viewing tour. Please check your network and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success State View
  if (bookingSuccess) {
    return (
      <div
        className="my-2.5 p-4 rounded-xl text-left select-none transition-all duration-200"
        style={{
          backgroundColor: "var(--lp-bg-card, #ffffff)",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          boxShadow: "0 2px 8px rgba(10, 22, 40, 0.05)",
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Tour Scheduled Successfully!
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Ref ID: <span className="font-mono font-semibold">{bookingSuccess.inquiryId}</span>
            </p>
          </div>
        </div>

        <div
          className="p-2.5 rounded-lg space-y-1.5 text-xs mb-3"
          style={{
            backgroundColor: "var(--surface-input, #f8fafc)",
            border: "1px solid var(--lp-border, #E6D9B2)",
            color: "var(--lp-text, #162f53)",
          }}
        >
          <div className="flex justify-between">
            <span className="text-slate-500">Branch:</span>
            <span className="font-semibold">{bookingSuccess.branch}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date & Time:</span>
            <span className="font-semibold">{bookingSuccess.date} • {bookingSuccess.timeSlot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Visitor:</span>
            <span className="font-semibold">{bookingSuccess.name}</span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
          Our branch receptionist will contact you via SMS or email within 24 hours to confirm visitor gate pass details.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="my-2.5 p-3.5 rounded-xl text-left select-none transition-all duration-200"
      style={{
        backgroundColor: "var(--lp-bg-card, #ffffff)",
        border: "1px solid var(--lp-border, #E6D9B2)",
        boxShadow: "0 2px 8px rgba(10, 22, 40, 0.05)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold" style={{ color: "var(--lp-text, #162f53)" }}>
            Schedule an In-Person Dorm Tour
          </h4>
          <p className="text-[10px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
            Select your preferred branch, date, and viewing time slot.
          </p>
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-1.5 mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-[11px] text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="space-y-2.5 text-xs">
        {/* Branch Selector */}
        <div>
          <label htmlFor="tour-branch-select" className="block text-[11px] font-bold mb-1" style={{ color: "#0A1628" }}>
            Select Branch <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              id="tour-branch-gil-puyat"
              type="button"
              onClick={() => setBranch("gil_puyat")}
              className="py-1.5 px-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer border shadow-xs"
              style={{
                backgroundColor: branch === "gil_puyat" ? "#0A1628" : "#FFFFFF",
                borderColor: branch === "gil_puyat" ? "#0A1628" : "#CBD5E1",
                color: branch === "gil_puyat" ? "#FFFFFF" : "#0A1628",
              }}
            >
              Gil Puyat (Pasay)
            </button>
            <button
              id="tour-branch-guadalupe"
              type="button"
              onClick={() => setBranch("guadalupe")}
              className="py-1.5 px-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer border shadow-xs"
              style={{
                backgroundColor: branch === "guadalupe" ? "#0A1628" : "#FFFFFF",
                borderColor: branch === "guadalupe" ? "#0A1628" : "#CBD5E1",
                color: branch === "guadalupe" ? "#FFFFFF" : "#0A1628",
              }}
            >
              Guadalupe (Makati)
            </button>
          </div>
        </div>

        {/* Date & Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Date Picker */}
          <div>
            <label htmlFor="tour-date-input" className="block text-[11px] font-bold mb-1" style={{ color: "#0A1628" }}>
              Tour Date <span className="text-red-500">*</span>
            </label>
            <input
              id="tour-date-input"
              type="date"
              min={getTomorrowDateString()}
              max={getThreeMonthsLaterDateString()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-lg border text-xs outline-none font-medium"
              style={{
                backgroundColor: "var(--surface-input, #f8fafc)",
                borderColor: touched.date && errors.date ? "#ef4444" : "var(--lp-border, #E6D9B2)",
                color: "#0A1628",
              }}
            />
          </div>

          {/* Time Slot Chips */}
          <div>
            <span className="block text-[11px] font-bold mb-1" style={{ color: "#0A1628" }}>
              Time Slot <span className="text-red-500">*</span>
            </span>
            <div className="grid grid-cols-2 gap-1">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTimeSlot(slot)}
                  className="py-1.5 px-1 rounded-md text-[11px] font-bold text-center transition-all cursor-pointer border shadow-xs"
                  style={{
                    backgroundColor: timeSlot === slot ? "#0A1628" : "#FFFFFF",
                    borderColor: timeSlot === slot ? "#0A1628" : "#CBD5E1",
                    color: timeSlot === slot ? "#FFFFFF" : "#0A1628",
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visitor Contact Fields */}
        <div>
          <label htmlFor="tour-name-input" className="block text-[11px] font-semibold mb-1" style={{ color: "var(--lp-text, #162f53)" }}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="tour-name-input"
            type="text"
            placeholder="e.g. Maria Santos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
            className="w-full py-1.5 px-2.5 rounded-lg border text-xs outline-none"
            style={{
              backgroundColor: "var(--surface-input, #f8fafc)",
              borderColor: touched.name && errors.name ? "#ef4444" : "var(--lp-border, #E6D9B2)",
              color: "var(--lp-text, #162f53)",
            }}
          />
          {touched.name && errors.name && (
            <span className="text-[10px] text-red-600 mt-0.5 block">{errors.name}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor="tour-email-input" className="block text-[11px] font-semibold mb-1" style={{ color: "var(--lp-text, #162f53)" }}>
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="tour-email-input"
              type="email"
              placeholder="e.g. maria@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
              className="w-full py-1.5 px-2.5 rounded-lg border text-xs outline-none"
              style={{
                backgroundColor: "var(--surface-input, #f8fafc)",
                borderColor: touched.email && errors.email ? "#ef4444" : "var(--lp-border, #E6D9B2)",
                color: "var(--lp-text, #162f53)",
              }}
            />
            {touched.email && errors.email && (
              <span className="text-[10px] text-red-600 mt-0.5 block">{errors.email}</span>
            )}
          </div>

          <div>
            <label htmlFor="tour-phone-input" className="block text-[11px] font-semibold mb-1" style={{ color: "var(--lp-text, #162f53)" }}>
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              id="tour-phone-input"
              type="tel"
              placeholder="0917 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
              className="w-full py-1.5 px-2.5 rounded-lg border text-xs outline-none"
              style={{
                backgroundColor: "var(--surface-input, #f8fafc)",
                borderColor: touched.phone && errors.phone ? "#ef4444" : "var(--lp-border, #E6D9B2)",
                color: "var(--lp-text, #162f53)",
              }}
            />
            {touched.phone && errors.phone && (
              <span className="text-[10px] text-red-600 mt-0.5 block">{errors.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-3.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        style={{
          backgroundColor: "#0A1628",
          border: "1px solid #0A1628",
          color: "#FFFFFF",
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting) e.currentTarget.style.backgroundColor = "#1A2C4E";
        }}
        onMouseLeave={(e) => {
          if (!isSubmitting) e.currentTarget.style.backgroundColor = "#0A1628";
        }}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="w-4 h-4 animate-spin" />
            <span className="text-white font-bold">Scheduling Dorm Tour...</span>
          </>
        ) : (
          <>
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold">Confirm & Book Dorm Tour</span>
          </>
        )}
      </button>
    </form>
  );
}

export default ChatViewingBookingCard;
