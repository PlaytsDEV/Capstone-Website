import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Loader2, User } from "lucide-react";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import FormScrollArrows from "../../../../shared/components/FormScrollArrows";
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

import {
  PhotoEmailSection,
  PersonalInfoSection,
  EmergencyContactSection,
  EmploymentSection,
  DormPreferencesSection,
  AgreementsSection,
} from "./components";

const APPLICATION_SECTIONS = [
  { key: "photo", number: 1, title: "Email & Photo" },
  { key: "personal", number: 2, title: "Personal Information" },
  { key: "emergency", number: 3, title: "Emergency Contact" },
  { key: "employment", number: 4, title: "Employment / School" },
  { key: "dorm", number: 5, title: "Dorm Preferences" },
  { key: "agreements", number: 6, title: "Agreements & Consent" },
];

const buildOpenSectionState = (isOpen) =>
  APPLICATION_SECTIONS.reduce((acc, section, index) => {
    acc[section.key] =
      typeof isOpen === "function" ? isOpen(section, index) : isOpen;
    return acc;
  }, {});

const CollapsibleSection = React.memo(
  ({
    number,
    title,
    sectionKey,
    isOpen,
    onToggle,
    sectionRef,
    children,
    contentClassName = "",
  }) => (
    <section ref={sectionRef} id={`section-${sectionKey}`} className="rf-app-section">
      <div className="rf-app-section__header">
        <button
          type="button"
          className="rf-app-section__title-button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`section-${sectionKey}-panel`}
        >
          <span className="rf-app-section__num">{number}</span>
          <span className="rf-app-section__title">{title}</span>
        </button>

        <button
          type="button"
          className="rf-app-section__toggle"
          onClick={onToggle}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          aria-expanded={isOpen}
          aria-controls={`section-${sectionKey}-panel`}
        >
          <ChevronDown size={20} strokeWidth={2.2} className={`rf-app-section__chevron${isOpen ? " is-open" : ""}`} />
        </button>
      </div>

      <div id={`section-${sectionKey}-panel`} className={`rf-app-section__body${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  ),
);

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
  documentPrechecks,
  runningDocumentChecks,
  onRunDocumentPrecheck,
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
  saveStatusMessage,
  draftRecoveryMessage,
  showValidationErrors,
  isSubmittingApplication,
  applicationSubmitted,
  paymentApproved,
  visitPending,
  onEditApplication,
  scrollToSection,
  onClearScrollToSection,
}) => {
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
  const [openSections, setOpenSections] = useState(() => buildOpenSectionState((s, i) => i === 0));

  const sectionRefs = useRef({});
  const isCheckingDocuments = Object.values(runningDocumentChecks || {}).some(Boolean);
  const submitDisabled = saveStatus === "saving" || isCheckingDocuments || isSubmittingApplication;

  useEffect(() => {
    if (!showValidationErrors) return;
    setOpenSections(buildOpenSectionState(true));
  }, [showValidationErrors]);

  useEffect(() => {
    if (!scrollToSection) return undefined;

    setOpenSections((prev) => ({ ...prev, [scrollToSection]: true }));

    const timer = setTimeout(() => {
      const el = sectionRefs.current[scrollToSection];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.style.transition = "background-color 0.3s ease";
        el.style.backgroundColor = "rgba(255, 140, 66, 0.12)";
        setTimeout(() => {
          el.style.backgroundColor = "";
        }, 1500);
      }
      onClearScrollToSection?.();
    }, 120);

    return () => clearTimeout(timer);
  }, [scrollToSection, onClearScrollToSection]);

  const toggleSection = (sectionKey) => setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));

  const handleNameInput = (value, setter) => setter(value.replace(/\d+/g, ""));
  const handleGeneralInput = (value, setter, maxLength = 100) => { if (value.length <= maxLength) setter(value); };
  const validateField = (fieldName, value, validator) => { const result = validator(value); setFieldErrors((p) => ({ ...p, [fieldName]: result.error })); return result.valid; };
  const clearFieldError = (fieldName) => setFieldErrors((p) => (p[fieldName] ? { ...p, [fieldName]: null } : p));
  const handleTimeInput = (value) => { validateField("estimatedMoveInTime", value, validateEstimatedTime); setEstimatedMoveInTime(value); };
  const handleTargetDateInput = (value) => { validateField("targetMoveInDate", value, validateTargetMoveInDate); setTargetMoveInDate(value); };

  const handleResetAll = () => {
    setConfirmModal({ open: true, title: "Reset All Fields", message: "This will clear all fields in the application form. This action cannot be undone.", variant: "danger", confirmText: "Reset All", onConfirm: () => { setConfirmModal((p) => ({ ...p, open: false })); doResetAll(); } });
  };

  const doResetAll = () => {
    [
      setFirstName, setLastName, setMiddleName, setMobileNumber,
      setBirthday, setAddressUnitHouseNo, setAddressStreet, setAddressBarangay,
      setAddressCity, setAddressProvince, setAddressRegion, setNbiReason,
      setEmergencyContactName, setEmergencyRelationship, setEmergencyContactNumber,
      setHealthConcerns, setEmployerSchool, setEmployerAddress, setEmployerContact,
      setStartDate, setOccupation, setPreviousEmployment, setCompanyIDReason,
      setReferralSource, setReferrerName, setTargetMoveInDate, setEstimatedMoveInTime,
      setWorkSchedule, setWorkScheduleOther, setPersonalNotes, setPreferredRoomNumber,
      setGender, setNickname,
    ].forEach((s) => s(""));

    setGender(""); setMaritalStatus(""); setNationality(""); setEducationLevel(""); setLeaseDuration(""); setValidIDType("");
    [setSelfiePhoto, setValidIDFront, setValidIDBack, setNbiClearance, setCompanyID].forEach((s) => s(null));
    setAgreedToPrivacy(false); setAgreedToCertification(false);
    setFieldErrors({});
    setOpenSections(buildOpenSectionState((s, i) => i === 0));
  };

  const devAutoFill = () => {
    setFirstName("Juan"); setLastName("Dela Cruz"); setMiddleName("Santos"); setNickname("JD");
    setMobileNumber("+639171234567"); setBirthday("2000-05-15"); setGender("male");
    setMaritalStatus("single"); setNationality("Filipino"); setEducationLevel("college");
    setValidIDType("national_id"); setAddressUnitHouseNo("Unit 12-B"); setAddressStreet("Rizal Avenue");
    setPersonalNotes("Test applicant - dev auto-fill"); setNbiReason(""); setCompanyIDReason("");
    setEmergencyContactName("Maria Dela Cruz"); setEmergencyRelationship("parent"); setEmergencyContactNumber("+639181234567");
    setHealthConcerns("None"); setEmployerSchool("University of the Philippines"); setEmployerAddress("Diliman, Quezon City"); setEmployerContact("+639191234567");
    setStartDate("2024-06-01"); setOccupation("Software Developer"); setPreviousEmployment("Accenture Philippines");
    setReferralSource("facebook"); setReferrerName("Google Search"); setTargetMoveInDate(moveInMin); setEstimatedMoveInTime("08:00");
    setWorkSchedule("day"); setWorkScheduleOther(""); setLeaseDuration("12"); setAgreedToPrivacy(true); setAgreedToCertification(true);
    setOpenSections(buildOpenSectionState(true));
  };

  const { birthdayMin, birthdayMax, moveInMin, moveInMax } = useMemo(() => getDateConstraints(), []);
  const readonlyContentClass = readOnly ? "rf-readonly-wrapper" : "";

  return (
    <div className="reservation-card rf-application-card">
      <div className="rf-app-header">
        <div className="rf-app-header__icon" aria-hidden="true"><User size={32} strokeWidth={1.8} /></div>
        <div className="rf-app-header__content">
          <div className="rf-app-header__copy">
            <div className="main-header-badge"><span>Step 3 · Verification</span></div>
            <div className="rf-app-header__title-row">
              <h2 className="rf-app-header__title">Tenant Application</h2>
              {saveStatus && <span className="rf-save-status">{saveStatus === "saving" ? "Saving…" : "✓ Saved"}</span>}
            </div>
            <p className="rf-app-header__subtitle">Complete all fields below. Required fields are marked with <span className="rf-required">*</span></p>
          </div>

          {!readOnly && (
            <div className="rf-app-actions">
              <button type="button" onClick={handleResetAll} className="rf-reset-btn">Reset All</button>
              {import.meta.env.DEV && <button type="button" onClick={devAutoFill} className="rf-dev-fill-btn">⚡ Dev Auto-Fill</button>}
            </div>
          )}
        </div>
      </div>

      {showValidationErrors && !applicationSubmitted && <div className="rf-form-alert" role="alert">Please complete the highlighted required fields before submitting.</div>}

      {readOnly && (
        <div className="rf-locked-banner"><div className="info-box-title">This section is locked</div><div className="info-text">Your application has been submitted and is currently under review. It cannot be edited at this time.</div></div>
      )}

      {!readOnly && visitPending && (
        <div className="rf-draft-banner"><div className="info-box-title">You can continue completing your application</div><div className="info-text">Your physical visit is still pending. You can fill in your details and save your progress now — submission will be available once admin confirms your visit or grants access.</div></div>
      )}

      <div className="rf-app-sections">
        <CollapsibleSection number={1} title="Email & Photo" sectionKey="photo" isOpen={openSections.photo} onToggle={() => toggleSection("photo")} sectionRef={(el) => { sectionRefs.current.photo = el; }} contentClassName={readonlyContentClass}>
          <PhotoEmailSection billingEmail={billingEmail} selfiePhoto={selfiePhoto} setSelfiePhoto={setSelfiePhoto} showValidationErrors={showValidationErrors} />
        </CollapsibleSection>

        <CollapsibleSection number={2} title="Personal Information" sectionKey="personal" isOpen={openSections.personal} onToggle={() => toggleSection("personal")} sectionRef={(el) => { sectionRefs.current.personal = el; }} contentClassName={readonlyContentClass}>
          <PersonalInfoSection {...{ lastName, setLastName, firstName, setFirstName, middleName, setMiddleName, nickname, setNickname, mobileNumber, setMobileNumber, birthday, setBirthday, gender, setGender, maritalStatus, setMaritalStatus, nationality, setNationality, educationLevel, setEducationLevel, addressUnitHouseNo, setAddressUnitHouseNo, addressStreet, setAddressStreet, addressRegion, setAddressRegion, addressBarangay, setAddressBarangay, addressCity, setAddressCity, addressProvince, setAddressProvince, validIDFront, setValidIDFront, validIDBack, setValidIDBack, validIDType, setValidIDType, documentPrechecks, runningDocumentChecks, onRunDocumentPrecheck, nbiClearance, setNbiClearance, nbiReason, setNbiReason, personalNotes, setPersonalNotes, handleNameInput, handleGeneralInput, validateField, fieldErrors, clearFieldError, birthdayMin, birthdayMax, showValidationErrors }} />
        </CollapsibleSection>

        <CollapsibleSection number={3} title="Emergency Contact" sectionKey="emergency" isOpen={openSections.emergency} onToggle={() => toggleSection("emergency")} sectionRef={(el) => { sectionRefs.current.emergency = el; }} contentClassName={readonlyContentClass}>
          <EmergencyContactSection {...{ emergencyContactName, setEmergencyContactName, emergencyRelationship, setEmergencyRelationship, emergencyContactNumber, setEmergencyContactNumber, healthConcerns, setHealthConcerns, validateField, fieldErrors, showValidationErrors }} />
        </CollapsibleSection>

        <CollapsibleSection number={4} title="Employment / School" sectionKey="employment" isOpen={openSections.employment} onToggle={() => toggleSection("employment")} sectionRef={(el) => { sectionRefs.current.employment = el; }} contentClassName={readonlyContentClass}>
          <EmploymentSection {...{ employerSchool, setEmployerSchool, employerAddress, setEmployerAddress, employerContact, setEmployerContact, startDate, setStartDate, occupation, setOccupation, previousEmployment, setPreviousEmployment, companyID, setCompanyID, companyIDReason, setCompanyIDReason, documentPrechecks, runningDocumentChecks, onRunDocumentPrecheck, handleGeneralInput, validateField, fieldErrors, clearFieldError, showValidationErrors }} />
        </CollapsibleSection>

        <CollapsibleSection number={5} title="Dorm Preferences" sectionKey="dorm" isOpen={openSections.dorm} onToggle={() => toggleSection("dorm")} sectionRef={(el) => { sectionRefs.current.dorm = el; }} contentClassName={readonlyContentClass}>
          <DormPreferencesSection {...{ referralSource, setReferralSource, referrerName, setReferrerName, targetMoveInDate, setTargetMoveInDate, estimatedMoveInTime, setEstimatedMoveInTime, leaseDuration, setLeaseDuration, workSchedule, setWorkSchedule, workScheduleOther, setWorkScheduleOther, handleTargetDateInput, handleTimeInput, readOnly, moveInMin, moveInMax, fieldErrors, validateField, showValidationErrors }} />
        </CollapsibleSection>

        <CollapsibleSection number={6} title="Agreements & Consent" sectionKey="agreements" isOpen={openSections.agreements} onToggle={() => toggleSection("agreements")} sectionRef={(el) => { sectionRefs.current.agreements = el; }} contentClassName={readonlyContentClass}>
          <AgreementsSection {...{ agreedToPrivacy, setAgreedToPrivacy, agreedToCertification, setAgreedToCertification, showValidationErrors }} onShowPolicies={() => setShowPoliciesModal(true)} onShowPrivacy={() => setShowPrivacyModal(true)} />
        </CollapsibleSection>
      </div>

      <PoliciesTermsModal isOpen={showPoliciesModal} onClose={() => setShowPoliciesModal(false)} />
      <PrivacyConsentModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

      {readOnly && applicationSubmitted && !paymentApproved && (
        <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
          <button onClick={onEditApplication} className="btn btn-primary">Edit Application</button>
        </div>
      )}

      {!readOnly && (
        <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
          <button onClick={onNext} className="btn btn-primary" disabled={submitDisabled}>
            {isSubmittingApplication ? (
              <>
                <Loader2 size={15} className="auth-spinner" style={{ marginRight: 6 }} />
                Submitting…
              </>
            ) : applicationSubmitted ? "Save Changes" : visitPending ? "Save Progress" : "Submit Application"}
          </button>
        </div>
      )}

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal((p) => ({ ...p, open: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} variant={confirmModal.variant} confirmText={confirmModal.confirmText || "Confirm"} />

      <FormScrollArrows />
    </div>
  );
};

export default ReservationApplicationStep;
