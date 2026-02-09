import React, { useState } from "react";
import { Calendar, FileText, Home, Monitor, CheckCircle, Clock, User, Mail, Phone, AlertTriangle, ArrowRight } from "lucide-react";

const ReservationVisitStep = ({
  targetMoveInDate,
  viewingType,
  setViewingType,
  isOutOfTown,
  setIsOutOfTown,
  currentLocation,
  setCurrentLocation,
  visitApproved,
  onPrev,
  onNext,
  // Visit booking form fields from parent
  visitorName,
  setVisitorName,
  visitorPhone,
  setVisitorPhone,
  visitorEmail,
  setVisitorEmail,
  visitDate,
  setVisitDate,
  visitTime,
  setVisitTime,
  reservationData,
  reservationCode,
}) => {
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmitClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setIsSubmitted(true);
    setShowReceiptModal(true);
  };

  const handleCloseReceiptAndContinue = () => {
    setShowReceiptModal(false);
    onNext();
  };

  const isInPerson = viewingType === "inperson";
  const isFormComplete = isInPerson
    ? Boolean(
        visitorName && visitorPhone && visitorEmail && visitDate && visitTime,
      )
    : true;
  const canSubmit = policiesAccepted && viewingType && isFormComplete;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ 
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)"
            }}
          >
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 
              className="text-3xl font-bold mb-1"
              style={{ color: "#0C375F" }}
            >
              Visit Scheduling & Policies
            </h2>
            <p className="text-gray-600">
              Schedule your room visit and review dormitory policies
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="space-y-6">
        {/* ────── SECTION 1: Visit Type Selection ────── */}
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
              Schedule Your Visit
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In-Person Visit Card */}
            <label
              className="relative cursor-pointer group"
              htmlFor="inperson"
            >
              <input
                type="radio"
                name="verification"
                id="inperson"
                value="inperson"
                checked={viewingType === "inperson"}
                onChange={(e) => setViewingType(e.target.value)}
                className="peer sr-only"
              />
              <div
                className="p-5 rounded-xl border-2 transition-all duration-200 peer-checked:shadow-lg"
                style={{
                  borderColor: viewingType === "inperson" ? "#E7710F" : "#E5E7EB",
                  backgroundColor: viewingType === "inperson" ? "#FEF3E7" : "#FAFAFA",
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: viewingType === "inperson" ? "#E7710F" : "#E5E7EB",
                    }}
                  >
                    <Home className="w-6 h-6" style={{ color: viewingType === "inperson" ? "white" : "#6B7280" }} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold mb-1" style={{ color: "#0C375F" }}>
                      In-Person Visit
                    </h4>
                    <p className="text-sm text-gray-600">
                      Schedule a visit to our branch
                    </p>
                  </div>
                  {viewingType === "inperson" && (
                    <CheckCircle className="w-5 h-5" style={{ color: "#E7710F" }} />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Available Mon-Sat, 9AM-5PM</span>
                </div>
              </div>
            </label>

            {/* Virtual Visit Card */}
            <label
              className="relative cursor-pointer group"
              htmlFor="virtual"
            >
              <input
                type="radio"
                name="verification"
                id="virtual"
                value="virtual"
                checked={viewingType === "virtual"}
                onChange={(e) => setViewingType(e.target.value)}
                className="peer sr-only"
              />
              <div
                className="p-5 rounded-xl border-2 transition-all duration-200 peer-checked:shadow-lg"
                style={{
                  borderColor: viewingType === "virtual" ? "#E7710F" : "#E5E7EB",
                  backgroundColor: viewingType === "virtual" ? "#FEF3E7" : "#FAFAFA",
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: viewingType === "virtual" ? "#E7710F" : "#E5E7EB",
                    }}
                  >
                    <Monitor className="w-6 h-6" style={{ color: viewingType === "virtual" ? "white" : "#6B7280" }} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold mb-1" style={{ color: "#0C375F" }}>
                      Virtual Verification
                    </h4>
                    <p className="text-sm text-gray-600">
                      For applicants unable to visit
                    </p>
                  </div>
                  {viewingType === "virtual" && (
                    <CheckCircle className="w-5 h-5" style={{ color: "#E7710F" }} />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Remote verification process</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* ────── SECTION 2: In-Person Visit Booking Form ────── */}
        {isInPerson && (
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
                Visit Booking Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    placeholder="Enter your full name"
                    value={visitorName || ""}
                    onChange={(e) => setVisitorName(e.target.value)}
                    style={{
                      borderColor: "#E5E7EB",
                      focusRing: "#E7710F"
                    }}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Phone className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    placeholder="09XX XXX XXXX"
                    value={visitorPhone || ""}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    style={{
                      borderColor: "#E5E7EB",
                    }}
                  />
                </div>
              </div>

              {/* Email Address */}
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
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    placeholder="your@email.com"
                    value={visitorEmail || ""}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    style={{
                      borderColor: "#E5E7EB",
                    }}
                  />
                </div>
              </div>

              {/* Preferred Visit Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Visit Date <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    value={visitDate || ""}
                    onChange={(e) => setVisitDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    style={{
                      borderColor: "#E5E7EB",
                    }}
                  />
                </div>
              </div>

              {/* Preferred Visit Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Visit Time <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50 appearance-none bg-white"
                    value={visitTime || ""}
                    onChange={(e) => setVisitTime(e.target.value)}
                    style={{
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <option value="">Select time</option>
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="01:00 PM">01:00 PM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="03:00 PM">03:00 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ────── SECTION 2b: Virtual Visit ────── */}
        {viewingType === "virtual" && (
          <div 
            className="bg-white rounded-2xl shadow-lg border p-6"
            style={{ borderColor: "#E5E7EB" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#FEF3E7" }}
              >
                <Monitor className="w-5 h-5" style={{ color: "#E7710F" }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
                Virtual Verification
              </h3>
            </div>

            <div
              className="p-4 rounded-xl mb-4"
              style={{ backgroundColor: "#FEF3E7", border: "1px solid #FED7AA" }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="confirm-outoftown"
                  checked={isOutOfTown}
                  onChange={(e) => setIsOutOfTown(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300"
                  style={{ accentColor: "#E7710F" }}
                />
                <span className="text-sm font-medium text-gray-700">
                  I confirm that I am currently unable to visit in person
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Location (Optional)
              </label>
              <select
                className="w-full px-4 py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50 appearance-none bg-white"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                style={{
                  borderColor: "#E5E7EB",
                }}
              >
                <option value="">Select city/province</option>
                <option>Cebu</option>
                <option>Davao</option>
                <option>Iloilo</option>
                <option>Baguio</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        )}

        {/* ────── SECTION 3: Policies & Terms ────── */}
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
              Policies, Terms & Conditions
            </h3>
          </div>

          <div
            className="rounded-xl p-5 mb-5 overflow-auto"
            style={{
              maxHeight: "240px",
              backgroundColor: "#FAFAFA",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              lineHeight: "1.8",
              color: "#374151",
            }}
          >
            <h4 className="font-semibold mb-3" style={{ color: "#0C375F" }}>
              Dormitory House Rules & Regulations:
            </h4>
            <ol style={{ paddingLeft: "20px" }} className="space-y-2">
              <li>Occupancy limit per room must be strictly followed.</li>
              <li>Quiet hours: 10:00 PM – 8:00 AM daily.</li>
              <li>No pets allowed on the premises at any time.</li>
              <li>Common areas must be kept clean after use.</li>
              <li>Guests are allowed only with prior management approval.</li>
              <li>Minimum lease term: 1 month. Maximum: 12 months.</li>
              <li>Smoking and alcohol are prohibited inside the dormitory.</li>
              <li>All personal belongings must be kept inside your assigned room.</li>
              <li>Management may conduct periodic inspections with 24-hour notice.</li>
              <li>Damage to property will be charged to the tenant's account.</li>
            </ol>
            
            <h4 className="font-semibold mt-5 mb-3" style={{ color: "#0C375F" }}>
              Privacy Policy:
            </h4>
            <p>
              Your personal information will be collected and processed in accordance with the Data Privacy Act of 2012. Information provided will be used solely for reservation and tenancy purposes.
            </p>
          </div>

          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: "#FEF3E7", border: "1px solid #FED7AA" }}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="policies-accepted"
                checked={policiesAccepted}
                onChange={(e) => setPoliciesAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300"
                style={{ accentColor: "#E7710F" }}
              />
              <span className="text-sm font-medium text-gray-700">
                I have read and agree to the dormitory policies, terms & conditions, and privacy policy
              </span>
            </label>
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
            onClick={handleSubmitClick}
            disabled={!canSubmit}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: canSubmit ? "#E7710F" : "#D1D5DB",
              boxShadow: canSubmit ? "0 4px 14px rgba(231, 113, 15, 0.25)" : "none"
            }}
          >
            Submit Visit Schedule
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ════════ Confirmation Modal ════════ */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-md w-11/12 shadow-2xl"
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: "#E7710F" }} />
            </div>
            <h3
              className="text-xl font-bold text-center mb-3"
              style={{ color: "#0C375F" }}
            >
              Confirm Visit Schedule Submission
            </h3>
            <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
              Are you sure you want to submit your visit schedule? Once submitted, you will need to wait for admin approval before proceeding.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-6 py-3 rounded-xl font-semibold text-gray-700 border-2 transition-all hover:bg-gray-50"
                style={{ borderColor: "#E5E7EB" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: "#E7710F" }}
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ Visit Booking Receipt Modal ════════ */}
      {showReceiptModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-auto shadow-2xl"
          >
            {/* Receipt Header */}
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: "#D1FAE5" }}
              >
                <CheckCircle className="w-8 h-8" style={{ color: "#059669" }} />
              </div>
              <h3
                className="text-2xl font-bold mb-2"
                style={{ color: "#0C375F" }}
              >
                Visit Schedule Submitted
              </h3>
              <p className="text-sm text-gray-600">
                Your visit request is awaiting admin confirmation
              </p>
            </div>

            {/* Receipt Reference */}
            <div
              className="text-center p-4 rounded-xl mb-6"
              style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Reference Code
              </p>
              <p
                className="text-2xl font-bold font-mono"
                style={{ color: "#166534" }}
              >
                {reservationCode || "PENDING"}
              </p>
            </div>

            {/* Receipt Details */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E7EB" }}
            >
              {isInPerson && (
                <>
                  <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                    <span className="text-sm text-gray-600">Visitor Name</span>
                    <span className="text-sm font-semibold text-gray-900">{visitorName}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                    <span className="text-sm text-gray-600">Phone</span>
                    <span className="text-sm font-semibold text-gray-900">{visitorPhone}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                    <span className="text-sm text-gray-600">Email</span>
                    <span className="text-sm font-semibold text-gray-900">{visitorEmail}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                    <span className="text-sm text-gray-600">Visit Date</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {visitDate
                        ? new Date(visitDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                    <span className="text-sm text-gray-600">Visit Time</span>
                    <span className="text-sm font-semibold text-gray-900">{visitTime}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                <span className="text-sm text-gray-600">Visit Type</span>
                <span className="text-sm font-semibold text-gray-900">
                  {isInPerson ? "In-Person Visit" : "Virtual Verification"}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                <span className="text-sm text-gray-600">Room</span>
                <span className="text-sm font-semibold text-gray-900">
                  {reservationData?.room?.roomNumber ||
                    reservationData?.room?.name ||
                    reservationData?.room?.title ||
                    "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
                <span className="text-sm text-gray-600">Branch</span>
                <span className="text-sm font-semibold text-gray-900 capitalize">
                  {reservationData?.room?.branch || "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-gray-600">Status</span>
                <span
                  className="text-sm font-bold flex items-center gap-1"
                  style={{ color: "#F59E0B" }}
                >
                  <Clock className="w-4 h-4" />
                  Awaiting Confirmation
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <button
              onClick={handleCloseReceiptAndContinue}
              className="w-full px-6 py-4 rounded-xl font-semibold text-white transition-all hover:shadow-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: "#E7710F" }}
            >
              Continue to Booking Summary
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationVisitStep;
