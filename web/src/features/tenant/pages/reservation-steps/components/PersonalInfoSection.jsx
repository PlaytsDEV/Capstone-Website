import React, { useEffect, useMemo, useRef, useState } from "react";
import FileUploadField from "./FileUploadField";
import AddressCascadeFields from "./AddressCascadeFields";
import PhoneInput from "../../../../../shared/components/PhoneInput";
<<<<<<< HEAD
import { validateBirthday } from "../../../utils/reservationValidation";
=======
import {
 validateBirthday,
 validateNameField,
 validatePHPhoneLocal,
} from "../../../utils/reservationValidation";
import { hasBlockingPrecheck } from "../../../utils/documentPrecheckUtils";
>>>>>>> main

const errBorder = (show, value) =>
  show && !value ? "1.5px solid #dc2626" : undefined;

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const pad2 = (value) => String(value).padStart(2, "0");

const parseDateParts = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1], month: match[2], day: match[3] };
};

const getDaysInMonth = (year, month) => {
  const numericMonth = Number(month);
  if (!numericMonth) return 31;
  const numericYear = Number(year) || 2000;
  return new Date(numericYear, numericMonth, 0).getDate();
};

const composeDate = ({ year, month, day }) => {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
};

const buildYearOptions = (min, max) => {
  const minYear = Number(String(min || "").slice(0, 4));
  const maxYear = Number(String(max || "").slice(0, 4));
  if (!Number.isFinite(minYear) || !Number.isFinite(maxYear)) return [];
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) =>
    String(maxYear - index),
  );
};

/**
 * Section 2: Personal Information — names, phone, birthday, marital status,
 * nationality, education, address fields (PSGC cascading), ID uploads, NBI, notes.
 */
