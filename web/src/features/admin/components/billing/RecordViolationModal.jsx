import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  AlertTriangle,
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  User,
  Search,
  ChevronDown,
  Loader2,
  Trash2,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";
import { authFetch } from "../../../../shared/api/httpClient.js";
import ModernTimePicker from "./ModernTimePicker.jsx";

const VIOLATION_CATEGORIES = [
  { value: "smoking_inside", label: "Smoking / Vaping Indoors" },
  { value: "cooking_in_room", label: "Cooking / Prohibited Appliances in Room" },
  { value: "unauthorized_appliance", label: "Unauthorized High-Wattage Appliance" },
  { value: "unauthorized_visitors", label: "Unauthorized Guest / Curfew Breach" },
  { value: "rfid_misuse", label: "RFID Card Lending / Misuse" },
  { value: "unauthorized_bed_transfer", label: "Unauthorized Bed Transfer" },
  { value: "unauthorized_room_transfer", label: "Unauthorized Room Transfer" },
  { value: "property_damage", label: "Property / Fixture Damage" },
  { value: "cleanliness_issues", label: "Sanitation & Cleanliness Violation" },
  { value: "persistent_unpaid_bills", label: "Persistent Unpaid Dues / Non-Compliance" },
  { value: "custom", label: "Custom / Other House Rule Infraction" },
];

const LOCATION_SUGGESTIONS = [
  "Current Assigned Room",
  "Common Kitchen & Pantry",
  "Hallway / Corridor",
  "Common Study Lounge",
  "Lobby / Reception",
  "Fire Exit / Balcony",
  "Shared Bathroom Area",
];

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

