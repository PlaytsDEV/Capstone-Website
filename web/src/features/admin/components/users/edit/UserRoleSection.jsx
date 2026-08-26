export default function UserRoleSection({
  editForm,
  editFormErrors,
  isOwner,
  onFormChange,
  sectionHeaderStyle,
}) {
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

  return (
    <>
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
                value={
                  editForm.role === "branch_admin"
                    ? "Branch Admin"
                    : editForm.role === "owner"
                    ? "Owner"
                    : editForm.role || ""
                }
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
    </>
  );
}
