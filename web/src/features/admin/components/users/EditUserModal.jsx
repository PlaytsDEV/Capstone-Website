import { useState, useRef, useEffect } from "react";
import BaseModal from "../../../../shared/components/BaseModal";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import { sanitizeName, formatProperCase } from "../../../../shared/utils/authValidation";

export default function EditUserModal({
  editForm,
  editFormErrors = {},
  isOwner = false,
  onFormChange,
  onSubmit,
  onClose,
  isUpdating = false,
}) {
  const [touched, setTouched] = useState({});
  const initialFormRef = useRef(JSON.stringify(editForm));
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleSafeClose = () => {
    const isDirty = JSON.stringify(editForm) !== initialFormRef.current;
    if (isDirty && !isUpdating) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const isLifecycleManaged =
    editForm.lifecycleManaged ?? ["applicant", "tenant"].includes(editForm.role);
  const isStudentRole = ["applicant", "tenant"].includes(editForm.role);

  const lifecycleIndicator = editForm.hasActiveStay
    ? "Active stay"
    : editForm.hasLifecycleReservation
    ? "Active reservation"
    : "No active reservation";
  const lifecycleGuidance = editForm.hasActiveStay
    ? "Use Tenant Actions or Reservations to process move-out before modifying lifecycle role."
    : "Use Reservations or Tenant Actions to change applicant or tenant lifecycle state.";

  const sanitizePhoneInput = (value) => {
    let val = value;
    if (val.startsWith("+")) {
      return "+" + val.slice(1).replace(/\D/g, "").slice(0, 12);
    }
    val = val.replace(/\D/g, "");
    if (val.startsWith("0")) {
      return val.slice(0, 11);
    }
    return val.slice(0, 10);
  };

  const sectionHeaderStyle = {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--muted-foreground)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: "10px 0 6px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border)",
  };

  return (
    <>
      <BaseModal
        isOpen={true}
        onClose={handleSafeClose}
        title="Edit User Account"
        subtitle="Modify profile credentials, personal details, and role assignments"
        variant="primary"
        size="lg"
        onConfirm={onSubmit}
        confirmText={isUpdating ? "Saving Changes..." : "Save Changes"}
        cancelText="Cancel"
        loading={isUpdating}
      >
        <form
          onSubmit={onSubmit}
          className="modal-form"
          style={{ display: "grid", gap: 12, padding: "4px 0" }}
        >
          {/* 1. Account Credentials */}
          <div className="form-row">
            <div className={`form-group ${touched.username && editFormErrors.username ? "has-error" : ""}`}>
              <div className="flex items-center justify-between">
                <label>Username *</label>
                <span className="text-[11px] text-muted-foreground">
                  {(editForm.username || "").length}/30
                </span>
              </div>
              <input
                ref={firstInputRef}
                type="text"
                value={editForm.username || ""}
                onChange={(e) =>
                  onFormChange({ ...editForm, username: e.target.value }, "username", e.target.value)
                }
                onBlur={() => handleBlur("username")}
                required
                maxLength={30}
              />
              {touched.username && editFormErrors.username && (
                <span className="field-error">{editFormErrors.username}</span>
              )}
            </div>

            <div className={`form-group ${touched.email && editFormErrors.email ? "has-error" : ""}`}>
              <div className="flex items-center justify-between">
                <label>Email Address *</label>
                <span className="text-[11px] text-muted-foreground">
                  {(editForm.email || "").length}/100
                </span>
              </div>
              <input
                type="email"
                value={editForm.email || ""}
                onChange={(e) =>
                  onFormChange({ ...editForm, email: e.target.value }, "email", e.target.value)
                }
                onBlur={() => handleBlur("email")}
                required
                maxLength={100}
              />
              {touched.email && editFormErrors.email && (
                <span className="field-error">{editFormErrors.email}</span>
              )}
            </div>
          </div>

          {/* 2. Personal Information */}
          <div className="form-row">
            <div className={`form-group ${touched.firstName && editFormErrors.firstName ? "has-error" : ""}`}>
              <div className="flex items-center justify-between">
                <label>First Name *</label>
                <span className="text-[11px] text-muted-foreground">
                  {(editForm.firstName || "").length}/50
                </span>
              </div>
              <input
                type="text"
                value={editForm.firstName || ""}
                onChange={(e) => {
                  const sanitized = sanitizeName(e.target.value);
                  onFormChange({ ...editForm, firstName: sanitized }, "firstName", sanitized);
                }}
                onBlur={() => {
                  handleBlur("firstName");
                  if (editForm.firstName && typeof editForm.firstName === "string") {
                    const proper = formatProperCase(editForm.firstName.trim());
                    if (proper !== editForm.firstName) {
                      onFormChange({ ...editForm, firstName: proper }, "firstName", proper);
                    }
                  }
                }}
                required
                maxLength={50}
              />
              {touched.firstName && editFormErrors.firstName && (
                <span className="field-error">{editFormErrors.firstName}</span>
              )}
            </div>

            <div className={`form-group ${touched.lastName && editFormErrors.lastName ? "has-error" : ""}`}>
              <div className="flex items-center justify-between">
                <label>Last Name *</label>
                <span className="text-[11px] text-muted-foreground">
                  {(editForm.lastName || "").length}/50
                </span>
              </div>
              <input
                type="text"
                value={editForm.lastName || ""}
                onChange={(e) => {
                  const sanitized = sanitizeName(e.target.value);
                  onFormChange({ ...editForm, lastName: sanitized }, "lastName", sanitized);
                }}
                onBlur={() => {
                  handleBlur("lastName");
                  if (editForm.lastName && typeof editForm.lastName === "string") {
                    const proper = formatProperCase(editForm.lastName.trim());
                    if (proper !== editForm.lastName) {
                      onFormChange({ ...editForm, lastName: proper }, "lastName", proper);
                    }
                  }
                }}
                required
                maxLength={50}
              />
              {touched.lastName && editFormErrors.lastName && (
                <span className="field-error">{editFormErrors.lastName}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className={`form-group ${touched.phone && editFormErrors.phone ? "has-error" : ""}`}>
              <label>Mobile Number</label>
              <input
                type="tel"
                inputMode="numeric"
                value={editForm.phone || ""}
                onChange={(e) => {
                  const val = sanitizePhoneInput(e.target.value);
                  onFormChange({ ...editForm, phone: val }, "phone", val);
                }}
                onBlur={() => handleBlur("phone")}
                placeholder="e.g. 0917 123 4567"
                maxLength={editForm.phone?.startsWith("+") ? 13 : editForm.phone?.startsWith("0") ? 11 : 10}
              />
              {!editFormErrors.phone && (
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  11 digits starting with 09 (or 10 digits starting with 9)
                </span>
              )}
              {touched.phone && editFormErrors.phone && (
                <span className="field-error">{editFormErrors.phone}</span>
              )}
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select
                value={editForm.gender || ""}
                onChange={(e) =>
                  onFormChange({ ...editForm, gender: e.target.value })
                }
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* 3. Role & Branch Assignment */}
          <h3 style={sectionHeaderStyle}>Role & Branch Assignment</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                value={editForm.dateOfBirth || ""}
                onChange={(e) =>
                  onFormChange({ ...editForm, dateOfBirth: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              {isLifecycleManaged ? (
                <>
                  <input
                    type="text"
                    value={editForm.role === "tenant" ? "Tenant" : "Applicant"}
                    readOnly
                    className="opacity-80 bg-muted cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Applicant and tenant roles are protected by reservation lifecycle contracts.
                  </p>
                </>
              ) : isOwner ? (
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    onFormChange({ ...editForm, role: e.target.value }, "role", e.target.value)
                  }
                  required
                >
                  <option value="applicant">Applicant</option>
                  <option value="branch_admin">Branch Admin</option>
                  <option value="owner">Owner</option>
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    value={editForm.role === "branch_admin" ? "Branch Admin" : editForm.role === "owner" ? "Owner" : editForm.role || ""}
                    readOnly
                    className="opacity-80 bg-muted cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Only the Dorm Owner can modify administrative roles.
                  </p>
                </>
              )}
            </div>
          </div>

          {isLifecycleManaged && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Tenant Status</label>
                  <input
                    type="text"
                    value={editForm.tenantStatus || "applicant"}
                    readOnly
                    className="opacity-80 bg-muted cursor-not-allowed capitalize"
                  />
                </div>
                <div className="form-group">
                  <label>Lifecycle State</label>
                  <input
                    type="text"
                    value={lifecycleIndicator}
                    readOnly
                    className="opacity-80 bg-muted cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
                <strong className="text-foreground block mb-0.5">Lifecycle Protected Record</strong>
                <p>{lifecycleGuidance}</p>
              </div>
            </>
          )}

          <div className="form-row">
            <div className={`form-group ${editFormErrors.branch ? "has-error" : ""}`}>
              <label>Branch Assignment</label>
              {isOwner ? (
                <select
                  value={editForm.branch || ""}
                  onChange={(e) =>
                    onFormChange({ ...editForm, branch: e.target.value }, "branch", e.target.value)
                  }
                >
                  <option value="">Unassigned (No Branch)</option>
                  <option value="gil-puyat">Gil Puyat</option>
                  <option value="guadalupe">Guadalupe</option>
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    value={
                      editForm.branch === "gil-puyat"
                        ? "Gil Puyat"
                        : editForm.branch === "guadalupe"
                        ? "Guadalupe"
                        : "Unassigned"
                    }
                    readOnly
                    className="opacity-80 bg-muted cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Branch assignment is managed by the Dorm Owner.
                  </p>
                </>
              )}
              {editFormErrors.branch && (
                <span className="field-error">{editFormErrors.branch}</span>
              )}
            </div>
          </div>

          {/* 4. Extended Profile Details */}
          <h3 style={sectionHeaderStyle}>Extended Profile Details</h3>

          <div className="form-row">
            <div className="form-group">
              <div className="flex items-center justify-between">
                <label>Street Address</label>
                <span className="text-[11px] text-muted-foreground">
                  {(editForm.address || "").length}/200
                </span>
              </div>
              <input
                type="text"
                value={editForm.address || ""}
                onChange={(e) =>
                  onFormChange({ ...editForm, address: e.target.value })
                }
                maxLength={200}
                placeholder="Unit, Building, Street"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={editForm.city || ""}
                onChange={(e) =>
                  onFormChange({ ...editForm, city: e.target.value })
                }
                maxLength={100}
                placeholder="City / Municipality"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <div className="flex items-center justify-between">
                <label>Emergency Contact Person</label>
                <span className="text-[11px] text-muted-foreground">
                  {(editForm.emergencyContact || "").length}/100
                </span>
              </div>
              <input
                type="text"
                value={editForm.emergencyContact || ""}
                onChange={(e) =>
                  onFormChange({
                    ...editForm,
                    emergencyContact: e.target.value,
                  })
                }
                maxLength={100}
                placeholder="Full name of emergency contact"
              />
            </div>
            <div className={`form-group ${touched.emergencyPhone && editFormErrors.emergencyPhone ? "has-error" : ""}`}>
              <label>Emergency Contact Number</label>
              <input
                type="tel"
                inputMode="numeric"
                value={editForm.emergencyPhone || ""}
                onChange={(e) => {
                  const val = sanitizePhoneInput(e.target.value);
                  onFormChange({ ...editForm, emergencyPhone: val }, "emergencyPhone", val);
                }}
                onBlur={() => handleBlur("emergencyPhone")}
                placeholder="e.g. 0917 123 4567"
                maxLength={editForm.emergencyPhone?.startsWith("+") ? 13 : editForm.emergencyPhone?.startsWith("0") ? 11 : 10}
              />
              {!editFormErrors.emergencyPhone && (
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  11 digits starting with 09 (or 10 digits starting with 9)
                </span>
              )}
              {touched.emergencyPhone && editFormErrors.emergencyPhone && (
                <span className="field-error">{editFormErrors.emergencyPhone}</span>
              )}
            </div>
          </div>

          {/* 5. Student & Academic Details (for Tenants and Applicants) */}
          {isStudentRole && (
            <>
              <h3 style={sectionHeaderStyle}>Student & Academic Details</h3>

              <div className="form-row">
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label>Student ID</label>
                    <span className="text-[11px] text-muted-foreground">
                      {(editForm.studentId || "").length}/50
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editForm.studentId || ""}
                    onChange={(e) =>
                      onFormChange({ ...editForm, studentId: e.target.value })
                    }
                    maxLength={50}
                    placeholder="e.g. 2023-12345"
                  />
                </div>
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label>School / University</label>
                    <span className="text-[11px] text-muted-foreground">
                      {(editForm.school || "").length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editForm.school || ""}
                    onChange={(e) =>
                      onFormChange({ ...editForm, school: e.target.value })
                    }
                    maxLength={100}
                    placeholder="e.g. De La Salle University"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label>Year Level / Course</label>
                    <span className="text-[11px] text-muted-foreground">
                      {(editForm.yearLevel || "").length}/50
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editForm.yearLevel || ""}
                    onChange={(e) =>
                      onFormChange({ ...editForm, yearLevel: e.target.value })
                    }
                    maxLength={50}
                    placeholder="e.g. 3rd Year - BS Information Technology"
                  />
                </div>
              </div>
            </>
          )}
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