const PersonalInfoSection = ({
<<<<<<< HEAD
  lastName,
  setLastName,
  firstName,
  setFirstName,
  middleName,
  setMiddleName,
  nickname,
  setNickname,
  mobileNumber,
  setMobileNumber,
  birthday,
  setBirthday,
  gender,
  setGender,
  maritalStatus,
  setMaritalStatus,
  nationality,
  setNationality,
  educationLevel,
  setEducationLevel,
  addressUnitHouseNo,
  setAddressUnitHouseNo,
  addressStreet,
  setAddressStreet,
  addressRegion,
  setAddressRegion,
  addressBarangay,
  setAddressBarangay,
  addressCity,
  setAddressCity,
  addressProvince,
  setAddressProvince,
  validIDFront,
  setValidIDFront,
  validIDBack,
  setValidIDBack,
  validIDType,
  setValidIDType,
  nbiClearance,
  setNbiClearance,
  nbiReason,
  setNbiReason,
  personalNotes,
  setPersonalNotes,
  handleNameInput,
  handlePhoneInput,
  handleGeneralInput,
  validateField,
  fieldErrors,
  birthdayMin,
  birthdayMax,
  showValidationErrors,
}) => (
  <>
    {/* Names */}
    <div className="form-row">
      <NameField
        label="Last Name"
        value={lastName}
        setter={setLastName}
        fieldKey="lastName"
        handler={handleNameInput}
        validate={validateField}
        errors={fieldErrors}
        required
        showValidationErrors={showValidationErrors}
      />
      <NameField
        label="First Name"
        value={firstName}
        setter={setFirstName}
        fieldKey="firstName"
        handler={handleNameInput}
        validate={validateField}
        errors={fieldErrors}
        required
        showValidationErrors={showValidationErrors}
      />
    </div>
    <div className="form-row">
      <NameField
        label="Middle Name"
        value={middleName}
        setter={setMiddleName}
        fieldKey="middleName"
        handler={handleNameInput}
        validate={validateField}
        errors={fieldErrors}
        optional
        showValidationErrors={showValidationErrors}
      />
      <NameField
        label="Nickname"
        value={nickname}
        setter={setNickname}
        fieldKey="nickname"
        handler={handleNameInput}
        validate={validateField}
        errors={fieldErrors}
      />
    </div>

    {/* Phone & Birthday */}
    <div className="form-row">
      <div className="form-group" data-field="mobileNumber">
        <label className="form-label">
          Mobile Number <span className="rf-required">*</span>
        </label>
        <PhoneInput
          value={mobileNumber}
          onChange={(e164) => setMobileNumber(e164)}
          onBlur={() =>
            validateField("mobileNumber", mobileNumber, (value) => {
              const valid = /^\+\d{10,15}$/.test(value || "");
              return {
                valid,
                error: valid ? null : "Please enter a valid mobile number",
              };
            })
          }
          hasError={showValidationErrors && !mobileNumber}
          required
        />
        <FieldError
          error={
            showValidationErrors && !mobileNumber
              ? "Mobile number is required"
              : fieldErrors.mobileNumber
          }
        />
      </div>
      <BirthdaySelectField
        birthday={birthday}
        setBirthday={setBirthday}
        birthdayMin={birthdayMin}
        birthdayMax={birthdayMax}
        validateField={validateField}
        fieldErrors={fieldErrors}
        showValidationErrors={showValidationErrors}
      />
    </div>

    {/* Gender / Marital */}
    <div className="form-row">
      <div className="form-group" data-field="gender">
        <label className="form-label">
          Gender <span className="rf-required">*</span>
        </label>
        <select
          className="form-select"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          style={{ border: errBorder(showValidationErrors, gender) }}
        >
          <option value="">Select gender...</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
        <FieldError
          error={
            showValidationErrors && !gender ? "Gender is required" : null
          }
        />
      </div>
      <div className="form-group" data-field="maritalStatus">
        <label className="form-label">
          Marital Status <span className="rf-required">*</span>
        </label>
        <select
          className="form-select"
          value={maritalStatus}
          onChange={(e) => setMaritalStatus(e.target.value)}
          style={{ border: errBorder(showValidationErrors, maritalStatus) }}
        >
          <option value="">Select status...</option>
          <option value="single">Single</option>
          <option value="married">Married</option>
          <option value="other">Other</option>
        </select>
        <FieldError
          error={
            showValidationErrors && !maritalStatus
              ? "Marital status is required"
              : null
          }
        />
      </div>
    </div>

    {/* Nationality / Education */}
    <div className="form-row">
      <div className="form-group" data-field="nationality">
        <label className="form-label">
          Nationality <span className="rf-required">*</span>
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g., Filipino"
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          onBlur={() =>
            validateField("nationality", nationality, (v) => ({
              valid: Boolean(v?.trim()),
              error: v?.trim() ? null : "Nationality is required",
            }))
          }
          style={{ border: errBorder(showValidationErrors, nationality) }}
        />
        <FieldError
          error={
            showValidationErrors && !nationality
              ? "Nationality is required"
              : fieldErrors.nationality
          }
        />
      </div>
      <div className="form-group" data-field="educationLevel">
      <label className="form-label">
        Educational Attainment <span className="rf-required">*</span>
      </label>
      <select
        className="form-select"
        value={educationLevel}
        onChange={(e) => setEducationLevel(e.target.value)}
        style={{ border: errBorder(showValidationErrors, educationLevel) }}
      >
        <option value="">Select level...</option>
        <option value="highschool">High School</option>
        <option value="college">College</option>
        <option value="vocational">Vocational</option>
        <option value="graduate">Graduate</option>
      </select>
      <FieldError
        error={
          showValidationErrors && !educationLevel
            ? "Education level is required"
            : null
        }
      />
      </div>
    </div>
=======
 lastName, setLastName, firstName, setFirstName,
 middleName, setMiddleName, nickname, setNickname,
 mobileNumber, setMobileNumber, birthday, setBirthday,
 maritalStatus, setMaritalStatus, nationality, setNationality,
 educationLevel, setEducationLevel,
 addressUnitHouseNo, setAddressUnitHouseNo,
 addressStreet, setAddressStreet,
 addressRegion, setAddressRegion,
 addressBarangay, setAddressBarangay,
 addressCity, setAddressCity,
 addressProvince, setAddressProvince,
 validIDFront, setValidIDFront,
 validIDBack, setValidIDBack,
 validIDType, setValidIDType,
 documentPrechecks,
 runningDocumentChecks,
 onRunDocumentPrecheck,
 nbiClearance, setNbiClearance,
 nbiReason, setNbiReason,
 personalNotes, setPersonalNotes,
 handleNameInput, handlePhoneInput, handleGeneralInput,
 validateField, fieldErrors, clearFieldError,
 birthdayMin, birthdayMax,
 showValidationErrors,
}) => (
 <>
 {/* Names */}
 <div className="form-row">
 <NameField
 label="Last Name" value={lastName} setter={setLastName}
 fieldKey="lastName" handler={handleNameInput}
 validate={validateField} errors={fieldErrors}
 required showValidationErrors={showValidationErrors}
 />
 <NameField
 label="First Name" value={firstName} setter={setFirstName}
 fieldKey="firstName" handler={handleNameInput}
 validate={validateField} errors={fieldErrors}
 required showValidationErrors={showValidationErrors}
 />
 </div>
 <div className="form-row">
 <NameField
 label="Middle Name" value={middleName} setter={setMiddleName}
 fieldKey="middleName" handler={handleNameInput}
 validate={validateField} errors={fieldErrors}
 clearFieldError={clearFieldError}
 showValidationErrors={showValidationErrors}
 />
 <NameField
 label="Nickname" value={nickname} setter={setNickname}
 fieldKey="nickname" handler={handleNameInput}
 validate={validateField} errors={fieldErrors}
 />
 </div>

 {/* Phone & Birthday */}
 <div className="form-row">
 <div className="form-group" data-field="mobileNumber">
 <label className="form-label">
 Mobile Number <span className="rf-required">*</span>
 </label>
 <PhoneInput
 value={mobileNumber}
 onChange={(e164) => {
 setMobileNumber(e164);
 validateField("mobileNumber", e164, validatePHPhoneLocal);
 }}
 onBlur={() =>
 validateField("mobileNumber", mobileNumber, validatePHPhoneLocal)
 }
 hasError={Boolean(fieldErrors.mobileNumber) || (showValidationErrors && !mobileNumber)}
 required
 />
 <FieldError
 error={
 showValidationErrors && !mobileNumber
 ? "Mobile number is required"
 : fieldErrors.mobileNumber
 }
 />
 </div>
 <div className="form-group" data-field="birthday">
 <label className="form-label">
 Birthday <span className="rf-required">*</span>
 </label>
 <input
 type="date"
 className="form-input"
 value={birthday}
 min={birthdayMin}
 max={birthdayMax}
 onChange={(e) => {
 setBirthday(e.target.value);
 validateField("birthday", e.target.value, validateBirthday);
 }}
 style={{
 cursor: "pointer",
 border: fieldErrors.birthday
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, birthday),
 }}
 />
 <FieldError error={showValidationErrors && !birthday ? "Birthday is required" : fieldErrors.birthday} />
 </div>
 </div>

 {/* Marital / Nationality */}
 <div className="form-row">
 <div className="form-group" data-field="maritalStatus">
 <label className="form-label">
 Marital Status <span className="rf-required">*</span>
 </label>
 <select
 className="form-select"
 value={maritalStatus}
 onChange={(e) => {
 setMaritalStatus(e.target.value);
 validateField("maritalStatus", e.target.value, (value) => ({
 valid: Boolean(value),
 error: value ? null : "Marital status is required",
 }));
 }}
 style={{
 border: fieldErrors.maritalStatus
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, maritalStatus),
 }}
 >
 <option value="">Select status...</option>
 <option value="single">Single</option>
 <option value="married">Married</option>
 <option value="other">Other</option>
 </select>
 <FieldError
 error={
 showValidationErrors && !maritalStatus
 ? "Marital status is required"
 : fieldErrors.maritalStatus
 }
 />
 </div>
 <div className="form-group" data-field="nationality">
 <label className="form-label">
 Nationality <span className="rf-required">*</span>
 </label>
 <input
 type="text"
 className="form-input"
 placeholder="e.g., Filipino"
 value={nationality}
 onChange={(e) => {
 setNationality(e.target.value);
 validateField("nationality", e.target.value, (v) => ({
 valid: Boolean(v?.trim()),
 error: v?.trim() ? null : "Nationality is required",
 }));
 }}
 onBlur={() =>
 validateField("nationality", nationality, (v) => ({
 valid: Boolean(v?.trim()),
 error: v?.trim() ? null : "Nationality is required",
 }))
 }
 style={{
 border: fieldErrors.nationality
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, nationality),
 }}
 />
 <FieldError error={showValidationErrors && !nationality ? "Nationality is required" : fieldErrors.nationality} />
 </div>
 </div>

 {/* Education */}
 <div className="form-group" data-field="educationLevel">
 <label className="form-label">
 Educational Attainment <span className="rf-required">*</span>
 </label>
 <select
 className="form-select"
 value={educationLevel}
 onChange={(e) => {
 setEducationLevel(e.target.value);
 validateField("educationLevel", e.target.value, (value) => ({
 valid: Boolean(value),
 error: value ? null : "Education level is required",
 }));
 }}
 style={{
 border: fieldErrors.educationLevel
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, educationLevel),
 }}
 >
 <option value="">Select level...</option>
 <option value="highschool">High School</option>
 <option value="college">College</option>
 <option value="vocational">Vocational</option>
 <option value="graduate">Graduate</option>
 </select>
 <FieldError
 error={
 showValidationErrors && !educationLevel
 ? "Education level is required"
 : fieldErrors.educationLevel
 }
 />
 </div>
