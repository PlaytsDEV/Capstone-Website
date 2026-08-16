import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import useBodyScrollLock from "../../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { LoaderCircle } from "lucide-react";

export default function EditUserModal({
  editForm,
  editFormErrors = {},
  isOwner,
  onFormChange,
  onSubmit,
  onClose,
  isUpdating = false,
}) {
  useBodyScrollLock(true);
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
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  useEscapeClose(true, () => {
    if (showDiscardConfirm) {
      setShowDiscardConfirm(false);
    } else {
      handleSafeClose();
    }
  });

  if (typeof document === "undefined") return null;

  const isLifecycleManaged =
    editForm.lifecycleManaged ?? ["applicant", "tenant"].includes(editForm.role);
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

  return (
    <>
      {createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleSafeClose();
          }}
        >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Edit user"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px" }}
      >
        <div className="modal-header">
          <div>
            <h2 className="text-base font-semibold text-foreground">Edit User Account</h2>
            <p className="text-xs text-muted-foreground">Modify profile credentials and permissions</p>
          </div>
          <button onClick={handleSafeClose} className="modal-close" aria-label="Close">
            ×
          </button>
        </div>
        <form
          onSubmit={onSubmit}
          className="modal-form"
          style={{ maxHeight: "72vh", overflowY: "auto" }}
        >
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
                onChange={(e) =>
                  onFormChange({ ...editForm, firstName: e.target.value }, "firstName", e.target.value)
                }
                onBlur={() => handleBlur("firstName")}
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
                onChange={(e) =>
                  onFormChange({ ...editForm, lastName: e.target.value }, "lastName", e.target.value)
                }
                onBlur={() => handleBlur("lastName")}
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
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px", display: "block" }}>
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
                  <input type="text" value={editForm.role || "applicant"} readOnly className="opacity-80" />
                  <p className="modal-help-text">
                    Applicant and tenant roles are protected by reservation lifecycle contracts.
                  </p>
                </>
              ) : (
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    onFormChange({ ...editForm, role: e.target.value })
                  }
                  required
                >
                  <option value="applicant">Applicant</option>
                  <option value="branch_admin">Branch Admin</option>
                  {isOwner && <option value="owner">Owner</option>}
                </select>
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
                    className="opacity-80"
                  />
                </div>
                <div className="form-group">
                  <label>Lifecycle State</label>
                  <input type="text" value={lifecycleIndicator} readOnly className="opacity-80" />
                </div>
              </div>

              <div className="modal-help-card">
                <strong>Lifecycle Managed Account</strong>
                <p>{lifecycleGuidance}</p>
              </div>
            </>
          )}

          <div className="form-row">
            <div className={`form-group ${editFormErrors.branch ? "has-error" : ""}`}>
              <label>Branch Assignment</label>
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
              {editFormErrors.branch && (
                <span className="field-error">{editFormErrors.branch}</span>
              )}
            </div>
          </div>

          <h3
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "14px 0 8px",
              paddingTop: "10px",
              borderTop: "1px solid var(--border)",
            }}
          >
            Extended Profile Details
          </h3>

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
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px", display: "block" }}>
                  11 digits starting with 09 (or 10 digits starting with 9)
                </span>
              )}
              {touched.emergencyPhone && editFormErrors.emergencyPhone && (
                <span className="field-error">{editFormErrors.emergencyPhone}</span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleSafeClose} className="btn-cancel" disabled={isUpdating}>
              Cancel
            </button>
            <button type="submit" className="btn-save flex items-center gap-2" disabled={isUpdating}>
              {isUpdating && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {isUpdating ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )}
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
