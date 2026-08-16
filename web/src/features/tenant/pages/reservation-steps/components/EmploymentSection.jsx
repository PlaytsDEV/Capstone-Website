import React from "react";
import FileUploadField from "./FileUploadField";
import { validatePHPhoneOrLandline } from "../../../utils/reservationValidation";

const errBorder = (show, value) =>
  show && !value ? "1.5px solid var(--danger)" : undefined;

const EMPLOYER_CONTACT_MAX_LENGTH = 13;

const POPULAR_OCCUPATIONS = [
  "Student",
  "Software Engineer / Developer",
  "Call Center / BPO Associate",
  "Nurse / Healthcare Worker",
  "Accountant / Financial Analyst",
  "Teacher / Academic Instructor",
  "Marketing / Sales Specialist",
  "Administrative / Office Staff",
  "Freelancer / Virtual Assistant",
  "Government Employee",
];

const openDatePicker = (event) => {
  event.currentTarget.showPicker?.();
};

/**
 * Section 4: Employment / School — employer info, occupation, company ID.
 */
const EmploymentSection = ({
  employerSchool,
  setEmployerSchool,
  employerAddress,
  setEmployerAddress,
  employerContact,
  setEmployerContact,
  startDate,
  setStartDate,
  occupation,
  setOccupation,
  previousEmployment,
  setPreviousEmployment,
  companyID,
  setCompanyID,
  companyIDReason,
  setCompanyIDReason,
  documentPrechecks,
  runningDocumentChecks,
  onRunDocumentPrecheck,
  handleGeneralInput,
  validateField,
  fieldErrors,
  clearFieldError,
  showValidationErrors,
}) => {
  const handleSelectOccupationSuggestion = (item) => {
    handleGeneralInput(item, setOccupation, 100);
    validateField("occupation", item, (value) => ({
      valid: Boolean(value?.trim()),
      error: value?.trim() ? null : "Occupation is required",
    }));
  };

  return (
    <>
      <div className="section-helper">
        If not currently employed, please enter N/A. For students, please enter your school or university name.
      </div>

      <datalist id="occupation-suggestions">
        {POPULAR_OCCUPATIONS.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      <div className="form-group" data-field="employerSchool">
        <label className="form-label" htmlFor="employerSchoolInput">
          Current Employer / School Name <span className="rf-required">*</span>
        </label>
        <input
          id="employerSchoolInput"
          type="text"
          name="organization"
          autoComplete="organization"
          className="form-input"
          placeholder="Company or School name"
          value={employerSchool}
          maxLength={100}
          onChange={(e) => {
            handleGeneralInput(e.target.value, setEmployerSchool, 100);
            validateField("employerSchool", e.target.value, (value) => ({
              valid: Boolean(value?.trim()),
              error: value?.trim() ? null : "Employer / school name is required",
            }));
          }}
          style={{
            border: fieldErrors.employerSchool
              ? "1.5px solid var(--danger)"
              : errBorder(showValidationErrors, employerSchool),
          }}
          aria-invalid={Boolean(fieldErrors.employerSchool || (showValidationErrors && !employerSchool))}
        />
        <div className="rf-char-counter">
          {employerSchool?.length || 0}/100
        </div>
        <FieldError
          error={
            showValidationErrors && !employerSchool
              ? "Employer / school name is required"
              : fieldErrors.employerSchool
          }
        />
      </div>

      <div className="form-group" data-field="employerAddress">
        <label className="form-label" htmlFor="employerAddressInput">
          Employer's / School Address <span className="rf-required">*</span>
        </label>
        <textarea
          id="employerAddressInput"
          name="street-address"
          autoComplete="street-address"
          className="form-textarea"
          placeholder="Full workplace or campus address"
          value={employerAddress}
          maxLength={100}
          onChange={(e) => {
            handleGeneralInput(e.target.value, setEmployerAddress, 100);
            validateField("employerAddress", e.target.value, (value) => ({
              valid: Boolean(value?.trim()),
              error: value?.trim() ? null : "Employer address is required",
            }));
          }}
          style={{
            resize: "vertical",
            border: fieldErrors.employerAddress
              ? "1.5px solid var(--danger)"
              : errBorder(showValidationErrors, employerAddress),
          }}
          aria-invalid={Boolean(fieldErrors.employerAddress || (showValidationErrors && !employerAddress))}
        />
        <div className="rf-char-counter">
          {employerAddress?.length || 0}/100
        </div>
        <FieldError
          error={
            showValidationErrors && !employerAddress
              ? "Employer address is required"
              : fieldErrors.employerAddress
          }
        />
      </div>

      <div className="form-group" data-field="employerContact">
        <label className="form-label" htmlFor="employerContactInput">
          Employer's Contact Number{" "}
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)", fontWeight: 400 }}>
            (optional)
          </span>
        </label>
        <input
          id="employerContactInput"
          type="tel"
          name="tel"
          autoComplete="tel"
          inputMode="tel"
          className="form-input"
          placeholder="09XXXXXXXXX or 02-XXXXXXXX"
          value={employerContact}
          maxLength={EMPLOYER_CONTACT_MAX_LENGTH}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9\s\-()+]/g, "");
            setEmployerContact(cleaned.slice(0, EMPLOYER_CONTACT_MAX_LENGTH));
          }}
          style={{
            border: fieldErrors.employerContact
              ? "1.5px solid var(--danger)"
              : showValidationErrors && employerContact && !validatePHPhoneOrLandline(employerContact)
              ? "1.5px solid var(--danger)"
              : undefined,
          }}
          aria-invalid={Boolean(fieldErrors.employerContact || (showValidationErrors && employerContact && !validatePHPhoneOrLandline(employerContact)))}
        />
        <FieldError
          error={
            showValidationErrors && employerContact && !validatePHPhoneOrLandline(employerContact)
              ? "Enter a valid phone number (e.g. 09123456789 or 02-1234567)"
              : fieldErrors.employerContact
          }
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="startDateInput">
          Employed / Enrolled Since <span className="rf-optional-label">(Optional)</span>
        </label>
        <input
          id="startDateInput"
          type="date"
          className="form-input"
          value={startDate}
          onClick={openDatePicker}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ cursor: "pointer" }}
        />
      </div>

      <div className="form-group" data-field="occupation">
        <label className="form-label" htmlFor="occupationInput">
          Occupation / Job Description / Course <span className="rf-required">*</span>
        </label>
        <input
          id="occupationInput"
          type="text"
          name="organization-title"
          autoComplete="organization-title"
          list="occupation-suggestions"
          className="form-input"
          placeholder="e.g., Software Engineer, Student (BS IT), Nurse"
          value={occupation}
          maxLength={100}
          onChange={(e) => {
            handleGeneralInput(e.target.value, setOccupation, 100);
            validateField("occupation", e.target.value, (value) => ({
              valid: Boolean(value?.trim()),
              error: value?.trim() ? null : "Occupation is required",
            }));
          }}
          style={{
            border: fieldErrors.occupation
              ? "1.5px solid var(--danger)"
              : errBorder(showValidationErrors, occupation),
          }}
          aria-invalid={Boolean(fieldErrors.occupation || (showValidationErrors && !occupation))}
        />

        {/* Quick Suggestion Chips */}
        {!occupation && (
          <div className="rf-suggestion-row">
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Suggestions:</span>
            {["Student", "Software Engineer", "Call Center / BPO", "Nurse", "Accountant"].map((role) => (
              <button
                key={role}
                type="button"
                className="rf-suggestion-chip"
                onClick={() => handleSelectOccupationSuggestion(role)}
              >
                + {role}
              </button>
            ))}
          </div>
        )}

        <div className="rf-char-counter">
          {occupation?.length || 0}/100
        </div>
        <FieldError
          error={
            showValidationErrors && !occupation
              ? "Occupation is required"
              : fieldErrors.occupation
          }
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="previousEmploymentInput">
          Previous Employment <span className="rf-optional-label">(Optional)</span>
        </label>
        <textarea
          id="previousEmploymentInput"
          className="form-textarea"
          placeholder="(Optional) Previous work experience or prior company"
          value={previousEmployment}
          maxLength={100}
          onChange={(e) =>
            handleGeneralInput(e.target.value, setPreviousEmployment, 100)
          }
          style={{ resize: "vertical" }}
        />
        <div className="rf-char-counter">
          {previousEmployment?.length || 0}/100
        </div>
      </div>

      <div data-field="companyID">
        <FileUploadField
          label="Company ID / School ID"
          value={companyID}
          onChange={setCompanyID}
          documentType="company-id"
          hint="Company ID, Certificate of Employment, or School ID"
          hasError={showValidationErrors && !companyID && !companyIDReason}
        />
      </div>

      <div className="form-group" data-field="companyIDReason">
        <label className="form-label" htmlFor="companyIDReasonInput">
          If not yet available, please indicate reason below{" "}
          {!companyID && <span className="rf-required">*</span>}
        </label>
        <textarea
          id="companyIDReasonInput"
          className="form-textarea"
          value={companyIDReason}
          maxLength={300}
          onChange={(e) => {
            const nextValue = e.target.value;
            setCompanyIDReason(nextValue);
            if (nextValue?.trim()) {
              clearFieldError?.("companyIDReason");
            }
          }}
          placeholder={
            companyID
              ? "Optional (Company ID uploaded)"
              : "Reason why Company or School ID is not yet available"
          }
          style={{
            border: !companyID
              ? errBorder(showValidationErrors, companyIDReason)
              : undefined,
          }}
          aria-invalid={Boolean(showValidationErrors && !companyID && !companyIDReason)}
        />
        <div className="rf-char-counter">
          {companyIDReason?.length || 0}/300
        </div>
        {showValidationErrors && !companyID && !companyIDReason && (
          <FieldError error="Please upload Company ID or provide a reason" />
        )}
      </div>
    </>
  );
};

const FieldError = ({ error }) => {
  if (!error) return null;
  return <div className="rf-field-error">{error}</div>;
};

export default EmploymentSection;
