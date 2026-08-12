import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";
import PasswordVisibilityButton from "../../../../shared/components/PasswordVisibilityButton";
import { BRANCH_OPTIONS } from "../../../../shared/utils/constants";

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

  const isBranchRequired = addForm.role === "branch_admin";

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

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title="Add New User"
      subtitle="Create a new user account in the system"
      variant="primary"
      size="md"
      onConfirm={onSubmit}
      confirmText={isCreating ? "Creating..." : "Create User"}
      cancelText="Cancel"
      loading={isCreating}
    >
      <form onSubmit={onSubmit} className="modal-form" style={{ display: "grid", gap: 14 }}>
        <div className="form-row">
          <div className={`form-group ${addFormErrors.username ? "has-error" : ""}`}>
            <label>Username *</label>
            <input
              type="text"
              value={addForm.username}
              onChange={(e) => onFormChange("username", e.target.value)}
              required
              maxLength={30}
              placeholder="john_doe"
            />
            {addFormErrors.username && (
              <span className="field-error">{addFormErrors.username}</span>
            )}
          </div>
          <div className={`form-group ${addFormErrors.email ? "has-error" : ""}`}>
            <label>Email *</label>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => onFormChange("email", e.target.value)}
              required
              maxLength={100}
              placeholder="user@example.com"
            />
            {addFormErrors.email && (
              <span className="field-error">{addFormErrors.email}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className={`form-group ${addFormErrors.firstName ? "has-error" : ""}`}>
            <label>First Name *</label>
            <input
              type="text"
              value={addForm.firstName}
              onChange={(e) => onFormChange("firstName", e.target.value)}
              required
              maxLength={50}
              placeholder="John"
            />
            {addFormErrors.firstName && (
              <span className="field-error">{addFormErrors.firstName}</span>
            )}
          </div>
          <div className={`form-group ${addFormErrors.lastName ? "has-error" : ""}`}>
            <label>Last Name *</label>
            <input
              type="text"
              value={addForm.lastName}
              onChange={(e) => onFormChange("lastName", e.target.value)}
              required
              maxLength={50}
              placeholder="Doe"
            />
            {addFormErrors.lastName && (
              <span className="field-error">{addFormErrors.lastName}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className={`form-group ${addFormErrors.phone ? "has-error" : ""}`}>
            <label>Phone</label>
            <input
              type="tel"
              inputMode="numeric"
              value={addForm.phone || ""}
              onChange={handlePhoneChange}
              placeholder="e.g. 09171234567 or 9171234567"
              maxLength={addForm.phone?.startsWith("+") ? 13 : addForm.phone?.startsWith("0") ? 11 : 10}
            />
            {!addFormErrors.phone && (
              <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px", display: "block" }}>
                Format: 10 digits starting with 9, or 11 digits starting with 09
              </span>
            )}
            {addFormErrors.phone && (
              <span className="field-error">{addFormErrors.phone}</span>
            )}
          </div>
          <div className={`form-group ${addFormErrors.password ? "has-error" : ""}`}>
            <label>Password *</label>
            <div className="password-field-wrapper" style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={addForm.password}
                onChange={(e) => onFormChange("password", e.target.value)}
                required
                placeholder="Enter a password"
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
            {addFormErrors.password && (
              <span className="field-error">{addFormErrors.password}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Role *</label>
            <select
              value={addForm.role}
              onChange={(e) => onFormChange("role", e.target.value)}
              required
            >
              <option value="applicant">Applicant</option>
              {isOwner && <option value="branch_admin">Branch Admin</option>}
            </select>
          </div>
          <div className={`form-group ${addFormErrors.branch ? "has-error" : ""}`}>
            <label>
              Branch {isBranchRequired ? "*" : "(Optional)"}
            </label>
            {isBranchRequired || isOwner ? (
              <select
                value={addForm.branch || ""}
                onChange={(e) => onFormChange("branch", e.target.value)}
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
            {addFormErrors.branch && (
              <span className="field-error">{addFormErrors.branch}</span>
            )}
          </div>
        </div>

        {/* Welcome Email Callout Banner */}
        <div
          className="rounded-lg p-3 text-xs flex items-center gap-2 mt-1"
          style={{
            backgroundColor: "var(--card-secondary, rgba(255,255,255,0.04))",
            border: "1px solid var(--color-border-default)",
            borderRadius: "6px",
          }}
        >
          <span style={{ fontSize: "15px" }}>✉️</span>
          <span style={{ color: "var(--color-text-secondary)" }}>
            A welcome email with a password setup link will be automatically sent to the user's inbox upon creation.
          </span>
        </div>
      </form>
    </BaseModal>
  );
}