>>>>>>> main

    {/* ── Permanent Address (PSGC Cascading Dropdowns) ──────── */}
    <div className="rf-address-heading-wrap">
      <h4 className="rf-address-heading">Permanent Address</h4>
      <p className="rf-address-hint">
        Select your region first — province, city, and barangay will load
        automatically.
      </p>
    </div>

    <AddressCascadeFields
      addressUnitHouseNo={addressUnitHouseNo}
      setAddressUnitHouseNo={setAddressUnitHouseNo}
      addressStreet={addressStreet}
      setAddressStreet={setAddressStreet}
      addressRegion={addressRegion}
      setAddressRegion={setAddressRegion}
      addressBarangay={addressBarangay}
      setAddressBarangay={setAddressBarangay}
      addressCity={addressCity}
      setAddressCity={setAddressCity}
      addressProvince={addressProvince}
      setAddressProvince={setAddressProvince}
      handleGeneralInput={handleGeneralInput}
      validateField={validateField}
      fieldErrors={fieldErrors}
      showValidationErrors={showValidationErrors}
    />

<<<<<<< HEAD
    {/* ID & document uploads */}
    <div className="form-group" data-field="validIDType">
      <label className="form-label">
        ID Type <span className="rf-required">*</span>
      </label>
      <select
        className="form-select"
        value={validIDType}
        onChange={(e) => setValidIDType(e.target.value)}
        style={{ border: errBorder(showValidationErrors, validIDType) }}
      >
        <option value="">Select ID type...</option>
        <option value="national_id">National ID</option>
        <option value="drivers_license">Driver's License</option>
        <option value="passport">Passport</option>
        <option value="sss_id">SSS ID</option>
        <option value="umid">UMID</option>
        <option value="school_id">School ID</option>
        <option value="other">Other Government-issued ID</option>
      </select>
      <FieldError
        error={
          showValidationErrors && !validIDType ? "ID type is required" : null
        }
      />
    </div>

    <div data-field="validIDFront">
      <FileUploadField
        label="Valid ID (Front)"
        value={validIDFront}
        onChange={setValidIDFront}
        hint="Government-issued ID (Front side)"
        hasError={showValidationErrors && !validIDFront}
        required
      />
    </div>
    <div data-field="validIDBack">
      <FileUploadField
        label="Valid ID (Back)"
        value={validIDBack}
        onChange={setValidIDBack}
        hint="Government-issued ID (Back side)"
        hasError={showValidationErrors && !validIDBack}
        required
      />
    </div>

    <div data-field="nbiClearance">
      <FileUploadField
        label="NBI Clearance (If unable, upload another valid ID)"
        value={nbiClearance}
        onChange={setNbiClearance}
        hint="NBI Clearance or additional valid ID"
        hasError={showValidationErrors && !nbiClearance && !nbiReason}
      />
    </div>
