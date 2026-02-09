import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { showNotification } from "../../../shared/utils/notification";
import { reservationApi, roomApi } from "../../../shared/api/apiClient";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Lock,
} from "lucide-react";
import "../../../shared/styles/notification.css";
import "../styles/reservation-flow.css";
import ReservationSummaryStep from "./reservation-steps/ReservationSummaryStep";
import ReservationVisitStep from "./reservation-steps/ReservationVisitStep";
import ReservationApplicationStep from "./reservation-steps/ReservationApplicationStep";
import ReservationPaymentStep from "./reservation-steps/ReservationPaymentStep";
import ReservationConfirmationStep from "./reservation-steps/ReservationConfirmationStep";

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
  const [reservationId, setReservationId] = useState(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [visitApproved, setVisitApproved] = useState(false);

  // DEV MODE: Bypass validation
  const [devBypassValidation, setDevBypassValidation] = useState(false);

  // Stage 1: Summary
  const [targetMoveInDate, setTargetMoveInDate] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("12");
  const [billingEmail, setBillingEmail] = useState(user?.email || "");

  // Stage 2: Visit
  const [viewingType, setViewingType] = useState("inperson");
  const [isOutOfTown, setIsOutOfTown] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("");
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

  const loadExistingReservation = async (existingReservationId) => {
    try {
      setIsLoading(true);
      const reservation = await reservationApi.getById(existingReservationId);
      setReservationId(reservation._id || existingReservationId);
      if (reservation.reservationCode) {
        setReservationCode(reservation.reservationCode);
      }

      setReservationData({
        room: reservation.roomId || reservation.room,
        selectedBed: reservation.selectedBed,
        applianceFees: reservation.applianceFees || 0,
      });

      if (reservation.targetMoveInDate) {
        setTargetMoveInDate(reservation.targetMoveInDate);
      }
      if (reservation.leaseDuration) {
        setLeaseDuration(reservation.leaseDuration);
      }
      if (reservation.billingEmail) {
        setBillingEmail(reservation.billingEmail);
      }
      if (reservation.viewingType) {
        setViewingType(reservation.viewingType);
      }
      if (reservation.isOutOfTown !== undefined) {
        setIsOutOfTown(reservation.isOutOfTown);
      }
      if (reservation.currentLocation) {
        setCurrentLocation(reservation.currentLocation);
      }
      if (reservation.visitApproved !== undefined) {
        setVisitApproved(reservation.visitApproved);
      }
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

      const address = reservation.address || {};
      if (address.unitHouseNo || reservation.addressUnitHouseNo) {
        setAddressUnitHouseNo(address.unitHouseNo || reservation.addressUnitHouseNo);
      }
      if (address.street || reservation.addressStreet) {
        setAddressStreet(address.street || reservation.addressStreet);
      }
      if (address.barangay || reservation.addressBarangay) {
        setAddressBarangay(address.barangay || reservation.addressBarangay);
      }
      if (address.city || reservation.addressCity) {
        setAddressCity(address.city || reservation.addressCity);
      }
      if (address.province || reservation.addressProvince) {
        setAddressProvince(address.province || reservation.addressProvince);
      }

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
      if (reservation.workScheduleOther)
        setWorkScheduleOther(reservation.workScheduleOther);

      if (reservation.finalMoveInDate) {
        setFinalMoveInDate(reservation.finalMoveInDate);
      }
      if (reservation.paymentMethod) {
        setPaymentMethod(reservation.paymentMethod);
      }

      const hasVisitScheduled = Boolean(
        reservation.viewingType && reservation.agreedToPrivacy,
      );
      const isVisitApproved = Boolean(reservation.visitApproved === true);
      const hasApplication = Boolean(
        reservation.firstName && reservation.lastName && reservation.mobileNumber,
      );
      const hasPayment = Boolean(reservation.proofOfPaymentUrl);
      const isConfirmed =
        reservation.reservationStatus === "confirmed" ||
        reservation.paymentStatus === "paid";

      if (isConfirmed) {
        setCurrentStage(6);
      } else if (hasPayment) {
        setCurrentStage(6);
      } else if (hasApplication) {
        setCurrentStage(5);
      } else if (isVisitApproved) {
        setCurrentStage(4);
      } else if (hasVisitScheduled) {
        setCurrentStage(3);
      } else {
        setCurrentStage(2);
      }

      if (stepOverride) {
        setCurrentStage(stepOverride);
      }

      const fallbackDate = reservation.targetMoveInDate ||
        new Date().toISOString().split("T")[0];
      setInitialFormState({
        targetMoveInDate: fallbackDate,
        leaseDuration: reservation.leaseDuration || "12",
        billingEmail: reservation.billingEmail || user?.email || "",
      });
    } catch (error) {
      showNotification("Failed to load reservation data", "error", 3000);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setShowLoginConfirm(true);
      return;
    }

    const continueReservation = location.state?.continueFlow;
    const editMode = location.state?.editMode;
    const existingReservationId = location.state?.reservationId;

    if ((continueReservation || editMode || stepOverride) && existingReservationId) {
      loadExistingReservation(existingReservationId);
      return;
    }

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

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setTargetMoveInDate(defaultDate.toISOString().split("T")[0]);
    setFinalMoveInDate(defaultDate.toISOString().split("T")[0]);

    setInitialFormState({
      targetMoveInDate: defaultDate.toISOString().split("T")[0],
      leaseDuration: "12",
      billingEmail: user?.email || "",
    });

    if (stepOverride) {
      setCurrentStage(stepOverride);
    }
  }, [user, navigate, location, stepOverride]);

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

  const handleNextStage = async () => {
    try {
      if (currentStage === 1) {
        if (!devBypassValidation && (!targetMoveInDate || !billingEmail)) {
          showNotification("Please fill in all summary fields", "error", 3000);
          return;
        }
        const draft = await createReservationDraft();
        if (!draft) return;
        advanceStage(2);
      } else if (currentStage === 2) {
        if (!devBypassValidation && viewingType === "virtual" && !isOutOfTown) {
          showNotification(
            "Please confirm you are out of town for virtual tour",
            "error",
            3000,
          );
          return;
        }

        const visitPayload = {
          agreedToPrivacy: true,
          viewingType,
          isOutOfTown,
          currentLocation: isOutOfTown ? currentLocation : undefined,
        };

        if (viewingType === "inperson") {
          visitPayload.firstName = visitorName?.split(" ")[0] || firstName;
          visitPayload.lastName =
            visitorName?.split(" ").slice(1).join(" ") || lastName;
          visitPayload.mobileNumber = visitorPhone || mobileNumber;
          visitPayload.billingEmail = visitorEmail || billingEmail;
        }

        await updateReservationDraft(visitPayload);
        setVisitApproved(true);
        setCurrentStage(3);
      } else if (currentStage === 3) {
        showNotification(
          "Your visit has been scheduled. Track updates in your profile.",
          "success",
          3000,
        );
        navigate("/tenant/profile");
      } else if (currentStage === 4) {
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
      } else if (currentStage === 5) {
        if (!devBypassValidation && !proofOfPayment) {
          showNotification("Please upload proof of payment", "error", 3000);
          return;
        }

        const paymentPayload = {
          finalMoveInDate,
          paymentMethod,
          proofOfPaymentUrl:
            proofOfPayment?.name ||
            (devBypassValidation ? "payment.jpg" : null),
        };

        await updateReservationDraft(paymentPayload);
        advanceStage(6);
      } else if (currentStage === 6) {
        navigate("/tenant/profile");
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
      if (isFormDirty) {
        setShowCancelConfirm(true);
      } else {
        navigate("/check-availability");
      }
    } else if (currentStage > 1) {
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

  const handleMoveInDateUpdate = () => {
    const tomorrow = new Date(finalMoveInDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFinalMoveInDate(tomorrow.toISOString().slice(0, 16));
  };

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
          background: "rgba(15, 23, 42, 0.45)",
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
            padding: "24px",
            maxWidth: "420px",
            width: "92%",
            border: "1px solid #E5E7EB",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Lock className="w-12 h-12" style={{ color: "#0C375F" }} />
          </div>
          <h2
            style={{
              marginBottom: "8px",
              fontSize: "20px",
              fontWeight: "600",
              color: "#0F172A",
            }}
          >
            Login Required
          </h2>
          <p style={{ marginBottom: "20px", color: "#475569", lineHeight: "1.6" }}>
            Please sign in to complete your reservation. Your progress will be
            saved.
          </p>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              onClick={handleLoginDismissed}
              style={{
                padding: "10px 20px",
                border: "1px solid #D1D5DB",
                background: "white",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                color: "#0F172A",
              }}
            >
              Go Back
            </button>
            <button
              onClick={handleLoginConfirmed}
              style={{
                padding: "10px 20px",
                background: "#0C375F",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  };

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
          background: "rgba(15, 23, 42, 0.45)",
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
            padding: "24px",
            maxWidth: "420px",
            width: "92%",
            border: "1px solid #E5E7EB",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AlertCircle className="w-12 h-12" style={{ color: "#E7710F" }} />
          </div>
          <h2
            style={{
              marginBottom: "8px",
              fontSize: "20px",
              fontWeight: "600",
              color: "#0F172A",
            }}
          >
            Discard Changes?
          </h2>
          <p style={{ marginBottom: "20px", color: "#475569", lineHeight: "1.6" }}>
            If you go back now, your current progress will be lost.
          </p>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              onClick={handleCancelDismissed}
              style={{
                padding: "10px 20px",
                border: "1px solid #D1D5DB",
                background: "white",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                color: "#0F172A",
              }}
            >
              Continue
            </button>
            <button
              onClick={handleCancelConfirmed}
              style={{
                padding: "10px 20px",
                background: "#0C375F",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!reservationData) {
    return (
      <div className="reservation-flow reservation-flow-container">
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
          <p style={{ marginTop: "12px" }}>Loading reservation details...</p>
        </div>
      </div>
    );
  }

  const progressPercent =
    ((currentStage - 1) / (RESERVATION_STAGES.length - 1)) * 100;
  const roomLabel =
    reservationData?.room?.roomNumber ||
    reservationData?.room?.name ||
    reservationData?.room?.title ||
    reservationData?.room?.id ||
    "Room";

  return (
    <div className="reservation-flow min-h-screen bg-white">
      <LoginConfirmModal />
      <CancelConfirmModal />

      <div className="border-b border-slate-200 bg-white">
  <div className="mx-auto w-full px-6 py-4">
    <div className="flex items-center justify-between">
      
      {/* Back Button */}
      <button
        onClick={() => navigate("/check-availability")}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Rooms
      </button>

      {/* Title Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 leading-tight">
          Room Reservation
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Room <span className="font-medium text-slate-700">{roomLabel}</span>
        </p>
      </div>

      {/* Spacer (keeps title centered) */}
      <div className="w-28" />
    </div>
  </div>
</div>


      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-5 h-px bg-slate-200 z-0" />
            <div
              className="absolute left-0 top-5 h-px bg-slate-900 z-0"
              style={{ width: `${progressPercent}%` }}
            />
            {RESERVATION_STAGES.map((stage) => {
              const isCompleted = currentStage > stage.id;
              const isCurrent = currentStage === stage.id;
              return (
                <div key={stage.id} className="flex flex-col items-center">
                  <div
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                      isCompleted
                        ? "bg-slate-900 text-white"
                        : isCurrent
                          ? "bg-[#E7710F] text-white"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      stage.id
                    )}
                  </div>
                  <span
                    className={`relative z-10 mt-2 text-xs ${
                      isCurrent ? "text-[#E7710F] font-medium" : "text-slate-500"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">

      {currentStage === 1 && (
        <ReservationSummaryStep
          reservationData={reservationData}
          onNext={handleNextStage}
        />
      )}

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

        {currentStage === 3 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Visit Scheduled
                </h2>
                <p className="text-sm text-slate-600">
                  Your visit request is queued for admin confirmation.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Track your visit status in your profile. Once approved, you can
              continue the application step.
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => navigate("/tenant/profile")}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Profile
              </button>
              <button
                onClick={handleNextStage}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {currentStage === 4 && (
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
          personalNotes={personalNotes}
          setPersonalNotes={setPersonalNotes}
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
          companyID={companyID}
          setCompanyID={setCompanyID}
          companyIDReason={companyIDReason}
          setCompanyIDReason={setCompanyIDReason}
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
          estimatedMoveInTime={estimatedMoveInTime}
          setEstimatedMoveInTime={setEstimatedMoveInTime}
          leaseDuration={leaseDuration}
          setLeaseDuration={setLeaseDuration}
          workSchedule={workSchedule}
          setWorkSchedule={setWorkSchedule}
          workScheduleOther={workScheduleOther}
          setWorkScheduleOther={setWorkScheduleOther}
          agreedToPrivacy={agreedToPrivacy}
          setAgreedToPrivacy={setAgreedToPrivacy}
          agreedToCertification={agreedToCertification}
          setAgreedToCertification={setAgreedToCertification}
          devBypassValidation={devBypassValidation}
          setDevBypassValidation={setDevBypassValidation}
          onPrev={handlePrevStage}
          onNext={handleNextStage}
        />
      )}

        {currentStage === 5 && (
        <ReservationPaymentStep
          reservationData={reservationData}
          leaseDuration={leaseDuration}
          finalMoveInDate={finalMoveInDate}
          setFinalMoveInDate={setFinalMoveInDate}
          onMoveInDateUpdate={handleMoveInDateUpdate}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          proofOfPayment={proofOfPayment}
          setProofOfPayment={setProofOfPayment}
          isLoading={isLoading}
          onPrev={handlePrevStage}
          onNext={handleNextStage}
        />
      )}

        {currentStage === 6 && (
        <ReservationConfirmationStep
          reservationData={reservationData}
          reservationCode={reservationCode}
          finalMoveInDate={finalMoveInDate}
          onViewDetails={() => navigate("/tenant/profile")}
          onReturnHome={() => navigate("/")}
        />
      )}
      </div>
    </div>
  );
}

export default ReservationFlowPage;
