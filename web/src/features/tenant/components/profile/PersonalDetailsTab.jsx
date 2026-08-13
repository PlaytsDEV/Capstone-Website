import React, { useState, useMemo, useRef } from "react";
import {
  Edit2,
  User,
  Save,
  X,
  Camera,
  Briefcase,
  Globe,
  ChevronDown,
  Sparkles,
  Phone,
  Home,
  CalendarDays,
} from "lucide-react";
import { fmtDate } from "../../../../shared/utils/formatDate";
import { showNotification } from "../../../../shared/utils/notification";

/* ─────────────────────────────────────────────────────────────────────────────
 VALIDATION
───────────────────────────────────────────────────────────────────────────── */
const validateField = (field, value) => {
  if (!value || !value.trim()) return null;
  switch (field) {
    case "firstName":
    case "lastName":
      if (value.trim().length < 2) return "At least 2 characters";
      if (value.trim().length > 50) return "50 characters max";
      if (!/^[a-zA-Z\s\-']+$/.test(value.trim())) return "Letters only";
      return null;
    case "dateOfBirth": {
      const dob = new Date(value);
      if (isNaN(dob.getTime())) return "Invalid date";
      if (dob > new Date()) return "Cannot be in the future";
      return null;
    }
    default:
      return null;
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 STYLES — everything below reads from design-tokens.css, nothing hardcoded
───────────────────────────────────────────────────────────────────────────── */
const s = {
  container: { width: "100%" },

  heading: { marginBottom: 20 },
  title: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: "var(--font-weight-bold)",
    color: "var(--foreground)",
    margin: 0,
  },
  subtitle: {
    fontSize: "var(--font-size-base)",
    color: "var(--muted-foreground)",
    marginTop: 4,
  },

  /* ── Header card (replaces the old navy hero banner) ── */
  headerCard: {
    background: "var(--card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    padding: "22px 24px",
    marginBottom: 16,
    display: "flex",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    border: "1px solid var(--border)",
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent)",
    color: "var(--primary-foreground)",
    fontSize: 20,
    fontWeight: "var(--font-weight-bold)",
    letterSpacing: "0.5px",
    flexShrink: 0,
    border: "1px solid var(--border)",
  },
  profileMeta: { flex: 1, minWidth: 200 },
  profileName: {
    fontSize: "var(--font-size-lg)",
    fontWeight: "var(--font-weight-bold)",
    color: "var(--foreground)",
    margin: "0 0 2px",
  },
  profileEmail: {
    fontSize: "var(--font-size-base)",
    color: "var(--muted-foreground)",
    margin: 0,
  },
  profileChips: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-medium)",
    color: "var(--muted-foreground)",
    background: "var(--muted)",
    borderRadius: 999,
    padding: "3px 9px",
  },
  chipPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--primary-foreground)",
    background: "var(--primary)",
    borderRadius: 999,
    padding: "3px 9px",
  },
  completionWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    maxWidth: 360,
  },
  completionTrack: {
    height: 5,
    flex: 1,
    minWidth: 100,
    background: "var(--muted)",
    borderRadius: 999,
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    background: "var(--primary)",
    borderRadius: 999,
    transition: "width 0.2s ease",
  },
  completionText: {
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-medium)",
    color: "var(--muted-foreground)",
    whiteSpace: "nowrap",
  },

  actionWrap: { display: "flex", gap: 8, flexShrink: 0 },
  editBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--card)",
    fontSize: "var(--font-size-base)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--foreground)",
    cursor: "pointer",
    transition: "all var(--duration-fast)",
    whiteSpace: "nowrap",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 18px",
    border: "none",
    borderRadius: "var(--radius-md)",
    background: "var(--success)",
    fontSize: "var(--font-size-base)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--success-foreground)",
    cursor: "pointer",
    transition: "all var(--duration-fast)",
    whiteSpace: "nowrap",
  },
  cancelBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--card)",
    fontSize: "var(--font-size-base)",
    fontWeight: "var(--font-weight-medium)",
    color: "var(--muted-foreground)",
    cursor: "pointer",
    transition: "all var(--duration-fast)",
    whiteSpace: "nowrap",
  },

  /* ── Info cards ── */
  infoCard: {
    background: "var(--card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 22px",
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "var(--accent)",
  },
  sectionTitle: {
    fontSize: "var(--font-size-base)",
    fontWeight: "var(--font-weight-bold)",
    color: "var(--foreground)",
    margin: 0,
    flex: 1,
  },
  divider: { height: 1, background: "var(--border-light)", margin: "0 22px" },
  sectionBody: { padding: "20px 22px 22px" },

  /* ── Field grid ── */
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 28px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px 24px" },
  rowSep: { height: 1, background: "var(--border-light)", margin: "18px 0" },

  subHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },

  /* ── Field atoms ── */
  fieldLabel: {
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-bold)",
    color: "var(--muted-foreground)",
    textTransform: "uppercase",
    letterSpacing: "var(--letter-spacing-wide)",
    marginBottom: 5,
  },
  fieldValue: {
    fontSize: "var(--font-size-md)",
    fontWeight: "var(--font-weight-medium)",
    color: "var(--foreground)",
    margin: 0,
    lineHeight: 1.4,
  },
  fieldEmpty: {
    fontSize: "var(--font-size-md)",
    color: "var(--muted-foreground)",
    fontStyle: "italic",
    margin: 0,
  },
  emptyLine: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  addNowBtn: {
    border: "none",
    background: "transparent",
    padding: 0,
    fontSize: "var(--font-size-sm)",
    fontWeight: "var(--font-weight-bold)",
    color: "var(--primary)",
    cursor: "pointer",
  },

  /* ── Inputs ── */
  input: {
    width: "100%",
    padding: "9px 12px",
    fontSize: "var(--font-size-md)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--foreground)",
    background: "var(--input-background)",
    outline: "none",
    transition: "border-color var(--duration-fast), box-shadow var(--duration-fast)",
    boxSizing: "border-box",
    lineHeight: 1.4,
  },
  inputFocus: {
    borderColor: "var(--ring)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--ring) 15%, transparent)",
  },
  inputError: {
    borderColor: "var(--danger)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--danger) 10%, transparent)",
  },
  inputLocked: {
    background: "var(--muted)",
    color: "var(--muted-foreground)",
    cursor: "not-allowed",
    border: "1.5px solid var(--border-light)",
  },
  errorText: { fontSize: "var(--font-size-xs)", color: "var(--danger)", marginTop: 3 },

  /* ── Note banner ── */
  noteBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "var(--accent)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    marginTop: 20,
  },
  noteText: {
    fontSize: "var(--font-size-sm)",
    color: "var(--accent-foreground)",
    lineHeight: 1.5,
    margin: 0,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
 ATOMS
───────────────────────────────────────────────────────────────────────────── */

const Field = ({
  label, value, field, type = "text", editing, editData, setEditData,
  errors, onBlur, required, locked, onAdd,
}) => {
  const [focused, setFocused] = useState(false);
  const hasError = errors?.[field];

  return (
    <div>
      <div style={s.fieldLabel}>
        {label}
        {required && editing && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </div>
      {editing ? (
        locked ? (
          <input type={type} value={value || ""} readOnly style={{ ...s.input, ...s.inputLocked }} />
        ) : (
          <div>
            <input
              type={type}
              value={editData?.[field] || ""}
              onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); onBlur?.(field); }}
              style={{
                ...s.input,
                ...(focused && !hasError ? s.inputFocus : {}),
                ...(hasError ? s.inputError : {}),
              }}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
            {hasError && <div style={s.errorText}>{errors[field]}</div>}
          </div>
        )
      ) : value && value !== "Not provided" ? (
        <p style={s.fieldValue}>{type === "date" ? fmtDate(value) : value}</p>
      ) : (
        <div style={s.emptyLine}>
          <p style={s.fieldEmpty}>Not provided</p>
          {onAdd && <button type="button" style={s.addNowBtn} onClick={onAdd}>Add now</button>}
        </div>
      )}
    </div>
  );
};

