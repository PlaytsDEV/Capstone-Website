import { createPortal } from "react-dom";
import useBodyScrollLock from "../../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";

export default function EditUserModal({
 editForm,
 editFormErrors = {},
 isOwner,
 onFormChange,
 onSubmit,
 onClose,
}) {
 useBodyScrollLock(true);
 useEscapeClose(true, onClose);

 if (typeof document === "undefined") return null;

 const isLifecycleManaged =
 editForm.lifecycleManaged ?? ["applicant", "tenant"].includes(editForm.role);
 const lifecycleIndicator = editForm.hasActiveStay
 ? "Active stay"
 : editForm.hasLifecycleReservation
 ? "Active reservation"
 : "No active reservation";
 const lifecycleGuidance = editForm.hasActiveStay
 ? "Use Tenant Actions or Reservations to move this user out before changing lifecycle state."
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

 return createPortal(
 <div
 className="modal-overlay"
 onClick={(e) => {
 if (e.target === e.currentTarget) onClose();
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
 <h2>Edit User</h2>
 <button onClick={onClose} className="modal-close" aria-label="Close">
 ×
 </button>
 </div>
 <form
 onSubmit={onSubmit}
 className="modal-form"
 style={{ maxHeight: "70vh", overflowY: "auto" }}
 >
  <div className="form-row">
  <div className={`form-group ${editFormErrors.username ? "has-error" : ""}`}>
  <label>Username *</label>
  <input
  type="text"
  value={editForm.username || ""}
  onChange={(e) =>
  onFormChange({ ...editForm, username: e.target.value }, "username", e.target.value)
  }
  required
  maxLength={30}
  />
  {editFormErrors.username && (
  <span className="field-error">{editFormErrors.username}</span>
  )}
  </div>
  <div className={`form-group ${editFormErrors.email ? "has-error" : ""}`}>
  <label>Email *</label>
  <input
  type="email"
  value={editForm.email || ""}
  onChange={(e) =>
  onFormChange({ ...editForm, email: e.target.value }, "email", e.target.value)
  }
  required
  maxLength={100}
  />
  {editFormErrors.email && (
  <span className="field-error">{editFormErrors.email}</span>
  )}
  </div>
  </div>

  <div className="form-row">
  <div className={`form-group ${editFormErrors.firstName ? "has-error" : ""}`}>
  <label>First Name *</label>
  <input
  type="text"
  value={editForm.firstName || ""}
  onChange={(e) =>
  onFormChange({ ...editForm, firstName: e.target.value }, "firstName", e.target.value)
  }
  required
  maxLength={50}
  />
  {editFormErrors.firstName && (
  <span className="field-error">{editFormErrors.firstName}</span>
  )}
  </div>
  <div className={`form-group ${editFormErrors.lastName ? "has-error" : ""}`}>
  <label>Last Name *</label>
  <input
  type="text"
  value={editForm.lastName || ""}
  onChange={(e) =>
  onFormChange({ ...editForm, lastName: e.target.value }, "lastName", e.target.value)
  }
  required
  maxLength={50}
  />
  {editFormErrors.lastName && (
  <span className="field-error">{editFormErrors.lastName}</span>
  )}
  </div>
  </div>

 <div className="form-row">
  <div className={`form-group ${editFormErrors.phone ? "has-error" : ""}`}>
  <label>Phone</label>
  <input
  type="tel"
  inputMode="numeric"
  value={editForm.phone || ""}
  onChange={(e) => {
  const val = sanitizePhoneInput(e.target.value);
  onFormChange({ ...editForm, phone: val }, "phone", val);
  }}
  placeholder="e.g. 09171234567 or 9171234567"
  maxLength={editForm.phone?.startsWith("+") ? 13 : editForm.phone?.startsWith("0") ? 11 : 10}
  />
  {!editFormErrors.phone && (
  <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px", display: "block" }}>
  Format: 10 digits starting with 9, or 11 digits starting with 09
  </span>
  )}
  {editFormErrors.phone && (
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
 <input type="text" value={editForm.role || "applicant"} readOnly />
 <p className="modal-help-text">
 Applicant and tenant roles are managed by reservation lifecycle.
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
 />
 </div>
 <div className="form-group">
 <label>Lifecycle State</label>
 <input type="text" value={lifecycleIndicator} readOnly />
 </div>
 </div>

 <div className="modal-help-card">
 <strong>Lifecycle Managed</strong>
 <p>{lifecycleGuidance}</p>
 </div>
 </>
 )}

 <div className="form-row">
 <div className={`form-group ${editFormErrors.branch ? "has-error" : ""}`}>
 <label>Branch</label>
 <select
 value={editForm.branch || ""}
 onChange={(e) =>
 onFormChange({ ...editForm, branch: e.target.value }, "branch", e.target.value)
 }
 >
 <option value="">No Branch</option>
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
 fontSize: "13px",
 fontWeight: 600,
 color: "#6B7280",
 textTransform: "uppercase",
 letterSpacing: "0.5px",
 margin: "16px 0 8px",
 paddingTop: "12px",
 borderTop: "1px solid #E8EBF0",
 }}
 >
 Extended Profile
 </h3>

 <div className="form-row">
 <div className="form-group">
 <label>Address</label>
 <input
 type="text"
 value={editForm.address || ""}
 onChange={(e) =>
 onFormChange({ ...editForm, address: e.target.value })
 }
 maxLength={200}
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
 />
 </div>
 </div>

 <div className="form-row">
 <div className="form-group">
 <label>Emergency Contact</label>
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
 />
 </div>
  <div className={`form-group ${editFormErrors.emergencyPhone ? "has-error" : ""}`}>
  <label>Emergency Phone</label>
  <input
  type="tel"
  inputMode="numeric"
  value={editForm.emergencyPhone || ""}
  onChange={(e) => {
  const val = sanitizePhoneInput(e.target.value);
  onFormChange({ ...editForm, emergencyPhone: val }, "emergencyPhone", val);
  }}
  placeholder="e.g. 09171234567 or 9171234567"
  maxLength={editForm.emergencyPhone?.startsWith("+") ? 13 : editForm.emergencyPhone?.startsWith("0") ? 11 : 10}
  />
  {!editFormErrors.emergencyPhone && (
  <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px", display: "block" }}>
  Format: 10 digits starting with 9, or 11 digits starting with 09
  </span>
  )}
  {editFormErrors.emergencyPhone && (
  <span className="field-error">{editFormErrors.emergencyPhone}</span>
  )}
  </div>
 </div>

 <div className="modal-footer">
 <button type="button" onClick={onClose} className="btn-cancel">
 Cancel
 </button>
 <button type="submit" className="btn-save">
 Save Changes
 </button>
 </div>
 </form>
 </div>
 </div>,
 document.body,
 );
}
