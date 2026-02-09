import React, { useState } from "react";
import { PoliciesTermsModal } from "../../modals/PoliciesAndConsent";

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
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const handlePhoneChange = (value) => {
    // Only allow +63 and digits
    const cleaned = value.replace(/[^0-9+]/g, "");
    // Prevent multiple + signs
    const finalValue = cleaned.includes("+")
      ? "+" + cleaned.replace(/\+/g, "")
      : cleaned;
    setVisitorPhone(finalValue);

    // Validate
    if (finalValue && !finalValue.startsWith("+63")) {
      setPhoneError("Phone must start with +63");
    } else {
      setPhoneError("");
    }
  };

  const handleNameChange = (value) => {
    // Remove numbers from input
    const cleanedValue = value.replace(/\d+/g, "");
    setVisitorName(cleanedValue);
  };

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
    <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      <h2 className="stage-title text-2xl font-semibold text-slate-800">
        Visit Scheduling & Policies
      </h2>
      <p className="stage-subtitle text-sm text-gray-500 mt-1">
        Schedule your room visit and review dormitory policies.
      </p>

      {/* ────── SECTION 1: Visit Type Selection ────── */}
      <div className="section-group">
        <h3 className="section-header">🏢 Schedule Your Visit</h3>
        <div className="radio-group">
          <div className="radio-option">
            <input
              type="radio"
              name="verification"
              id="inperson"
              value="inperson"
              checked={viewingType === "inperson"}
              onChange={(e) => setViewingType(e.target.value)}
            />
            <label htmlFor="inperson" className="radio-label">
              <div className="radio-title">In-Person Visit</div>
              <div className="radio-desc">Schedule a visit to our branch</div>
            </label>
          </div>
          <div className="radio-option">
            <input
              type="radio"
              name="verification"
              id="virtual"
              value="virtual"
              checked={viewingType === "virtual"}
              onChange={(e) => setViewingType(e.target.value)}
            />
            <label htmlFor="virtual" className="radio-label">
              <div className="radio-title">Virtual Verification</div>
              <div className="radio-desc">
                For applicants unable to visit in person
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ────── SECTION 2: In-Person Visit Booking Form ────── */}
      {isInPerson && (
        <div className="section-group">
          <h3 className="section-header">📝 Visit Booking Details</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">
                Full Name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your full name (no numbers)"
                maxLength="64"
                value={visitorName || ""}
                onChange={(e) => handleNameChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1.5px solid #999",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
              <div
                style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}
              >
                64 characters max
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Phone Number <span style={{ color: "#EF4444" }}>*</span>{" "}
                <span style={{ fontSize: "11px", color: "#666" }}>
                  (+63...)
                </span>
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder="+63912345678"
                value={visitorPhone || ""}
                onChange={(e) => handlePhoneChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: phoneError
                    ? "1px solid #dc2626"
                    : "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
              {phoneError && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#dc2626",
                    marginTop: "4px",
                  }}
                >
                  {phoneError}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">
                Email Address <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="your@email.com"
                value={visitorEmail || ""}
                onChange={(e) => setVisitorEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Preferred Visit Date <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={visitDate || ""}
                onChange={(e) => setVisitDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Preferred Visit Time <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                className="form-select"
                value={visitTime || ""}
                onChange={(e) => setVisitTime(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              >
                <option value="">Select time</option>
                <option value="08:00 AM">08:00 AM</option>
                <option value="09:00 AM">09:00 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="12:00 PM">12:00 PM</option>
                <option value="01:00 PM">01:00 PM</option>
                <option value="02:00 PM">02:00 PM</option>
                <option value="03:00 PM">03:00 PM</option>
                <option value="04:00 PM">04:00 PM</option>
                <option value="05:00 PM">05:00 PM</option>
                <option value="06:00 PM">06:00 PM</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ────── SECTION 2b: Virtual Visit ────── */}
      {viewingType === "virtual" && (
        <div className="section-group">
          <h3 className="section-header">💻 Virtual Verification</h3>
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="confirm-outoftown"
              checked={isOutOfTown}
              onChange={(e) => setIsOutOfTown(e.target.checked)}
            />
            <label htmlFor="confirm-outoftown" className="checkbox-label">
              I confirm that I am currently unable to visit in person
            </label>
          </div>
        </div>
      )}

      {/* ────── SECTION 3: Policies & Terms ────── */}
      <div className="section-group">
        <h3 className="section-header">📋 Policies, Terms & Conditions</h3>
        <div
          style={{
            padding: "18px",
            background: "#f0f9ff",
            borderRadius: "12px",
            border: "1.5px solid #bfdbfe",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#1e3a8a",
              marginBottom: "12px",
              lineHeight: "1.6",
            }}
          >
            Please review all dormitory policies and terms before submitting
            your visit schedule.
          </div>
          <button
            type="button"
            onClick={() => setShowPoliciesModal(true)}
            style={{
              padding: "8px 16px",
              background: "#E7710F",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Read Full Policies
          </button>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="policies-accepted"
            checked={policiesAccepted}
            onChange={(e) => setPoliciesAccepted(e.target.checked)}
          />
          <label htmlFor="policies-accepted" className="checkbox-label">
            I have read and agree to the dormitory policies, terms & conditions,
            and privacy policy
          </label>
        </div>
      </div>

      {/* ────── Action Buttons ────── */}
      <div className="stage-buttons flex flex-col sm:flex-row gap-3 mt-6">
        <button onClick={onPrev} className="btn btn-secondary">
          Back
        </button>
        <button
          onClick={handleSubmitClick}
          className="btn btn-primary"
          disabled={!canSubmit}
        >
          Submit Visit Schedule
        </button>
      </div>

      {/* ════════ Confirmation Modal ════════ */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: "24px",
              }}
            >
              📋
            </div>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#1F2937",
                margin: "0 0 8px",
              }}
            >
              Confirm Visit Schedule Submission
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#6B7280",
                margin: "0 0 24px",
                lineHeight: "1.5",
              }}
            >
              Are you sure you want to submit your visit schedule? Once
              submitted, you will need to wait for admin approval before
              proceeding.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "500",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#E7710F",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "480px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
            }}
          >
            {/* Receipt Header */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#DEF7EC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                  fontSize: "24px",
                }}
              >
                ✓
              </div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#1F2937",
                  margin: "0 0 4px",
                }}
              >
                Visit Schedule Submitted
              </h3>
              <p style={{ fontSize: "14px", color: "#6B7280", margin: 0 }}>
                Your visit request is awaiting admin confirmation
              </p>
            </div>

            {/* Receipt Reference */}
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                background: "#F0FDF4",
                borderRadius: "8px",
                border: "1px solid #BBF7D0",
                marginBottom: "20px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                }}
              >
                Reference Code
              </p>
              <p
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#166534",
                  fontFamily: "monospace",
                  margin: 0,
                }}
              >
                {reservationCode || "PENDING"}
              </p>
            </div>

            {/* Receipt Details */}
            <div
              style={{ borderTop: "1px dashed #D1D5DB", paddingTop: "16px" }}
            >
              {isInPerson && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      Visitor Name
                    </span>
                    <span
                      style={{
                        color: "#1F2937",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
                      {visitorName}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      Phone
                    </span>
                    <span
                      style={{
                        color: "#1F2937",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
                      {visitorPhone}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      Email
                    </span>
                    <span
                      style={{
                        color: "#1F2937",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
                      {visitorEmail}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      Visit Date
                    </span>
                    <span
                      style={{
                        color: "#1F2937",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      Visit Time
                    </span>
                    <span
                      style={{
                        color: "#1F2937",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
                      {visitTime}
                    </span>
                  </div>
                </>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span style={{ color: "#6B7280", fontSize: "14px" }}>
                  Visit Type
                </span>
                <span
                  style={{
                    color: "#1F2937",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  {isInPerson ? "In-Person Visit" : "Virtual Verification"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span style={{ color: "#6B7280", fontSize: "14px" }}>Room</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  {reservationData?.room?.roomNumber ||
                    reservationData?.room?.name ||
                    reservationData?.room?.title ||
                    "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span style={{ color: "#6B7280", fontSize: "14px" }}>
                  Branch
                </span>
                <span
                  style={{
                    color: "#1F2937",
                    fontSize: "14px",
                    fontWeight: "500",
                    textTransform: "capitalize",
                  }}
                >
                  {reservationData?.room?.branch || "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                }}
              >
                <span style={{ color: "#6B7280", fontSize: "14px" }}>
                  Status
                </span>
                <span
                  style={{
                    color: "#F59E0B",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  ⏳ Awaiting Confirmation
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
              <button
                onClick={handleCloseReceiptAndContinue}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#E7710F",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Continue to Booking Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policies Modal */}
      <PoliciesTermsModal
        isOpen={showPoliciesModal}
        onClose={() => setShowPoliciesModal(false)}
      />
    </div>
  );
};

export default ReservationVisitStep;
