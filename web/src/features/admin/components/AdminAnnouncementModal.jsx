import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, LoaderCircle, Save, X } from "lucide-react";
import {
  ANNOUNCEMENT_CATEGORY_OPTIONS,
  formatAnnouncementBranch,
} from "../../../shared/utils/announcementConfig";
import { BRANCH_OPTIONS } from "../../../shared/utils/constants";

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
};

const normalizeInitialData = (data) =>
  data
    ? {
        ...data,
        startsAt: toDateTimeLocal(data.startsAt),
        endsAt: toDateTimeLocal(data.endsAt),
        effectiveDate: toDateTimeLocal(data.effectiveDate),
      }
    : null;

const validateEditForm = (values) => {
  const errors = {};
  const trimmedTitle = (values.title || "").trim();
  const trimmedContent = (values.content || "").trim();

  if (!trimmedTitle) {
    errors.title = "Title is required.";
  } else if (trimmedTitle.length < 3) {
    errors.title = "Title must be at least 3 characters.";
  } else if (trimmedTitle.length > 120) {
    errors.title = "Title must not exceed 120 characters.";
  }

  if (!trimmedContent) {
    errors.content = "Message content is required.";
  } else if (trimmedContent.length < 5) {
    errors.content = "Message content must be at least 5 characters.";
  } else if (trimmedContent.length > 2000) {
    errors.content = "Message content must not exceed 2000 characters.";
  }

  if (values.publicationStatus === "scheduled") {
    if (!values.startsAt) {
      errors.startsAt = "Start date and time are required for scheduled notices.";
    }
    if (values.startsAt && values.endsAt) {
      const startMs = new Date(values.startsAt).getTime();
      const endMs = new Date(values.endsAt).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
        errors.endsAt = "End date must be strictly after the start date.";
      }
    }
  }

  if (values.contentType === "policy") {
    const versionNum = Number(values.version);
    if (!versionNum || versionNum < 1 || !Number.isInteger(versionNum)) {
      errors.version = "Version must be a positive whole number.";
    }
    if (values.policyKey && !/^[a-z0-9-_]+$/i.test(values.policyKey.trim())) {
      errors.policyKey = "Policy key may only contain letters, numbers, hyphens, and underscores.";
    }
  }

  return errors;
};

const generatePolicySlug = (title) =>
  String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ringFocus = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = "var(--ring)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.outline = "none";
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = "";
    e.currentTarget.style.boxShadow = "";
    e.currentTarget.style.outline = "";
  },
};

