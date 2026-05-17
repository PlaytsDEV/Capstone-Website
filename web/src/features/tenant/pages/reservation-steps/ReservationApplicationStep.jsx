import React, { useState, useCallback, useEffect, useRef } from "react";
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

// Sub-components
import {
 PhotoEmailSection,
 PersonalInfoSection,
 EmergencyContactSection,
 EmploymentSection,
 DormPreferencesSection,
 AgreementsSection,
} from "./components";

/* ─── Section Header — clean divider with number + label ─── */
const SectionHeader = React.memo(({ number, title, id, sectionRef, isFirst }) => (
 <div
 ref={sectionRef}
 id={`section-${id}`}
 className={`rf-section-header${isFirst ?" rf-section-header--first" : ""}`}
 >
 <span className="rf-section-header__num">{number}</span>
 <span className="rf-section-header__title">{title}</span>
 </div>
));

// ─────────────────────────────────────────────────────────────
// ReservationApplicationStep — flat layout with section headers
// ─────────────────────────────────────────────────────────────
const ReservationApplicationStep = ({
 billingEmail, selfiePhoto, setSelfiePhoto,
 lastName, setLastName, firstName, setFirstName,
 middleName, setMiddleName, nickname, setNickname,
 mobileNumber, setMobileNumber, birthday, setBirthday,
 gender, setGender,
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
 emergencyContactName, setEmergencyContactName,
 emergencyRelationship, setEmergencyRelationship,
 emergencyContactNumber, setEmergencyContactNumber,
 healthConcerns, setHealthConcerns,
 employerSchool, setEmployerSchool,
 employerAddress, setEmployerAddress,
 employerContact, setEmployerContact,
 startDate, setStartDate,
 occupation, setOccupation,
 companyID, setCompanyID,
 companyIDReason, setCompanyIDReason,
 previousEmployment, setPreviousEmployment,
 preferredRoomNumber, setPreferredRoomNumber,
 referralSource, setReferralSource,
 referrerName, setReferrerName,
 targetMoveInDate, setTargetMoveInDate,
 estimatedMoveInTime, setEstimatedMoveInTime,
 leaseDuration, setLeaseDuration,
 workSchedule, setWorkSchedule,
 workScheduleOther, setWorkScheduleOther,
 agreedToPrivacy, setAgreedToPrivacy,
 agreedToCertification, setAgreedToCertification,
 devBypassValidation, setDevBypassValidation,
 onPrev, onNext, readOnly, saveStatus, saveStatusMessage,
 draftRecoveryMessage,
 showValidationErrors, applicationSubmitted, paymentApproved,
 visitPending,
 onEditApplication, scrollToSection, onClearScrollToSection,
}) => {
 const [showPoliciesModal, setShowPoliciesModal] = useState(false);
 const [showPrivacyModal, setShowPrivacyModal] = useState(false);
 const [confirmModal, setConfirmModal] = useState({
 open: false, title: "", message: "", variant: "info", onConfirm: null,
 });
 const [fieldErrors, setFieldErrors] = useState({});
 const isCheckingDocuments = Object.values(runningDocumentChecks || {}).some(Boolean);
 const submitDisabled = saveStatus === "saving" || isCheckingDocuments;

 const sectionRefs = useRef({});
 useEffect(() => {
 if (!scrollToSection) return;
 setTimeout(() => {
 const el = sectionRefs.current[scrollToSection];
 if (el) {
 el.scrollIntoView({ behavior: "smooth", block: "start" });
 el.style.transition = "background-color 0.3s ease";
 el.style.backgroundColor = "rgba(255, 140, 66, 0.12)";
 setTimeout(() => { el.style.backgroundColor = "transparent"; }, 1500);
 }
 onClearScrollToSection?.();
 }, 100);
 }, [scrollToSection, onClearScrollToSection]);

 const handleNameInput = (value, setter) => setter(value.replace(/\d+/g, ""));
 const handlePhoneInput = (value, setter) => {
 let cleaned = value.replace(/[^0-9+]/g, "");
 if (!cleaned.startsWith("+63")) cleaned = "+63" + cleaned.replace(/^\+?63?/, "");
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
 const clearFieldError = (fieldName) => {
 setFieldErrors((prev) => {
 if (!prev[fieldName]) return prev;
 return { ...prev, [fieldName]: null };
 });
 };
 const handleTimeInput = (value) => {
 validateField("estimatedMoveInTime", value, validateEstimatedTime);
 setEstimatedMoveInTime(value);
 };
 const handleTargetDateInput = (value) => {
 validateField("targetMoveInDate", value, validateTargetMoveInDate);
 setTargetMoveInDate(value);
 };

 const handleResetAll = () => {
 setConfirmModal({
 open: true,
 title: "Reset All Fields",
 message: "This will clear all fields in the application form. This action cannot be undone.",
 variant: "danger",
 confirmText: "Reset All",
 onConfirm: () => { setConfirmModal((p) => ({ ...p, open: false })); doResetAll(); },
 });
 };

 const doResetAll = () => {
 [
 setFirstName, setLastName, setMiddleName, setNickname, setMobileNumber,
 setBirthday, setAddressUnitHouseNo, setAddressStreet, setAddressBarangay,
 setAddressCity, setAddressProvince, setAddressRegion, setNbiReason,
 setEmergencyContactName,
 setEmergencyRelationship, setEmergencyContactNumber, setHealthConcerns,
 setEmployerSchool, setEmployerAddress, setEmployerContact, setStartDate,
 setOccupation, setPreviousEmployment, setCompanyIDReason, setReferralSource,
 setReferrerName, setTargetMoveInDate, setEstimatedMoveInTime, setWorkSchedule,
 setWorkScheduleOther, setPersonalNotes, setPreferredRoomNumber,
 ].forEach((s) => s(""));
 setGender(""); setMaritalStatus(""); setNationality(""); setEducationLevel(""); setLeaseDuration(""); setValidIDType("");
 [setSelfiePhoto, setValidIDFront, setValidIDBack, setNbiClearance, setCompanyID].forEach((s) => s(null));
 setAgreedToPrivacy(false); setAgreedToCertification(false);
 setFieldErrors({});
 };

 const devAutoFill = () => {
 setFirstName("Juan"); setLastName("Dela Cruz"); setMiddleName("Santos"); setNickname("JD");
 setMobileNumber("+639171234567"); setBirthday("2000-05-15");
 setGender("male"); setMaritalStatus("single"); setNationality("Filipino"); setEducationLevel("college");
 setValidIDType("national_id");
 setAddressUnitHouseNo("Unit 12-B"); setAddressStreet("Rizal Avenue");
 setPersonalNotes("Test applicant - dev auto-fill");
 setNbiReason(""); setCompanyIDReason("");
 setEmergencyContactName("Maria Dela Cruz"); setEmergencyRelationship("parent"); setEmergencyContactNumber("+639181234567");
 setHealthConcerns("None"); setEmployerSchool("University of the Philippines");
 setEmployerAddress("Diliman, Quezon City"); setEmployerContact("+639191234567");
 setStartDate("2024-06-01"); setOccupation("Software Developer"); setPreviousEmployment("Accenture Philippines");
 setReferralSource("facebook"); setReferrerName("Google Search");
 setTargetMoveInDate(moveInMin); setEstimatedMoveInTime("08:00"); setWorkSchedule("day"); setWorkScheduleOther("");
 setLeaseDuration("12");
 setAgreedToPrivacy(true); setAgreedToCertification(true);
 };

 const { birthdayMin, birthdayMax, moveInMin, moveInMax } = getDateConstraints();

 return (
 <div className="reservation-card">
 {/* Header */}
 <div className="main-header">
 <div className="main-header-badge"><span>Step 3 · Verification</span></div>
 <h2 className="main-header-title">Tenant Application</h2>
 <p className="main-header-subtitle">
 Complete all fields below. Required fields are marked with{" "}
 <span className="rf-required">*</span>
 </p>
 </div>

 {showValidationErrors && !applicationSubmitted && (
 <div className="rf-form-alert" role="alert">
 Please complete the highlighted required fields before submitting.
 </div>
 )}

 {draftRecoveryMessage && (
 <div className="rf-draft-banner" role="status">
 <div className="info-box-title">Saved draft restored</div>
 <div className="info-text">{draftRecoveryMessage}</div>
 </div>
 )}

 {/* Locked banner — only when application is officially submitted / non-editable */}
 {readOnly && (
 <div className="rf-locked-banner">
 <div className="info-box-title">This section is locked</div>
 <div className="info-text">
 Your application has been submitted and is currently under review. It cannot be edited at this time.
 </div>
 </div>
 )}

 {/* Draft info banner — form is editable but physical visit is still pending */}
 {!readOnly && visitPending && (
 <div className="rf-draft-banner">
 <div className="info-box-title">You can continue completing your application</div>
 <div className="info-text">
 Your physical visit is still pending. You can fill in your details and save your progress now — submission will be available once admin confirms your visit or grants access.
 </div>
 </div>
 )}

 {/* Top actions row */}
 {!readOnly && (
 <div className="rf-top-actions">
 {saveStatusMessage && <span className="rf-save-status">{saveStatusMessage}</span>}
 <button type="button" onClick={handleResetAll} className="rf-reset-btn">Reset All</button>
 {import.meta.env.DEV && (
 <button type="button" onClick={devAutoFill} className="rf-dev-fill-btn">
 ⚡ Dev Auto-Fill
 </button>
 )}
 </div>
 )}

 {/* Form body */}
 <div className={readOnly ? "rf-readonly-wrapper" : ""}>
 {/* ─── Section 1: Photo & Email ─── */}
 <SectionHeader number={1} title="Email & Photo" id="photo" isFirst
 sectionRef={(el) => { sectionRefs.current.photo = el; }} />
 <PhotoEmailSection
 billingEmail={billingEmail} selfiePhoto={selfiePhoto}
 setSelfiePhoto={setSelfiePhoto} showValidationErrors={showValidationErrors}
 />

 {/* ─── Section 2: Personal Information ─── */}
 <SectionHeader number={2} title="Personal Information" id="personal"
 sectionRef={(el) => { sectionRefs.current.personal = el; }} />
 <PersonalInfoSection
 {...{
 lastName, setLastName, firstName, setFirstName,
 middleName, setMiddleName, nickname, setNickname,
 mobileNumber, setMobileNumber, birthday, setBirthday,
 gender, setGender,
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
 }}
 />

 {/* ─── Section 3: Emergency Contact ─── */}
 <SectionHeader number={3} title="Emergency Contact" id="emergency"
 sectionRef={(el) => { sectionRefs.current.emergency = el; }} />
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
 <SectionHeader number={4} title="Employment / School" id="employment"
 sectionRef={(el) => { sectionRefs.current.employment = el; }} />
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
  documentPrechecks,
  runningDocumentChecks,
  onRunDocumentPrecheck,
  handleGeneralInput,
  validateField,
  fieldErrors,
  clearFieldError,
  showValidationErrors,
 }}
 />

 {/* ─── Section 5: Dorm Preferences ─── */}
 <SectionHeader number={5} title="Dorm Preferences" id="dorm"
 sectionRef={(el) => { sectionRefs.current.dorm = el; }} />
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
  readOnly, moveInMin, moveInMax, fieldErrors, validateField,
  showValidationErrors,
 }}
 />

 {/* ─── Section 6: Agreements & Consent ─── */}
 <div ref={(el) => { sectionRefs.current.agreements = el; }}>
 <SectionHeader number={6} title="Agreements & Consent" id="agreements" />
 <AgreementsSection
 {...{ agreedToPrivacy, setAgreedToPrivacy, agreedToCertification, setAgreedToCertification, showValidationErrors }}
 onShowPolicies={() => setShowPoliciesModal(true)}
 onShowPrivacy={() => setShowPrivacyModal(true)}
 />
 </div>
 </div>

 {/* Modals */}
 <PoliciesTermsModal isOpen={showPoliciesModal} onClose={() => setShowPoliciesModal(false)} />
 <PrivacyConsentModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

 {/* Footer buttons */}
 {readOnly && applicationSubmitted && !paymentApproved && (
 <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
 <button onClick={onEditApplication} className="btn btn-primary">Edit Application</button>
 </div>
 )}
 {!readOnly && (
 <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
 <button onClick={onNext} className="btn btn-primary" disabled={submitDisabled}>
 {applicationSubmitted ? "Save Changes" : visitPending ? "Save Progress" : "Submit Application"}
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

 <FormScrollArrows />
 </div>
 );
};

export default ReservationApplicationStep;