const SelectField = ({ label, field, options, editing, editData, setEditData, value, onAdd }) => {
  const currentValue = editData?.[field] || "";
  const displayValue = editing ? currentValue : value || currentValue;
  const readLabel = options.find((o) => o.value === displayValue)?.label;
  return (
    <div>
      <div style={s.fieldLabel}>{label}</div>
      {editing ? (
        <div style={{ position: "relative" }}>
          <select
            value={currentValue}
            onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
            style={{ ...s.input, appearance: "none", paddingRight: 32, cursor: "pointer" }}
          >
            <option value="">— Select —</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown
            size={14}
            color="var(--muted-foreground)"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
        </div>
      ) : displayValue ? (
        <p style={s.fieldValue}>{readLabel || displayValue}</p>
      ) : (
        <div style={s.emptyLine}>
          <p style={s.fieldEmpty}>Not provided</p>
          {onAdd && <button type="button" style={s.addNowBtn} onClick={onAdd}>Add now</button>}
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title }) => (
  <>
    <div style={s.sectionHeader}>
      <div style={s.sectionIconWrap}>
        <Icon size={15} color="var(--accent-foreground)" />
      </div>
      <h3 style={s.sectionTitle}>{title}</h3>
    </div>
    <div style={s.divider} />
  </>
);

/* ─────────────────────────────────────────────────────────────────────────────
 MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const resolveOccupancyLabel = ({ role, tenantStatus }) => {
  if (role === "tenant") return "Tenant";
  if (role === "applicant") return "Applicant";
  const normalizedTenantStatus = String(tenantStatus || "").toLowerCase();
  if (["active", "inactive", "moved_out"].includes(normalizedTenantStatus)) return "Tenant";
  return "Applicant";
};

const PersonalDetailsTab = ({
  profileData, editData, setEditData, fullName,
  isEditingProfile, setIsEditingProfile, saving, onSave, onCancel,
}) => {
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const applicationDetailsLocked = profileData.role === "tenant";

  const initials = useMemo(() => {
    const f = (profileData.firstName || "").charAt(0).toUpperCase();
    const l = (profileData.lastName || "").charAt(0).toUpperCase();
    return f + l || "?";
  }, [profileData.firstName, profileData.lastName]);

  const occupancyLabel = useMemo(
    () => resolveOccupancyLabel({ role: profileData.role, tenantStatus: profileData.tenantStatus }),
    [profileData.role, profileData.tenantStatus],
  );

  const completeness = useMemo(() => {
    const hasText = (value) => String(value || "").trim().length > 0;
    const items = [
      hasText(profileData.firstName) && hasText(profileData.lastName),
      Boolean(profileData.dateOfBirth),
      hasText(profileData.gender),
      hasText(profileData.civilStatus),
      hasText(profileData.nationality),
      hasText(profileData.occupation),
      hasText(profileData.profileImage),
    ];
    const completed = items.filter(Boolean).length;
    return { completed, total: items.length, percent: Math.round((completed / items.length) * 100) };
  }, [
    profileData.firstName, profileData.lastName, profileData.dateOfBirth,
    profileData.gender, profileData.civilStatus, profileData.nationality,
    profileData.occupation, profileData.profileImage,
  ]);

  const handleStartEditing = () => setIsEditingProfile(true);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const blobUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setLocalPreviewUrl(blobUrl);
    e.target.value = "";
  };

  const hasChanges = useMemo(() => {
    if (pendingFile) return true;
    if (!editData) return false;
    return (
      editData.firstName !== (profileData.firstName || "") ||
      editData.lastName !== (profileData.lastName || "") ||
      editData.dateOfBirth !== (profileData.dateOfBirth || "") ||
      editData.gender !== (profileData.gender || "") ||
      editData.civilStatus !== (profileData.civilStatus || "") ||
      editData.nationality !== (profileData.nationality || "") ||
      editData.occupation !== (profileData.occupation || "")
    );
  }, [editData, profileData, pendingFile]);

  const handleBlur = (field) => {
    if (field === "firstName" || field === "lastName") {
      if (!editData[field]?.trim()) {
        setErrors((p) => ({ ...p, [field]: `${field === "firstName" ? "First" : "Last"} name is required` }));
        return;
      }
    }
    const err = validateField(field, editData[field]);
    setErrors((p) => { const n = { ...p }; if (err) n[field] = err; else delete n[field]; return n; });
  };

  const handleSaveWithValidation = async () => {
    const newErrors = {};
    if (!editData.firstName?.trim()) newErrors.firstName = "Required";
    else { const e = validateField("firstName", editData.firstName); if (e) newErrors.firstName = e; }
    if (!editData.lastName?.trim()) newErrors.lastName = "Required";
    else { const e = validateField("lastName", editData.lastName); if (e) newErrors.lastName = e; }
    if (editData.dateOfBirth) {
      const e = validateField("dateOfBirth", editData.dateOfBirth);
      if (e) newErrors.dateOfBirth = e;
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (pendingFile) {
      setUploading(true);
      try {
        const { uploadToFirebaseStorage } = await import("../../../../shared/utils/firebaseStorageUpload");
        const { downloadUrl: imageUrl } = await uploadToFirebaseStorage(pendingFile, { documentType: "profile-photo" });
        if (imageUrl) {
          editData.profileImage = imageUrl;
          setEditData((prev) => ({ ...prev, profileImage: imageUrl }));
        }
      } catch {
        showNotification("Failed to upload photo. Please try again.", "error", 3000);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    setPendingFile(null);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    onSave();
  };

  const handleCancel = () => {
    setErrors({});
    setPendingFile(null);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    onCancel();
  };

  const fp = { editing: isEditingProfile, editData, setEditData, errors, onBlur: handleBlur };

  return (
    <div style={s.container}>
      {/* ── Page heading ── */}
      <div style={s.heading}>
        <h1 style={s.title}>Personal Details</h1>
        <p style={s.subtitle}>Your identity information — who you are</p>
      </div>

      {/* ── Header card ── */}
      <div style={s.headerCard}>
        {/* Avatar */}
        <div
          onClick={() => isEditingProfile && !uploading && fileInputRef.current?.click()}
          style={{ position: "relative", cursor: isEditingProfile ? "pointer" : "default", flexShrink: 0 }}
          title={isEditingProfile ? "Click to change photo" : undefined}
          onMouseEnter={(e) => {
            if (!isEditingProfile) return;
            const ov = e.currentTarget.querySelector("[data-overlay]");
            if (ov) ov.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            if (!isEditingProfile || uploading) return;
            const ov = e.currentTarget.querySelector("[data-overlay]");
            if (ov) ov.style.opacity = "0";
          }}
        >
          {(() => {
            const img = localPreviewUrl || (isEditingProfile ? editData?.profileImage : null) || profileData.profileImage;
            return img ? (
              <div style={s.avatar}>
                <img src={img} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={s.avatarFallback}>{initials}</div>
            );
          })()}

          {isEditingProfile && (
            <>
              <div
                data-overlay
                style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: uploading ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.45)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  opacity: uploading ? 1 : 0, transition: "opacity var(--duration-normal)",
                }}
              >
                {uploading ? (
                  <>
                    <div style={{
                      width: 20, height: 20,
                      border: "3px solid rgba(255,255,255,0.25)",
                      borderTop: "3px solid var(--primary)",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    <span style={{ color: "#fff", fontSize: 9, fontWeight: 600, marginTop: 2 }}>Uploading</span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  </>
                ) : (
                  <>
                    <Camera size={13} color="#fff" />
                    <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>Change</span>
                  </>
                )}
              </div>
              <div style={{
                position: "absolute", bottom: 0, right: 0,
                width: 20, height: 20, borderRadius: "50%",
                background: "var(--primary)", border: "2px solid var(--card)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Camera size={10} color="var(--primary-foreground)" />
              </div>
            </>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />
        </div>

        {/* Name + meta */}
        <div style={s.profileMeta}>
          <h2 style={s.profileName}>{fullName}</h2>
          <p style={s.profileEmail}>{profileData.email}</p>
          <div style={s.profileChips}>
            <span style={s.chipPrimary}><User size={10} />{occupancyLabel}</span>
            {profileData.occupation && <span style={s.chip}><Briefcase size={10} />{profileData.occupation}</span>}
            {profileData.nationality && <span style={s.chip}><Globe size={10} />{profileData.nationality}</span>}
            {profileData.gender && (
              <span style={s.chip}>
                {profileData.gender.charAt(0).toUpperCase() + profileData.gender.slice(1).replace(/-/g, " ")}
              </span>
            )}
          </div>
          <div style={s.completionWrap} aria-label={`Profile completeness: ${completeness.completed} of ${completeness.total} details completed`}>
            <div style={s.completionTrack}>
              <div style={{ ...s.completionFill, width: `${completeness.percent}%` }} />
            </div>
            <span style={s.completionText}>{completeness.completed}/{completeness.total} complete</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={s.actionWrap}>
          {isEditingProfile ? (
            <>
              <button onClick={handleCancel} style={s.cancelBtn}>
                <X size={14} /> Discard
              </button>
              <button
                onClick={handleSaveWithValidation}
                disabled={saving || uploading || !hasChanges}
                style={{
                  ...s.saveBtn,
                  opacity: saving || uploading || !hasChanges ? 0.55 : 1,
                  cursor: saving || uploading || !hasChanges ? "not-allowed" : "pointer",
                }}
              >
                <Save size={14} />
                {uploading ? "Uploading…" : saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : !applicationDetailsLocked ? (
            <button onClick={handleStartEditing} style={s.editBtn}>
              <Edit2 size={14} /> Edit Profile
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Identity Info Card ── */}
      <div style={s.infoCard}>
        <SectionHeader icon={User} title="Identity Information" />
        <div style={s.sectionBody}>
          {/* Row 1 — name */}
          <div style={s.grid2}>
            {isEditingProfile ? (
              <>
                <Field label="First Name" field="firstName" required {...fp} />
                <Field label="Last Name" field="lastName" required {...fp} />
              </>
            ) : (
              <>
                <Field label="Full Name" field="firstName" value={fullName}
                  onAdd={applicationDetailsLocked ? undefined : handleStartEditing} {...fp} />
                <Field label="Email Address" field="email" value={profileData.email} {...fp} />
              </>
            )}
          </div>

          {isEditingProfile && (
            <div style={{ ...s.grid2, marginTop: 18 }}>
              <Field label="Email Address" field="email" value={profileData.email}
                locked editing={true} editData={editData} setEditData={setEditData}
                errors={errors} onBlur={handleBlur} />
            </div>
          )}

          <div style={s.rowSep} />

          {/* Row 2 — demographics, always 3 equal columns, same position in both modes */}
          <div style={s.grid3}>
            <Field label="Date of Birth" field="dateOfBirth" type="date"
              value={isEditingProfile ? (editData?.dateOfBirth || "") : profileData.dateOfBirth}
              onAdd={applicationDetailsLocked ? undefined : handleStartEditing} {...fp} />
            <SelectField label="Gender" field="gender"
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
                { value: "prefer-not-to-say", label: "Prefer not to say" },
              ]}
              editing={isEditingProfile} editData={editData} setEditData={setEditData}
              value={profileData.gender}
              onAdd={applicationDetailsLocked ? undefined : handleStartEditing} />
            <SelectField label="Civil Status" field="civilStatus"
              options={[
                { value: "single", label: "Single" },
                { value: "married", label: "Married" },
                { value: "widowed", label: "Widowed" },
                { value: "separated", label: "Separated" },
                { value: "divorced", label: "Divorced" },
              ]}
              editing={isEditingProfile} editData={editData} setEditData={setEditData}
              value={profileData.civilStatus}
              onAdd={applicationDetailsLocked ? undefined : handleStartEditing} />
          </div>

          <div style={s.rowSep} />

          {/* Row 3 — nationality + occupation */}
          <div style={s.grid2}>
            <Field label="Nationality" field="nationality"
              value={isEditingProfile ? (editData?.nationality || "") : profileData.nationality}
              onAdd={applicationDetailsLocked ? undefined : handleStartEditing} {...fp} />
            <Field label="Occupation / Profession" field="occupation"
              value={isEditingProfile ? (editData?.occupation || "") : profileData.occupation}
              onAdd={applicationDetailsLocked ? undefined : handleStartEditing} {...fp} />
          </div>

          <div style={s.noteBanner}>
            <Sparkles size={14} color="var(--accent-foreground)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={s.noteText}>
              {applicationDetailsLocked
                ? "These details came from your approved application form and cannot be edited here. If you need to request a correction, please contact the admin."
                : "Contact details and emergency contacts are collected during reservation applications."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Contact Information ── */}
      <div style={{ ...s.infoCard, marginTop: 16 }}>
        <SectionHeader icon={Phone} title="Contact Information" />
        <div style={s.sectionBody}>
          <div style={s.grid2}>
            <Field label="Contact Number" field="phone" value={profileData.phone} locked />
            <Field label="Current Address" field="address" value={profileData.address} locked />
          </div>
        </div>
      </div>

      {/* ── Emergency Contact ── */}
      <div style={{ ...s.infoCard, marginTop: 16 }}>
        <SectionHeader icon={User} title="Emergency Contact" />
        <div style={s.sectionBody}>
          <div style={s.grid3}>
            <Field label="Name" field="emergencyContact" value={profileData.emergencyContact} locked />
            <Field label="Relationship" field="emergencyRelationship" value={profileData.emergencyRelationship} locked />
            <Field label="Contact Number" field="emergencyPhone" value={profileData.emergencyPhone} locked />
          </div>
        </div>
      </div>

      {/* ── Current Stay (tenants only) ── */}
      {profileData.role === "tenant" && (
        <div style={{ ...s.infoCard, marginTop: 16 }}>
          <SectionHeader icon={Home} title="Current Stay" />
          <div style={s.sectionBody}>
            <div style={s.grid3}>
              <Field label="Branch" field="branch" value={profileData.occupancy?.branch} locked />
              <Field label="Room" field="room" value={profileData.occupancy?.room} locked />
              <Field label="Bed" field="bed" value={profileData.occupancy?.bed} locked />
            </div>
            <div style={{ ...s.grid2, marginTop: 18 }}>
              <Field label="Move-in Date" field="moveInDate"
                value={profileData.occupancy?.moveInDate ? fmtDate(profileData.occupancy.moveInDate) : ""} locked />
            </div>

            <div style={s.rowSep} />

            <div style={s.subHeader}>
              <CalendarDays size={15} color="var(--primary)" />
              <h3 style={s.sectionTitle}>Lease Information</h3>
            </div>
            <div style={{ ...s.grid2, marginTop: 12 }}>
              <Field label="Lease Start" field="leaseStart"
                value={profileData.lease?.startDate ? fmtDate(profileData.lease.startDate) : ""} locked />
              <Field label="Lease End" field="leaseEnd"
                value={profileData.lease?.endDate ? fmtDate(profileData.lease.endDate) : ""} locked />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalDetailsTab;