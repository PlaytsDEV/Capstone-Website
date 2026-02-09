import React from "react";
import {
  Briefcase,
  Camera,
  FileText,
  FlaskConical,
  IdCard,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Building,
  Heart,
  Clock,
  Upload,
  CheckCircle,
  Users,
  Home,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

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
    <div className="max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)",
            }}
          >
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-1" style={{ color: "#0C375F" }}>
              Complete Your Application
            </h2>
            <p className="text-gray-600">
              Please provide the following information to complete your registration
            </p>
          </div>
        </div>
      </div>

      {/* Required Documents Alert */}
      <div
        className="mb-6 p-5 rounded-2xl border-2"
        style={{
          backgroundColor: "#EFF6FF",
          borderColor: "#BFDBFE",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#DBEAFE" }}
          >
            <FileText className="w-5 h-5" style={{ color: "#1E40AF" }} />
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: "#1E3A8A" }}>
              Required Documents
            </h4>
            <ul className="text-sm space-y-1" style={{ color: "#1E40AF" }}>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                ID photo (2x2 or selfie)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Valid ID (front & back)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                NBI Clearance
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Company ID (if employed)
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ═══════ Email & Photo Section ═══════ */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <Mail className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Email & Photo
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm bg-gray-50"
                  value={billingEmail}
                  disabled
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This is where we'll send your billing statements
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2x2 Photo or Selfie Photo <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <label
                className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400 hover:bg-orange-50"
                htmlFor="selfie-photo"
                style={{ borderColor: selfiePhoto ? "#E7710F" : "#E5E7EB" }}
              >
                <input
                  id="selfie-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelfiePhoto(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: selfiePhoto ? "#FEF3E7" : "#F3F4F6",
                  }}
                >
                  <Camera
                    className="w-6 h-6"
                    style={{ color: selfiePhoto ? "#E7710F" : "#6B7280" }}
                  />
                </div>
                <div className="flex-1">
                  <p
                    className="text-sm font-medium"
                    style={{ color: selfiePhoto ? "#E7710F" : "#374151" }}
                  >
                    {selfiePhoto ? selfiePhoto.name : "Upload clear 2x2 or selfie photo"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selfiePhoto ? "Click to change" : "JPG, PNG up to 5MB"}
                  </p>
                </div>
                {selfiePhoto && <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />}
              </label>
            </div>
          </div>
        </div>

        {/* ═══════ Personal Information Section ═══════ */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <User className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Personal Information
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dela Cruz"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            {/* Middle Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Middle Name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-xl text-sm"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Santos"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nickname <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-xl text-sm"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="JD"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Phone className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="tel"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+63 912 345 6789"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            {/* Birthday */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Birthday <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="date"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            {/* Marital Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marital Status <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                className="w-full px-4 py-3 border rounded-xl text-sm appearance-none bg-white"
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                style={{ borderColor: "#E5E7EB" }}
              >
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Nationality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nationality <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-xl text-sm"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Filipino"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            {/* Educational Attainment */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Educational Attainment <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                className="w-full px-4 py-3 border rounded-xl text-sm appearance-none bg-white"
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value)}
                style={{ borderColor: "#E5E7EB" }}
              >
                <option value="highschool">High School</option>
                <option value="college">College</option>
                <option value="vocational">Vocational</option>
                <option value="graduate">Graduate</option>
              </select>
            </div>
          </div>

          {/* Address Section */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5" style={{ color: "#E7710F" }} />
              <h4 className="text-base font-semibold" style={{ color: "#0C375F" }}>
                Permanent Address
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit / House No. <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-xl text-sm"
                  value={addressUnitHouseNo}
                  onChange={(e) => setAddressUnitHouseNo(e.target.value)}
                  placeholder="123"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-xl text-sm"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  placeholder="Rizal Street"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barangay <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-xl text-sm"
                  value={addressBarangay}
                  onChange={(e) => setAddressBarangay(e.target.value)}
                  placeholder="Barangay 1"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City or Municipality <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-xl text-sm"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  placeholder="Manila"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Region / Province <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-xl text-sm"
                  value={addressProvince}
                  onChange={(e) => setAddressProvince(e.target.value)}
                  placeholder="Metro Manila"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>
          </div>

          {/* ID Upload Section */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-center gap-2 mb-4">
              <IdCard className="w-5 h-5" style={{ color: "#E7710F" }} />
              <h4 className="text-base font-semibold" style={{ color: "#0C375F" }}>
                Valid Identification
              </h4>
            </div>

            <div className="space-y-4">
              {/* Valid ID Front */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valid ID (Front) <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <label
                  className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400 hover:bg-orange-50"
                  htmlFor="valid-id-front"
                  style={{ borderColor: validIDFront ? "#E7710F" : "#E5E7EB" }}
                >
                  <input
                    id="valid-id-front"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setValidIDFront(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: validIDFront ? "#FEF3E7" : "#F3F4F6",
                    }}
                  >
                    <IdCard
                      className="w-6 h-6"
                      style={{ color: validIDFront ? "#E7710F" : "#6B7280" }}
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: validIDFront ? "#E7710F" : "#374151" }}
                    >
                      {validIDFront ? validIDFront.name : "Upload Valid ID (Front)"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {validIDFront ? "Click to change" : "JPG, PNG, PDF up to 5MB"}
                    </p>
                  </div>
                  {validIDFront && <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />}
                </label>
              </div>

              {/* Valid ID Back */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valid ID (Back) <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <label
                  className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400 hover:bg-orange-50"
                  htmlFor="valid-id-back"
                  style={{ borderColor: validIDBack ? "#E7710F" : "#E5E7EB" }}
                >
                  <input
                    id="valid-id-back"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setValidIDBack(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: validIDBack ? "#FEF3E7" : "#F3F4F6",
                    }}
                  >
                    <IdCard
                      className="w-6 h-6"
                      style={{ color: validIDBack ? "#E7710F" : "#6B7280" }}
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: validIDBack ? "#E7710F" : "#374151" }}
                    >
                      {validIDBack ? validIDBack.name : "Upload Valid ID (Back)"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {validIDBack ? "Click to change" : "JPG, PNG, PDF up to 5MB"}
                    </p>
                  </div>
                  {validIDBack && <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />}
                </label>
              </div>

              {/* NBI Clearance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NBI Clearance (If unable, upload another valid ID){" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <label
                  className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400 hover:bg-orange-50"
                  htmlFor="nbi-clearance"
                  style={{ borderColor: nbiClearance ? "#E7710F" : "#E5E7EB" }}
                >
                  <input
                    id="nbi-clearance"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setNbiClearance(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: nbiClearance ? "#FEF3E7" : "#F3F4F6",
                    }}
                  >
                    <FileText
                      className="w-6 h-6"
                      style={{ color: nbiClearance ? "#E7710F" : "#6B7280" }}
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: nbiClearance ? "#E7710F" : "#374151" }}
                    >
                      {nbiClearance ? nbiClearance.name : "Upload NBI Clearance"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nbiClearance ? "Click to change" : "JPG, PNG, PDF up to 5MB"}
                    </p>
                  </div>
                  {nbiClearance && <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />}
                </label>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    If not yet available, please indicate reason below
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
                    value={nbiReason}
                    onChange={(e) => setNbiReason(e.target.value)}
                    placeholder="You may also put 'N/A' if already submitted"
                    rows={2}
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Personal Notes */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: "#E5E7EB" }}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Notes (Only for corporate accounts)
            </label>
            <textarea
              className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              rows={3}
              style={{ borderColor: "#E5E7EB" }}
            />
          </div>
        </div>

        {/* ═══════ Emergency Contact Section ═══════ */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEE2E2" }}
            >
              <Heart className="w-5 h-5" style={{ color: "#DC2626" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Emergency Contact Information
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Person to Contact in Case of Emergency{" "}
                <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Users className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Maria Dela Cruz"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  className="w-full px-4 py-3 border rounded-xl text-sm appearance-none bg-white"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <option value="">Select Relationship</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="relative">Relative</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Phone className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                    value={emergencyContactNumber}
                    onChange={(e) => setEmergencyContactNumber(e.target.value)}
                    placeholder="+63 918 123 4567"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Any Health Related Concerns? (Please put N/A if not applicable){" "}
                <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <textarea
                className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
                value={healthConcerns}
                onChange={(e) => setHealthConcerns(e.target.value)}
                placeholder="N/A or describe any health concerns"
                rows={3}
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
          </div>
        </div>

        {/* ═══════ Employment Information Section ═══════ */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <Briefcase className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
                Employment Information
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                If not yet employed, please put N/A. For students, please put name of
                school instead of employer.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Employer <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Building className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={employerSchool}
                  onChange={(e) => setEmployerSchool(e.target.value)}
                  placeholder="Company name or school"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employer's Address <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <textarea
                className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
                value={employerAddress}
                onChange={(e) => setEmployerAddress(e.target.value)}
                placeholder="123 University Ave, Manila"
                rows={2}
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employer's Contact Number <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Phone className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                    value={employerContact}
                    onChange={(e) => setEmployerContact(e.target.value)}
                    placeholder="02-1234567"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employed Since
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Occupation / Job Description (if currently looking for a job, please
                indicate so) <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <textarea
                className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g., Software Engineer, Nurse, Currently Job Hunting"
                rows={3}
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company ID
              </label>
              <label
                className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400 hover:bg-orange-50"
                htmlFor="company-id"
                style={{ borderColor: companyID ? "#E7710F" : "#E5E7EB" }}
              >
                <input
                  id="company-id"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setCompanyID(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: companyID ? "#FEF3E7" : "#F3F4F6",
                  }}
                >
                  <Briefcase
                    className="w-6 h-6"
                    style={{ color: companyID ? "#E7710F" : "#6B7280" }}
                  />
                </div>
                <div className="flex-1">
                  <p
                    className="text-sm font-medium"
                    style={{ color: companyID ? "#E7710F" : "#374151" }}
                  >
                    {companyID ? companyID.name : "Upload Company ID"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {companyID ? "Click to change" : "JPG, PNG, PDF up to 5MB"}
                  </p>
                </div>
                {companyID && <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />}
              </label>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  If not yet available, please indicate reason below{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
                  value={companyIDReason}
                  onChange={(e) => setCompanyIDReason(e.target.value)}
                  placeholder="N/A if Company ID has been submitted"
                  rows={2}
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Previous Employment (Please answer N/A if not applicable)
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-xl text-sm"
                value={previousEmployment}
                onChange={(e) => setPreviousEmployment(e.target.value)}
                placeholder="Previous company name or N/A"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
          </div>
        </div>

        {/* ═══════ Dorm Related Questions Section ═══════ */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <Home className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Dorm Related Questions
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Room Number
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-xl text-sm"
                value={preferredRoomNumber}
                onChange={(e) => setPreferredRoomNumber(e.target.value)}
                placeholder="e.g., GP-D-001"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How Did You First Learn About Lilycrest Gil Puyat?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: "facebook", label: "Facebook Ad" },
                  { value: "instagram", label: "Instagram" },
                  { value: "tiktok", label: "TikTok" },
                  { value: "walkin", label: "Walk-in" },
                  { value: "friend", label: "Referred by a Friend" },
                  { value: "other", label: "Other" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      borderColor:
                        referralSource === option.value ? "#E7710F" : "#E5E7EB",
                      backgroundColor:
                        referralSource === option.value ? "#FEF3E7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="referral"
                      value={option.value}
                      checked={referralSource === option.value}
                      onChange={(e) => setReferralSource(e.target.value)}
                      className="w-4 h-4"
                      style={{ accentColor: "#E7710F" }}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {referralSource === "friend" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  If Personally Referred, Please Indicate the Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-xl text-sm"
                  value={referrerName}
                  onChange={(e) => setReferrerName(e.target.value)}
                  placeholder="Referrer's name"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Move In Date{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                    value={targetMoveInDate}
                    onChange={(e) => setTargetMoveInDate(e.target.value)}
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  If there are any changes, keep us posted
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time of Move In{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="time"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                    value={estimatedMoveInTime}
                    onChange={(e) => setEstimatedMoveInTime(e.target.value)}
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Preferably between 8am to 6pm
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration of Lease <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                className="w-full px-4 py-3 border rounded-xl text-sm appearance-none bg-white"
                value={leaseDuration}
                onChange={(e) => setLeaseDuration(e.target.value)}
                style={{ borderColor: "#E5E7EB" }}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Work Schedule <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div className="space-y-3">
                {[
                  {
                    value: "day",
                    id: "dayshift",
                    label: "Day Shift (around 9 am to 5 pm)",
                  },
                  {
                    value: "night",
                    id: "nightshift",
                    label: "Night Shift (around 11 pm to 7 am)",
                  },
                  { value: "others", id: "others", label: "Others" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      borderColor:
                        workSchedule === option.value ? "#E7710F" : "#E5E7EB",
                      backgroundColor:
                        workSchedule === option.value ? "#FEF3E7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="schedule"
                      id={option.id}
                      value={option.value}
                      checked={workSchedule === option.value}
                      onChange={(e) => setWorkSchedule(e.target.value)}
                      className="w-4 h-4"
                      style={{ accentColor: "#E7710F" }}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {workSchedule === "others" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  If You Answered "Others", Please Specify Your Work Schedule Below{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border rounded-xl text-sm resize-none"
                  value={workScheduleOther}
                  onChange={(e) => setWorkScheduleOther(e.target.value)}
                  placeholder="Please describe your typical work schedule"
                  rows={3}
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ═══════ Privacy Consent & Certification Section ═══════ */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <FileText className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Privacy Consent & Certification
            </h3>
          </div>

          <div className="space-y-4">
            <div
              className="p-4 rounded-xl border-2"
              style={{ backgroundColor: "#FEF3E7", borderColor: "#FED7AA" }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="privacy-consent"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 flex-shrink-0"
                  style={{ accentColor: "#E7710F" }}
                />
                <span className="text-sm text-gray-700">
                  <strong style={{ color: "#0C375F" }}>Privacy Consent:</strong> By
                  submitting this form, I grant Lilycrest / First JRAC Partnership Co.
                  permission to collect and use my data for the dormitory's purposes
                  only. I understand that my information will be kept confidential and
                  not shared with others. <span style={{ color: "#EF4444" }}>*</span>
                </span>
              </label>
            </div>

            <div
              className="p-4 rounded-xl border-2"
              style={{ backgroundColor: "#FEF3E7", borderColor: "#FED7AA" }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="certification"
                  checked={agreedToCertification}
                  onChange={(e) => setAgreedToCertification(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 flex-shrink-0"
                  style={{ accentColor: "#E7710F" }}
                />
                <span className="text-sm text-gray-700">
                  <strong style={{ color: "#0C375F" }}>Certification:</strong> I
                  certify that the facts and information above are true and correct to
                  the best of my knowledge and belief. I understand that any false
                  information, misrepresentation, or omission of facts in this
                  application may be justification for refusal or termination of lease.{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Simulation Helper Button */}
        <div
          className="p-5 rounded-2xl border-2"
          style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#DBEAFE" }}
              >
                <FlaskConical className="w-5 h-5" style={{ color: "#1E40AF" }} />
              </div>
              <div>
                <h4 className="font-semibold mb-1" style={{ color: "#1E3A8A" }}>
                  Simulation Mode
                </h4>
                <p className="text-xs" style={{ color: "#1E40AF" }}>
                  Fill all required fields with sample data for testing purposes
                </p>
              </div>
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
                setEmergencyRelationship("parent");
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
                setTargetMoveInDate("2024-03-01");
                setEstimatedMoveInTime("10:00");
                setLeaseDuration("6");
                setWorkSchedule("day");
                setAgreedToPrivacy(true);
                setAgreedToCertification(true);
                setPersonalNotes("Sample application for testing");
                setNbiReason("N/A");
                setCompanyIDReason("N/A");
              }}
              className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg whitespace-nowrap"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Fill Sample Data
            </button>
          </div>
        </div>

        {/* ────── Action Buttons ────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPrev}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 border-2 transition-all hover:bg-gray-50"
            style={{ borderColor: "#E5E7EB" }}
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)",
            }}
          >
            Continue to Payment
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationApplicationStep;
