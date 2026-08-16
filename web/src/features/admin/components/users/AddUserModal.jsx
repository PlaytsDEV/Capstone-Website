import { useState, useRef, useEffect } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import BaseModal from "../../../../shared/components/BaseModal";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import PasswordVisibilityButton from "../../../../shared/components/PasswordVisibilityButton";
import { BRANCH_OPTIONS } from "../../../../shared/utils/constants";
import { showNotification } from "../../../../shared/utils/notification";

function generateSecurePassword() {
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()_+-=";
  const all = lowercase + uppercase + numbers + symbols;

  let pwd = "";
  pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
  pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle characters
  return pwd.split("").sort(() => 0.5 - Math.random()).join("");
}

function getPasswordStrength(pwd) {
  if (!pwd) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 2) return { score: 1, label: "Weak", color: "var(--danger)" };
  if (score <= 4) return { score: 2, label: "Moderate", color: "var(--warning)" };
  return { score: 3, label: "Strong", color: "var(--success)" };
}

export default function AddUserModal({
  addForm,
  addFormErrors,
  isCreating,
  isOwner,
  onFormChange,
  onSubmit,
  onClose,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState({});
  const usernameInputRef = useRef(null);

  const isBranchRequired = addForm.role === "branch_admin";
  const passwordStrength = getPasswordStrength(addForm.password);

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    if (val.startsWith("+")) {
      val = "+" + val.slice(1).replace(/\D/g, "").slice(0, 12);
    } else {
      val = val.replace(/\D/g, "");
      if (val.startsWith("0")) {
        val = val.slice(0, 11);
      } else {
        val = val.slice(0, 10);
      }
    }
    onFormChange("phone", val);
  };

  const handleGeneratePassword = (e) => {
    e.preventDefault();
    const newPassword = generateSecurePassword();
    onFormChange("password", newPassword);
    setShowPassword(true);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(newPassword).then(() => {
        setCopied(true);
        showNotification("Strong password generated & copied to clipboard", "info", 3000);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  };

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleSafeClose = () => {
    const isDirty =
      addForm.username ||
      addForm.email ||
      addForm.firstName ||
      addForm.lastName ||
      addForm.password ||
      addForm.phone;

    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <BaseModal
        isOpen={true}
        onClose={handleSafeClose}
        title="Add New User"
        subtitle="Create a new user account in the system"
        variant="primary"
        size="md"
        onConfirm={onSubmit}
        confirmText={isCreating ? "Creating Account..." : "Create User"}
        cancelText="Cancel"
        loading={isCreating}
      >
        <form onSubmit={onSubmit} className="modal-form" style={{ display: "grid", gap: 14 }}>
        <div className="form-row">
          <div className={`form-group ${touched.username && addFormErrors.username ? "has-error" : ""}`}>
            <div className="flex items-center justify-between">
              <label>Username *</label>
              <span className="text-[11px] text-muted-foreground">
                {(addForm.username || "").length}/30
              </span>
            </div>
            <input
              ref={usernameInputRef}
              type="text"
              value={addForm.username}
              onChange={(e) => onFormChange("username", e.target.value)}
              onBlur={() => handleBlur("username")}
              required
              maxLength={30}
              placeholder="e.g. john_doe"
            />
            {touched.username && addFormErrors.username && (
              <span className="field-error">{addFormErrors.username}</span>
            )}
          </div>
          <div className={`form-group ${touched.email && addFormErrors.email ? "has-error" : ""}`}>
            <div className="flex items-center justify-between">
              <label>Email Address *</label>
              <span className="text-[11px] text-muted-foreground">
                {(addForm.email || "").length}/100
              </span>
            </div>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => onFormChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              required
              maxLength={100}
              placeholder="user@example.com"
            />
            {touched.email && addFormErrors.email && (
              <span className="field-error">{addFormErrors.email}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className={`form-group ${touched.firstName && addFormErrors.firstName ? "has-error" : ""}`}>
            <div className="flex items-center justify-between">
              <label>First Name *</label>
              <span className="text-[11px] text-muted-foreground">
                {(addForm.firstName || "").length}/50
              </span>
            </div>
            <input
              type="text"
              value={addForm.firstName}
              onChange={(e) => onFormChange("firstName", e.target.value)}
              onBlur={() => handleBlur("firstName")}
              required
              maxLength={50}
              placeholder="John"
            />
            {touched.firstName && addFormErrors.firstName && (
              <span className="field-error">{addFormErrors.firstName}</span>
            )}
          </div>
          <div className={`form-group ${touched.lastName && addFormErrors.lastName ? "has-error" : ""}`}>
            <div className="flex items-center justify-between">
              <label>Last Name *</label>
              <span className="text-[11px] text-muted-foreground">
                {(addForm.lastName || "").length}/50
              </span>
            </div>
            <input
              type="text"
              value={addForm.lastName}
              onChange={(e) => onFormChange("lastName", e.target.value)}
              onBlur={() => handleBlur("lastName")}
              required
              maxLength={50}
              placeholder="Doe"
            />
            {touched.lastName && addFormErrors.lastName && (
              <span className="field-error">{addFormErrors.lastName}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className={`form-group ${touched.phone && addFormErrors.phone ? "has-error" : ""}`}>
            <label>Mobile Number</label>
            <input
              type="tel"
              inputMode="numeric"
              value={addForm.phone || ""}
              onChange={handlePhoneChange}
              onBlur={() => handleBlur("phone")}
              placeholder="e.g. 0917 123 4567"
              maxLength={addForm.phone?.startsWith("+") ? 13 : addForm.phone?.startsWith("0") ? 11 : 10}
            />
            {!addFormErrors.phone && (
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px", display: "block" }}>
                11 digits starting with 09 (or 10 digits starting with 9)
              </span>
            )}
            {touched.phone && addFormErrors.phone && (
              <span className="field-error">{addFormErrors.phone}</span>
            )}
          </div>

          <div className={`form-group ${touched.password && addFormErrors.password ? "has-error" : ""}`}>
            <div className="flex items-center justify-between">
              <label>Password *</label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Sparkles className="h-3 w-3" />}
                {copied ? "Copied!" : "Generate Strong"}
              </button>
            </div>
            <div className="password-field-wrapper" style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={addForm.password}
                onChange={(e) => onFormChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                required
                placeholder="Enter or generate password"
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
                style={{ width: "100%", paddingRight: "56px" }}
              />
              <PasswordVisibilityButton
                visible={showPassword}
                className="password-toggle-btn"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </div>

            {/* Password strength indicator */}
            {addForm.password && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full overflow-hidden bg-muted flex gap-0.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: passwordStrength.score === 1 ? "33%" : passwordStrength.score === 2 ? "66%" : "100%",
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: passwordStrength.color }}>
                  {passwordStrength.label}
                </span>
              </div>
            )}

            {touched.password && addFormErrors.password && (
              <span className="field-error">{addFormErrors.password}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Assigned Role *</label>
            <select
              value={addForm.role}
              onChange={(e) => onFormChange("role", e.target.value)}
              required
            >
              <option value="applicant">Applicant</option>
              {isOwner && <option value="branch_admin">Branch Admin</option>}
            </select>
          </div>
          <div className={`form-group ${touched.branch && addFormErrors.branch ? "has-error" : ""}`}>
            <label>
              Branch {isBranchRequired ? "*" : "(Optional)"}
            </label>
            {isBranchRequired || isOwner ? (
              <select
                value={addForm.branch || ""}
                onChange={(e) => onFormChange("branch", e.target.value)}
                onBlur={() => handleBlur("branch")}
                required={isBranchRequired}
              >
                <option value="">
                  {isBranchRequired ? "Select Branch *" : "Unassigned / Auto"}
                </option>
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="form-hint-box">
                {addForm.branch ? addForm.branch : "Auto-assigned to your branch"}
              </div>
            )}
            {touched.branch && addFormErrors.branch && (
              <span className="field-error">{addFormErrors.branch}</span>
            )}
          </div>
        </div>

        {/* Welcome Email Callout Banner */}
        <div
          className="rounded-lg p-3 text-xs flex items-center gap-2 mt-1"
          style={{
            backgroundColor: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
          }}
        >
          <span style={{ fontSize: "14px" }}>✉️</span>
          <span style={{ color: "var(--muted-foreground)" }}>
            A welcome notification with account credentials and sign-in instructions will be sent to the user's registered email address.
          </span>
        </div>
      </form>
    </BaseModal>
    <ConfirmModal
      isOpen={showDiscardConfirm}
      onClose={() => setShowDiscardConfirm(false)}
      onConfirm={() => {
        setShowDiscardConfirm(false);
        onClose();
      }}
      title="Discard Changes"
      message="You have unsaved changes. Are you sure you want to discard them and close this form?"
      confirmText="Discard"
      cancelText="Keep Editing"
      variant="warning"
    />
    </>
  );
}