=======
 {/* ID & document uploads */}
 <div className="form-group" data-field="validIDType">
 <label className="form-label">
 ID Type <span className="rf-required">*</span>
 </label>
 <select
 className="form-select"
 value={validIDType}
 onChange={(e) => {
 const nextValue = e.target.value;
 setValidIDType(nextValue);
 validateField("validIDType", nextValue, (value) => ({
 valid: Boolean(value),
 error: value ? null : "ID type is required",
 }));
 if (typeof validIDFront === "string" && onRunDocumentPrecheck) {
 onRunDocumentPrecheck({
 documentType: "valid_id_front",
 documentUrl: validIDFront,
 idType: nextValue,
 });
 }
 if (typeof validIDBack === "string" && onRunDocumentPrecheck) {
 onRunDocumentPrecheck({
 documentType: "valid_id_back",
 documentUrl: validIDBack,
 idType: nextValue,
 });
 }
 }}
 style={{
 border: fieldErrors.validIDType
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, validIDType),
 }}
 >
 <option value="">Select ID type...</option>
 <option value="national_id">National ID</option>
 <option value="drivers_license">Driver's License</option>
 <option value="passport">Passport</option>
 <option value="sss_id">SSS ID</option>
 <option value="umid">UMID</option>
 <option value="school_id">School ID</option>
 <option value="other">Other Government-issued ID</option>
 </select>
 <FieldError
 error={
 showValidationErrors && !validIDType ? "ID type is required" : fieldErrors.validIDType
 }
 />
 </div>

 <div data-field="validIDFront">
 <FileUploadField
 label="Valid ID (Front)"
 value={validIDFront}
 onChange={setValidIDFront}
 documentType="valid-id-front"
 onUploadComplete={(documentUrl) => {
 if (!validIDType) return Promise.resolve(null);
 return onRunDocumentPrecheck?.({
 documentType: "valid_id_front",
 documentUrl,
 idType: validIDType,
 });
 }}
 aiCheck={documentPrechecks?.validIDFront}
 isChecking={Boolean(runningDocumentChecks?.validIDFront)}
 hint="Government-issued ID (Front side)"
 hasError={
 showValidationErrors &&
 (!validIDFront || hasBlockingPrecheck(documentPrechecks?.validIDFront))
 }
 required
 />
 </div>
 <div data-field="validIDBack">
 <FileUploadField
 label="Valid ID (Back)"
 value={validIDBack}
 onChange={setValidIDBack}
 documentType="valid-id-back"
 onUploadComplete={(documentUrl) => {
 if (!validIDType) return Promise.resolve(null);
 return onRunDocumentPrecheck?.({
 documentType: "valid_id_back",
 documentUrl,
 idType: validIDType,
 });
 }}
 aiCheck={documentPrechecks?.validIDBack}
 isChecking={Boolean(runningDocumentChecks?.validIDBack)}
 hint="Government-issued ID (Back side)"
 hasError={
 showValidationErrors &&
 (!validIDBack || hasBlockingPrecheck(documentPrechecks?.validIDBack))
 }
 required
 />
 </div>

 <div data-field="nbiClearance">
 <FileUploadField
 label="NBI Clearance (If unable, upload another valid ID)"
 value={nbiClearance}
 onChange={setNbiClearance}
 documentType="nbi-clearance"
 onUploadComplete={(documentUrl) =>
 onRunDocumentPrecheck?.({
 documentType: "nbi_clearance",
 documentUrl,
 })
 }
 aiCheck={documentPrechecks?.nbiClearance}
 isChecking={Boolean(runningDocumentChecks?.nbiClearance)}
 hint="NBI Clearance or additional valid ID"
 hasError={
 showValidationErrors &&
 ((!nbiClearance && !nbiReason) ||
 (Boolean(nbiClearance) && hasBlockingPrecheck(documentPrechecks?.nbiClearance)))
 }
 />
 </div>
