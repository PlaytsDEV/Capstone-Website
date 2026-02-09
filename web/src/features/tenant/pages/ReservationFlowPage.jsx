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
  const stepFromState = Number(location.state?.step);
  const stepFromQuery = Number(new URLSearchParams(location.search).get("step"));
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
    const reservationId = location.state?.reservationId;

    if (continueReservation && reservationId) {
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
        appliances: reservation.selectedAppliances || []
      });

      // Populate all form fields from existing reservation
      if (reservation.targetMoveInDate) setTargetMoveInDate(reservation.targetMoveInDate);
      if (reservation.leaseDuration) setLeaseDuration(reservation.leaseDuration);
      if (reservation.billingEmail) setBillingEmail(reservation.billingEmail);
      
      if (reservation.viewingType) setViewingType(reservation.viewingType);
      if (reservation.isOutOfTown !== undefined) setIsOutOfTown(reservation.isOutOfTown);
      if (reservation.currentLocation) setCurrentLocation(reservation.currentLocation);
      if (reservation.visitApproved !== undefined) setVisitApproved(reservation.visitApproved);

      if (reservation.firstName) setFirstName(reservation.firstName);
      if (reservation.lastName) setLastName(reservation.lastName);
      if (reservation.middleName) setMiddleName(reservation.middleName);
      if (reservation.nickname) setNickname(reservation.nickname);
      if (reservation.mobileNumber) setMobileNumber(reservation.mobileNumber);
      if (reservation.birthday) setBirthday(reservation.birthday);
      if (reservation.maritalStatus) setMaritalStatus(reservation.maritalStatus);
      if (reservation.nationality) setNationality(reservation.nationality);
      if (reservation.educationLevel) setEducationLevel(reservation.educationLevel);

      if (reservation.addressUnitHouseNo) setAddressUnitHouseNo(reservation.addressUnitHouseNo);
      if (reservation.addressStreet) setAddressStreet(reservation.addressStreet);
      if (reservation.addressBarangay) setAddressBarangay(reservation.addressBarangay);
      if (reservation.addressCity) setAddressCity(reservation.addressCity);
      if (reservation.addressProvince) setAddressProvince(reservation.addressProvince);

      if (reservation.emergencyContactName) setEmergencyContactName(reservation.emergencyContactName);
      if (reservation.emergencyRelationship) setEmergencyRelationship(reservation.emergencyRelationship);
      if (reservation.emergencyContactNumber) setEmergencyContactNumber(reservation.emergencyContactNumber);
      if (reservation.healthConcerns) setHealthConcerns(reservation.healthConcerns);

      if (reservation.employerSchool) setEmployerSchool(reservation.employerSchool);
      if (reservation.employerAddress) setEmployerAddress(reservation.employerAddress);
      if (reservation.employerContact) setEmployerContact(reservation.employerContact);
      if (reservation.startDate) setStartDate(reservation.startDate);
      if (reservation.occupation) setOccupation(reservation.occupation);
      if (reservation.previousEmployment) setPreviousEmployment(reservation.previousEmployment);

      if (reservation.roomType) setRoomType(reservation.roomType);
      if (reservation.preferredRoomNumber) setPreferredRoomNumber(reservation.preferredRoomNumber);
      if (reservation.referralSource) setReferralSource(reservation.referralSource);
      if (reservation.referrerName) setReferrerName(reservation.referrerName);
      if (reservation.estimatedMoveInTime) setEstimatedMoveInTime(reservation.estimatedMoveInTime);
      if (reservation.workSchedule) setWorkSchedule(reservation.workSchedule);

      // Determine which stage to start at based on reservation status
      const status = reservation.reservationStatus || reservation.status;
      if (status === 'pending' && !reservation.visitCompleted) {
        setCurrentStage(2); // Visit stage
      } else if (status === 'pending' || status === 'visit-completed') {
        setCurrentStage(3); // Details stage
      } else if (status === 'confirmed' && !reservation.paymentVerified) {
        setCurrentStage(4); // Payment stage
      } else {
        setCurrentStage(1); // Start from beginning if unknown
      }

      if (stepOverride) {
        setCurrentStage(stepOverride);
      }

      showNotification("Reservation data loaded. Continue where you left off!", "success", 3000);
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
        showNotification("Please sign in to continue your reservation.", "error", 3000);
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
      showNotification(
        "Step saved. Continue from your profile to unlock the next step.",
        "success",
        2500,
      );
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
    if (reservationData?.room?._id) {
      return reservationData.room._id;
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
      billingEmail: getFieldValue(billingEmail, user?.email || "test@example.com"),
      checkInDate,
      totalPrice: totalPrice > 0 ? totalPrice : 5000,
      applianceFees: reservationData?.applianceFees || 0,
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

  const handleNextStage = async () => {
    try {
      // Validate current stage
      if (currentStage === 1) {
        if (!devBypassValidation && (!targetMoveInDate || !billingEmail)) {
          showNotification("Please fill in all summary fields", "error", 3000);
          return;
        }
        const created = await createReservationDraft();
        if (!created) {
          return;
        }
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
        // Simulate visiting approval
        setVisitApproved(true);
        await updateReservationDraft({
          viewingType: getFieldValue(viewingType, "inperson"),
          isOutOfTown: getFieldValue(isOutOfTown, false),
          currentLocation: getFieldValue(currentLocation, "Philippines"),
          visitApproved: true,
        });
        advanceStage(3);
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
        await updateReservationDraft({
          selfiePhotoUrl:
            selfiePhoto?.name || (devBypassValidation ? "selfie.jpg" : null),
          firstName: getFieldValue(firstName, "Test"),
          lastName: getFieldValue(lastName, "User"),
          middleName: getFieldValue(middleName, ""),
          nickname: getFieldValue(nickname, "TestUser"),
          mobileNumber: getFieldValue(mobileNumber, "09123456789"),
          birthday: getFieldValue(birthday, "1990-01-01"),
          maritalStatus: getFieldValue(maritalStatus, "single"),
          nationality: getFieldValue(nationality, "Filipino"),
          educationLevel: getFieldValue(educationLevel, "college"),
          addressUnitHouseNo: getFieldValue(addressUnitHouseNo, "Unit 123"),
          addressStreet: getFieldValue(addressStreet, "Test Street"),
          addressBarangay: getFieldValue(addressBarangay, "Test Barangay"),
          addressCity: getFieldValue(addressCity, "Manila"),
          addressProvince: getFieldValue(addressProvince, "NCR"),
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
          employerSchool: getFieldValue(employerSchool, "Test Company"),
          employerAddress: getFieldValue(employerAddress, "Company Address"),
          employerContact: getFieldValue(employerContact, "09111111111"),
          startDate: getFieldValue(startDate, "2024-01-01"),
          occupation: getFieldValue(occupation, "Developer"),
          previousEmployment: getFieldValue(previousEmployment, "None"),
          roomType: getFieldValue(roomType, "quadruple"),
          preferredRoomNumber: getFieldValue(preferredRoomNumber, ""),
          referralSource: getFieldValue(referralSource, "other"),
          referrerName: getFieldValue(referrerName, ""),
          estimatedMoveInTime: getFieldValue(estimatedMoveInTime, "09:00"),
          workSchedule: getFieldValue(workSchedule, "day"),
          workScheduleOther: getFieldValue(workScheduleOther, ""),
          agreedToPrivacy: devBypassValidation ? true : agreedToPrivacy,
          agreedToCertification: devBypassValidation
            ? true
            : agreedToCertification,
        });
        advanceStage(4);
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

        let checkInDate = getCheckInDate();
        if (!checkInDate) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          checkInDate = tomorrow.toISOString().split("T")[0];
        }

        const totalPrice = getTotalPrice();

        const paymentPayload = {
          proofOfPaymentUrl:
            proofOfPayment?.name ||
            (devBypassValidation ? "payment.jpg" : null),
          checkInDate,
          totalPrice: totalPrice > 0 ? totalPrice : 5000,
          applianceFees: reservationData.applianceFees || 0,
          paymentStatus: "pending",
        };

        let savedReservation;
        if (reservationId) {
          savedReservation = await updateReservationDraft(paymentPayload);
        } else {
          savedReservation = await createReservationDraft({
            viewingType: getFieldValue(viewingType, "inperson"),
            isOutOfTown: getFieldValue(isOutOfTown, false),
            currentLocation: getFieldValue(currentLocation, "Philippines"),
            visitApproved: true,
            selfiePhotoUrl:
              selfiePhoto?.name || (devBypassValidation ? "selfie.jpg" : null),
            firstName: getFieldValue(firstName, "Test"),
            lastName: getFieldValue(lastName, "User"),
            middleName: getFieldValue(middleName, ""),
            nickname: getFieldValue(nickname, "TestUser"),
            mobileNumber: getFieldValue(mobileNumber, "09123456789"),
            birthday: getFieldValue(birthday, "1990-01-01"),
            maritalStatus: getFieldValue(maritalStatus, "single"),
            nationality: getFieldValue(nationality, "Filipino"),
            educationLevel: getFieldValue(educationLevel, "college"),
            addressUnitHouseNo: getFieldValue(addressUnitHouseNo, "Unit 123"),
            addressStreet: getFieldValue(addressStreet, "Test Street"),
            addressBarangay: getFieldValue(addressBarangay, "Test Barangay"),
            addressCity: getFieldValue(addressCity, "Manila"),
            addressProvince: getFieldValue(addressProvince, "NCR"),
            validIDFrontUrl:
              validIDFront?.name ||
              (devBypassValidation ? "id-front.jpg" : null),
            validIDBackUrl:
              validIDBack?.name || (devBypassValidation ? "id-back.jpg" : null),
            nbiClearanceUrl:
              nbiClearance?.name || (devBypassValidation ? "nbi.jpg" : null),
            nbiReason: getFieldValue(nbiReason, "Employment"),
            companyIDUrl:
              companyID?.name || (devBypassValidation ? "company-id.jpg" : null),
            companyIDReason: getFieldValue(companyIDReason, "Verification"),
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
            employerSchool: getFieldValue(employerSchool, "Test Company"),
            employerAddress: getFieldValue(employerAddress, "Company Address"),
            employerContact: getFieldValue(employerContact, "09111111111"),
            startDate: getFieldValue(startDate, "2024-01-01"),
            occupation: getFieldValue(occupation, "Developer"),
            previousEmployment: getFieldValue(previousEmployment, "None"),
            roomType: getFieldValue(roomType, "quadruple"),
            preferredRoomNumber: getFieldValue(preferredRoomNumber, ""),
            referralSource: getFieldValue(referralSource, "other"),
            referrerName: getFieldValue(referrerName, ""),
            estimatedMoveInTime: getFieldValue(estimatedMoveInTime, "09:00"),
            workSchedule: getFieldValue(workSchedule, "day"),
            workScheduleOther: getFieldValue(workScheduleOther, ""),
            agreedToPrivacy: devBypassValidation ? true : agreedToPrivacy,
            agreedToCertification: devBypassValidation
              ? true
              : agreedToCertification,
            ...paymentPayload,
          });
        }

        const actualCode =
          savedReservation?.reservationCode || reservationCode || "CODE-ERROR";
        setReservationCode(actualCode);
        advanceStage(5);
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

      {/* Stage 1: Summary */}
      {currentStage === 1 && (
        <ReservationSummaryStep
          reservationData={reservationData}
          targetMoveInDate={targetMoveInDate}
          setTargetMoveInDate={setTargetMoveInDate}
          leaseDuration={leaseDuration}
          setLeaseDuration={setLeaseDuration}
          billingEmail={billingEmail}
          setBillingEmail={setBillingEmail}
          devBypassValidation={devBypassValidation}
          setDevBypassValidation={setDevBypassValidation}
          onCancel={() => navigate(-1)}
          onNext={handleNextStage}
        />
      )}

      {/* Stage 2: Visit Verification */}
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
          onSimulateApproval={simulateVisitApproval}
          onPrev={handlePrevStage}
          onNext={handleNextStage}
        />
      )}

      {/* Stage 3: Applicant Registration Form */}
      {currentStage === 3 && (
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

      {/* Stage 4: Payment */}
      {currentStage === 4 && (
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

      {/* Stage 5: Confirmation */}
      {currentStage === 5 && (
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
