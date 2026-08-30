import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Trash2,
  Pencil,
  Plus,
  Camera,
  Save,
  RotateCcw,
  Check,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";
import { showNotification } from "../../../../shared/utils/notification.js";

export const CATEGORY_OPTIONS = [
  { value: "smoking_inside", label: "Smoking / Vaping" },
  { value: "cooking_in_room", label: "Cooking in Room" },
  { value: "unauthorized_appliance", label: "Heavy Appliance" },
  { value: "unauthorized_visitors", label: "Unauthorized Guests" },
  { value: "rfid_misuse", label: "RFID Card Misuse" },
  { value: "unauthorized_bed_transfer", label: "Bed Transfer" },
  { value: "unauthorized_room_transfer", label: "Room Transfer" },
  { value: "property_damage", label: "Property Damage" },
  { value: "cleanliness_issues", label: "Sanitation / Cleanliness" },
  { value: "persistent_unpaid_bills", label: "Persistent Dues" },
  { value: "custom", label: "Custom Infraction" },
];

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

function TenantAvatar({ avatarUrl, name, className = "h-10 w-10 text-xs" }) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Tenant"}
        onError={() => setImgError(true)}
        className={`${className} rounded-full object-cover border border-border shrink-0`}
      />
    );
  }

  return (
    <div
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] border border-[#0A1628]/20 dark:border-[#D4AF37]/40 font-bold shadow-xs`}
    >
      {getInitials(name || "")}
    </div>
  );
}

