import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { showNotification } from "../../../shared/utils/notification";
import { reservationApi, roomApi } from "../../../shared/api/apiClient";
import "../../../shared/styles/notification.css";
import "../styles/reservation-flow.css";
import ReservationSummaryStep from "./reservation-steps/ReservationSummaryStep";
import ReservationVisitStep from "./reservation-steps/ReservationVisitStep";
import ReservationApplicationStep from "./reservation-steps/ReservationApplicationStep";
import ReservationPaymentStep from "./reservation-steps/ReservationPaymentStep";
import ReservationConfirmationStep from "./reservation-steps/ReservationConfirmationStep";

// Helper function to convert File to base64 data URL
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

const RESERVATION_STAGES = [
  { id: 1, label: "Room Selection" },
  { id: 2, label: "Visit & Policies" },
  { id: 3, label: "Visit Scheduled" },
  { id: 4, label: "Application" },
  { id: 5, label: "Payment" },
  { id: 6, label: "Confirmation" },
];

function ReservationFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const stepFromState = Number(location.state?.step);
  const stepFromQuery = Number(
    new URLSearchParams(location.search).get("step"),
  );
  const stepOverride = Number.isInteger(stepFromState)
    ? stepFromState
    : Number.isInteger(stepFromQuery)
      ? stepFromQuery
      : null;
  const isStepMode = Boolean(stepOverride);

  // Room data
  const [reservationData, setReservationData] = useState(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [visitApproved, setVisitApproved] = useState(false);
  const [reservationId, setReservationId] = useState(null);

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
  // Stage 2: Visit Booking Form
  const [visitorName, setVisitorName] = useState(user?.displayName || "");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorEmail, setVisitorEmail] = useState(user?.email || "");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

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

    // Check if continuing existing reservation from ProfilePage
    const continueReservation = location.state?.continueFlow;
    const editMode = location.state?.editMode;
    const reservationId = location.state?.reservationId;

    if ((continueReservation || editMode) && reservationId) {
      loadExistingReservation(reservationId);
    } else {
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

    if (!continueReservation && stepOverride) {
      setCurrentStage(stepOverride);
    }
  }, [user, navigate, location]);

  // Load existing reservation data to continue flow
  const loadExistingReservation = async (reservationId) => {
    try {
      setIsLoading(true);
      const reservation = await reservationApi.getById(reservationId);
      setReservationId(reservation._id || reservationId);
      if (reservation.reservationCode) {
        setReservationCode(reservation.reservationCode);
      }

      // Set reservation data from existing reservation
      setReservationData({
        room: reservation.roomId,
        selectedBed: reservation.selectedBed,
        appliances: reservation.selectedAppliances || [],
      });

      // Populate all form fields from existing reservation
      if (reservation.targetMoveInDate)
        setTargetMoveInDate(reservation.targetMoveInDate);
      if (reservation.leaseDuration)
        setLeaseDuration(reservation.leaseDuration);
      if (reservation.billingEmail) setBillingEmail(reservation.billingEmail);

      if (reservation.viewingType) setViewingType(reservation.viewingType);
      if (reservation.isOutOfTown !== undefined)
        setIsOutOfTown(reservation.isOutOfTown);
      if (reservation.currentLocation)
        setCurrentLocation(reservation.currentLocation);
      if (reservation.visitApproved !== undefined)
        setVisitApproved(reservation.visitApproved);

      if (reservation.firstName) setFirstName(reservation.firstName);
      if (reservation.lastName) setLastName(reservation.lastName);
      if (reservation.middleName) setMiddleName(reservation.middleName);
      if (reservation.nickname) setNickname(reservation.nickname);
      if (reservation.mobileNumber) setMobileNumber(reservation.mobileNumber);
      if (reservation.birthday) setBirthday(reservation.birthday);
      if (reservation.maritalStatus)
        setMaritalStatus(reservation.maritalStatus);
      if (reservation.nationality) setNationality(reservation.nationality);
      if (reservation.educationLevel)
        setEducationLevel(reservation.educationLevel);

      if (reservation.addressUnitHouseNo)
        setAddressUnitHouseNo(reservation.addressUnitHouseNo);
      if (reservation.addressStreet)
        setAddressStreet(reservation.addressStreet);
      if (reservation.addressBarangay)
        setAddressBarangay(reservation.addressBarangay);
      if (reservation.addressCity) setAddressCity(reservation.addressCity);
      if (reservation.addressProvince)
        setAddressProvince(reservation.addressProvince);

      if (reservation.emergencyContactName)
        setEmergencyContactName(reservation.emergencyContactName);
      if (reservation.emergencyRelationship)
        setEmergencyRelationship(reservation.emergencyRelationship);
      if (reservation.emergencyContactNumber)
        setEmergencyContactNumber(reservation.emergencyContactNumber);
      if (reservation.healthConcerns)
        setHealthConcerns(reservation.healthConcerns);

      if (reservation.employerSchool)
        setEmployerSchool(reservation.employerSchool);
      if (reservation.employerAddress)
        setEmployerAddress(reservation.employerAddress);
      if (reservation.employerContact)
        setEmployerContact(reservation.employerContact);
      if (reservation.startDate) setStartDate(reservation.startDate);
      if (reservation.occupation) setOccupation(reservation.occupation);
      if (reservation.previousEmployment)
        setPreviousEmployment(reservation.previousEmployment);

      if (reservation.roomType) setRoomType(reservation.roomType);
      if (reservation.preferredRoomNumber)
        setPreferredRoomNumber(reservation.preferredRoomNumber);
      if (reservation.referralSource)
        setReferralSource(reservation.referralSource);
      if (reservation.referrerName) setReferrerName(reservation.referrerName);
      if (reservation.estimatedMoveInTime)
        setEstimatedMoveInTime(reservation.estimatedMoveInTime);
      if (reservation.workSchedule) setWorkSchedule(reservation.workSchedule);

      // Determine which stage to start at based on reservation status
      const hasVisitScheduled = Boolean(
        reservation.viewingType && reservation.agreedToPrivacy,
      );
      const isVisitApproved = Boolean(reservation.visitApproved === true);
      const hasApplication = Boolean(
        reservation.firstName &&
        reservation.lastName &&
        reservation.mobileNumber,
      );
      const hasPayment = Boolean(reservation.proofOfPaymentUrl);
      const isConfirmed =
        reservation.reservationStatus === "confirmed" ||
        reservation.paymentStatus === "paid";

      if (isConfirmed) {
        setCurrentStage(6); // Confirmation
      } else if (hasPayment) {
        setCurrentStage(6); // Awaiting confirmation
      } else if (hasApplication) {
        setCurrentStage(5); // Payment stage
      } else if (isVisitApproved) {
        setCurrentStage(4); // Application stage
      } else if (hasVisitScheduled) {
        setCurrentStage(3); // Visit scheduled - waiting for admin
      } else {
        setCurrentStage(2); // Visit stage
      }

      if (stepOverride) {
        setCurrentStage(stepOverride);
      }

      const message = stepOverride
        ? "Editing your application. Make your changes and save."
        : "Reservation data loaded. Continue where you left off!";
      showNotification(message, "success", 3000);
    } catch (err) {
      console.error("Error loading reservation:", err);
      const status = err?.response?.status;
      if (status === 404) {
        showNotification(
          "Reservation not found. It may have been removed or expired.",
          "error",
          3000,
        );
        navigate("/tenant/profile");
      } else if (status === 401 || status === 403) {
        showNotification(
          "Please sign in to continue your reservation.",
          "error",
          3000,
        );
        navigate("/signin");
      } else {
        showNotification("Failed to load reservation data", "error", 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  const advanceStage = (nextStage) => {
    if (isStepMode) {
      showNotification("Changes saved successfully!", "success", 2500);
      navigate("/tenant/profile");
      return;
    }

    setCurrentStage(nextStage);
  };

  const getFieldValue = (value, defaultValue = "") => {
    return devBypassValidation && !value ? defaultValue : value;
  };

  const normalizeRoomName = (room) => {
    const raw = room?.id || room?.name || room?.roomNumber || room?.title;
    if (!raw) return "";
    return String(raw)
      .replace(/^Room\s+/i, "")
      .trim();
  };

  const resolveRoomId = async () => {
    // Try to get room ID from different possible properties
    // The room object might have _id (from API) or roomId (from mapped CheckAvailability)
    const directId =
      reservationData?.room?._id || reservationData?.room?.roomId;
    if (directId) {
      return directId;
    }

    const roomName = normalizeRoomName(reservationData?.room);
    if (!roomName) {
      return null;
    }

    const rooms = await roomApi.getAll();
    const matchedRoom = rooms.find(
      (room) => room.name === roomName || room.roomNumber === roomName,
    );

    return matchedRoom?._id || null;
  };

  const getCheckInDate = () => {
    return targetMoveInDate || finalMoveInDate;
  };

  const getTotalPrice = () => {
    return (
      Number(reservationData?.room?.price || 0) +
      Number(reservationData?.applianceFees || 0)
    );
  };

  const createReservationDraft = async (payloadOverrides = {}) => {
    const roomId = await resolveRoomId();
    if (!roomId) {
      showNotification(
        "Room details are missing. Please reselect a room.",
        "error",
        3000,
      );
      return null;
    }

    const checkInDate = getCheckInDate();
    if (!checkInDate) {
      showNotification("Please set a move-in date.", "error", 3000);
      return null;
    }

    const totalPrice = getTotalPrice();

    const response = await reservationApi.create({
      roomId,
      selectedBed: reservationData?.selectedBed
        ? {
            id: reservationData.selectedBed.id,
            position: reservationData.selectedBed.position,
          }
        : null,
      targetMoveInDate: getFieldValue(targetMoveInDate, checkInDate),
      leaseDuration: getFieldValue(leaseDuration, "12"),
      billingEmail: getFieldValue(
        billingEmail,
        user?.email || "test@example.com",
      ),
      checkInDate,
      totalPrice: totalPrice > 0 ? totalPrice : 5000,
      applianceFees: reservationData?.applianceFees || 0,
      // Explicitly null out later-stage fields to prevent schema defaults
      viewingType: null,
      agreedToPrivacy: false,
      visitApproved: false,
      ...payloadOverrides,
    });

    const createdReservation = response?.reservation || response;
    const createdId = response?.reservationId || createdReservation?._id;
    if (createdId) {
      setReservationId(createdId);
    }
    if (createdReservation?.reservationCode) {
      setReservationCode(createdReservation.reservationCode);
    }

    return createdReservation;
  };

  const updateReservationDraft = async (payloadOverrides = {}) => {
    if (!reservationId) {
      return createReservationDraft(payloadOverrides);
    }

    const response = await reservationApi.updateByUser(
      reservationId,
      payloadOverrides,
    );
    return response?.reservation || response;
  };

  const [showStageConfirm, setShowStageConfirm] = useState(false);
  const [pendingStageAction, setPendingStageAction] = useState(null);

  const handleNextStage = async () => {
    try {
      // Stage 1: Room Selection - show confirmation
      if (currentStage === 1) {
        if (!reservationData?.room) {
          showNotification("Please select a room to continue", "error", 3000);
          return;
        }
        setPendingStageAction("stage1");
        setShowStageConfirm(true);
        return;
      }
      // Stage 2: Visit Scheduling & Policies
      else if (currentStage === 2) {
        if (!devBypassValidation && (!viewingType || !targetMoveInDate)) {
          showNotification("Please select visit type and date", "error", 3000);
          return;
        }
        // Save policies acknowledgment, visit data, and booking form fields
        const visitPayload = {
          agreedToPrivacy: true,
          viewingType,
          isOutOfTown,
          currentLocation: isOutOfTown ? currentLocation : undefined,
        };
        // Save visitor booking details if in-person
        if (viewingType === "inperson") {
          visitPayload.firstName = visitorName?.split(" ")[0] || firstName;
          visitPayload.lastName =
            visitorName?.split(" ").slice(1).join(" ") || lastName;
          visitPayload.mobileNumber = visitorPhone || mobileNumber;
          visitPayload.billingEmail = visitorEmail || billingEmail;
        }
        await updateReservationDraft(visitPayload);
        advanceStage(3);
      }
      // Stage 3: Visit Scheduled (read-only receipt — redirect to profile, wait for admin)
      else if (currentStage === 3) {
        showNotification(
          "Your visit has been scheduled! Return to your profile to track progress.",
          "success",
          3000,
        );
        navigate("/tenant/profile");
      }
      // Stage 4: Application (no admin approval needed - flows directly to payment)
      else if (currentStage === 4) {
        // Validate application data
        if (
          !devBypassValidation &&
          (!firstName || !lastName || !mobileNumber)
        ) {
          showNotification("Please fill in all required fields", "error", 3000);
          return;
        }
        // Save application data
        const applicationPayload = {
          firstName,
          lastName,
          middleName,
          nickname,
          mobileNumber,
          birthday,
          maritalStatus,
          nationality,
          educationLevel,
          address: {
            unitHouseNo: addressUnitHouseNo,
            street: addressStreet,
            barangay: addressBarangay,
            city: addressCity,
            province: addressProvince,
          },
          emergencyContactName,
          emergencyRelationship,
          emergencyContactNumber,
          healthConcerns,
          employerSchool,
          employerAddress,
          employerContact,
          startDate,
          occupation,
          previousEmployment,
          roomType,
          preferredRoomNumber,
          referralSource,
          referrerName,
          estimatedMoveInTime,
          workSchedule,
          workScheduleOther,
          agreedToCertification,
        };
        await updateReservationDraft(applicationPayload);
        advanceStage(5);
      }
      // Stage 5: Payment
      else if (currentStage === 5) {
        if (!proofOfPayment) {
          showNotification("Please upload proof of payment", "error", 3000);
          return;
        }
        // Convert file to base64 data URL
        const proofOfPaymentUrl = await fileToBase64(proofOfPayment);
        // Save payment data
        const paymentPayload = {
          finalMoveInDate,
          paymentMethod,
          proofOfPaymentUrl,
        };
        await updateReservationDraft(paymentPayload);
        advanceStage(6);
      }
      // Stage 6: Confirmation - done
      else if (currentStage === 6) {
        navigate("/tenant/profile");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to process reservation. Please try again.";
      showNotification(message, "error", 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevStage = () => {
    if (isStepMode) {
      navigate("/tenant/profile");
      return;
    }

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

  // Stage Confirmation Handler
  const handleStageConfirm = async () => {
    setShowStageConfirm(false);
    try {
      if (pendingStageAction === "stage1") {
        // Create reservation draft in DB (only if not already created)
        if (!reservationId) {
          const draft = await createReservationDraft();
          if (!draft) return;
        }
        advanceStage(2);
      } else if (pendingStageAction === "stage4") {
        // Reservation stays as "pending" until admin confirms
        showNotification(
          "Reservation submitted successfully!",
          "success",
          3000,
        );
        navigate("/tenant/profile");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to process reservation. Please try again.";
      showNotification(message, "error", 3000);
    }
    setPendingStageAction(null);
  };

  // Stage Confirmation Modal Component
  const StageConfirmModal = () => {
    if (!showStageConfirm) return null;

    const isStage1 = pendingStageAction === "stage1";
    const title = isStage1
      ? "Confirm Room Selection"
      : "Confirm Reservation Submission";
    const message = isStage1
      ? "Are you sure you want to proceed with this room selection? A reservation draft will be created."
      : "Are you sure you want to submit your reservation? Once submitted, you will need to wait for admin confirmation.";
    const icon = isStage1 ? "🏠" : "✅";

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
            {icon}
          </div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: "#1F2937",
              margin: "0 0 8px",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: "14px",
              color: "#6B7280",
              margin: "0 0 24px",
              lineHeight: "1.5",
            }}
          >
            {message}
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => {
                setShowStageConfirm(false);
                setPendingStageAction(null);
              }}
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
              onClick={handleStageConfirm}
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
              Yes, Proceed
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleMoveInDateUpdate = () => {
    const tomorrow = new Date(finalMoveInDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFinalMoveInDate(tomorrow.toISOString().slice(0, 16));
  };

  if (!reservationData) {
    return (
      <div className="reservation-flow-container min-h-screen bg-slate-50 py-8">
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
    <div className="reservation-flow-container min-h-screen bg-slate-50 py-8">
      {/* Login Confirmation Modal */}
      <LoginConfirmModal />

      {/* Cancel Confirmation Modal */}
      <CancelConfirmModal />

      {/* Stage Confirmation Modal */}
      <StageConfirmModal />

      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="reservation-header bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-6">
          <h1 className="reservation-title text-2xl font-semibold text-slate-800">
            Dormitory Reservation
          </h1>
          <p className="reservation-subtitle text-sm text-gray-500 mt-1">
            Complete your booking in simple steps
          </p>

          {/* Progress Steps */}
          {!isStepMode ? (
            <div className="progress-container mt-6">
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
          ) : (
            <div className="mt-4 text-sm text-gray-500">
              Step {currentStage} of {RESERVATION_STAGES.length}
            </div>
          )}
        </div>

        {/* Stage 1: Room Selection & Summary */}
        {currentStage === 1 && (
          <ReservationSummaryStep
            reservationData={reservationData}
            onNext={handleNextStage}
          />
        )}

        {/* Stage 2: Visit Scheduling & Policies */}
        {currentStage === 2 && (
          <ReservationVisitStep
            targetMoveInDate={targetMoveInDate}
            viewingType={viewingType}
            setViewingType={setViewingType}
            isOutOfTown={isOutOfTown}
            setIsOutOfTown={setIsOutOfTown}
            currentLocation={currentLocation}
            setCurrentLocation={setCurrentLocation}
            visitApproved={visitApproved}
            onPrev={handlePrevStage}
            onNext={handleNextStage}
            visitorName={visitorName}
            setVisitorName={setVisitorName}
            visitorPhone={visitorPhone}
            setVisitorPhone={setVisitorPhone}
            visitorEmail={visitorEmail}
            setVisitorEmail={setVisitorEmail}
            visitDate={visitDate}
            setVisitDate={setVisitDate}
            visitTime={visitTime}
            setVisitTime={setVisitTime}
            reservationData={reservationData}
            reservationCode={reservationCode}
          />
        )}

        {/* Stage 3: Visit Schedule Confirmation (Read-Only Receipt) */}
        {currentStage === 3 && (
          <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <div className="text-center mb-6">
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>📋</div>
              <h2 className="stage-title text-2xl font-semibold text-slate-800">
                Visit Schedule Confirmation
              </h2>
              <p className="stage-subtitle text-sm text-gray-500 mt-1">
                Your visit has been scheduled. Please review the details below.
              </p>
            </div>

            {/* Visit Receipt Card */}
            <div
              style={{
                border: "2px solid #E5E7EB",
                borderRadius: "12px",
                padding: "24px",
                background: "#FAFAFA",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px dashed #D1D5DB",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Visit Reference
                  </p>
                  <p style={{ fontWeight: "600", color: "#1F2937" }}>
                    {reservationCode || "Pending"}
                  </p>
                </div>
                <span
                  style={{
                    padding: "6px 16px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: "600",
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                  }}
                >
                  Awaiting Admin Confirmation
                </span>
              </div>

              <div className="summary-section">
                <div className="summary-row">
                  <span className="summary-label">Visit Type</span>
                  <span className="summary-value" style={{ fontWeight: "600" }}>
                    {viewingType === "inperson"
                      ? "🏢 In-Person Visit"
                      : "💻 Virtual Verification"}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Target Move-In Date</span>
                  <span className="summary-value">
                    {targetMoveInDate
                      ? new Date(targetMoveInDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Not set"}
                  </span>
                </div>
                {isOutOfTown && (
                  <div className="summary-row">
                    <span className="summary-label">Current Location</span>
                    <span className="summary-value">
                      {currentLocation || "Not specified"}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    borderTop: "1px solid #E5E7EB",
                    marginTop: "12px",
                    paddingTop: "12px",
                  }}
                >
                  <div className="summary-row">
                    <span className="summary-label">Room</span>
                    <span className="summary-value">
                      {reservationData?.room?.title ||
                        reservationData?.room?.name ||
                        reservationData?.room?.id ||
                        "N/A"}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Branch</span>
                    <span
                      className="summary-value"
                      style={{ textTransform: "capitalize" }}
                    >
                      {reservationData?.room?.branch || "N/A"}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Room Type</span>
                    <span
                      className="summary-value"
                      style={{ textTransform: "capitalize" }}
                    >
                      {reservationData?.room?.type || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Notice */}
            <div
              style={{
                padding: "16px",
                background: "#EFF6FF",
                borderRadius: "8px",
                border: "1px solid #BFDBFE",
                marginBottom: "24px",
              }}
            >
              <p
                style={{
                  fontSize: "14px",
                  color: "#1E40AF",
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <strong>ℹ️ What happens next?</strong>
                <br />
                Our admin team will review your visit schedule and confirm the
                date and time. You will receive a notification once your visit
                is confirmed. You can track the status from your profile.
              </p>
            </div>

            <div className="stage-buttons flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={handlePrevStage} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={handleNextStage}
                className="btn btn-primary w-full"
              >
                Go to Profile & Track Status
              </button>
            </div>
          </div>
        )}

        {/* Stage 4: Tenant Application */}
        {currentStage === 4 &&
          (visitApproved ? (
            <ReservationApplicationStep
              billingEmail={billingEmail}
              selfiePhoto={selfiePhoto}
              setSelfiePhoto={setSelfiePhoto}
              lastName={lastName}
              setLastName={setLastName}
              firstName={firstName}
              setFirstName={setFirstName}
              middleName={middleName}
              setMiddleName={setMiddleName}
              nickname={nickname}
              setNickname={setNickname}
              mobileNumber={mobileNumber}
              setMobileNumber={setMobileNumber}
              birthday={birthday}
              setBirthday={setBirthday}
              maritalStatus={maritalStatus}
              setMaritalStatus={setMaritalStatus}
              nationality={nationality}
              setNationality={setNationality}
              educationLevel={educationLevel}
              setEducationLevel={setEducationLevel}
              addressUnitHouseNo={addressUnitHouseNo}
              setAddressUnitHouseNo={setAddressUnitHouseNo}
              addressStreet={addressStreet}
              setAddressStreet={setAddressStreet}
              addressBarangay={addressBarangay}
              setAddressBarangay={setAddressBarangay}
              addressCity={addressCity}
              setAddressCity={setAddressCity}
              addressProvince={addressProvince}
              setAddressProvince={setAddressProvince}
              validIDFront={validIDFront}
              setValidIDFront={setValidIDFront}
              validIDBack={validIDBack}
              setValidIDBack={setValidIDBack}
              nbiClearance={nbiClearance}
              setNbiClearance={setNbiClearance}
              nbiReason={nbiReason}
              setNbiReason={setNbiReason}
              companyID={companyID}
              setCompanyID={setCompanyID}
              companyIDReason={companyIDReason}
              setCompanyIDReason={setCompanyIDReason}
              emergencyContactName={emergencyContactName}
              setEmergencyContactName={setEmergencyContactName}
              emergencyRelationship={emergencyRelationship}
              setEmergencyRelationship={setEmergencyRelationship}
              emergencyContactNumber={emergencyContactNumber}
              setEmergencyContactNumber={setEmergencyContactNumber}
              healthConcerns={healthConcerns}
              setHealthConcerns={setHealthConcerns}
              employerSchool={employerSchool}
              setEmployerSchool={setEmployerSchool}
              employerAddress={employerAddress}
              setEmployerAddress={setEmployerAddress}
              employerContact={employerContact}
              setEmployerContact={setEmployerContact}
              startDate={startDate}
              setStartDate={setStartDate}
              occupation={occupation}
              setOccupation={setOccupation}
              previousEmployment={previousEmployment}
              setPreviousEmployment={setPreviousEmployment}
              preferredRoomNumber={preferredRoomNumber}
              setPreferredRoomNumber={setPreferredRoomNumber}
              referralSource={referralSource}
              setReferralSource={setReferralSource}
              referrerName={referrerName}
              setReferrerName={setReferrerName}
              targetMoveInDate={targetMoveInDate}
              setTargetMoveInDate={setTargetMoveInDate}
              leaseDuration={leaseDuration}
              setLeaseDuration={setLeaseDuration}
              estimatedMoveInTime={estimatedMoveInTime}
              setEstimatedMoveInTime={setEstimatedMoveInTime}
              workSchedule={workSchedule}
              setWorkSchedule={setWorkSchedule}
              workScheduleOther={workScheduleOther}
              setWorkScheduleOther={setWorkScheduleOther}
              agreedToPrivacy={agreedToPrivacy}
              setAgreedToPrivacy={setAgreedToPrivacy}
              agreedToCertification={agreedToCertification}
              setAgreedToCertification={setAgreedToCertification}
              personalNotes={personalNotes}
              setPersonalNotes={setPersonalNotes}
              devBypassValidation={devBypassValidation}
              setDevBypassValidation={setDevBypassValidation}
              onPrev={handlePrevStage}
              onNext={handleNextStage}
            />
          ) : (
            <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              <div className="text-center">
                <div style={{ fontSize: "64px", marginBottom: "16px" }}>⏳</div>
                <h2 className="stage-title text-2xl font-semibold text-slate-800">
                  Waiting for Visit Approval
                </h2>
                <p className="text-gray-500 mt-2 mb-6">
                  Your visit has been scheduled but is not yet approved by
                  admin. Please check your profile for updates.
                </p>
                <button
                  onClick={() => navigate("/tenant/profile")}
                  className="btn btn-primary"
                >
                  Go to Profile
                </button>
              </div>
            </div>
          ))}

        {/* Stage 5: Payment */}
        {currentStage === 5 && (
          <ReservationPaymentStep
            reservationData={reservationData}
            leaseDuration={leaseDuration}
            finalMoveInDate={finalMoveInDate}
            setFinalMoveInDate={setFinalMoveInDate}
            onMoveInDateUpdate={() => {
              showNotification(
                "Move-in date updated. Availability will be checked.",
                "info",
                2000,
              );
            }}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            proofOfPayment={proofOfPayment}
            setProofOfPayment={setProofOfPayment}
            isLoading={isLoading}
            onPrev={handlePrevStage}
            onNext={handleNextStage}
          />
        )}

        {/* Stage 6: Confirmation */}
        {currentStage === 6 && (
          <ReservationConfirmationStep
            reservationCode={reservationCode}
            reservationData={reservationData}
            finalMoveInDate={finalMoveInDate || targetMoveInDate}
            onViewDetails={() => navigate("/tenant/profile")}
            onReturnHome={() => navigate("/")}
          />
        )}
      </div>
    </div>
  );
}

export default ReservationFlowPage;
