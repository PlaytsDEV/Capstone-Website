import React from "react";
import PhoneInput from "../../../../../shared/components/PhoneInput";

const errBorder = (show, value) =>
 show && !value ? "1.5px solid #dc2626" : undefined;

/**
 * Section 3: Emergency Contact — name, relationship, phone, health concerns.
 */
const EmergencyContactSection = ({
 emergencyContactName, setEmergencyContactName,
 emergencyRelationship, setEmergencyRelationship,
 emergencyContactNumber, setEmergencyContactNumber,
 healthConcerns, setHealthConcerns,
 validateField, fieldErrors,
 showValidationErrors,
}) => (
 <>
 <div className="form-group" data-field="emergencyContactName">
 <label className="form-label">
 Person to Contact in Case of Emergency{" "}
 <span className="rf-required">*</span>
 </label>
 <input
 type="text"
 className="form-input"
 placeholder="Full name of emergency contact"
 value={emergencyContactName}
 onChange={(e) => {
 setEmergencyContactName(e.target.value);
 }}
 onBlur={() =>
 validateField("emergencyContactName", emergencyContactName, (v) => {
 const valid = v && v.trim().length >= 2;
 return {
 valid,
 error: valid ? null : "Please enter the contact person's full name",
 };
 })
 }
 style={{
 border: fieldErrors.emergencyContactName
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, emergencyContactName),
 }}
 />
 <FieldError error={showValidationErrors && !emergencyContactName ? "Emergency contact name is required" : fieldErrors.emergencyContactName} />
 </div>

 <div className="form-row">
 <div className="form-group" data-field="emergencyRelationship">
 <label className="form-label">
 Relationship <span className="rf-required">*</span>
 </label>
 <select
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
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, emergencyRelationship),
 }}
 >
 <option value="">Select relationship...</option>
 <option value="parent">Parent</option>
 <option value="sibling">Sibling</option>
 <option value="spouse">Spouse</option>
 <option value="relative">Relative</option>
 <option value="friend">Friend</option>
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
 Contact Number{" "}
 <span className="rf-required">*</span>
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
 <label className="form-label">
 Any Health Related Concerns? (Please put N/A if not applicable){" "}
 <span className="rf-required">*</span>
 </label>
 <textarea
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
 placeholder="N/A or describe any health concerns"
 maxLength={500}
 style={{
 border: fieldErrors.healthConcerns
 ? "1.5px solid #dc2626"
 : errBorder(showValidationErrors, healthConcerns),
 }}
 />
 <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
 <FieldError
 error={
 showValidationErrors && !healthConcerns
 ? "This field is required (put N/A if not applicable)"
 : fieldErrors.healthConcerns
 }
 />
 <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
 {healthConcerns.length}/500
 </span>
 </div>
 </div>
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

export default EmergencyContactSection;