const getStatusBadgeConfig = (status) => {
  switch (status) {
    case "confirmed":
    case "resolved":
      return { text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "warning_issued":
    case "under_review":
    case "awaiting_response":
    case "penalty_issued":
      return { text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
    case "dismissed":
    default:
      return { text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-400" };
  }
};

const initializeEditForm = (v) => {
  if (!v) {
    return {
      violationType: "smoking_inside",
      customViolationDescription: "",
      dateOfIncident: new Date().toISOString().split("T")[0],
      timeOfIncident: "",
      locationOfIncident: "",
      evidenceNotes: "",
      penaltyApplied: 0,
      penaltyReason: "",
      evidenceUrls: [],
    };
  }

  let dateStr = "";
  if (v.dateOfIncident) {
    try {
      const d = new Date(v.dateOfIncident);
      if (!isNaN(d.getTime())) {
        const offset = d.getTimezoneOffset() * 60000;
        dateStr = new Date(d.getTime() - offset).toISOString().split("T")[0];
      }
    } catch (e) {
      dateStr = "";
    }
  }

  let urls = [];
  if (Array.isArray(v.evidenceUrls) && v.evidenceUrls.length > 0) {
    urls = v.evidenceUrls.filter(Boolean);
  } else if (v.evidenceUrl) {
    urls = [v.evidenceUrl];
  }

  return {
    violationType: v.violationType || "smoking_inside",
    customViolationDescription: v.customViolationDescription || "",
    dateOfIncident: dateStr,
    timeOfIncident: v.timeOfIncident || "",
    locationOfIncident: v.locationOfIncident || "",
    evidenceNotes: v.evidenceNotes || v.description || "",
    penaltyApplied: v.penaltyApplied != null ? Number(v.penaltyApplied) : 0,
    penaltyReason: v.penaltyReason || "",
    evidenceUrls: urls,
  };
};

export default function ViolationDetailModal({ isOpen, violation, onClose, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState(() => initializeEditForm(violation));
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  const [adjudicating, setAdjudicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [decision, setDecision] = useState("confirmed");
  const [targetStatus, setTargetStatus] = useState("warning_issued");
  const [decisionReason, setDecisionReason] = useState("");
  const [chargeToBill, setChargeToBill] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (violation) {
      setEditForm(initializeEditForm(violation));
      setIsEditing(false);
      setError("");
      setSuccessMsg("");
      setConfirmingDelete(false);
    }
  }, [violation?._id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        if (confirmingDelete) {
          setConfirmingDelete(false);
        } else if (isEditing) {
          handleCancelEdit();
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isEditing, confirmingDelete, onClose]);

  if (!isOpen || !violation) return null;

  const isPendingDecision =
    violation.status === "reported" ||
    violation.status === "under_review" ||
    violation.status === "awaiting_response" ||
    !violation.adminDecision;

  const handleStartEdit = () => {
    setEditForm(initializeEditForm(violation));
    setNewPhotoUrl("");
    setError("");
    setSuccessMsg("");
    setConfirmingDelete(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm(initializeEditForm(violation));
    setNewPhotoUrl("");
    setError("");
    setIsEditing(false);
  };

  const handleAddPhoto = () => {
    const trimmed = newPhotoUrl.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
      showNotification("Please provide a valid image URL (e.g. https://...)", "warning");
      return;
    }
    if (editForm.evidenceUrls.includes(trimmed)) {
      showNotification("This photo URL has already been added.", "warning");
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      evidenceUrls: [...prev.evidenceUrls, trimmed],
    }));
    setNewPhotoUrl("");
  };

  const handleRemovePhoto = (indexToRemove) => {
    setEditForm((prev) => ({
      ...prev,
      evidenceUrls: prev.evidenceUrls.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!editForm.dateOfIncident) {
      const errText = "Incident date is required.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    const selectedDate = new Date(editForm.dateOfIncident);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      const errText = "Incident date cannot be in the future.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    if (editForm.violationType === "custom" && !editForm.customViolationDescription?.trim()) {
      const errText = "A description is required when category is set to Custom Infraction.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    const penaltyNum = Number(editForm.penaltyApplied) || 0;
    if (penaltyNum < 0 || penaltyNum > 100000) {
      const errText = "Penalty fee must be between ₱0.00 and ₱100,000.00.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    if (penaltyNum > 0 && !editForm.penaltyReason?.trim()) {
      const errText = "A penalty reason / basis is required when a monetary penalty is applied.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    try {
      setSavingEdit(true);
      const payload = {
        violationType: editForm.violationType,
        customViolationDescription:
          editForm.violationType === "custom" ? editForm.customViolationDescription.trim() : "",
        dateOfIncident: editForm.dateOfIncident,
        timeOfIncident: editForm.timeOfIncident?.trim() || "",
        locationOfIncident: editForm.locationOfIncident?.trim() || "",
        evidenceNotes: editForm.evidenceNotes?.trim() || "",
        penaltyApplied: penaltyNum,
        penaltyReason: penaltyNum > 0 ? editForm.penaltyReason.trim() : "",
        evidenceUrls: editForm.evidenceUrls,
      };

      await billingApi.updateViolation(violation._id, payload);

      const msg = "Violation record updated successfully.";
      setSuccessMsg(msg);
      showNotification(msg, "success");
      setIsEditing(false);
      onRefresh?.();
    } catch (err) {
      console.error("Save violation edit error:", err);
      const errText = err.message || "Failed to update violation record.";
      setError(errText);
      showNotification(errText, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await billingApi.deleteViolation(violation._id);
      showNotification("Violation record deleted successfully.", "success");
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error("Delete violation error:", err);
      const errText = err.message || "Failed to delete violation record.";
      setError(errText);
      showNotification(errText, "error");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!decisionReason.trim()) {
      const errText = "Please provide a clear administrative rationale for this decision.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    try {
      setAdjudicating(true);
      await billingApi.adjudicateViolation(violation._id, {
        decision,
        status: decision === "confirmed" ? targetStatus : "dismissed",
        targetStatus: decision === "confirmed" ? targetStatus : "dismissed",
        decisionReason: decisionReason.trim(),
        chargeToBill: decision === "confirmed" && Number(violation.penaltyApplied) > 0 ? chargeToBill : false,
      });

      const msg = "Adjudication decision recorded and tenant notified successfully.";
      setSuccessMsg(msg);
      showNotification(msg, "success");
      onRefresh?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Decision recording error:", err);
      const errText = err.message || "Failed to record decision.";
      setError(errText);
      showNotification(errText, "error");
    } finally {
      setAdjudicating(false);
    }
  };

  const badgeCfg = getStatusBadgeConfig(violation.status);
  const allPhotos = Array.isArray(violation.evidenceUrls) && violation.evidenceUrls.length > 0
    ? violation.evidenceUrls.filter(Boolean)
    : violation.evidenceUrl
    ? [violation.evidenceUrl]
    : [];

  const formattedDate = violation.dateOfIncident
    ? new Date(violation.dateOfIncident).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  const categoryLabel =
    CATEGORY_OPTIONS.find((c) => c.value === violation.violationType)?.label ||
    violation.violationType?.replace(/_/g, " ") ||
    "Infraction";

  if (!isOpen || !violation || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="violation-modal-title"
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="violation-modal-title" className="text-base font-bold text-card-foreground">
                  Infraction Record #{String(violation._id).slice(-6).toUpperCase()}
                </h2>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${badgeCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dot}`} />
                  <span className="capitalize">{violation.status?.replace(/_/g, " ")}</span>
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
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={deleting || confirmingDelete}
                  aria-label="Edit this violation record"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-card-foreground hover:bg-muted transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  title="Edit this violation record"
                >
                  <Pencil size={13} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleting}
                  aria-label="Delete this violation record"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  title="Delete this violation record"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                <Pencil size={12} />
                <span>Editing Record</span>
              </span>
            )}
            <button
              type="button"
              onClick={isEditing ? handleCancelEdit : onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground cursor-pointer"
              title={isEditing ? "Exit editing" : "Close dialog"}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {confirmingDelete && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
                <AlertTriangle size={15} />
                <span>Confirm Violation Deletion</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs">
                Are you sure you want to delete this violation record for <strong>{violation.tenantName}</strong>? Any associated penalty fees will be removed.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="h-7 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold text-card-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-rose-600 px-3 text-[11px] font-bold text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  <span>{deleting ? "Deleting..." : "Confirm Delete"}</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-rose-50/60 dark:bg-rose-950/20 p-3.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tenant & Room Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <TenantAvatar
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

            {!isEditing && (
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block font-medium">Assessed Penalty</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  ₱{Number(violation.penaltyApplied || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Body Mode: In-Place Editing Form vs Read-Only Details */}
          {isEditing ? (
            <form id="violation-edit-form" onSubmit={handleSaveEdit} className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-1 border-b border-border text-xs font-bold uppercase tracking-wider text-card-foreground">
                  <Pencil size={14} className="text-muted-foreground" />
                  <span>Edit Infraction Information</span>
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-semibold text-card-foreground mb-1">
                    Violation Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editForm.violationType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, violationType: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Violation Description (if custom) */}
                {editForm.violationType === "custom" && (
                  <div>
                    <label className="block text-xs font-semibold text-card-foreground mb-1">
                      Custom Infraction Title / Description <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.customViolationDescription}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, customViolationDescription: e.target.value }))
                      }
                      placeholder="Specify the nature of this custom infraction..."
                      className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* Incident Date, Time & Location Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-card-foreground mb-1">
                      Date of Incident <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split("T")[0]}
                      value={editForm.dateOfIncident}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, dateOfIncident: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-card-foreground mb-1">
                      Time of Incident
                    </label>
                    <input
                      type="text"
                      value={editForm.timeOfIncident}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, timeOfIncident: e.target.value }))}
                      placeholder="e.g. 10:30 PM or 22:30"
                      className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-card-foreground mb-1">
                      Location of Incident
                    </label>
                    <input
                      type="text"
                      value={editForm.locationOfIncident}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, locationOfIncident: e.target.value }))}
                      placeholder="e.g. Room 302, Kitchen"
                      className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Evidence & Observation Notes */}
                <div>
                  <label className="block text-xs font-semibold text-card-foreground mb-1">
                    Incident Evidence & Observation Notes
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.evidenceNotes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, evidenceNotes: e.target.value }))}
                    placeholder="Record factual observations, staff eyewitness statements, or context..."
                    className="w-full rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Photo Evidence Management */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-card-foreground">
                    Photo Evidence URLs
                  </label>

                  {editForm.evidenceUrls.length > 0 ? (
                    <div className="space-y-2">
                      {editForm.evidenceUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Camera size={14} className="text-muted-foreground shrink-0" />
                            <span className="truncate text-card-foreground text-[11px] font-mono">{url}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-muted-foreground hover:text-card-foreground hover:bg-muted"
                              title="View full image"
                            >
                              <ExternalLink size={13} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                              title="Remove photo"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">No photo URLs attached.</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="url"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPhoto();
                        }
                      }}
                      placeholder="Paste new photo URL (https://...)..."
                      className="flex-1 h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPhoto}
                      disabled={!newPhotoUrl.trim()}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Photo</span>
                    </button>
                  </div>
                </div>

                {/* Penalty Fee Assessment */}
                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs font-bold text-card-foreground">Penalty Assessment (Optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-card-foreground mb-1">
                        Penalty Amount (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100000"
                        step="50"
                        value={editForm.penaltyApplied}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            penaltyApplied: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        placeholder="0.00"
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-card-foreground mb-1">
                        Penalty Basis / Reason {Number(editForm.penaltyApplied) > 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        required={Number(editForm.penaltyApplied) > 0}
                        value={editForm.penaltyReason}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, penaltyReason: e.target.value }))}
                        placeholder="e.g. Mandatory appliance surcharges / repeat offense"
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <>
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
                    {categoryLabel}
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
              {allPhotos.length > 0 ? (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Photo Evidence ({allPhotos.length})
                    </p>
                  </div>
                  <div className={`grid ${allPhotos.length > 1 ? "grid-cols-1 sm:grid-cols-2 gap-3" : "grid-cols-1"}`}>
                    {allPhotos.map((photoUrl, idx) => (
                      <div key={idx} className="relative group overflow-hidden rounded-xl border border-border bg-muted/20">
                        <img
                          src={photoUrl}
                          alt={`Incident Photo Evidence ${idx + 1}`}
                          className="max-h-56 w-full object-contain mx-auto"
                        />
                        <div className="absolute top-2 right-2 opacity-90 group-hover:opacity-100 transition">
                          <a
                            href={photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-slate-900/80 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold hover:bg-slate-900 shadow-xs"
                            title="Open full resolution photo in new tab"
                          >
                            <ExternalLink size={12} />
                            <span>Open Full Image</span>
                          </a>
                        </div>
                      </div>
                    ))}
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
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
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
                <form onSubmit={handleDecisionSubmit} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-card p-4 space-y-3.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Administrative Adjudication & Action
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-card-foreground mb-1">Board Decision</label>
                      <select
                        value={decision}
                        onChange={(e) => setDecision(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
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
                          className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                        >
                          <option value="warning_issued">Issue Formal Written Warning</option>
                          <option value="penalty_issued">Enforce Penalty Fee on Ledger</option>
                          <option value="resolved">Mark Resolved / Closed</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-card-foreground mb-1">
                      Administrative Decision Rationale <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      placeholder="Record formal administrative findings, evidence evaluation, or warning notice delivery details..."
                      className="w-full rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none leading-relaxed"
                    />
                  </div>

                  {decision === "confirmed" && Number(violation.penaltyApplied) > 0 && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-xs">
                      <input
                        type="checkbox"
                        id="adjudicateChargeToBill"
                        checked={chargeToBill}
                        onChange={(e) => setChargeToBill(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-[#D4AF37]"
                      />
                      <label htmlFor="adjudicateChargeToBill" className="cursor-pointer text-[11px] text-card-foreground">
                        Append penalty fee (₱{Number(violation.penaltyApplied).toFixed(2)}) to tenant's current/next billing statement
                      </label>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={adjudicating || !decisionReason.trim()}
                      title={!decisionReason.trim() ? "Please enter a decision rationale" : "Save and action decision"}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A1628] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3.5 shrink-0 bg-card">
          {isEditing ? (
            <>
              <span className="text-[11px] text-muted-foreground">
                Unsaved changes will be discarded on cancel.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingEdit}
                  className="h-8 px-3.5 rounded-lg border border-border bg-card text-xs font-semibold text-card-foreground hover:bg-muted transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="violation-edit-form"
                  disabled={savingEdit}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A1628] hover:bg-[#13243D] px-4 text-xs font-bold text-white shadow-xs focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition active:scale-[0.98] cursor-pointer disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{savingEdit ? "Saving Changes..." : "Save Changes"}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground font-mono">
                Infraction ID: {String(violation._id)}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-4 rounded-lg border border-border bg-card text-xs font-semibold text-card-foreground hover:bg-muted transition active:scale-[0.98] cursor-pointer"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
