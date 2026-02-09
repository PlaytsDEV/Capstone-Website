import React, { useState } from "react";
import { TimePicker } from "antd";
import dayjs from "dayjs";
import {
  PoliciesTermsModal,
  PrivacyConsentModal,
} from "../../modals/PoliciesAndConsent";
import {
  validateFullName,
  validatePhoneNumber,
  validateBirthday,
  validateAddress,
  validateUnitHouseNo,
  validateTargetMoveInDate,
  validateEstimatedTime,
  validateGeneralTextField,
  validateNameField,
  validateAddressField,
} from "../../utils/reservationValidation";

// Philippine locations data (simplified - can be expanded)
const REGIONS = [
  "Regionl Autonomous Region in Muslim Mindanao (ARMM)",
  "Bicol Region",
  "Calabarzon",
  "Cavite",
  "Laguna",
  "Quezon",
  "Rizal",
  "NCR - National Capital Region",
  "CAR - Cordillera Administrative Region",
  "Region I - Ilocos",
  "Region II - Cagayan Valley",
  "Region III - Central Luzon",
  "Region IV - Mimaropa",
  "Region V - Bicol",
  "Region VI - Western Visayas",
  "Region VII - Central Visayas",
  "Region VIII - Eastern Visayas",
  "Region IX - Zamboanga Peninsula",
  "Region X - Northern Mindanao",
  "Region XI - Davao",
  "Region XII - Soccsksargen",
];

const CITIES = [
  "Manila",
  "Quezon City",
  "Caloocan",
  "Las Piñas",
  "Makati",
  "Parañaque",
  "Pasay",
  "Pasig",
  "Taguig",
  "Valenzuela",
  "Cebu",
  "Davao",
  "Cagayan de Oro",
  "Bacolod",
  "Iloilo City",
];

