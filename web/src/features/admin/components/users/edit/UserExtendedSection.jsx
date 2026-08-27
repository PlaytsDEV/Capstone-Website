import {
  RELATIONSHIP_OPTIONS,
  isSamePhone,
} from "../../../../tenant/components/profile/personalDetailsValidation";

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

export default function UserExtendedSection({
  editForm,
  editFormErrors,
  touched,
  onFormChange,
  onBlur,
  sectionHeaderStyle,
}) {
  const isStudentRole = ["applicant", "tenant"].includes(editForm.role);
  const isSameEmergencyPhone =
    Boolean(editForm.emergencyPhone) &&
    Boolean(editForm.phone) &&
    isSamePhone(editForm.emergencyPhone, editForm.phone);

  return (
    <>
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

        <div className="form-group">
          <label>Relationship</label>
          <select
            value={editForm.emergencyRelationship || ""}
            onChange={(e) =>
              onFormChange({
                ...editForm,
                emergencyRelationship: e.target.value,
              })
            }
          >
            <option value="">Select relationship</option>
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`form-group ${isSameEmergencyPhone || (touched.emergencyPhone && editFormErrors.emergencyPhone) ? "has-error" : ""}`}>
          <label>Emergency Contact Number</label>
          <input
            type="tel"
            inputMode="numeric"
            value={editForm.emergencyPhone || ""}
            onChange={(e) => {
              const val = sanitizePhoneInput(e.target.value);
              onFormChange({ ...editForm, emergencyPhone: val }, "emergencyPhone", val);
            }}
            onBlur={() => onBlur("emergencyPhone")}
            placeholder="e.g. 0917 123 4567"
            maxLength={editForm.emergencyPhone?.startsWith("+") ? 13 : editForm.emergencyPhone?.startsWith("0") ? 11 : 10}
          />
          {isSameEmergencyPhone ? (
            <span className="field-error">
              Emergency number cannot match personal mobile number
            </span>
          ) : touched.emergencyPhone && editFormErrors.emergencyPhone ? (
            <span className="field-error">{editFormErrors.emergencyPhone}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground mt-1 block">
              11 digits starting with 09 (or 10 digits starting with 9)
            </span>
          )}
        </div>
      </div>

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
    </>
  );
}
