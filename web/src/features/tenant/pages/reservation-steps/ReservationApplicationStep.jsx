import React from "react";

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
        <div className="info-text">
          Please upload clear images of:
          <br />• ID photo (2x2 or selfie)
          <br />• Valid ID (front & back)
          <br />• NBI Clearance
          <br />• Company ID (if employed)
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
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">First Name *</label>
            <input
              type="text"
              className="form-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Middle Name *</label>
            <input
              type="text"
              className="form-input"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nickname *</label>
            <input
              type="text"
              className="form-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Mobile Number *</label>
            <input
              type="tel"
              className="form-input"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+63 912 345 6789"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Birthday *</label>
            <input
              type="date"
              className="form-input"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
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

        <fieldset style={{ border: "none", padding: 0 }}>
          <legend className="form-label">
            Permanent Address: Unit / House No. *
          </legend>
          <input
            type="text"
            className="form-input"
            value={addressUnitHouseNo}
            onChange={(e) => setAddressUnitHouseNo(e.target.value)}
          />
        </fieldset>

        <fieldset style={{ border: "none", padding: 0 }}>
          <legend className="form-label">Permanent Address: Street *</legend>
          <input
            type="text"
            className="form-input"
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
          />
        </fieldset>

        <fieldset style={{ border: "none", padding: 0 }}>
          <legend className="form-label">Permanent Address: Barangay *</legend>
          <input
            type="text"
            className="form-input"
            value={addressBarangay}
            onChange={(e) => setAddressBarangay(e.target.value)}
          />
        </fieldset>

        <div className="form-row">
          <fieldset style={{ border: "none", padding: 0 }}>
            <legend className="form-label">
              Permanent Address: City or Municipality *
            </legend>
            <input
              type="text"
              className="form-input"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
            />
          </fieldset>
          <fieldset style={{ border: "none", padding: 0 }}>
            <legend className="form-label">
              Permanent Address: Region / Province *
            </legend>
            <input
              type="text"
              className="form-input"
              value={addressProvince}
              onChange={(e) => setAddressProvince(e.target.value)}
            />
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
            <label className="form-label">Contact Number *</label>
            <input
              type="tel"
              className="form-input"
              value={emergencyContactNumber}
              onChange={(e) => setEmergencyContactNumber(e.target.value)}
              placeholder="+63 912 345 6789"
            />
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
            value={employerSchool}
            onChange={(e) => setEmployerSchool(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Employer's Address *</label>
          <textarea
            className="form-textarea"
            value={employerAddress}
            onChange={(e) => setEmployerAddress(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Employer's Contact Number *</label>
          <input
            type="tel"
            className="form-input"
            value={employerContact}
            onChange={(e) => setEmployerContact(e.target.value)}
          />
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
          <label className="form-label">
            Occupation / Job Description (if currently looking for a job, please
            indicate so) *
          </label>
          <textarea
            className="form-textarea"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g., Software Engineer, Nurse, Currently Job Hunting"
          />
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
          <label className="form-label">Preferred Room Number</label>
          <input
            type="text"
            className="form-input"
            value={preferredRoomNumber}
            onChange={(e) => setPreferredRoomNumber(e.target.value)}
          />
        </div>

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
            Target Move In Date (If there are any changes, keep us posted) *
          </label>
          <input
            type="date"
            className="form-input"
            value={targetMoveInDate}
            onChange={(e) => setTargetMoveInDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Estimated Time of Move In (Preferably between 8am to 6pm) *
          </label>
          <input
            type="time"
            className="form-input"
            value={estimatedMoveInTime}
            onChange={(e) => setEstimatedMoveInTime(e.target.value)}
          />
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
        <h3 className="section-header">Privacy Consent & Certification</h3>

        <div className="checkbox-group" style={{ marginBottom: "24px" }}>
          <input
            type="checkbox"
            id="privacy-consent"
            checked={agreedToPrivacy}
            onChange={(e) => setAgreedToPrivacy(e.target.checked)}
          />
          <label htmlFor="privacy-consent" className="checkbox-label">
            <strong>Privacy Consent:</strong> By submitting this form, I grant
            Lilycrest / First JRAC Partnership Co. permission to collect and use
            my data for the dormitory's purposes only. I understand that my
            information will be kept confidential and not shared with others. *
          </label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="certification"
            checked={agreedToCertification}
            onChange={(e) => setAgreedToCertification(e.target.checked)}
          />
          <label htmlFor="certification" className="checkbox-label">
            <strong>Certification:</strong> I certify that the facts and
            information above are true and correct to the best of my knowledge
            and belief. I understand that any false information,
            misrepresentation, or omission of facts in this application may be
            justification for refusal or termination of lease. *
          </label>
        </div>
      </div>

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
              setMobileNumber("09171234567");
              setBirthday("1995-05-15");
              setMaritalStatus("single");
              setNationality("Filipino");
              setEducationLevel("college");
              setAddressUnitHouseNo("123");
              setAddressStreet("Rizal Street");
              setAddressBarangay("Barangay 1");
              setAddressCity("Manila");
              setAddressProvince("Metro Manila");
              setEmergencyContactName("Maria Dela Cruz");
              setEmergencyRelationship("Mother");
              setEmergencyContactNumber("09181234567");
              setHealthConcerns("None");
              setEmployerSchool("Sample University");
              setEmployerAddress("123 University Ave, Manila");
              setEmployerContact("02-1234567");
              setStartDate("2024-01-15");
              setOccupation("Student");
              setPreviousEmployment("N/A");
              setReferralSource("friend");
              setReferrerName("Pedro Santos");
              setEstimatedMoveInTime("morning");
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
        <button onClick={onNext} className="btn btn-primary">
          Continue to Payment
        </button>
      </div>
    </div>
  );
};

export default ReservationApplicationStep;
