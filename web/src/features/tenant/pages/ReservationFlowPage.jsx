import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { showNotification } from "../../../shared/utils/notification";
import { reservationApi, roomApi } from "../../../shared/api/apiClient";
import "../../../shared/styles/notification.css";
import "../styles/reservation-flow.css";

const RESERVATION_STAGES = [
  { id: 1, label: "Summary" },
  { id: 2, label: "Visit" },
  { id: 3, label: "Details" },
  { id: 4, label: "Payment" },
  { id: 5, label: "Done" },
];

function ReservationFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Room data
  const [reservationData, setReservationData] = useState(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [visitApproved, setVisitApproved] = useState(false);

  // DEV MODE: Bypass validation
  const [devBypassValidation, setDevBypassValidation] = useState(false);

  // Stage 1: Summary
  const [targetMoveInDate, setTargetMoveInDate] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("12"); // months
  const [billingEmail, setBillingEmail] = useState(user?.email || "");

  // Stage 2: Visit
  const [viewingType, setViewingType] = useState("inperson");
  const [isOutOfTown, setIsOutOfTown] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("");

  // Stage 3: Details - Photo Upload
  const [selfiePhoto, setSelfiePhoto] = useState(null);

  // Stage 3: Details - Personal Information
  const [firstName, setFirstName] = useState(
    user?.displayName?.split(" ")[0] || "",
  );
  const [lastName, setLastName] = useState(
    user?.displayName?.split(" ")[1] || "",
  );
  const [middleName, setMiddleName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [birthday, setBirthday] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("single");
  const [nationality, setNationality] = useState("Filipino");
  const [educationLevel, setEducationLevel] = useState("college");
  const [addressUnitHouseNo, setAddressUnitHouseNo] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressBarangay, setAddressBarangay] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [validIDFront, setValidIDFront] = useState(null);
  const [validIDBack, setValidIDBack] = useState(null);
  const [nbiClearance, setNbiClearance] = useState(null);
  const [nbiReason, setNbiReason] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");

  // Stage 3: Details - Emergency Information
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyContactNumber, setEmergencyContactNumber] = useState("");
  const [healthConcerns, setHealthConcerns] = useState("");

  // Stage 3: Details - Employment Information
  const [employerSchool, setEmployerSchool] = useState("");
  const [employerAddress, setEmployerAddress] = useState("");
  const [employerContact, setEmployerContact] = useState("");
  const [startDate, setStartDate] = useState("");
  const [occupation, setOccupation] = useState("");
  const [companyID, setCompanyID] = useState(null);
  const [companyIDReason, setCompanyIDReason] = useState("");
  const [previousEmployment, setPreviousEmployment] = useState("");

  // Stage 3: Details - Dorm Related Questions
  const [roomType, setRoomType] = useState("quadruple");
  const [preferredRoomNumber, setPreferredRoomNumber] = useState("");
  const [referralSource, setReferralSource] = useState("other");
  const [referrerName, setReferrerName] = useState("");
  const [estimatedMoveInTime, setEstimatedMoveInTime] = useState("08:00");
  const [workSchedule, setWorkSchedule] = useState("day");
  const [workScheduleOther, setWorkScheduleOther] = useState("");

  // Stage 3: Agreements
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToCertification, setAgreedToCertification] = useState(false);

  // Stage 4: Payment
  const [finalMoveInDate, setFinalMoveInDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [proofOfPayment, setProofOfPayment] = useState(null);

  // Stage 5: Success
  const [reservationCode, setReservationCode] = useState("");

  // Confirmation Modals
  const [showLoginConfirm, setShowLoginConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Form change tracking
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [initialFormState, setInitialFormState] = useState({
    targetMoveInDate: "",
    leaseDuration: "12",
    billingEmail: "",
  });

  useEffect(() => {
    if (!user) {
      setShowLoginConfirm(true);
      return;
    }

    // Get reservation data from navigation state or session storage
    const state = location.state?.roomData;
    if (state) {
      setReservationData(state);
    } else {
      const stored = sessionStorage.getItem("pendingReservation");
      if (stored) {
        setReservationData(JSON.parse(stored));
      } else {
        showNotification("No room selected. Redirecting...", "warning", 2000);
        setTimeout(() => navigate("/check-availability"), 2000);
      }
    }

    // Set default target move-in date to 1 week from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setTargetMoveInDate(defaultDate.toISOString().split("T")[0]);
    setFinalMoveInDate(defaultDate.toISOString().split("T")[0]);

    // Set initial form state for change tracking
    setInitialFormState({
      targetMoveInDate: defaultDate.toISOString().split("T")[0],
      leaseDuration: "12",
      billingEmail: user?.email || "",
    });
  }, [user, navigate, location]);

  // Track form changes (only for Stage 1)
  useEffect(() => {
    if (currentStage === 1) {
      const hasChanges =
        targetMoveInDate !== initialFormState.targetMoveInDate ||
        leaseDuration !== initialFormState.leaseDuration ||
        billingEmail !== initialFormState.billingEmail;
      setIsFormDirty(hasChanges);
    }
  }, [
    targetMoveInDate,
    leaseDuration,
    billingEmail,
    initialFormState,
    currentStage,
  ]);

  const handleNextStage = async () => {
    try {
      // Validate current stage
      if (currentStage === 1) {
        if (!devBypassValidation && (!targetMoveInDate || !billingEmail)) {
          showNotification("Please fill in all summary fields", "error", 3000);
          return;
        }
        setCurrentStage(2);
      } else if (currentStage === 2) {
        if (!devBypassValidation && viewingType === "virtual" && !isOutOfTown) {
          showNotification(
            "Please confirm you are out of town for virtual tour",
            "error",
            3000,
          );
          return;
        }
        // Simulate visiting approval
        setVisitApproved(true);
        setCurrentStage(3);
      } else if (currentStage === 3) {
        // Validate required fields
        if (
          !devBypassValidation &&
          (!selfiePhoto ||
            !firstName ||
            !lastName ||
            !middleName ||
            !nickname ||
            !mobileNumber ||
            !birthday ||
            !maritalStatus ||
            !nationality ||
            !educationLevel ||
            !addressUnitHouseNo ||
            !addressStreet ||
            !addressBarangay ||
            !addressCity ||
            !addressProvince ||
            !validIDFront ||
            !validIDBack ||
            !nbiClearance ||
            !emergencyContactName ||
            !emergencyRelationship ||
            !emergencyContactNumber ||
            !healthConcerns ||
            !employerSchool ||
            !employerContact ||
            !occupation ||
            !targetMoveInDate ||
            !estimatedMoveInTime ||
            !leaseDuration ||
            !workSchedule ||
            (workSchedule === "others" && !workScheduleOther) ||
            !agreedToPrivacy ||
            !agreedToCertification)
        ) {
          showNotification(
            "Please fill in all required fields and upload all documents",
            "error",
            3000,
          );
          return;
        }
        setCurrentStage(4);
      } else if (currentStage === 4) {
        if (!devBypassValidation && !proofOfPayment) {
          showNotification("Please upload proof of payment", "error", 3000);
          return;
        }

        if (!reservationData?.room) {
          showNotification(
            "Room details are missing. Please try again.",
            "error",
            3000,
          );
          return;
        }

        setIsLoading(true);

        let checkInDate = finalMoveInDate || targetMoveInDate;

        // Ensure checkInDate has a value (for bypass mode testing)
        if (!checkInDate) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          checkInDate = tomorrow.toISOString().split("T")[0];
        }

        const totalPrice =
          Number(reservationData.room.price || 0) +
          Number(reservationData.applianceFees || 0);

        const normalizeRoomName = (room) => {
          const raw = room?.id || room?.name || room?.roomNumber || room?.title;
          if (!raw) return "";
          return String(raw)
            .replace(/^Room\s+/i, "")
            .trim();
        };

        const roomName = normalizeRoomName(reservationData.room);
        if (!roomName) {
          showNotification(
            "Room details are incomplete. Please reselect a room.",
            "error",
            3000,
          );
          return;
        }

        const rooms = await roomApi.getAll();
        const matchedRoom = rooms.find(
          (room) => room.name === roomName || room.roomNumber === roomName,
        );

        if (!matchedRoom) {
          showNotification(
            "Room not found in the database. Please try again.",
            "error",
            3000,
          );
          return;
        }

        // Helper function to use test data when devBypassValidation is on
        const getFieldValue = (value, defaultValue = "") => {
          return devBypassValidation && !value ? defaultValue : value;
        };

        const response = await reservationApi.create({
          // Room Info
          roomId: matchedRoom._id,

          // Bed Assignment
          selectedBed: reservationData?.selectedBed
            ? {
                id: reservationData.selectedBed.id,
                position: reservationData.selectedBed.position,
              }
            : null,

          // Stage 1: Summary
          targetMoveInDate: getFieldValue(targetMoveInDate, finalMoveInDate),
          leaseDuration: getFieldValue(leaseDuration, "12"),
          billingEmail: getFieldValue(
            billingEmail,
            user?.email || "test@example.com",
          ),

          // Stage 2: Visit
          viewingType: getFieldValue(viewingType, "inperson"),
          isOutOfTown: getFieldValue(isOutOfTown, false),
          currentLocation: getFieldValue(currentLocation, "Philippines"),
          visitApproved: true,

          // Stage 3: Photos
          selfiePhotoUrl:
            selfiePhoto?.name || (devBypassValidation ? "selfie.jpg" : null),

          // Stage 3: Personal Information
          firstName: getFieldValue(firstName, "Test"),
          lastName: getFieldValue(lastName, "User"),
          middleName: getFieldValue(middleName, ""),
          nickname: getFieldValue(nickname, "TestUser"),
          mobileNumber: getFieldValue(mobileNumber, "09123456789"),
          birthday: getFieldValue(birthday, "1990-01-01"),
          maritalStatus: getFieldValue(maritalStatus, "single"),
          nationality: getFieldValue(nationality, "Filipino"),
          educationLevel: getFieldValue(educationLevel, "college"),

          // Stage 3: Address
          addressUnitHouseNo: getFieldValue(addressUnitHouseNo, "Unit 123"),
          addressStreet: getFieldValue(addressStreet, "Test Street"),
          addressBarangay: getFieldValue(addressBarangay, "Test Barangay"),
          addressCity: getFieldValue(addressCity, "Manila"),
          addressProvince: getFieldValue(addressProvince, "NCR"),

          // Stage 3: Identity Documents
          validIDFrontUrl:
            validIDFront?.name || (devBypassValidation ? "id-front.jpg" : null),
          validIDBackUrl:
            validIDBack?.name || (devBypassValidation ? "id-back.jpg" : null),
          nbiClearanceUrl:
            nbiClearance?.name || (devBypassValidation ? "nbi.jpg" : null),
          nbiReason: getFieldValue(nbiReason, "Employment"),
          companyIDUrl:
            companyID?.name || (devBypassValidation ? "company-id.jpg" : null),
          companyIDReason: getFieldValue(companyIDReason, "Verification"),

          // Stage 3: Emergency Contact
          emergencyContactName: getFieldValue(
            emergencyContactName,
            "Emergency Name",
          ),
          emergencyRelationship: getFieldValue(emergencyRelationship, "Friend"),
          emergencyContactNumber: getFieldValue(
            emergencyContactNumber,
            "09987654321",
          ),
          healthConcerns: getFieldValue(healthConcerns, "None"),

          // Stage 3: Employment
          employerSchool: getFieldValue(employerSchool, "Test Company"),
          employerAddress: getFieldValue(employerAddress, "Company Address"),
          employerContact: getFieldValue(employerContact, "09111111111"),
          startDate: getFieldValue(startDate, "2024-01-01"),
          occupation: getFieldValue(occupation, "Developer"),
          previousEmployment: getFieldValue(previousEmployment, "None"),

          // Stage 3: Dorm Related
          roomType: getFieldValue(roomType, "quadruple"),
          preferredRoomNumber: getFieldValue(preferredRoomNumber, ""),
          referralSource: getFieldValue(referralSource, "other"),
          referrerName: getFieldValue(referrerName, ""),
          estimatedMoveInTime: getFieldValue(estimatedMoveInTime, "09:00"),
          workSchedule: getFieldValue(workSchedule, "day"),
          workScheduleOther: getFieldValue(workScheduleOther, ""),

          // Stage 3: Agreements
          agreedToPrivacy: devBypassValidation ? true : agreedToPrivacy,
          agreedToCertification: devBypassValidation
            ? true
            : agreedToCertification,

          // Stage 4: Payment
          proofOfPaymentUrl:
            proofOfPayment?.name ||
            (devBypassValidation ? "payment.jpg" : null),

          // Dates & Pricing
          checkInDate,
          totalPrice: totalPrice > 0 ? totalPrice : 5000, // Fallback price for testing
          applianceFees: reservationData.applianceFees || 0,
        });

        // Use the reservation code from backend (stored in database)
        // NOT generated from MongoDB ID
        const actualCode =
          response.reservationCode || response.reservation?.reservationCode;
        setReservationCode(actualCode || "CODE-ERROR");
        setCurrentStage(5);
        showNotification(
          "Reservation confirmed successfully!",
          "success",
          3000,
        );
      }
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create reservation. Please try again.";
      showNotification(message, "error", 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevStage = () => {
    if (currentStage === 1) {
      // Only show confirmation when at stage 1 AND form has been modified
      if (isFormDirty) {
        setShowCancelConfirm(true);
      } else {
        // Navigate back directly if no changes
        navigate("/check-availability");
      }
    } else if (currentStage > 1) {
      // Go back to previous stage directly
      setCurrentStage(currentStage - 1);
    }
  };

  const handleCancelConfirmed = () => {
    setShowCancelConfirm(false);
    navigate("/check-availability");
  };

  const handleCancelDismissed = () => {
    setShowCancelConfirm(false);
  };

  const handleLoginConfirmed = () => {
    setShowLoginConfirm(false);
    navigate("/signin");
  };

  const handleLoginDismissed = () => {
    setShowLoginConfirm(false);
    navigate("/check-availability");
  };

  // Login Confirmation Modal Component
  const LoginConfirmModal = () => {
    if (!showLoginConfirm) return null;
    return (
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
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "400px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
          <h2
            style={{
              marginBottom: "12px",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Login Required
          </h2>
          <p style={{ marginBottom: "24px", color: "#666", lineHeight: "1.6" }}>
            You need to be logged in to complete your reservation. Your
            reservation data will be saved.
          </p>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              onClick={handleLoginDismissed}
              style={{
                padding: "10px 24px",
                border: "2px solid #ddd",
                background: "white",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                color: "#333",
              }}
            >
              Go Back
            </button>
            <button
              onClick={handleLoginConfirmed}
              style={{
                padding: "10px 24px",
                background: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Cancel Confirmation Modal Component
  const CancelConfirmModal = () => {
    if (!showCancelConfirm) return null;
    return (
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
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "400px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
          <h2
            style={{
              marginBottom: "12px",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Discard Changes?
          </h2>
          <p style={{ marginBottom: "24px", color: "#666", lineHeight: "1.6" }}>
            Are you sure you want to go back? Your current progress will be lost
            and you'll need to start over.
          </p>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              onClick={handleCancelDismissed}
              style={{
                padding: "10px 24px",
                border: "2px solid #ddd",
                background: "white",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                color: "#333",
              }}
            >
              Continue
            </button>
            <button
              onClick={handleCancelConfirmed}
              style={{
                padding: "10px 24px",
                background: "#FF6B6B",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  };

  const simulateVisitApproval = () => {
    setVisitApproved(true);
    showNotification(
      "Visit approved! You can now proceed to next step.",
      "success",
      2000,
    );
  };

  const handleMoveInDateUpdate = () => {
    const tomorrow = new Date(finalMoveInDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFinalMoveInDate(tomorrow.toISOString().slice(0, 16));
  };

  if (!reservationData) {
    return (
      <div className="reservation-flow-container">
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p>Loading reservation details...</p>
        </div>
      </div>
    );
  }

  const progressPercent =
    ((currentStage - 1) / (RESERVATION_STAGES.length - 1)) * 100;

  return (
    <div className="reservation-flow-container">
      {/* Login Confirmation Modal */}
      <LoginConfirmModal />

      {/* Cancel Confirmation Modal */}
      <CancelConfirmModal />

      {/* Header */}
      <div className="reservation-header">
        <h1 className="reservation-title">Dormitory Reservation</h1>
        <p className="reservation-subtitle">
          Complete your booking in simple steps
        </p>
      </div>

      {/* Progress Steps */}
      <div className="progress-container">
        <div className="progress-steps">
          <div className="progress-line"></div>
          <div
            className="progress-line-active"
            style={{ width: progressPercent + "%" }}
          ></div>

          {RESERVATION_STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`progress-step ${
                stage.id < currentStage
                  ? "completed"
                  : stage.id === currentStage
                    ? "active"
                    : ""
              }`}
            >
              <div className="step-circle">{stage.id}</div>
              <div className="step-label">{stage.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage 1: Summary */}
      {currentStage === 1 && (
        <div className="reservation-card">
          <h2 className="stage-title">Reservation Summary</h2>
          <p className="stage-subtitle">
            Confirm your intent before proceeding. Review what you're reserving.
          </p>

          <div className="section-group">
            <h3 className="section-header">Room Information</h3>
            <div className="summary-section">
              <div className="summary-row">
                <span className="summary-label">Selected Branch</span>
                <span className="summary-value">
                  {reservationData?.room?.branch || "N/A"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Room Type</span>
                <span className="summary-value">
                  {reservationData?.room?.type || "N/A"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Room Number</span>
                <span className="summary-value">
                  {reservationData?.room?.title ||
                    reservationData?.room?.id ||
                    "N/A"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Monthly Rent</span>
                <span className="summary-value">
                  ₱{(reservationData?.room?.price || 0).toLocaleString()}
                </span>
              </div>
              {reservationData?.selectedBed && (
                <div className="summary-row">
                  <span className="summary-label">Selected Bed</span>
                  <span
                    className="summary-value"
                    style={{ textTransform: "capitalize" }}
                  >
                    {reservationData.selectedBed.position} Bed (
                    {reservationData.selectedBed.id})
                  </span>
                </div>
              )}
              {reservationData?.applianceFees > 0 && (
                <div className="summary-row">
                  <span className="summary-label">Appliance Fees</span>
                  <span className="summary-value">
                    ₱{reservationData.applianceFees.toLocaleString()}/month
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="section-group">
            <h3 className="section-header">Reservation Details</h3>
            <div className="form-group">
              <label className="form-label">Target Move-In Date & Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={targetMoveInDate}
                onChange={(e) => setTargetMoveInDate(e.target.value)}
              />
              <div className="form-helper">
                This date and time is initial and can be adjusted later
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Lease Duration *</label>
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
              <label className="form-label">Billing Email *</label>
              <input
                type="email"
                className="form-input"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="statements@example.com"
              />
              <div className="form-helper">
                Used for monthly billing statements
              </div>
            </div>
          </div>

          {/* DEV MODE BUTTON */}
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "#fff3cd",
              borderRadius: "8px",
              border: "1px solid #ffc107",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={devBypassValidation}
                onChange={(e) => setDevBypassValidation(e.target.checked)}
              />
              <span style={{ fontSize: "13px", color: "#856404" }}>
                🔧 DEV MODE: Bypass validation (Testing only)
              </span>
            </label>
          </div>

          <div className="stage-buttons">
            <button onClick={() => navigate(-1)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleNextStage} className="btn btn-primary">
              Confirm & Continue
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Visit Verification */}
      {currentStage === 2 && (
        <div className="reservation-card">
          <h2 className="stage-title">Room Verification</h2>
          <p className="stage-subtitle">
            Verify your identity and room availability before proceeding.
          </p>

          <div className="info-box">
            <div className="info-box-title">ℹ️ What Happens Here</div>
            <div className="info-text">
              We'll confirm your room is available on your target move-in date (
              {targetMoveInDate}). Select how you'd like to verify yourself.
            </div>
          </div>

          <div className="section-group">
            <h3 className="section-header">Verification Method</h3>
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
                  <div className="radio-desc">
                    Schedule a visit to our branch
                  </div>
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

          {viewingType === "virtual" && (
            <div className="section-group">
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

              <div className="form-group">
                <label className="form-label">
                  Current Location (Optional)
                </label>
                <select
                  className="form-select"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
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

          {!visitApproved && (
            <button
              onClick={simulateVisitApproval}
              className="btn btn-secondary btn-full"
              style={{ marginTop: "16px" }}
            >
              Simulate Verification (Demo)
            </button>
          )}

          {visitApproved && (
            <div
              className="info-box"
              style={{
                background: "rgba(82, 165, 124, 0.06)",
                borderLeftColor: "#52a57c",
              }}
            >
              <div className="info-box-title">✅ Verification Approved</div>
              <div className="info-text">
                Room availability confirmed. You may now proceed to provide your
                details.
              </div>
            </div>
          )}

          <div className="stage-buttons">
            <button onClick={handlePrevStage} className="btn btn-secondary">
              Back
            </button>
            <button
              onClick={handleNextStage}
              className="btn btn-primary"
              disabled={!visitApproved}
            >
              Continue to Details
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Applicant Registration Form */}
      {currentStage === 3 && (
        <div className="reservation-card">
          <h2 className="stage-title">Complete Your Application</h2>
          <p className="stage-subtitle">
            Please provide the following information to complete your
            registration.
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

          {/* Email & Photo Section */}
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

          {/* Personal Information */}
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
              <legend className="form-label">
                Permanent Address: Street *
              </legend>
              <input
                type="text"
                className="form-input"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
              />
            </fieldset>

            <fieldset style={{ border: "none", padding: 0 }}>
              <legend className="form-label">
                Permanent Address: Barangay *
              </legend>
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

            {/* ID Documents */}
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

          {/* Emergency Contact Information */}
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
                Any Health Related Concerns? (Please put N/A if not applicable)
                *
              </label>
              <textarea
                className="form-textarea"
                value={healthConcerns}
                onChange={(e) => setHealthConcerns(e.target.value)}
                placeholder="N/A or describe any health concerns"
              />
            </div>
          </div>

          {/* Employment Information */}
          <div className="section-group">
            <h3 className="section-header">Employment Information</h3>
            <div className="section-helper">
              If not yet employed, please put N/A. For students, please put name
              of school instead of employer.
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
                Occupation / Job Description (if currently looking for a job,
                please indicate so) *
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

          {/* Dorm Related Questions */}
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
                  If You Answered "Others", Please Specify Your Work Schedule
                  Below *
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

          {/* Privacy & Certification */}
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
                <strong>Privacy Consent:</strong> By submitting this form, I
                grant Lilycrest / First JRAC Partnership Co. permission to
                collect and use my data for the dormitory's purposes only. I
                understand that my information will be kept confidential and not
                shared with others. *
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
                information above are true and correct to the best of my
                knowledge and belief. I understand that any false information,
                misrepresentation, or omission of facts in this application may
                be justification for refusal or termination of lease. *
              </label>
            </div>
          </div>

          {/* DEV MODE BUTTON */}
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "#fff3cd",
              borderRadius: "8px",
              border: "1px solid #ffc107",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={devBypassValidation}
                onChange={(e) => setDevBypassValidation(e.target.checked)}
              />
              <span style={{ fontSize: "13px", color: "#856404" }}>
                🔧 DEV MODE: Bypass validation (Testing only)
              </span>
            </label>
          </div>

          <div className="stage-buttons">
            <button onClick={handlePrevStage} className="btn btn-secondary">
              Back
            </button>
            <button onClick={handleNextStage} className="btn btn-primary">
              Continue to Payment
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Payment */}
      {currentStage === 4 && (
        <div className="reservation-card">
          <h2 className="stage-title">Reservation Fee Payment</h2>
          <p className="stage-subtitle">
            Review your final details and secure your reservation with a ₱2,000
            fee.
          </p>

          {/* Final Review */}
          <div className="section-group">
            <h3 className="section-header">Reservation Details</h3>
            <div className="summary-section">
              <div className="summary-row">
                <span className="summary-label">Branch</span>
                <span className="summary-value">
                  {reservationData.room.branch}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Room Type</span>
                <span className="summary-value">
                  {reservationData.room.type}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Monthly Rent</span>
                <span className="summary-value">
                  ₱{reservationData.room.price.toLocaleString()}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Lease Duration</span>
                <span className="summary-value">{leaseDuration} months</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Target Move-In Date</span>
                <span className="summary-value">{finalMoveInDate}</span>
              </div>
              <div className="total-section">
                <span>Reservation Fee</span>
                <span className="total-amount">₱2,000</span>
              </div>
            </div>
          </div>

          {/* Move-In Date Update */}
          <div className="section-group">
            <h3 className="section-header">Final Move-In Date</h3>
            <p className="section-helper">
              Need to adjust your move-in date? We'll verify availability again.
            </p>
            <div className="form-group">
              <label className="form-label">
                Update Move-In Date (Optional)
              </label>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
              >
                <input
                  type="date"
                  className="form-input"
                  value={finalMoveInDate}
                  onChange={(e) => setFinalMoveInDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleMoveInDateUpdate}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Re-Check
                </button>
              </div>
              <div className="form-helper">
                Availability will be re-verified if you change the date
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="section-group">
            <h3 className="section-header">Payment Method</h3>
            <div className="form-group">
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="bank">Bank Transfer</option>
                <option value="gcash">GCash</option>
                <option value="card">Credit/Debit Card</option>
                <option value="check">Check</option>
              </select>
            </div>

            <div className="info-box">
              <div className="info-box-title">💳 Payment Details</div>
              <div className="info-text">
                <strong>Bank Account:</strong> BDO - 1234-5678-9012
                <br />
                <strong>Account Name:</strong> Dormitory Services Inc.
                <br />
                <strong>Amount:</strong> ₱2,000
              </div>
            </div>
          </div>

          {/* Proof of Payment */}
          <div className="section-group">
            <h3 className="section-header">Proof of Payment</h3>
            <div className="form-group">
              <label className="file-upload" htmlFor="payment-file">
                <input
                  id="payment-file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setProofOfPayment(e.target.files?.[0] || null)
                  }
                />
                <div className="file-icon">💳</div>
                <div className="file-text">
                  {proofOfPayment
                    ? proofOfPayment.name
                    : "Upload receipt or screenshot"}
                </div>
              </label>
            </div>
          </div>

          <div className="stage-buttons">
            <button onClick={handlePrevStage} className="btn btn-secondary">
              Back
            </button>
            <button
              onClick={handleNextStage}
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Confirm Payment & Reserve"}
            </button>
          </div>
        </div>
      )}

      {/* Stage 5: Confirmation */}
      {currentStage === 5 && (
        <div className="reservation-card confirmation-card">
          <div className="success-icon">✓</div>
          <h2 className="stage-title">Reservation Confirmed!</h2>
          <p className="stage-subtitle">
            Your dormitory reservation has been successfully secured.
          </p>

          <div className="reservation-code">
            <div className="code-label">Reservation Code</div>
            <div className="code-value">{reservationCode}</div>
          </div>

          {/* Confirmation Details */}
          <div className="section-group">
            <h3 className="section-header">Reservation Summary</h3>
            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-label">Branch</span>
                <span className="detail-value">
                  {reservationData.room.branch}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Room Type</span>
                <span className="detail-value">
                  {reservationData.room.type}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Monthly Rate</span>
                <span className="detail-value">
                  ₱{reservationData.room.price.toLocaleString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Final Move-In Date</span>
                <span className="detail-value">{finalMoveInDate}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Payment Status</span>
                <span className="detail-value" style={{ color: "#52a57c" }}>
                  ✓ Paid
                </span>
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div className="section-group">
            <h3 className="section-header">📋 What's Next</h3>
            <div className="info-box">
              <div className="info-box-title">Important Reminders</div>
              <div className="info-text">
                <strong>Move-In Date:</strong> {finalMoveInDate}
                <br />
                <strong>Reservation Valid Until:</strong>{" "}
                {new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ).toLocaleDateString()}
                <br />
                <br />
                <strong>Required Documents for Check-In:</strong>
                <br />• Valid ID (Government-issued)
                <br />• This reservation code
                <br />• First month's rent payment
                <br />
                <br />
                <strong>Admin Contact:</strong> (02) 123-4567 or
                reservations@lilycrest.com
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={() => navigate("/tenant/profile")}
              className="btn btn-primary btn-full"
            >
              View Reservation Details
            </button>
            <button
              onClick={() => navigate("/")}
              className="btn btn-secondary btn-full"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReservationFlowPage;
