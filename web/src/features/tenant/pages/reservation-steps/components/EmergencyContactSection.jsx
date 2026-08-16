import React from "react";
import PhoneInput from "../../../../../shared/components/PhoneInput";

const errBorder = (show, value) =>
  show && !value ? "1.5px solid var(--danger)" : undefined;

/**
 * Section 3: Emergency Contact — name, relationship, phone, health concerns.
 */
const EmergencyContactSection = ({
  emergencyContactName,
  setEmergencyContactName,
  emergencyRelationship,
  setEmergencyRelationship,
  emergencyContactNumber,
  setEmergencyContactNumber,
  healthConcerns,
  setHealthConcerns,
  validateField,
  fieldErrors,
  showValidationErrors,
}) => {
  const handleSetHealthNa = () => {
    setHealthConcerns("N/A");
    validateField("healthConcerns", "N/A", () => ({ valid: true, error: null }));
  };

  return (
    <>
      <div className="form-group" data-field="emergencyContactName">
        <label className="form-label" htmlFor="emergencyContactNameInput">
          Person to Contact in Case of Emergency <span className="rf-required">*</span>
        </label>
        <input
          id="emergencyContactNameInput"
          type="text"
          name="name"
          autoComplete="name"
          className="form-input"
          placeholder="Full name of emergency contact"
          value={emergencyContactName}
          maxLength={100}
          onChange={(e) => {
            setEmergencyContactName(e.target.value);
          }}
          onBlur={() =>
            validateField("emergencyContactName", emergencyContactName, (v) => {
              const valid = Boolean(v && v.trim().length >= 2);
              return {
                valid,
                error: valid ? null : "Please enter the contact person's full name (at least 2 characters)",
              };
            })
          }
          style={{
            border: fieldErrors.emergencyContactName
              ? "1.5px solid var(--danger)"
              : errBorder(showValidationErrors, emergencyContactName),
          }}
          aria-invalid={Boolean(fieldErrors.emergencyContactName || (showValidationErrors && !emergencyContactName))}
        />
        <FieldError
          error={
            showValidationErrors && !emergencyContactName
              ? "Emergency contact name is required"
              : fieldErrors.emergencyContactName
          }
        />
      </div>

      <div className="form-row">
        <div className="form-group" data-field="emergencyRelationship">
          <label className="form-label" htmlFor="emergencyRelationshipSelect">
            Relationship <span className="rf-required">*</span>
          </label>
          <select
            id="emergencyRelationshipSelect"
            className="form-select"
            value={emergencyRelationship}
            onChange={(e) => {
              setEmergencyRelationship(e.target.value);
              validateField("emergencyRelationship", e.target.value, (value) => ({
                valid: Boolean(value),
                error: value ? null : "Relationship is required",
              }));
            }}
            style={{
              border: fieldErrors.emergencyRelationship
                ? "1.5px solid var(--danger)"
                : errBorder(showValidationErrors, emergencyRelationship),
            }}
            aria-invalid={Boolean(fieldErrors.emergencyRelationship || (showValidationErrors && !emergencyRelationship))}
          >
            <option value="">Select relationship...</option>
            <option value="parent">Parent</option>
            <option value="sibling">Sibling</option>
            <option value="spouse">Spouse</option>
            <option value="relative">Relative</option>
            <option value="guardian">Guardian</option>
            <option value="friend">Friend</option>
            <option value="colleague">Colleague / Coworker</option>
            <option value="other">Other</option>
          </select>
          <FieldError
            error={
              showValidationErrors && !emergencyRelationship
                ? "Relationship is required"
                : fieldErrors.emergencyRelationship
            }
          />
        </div>

        <div className="form-group" data-field="emergencyContactNumber">
          <label className="form-label">
            Contact Number <span className="rf-required">*</span>
          </label>
          <PhoneInput
            value={emergencyContactNumber}
            onChange={(e164) => {
              setEmergencyContactNumber(e164);
              validateField("emergencyContactNumber", e164, (value) => {
                const valid = /^\+\d{10,15}$/.test(value || "");
                return {
                  valid,
                  error: valid ? null : "Please enter a valid contact number",
                };
              });
            }}
            onBlur={() =>
              validateField("emergencyContactNumber", emergencyContactNumber, (value) => {
                const valid = /^\+\d{10,15}$/.test(value || "");
                return {
                  valid,
                  error: valid ? null : "Please enter a valid contact number",
                };
              })
            }
            hasError={
              Boolean(fieldErrors.emergencyContactNumber) ||
              (showValidationErrors && !emergencyContactNumber)
            }
            autoComplete="tel"
            required
          />
          <FieldError
            error={
              showValidationErrors && !emergencyContactNumber
                ? "Contact number is required"
                : fieldErrors.emergencyContactNumber
            }
          />
        </div>
      </div>

      <div className="form-group" data-field="healthConcerns">
        <label className="form-label" htmlFor="healthConcernsInput">
          Any Health Related Concerns? (Please put N/A if not applicable){" "}
          <span className="rf-required">*</span>
        </label>
        <textarea
          id="healthConcernsInput"
          className="form-textarea"
          value={healthConcerns}
          onChange={(e) => {
            setHealthConcerns(e.target.value);
            validateField("healthConcerns", e.target.value, (value) => ({
              valid: Boolean(value?.trim()),
              error: value?.trim()
                ? null
                : "This field is required (put N/A if not applicable)",
            }));
          }}
          placeholder="e.g., N/A, Asthma, Allergies, or medical maintenance details"
          maxLength={500}
          style={{
            border: fieldErrors.healthConcerns
              ? "1.5px solid var(--danger)"
              : errBorder(showValidationErrors, healthConcerns),
          }}
          aria-invalid={Boolean(fieldErrors.healthConcerns || (showValidationErrors && !healthConcerns))}
        />

        {/* Quick Suggestion button for N/A */}
        {!healthConcerns && (
          <div className="rf-suggestion-row">
            <button
              type="button"
              className="rf-suggestion-chip"
              onClick={handleSetHealthNa}
            >
              + None (Set "N/A")
            </button>
          </div>
        )}

        <div className="rf-char-counter">
          {healthConcerns?.length || 0}/500
        </div>
        <FieldError
          error={
            showValidationErrors && !healthConcerns
              ? "This field is required (put N/A if not applicable)"
              : fieldErrors.healthConcerns
          }
        />
      </div>
    </>
  );
};

const FieldError = ({ error }) => {
  if (!error) return null;
  return <div className="rf-field-error">{error}</div>;
};

export default EmergencyContactSection;
