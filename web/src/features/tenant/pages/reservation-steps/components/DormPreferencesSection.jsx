import React from "react";
import {
 MOVE_IN_TIME_SLOTS,
 REFERRAL_OPTIONS,
 WORK_SCHEDULE_OPTIONS,
 LEASE_OPTIONS,
} from "../applicationFormConstants";

const errBorder = (show, value) =>
 show && !value ? "1px solid var(--danger)" : undefined;

const openDatePicker = (event) => {
 event.currentTarget.showPicker?.();
};

/**
 * Section 5: Dorm Preferences — referral, move-in date/time, lease, work schedule.
 */
const DormPreferencesSection = ({
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
}) => (
 <>
 {/* Referral Source */}
 <div className="form-group" data-field="referralSource">
 <label className="form-label">
 How Did You First Learn About Lilycrest Gil Puyat?{" "}
 <span className="rf-required">*</span>
 </label>
 <div
 className="radio-group"
 style={{
 border: fieldErrors.referralSource
 ? "1px solid var(--danger)"
 : errBorder(showValidationErrors, referralSource),
  borderRadius: "8px",
  padding: showValidationErrors && !referralSource ? "8px" : undefined,
 }}
 >
 {REFERRAL_OPTIONS.map((opt) => (
 <div className="radio-option" key={opt.id}>
 <input
 type="radio"
 name="referral"
 id={opt.id}
 value={opt.value}
 checked={referralSource === opt.value}
 onChange={(e) => {
 setReferralSource(e.target.value);
 validateField("referralSource", e.target.value, (value) => ({
 valid: Boolean(value),
 error: value ? null : "Please select how you learned about us",
 }));
 }}
 />
 <label htmlFor={opt.id} className="radio-label">
 {opt.label}
 </label>
 </div>
 ))}
 </div>
 <FieldError
 error={
 showValidationErrors && !referralSource
 ? "Please select how you learned about us"
 : fieldErrors.referralSource
 }
 />
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

 {/* Move-in Date */}
 <div className="form-group" data-field="targetMoveInDate">
 <label className="form-label">
 Target Move In Date (within 3 months) <span className="rf-required">*</span>
 </label>
 <input
 type="date"
 className="form-input"
 value={targetMoveInDate}
 min={moveInMin}
 max={moveInMax}
 onClick={openDatePicker}
 onChange={(e) => handleTargetDateInput(e.target.value)}
 disabled={readOnly}
 required
 style={{
 colorScheme: "light",
 cursor: readOnly ? "not-allowed" : "pointer",
 border: fieldErrors.targetMoveInDate
 ? "1.5px solid var(--danger)"
 : errBorder(showValidationErrors, targetMoveInDate),
 }}
 />
 <div className="form-helper">Must be at least 3 days from today</div>
 <FieldError error={showValidationErrors && !targetMoveInDate ? "Move-in date is required" : fieldErrors.targetMoveInDate} />
 </div>

 {/* Move-in Time */}
 <div className="form-group" data-field="estimatedMoveInTime">
 <label className="form-label">
 Estimated Time of Move In (8:00 AM to 6:00 PM) <span className="rf-required">*</span>
 </label>
 <select
 className="form-select"
 value={estimatedMoveInTime}
 onChange={(e) => handleTimeInput(e.target.value)}
 style={{
 cursor: "pointer",
 border: fieldErrors.estimatedMoveInTime
 ? "1.5px solid var(--danger)"
 : errBorder(showValidationErrors, estimatedMoveInTime),
 }}
 >
 <option value="">Select time...</option>
 {MOVE_IN_TIME_SLOTS.map((slot) => (
 <option key={slot.value} value={slot.value}>
 {slot.label}
 </option>
 ))}
 </select>
 <FieldError error={showValidationErrors && !estimatedMoveInTime ? "Please select a move-in time" : fieldErrors.estimatedMoveInTime} />
 </div>

 {/* Lease Duration */}
 <div className="form-group" data-field="leaseDuration">
 <label className="form-label">
 Duration of Lease <span className="rf-required">*</span>
 </label>
 <select
 className="form-select"
 value={leaseDuration}
 onChange={(e) => {
 setLeaseDuration(e.target.value);
 validateField("leaseDuration", e.target.value, (value) => ({
 valid: Boolean(value),
 error: value ? null : "Please select a lease duration",
 }));
 }}
 required
 style={{
 border: fieldErrors.leaseDuration
 ? "1.5px solid var(--danger)"
 : errBorder(showValidationErrors, leaseDuration),
 }}
 >
 <option value="">Select duration...</option>
 {LEASE_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 {leaseDuration && (
    <div className="form-helper">
      Preferred term selected during room booking: {Number(leaseDuration) === 12 ? "1 year (12 months)" : `${leaseDuration} ${Number(leaseDuration) === 1 ? "month" : "months"}`}
    </div>
  )}
 <FieldError
 error={
 showValidationErrors && !leaseDuration
 ? "Please select a lease duration"
 : fieldErrors.leaseDuration
 }
 />
 </div>

 {/* Work Schedule */}
 <div className="form-group" data-field="workSchedule">
 <label className="form-label">
 Work Schedule <span className="rf-required">*</span>
 </label>
 <div
 className="radio-group"
 style={{
 border: fieldErrors.workSchedule
 ? "1px solid var(--danger)"
 : errBorder(showValidationErrors, workSchedule),
  borderRadius: "8px",
  padding: showValidationErrors && !workSchedule ? "8px" : undefined,
 }}
 >
 {WORK_SCHEDULE_OPTIONS.map((opt) => (
 <div className="radio-option" key={opt.id}>
 <input
 type="radio"
 name="schedule"
 id={opt.id}
 value={opt.value}
 checked={workSchedule === opt.value}
 onChange={(e) => {
 setWorkSchedule(e.target.value);
 validateField("workSchedule", e.target.value, (value) => ({
 valid: Boolean(value),
 error: value ? null : "Please select your work schedule",
 }));
 }}
 />
 <label htmlFor={opt.id} className="radio-label">
 {opt.label}
 </label>
 </div>
 ))}
 </div>
 <FieldError
 error={
 showValidationErrors && !workSchedule
 ? "Please select your work schedule"
 : fieldErrors.workSchedule
 }
 />
 </div>

 {workSchedule === "others" && (
 <div className="form-group" data-field="workScheduleOther">
 <label className="form-label">
 If You Answered "Others", Please Specify Your Work Schedule Below *
 </label>
 <textarea
 className="form-textarea"
  value={workScheduleOther}
  onChange={(e) => {
  setWorkScheduleOther(e.target.value);
  validateField("workScheduleOther", e.target.value, (value) => ({
  valid: Boolean(value?.trim()),
  error: value?.trim() ? null : "Please describe your work schedule",
  }));
  }}
  placeholder="Please describe your typical work schedule"
  style={{
  border: fieldErrors.workScheduleOther
  ? "1.5px solid var(--danger)"
  : workSchedule === "others"
  ? errBorder(showValidationErrors, workScheduleOther)
  : undefined,
  }}
  />
  <FieldError
  error={
  showValidationErrors && workSchedule === "others" && !workScheduleOther
  ? "Please describe your work schedule"
  : fieldErrors.workScheduleOther
  }
  />
 </div>
 )}
 </>
);

const FieldError = ({ error }) => {
 if (!error) return null;
 return (
 <div className="rf-field-error">
 {error}
 </div>
 );
};

export default DormPreferencesSection;