const ReservationApplicationStep = ({
  billingEmail,
  selfiePhoto,
  setSelfiePhoto,
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
  nbiClearance,
  setNbiClearance,
  nbiReason,
  setNbiReason,
  personalNotes,
  setPersonalNotes,
  emergencyContactName,
  setEmergencyContactName,
  emergencyRelationship,
  setEmergencyRelationship,
  emergencyContactNumber,
  setEmergencyContactNumber,
  healthConcerns,
  setHealthConcerns,
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
  companyID,
  setCompanyID,
  companyIDReason,
  setCompanyIDReason,
  previousEmployment,
  setPreviousEmployment,
  preferredRoomNumber,
  setPreferredRoomNumber,
  referralSource,
  setReferralSource,
  referrerName,
  setReferrerName,
  targetMoveInDate,
  setTargetMoveInDate,
  estimatedMoveInTime,
  setEstimatedMoveInTime,
  leaseDuration,
  setLeaseDuration,
  workSchedule,
  setWorkSchedule,
  workScheduleOther,
  setWorkScheduleOther,
  agreedToPrivacy,
  setAgreedToPrivacy,
  agreedToCertification,
  setAgreedToCertification,
  devBypassValidation,
  setDevBypassValidation,
  onPrev,
  onNext,
}) => {
  // Modal states
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Input validation handlers
  const handleNameInput = (value, setter) => {
    // Remove numbers from input
    const cleanedValue = value.replace(/\d+/g, "");
    setter(cleanedValue);
  };

  const handlePhoneInput = (value, setter) => {
    // Only allow +63 and digits
    const cleaned = value.replace(/[^0-9+]/g, "");
    // Prevent multiple + signs
    const finalValue = cleaned.includes("+")
      ? "+" + cleaned.replace(/\+/g, "")
      : cleaned;
    setter(finalValue);
  };

  const handleGeneralInput = (value, setter, maxLength = 100) => {
    if (value.length <= maxLength) {
      setter(value);
    }
  };

  const accentColor = "#1f2937";
  const cardBackground = "#f8fafc";
  const cardBorder = "#e5e7eb";
  const canProceed = agreedToPrivacy && agreedToCertification;

  const disableMoveInTime = () => ({
    disabledHours: () =>
      Array.from({ length: 24 }, (_, hour) => hour).filter(
        (hour) => hour < 8 || hour > 18,
      ),
    disabledMinutes: (hour) => {
      if (hour === 18) {
        return Array.from({ length: 60 }, (_, minute) => minute).filter(
          (minute) => minute > 0,
        );
      }
      return [];
    },
  });

  const validateField = (fieldName, value, validator) => {
    const result = validator(value);
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName]: result.error,
    }));
    return result.valid;
  };

  const handleTimeInput = (value) => {
    validateField("estimatedMoveInTime", value, validateEstimatedTime);
    setEstimatedMoveInTime(value);
  };

  const handleTargetDateInput = (value) => {
    validateField("targetMoveInDate", value, validateTargetMoveInDate);
    setTargetMoveInDate(value);
  };

  return (
    <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      <h2 className="stage-title text-2xl font-semibold text-slate-800">
        Complete Your Application
      </h2>
      <p className="stage-subtitle text-sm text-gray-500 mt-1">
        Please provide the following information to complete your registration.
      </p>

      <div className="info-box" style={{ marginBottom: "24px" }}>
        <div className="info-box-title">📋 Required Documents</div>
        <div className="info-text" style={{ marginBottom: "12px" }}>
          Please upload clear, legible images of the following:
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            style={{ fontSize: "12px", color: "#1e3a8a", lineHeight: "1.6" }}
          >
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>
              ✓ 2x2 ID Photo
            </div>
            Clear headshot or selfie
          </div>
          <div
            style={{ fontSize: "12px", color: "#1e3a8a", lineHeight: "1.6" }}
          >
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>
              ✓ Valid ID (Front)
            </div>
            Government-issued ID
          </div>
          <div
            style={{ fontSize: "12px", color: "#1e3a8a", lineHeight: "1.6" }}
          >
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>
              ✓ Valid ID (Back)
            </div>
            Back side of ID
          </div>
          <div
            style={{ fontSize: "12px", color: "#1e3a8a", lineHeight: "1.6" }}
          >
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>
              ✓ NBI Clearance
            </div>
            Latest clearance
          </div>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Email & Photo</h3>
        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input
            type="email"
            className="form-input"
            value={billingEmail}
            disabled
          />
          <div className="form-helper">
            This is where we'll send your billing statements
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">2x2 Photo or Selfie Photo *</label>
          <label className="file-upload" htmlFor="selfie-photo">
            <input
              id="selfie-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setSelfiePhoto(e.target.files?.[0] || null)}
            />
            <div className="file-icon">📷</div>
            <div className="file-text">
              {selfiePhoto
                ? selfiePhoto.name
                : "Upload clear 2x2 or selfie photo"}
            </div>
          </label>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Personal Information</h3>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Last Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Last name (no numbers)"
              maxLength="32"
              value={lastName}
              onChange={(e) => handleNameInput(e.target.value, setLastName)}
              onBlur={() =>
                validateField("lastName", lastName, validateNameField)
              }
              style={{ border: "1.5px solid #999" }}
            />
            {fieldErrors.lastName && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.lastName}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
              32 characters max
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">First Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="First name (no numbers)"
              maxLength="32"
              value={firstName}
              onChange={(e) => handleNameInput(e.target.value, setFirstName)}
              onBlur={() =>
                validateField("firstName", firstName, validateNameField)
              }
              style={{ border: "1.5px solid #999" }}
            />
            {fieldErrors.firstName && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.firstName}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
              32 characters max
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Middle Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Middle name (no numbers)"
              maxLength="32"
              value={middleName}
              onChange={(e) => handleNameInput(e.target.value, setMiddleName)}
              onBlur={() =>
                validateField("middleName", middleName, validateNameField)
              }
              style={{ border: "1.5px solid #999" }}
            />
            {fieldErrors.middleName && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.middleName}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
              32 characters max
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nickname *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nickname (no numbers)"
              maxLength="32"
              value={nickname}
              onChange={(e) => handleNameInput(e.target.value, setNickname)}
              onBlur={() =>
                validateField("nickname", nickname, validateNameField)
              }
              style={{ border: "1.5px solid #999" }}
            />
            {fieldErrors.nickname && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.nickname}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
              32 characters max
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Mobile Number *{" "}
              <span style={{ fontSize: "11px", color: "#666" }}>(+63...)</span>
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder="+63912345678"
              value={mobileNumber}
              onChange={(e) =>
                handlePhoneInput(e.target.value, setMobileNumber)
              }
              onBlur={() =>
                validateField("mobileNumber", mobileNumber, validatePhoneNumber)
              }
            />
            {fieldErrors.mobileNumber && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.mobileNumber}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Birthday *</label>
            <input
              type="date"
              className="form-input"
              value={birthday}
              onChange={(e) => {
                setBirthday(e.target.value);
                validateField("birthday", e.target.value, validateBirthday);
              }}
            />
            {fieldErrors.birthday && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.birthday}
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Marital Status *</label>
            <select
              className="form-select"
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value)}
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Nationality *</label>
            <input
              type="text"
              className="form-input"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Educational Attainment *</label>
          <select
            className="form-select"
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
          >
            <option value="highschool">High School</option>
            <option value="college">College</option>
            <option value="vocational">Vocational</option>
            <option value="graduate">Graduate</option>
          </select>
        </div>

        <fieldset style={{ border: "none", padding: "0 0 20px 0" }}>
          <legend className="form-label">
            Permanent Address: Unit / House No. *
          </legend>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., 123-A"
            maxLength="64"
            value={addressUnitHouseNo}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setAddressUnitHouseNo, 64)
            }
            onBlur={() =>
              validateField(
                "addressUnitHouseNo",
                addressUnitHouseNo,
                validateUnitHouseNo,
              )
            }
            style={{ border: "1.5px solid #999" }}
          />
          {fieldErrors.addressUnitHouseNo && (
            <div
              style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
            >
              {fieldErrors.addressUnitHouseNo}
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            64 characters max
          </div>
        </fieldset>

        <fieldset style={{ border: "none", padding: "0 0 20px 0" }}>
          <legend className="form-label">Permanent Address: Street *</legend>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Rizal Street"
            maxLength="64"
            value={addressStreet}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setAddressStreet, 64)
            }
            onBlur={() =>
              validateField("addressStreet", addressStreet, (v) =>
                validateGeneralTextField(v, 64),
              )
            }
            style={{ border: "1.5px solid #999" }}
          />
          {fieldErrors.addressStreet && (
            <div
              style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
            >
              {fieldErrors.addressStreet}
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            64 characters max
          </div>
        </fieldset>

        <fieldset style={{ border: "none", padding: "0 0 20px 0" }}>
          <legend className="form-label">Permanent Address: Barangay *</legend>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Barangay 1"
            maxLength="32"
            value={addressBarangay}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setAddressBarangay, 32)
            }
            onBlur={() =>
              validateField(
                "addressBarangay",
                addressBarangay,
                validateAddressField,
              )
            }
            style={{ border: "1.5px solid #999" }}
          />
          {fieldErrors.addressBarangay && (
            <div
              style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
            >
              {fieldErrors.addressBarangay}
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            32 characters max
          </div>
        </fieldset>

        <div className="form-row">
          <fieldset style={{ border: "none", padding: "0" }}>
            <legend className="form-label">
              Permanent Address: City or Municipality *
            </legend>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Manila"
              maxLength="32"
              value={addressCity}
              onChange={(e) =>
                handleGeneralInput(e.target.value, setAddressCity, 32)
              }
              onBlur={() =>
                validateField("addressCity", addressCity, validateAddressField)
              }
              style={{ border: "1.5px solid #999" }}
            />
            {fieldErrors.addressCity && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.addressCity}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
              32 characters max
            </div>
          </fieldset>
          <fieldset style={{ border: "none", padding: "0" }}>
            <legend className="form-label">
              Permanent Address: Region / Province *
            </legend>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., NCR"
              maxLength="32"
              value={addressProvince}
              onChange={(e) =>
                handleGeneralInput(e.target.value, setAddressProvince, 32)
              }
              onBlur={() =>
                validateField(
                  "addressProvince",
                  addressProvince,
                  validateAddressField,
                )
              }
              style={{ border: "1.5px solid #999" }}
            />
            {fieldErrors.addressProvince && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.addressProvince}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
              32 characters max
            </div>
          </fieldset>
        </div>

        <div className="form-group">
          <label className="form-label">Valid ID (Front) *</label>
          <label className="file-upload" htmlFor="valid-id-front">
            <input
              id="valid-id-front"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setValidIDFront(e.target.files?.[0] || null)}
            />
            <div className="file-icon">🆔</div>
            <div className="file-text">
              {validIDFront ? validIDFront.name : "Upload Valid ID (Front)"}
            </div>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Valid ID (Back) *</label>
          <label className="file-upload" htmlFor="valid-id-back">
            <input
              id="valid-id-back"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setValidIDBack(e.target.files?.[0] || null)}
            />
            <div className="file-icon">🆔</div>
            <div className="file-text">
              {validIDBack ? validIDBack.name : "Upload Valid ID (Back)"}
            </div>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">
            NBI Clearance (If unable, upload another valid ID) *
          </label>
          <label className="file-upload" htmlFor="nbi-clearance">
            <input
              id="nbi-clearance"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setNbiClearance(e.target.files?.[0] || null)}
            />
            <div className="file-icon">📄</div>
            <div className="file-text">
              {nbiClearance ? nbiClearance.name : "Upload NBI Clearance"}
            </div>
          </label>
          <div className="form-group" style={{ marginTop: "12px" }}>
            <label className="form-label">
              If not yet available, please indicate reason below
            </label>
            <textarea
              className="form-textarea"
              value={nbiReason}
              onChange={(e) => setNbiReason(e.target.value)}
              placeholder="You may also put 'N/A' if already submitted"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Other Notes (Only for corporate accounts)
          </label>
          <textarea
            className="form-textarea"
            value={personalNotes}
            onChange={(e) => setPersonalNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Emergency Contact Information</h3>

        <div className="form-group">
          <label className="form-label">
            Person to Contact in Case of Emergency *
          </label>
          <input
            type="text"
            className="form-input"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Relationship *</label>
            <select
              className="form-select"
              value={emergencyRelationship}
              onChange={(e) => setEmergencyRelationship(e.target.value)}
            >
              <option value="">Select Relationship</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="relative">Relative</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              Contact Number *{" "}
              <span style={{ fontSize: "11px", color: "#666" }}>(+63...)</span>
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder="+63912345678"
              value={emergencyContactNumber}
              onChange={(e) =>
                handlePhoneInput(e.target.value, setEmergencyContactNumber)
              }
              onBlur={() =>
                validateField(
                  "emergencyContactNumber",
                  emergencyContactNumber,
                  validatePhoneNumber,
                )
              }
            />
            {fieldErrors.emergencyContactNumber && (
              <div
                style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
              >
                {fieldErrors.emergencyContactNumber}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Any Health Related Concerns? (Please put N/A if not applicable) *
          </label>
          <textarea
            className="form-textarea"
            value={healthConcerns}
            onChange={(e) => setHealthConcerns(e.target.value)}
            placeholder="N/A or describe any health concerns"
          />
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Employment Information</h3>
        <div className="section-helper">
          If not yet employed, please put N/A. For students, please put name of
          school instead of employer.
        </div>

        <div className="form-group">
          <label className="form-label">Current Employer *</label>
          <input
            type="text"
            className="form-input"
            placeholder="Company or School name"
            value={employerSchool}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setEmployerSchool, 100)
            }
          />
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            100 characters max
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Employer's Address *</label>
          <textarea
            className="form-textarea"
            placeholder="Full address"
            value={employerAddress}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setEmployerAddress, 100)
            }
            style={{ resize: "vertical" }}
          />
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            100 characters max
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Employer's Contact Number *</label>
          <input
            type="tel"
            className="form-input"
            placeholder="+63 or land line"
            value={employerContact}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setEmployerContact, 100)
            }
          />
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            100 characters max
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Employed Since</label>
          <input
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Occupation / Job Description *</label>
          <textarea
            className="form-textarea"
            placeholder="e.g., Software Engineer, Nurse, Currently Job Hunting"
            value={occupation}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setOccupation, 100)
            }
            style={{ resize: "vertical" }}
          />
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            100 characters max
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Previous Employment</label>
          <textarea
            className="form-textarea"
            placeholder="(Optional) Previous work experience"
            value={previousEmployment}
            onChange={(e) =>
              handleGeneralInput(e.target.value, setPreviousEmployment, 100)
            }
            style={{ resize: "vertical" }}
          />
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            100 characters max
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Company ID</label>
          <label className="file-upload" htmlFor="company-id">
            <input
              id="company-id"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setCompanyID(e.target.files?.[0] || null)}
            />
            <div className="file-icon">💼</div>
            <div className="file-text">
              {companyID ? companyID.name : "Upload Company ID"}
            </div>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">
            If not yet available, please indicate reason below *
          </label>
          <textarea
            className="form-textarea"
            value={companyIDReason}
            onChange={(e) => setCompanyIDReason(e.target.value)}
            placeholder="N/A if Company ID has been submitted"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Previous Employment (Please answer N/A if not applicable)
          </label>
          <input
            type="text"
            className="form-input"
            value={previousEmployment}
            onChange={(e) => setPreviousEmployment(e.target.value)}
          />
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Dorm Related Questions</h3>

        <div className="form-group">
          <label className="form-label">
            How Did You First Learn About Lilycrest Gil Puyat?
          </label>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                name="referral"
                id="facebook"
                value="facebook"
                checked={referralSource === "facebook"}
                onChange={(e) => setReferralSource(e.target.value)}
              />
              <label htmlFor="facebook" className="radio-label">
                Facebook Ad
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="referral"
                id="instagram"
                value="instagram"
                checked={referralSource === "instagram"}
                onChange={(e) => setReferralSource(e.target.value)}
              />
              <label htmlFor="instagram" className="radio-label">
                Instagram
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="referral"
                id="tiktok"
                value="tiktok"
                checked={referralSource === "tiktok"}
                onChange={(e) => setReferralSource(e.target.value)}
              />
              <label htmlFor="tiktok" className="radio-label">
                TikTok
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="referral"
                id="walkin"
                value="walkin"
                checked={referralSource === "walkin"}
                onChange={(e) => setReferralSource(e.target.value)}
              />
              <label htmlFor="walkin" className="radio-label">
                Walk-in
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="referral"
                id="friend"
                value="friend"
                checked={referralSource === "friend"}
                onChange={(e) => setReferralSource(e.target.value)}
              />
              <label htmlFor="friend" className="radio-label">
                Referred by a Friend
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="referral"
                id="other"
                value="other"
                checked={referralSource === "other"}
                onChange={(e) => setReferralSource(e.target.value)}
              />
              <label htmlFor="other" className="radio-label">
                Other
              </label>
            </div>
          </div>
        </div>

        {referralSource === "friend" && (
          <div className="form-group">
            <label className="form-label">
              If Personally Referred, Please Indicate the Name
            </label>
            <input
              type="text"
              className="form-input"
              value={referrerName}
              onChange={(e) => setReferrerName(e.target.value)}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            Target Move In Date (within 3 months) *
          </label>
          <input
            type="date"
            className="form-input"
            value={targetMoveInDate}
            onChange={handleTargetDateInput}
          />
          {fieldErrors.targetMoveInDate && (
            <div
              style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
            >
              {fieldErrors.targetMoveInDate}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Estimated Time of Move In (8:00 AM to 6:00 PM) *
          </label>
          <TimePicker
            className="form-input"
            value={
              estimatedMoveInTime ? dayjs(estimatedMoveInTime, "HH:mm") : null
            }
            onChange={(time, timeString) => handleTimeInput(timeString)}
            format="HH:mm"
            placeholder="Select time"
            disabledTime={disableMoveInTime}
            style={{
              width: "100%",
              border: "1.5px solid #999",
              borderRadius: "8px",
            }}
          />
          {fieldErrors.estimatedMoveInTime && (
            <div
              style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}
            >
              {fieldErrors.estimatedMoveInTime}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Duration of Lease *</label>
          <select
            className="form-select"
            value={leaseDuration}
            onChange={(e) => setLeaseDuration(e.target.value)}
          >
            <option value="12">1 year</option>
            <option value="6">6 months</option>
            <option value="5">5 months</option>
            <option value="4">4 months</option>
            <option value="3">3 months</option>
            <option value="2">2 months</option>
            <option value="1">1 month</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Work Schedule *</label>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                name="schedule"
                id="dayshift"
                value="day"
                checked={workSchedule === "day"}
                onChange={(e) => setWorkSchedule(e.target.value)}
              />
              <label htmlFor="dayshift" className="radio-label">
                Day Shift (around 9 am to 5 pm)
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="schedule"
                id="nightshift"
                value="night"
                checked={workSchedule === "night"}
                onChange={(e) => setWorkSchedule(e.target.value)}
              />
              <label htmlFor="nightshift" className="radio-label">
                Night Shift (around 11 pm to 7 am)
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="schedule"
                id="others"
                value="others"
                checked={workSchedule === "others"}
                onChange={(e) => setWorkSchedule(e.target.value)}
              />
              <label htmlFor="others" className="radio-label">
                Others
              </label>
            </div>
          </div>
        </div>

        {workSchedule === "others" && (
          <div className="form-group">
            <label className="form-label">
              If You Answered "Others", Please Specify Your Work Schedule Below
              *
            </label>
            <textarea
              className="form-textarea"
              value={workScheduleOther}
              onChange={(e) => setWorkScheduleOther(e.target.value)}
              placeholder="Please describe your typical work schedule"
            />
          </div>
        )}
      </div>

      <div className="section-group">
        <h3 className="section-header">Agreements & Consent</h3>

        <div
          style={{
            background: cardBackground,
            border: `1px solid ${cardBorder}`,
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: accentColor,
              marginBottom: "8px",
            }}
          >
            Policies & Terms of Service
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              marginBottom: "12px",
            }}
          >
            Review dormitory policies, house rules, and lease terms.
          </div>
          <button
            type="button"
            onClick={() => setShowPoliciesModal(true)}
            style={{
              padding: "8px 16px",
              background: accentColor,
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            View Policies
          </button>
        </div>

        <div
          className="checkbox-group"
          style={{
            background: cardBackground,
            border: `1px solid ${cardBorder}`,
            borderRadius: "8px",
            padding: "14px",
            display: "flex",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <input
            type="checkbox"
            id="privacy-consent"
            checked={agreedToPrivacy}
            onChange={(e) => setAgreedToPrivacy(e.target.checked)}
            style={{ marginTop: "2px", cursor: "pointer" }}
          />
          <label
            htmlFor="privacy-consent"
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <strong>Privacy Policy & Data Protection Consent</strong>{" "}
            <span style={{ color: "#dc2626" }}>*</span>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}
            >
              I consent to the collection and use of my personal data for
              dormitory services.
            </div>
          </label>
        </div>

        <div
          className="checkbox-group"
          style={{
            background: cardBackground,
            border: `1px solid ${cardBorder}`,
            borderRadius: "8px",
            padding: "14px",
            display: "flex",
            gap: "10px",
          }}
        >
          <input
            type="checkbox"
            id="certification"
            checked={agreedToCertification}
            onChange={(e) => setAgreedToCertification(e.target.checked)}
            style={{ marginTop: "2px", cursor: "pointer" }}
          />
          <label
            htmlFor="certification"
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <strong>Information Accuracy Certification</strong>{" "}
            <span style={{ color: "#dc2626" }}>*</span>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}
            >
              I certify all information is true and accurate. False information
              may result in rejection.
            </div>
          </label>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#9ca3af",
            marginTop: "12px",
            fontStyle: "italic",
          }}
        >
          * Required to continue
        </div>
      </div>

      {/* Modals */}
      <PoliciesTermsModal
        isOpen={showPoliciesModal}
        onClose={() => setShowPoliciesModal(false)}
      />
      <PrivacyConsentModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      {/* Simulation Helper Button */}
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "#EFF6FF",
          borderRadius: "8px",
          border: "1px solid #3B82F6",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#1E40AF",
                margin: "0 0 4px",
              }}
            >
              🧪 Simulation Mode
            </p>
            <p style={{ fontSize: "12px", color: "#3B82F6", margin: 0 }}>
              Fill all required fields with sample data for testing purposes
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              // Fill all required fields with sample data
              setFirstName("Juan");
              setLastName("Dela Cruz");
              setMiddleName("Santos");
              setNickname("JD");
              setMobileNumber("+639171234567");
              setBirthday("1995-05-15");
              setMaritalStatus("single");
              setNationality("Filipino");
              setEducationLevel("college");
              setAddressUnitHouseNo("123");
              setAddressStreet("Rizal Street");
              setAddressBarangay("Barangay 1");
              setAddressCity("Manila");
              setAddressProvince("NCR - National Capital Region");
              setEmergencyContactName("Maria Dela Cruz");
              setEmergencyRelationship("Mother");
              setEmergencyContactNumber("+639181234567");
              setHealthConcerns("None");
              setEmployerSchool("Sample University");
              setEmployerAddress("123 University Ave, Manila");
              setEmployerContact("02-1234567");
              setStartDate("2024-01-15");
              setOccupation("Student");
              setPreviousEmployment("N/A");
              setReferralSource("friend");
              setReferrerName("Pedro Santos");
              setEstimatedMoveInTime("14:00");
              setWorkSchedule("day");
              setAgreedToPrivacy(true);
              setAgreedToCertification(true);
              setPersonalNotes("Sample application for testing");
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3B82F6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Fill Sample Data
          </button>
        </div>
      </div>

      <div className="stage-buttons flex flex-col sm:flex-row gap-3 mt-6">
        <button onClick={onPrev} className="btn btn-secondary">
          Back
        </button>
        <button
          onClick={onNext}
          className="btn btn-primary"
          disabled={!canProceed}
          style={{
            opacity: canProceed ? 1 : 0.6,
            cursor: canProceed ? "pointer" : "not-allowed",
          }}
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
};

export default ReservationApplicationStep;
