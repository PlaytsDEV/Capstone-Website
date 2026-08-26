export default function UserCredentialsSection({
  editForm,
  editFormErrors,
  touched,
  onFormChange,
  onBlur,
  firstInputRef,
}) {
  return (
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
          onBlur={() => onBlur("username")}
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
          onBlur={() => onBlur("email")}
          required
          maxLength={100}
        />
        {touched.email && editFormErrors.email && (
          <span className="field-error">{editFormErrors.email}</span>
        )}
      </div>
    </div>
  );
}
