import React, { useState, useCallback, useEffect, useRef } from "react";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
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
import { getDateConstraints } from "./applicationFormConstants";

// Sub-components
import {
  PhotoEmailSection,
  PersonalInfoSection,
  EmergencyContactSection,
  EmploymentSection,
  DormPreferencesSection,
  AgreementsSection,
} from "./components";

/* ─── Section Header — clean divider with label ─── */
const SectionHeader = React.memo(({ number, title, id, sectionRef }) => (
  <div
    ref={sectionRef}
    id={`section-${id}`}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "20px 0 12px",
      marginTop: number > 1 ? "8px" : 0,
      borderTop: number > 1 ? "1px solid #E5E7EB" : "none",
    }}
  >
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        backgroundColor: "#183153",
        color: "#fff",
        fontSize: "13px",
        fontWeight: "600",
        flexShrink: 0,
      }}
    >
      {number}
    </span>
    <span
      style={{
        fontSize: "15px",
        fontWeight: "600",
        color: "#0f172a",
        letterSpacing: "-0.01em",
      }}
    >
      {title}
    </span>
  </div>
));

// ─────────────────────────────────────────────────────────────
// ReservationApplicationStep — flat layout with section headers
// ─────────────────────────────────────────────────────────────
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
  readOnly,
  saveStatus,
  showValidationErrors,
  applicationSubmitted,
  paymentApproved,
  onEditApplication,
  scrollToSection,
  onClearScrollToSection,
}) => {
  // ── Modal state ────────────────────────────────────────────
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    variant: "info",
    onConfirm: null,
  });
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Section refs for scroll-to-error ──────────────────────
  const sectionRefs = useRef({});
  useEffect(() => {
    if (!scrollToSection) return;
    setTimeout(() => {
      const el = sectionRefs.current[scrollToSection];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Brief highlight flash
        el.style.transition = "background-color 0.3s ease";
        el.style.backgroundColor = "#FEF3C7";
        setTimeout(() => {
          el.style.backgroundColor = "transparent";
        }, 1500);
      }
      onClearScrollToSection?.();
    }, 100);
  }, [scrollToSection, onClearScrollToSection]);

  // ── Input handlers ─────────────────────────────────────────
  const handleNameInput = (value, setter) => setter(value.replace(/\d+/g, ""));
  const handlePhoneInput = (value, setter) => {
    let cleaned = value.replace(/[^0-9+]/g, "");
    if (!cleaned.startsWith("+63"))
      cleaned = "+63" + cleaned.replace(/^\+?63?/, "");
    if (cleaned.length <= 13) setter(cleaned);
  };
  const handleGeneralInput = (value, setter, maxLength = 100) => {
    if (value.length <= maxLength) setter(value);
  };
  const validateField = (fieldName, value, validator) => {
    const result = validator(value);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: result.error }));
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

  // ── Reset all ──────────────────────────────────────────────
  const handleResetAll = () => {
    setConfirmModal({
      open: true,
      title: "Reset All Fields",
      message:
        "This will clear all fields in the application form. This action cannot be undone.",
      variant: "danger",
      confirmText: "Reset All",
      onConfirm: () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        doResetAll();
      },
    });
  };
  const doResetAll = () => {
    [
      setFirstName,
      setLastName,
      setMiddleName,
      setNickname,
      setMobileNumber,
      setBirthday,
      setAddressUnitHouseNo,
      setAddressStreet,
      setAddressBarangay,
      setAddressCity,
      setAddressProvince,
      setNbiReason,
      setEmergencyContactName,
      setEmergencyRelationship,
      setEmergencyContactNumber,
      setHealthConcerns,
      setEmployerSchool,
      setEmployerAddress,
      setEmployerContact,
      setStartDate,
      setOccupation,
      setPreviousEmployment,
      setCompanyIDReason,
      setReferralSource,
      setReferrerName,
      setTargetMoveInDate,
      setEstimatedMoveInTime,
      setWorkSchedule,
      setWorkScheduleOther,
    ].forEach((s) => s(""));
    setMaritalStatus("");
    setNationality("");
    setEducationLevel("");
    [
      setSelfiePhoto,
      setValidIDFront,
      setValidIDBack,
      setNbiClearance,
      setCompanyID,
    ].forEach((s) => s(null));
    setAgreedToPrivacy(false);
    setAgreedToCertification(false);
    setFieldErrors({});
  };

  // ── Dev auto-fill (development only) ────────────────────────
  const devAutoFill = () => {
    setFirstName("Juan");
    setLastName("Dela Cruz");
    setMiddleName("Santos");
    setNickname("JD");
    setMobileNumber("+639171234567");
    setBirthday("2000-05-15");
    setMaritalStatus("single");
    setNationality("Filipino");
    setEducationLevel("college");
    setAddressUnitHouseNo("Unit 12-B");
    setAddressStreet("Rizal Avenue");
    setPersonalNotes("Test applicant - dev auto-fill");
    setNbiReason("");
    setCompanyIDReason("");
    // Emergency contact
    setEmergencyContactName("Maria Dela Cruz");
    setEmergencyRelationship("parent");
    setEmergencyContactNumber("+639181234567");
    setHealthConcerns("None");
    // Employment
    setEmployerSchool("University of the Philippines");
    setEmployerAddress("Diliman, Quezon City");
    setEmployerContact("+639191234567");
    setStartDate("2024-06-01");
    setOccupation("Software Developer");
    setPreviousEmployment("Accenture Philippines");
    // Preferences
    setReferralSource("online");
    setReferrerName("Google Search");
    setEstimatedMoveInTime("morning");
    setWorkSchedule("day");
    setWorkScheduleOther("");
    // Agreements
    setAgreedToPrivacy(true);
    setAgreedToCertification(true);
  };

  // ── Date constraints ───────────────────────────────────────
  const { birthdayMin, birthdayMax, moveInMin, moveInMax } =
    getDateConstraints();

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="reservation-card">
      {/* Header */}
      <div className="main-header">
        <div className="main-header-badge">
          <span>Step 3 · Verification</span>
        </div>
        <h2 className="main-header-title">Tenant Application</h2>
        <p className="main-header-subtitle">
          Complete all fields below. Required fields are marked with{" "}
          <span style={{ color: "#dc2626", fontWeight: 600 }}>*</span>
        </p>
      </div>

      {/* Read-Only Banner */}
      {readOnly && (
        <div
          className="info-box"
          style={{
            background: "#FEF3C7",
            borderColor: "#F59E0B",
            marginBottom: "16px",
          }}
        >
          <div className="info-box-title" style={{ color: "#92400E" }}>
            This section is locked
          </div>
          <div className="info-text" style={{ color: "#78350F" }}>
            Your application data is saved and cannot be edited at this time.
          </div>
        </div>
      )}

      {/* Top actions row */}
      {!readOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginBottom: "4px",
            gap: "12px",
          }}
        >
          {saveStatus && (
            <span
              style={{
                fontSize: "12px",
                color: "#6B7280",
                fontStyle: "italic",
              }}
            >
              {saveStatus}
            </span>
          )}
          <button
            type="button"
            onClick={handleResetAll}
            style={{
              background: "none",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: "500",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Reset All
          </button>
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={devAutoFill}
              style={{
                background: "#F59E0B",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "600",
                color: "white",
                cursor: "pointer",
              }}
            >
              ⚡ Dev Auto-Fill
            </button>
          )}
        </div>
      )}

      {/* Form body */}
      <div
        style={{
          pointerEvents: readOnly ? "none" : "auto",
          opacity: readOnly ? 0.7 : 1,
        }}
      >
        {/* ─── Section 1: Photo & Email ─── */}
        <SectionHeader
          number={1}
          title="Email & Photo"
          id="photo"
          sectionRef={(el) => { sectionRefs.current.photo = el; }}
        />
        <PhotoEmailSection
          billingEmail={billingEmail}
          selfiePhoto={selfiePhoto}
          setSelfiePhoto={setSelfiePhoto}
          showValidationErrors={showValidationErrors}
        />

        {/* ─── Section 2: Personal Information ─── */}
        <SectionHeader
          number={2}
          title="Personal Information"
          id="personal"
          sectionRef={(el) => { sectionRefs.current.personal = el; }}
        />
        <PersonalInfoSection
          {...{
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
            nbiClearance, setNbiClearance,
            nbiReason, setNbiReason,
            personalNotes, setPersonalNotes,
            handleNameInput, handlePhoneInput, handleGeneralInput,
            validateField, fieldErrors,
            birthdayMin, birthdayMax,
            showValidationErrors,
          }}
        />

        {/* ─── Section 3: Emergency Contact ─── */}
        <SectionHeader
          number={3}
          title="Emergency Contact"
          id="emergency"
          sectionRef={(el) => { sectionRefs.current.emergency = el; }}
        />
        <EmergencyContactSection
          {...{
            emergencyContactName, setEmergencyContactName,
            emergencyRelationship, setEmergencyRelationship,
            emergencyContactNumber, setEmergencyContactNumber,
            healthConcerns, setHealthConcerns,
            handlePhoneInput, validateField, fieldErrors,
            showValidationErrors,
          }}
        />

        {/* ─── Section 4: Employment / School ─── */}
        <SectionHeader
          number={4}
          title="Employment / School"
          id="employment"
          sectionRef={(el) => { sectionRefs.current.employment = el; }}
        />
        <EmploymentSection
          {...{
            employerSchool, setEmployerSchool,
            employerAddress, setEmployerAddress,
            employerContact, setEmployerContact,
            startDate, setStartDate,
            occupation, setOccupation,
            previousEmployment, setPreviousEmployment,
            companyID, setCompanyID,
            companyIDReason, setCompanyIDReason,
            handleGeneralInput,
            showValidationErrors,
          }}
        />

        {/* ─── Section 5: Dorm Preferences ─── */}
        <SectionHeader
          number={5}
          title="Dorm Preferences"
          id="dorm"
          sectionRef={(el) => { sectionRefs.current.dorm = el; }}
        />
        <DormPreferencesSection
          {...{
            referralSource, setReferralSource,
            referrerName, setReferrerName,
            targetMoveInDate, setTargetMoveInDate,
            estimatedMoveInTime, setEstimatedMoveInTime,
            leaseDuration, setLeaseDuration,
            workSchedule, setWorkSchedule,
            workScheduleOther, setWorkScheduleOther,
            handleTargetDateInput, handleTimeInput,
            readOnly, moveInMin, moveInMax, fieldErrors,
            showValidationErrors,
          }}
        />

        {/* ─── Section 6: Agreements & Consent ─── */}
        <div ref={(el) => { sectionRefs.current.agreements = el; }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "20px 0 12px",
              marginTop: "8px",
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "#183153",
                color: "#fff",
                fontSize: "13px",
                fontWeight: "600",
                flexShrink: 0,
              }}
            >
              6
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "#0f172a",
                letterSpacing: "-0.01em",
              }}
            >
              Agreements & Consent
            </span>
          </div>
          <AgreementsSection
            {...{
              agreedToPrivacy,
              setAgreedToPrivacy,
              agreedToCertification,
              setAgreedToCertification,
              showValidationErrors,
            }}
            onShowPolicies={() => setShowPoliciesModal(true)}
            onShowPrivacy={() => setShowPrivacyModal(true)}
          />
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

      {/* Footer buttons */}
      {readOnly && applicationSubmitted && !paymentApproved && (
        <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
          <button onClick={onEditApplication} className="btn btn-primary">
            Edit Application
          </button>
        </div>
      )}
      {!readOnly && (
        <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
          <button onClick={onNext} className="btn btn-primary">
            {applicationSubmitted ? "Save Changes" : "Continue to Payment"}
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal((p) => ({ ...p, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText || "Confirm"}
      />
    </div>
  );
};

export default ReservationApplicationStep;