>>>>>>> main

    <div className="form-group" data-field="nbiReason">
      <label className="form-label">
        If not yet available, please indicate reason below{" "}
        <span className="rf-required">*</span>
      </label>
      <textarea
        className="form-textarea"
        value={nbiReason}
        onChange={(e) => setNbiReason(e.target.value)}
        placeholder="N/A if NBI Clearance has been submitted"
        style={{
          border: !nbiClearance
            ? errBorder(showValidationErrors, nbiReason)
            : undefined,
        }}
      />
      {showValidationErrors && !nbiClearance && !nbiReason && (
        <FieldError error="Please upload NBI Clearance or provide a reason" />
      )}
    </div>

    {/* Notes */}
    <div className="form-group">
      <label className="form-label">
        Other Notes (Only for corporate accounts)
      </label>
      <textarea
        className="form-textarea"
        value={personalNotes}
        onChange={(e) => setPersonalNotes(e.target.value)}
        maxLength={500}
      />
    </div>
  </>
);

// ─── Shared sub-components ───────────────────────────────────

const FieldError = ({ error }) => {
  if (!error) return null;
  return <div className="rf-field-error">{error}</div>;
};

const BirthdaySelectField = ({
  birthday,
  setBirthday,
  birthdayMin,
  birthdayMax,
  validateField,
  fieldErrors,
  showValidationErrors,
}) => {
  const [parts, setParts] = useState(() => parseDateParts(birthday));
  const lastEmittedValue = useRef(birthday || "");
  const yearOptions = useMemo(
    () => buildYearOptions(birthdayMin, birthdayMax),
    [birthdayMin, birthdayMax],
  );
  const maxDay = getDaysInMonth(parts.year, parts.month);
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, index) => pad2(index + 1)),
    [maxDay],
  );
  const hasError = (showValidationErrors && !birthday) || fieldErrors.birthday;

  useEffect(() => {
    if ((birthday || "") === lastEmittedValue.current) return;
    setParts(parseDateParts(birthday));
  }, [birthday]);

  const handlePartChange = (field, value) => {
    const next = { ...parts, [field]: value };
    const nextMaxDay = getDaysInMonth(next.year, next.month);

    if (Number(next.day) > nextMaxDay) {
      next.day = "";
    }

    setParts(next);

    const nextBirthday = composeDate(next);
    lastEmittedValue.current = nextBirthday;
    setBirthday(nextBirthday);

    if (nextBirthday) {
      validateField("birthday", nextBirthday, validateBirthday);
    } else {
      validateField("birthday", "", () => ({ valid: true, error: null }));
    }
  };

  return (
    <div className="form-group" data-field="birthday">
      <label className="form-label">
        Birthday <span className="rf-required">*</span>
      </label>
      <div
        className={`rf-date-part-row${hasError ? " rf-date-part-row--error" : ""}`}
      >
        <select
          className="form-select rf-date-part-select rf-date-part-select--month"
          value={parts.month}
          onChange={(e) => handlePartChange("month", e.target.value)}
          aria-label="Birth month"
        >
          <option value="">Month</option>
          {MONTH_OPTIONS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          className="form-select rf-date-part-select"
          value={parts.day}
          onChange={(e) => handlePartChange("day", e.target.value)}
          aria-label="Birth day"
        >
          <option value="">Day</option>
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {Number(day)}
            </option>
          ))}
        </select>
        <select
          className="form-select rf-date-part-select"
          value={parts.year}
          onChange={(e) => handlePartChange("year", e.target.value)}
          aria-label="Birth year"
        >
          <option value="">Year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <div className="form-helper">Applicant must be at least 18 years old</div>
      <FieldError
        error={
          showValidationErrors && !birthday
            ? "Birthday is required"
            : fieldErrors.birthday
        }
      />
    </div>
  );
};