function TenantAvatar({ avatarUrl, name, className = "h-7 w-7 text-[10px]" }) {
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
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700`}
    >
      {getInitials(name || "")}
    </div>
  );
}

export default function RecordViolationModal({ isOpen, onClose, onSuccess, branch }) {
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantSearch, setTenantSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const [formData, setFormData] = useState({
    violationType: "smoking_inside",
    customViolationDescription: "",
    dateOfIncident: new Date().toISOString().slice(0, 10),
    timeOfIncident: "",
    locationOfIncident: "Current Assigned Room",
    evidenceNotes: "",
    penaltyApplied: 0,
    penaltyReason: "",
    chargeToBill: true,
  });

  // Photo evidence state
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch active tenants
  useEffect(() => {
    if (!isOpen) return;

    const fetchTenants = async () => {
      try {
        setLoadingTenants(true);
        const params = {};
        if (branch && branch !== "all") params.branch = branch;
        const res = await billingApi.getActiveTenantsForViolations(params);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setTenants(list);
      } catch (err) {
        console.error("Failed to load active tenants:", err);
      } finally {
        setLoadingTenants(false);
      }
    };

    fetchTenants();
  }, [isOpen, branch]);

  // Click outside to close tenant dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered tenants for search
  const filteredTenants = useMemo(() => {
    if (!tenantSearch.trim()) return tenants;
    const q = tenantSearch.toLowerCase();
    return tenants.filter((t) => {
      const name = (t.fullName || "").toLowerCase();
      const room = (t.roomName || t.roomNumber || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      return name.includes(q) || room.includes(q) || email.includes(q);
    });
  }, [tenants, tenantSearch]);

  // Handle direct file upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit.");
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    setUploadError("");
    setEvidenceFile(file);

    // Create local preview
    const objectUrl = URL.createObjectURL(file);
    setEvidencePreview(objectUrl);

    // Upload via /attachments endpoint
    try {
      setUploadingImage(true);
      const data = new FormData();
      data.append("file", file);
      data.append("context", "tenant_violation");
      const targetBranch = selectedTenant?.branch || (branch && branch !== "all" ? branch : "gil-puyat");
      if (targetBranch) {
        data.append("branch", targetBranch);
        data.append("branchId", targetBranch);
      }

      const response = await authFetch("/attachments", {
        method: "POST",
        body: data,
      });

      const url =
        response?.attachment?.url ||
        response?.attachment?.downloadUrl ||
        response?.downloadUrl ||
        response?.url ||
        response?.fileUrl;

      if (url) {
        setEvidenceUrl(url);
        setUploadError("");
      } else {
        throw new Error("Invalid attachment upload response");
      }
    } catch (err) {
      console.error("Evidence upload error:", err);
      setUploadError(err.message || "Failed to upload image. You can still enter a direct URL.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setEvidenceFile(null);
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
    setEvidencePreview(null);
    setEvidenceUrl("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePenaltyChange = (rawVal) => {
    if (rawVal === "" || rawVal === null) {
      setFormData((prev) => ({ ...prev, penaltyApplied: "" }));
      return;
    }

    // Sanitize string to positive decimal only
    let cleanStr = String(rawVal).replace(/[^0-9.]/g, "");
    
    // Disallow multiple decimal dots
    const parts = cleanStr.split(".");
    let sanitized = parts[0];
    if (parts.length > 1) {
      sanitized += "." + parts[1].slice(0, 2); // max 2 decimal places
    }

    // Strip leading zeros unless decimal like 0.5
    if (sanitized.length > 1 && sanitized.startsWith("0") && !sanitized.startsWith("0.")) {
      sanitized = sanitized.replace(/^0+/, "") || "0";
    }

    const numVal = parseFloat(sanitized);
    if (!isNaN(numVal) && numVal > 100000) {
      setFormData((prev) => ({ ...prev, penaltyApplied: 100000 }));
      return;
    }

    setFormData((prev) => ({ ...prev, penaltyApplied: sanitized }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!selectedTenant) {
      setFormError("Please select a tenant for this violation record.");
      return;
    }

    if (formData.violationType === "custom" && !formData.customViolationDescription.trim()) {
      setFormError("Please specify a reason/basis for the monetary penalty.");
      return;
    }

    if (!formData.evidenceNotes.trim()) {
      setFormError("Please enter detailed incident notes describing the infraction.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        tenantId: selectedTenant.tenantId,
        reservationId: selectedTenant.reservationId,
        branch: selectedTenant.branch || branch || "gil-puyat",
        roomId: selectedTenant.roomId,
        roomName: selectedTenant.roomName,
        violationType: formData.violationType,
        customViolationDescription: formData.customViolationDescription.trim(),
        dateOfIncident: formData.dateOfIncident,
        timeOfIncident: formData.timeOfIncident,
        locationOfIncident: formData.locationOfIncident.trim(),
        evidenceNotes: formData.evidenceNotes.trim(),
        penaltyApplied: Number(formData.penaltyApplied) || 0,
        penaltyReason: formData.penaltyReason.trim(),
        chargeToBill: formData.chargeToBill,
        evidenceUrl: evidencePreview || null,
        evidenceUrls: evidencePreview ? [evidencePreview] : [],
      };

      await billingApi.recordViolation(payload);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to record violation:", err);
      setFormError(err.message || "Unable to save violation record. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentWarning = selectedTenant ? (selectedTenant.warningCount || 0) + 1 : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-card-foreground">
                Log Tenant Rule Violation & Warning
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formally record a dormitory rule infraction, upload photo proof, and assess penalty fees.
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Tenant Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-card-foreground">
              Tenant Identification <span className="text-rose-500">*</span>
            </label>

            {/* Tenant Autocomplete Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex min-h-[42px] cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2 text-xs shadow-xs transition hover:border-slate-400"
              >
                {selectedTenant ? (
                  <div className="flex items-center gap-3">
                    <TenantAvatar
                      avatarUrl={selectedTenant.profileImage || selectedTenant.avatar}
                      name={selectedTenant.fullName}
                      className="h-7 w-7 text-[10px]"
                    />
                    <div>
                      <span className="font-bold text-card-foreground">{selectedTenant.fullName}</span>
                      <span className="ml-2 text-muted-foreground">
                        ({selectedTenant.roomName} {selectedTenant.bedIdentifier ? `· Bed ${selectedTenant.bedIdentifier}` : ""})
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select an active tenant...</span>
                )}
                <ChevronDown size={14} className="text-muted-foreground" />
              </div>

              {dropdownOpen && (
                <div className="absolute top-full left-0 z-30 mt-1.5 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-border bg-muted/30">
                    <div className="relative flex items-center">
                      <Search size={13} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={tenantSearch}
                        onChange={(e) => setTenantSearch(e.target.value)}
                        placeholder="Type tenant name, room, or email..."
                        className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-3 text-xs text-card-foreground focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                    {loadingTenants ? (
                      <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Loading tenants...
                      </div>
                    ) : filteredTenants.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        {tenantSearch
                          ? `No tenants match "${tenantSearch}".`
                          : "No tenants found for this branch."}
                      </div>
                    ) : (
                      filteredTenants.map((t) => (
                        <div
                          key={t.reservationId || t.tenantId}
                          onClick={() => {
                            setSelectedTenant(t);
                            setDropdownOpen(false);
                            if (t.roomName) {
                              setFormData((prev) => ({
                                ...prev,
                                locationOfIncident: `Room ${t.roomName}`,
                              }));
                            }
                          }}
                          className={`flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedTenant?.tenantId === t.tenantId ? "bg-muted/40 font-bold" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <TenantAvatar
                              avatarUrl={t.profileImage || t.avatar}
                              name={t.fullName}
                              className="h-7 w-7 text-[10px]"
                            />
                            <div>
                              <p className="text-xs font-semibold text-card-foreground">{t.fullName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {t.roomName} {t.bedIdentifier ? `(Bed ${t.bedIdentifier})` : ""} · {t.branch}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {t.warningCount > 0 ? (
                              <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                {t.warningCount} prior warning{t.warningCount > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Clean Record</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Warning Count Banner */}
            {selectedTenant && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className={`shrink-0 ${currentWarning >= 3 ? "text-rose-600 dark:text-rose-400" : currentWarning === 2 ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`} />
                  <div>
                    <span className="font-bold text-card-foreground">
                      Formal Warning Count: #{currentWarning}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedTenant.warningCount === 0
                        ? "This will be the tenant's 1st recorded rule violation."
                        : `Tenant currently has ${selectedTenant.warningCount} prior confirmed violation(s).`}
                      {currentWarning >= 3 && " ⚠️ 3rd strike will trigger Escalation Review eligibility."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Infraction Classification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-card-foreground mb-1">
                Violation Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.violationType}
                onChange={(e) => setFormData({ ...formData, violationType: e.target.value })}
                className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              >
                {VIOLATION_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-card-foreground mb-1">
                Date of Incident <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={formData.dateOfIncident}
                onChange={(e) => setFormData({ ...formData, dateOfIncident: e.target.value })}
                className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {formData.violationType === "custom" && (
            <div>
              <label className="block text-xs font-bold text-card-foreground mb-1">
                Custom Infraction Title & Specification <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={500}
                placeholder="e.g. Tampering with dormitory smoke detector / fire extinguisher..."
                value={formData.customViolationDescription}
                onChange={(e) => setFormData({ ...formData, customViolationDescription: e.target.value })}
                className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              />
            </div>
          )}

          {/* Section 3: Incident Details (Time & Location) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-card-foreground mb-1">
                Approximate Time (Optional)
              </label>
              <ModernTimePicker
                value={formData.timeOfIncident}
                onChange={(val) => setFormData({ ...formData, timeOfIncident: val })}
                placeholder="Set time (e.g. 10:00 PM)..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-card-foreground mb-1">
                Location of Incident <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={formData.locationOfIncident}
                onChange={(e) => setFormData({ ...formData, locationOfIncident: e.target.value })}
                placeholder="e.g. Room 302, 2nd Floor Common Lounge..."
                className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Location Quick Presets */}
          <div className="flex flex-wrap gap-1.5 -mt-2">
            {LOCATION_SUGGESTIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setFormData({ ...formData, locationOfIncident: loc })}
                className="rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground transition"
              >
                {loc}
              </button>
            ))}
          </div>

          {/* Section 4: Incident Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-card-foreground">
                Incident Notes & Evidence Description <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-semibold text-muted-foreground">
                {formData.evidenceNotes.length} / 1000
              </span>
            </div>
            <textarea
              rows={3}
              required
              maxLength={1000}
              placeholder="Detail specific observations, staff witness notes, physical items found, and tenant interactions..."
              value={formData.evidenceNotes}
              onChange={(e) => setFormData({ ...formData, evidenceNotes: e.target.value.slice(0, 1000) })}
              className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none resize-y"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Maximum 1,000 characters. Factual descriptions assist during formal review hearings.
            </p>
          </div>

          {/* Section 5: Photo Evidence Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-card-foreground">
              Photo Evidence Attachment (Optional)
            </label>

            {!evidencePreview && !evidenceUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-center transition hover:border-slate-400 hover:bg-muted/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 mb-2">
                  <UploadCloud size={24} />
                </div>
                <p className="text-xs font-bold text-card-foreground">
                  Click to browse photo evidence
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  JPEG, PNG, WebP up to 5 MB
                </p>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {evidencePreview ? (
                    <img
                      src={evidencePreview}
                      alt="Incident Evidence Preview"
                      className="h-14 w-14 rounded-lg object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 border border-border text-slate-500 shrink-0">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-card-foreground truncate">
                      {evidenceFile?.name || "Uploaded Photo Evidence"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {uploadingImage ? (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Loader2 size={12} className="animate-spin" /> Uploading to server...
                        </span>
                      ) : uploadError ? (
                        <span className="flex items-center gap-1 text-red-600 font-semibold">
                          Upload failed
                        </span>
                      ) : evidenceUrl ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 size={12} /> Image uploaded successfully
                        </span>
                      ) : (
                        <span>Image selected</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition"
                  title="Remove image"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            {uploadError && (
              <p className="text-[11px] text-red-600 font-medium">{uploadError}</p>
            )}
          </div>

          {/* Section 6: Penalty Fee Assessment & Ledger Attachment */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-card-foreground">
              Monetary Penalty Assessment
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-card-foreground mb-1">
                  Penalty Fee Amount (₱)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-muted-foreground">₱</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.penaltyApplied}
                    onChange={(e) => handlePenaltyChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 rounded-xl border border-border bg-card pl-7 pr-3 text-xs font-bold text-card-foreground focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Optional. Maximum fine: ₱100,000.00
                </span>
              </div>

              {Number(formData.penaltyApplied) > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-card-foreground mb-1">
                    Penalty Fee Basis / Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    placeholder="e.g. Deep cleaning surcharge / Room restoration"
                    value={formData.penaltyReason}
                    onChange={(e) => setFormData({ ...formData, penaltyReason: e.target.value })}
                    className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Automatic Rent Billing Attachment Notice */}
            {Number(formData.penaltyApplied) > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-xs">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-0.5">
                  <span className="font-bold text-card-foreground block">
                    Automatic Rent Statement Attachment
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    This fine will be added as a separate line item{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-card-foreground">
                      Violation Penalty: {VIOLATION_CATEGORIES.find((c) => c.value === formData.violationType)?.label || "Infraction"}
                    </code>{" "}
                    to the tenant's active monthly rent billing statement.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 rounded-xl border border-border bg-card px-4 text-xs font-bold text-card-foreground transition hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] disabled:opacity-50 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving Record...
                </>
              ) : (
                "Submit Violation Record"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