export default function AdminAnnouncementModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  initialData,
  isOwner,
  defaultBranch,
}) {
  const normalizedInitialData = useMemo(
    () => normalizeInitialData(initialData),
    [initialData],
  );

  const [form, setForm] = useState(normalizedInitialData);
  const [touched, setTouched] = useState({});
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setForm(normalizeInitialData(initialData));
      setTouched({});
      setShowDiscardPrompt(false);
    }
  }, [isOpen, initialData]);

  const hasChanges = useMemo(() => {
    if (!normalizedInitialData || !form) return false;
    return (
      form.title !== (normalizedInitialData.title || "") ||
      form.content !== (normalizedInitialData.content || "") ||
      form.contentType !== (normalizedInitialData.contentType || "announcement") ||
      form.category !== (normalizedInitialData.category || "general") ||
      form.targetBranch !== (normalizedInitialData.targetBranch || "both") ||
      form.publicationStatus !== (normalizedInitialData.publicationStatus || "published") ||
      Boolean(form.requiresAcknowledgment) !== Boolean(normalizedInitialData.requiresAcknowledgment) ||
      Boolean(form.isPinned) !== Boolean(normalizedInitialData.isPinned) ||
      (form.startsAt || "") !== (normalizedInitialData.startsAt || "") ||
      (form.endsAt || "") !== (normalizedInitialData.endsAt || "") ||
      (form.policyKey || "") !== (normalizedInitialData.policyKey || "") ||
      Number(form.version || 1) !== Number(normalizedInitialData.version || 1) ||
      (form.effectiveDate || "") !== (normalizedInitialData.effectiveDate || "")
    );
  }, [form, normalizedInitialData]);

  const errors = useMemo(() => (form ? validateEditForm(form) : {}), [form]);
  const isFormValid = Object.keys(errors).length === 0;

  // Keyboard escape handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isPending) return;
        if (hasChanges && !showDiscardPrompt) {
          setShowDiscardPrompt(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasChanges, showDiscardPrompt, isPending, onClose]);

  if (!isOpen || !form) return null;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      let updated = { ...prev, [field]: value };
      if (field === "contentType" && value === "policy") {
        updated = {
          ...updated,
          contentType: value,
          category: "policy",
          requiresAcknowledgment: true,
          policyKey: prev.policyKey || generatePolicySlug(prev.title),
        };
      }
      if (field === "title" && prev.contentType === "policy" && (!prev.policyKey || prev.policyKey === generatePolicySlug(prev.title))) {
        updated.policyKey = generatePolicySlug(value);
      }
      if (field === "publicationStatus" && value === "scheduled" && !prev.startsAt) {
        updated = {
          ...updated,
          publicationStatus: value,
          startsAt: toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
        };
      }
      return updated;
    });
  };

  const handleAttemptClose = () => {
    if (isPending) return;
    if (hasChanges) {
      setShowDiscardPrompt(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardPrompt(false);
    onClose();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setTouched({
      title: true,
      content: true,
      startsAt: true,
      endsAt: true,
      policyKey: true,
      version: true,
    });

    const currentErrors = validateEditForm(form);
    if (Object.keys(currentErrors).length > 0) {
      return;
    }

    onSubmit({
      title: form.title.trim(),
      content: form.content.trim(),
      contentType: form.contentType || "announcement",
      category: form.category,
      targetBranch: isOwner ? form.targetBranch : defaultBranch,
      requiresAcknowledgment: Boolean(form.requiresAcknowledgment),
      publicationStatus: form.publicationStatus,
      startsAt: form.publicationStatus === "scheduled" ? form.startsAt || undefined : undefined,
      endsAt: form.publicationStatus === "scheduled" ? form.endsAt || undefined : undefined,
      policyKey: form.contentType === "policy" ? form.policyKey?.trim() || undefined : undefined,
      version: form.contentType === "policy" ? Number(form.version) || 1 : 1,
      effectiveDate: form.contentType === "policy" ? form.effectiveDate || undefined : undefined,
      isPinned: Boolean(form.isPinned),
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)" }}
      onClick={handleAttemptClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Announcement"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">
              {form.contentType === "policy" ? "Edit Policy" : "Edit Announcement"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Modify announcement details, target branch, and acknowledgment requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            disabled={isPending}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-card-foreground disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Discard changes alert prompt */}
        {showDiscardPrompt && (
          <div className="border-b border-border bg-muted/60 px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-card-foreground">
                <AlertCircle size={15} className="text-warning-dark" />
                <span>You have unsaved changes. Discard them?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardPrompt(false)}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-muted"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col overflow-hidden" noValidate>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {/* Title */}
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Title <span className="text-danger">*</span>
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {form.title.length}/120
                </span>
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleChange("title", event.target.value)}
                onBlur={() => handleBlur("title")}
                placeholder="Enter title"
                maxLength={120}
                aria-invalid={touched.title && Boolean(errors.title)}
                className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{
                  borderColor:
                    touched.title && errors.title ? "var(--danger)" : "var(--border)",
                }}
                {...ringFocus}
              />
              {touched.title && errors.title && (
                <p className="mt-1 text-xs text-danger" role="alert">
                  {errors.title}
                </p>
              )}
            </label>

            {/* Message */}
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Message <span className="text-danger">*</span>
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {form.content.length}/2000
                </span>
              </div>
              <textarea
                value={form.content}
                onChange={(event) => handleChange("content", event.target.value)}
                onBlur={() => handleBlur("content")}
                placeholder="Share the operational update, policy reminder, or event details here."
                rows={5}
                maxLength={2000}
                aria-invalid={touched.content && Boolean(errors.content)}
                className="mt-1.5 min-h-[110px] w-full rounded-md border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{
                  borderColor:
                    touched.content && errors.content ? "var(--danger)" : "var(--border)",
                }}
                {...ringFocus}
              />
              {touched.content && errors.content && (
                <p className="mt-1 text-xs text-danger" role="alert">
                  {errors.content}
                </p>
              )}
            </label>

            {/* Row 1: Record Type, Category, Publish Mode */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Record Type
                </span>
                <select
                  value={form.contentType || "announcement"}
                  onChange={(event) => handleChange("contentType", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                  {...ringFocus}
                >
                  <option value="announcement">Announcement</option>
                  <option value="policy">Policy</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </span>
                <select
                  value={form.category}
                  onChange={(event) => handleChange("category", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                  {...ringFocus}
                >
                  {ANNOUNCEMENT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Publish Mode
                </span>
                <select
                  value={form.publicationStatus || "published"}
                  onChange={(event) => handleChange("publicationStatus", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                  {...ringFocus}
                >
                  <option value="published">Publish now</option>
                  <option value="scheduled">Schedule</option>
                  <option value="draft">Save draft</option>
                </select>
              </label>
            </div>

            {/* Row 2: Target Branch */}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Branch
              </span>
              {isOwner ? (
                <select
                  value={form.targetBranch || "both"}
                  onChange={(event) => handleChange("targetBranch", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                  {...ringFocus}
                >
                  <option value="both">All Branches</option>
                  {BRANCH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formatAnnouncementBranch(defaultBranch)}
                  readOnly
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"
                />
              )}
            </label>

            {/* Scheduling dates */}
            {form.publicationStatus === "scheduled" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Starts At <span className="text-danger">*</span>
                  </span>
                  <input
                    type="datetime-local"
                    value={form.startsAt || ""}
                    onChange={(event) => handleChange("startsAt", event.target.value)}
                    onBlur={() => handleBlur("startsAt")}
                    aria-invalid={touched.startsAt && Boolean(errors.startsAt)}
                    className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    style={{
                      borderColor:
                        touched.startsAt && errors.startsAt ? "var(--danger)" : "var(--border)",
                    }}
                    {...ringFocus}
                  />
                  {touched.startsAt && errors.startsAt && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {errors.startsAt}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ends At
                  </span>
                  <input
                    type="datetime-local"
                    value={form.endsAt || ""}
                    onChange={(event) => handleChange("endsAt", event.target.value)}
                    onBlur={() => handleBlur("endsAt")}
                    aria-invalid={touched.endsAt && Boolean(errors.endsAt)}
                    className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    style={{
                      borderColor:
                        touched.endsAt && errors.endsAt ? "var(--danger)" : "var(--border)",
                    }}
                    {...ringFocus}
                  />
                  {touched.endsAt && errors.endsAt && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {errors.endsAt}
                    </p>
                  )}
                </label>
              </div>
            )}

            {/* Policy specific fields */}
            {form.contentType === "policy" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Policy Key
                  </span>
                  <input
                    type="text"
                    value={form.policyKey || ""}
                    onChange={(event) => handleChange("policyKey", event.target.value)}
                    onBlur={() => handleBlur("policyKey")}
                    aria-invalid={touched.policyKey && Boolean(errors.policyKey)}
                    className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    style={{
                      borderColor:
                        touched.policyKey && errors.policyKey ? "var(--danger)" : "var(--border)",
                    }}
                    {...ringFocus}
                  />
                  {touched.policyKey && errors.policyKey && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {errors.policyKey}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Version <span className="text-danger">*</span>
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.version || 1}
                    onChange={(event) => handleChange("version", event.target.value)}
                    onBlur={() => handleBlur("version")}
                    aria-invalid={touched.version && Boolean(errors.version)}
                    className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    style={{
                      borderColor:
                        touched.version && errors.version ? "var(--danger)" : "var(--border)",
                    }}
                    {...ringFocus}
                  />
                  {touched.version && errors.version && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {errors.version}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Effective Date
                  </span>
                  <input
                    type="datetime-local"
                    value={form.effectiveDate || ""}
                    onChange={(event) => handleChange("effectiveDate", event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    {...ringFocus}
                  />
                </label>
              </div>
            )}

            {/* Checkboxes */}
            <div className="space-y-2 pt-1">
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.requiresAcknowledgment)}
                  onChange={(event) => handleChange("requiresAcknowledgment", event.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <div>
                  <div className="text-sm font-semibold text-card-foreground">Require acknowledgment</div>
                  <div className="text-xs text-muted-foreground">
                    Track which tenants confirmed they saw this update.
                  </div>
                </div>
              </label>

              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.isPinned)}
                  onChange={(event) => handleChange("isPinned", event.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <div>
                  <div className="text-sm font-semibold text-card-foreground">Pin this notice</div>
                  <div className="text-xs text-muted-foreground">
                    Keep this notice near the top of the tenant feed.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isPending}
              className="h-10 rounded-md border border-border bg-card px-4 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !hasChanges || (Object.keys(touched).length > 0 && !isFormValid)}
              title={
                !hasChanges
                  ? "No changes detected to save"
                  : Object.keys(touched).length > 0 && !isFormValid
                  ? "Please resolve highlighted form validation errors"
                  : isPending
                  ? "Saving changes..."
                  : "Save announcement changes"
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer bg-[#0A1628] hover:bg-[#13243D] text-white focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
            >
              {isPending ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              <span>{isPending ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