const NameField = ({
<<<<<<< HEAD
  label,
  value,
  setter,
  fieldKey,
  handler,
  validate,
  errors,
  required,
  optional,
  showValidationErrors,
}) => (
  <div className="form-group" data-field={fieldKey}>
    <label className="form-label">
      {label} {required && <span className="rf-required">*</span>}
      {optional && <span className="rf-optional-label">(Optional)</span>}
    </label>
    <input
      type="text"
      className="form-input"
      placeholder={label}
      maxLength={32}
      value={value}
      onChange={(e) => handler(e.target.value, setter)}
      onBlur={() =>
        validate(fieldKey, value, (v) => {
          const trimmed = String(v || "").trim();
          if (!required && !trimmed) {
            return { valid: true, error: null };
          }
          const valid = trimmed.length >= 2;
          return {
            valid,
            error: valid ? null : `${label} must be at least 2 characters`,
          };
        })
      }
      style={{
        border:
          (showValidationErrors && required && !value) || errors[fieldKey]
            ? "1.5px solid #dc2626"
            : undefined,
      }}
    />
    <FieldError
      error={
        showValidationErrors && required && !value
          ? `${label} is required`
          : errors[fieldKey]
      }
    />
  </div>
=======
 label, value, setter, fieldKey, handler,
 validate, errors, required, showValidationErrors, clearFieldError,
}) => (
 <div className="form-group" data-field={required ? fieldKey : undefined}>
 <label className="form-label">
 {label} {required && <span className="rf-required">*</span>}
 </label>
 <input
 type="text"
 className="form-input"
 placeholder={label}
 maxLength={32}
 value={value}
 onChange={(e) => {
 const nextValue = e.target.value;
 handler(nextValue, setter);
 if (!required && !nextValue.trim()) {
 clearFieldError?.(fieldKey);
 return;
 }
 validate(fieldKey, nextValue, validateNameField);
 }}
 onBlur={() =>
 required || value?.trim()
 ? validate(fieldKey, value, validateNameField)
 : clearFieldError?.(fieldKey)
 }
 style={{
 border: errors[fieldKey]
 ? "1.5px solid #dc2626"
 : required
 ? errBorder(showValidationErrors, value)
 : undefined,
 }}
 />
 <FieldError
 error={
 showValidationErrors && required && !value
 ? `${label} is required`
 : errors[fieldKey]
 }
 />
 </div>
>>>>>>> main
);

export default PersonalInfoSection;
