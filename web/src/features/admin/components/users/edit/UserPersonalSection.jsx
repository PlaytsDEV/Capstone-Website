import { sanitizeName, formatProperCase } from "../../../../../shared/utils/authValidation";

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

export default function UserPersonalSection({
  editForm,
  editFormErrors,
  touched,
  onFormChange,
  onBlur,
}) {
  return (
    <>
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
              onBlur("firstName");
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

        <div className="form-group">
          <div className="flex items-center justify-between">
            <label>Middle Name</label>
            <span className="text-[11px] text-muted-foreground">
              {(editForm.middleName || "").length}/50
            </span>
          </div>
          <input
            type="text"
            value={editForm.middleName || ""}
            onChange={(e) => {
              const sanitized = sanitizeName(e.target.value);
              onFormChange({ ...editForm, middleName: sanitized }, "middleName", sanitized);
            }}
            onBlur={() => {
              if (editForm.middleName && typeof editForm.middleName === "string") {
                const proper = formatProperCase(editForm.middleName.trim());
                if (proper !== editForm.middleName) {
                  onFormChange({ ...editForm, middleName: proper }, "middleName", proper);
                }
              }
            }}
            maxLength={50}
            placeholder="Optional"
          />
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
              onBlur("lastName");
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
            onBlur={() => onBlur("phone")}
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

      <div className="form-row">
        <div className="form-group">
          <label>Civil Status</label>
          <select
            value={editForm.civilStatus || ""}
            onChange={(e) =>
              onFormChange({ ...editForm, civilStatus: e.target.value })
            }
          >
            <option value="">Not specified</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="widowed">Widowed</option>
            <option value="divorced">Divorced</option>
            <option value="separated">Separated</option>
          </select>
        </div>

        <div className="form-group">
          <div className="flex items-center justify-between">
            <label>Nationality</label>
            <span className="text-[11px] text-muted-foreground">
              {(editForm.nationality || "").length}/50
            </span>
          </div>
          <input
            type="text"
            value={editForm.nationality || ""}
            onChange={(e) =>
              onFormChange({ ...editForm, nationality: e.target.value })
            }
            onBlur={() => {
              if (editForm.nationality && typeof editForm.nationality === "string") {
                const proper = formatProperCase(editForm.nationality.trim());
                if (proper !== editForm.nationality) {
                  onFormChange({ ...editForm, nationality: proper }, "nationality", proper);
                }
              }
            }}
            maxLength={50}
            placeholder="e.g. Filipino"
          />
        </div>

        <div className="form-group">
          <div className="flex items-center justify-between">
            <label>Occupation</label>
            <span className="text-[11px] text-muted-foreground">
              {(editForm.occupation || "").length}/100
            </span>
          </div>
          <input
            type="text"
            value={editForm.occupation || ""}
            onChange={(e) =>
              onFormChange({ ...editForm, occupation: e.target.value })
            }
            onBlur={() => {
              if (editForm.occupation && typeof editForm.occupation === "string") {
                const proper = formatProperCase(editForm.occupation.trim());
                if (proper !== editForm.occupation) {
                  onFormChange({ ...editForm, occupation: proper }, "occupation", proper);
                }
              }
            }}
            maxLength={100}
            placeholder="e.g. Student / Software Engineer"
          />
        </div>
      </div>
    </>
  );
}
