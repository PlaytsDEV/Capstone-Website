import React, { useState } from "react";
import { User, Mail, Phone, Building, HelpCircle, CheckCircle2, Loader2, ArrowLeft, Send, Headphones } from "lucide-react";
import { chatbotApi } from "../../../../shared/api/chatbotApi";

const BRANCH_OPTIONS = [
  { value: "all", label: "All Branches / General Assistance" },
  { value: "gil_puyat", label: "Gil Puyat Branch (Pasay City)" },
  { value: "guadalupe", label: "Guadalupe Branch (Makati City)" },
];

const CONCERN_CATEGORIES = [
  { value: "general_inquiry", label: "General Question & Information" },
  { value: "room_availability", label: "Room Availability & Rates" },
  { value: "house_rules", label: "House Policies, Visitors & Curfew" },
  { value: "reservation_process", label: "Application & Payment Assistance" },
  { value: "ocular_visit", label: "Schedule an In-Person Ocular Visit" },
];

const MSG_MAX = 500;

/**
 * ChatLeadEscalationForm
 *
 * Dedicated modal form for visitors to request Front Desk staff assistance or a callback.
 */
export function ChatLeadEscalationForm({
  initialBranch = "all",
  initialMessage = "",
  onCancel,
  onSuccessSubmitted,
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    preferredBranch: initialBranch || "all",
    concernCategory: "general_inquiry",
    message: initialMessage || "",
  });

  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedRequest, setSubmittedRequest] = useState(null);

  // Field validation helpers
  const validate = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "Full name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      errors.phone = "Phone number is required";
    } else if (!cleanPhone.startsWith("9")) {
      errors.phone = "Phone must start with 9 after +63 (e.g. 917 123 4567)";
    } else if (cleanPhone.length !== 10) {
      errors.phone = "Enter 10 digits starting with 9";
    }

    if (formData.message.length > MSG_MAX) {
      errors.message = `Message cannot exceed ${MSG_MAX} characters`;
    }

    return errors;
  };

  const errors = validate();
  const isValid = Object.keys(errors).length === 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const truncated = raw.slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: truncated }));
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      name: true,
      email: true,
      phone: true,
      preferredBranch: true,
      concernCategory: true,
      message: true,
    });

    if (!isValid) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const fullPhone = `+63${formData.phone}`;
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: fullPhone,
        preferredBranch: formData.preferredBranch,
        preferredRoomType: formData.concernCategory,
        message: formData.message || `Front Desk Assistance Request (${formData.concernCategory})`,
        source: "chatbot_front_desk_request",
      };

      const result = await chatbotApi.escalateChatbotLead(payload);
      setSubmittedRequest(result);
      if (onSuccessSubmitted) {
        onSuccessSubmitted(result);
      }
    } catch (err) {
      setSubmitError(
        err?.message || "Failed to submit your request. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format phone display: 9171234567 -> 917 123 4567
  const formatPhoneDisplay = (digits) => {
    if (!digits) return "";
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  // Success view
  if (submittedRequest) {
    return (
      <div className="p-4 text-center animate-fadeIn">
        <div
          className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: "rgba(5, 150, 105, 0.12)", color: "#059669" }}
        >
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold tracking-tight mb-1" style={{ color: "var(--lp-text, #162f53)" }}>
          Assistance Request Submitted
        </h4>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--lp-text-secondary, #475569)" }}>
          {submittedRequest?.message ||
            "Your message has been routed to our Front Desk Admin Team. We will contact you via email or phone shortly."}
        </p>

        {submittedRequest?.inquiryId && (
          <div
            className="p-2.5 rounded-lg mb-4 text-xs font-mono select-all"
            style={{
              backgroundColor: "var(--lp-bg-card, #ffffff)",
              border: "1px solid var(--lp-border, #E6D9B2)",
              color: "var(--lp-text, #162f53)",
            }}
          >
            Ref: {submittedRequest.inquiryId}
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-sm focus:outline-none"
          style={{ backgroundColor: "var(--lp-navy, #0A1628)" }}
        >
          Return to Conversation
        </button>
      </div>
    );
  }

  return (
    <div className="p-1 animate-fadeIn text-left">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: "var(--lp-text-muted, #64748B)" }} />
          </button>
          <div>
            <h4 className="text-xs font-bold tracking-tight flex items-center gap-1.5" style={{ color: "var(--lp-text, #162f53)" }}>
              <Headphones className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
              Request Front Desk Assistance
            </h4>
            <p className="text-[10px]" style={{ color: "var(--lp-text-muted, #64748B)" }}>
              Our admin team will contact you promptly
            </p>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="p-2 mb-2 rounded-lg text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Full Name */}
        <div>
          <label className="block text-[11px] font-semibold mb-0.5" style={{ color: "var(--lp-text, #162f53)" }}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              name="name"
              placeholder="e.g. Maria Santos"
              value={formData.name}
              onChange={handleChange}
              onBlur={() => handleBlur("name")}
              className={`w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border outline-none transition-all ${
                touched.name && errors.name
                  ? "border-red-500 bg-red-50/50"
                  : "border-slate-300 dark:border-slate-700 focus:border-amber-500"
              }`}
              style={{ backgroundColor: "var(--surface-input, #f8fafc)", color: "var(--lp-text, #162f53)" }}
            />
          </div>
          {touched.name && errors.name && (
            <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-[11px] font-semibold mb-0.5" style={{ color: "var(--lp-text, #162f53)" }}>
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="email"
              name="email"
              placeholder="maria.santos@gmail.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => handleBlur("email")}
              className={`w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border outline-none transition-all ${
                touched.email && errors.email
                  ? "border-red-500 bg-red-50/50"
                  : "border-slate-300 dark:border-slate-700 focus:border-amber-500"
              }`}
              style={{ backgroundColor: "var(--surface-input, #f8fafc)", color: "var(--lp-text, #162f53)" }}
            />
          </div>
          {touched.email && errors.email && (
            <p className="text-[10px] text-red-500 mt-0.5">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-[11px] font-semibold mb-0.5" style={{ color: "var(--lp-text, #162f53)" }}>
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div className="relative flex">
            <span
              className="inline-flex items-center px-2.5 text-xs font-medium border border-r-0 rounded-l-lg select-none"
              style={{
                backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.1))",
                borderColor: touched.phone && errors.phone ? "#ef4444" : "var(--lp-border, #E6D9B2)",
                color: "var(--lp-text, #162f53)",
              }}
            >
              +63
            </span>
            <input
              type="tel"
              name="phone"
              placeholder="917 123 4567"
              value={formatPhoneDisplay(formData.phone)}
              onChange={handlePhoneChange}
              onBlur={() => handleBlur("phone")}
              className={`w-full text-xs px-2.5 py-1.5 rounded-r-lg border outline-none transition-all ${
                touched.phone && errors.phone
                  ? "border-red-500 bg-red-50/50"
                  : "border-slate-300 dark:border-slate-700 focus:border-amber-500"
              }`}
              style={{ backgroundColor: "var(--surface-input, #f8fafc)", color: "var(--lp-text, #162f53)" }}
            />
          </div>
          {touched.phone && errors.phone && (
            <p className="text-[10px] text-red-500 mt-0.5">{errors.phone}</p>
          )}
        </div>

        {/* Target Branch */}
        <div>
          <label className="block text-[11px] font-semibold mb-0.5" style={{ color: "var(--lp-text, #162f53)" }}>
            Target Branch
          </label>
          <select
            name="preferredBranch"
            value={formData.preferredBranch}
            onChange={handleChange}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 outline-none focus:border-amber-500"
            style={{ backgroundColor: "var(--surface-input, #f8fafc)", color: "var(--lp-text, #162f53)" }}
          >
            {BRANCH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Concern Topic */}
        <div>
          <label className="block text-[11px] font-semibold mb-0.5" style={{ color: "var(--lp-text, #162f53)" }}>
            Topic / Concern
          </label>
          <select
            name="concernCategory"
            value={formData.concernCategory}
            onChange={handleChange}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 outline-none focus:border-amber-500"
            style={{ backgroundColor: "var(--surface-input, #f8fafc)", color: "var(--lp-text, #162f53)" }}
          >
            {CONCERN_CATEGORIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Message / Question */}
        <div>
          <div className="flex justify-between items-center mb-0.5">
            <label className="text-[11px] font-semibold" style={{ color: "var(--lp-text, #162f53)" }}>
              Concern Details
            </label>
            <span className="text-[10px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
              {formData.message.length}/{MSG_MAX}
            </span>
          </div>
          <textarea
            name="message"
            rows={2}
            placeholder="Describe your question or assistance needed..."
            value={formData.message}
            onChange={handleChange}
            maxLength={MSG_MAX}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 outline-none resize-none focus:border-amber-500"
            style={{ backgroundColor: "var(--surface-input, #f8fafc)", color: "var(--lp-text, #162f53)" }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{
              borderColor: "var(--lp-border, #E6D9B2)",
              color: "var(--lp-text-secondary, #475569)",
              backgroundColor: "transparent",
            }}
          >
            Back to Chat
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:outline-none active:scale-95"
            style={{
              backgroundColor: "var(--lp-accent, #D4AF37)",
              border: "1px solid var(--lp-accent, #D4AF37)",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3 h-3 text-white" />
                <span>Submit Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatLeadEscalationForm;
