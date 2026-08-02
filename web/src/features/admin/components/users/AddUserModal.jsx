import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";
import PasswordVisibilityButton from "../../../../shared/components/PasswordVisibilityButton";

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
              placeholder="Doe"
            />
            {addFormErrors.lastName && (
              <span className="field-error">{addFormErrors.lastName}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={addForm.phone}
              onChange={(e) => onFormChange("phone", e.target.value)}
              placeholder="+1234567890"
            />
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
            <label>Role</label>
            <select
              value={addForm.role}
              onChange={(e) => onFormChange("role", e.target.value)}
              required
            >
              <option value="applicant">Applicant</option>
              {isOwner && <option value="branch_admin">Branch Admin</option>}
            </select>
          </div>
          <div className="form-group">
            <label>Branch</label>
            <div className="form-hint-box">
              Auto-assigned when user becomes a tenant
            </div>
          </div>
        </div>
      </form>
    </BaseModal>
  );
}
