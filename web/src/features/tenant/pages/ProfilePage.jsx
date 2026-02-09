import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import ProfileSidebar from "../components/ProfileSidebar";
import {
  authApi,
  userApi,
  reservationApi,
} from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import {
  User,
  Calendar,
  Clock,
  Home,
  CheckCircle,
  Bell,
  History,
  Edit2,
  FileText,
  DollarSign,
  Bed,
  Check,
  CreditCard,
  Search,
  AlertCircle,
  MapPin,
  Monitor,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const ProfilePage = () => {
  const { user: authUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unacknowledgedCount] = useState(1); // TODO: Get from API
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Reservation data
  const [activeReservation, setActiveReservation] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedReservationId, setSelectedReservationId] = useState(null);

  // Profile data
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    phone: "",
    profileImage: "",
    branch: "",
    role: "",
    tenantStatus: "",
    createdAt: "",
    address: "",
    city: "",
    dateOfBirth: "",
    emergencyContact: "",
    emergencyPhone: "",
    studentId: "",
    school: "",
    yearLevel: "",
  });

  // Editable profile fields
  const [editData, setEditData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    profileImage: "",
    address: "",
    city: "",
    dateOfBirth: "",
    emergencyContact: "",
    emergencyPhone: "",
    studentId: "",
    school: "",
    yearLevel: "",
  });

  // Stay tracking data
  const [stayData, setStayData] = useState({
    currentStays: [],
    pastStays: [],
    stats: {
      totalStays: 0,
      completedStays: 0,
      totalNights: 0,
      memberSince: null,
    },
  });

  //Activity log (from reservations)
  const [activityLog, setActivityLog] = useState([]);

  // Load profile data
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        const profile = await authApi.getProfile();
        setProfileData(profile);
        setEditData({
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          phone: profile.phone || "",
          profileImage: profile.profileImage || "",
          address: profile.address || "",
          city: profile.city || "",
          dateOfBirth: profile.dateOfBirth || "",
          emergencyContact: profile.emergencyContact || "",
          emergencyPhone: profile.emergencyPhone || "",
          studentId: profile.studentId || "",
          school: profile.school || "",
          yearLevel: profile.yearLevel || "",
        });

        await loadReservationsAndVisits();
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [location.state?.refresh]);

  const loadReservationsAndVisits = async () => {
    try {
      const reservationsData = await reservationApi.getAll();
      setReservations(reservationsData || []);

      const activeOnes =
        reservationsData?.filter((r) => {
          const status = r.reservationStatus || r.status;
          return status !== "completed" && status !== "cancelled";
        }) || [];

      const active = activeOnes[0] || null;
      setActiveReservation(active);

      if (active && !selectedReservationId) {
        setSelectedReservationId(active._id);
      }

      const allVisits =
        reservationsData
          ?.filter((r) => r.visitDate)
          .map((r) => ({
            id: r._id,
            roomNumber: r.roomId?.name || "N/A",
            location: r.roomId?.branch || "N/A",
            floor: r.roomId?.floor || 1,
            date: r.visitDate,
            time: r.visitTime || "TBD",
            status: r.visitCompleted
              ? "Completed"
              : new Date(r.visitDate) < new Date()
                ? "Missed"
                : "Scheduled",
            specialInstructions:
              "Please bring valid ID. Meet at the reception area.",
          })) || [];
      setVisits(allVisits);

      const activities = [];
      reservationsData?.forEach((r) => {
        if (r.createdAt) {
          activities.push({
            id: `res-${r._id}`,
            type: "reservation",
            title: "Room Reservation Submitted",
            description: `Submitted reservation request for Room ${r.roomId?.name || "N/A"}`,
            date: r.createdAt,
            status: "Pending",
          });
        }
        if (r.visitDate) {
          activities.push({
            id: `visit-${r._id}`,
            type: "visit",
            title: r.visitCompleted ? "Visit Completed" : "Visit Scheduled",
            description: `${r.visitCompleted ? "Completed" : "Scheduled"} visit to Room ${r.roomId?.name || "N/A"}`,
            date: r.visitDate,
            status: r.visitCompleted ? "Completed" : "Scheduled",
          });
        }
        if (r.approvedDate) {
          activities.push({
            id: `approval-${r._id}`,
            type: "approval",
            title: "Reservation Approved",
            description: `Your reservation for Room ${r.roomId?.name || "N/A"} has been approved by admin`,
            date: r.approvedDate,
            status: "Approved",
          });
        }
      });

      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      setActivityLog(activities);
    } catch (err) {
      console.error("Error loading reservations:", err);
    }
  };

  // Load stay data when Stay History tab is active
  useEffect(() => {
    if (activeTab === "stays") {
      loadStayData();
    }
  }, [activeTab]);

  const loadStayData = async () => {
    try {
      const data = await userApi.getMyStays();
      setStayData(data);
    } catch (err) {
      console.error("Error loading stay data:", err);
      setError("Failed to load stay information");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedUser = await authApi.updateProfile(editData);
      setProfileData((prev) => ({ ...prev, ...updatedUser.user }));
      setSuccess("Profile updated successfully!");

      // Update auth context if needed
      if (updateUser) {
        updateUser(updatedUser.user);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      return;
    }

    try {
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData((prev) => ({ ...prev, profileImage: reader.result }));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError("Failed to upload image");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: "status-badge status-pending",
      confirmed: "status-badge status-confirmed",
      "checked-in": "status-badge status-active",
      "checked-out": "status-badge status-completed",
      cancelled: "status-badge status-cancelled",
    };
    return statusClasses[status] || "status-badge";
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedUser = await authApi.updateProfile(editData);
      setProfileData((prev) => ({ ...prev, ...updatedUser.user }));
      setSuccess("Profile updated successfully!");
      setIsEditingProfile(false);

      if (updateUser) {
        updateUser(updatedUser.user);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditData({
      firstName: profileData.firstName || "",
      lastName: profileData.lastName || "",
      phone: profileData.phone || "",
      profileImage: profileData.profileImage || "",
      address: profileData.address || "",
      city: profileData.city || "",
      dateOfBirth: profileData.dateOfBirth || "",
      emergencyContact: profileData.emergencyContact || "",
      emergencyPhone: profileData.emergencyPhone || "",
      studentId: profileData.studentId || "",
      school: profileData.school || "",
      yearLevel: profileData.yearLevel || "",
    });
    setIsEditingProfile(false);
  };

  const handleLogout = async (event) => {
    event.preventDefault();
    try {
      await logout();
      navigate("/signin");
    } catch (err) {
      console.error("Logout failed:", err);
      showNotification("Logout failed. Please try again.", "error", 3000);
    }
  };

  // Get reservation progress based on current status - accepts a reservation parameter
  const getReservationProgress = (reservation = activeReservation) => {
    if (!reservation) {
      return {
        currentStep: "not_started",
        steps: [],
        currentStepIndex: -1,
      };
    }

    const status =
      reservation.reservationStatus || reservation.status || "pending";
    const stepOrder = [
      "room_selected",
      "visit_scheduled",
      "visit_completed",
      "application_submitted",
      "payment_submitted",
      "confirmed",
    ];

    const hasRoom = Boolean(reservation.roomId);
    const hasPoliciesAccepted = Boolean(reservation.agreedToPrivacy === true);
    const hasVisitRequest = Boolean(
      reservation.viewingType && reservation.viewingType !== "none",
    );
    const isVisitScheduled = hasPoliciesAccepted && hasVisitRequest;
    const isVisitCompleted = Boolean(reservation.visitApproved === true);
    const hasApplication = Boolean(
      reservation.firstName && reservation.lastName,
    );
    const hasPayment = Boolean(reservation.proofOfPaymentUrl);
    const isConfirmed =
      status === "confirmed" || reservation.paymentStatus === "paid";

    // Check for schedule rejection
    const isScheduleRejected = Boolean(reservation.scheduleRejected === true);
    const scheduleRejectionReason = reservation.scheduleRejectionReason || null;

    let currentStepIndex = -1;
    if (hasRoom) currentStepIndex = 0;
    if (isVisitScheduled && !isScheduleRejected) currentStepIndex = 1;
    if (isVisitCompleted) currentStepIndex = 2;
    if (hasApplication) currentStepIndex = 3;
    if (hasPayment) currentStepIndex = 4;
    if (isConfirmed) currentStepIndex = 5;

    // Application is editable only after submission but before confirmation
    // Once payment is submitted OR reservation is confirmed, application is locked
    const isApplicationEditable =
      currentStepIndex >= 3 && !hasPayment && !isConfirmed;

    // Determine pending approval states
    const isSchedulePendingApproval =
      isVisitScheduled && !reservation.scheduleApproved && !isScheduleRejected;
    const isPaymentPendingApproval = hasPayment && !isConfirmed;

    const steps = [
      {
        step: "room_selected",
        title: "1. Room Selection",
        description: "Room selected and reserved",
        status: currentStepIndex >= 0 ? "completed" : "current",
        completedDate: reservation.createdAt,
        roomName: reservation.roomId?.name || "Unknown Room",
        branch: reservation.roomId?.branch,
      },
      {
        step: "visit_scheduled",
        title: "2. Policies & Visit Scheduled",
        description: isScheduleRejected
          ? `Schedule rejected: ${scheduleRejectionReason || "Please reschedule your visit"}`
          : "Acknowledge policies and schedule your room visit",
        status: isScheduleRejected
          ? "rejected"
          : currentStepIndex >= 1
            ? isSchedulePendingApproval
              ? "pending_approval"
              : "completed"
            : currentStepIndex === 0
              ? "current"
              : "locked",
        completedDate:
          currentStepIndex >= 1 ? reservation.updatedAt : undefined,
        rejectionReason: scheduleRejectionReason,
        rejectedAt: reservation.scheduleRejectedAt,
      },
      {
        step: "visit_completed",
        title: "3. Visit Completed",
        description: reservation.scheduleApproved
          ? "Waiting for admin to verify visit completion"
          : "Complete your scheduled visit first",
        status:
          currentStepIndex >= 2
            ? "completed"
            : currentStepIndex === 1 && reservation.scheduleApproved
              ? "pending_approval"
              : "locked",
        completedDate:
          currentStepIndex >= 2 ? reservation.visitCompletedAt : undefined,
      },
      {
        step: "application_submitted",
        title: "4. Tenant Application Submitted",
        description: isApplicationEditable
          ? "Application submitted - can still edit"
          : isConfirmed
            ? "Application locked - reservation confirmed"
            : hasPayment
              ? "Application locked - payment submitted"
              : "Personal details and documents submitted",
        status:
          currentStepIndex >= 3
            ? "completed"
            : currentStepIndex === 2
              ? "current"
              : "locked",
        completedDate:
          currentStepIndex >= 3
            ? reservation.applicationSubmittedAt
            : undefined,
        editable: isApplicationEditable,
      },
      {
        step: "payment_submitted",
        title: "5. Payment Submitted",
        description: isPaymentPendingApproval
          ? "Awaiting admin payment verification"
          : "Payment proof uploaded and verified",
        status: isPaymentPendingApproval
          ? "pending_approval"
          : currentStepIndex >= 4
            ? "completed"
            : currentStepIndex === 3
              ? "current"
              : "locked",
        completedDate:
          currentStepIndex >= 4 ? reservation.paymentDate : undefined,
      },
      {
        step: "confirmed",
        title: "6. Reservation Confirmed",
        description: isPaymentPendingApproval
          ? "Pending admin payment verification"
          : "Reservation fully confirmed and finalized",
        status: currentStepIndex >= 5 ? "completed" : "locked",
        completedDate:
          currentStepIndex >= 5 ? reservation.approvedDate : undefined,
      },
    ];

    return {
      currentStep: stepOrder[currentStepIndex] || "room_selected",
      steps,
      currentStepIndex: Math.max(currentStepIndex, 0),
    };
  };

  // Get active reservations (not completed or cancelled)
  const activeReservations = reservations.filter((r) => {
    const status = r.reservationStatus || r.status;
    return status !== "completed" && status !== "cancelled";
  });

  // Get selected reservation or fallback to first active
  const selectedReservation = selectedReservationId
    ? activeReservations.find((r) => r._id === selectedReservationId) ||
      activeReservations[0]
    : activeReservations[0];

  const reservationProgress = getReservationProgress(selectedReservation);

  // Check if reservation is confirmed (step 6 complete)
  const isReservationConfirmed =
    selectedReservation &&
    (selectedReservation.reservationStatus === "confirmed" ||
      selectedReservation.status === "confirmed" ||
      selectedReservation.paymentStatus === "paid");

  // Prevent browser back button when reservation is confirmed
  useEffect(() => {
    if (!isReservationConfirmed) return;

    // Push a new history state to prevent going back
    window.history.pushState(null, "", window.location.href);

    const handlePopState = (event) => {
      // When back button is pressed, push state again to stay on page
      window.history.pushState(null, "", window.location.href);
      showNotification(
        "Your reservation is confirmed. You cannot go back to edit previous steps.",
        "info",
        3000,
      );
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isReservationConfirmed]);

  const defaultSteps = [
    {
      step: "room_selected",
      title: "1. Room Selection",
      description: "Select a room to reserve",
      status: "current",
    },
    {
      step: "visit_scheduled",
      title: "2. Policies & Visit Scheduled",
      description: "Acknowledge policies and schedule your room visit",
      status: "locked",
    },
    {
      step: "visit_completed",
      title: "3. Visit Completed",
      description: "Room visit completed and verified",
      status: "locked",
    },
    {
      step: "application_submitted",
      title: "4. Tenant Application Submitted",
      description: "Personal details and documents uploaded",
      status: "locked",
    },
    {
      step: "payment_submitted",
      title: "5. Payment Submitted",
      description: "Payment proof uploaded and verified",
      status: "locked",
    },
    {
      step: "confirmed",
      title: "6. Reservation Confirmed",
      description: "Reservation finalized and ready for move-in",
      status: "locked",
    },
  ];

  const stepsToRender =
    selectedReservation && reservationProgress.steps?.length
      ? reservationProgress.steps
      : defaultSteps;

  const [showTracker, setShowTracker] = useState(true);
  const [expandedStep, setExpandedStep] = useState(null);
  const [receiptModal, setReceiptModal] = useState({ open: false, step: null });

  const handleStepClick = (step) => {
    // Only for room_selected without active reservation - navigate to browse
    if (!selectedReservation && step.step === "room_selected") {
      navigate("/tenant/check-availability");
      return;
    }
    if (step.status === "locked") {
      showNotification("Complete previous step first.", "warning", 2500);
      return;
    }
    // Block completed steps that are not editable
    if (
      step.status === "completed" &&
      step.step !== "room_selected" &&
      !step.editable
    ) {
      showNotification(
        "This step is already complete and locked.",
        "info",
        2500,
      );
      return;
    }

    // Navigate based on step type and status
    if (selectedReservation) {
      const stepActions = {
        room_selected: {
          // Room selection is locked - always go to step 2
          navigateToRooms: false,
          flowStep: 2,
        },
        visit_scheduled: {
          // If rejected, allow reschedule; if pending or current, go to step 2
          flowStep: 2,
        },
        visit_completed: {
          // If pending admin approval, just show notification
          isPendingAdmin: step.status === "pending_approval",
        },
        application_submitted: {
          // Go to application form (step 4)
          flowStep: 4,
        },
        payment_submitted: {
          // Go to payment step (step 5)
          flowStep: 5,
        },
        confirmed: {
          // Already confirmed, no action needed
          isComplete: true,
        },
      };

      const action = stepActions[step.step];

      if (action?.isComplete) {
        showNotification("Reservation is confirmed!", "success", 2500);
        return;
      }

      if (action?.isPendingAdmin) {
        showNotification("Waiting for admin verification.", "info", 2500);
        return;
      }

      if (
        step.status === "pending_approval" &&
        step.step !== "visit_scheduled"
      ) {
        showNotification("Waiting for admin approval.", "info", 2500);
        return;
      }

      // Navigate to room selection if editable
      if (action?.navigateToRooms) {
        navigate("/tenant/check-availability", {
          state: {
            changeRoom: true,
            reservationId: selectedReservation._id,
          },
        });
        return;
      }

      if (action?.flowStep) {
        navigate("/tenant/reservation-flow", {
          state: {
            reservationId: selectedReservation._id,
            continueFlow: true,
            step: action.flowStep,
          },
        });
        return;
      }
    }
  };

  // Render inline receipt content for each step
  const renderStepReceipt = (step) => {
    if (!selectedReservation) return null;

    switch (step.step) {
      case "room_selected":
        return (
          <div
            style={{
              padding: "12px 16px",
              background: "#F9FAFB",
              borderRadius: "8px",
              marginTop: "8px",
              fontSize: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#6B7280" }}>Room</span>
              <span style={{ color: "#1F2937", fontWeight: "500" }}>
                {selectedReservation.roomId?.name ||
                  selectedReservation.roomId?.roomNumber ||
                  "N/A"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#6B7280" }}>Branch</span>
              <span
                style={{
                  color: "#1F2937",
                  fontWeight: "500",
                  textTransform: "capitalize",
                }}
              >
                {selectedReservation.roomId?.branch || "N/A"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#6B7280" }}>Type</span>
              <span
                style={{
                  color: "#1F2937",
                  fontWeight: "500",
                  textTransform: "capitalize",
                }}
              >
                {selectedReservation.roomId?.type || "N/A"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#6B7280" }}>Monthly Rate</span>
              <span style={{ color: "#E7710F", fontWeight: "600" }}>
                ₱
                {(
                  selectedReservation.roomId?.price ||
                  selectedReservation.totalPrice ||
                  0
                ).toLocaleString()}
              </span>
            </div>
            {selectedReservation.selectedBed && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Bed</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontWeight: "500",
                    textTransform: "capitalize",
                  }}
                >
                  {selectedReservation.selectedBed.position} (
                  {selectedReservation.selectedBed.id})
                </span>
              </div>
            )}
          </div>
        );

      case "visit_scheduled":
        if (step.status === "completed" || step.status === "current") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: step.status === "completed" ? "#F0FDF4" : "#F9FAFB",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border:
                  step.status === "completed" ? "1px solid #BBF7D0" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Visit Type</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontWeight: "500",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {selectedReservation.viewingType === "inperson" ? (
                    <>
                      <Home size={16} />
                      In-Person Visit
                    </>
                  ) : selectedReservation.viewingType === "virtual" ? (
                    <>
                      <Monitor size={16} />
                      Virtual Verification
                    </>
                  ) : (
                    "Not selected"
                  )}
                </span>
              </div>
              {selectedReservation.isOutOfTown && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ color: "#6B7280" }}>Location</span>
                  <span
                    style={{
                      color: "#1F2937",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <MapPin size={14} />
                    {selectedReservation.currentLocation || "Out of town"}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Policies Accepted</span>
                <span
                  style={{
                    color: selectedReservation.agreedToPrivacy
                      ? "#10B981"
                      : "#6B7280",
                    fontWeight: "500",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {selectedReservation.agreedToPrivacy ? (
                    <>
                      <Check size={14} />
                      Yes
                    </>
                  ) : (
                    "No"
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Schedule Status</span>
                <span
                  style={{
                    color: selectedReservation.scheduleApproved
                      ? "#10B981"
                      : "#F59E0B",
                    fontWeight: "600",
                  }}
                >
                  {selectedReservation.scheduleApproved
                    ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Check size={14} />
                          Approved
                        </span>
                      )
                    : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Clock size={14} />
                          Awaiting Admin Approval
                        </span>
                      )}
                </span>
              </div>
              {step.status === "current" &&
                !selectedReservation.scheduleApproved && (
                  <p
                    style={{
                      color: "#92400E",
                      margin: "8px 0 0",
                      fontSize: "13px",
                    }}
                  >
                    <strong>Note:</strong> Please wait for admin to approve your
                    visit schedule.
                  </p>
                )}
            </div>
          );
        }
        return null;

      case "visit_completed":
        if (step.status === "completed") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#F0FDF4",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #BBF7D0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Visit Type</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontWeight: "500",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {selectedReservation.viewingType === "inperson" ? (
                    <>
                      <Home size={16} />
                      In-Person Visit
                    </>
                  ) : (
                    <>
                      <Monitor size={16} />
                      Virtual Verification
                    </>
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Schedule Approval</span>
                <span
                  style={{
                    color: "#10B981",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} />
                  Approved
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Visit Status</span>
                <span
                  style={{
                    color: "#10B981",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} />
                  Completed & Verified
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Verified By</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  Admin
                </span>
              </div>
            </div>
          );
        }
        if (step.status === "current") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#FFFBEB",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #FDE68A",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Visit Type</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontWeight: "500",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {selectedReservation.viewingType === "inperson" ? (
                    <>
                      <Home size={16} />
                      In-Person Visit
                    </>
                  ) : (
                    <>
                      <Monitor size={16} />
                      Virtual Verification
                    </>
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Schedule</span>
                <span
                  style={{
                    color: selectedReservation.scheduleApproved
                      ? "#10B981"
                      : "#F59E0B",
                    fontWeight: "600",
                  }}
                >
                  {selectedReservation.scheduleApproved
                    ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Check size={14} />
                          Approved
                        </span>
                      )
                    : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Clock size={14} />
                          Awaiting Approval
                        </span>
                      )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Visit Status</span>
                <span
                  style={{
                    color: "#F59E0B",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Clock size={14} />
                  Awaiting Completion
                </span>
              </div>
              <p
                style={{
                  color: "#92400E",
                  margin: "8px 0 0",
                  fontSize: "13px",
                }}
              >
                <strong>Note:</strong> Your visit is scheduled. The admin will
                verify and mark as complete once done.
              </p>
            </div>
          );
        }
        return null;

      case "application_submitted":
        if (step.status === "completed") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#F0FDF4",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #BBF7D0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Applicant</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.firstName}{" "}
                  {selectedReservation.middleName
                    ? selectedReservation.middleName + " "
                    : ""}
                  {selectedReservation.lastName}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Mobile</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.mobileNumber || "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Emergency Contact</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.emergencyContactName || "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Employer/School</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.employerSchool || "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Status</span>
                <span
                  style={{
                    color: "#10B981",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} />
                  Submitted
                </span>
              </div>
            </div>
          );
        }
        if (step.status === "current") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#FFFBEB",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #FDE68A",
              }}
            >
              <p style={{ color: "#92400E", margin: 0 }}>
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FileText size={14} />
                  Action Required:
                </strong>{" "}
                Submit your personal details and documents for admin review.
              </p>
            </div>
          );
        }
        return null;

      case "payment_submitted":
        if (step.status === "completed") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#F0FDF4",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #BBF7D0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Amount</span>
                <span style={{ color: "#E7710F", fontWeight: "600" }}>
                  ₱{(selectedReservation.totalPrice || 0).toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Payment Method</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontWeight: "500",
                    textTransform: "capitalize",
                  }}
                >
                  {selectedReservation.paymentMethod || "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Move-in Date</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.finalMoveInDate
                    ? new Date(
                        selectedReservation.finalMoveInDate,
                      ).toLocaleDateString()
                    : "TBD"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Status</span>
                <span
                  style={{
                    color: "#10B981",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} />
                  Verified
                </span>
              </div>
              {selectedReservation?.paymentReference && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderTop: "1px solid #BBF7D0",
                    marginTop: "8px",
                    paddingTop: "8px",
                  }}
                >
                  <span style={{ color: "#6B7280", fontWeight: "500" }}>
                    Payment Reference
                  </span>
                  <span style={{ color: "#059669", fontWeight: "600" }}>
                    {selectedReservation.paymentReference}
                  </span>
                </div>
              )}
            </div>
          );
        }
        if (step.status === "pending_approval") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#FEF3C7",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #FCD34D",
              }}
            >
              <p style={{ color: "#78350F", marginBottom: "8px", margin: 0 }}>
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Clock size={14} />
                  Pending Review:
                </strong>{" "}
                Your payment proof has been submitted and is awaiting admin
                verification. This usually takes 1-2 business days.
              </p>
              {selectedReservation?.paymentReference && (
                <p
                  style={{
                    color: "#78350F",
                    fontSize: "12px",
                    margin: "8px 0 0",
                  }}
                >
                  <strong>Payment Reference:</strong>{" "}
                  {selectedReservation.paymentReference}
                </p>
              )}
            </div>
          );
        }
        if (step.status === "current") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#FFFBEB",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #FDE68A",
              }}
            >
              <p style={{ color: "#92400E", margin: 0 }}>
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CreditCard size={14} />
                  Action Required:
                </strong>{" "}
                Upload your proof of payment to proceed.
              </p>
            </div>
          );
        }
        return null;

      case "confirmed":
        if (step.status === "completed") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#F0FDF4",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #BBF7D0",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #BBF7D0",
                  marginBottom: "8px",
                }}
              >
                <p
                  style={{
                    color: "#166534",
                    fontWeight: "700",
                    fontSize: "16px",
                    margin: "0 0 8px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircle size={16} />
                    Reservation Confirmed!
                  </span>
                </p>
                {selectedReservation.reservationCode && (
                  <p
                    style={{
                      color: "#6B7280",
                      fontSize: "12px",
                      margin: "4px 0",
                    }}
                  >
                    Reservation Code:{" "}
                    <strong style={{ color: "#166534" }}>
                      {selectedReservation.reservationCode}
                    </strong>
                  </p>
                )}
                {selectedReservation.paymentReference && (
                  <p
                    style={{
                      color: "#6B7280",
                      fontSize: "12px",
                      margin: "4px 0",
                    }}
                  >
                    Payment Reference:{" "}
                    <strong style={{ color: "#059669" }}>
                      {selectedReservation.paymentReference}
                    </strong>
                  </p>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Room</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.roomId?.name ||
                    selectedReservation.roomId?.roomNumber ||
                    "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Branch</span>
                <span
                  style={{
                    color: "#1F2937",
                    fontWeight: "500",
                    textTransform: "capitalize",
                  }}
                >
                  {selectedReservation.roomId?.branch || "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Monthly Rate</span>
                <span style={{ color: "#E7710F", fontWeight: "600" }}>
                  ₱
                  {(
                    selectedReservation.roomId?.price ||
                    selectedReservation.totalPrice ||
                    0
                  ).toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#6B7280" }}>Move-in Date</span>
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {selectedReservation.finalMoveInDate
                    ? new Date(
                        selectedReservation.finalMoveInDate,
                      ).toLocaleDateString()
                    : "TBD"}
                </span>
              </div>
            </div>
          );
        }
        if (step.status === "pending_approval") {
          return (
            <div
              style={{
                padding: "12px 16px",
                background: "#FEF3C7",
                borderRadius: "8px",
                marginTop: "8px",
                fontSize: "14px",
                border: "1px solid #FCD34D",
              }}
            >
              <p style={{ color: "#78350F", margin: 0 }}>
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Clock size={14} />
                  Under Review:
                </strong>{" "}
                Your payment is being verified by our admin team. Once approved,
                your reservation will be confirmed.
              </p>
            </div>
          );
        }
        return null;

      default:
        return null;
    }
  };

  const activeStatusLabel =
    activeReservation?.reservationStatus ||
    activeReservation?.status ||
    "pending";

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          gap: "1rem",
        }}
      >
        <div
          style={{
            width: "50px",
            height: "50px",
            border: "4px solid #e5e7eb",
            borderTopColor: "#E7710F",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <p>Loading profile...</p>
        <style>
          {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
        </style>
      </div>
    );
  }

  const fullName =
    `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim() ||
    "User";
  const selectedRoom = selectedReservation?.roomId
    ? {
        roomNumber: selectedReservation.roomId.name,
        location: selectedReservation.roomId.branch,
        floor: selectedReservation.roomId.floor,
        roomType: selectedReservation.roomId.type,
        price: selectedReservation.roomId.price,
      }
    : null;
  const progressTotalSteps = 6;
  const progressStepNumber = selectedReservation
    ? reservationProgress.currentStepIndex + 1
    : 0;
  const progressPercent = selectedReservation
    ? Math.min(
        100,
        Math.round((progressStepNumber / progressTotalSteps) * 100),
      )
    : 0;
  const currentStepLabel = selectedReservation
    ? reservationProgress.steps?.[reservationProgress.currentStepIndex]?.title
    : null;
  const roomImageUrl = selectedReservation?.roomId?.images?.[0] || null;
  const roomMonthlyPrice =
    selectedReservation?.roomId?.price ||
    selectedReservation?.roomId?.monthlyPrice ||
    selectedReservation?.totalPrice ||
    0;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F7F8FA" }}>
      <style>
        {`
          @keyframes dropdownSlideDown {
            from {
              opacity: 0;
              max-height: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              max-height: 1000px;
              transform: translateY(0);
            }
          }

          @keyframes dropdownSlideUp {
            from {
              opacity: 1;
              max-height: 1000px;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              max-height: 0;
              transform: translateY(-10px);
            }
          }

          .dropdown-enter {
            animation: dropdownSlideDown 0.3s ease-out forwards;
          }

          .dropdown-exit {
            animation: dropdownSlideUp 0.3s ease-out forwards;
          }

          .reservation-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid #E8EBF0;
            background: white;
          }

          .reservation-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px -4px rgba(12, 55, 95, 0.08), 0 4px 8px -2px rgba(12, 55, 95, 0.04);
            border-color: #E7710F30;
          }

          .reservation-card-expanded {
            box-shadow: 0 12px 24px -4px rgba(12, 55, 95, 0.12), 0 4px 8px -2px rgba(12, 55, 95, 0.06);
            border-color: #E7710F;
          }

          .step-card {
            transition: all 0.25s ease;
            cursor: pointer;
            background: white;
            border-radius: 12px;
            padding: 20px;
            border: 2px solid transparent;
          }

          .step-card:hover {
            border-color: #E7710F20;
            transform: translateX(4px);
          }

          .step-card.clickable:hover {
            background: #FFF7ED;
            box-shadow: 0 4px 12px rgba(231, 113, 15, 0.08);
          }
        `}
      </style>
      {/* Left Sidebar Navigation */}
      <ProfileSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fullName={fullName}
        email={profileData.email}
        handleLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header
          className="bg-white border-b h-16 flex items-center justify-between px-8"
          style={{ borderColor: "#E8EBF0" }}
        >
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search here..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-gray-50 border-0 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: "#0C375F" }}
            >
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-8">
            {/* DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <div className="max-w-6xl">
                <div className="mb-8">
                  <h1
                    className="text-2xl font-semibold mb-1"
                    style={{ color: "#1F2937" }}
                  >
                    Dashboard
                  </h1>
                  <p className="text-sm text-gray-500">
                    Track your application progress and next steps
                  </p>
                </div>

                {/* NEXT ACTION PROMPT removed */}

                {/* NEW RESERVATION PROGRESS TRACKER - ENHANCED CARDS */}
                <div
                  className="bg-white rounded-xl p-8 border mb-6 shadow-sm"
                  style={{ borderColor: "#E8EBF0" }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3
                        className="font-semibold text-lg mb-1"
                        style={{ color: "#1F2937" }}
                      >
                        Reservation Progress
                      </h3>
                      <p className="text-sm text-gray-500">
                        Follow these steps from room selection to confirmation
                      </p>
                    </div>
                    {selectedReservation ? (
                      <div
                        className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
                        style={{
                          backgroundColor:
                            reservationProgress.currentStepIndex === 5
                              ? "#DEF7EC"
                              : reservationProgress.currentStepIndex === 4
                                ? "#FEF3C7"
                                : "#DBEAFE",
                          color:
                            reservationProgress.currentStepIndex === 5
                              ? "#03543F"
                              : reservationProgress.currentStepIndex === 4
                                ? "#92400E"
                                : "#1E40AF",
                        }}
                      >
                        Step {reservationProgress.currentStepIndex + 1} of 6
                      </div>
                    ) : (
                      <div
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: "#F3F4F6",
                          color: "#6B7280",
                        }}
                      >
                        Not started
                      </div>
                    )}
                  </div>

                  {/* Reservation Selector (shows when multiple active reservations) */}
                  {activeReservations.length > 1 && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Reservation to Track:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {activeReservations.map((res) => (
                          <button
                            key={res._id}
                            onClick={() => setSelectedReservationId(res._id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              selectedReservationId === res._id
                                ? "bg-orange-500 text-white shadow-md"
                                : "bg-white border border-gray-300 text-gray-700 hover:border-orange-300"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Home className="w-4 h-4" />
                              {res.roomId?.name || "Room"} -{" "}
                              {res.roomId?.branch === "gil-puyat"
                                ? "Gil Puyat"
                                : "Guadalupe"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show selected reservation info */}
                  {selectedReservation && (
                    <button
                      type="button"
                      onClick={() => setShowTracker((prev) => !prev)}
                      className="w-full text-left mb-6 p-4 bg-white rounded-2xl border border-gray-200 hover:border-orange-200 hover:shadow-md transition-all"
                      aria-expanded={showTracker}
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {roomImageUrl ? (
                            <img
                              src={roomImageUrl}
                              alt={selectedReservation.roomId?.name || "Room"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E5E7EB 0%, #F3F4F6 100%)" }}>
                              <Bed className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-semibold" style={{ color: "#0C375F" }}>
                                Room {selectedReservation.roomId?.name || "Unknown"}
                              </p>
                              <p className="text-sm text-gray-600">
                                {selectedReservation.roomId?.type || "Room"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>
                                  {selectedReservation.roomId?.branch === "gil-puyat"
                                    ? "Gil Puyat"
                                    : selectedReservation.roomId?.branch === "guadalupe"
                                      ? "Guadalupe"
                                      : selectedReservation.roomId?.branch || "Branch"}
                                  {selectedReservation.roomId?.floor
                                    ? ` · Floor ${selectedReservation.roomId.floor}`
                                    : ""}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-xl font-bold" style={{ color: "#E7710F" }}>
                                ₱{Number(roomMonthlyPrice || 0).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">per month</p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                              <span>
                                Progress: Step {progressStepNumber} of {progressTotalSteps}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-orange-600 font-medium">
                                  {progressPercent}%
                                </span>
                                {showTracker ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${progressPercent}%`,
                                  backgroundColor: "#E7710F",
                                }}
                              ></div>
                            </div>
                            {currentStepLabel && (
                              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                {currentStepLabel}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Enhanced Step Cards with Dropdown */}
                  {showTracker && (
                    <div className="space-y-3">
                      {stepsToRender.map((step, index) => {
                      const icons = {
                        room_selected: Home,
                        visit_scheduled: Calendar,
                        visit_completed: Check,
                        application_submitted: User,
                        payment_submitted: DollarSign,
                        confirmed: CheckCircle,
                      };
                      const StepIcon = icons[step.step];
                      const isCompleted = step.status === "completed";
                      const isCurrent = step.status === "current";
                      const isLocked = step.status === "locked";
                      const isPendingApproval =
                        step.status === "pending_approval";
                      const isRejected = step.status === "rejected";
                      const isExpanded = expandedStep === step.step;
                      const isClickable =
                        !isLocked &&
                        (selectedReservation ||
                          step.step === "room_selected") &&
                        (isCurrent || isRejected || step.editable === true);

                      return (
                        <div
                          key={index}
                          className={`reservation-card rounded-xl ${isExpanded ? "reservation-card-expanded" : ""}`}
                          style={{
                            overflow: "hidden",
                          }}
                        >
                          <div
                            className={`flex items-start gap-4 p-4 ${isClickable ? "cursor-pointer" : ""}`}
                            onClick={() => {
                              if (isCompleted || isCurrent || isRejected) {
                                setExpandedStep(
                                  isExpanded ? null : step.step,
                                );
                              }
                            }}
                          >
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm ${
                                isLocked ? "bg-gray-200" : ""
                              }`}
                              style={
                                isCompleted
                                  ? { backgroundColor: "#10B981" }
                                  : isCurrent
                                    ? { backgroundColor: "#E7710F" }
                                    : isPendingApproval
                                      ? { backgroundColor: "#F59E0B" }
                                      : isRejected
                                        ? { backgroundColor: "#EF4444" }
                                        : {}
                              }
                            >
                              {isLocked ? (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
                              ) : isRejected ? (
                                <AlertCircle className="w-6 h-6 text-white" />
                              ) : (
                                <StepIcon
                                  className={`w-6 h-6 ${isCompleted || isCurrent || isPendingApproval ? "text-white" : "text-gray-400"}`}
                                />
                              )}
                            </div>
                            <div
                              className={`flex-1 ${isLocked ? "opacity-50" : ""}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4
                                      className={`font-semibold ${isCurrent ? "text-orange-600" : isRejected ? "text-red-600" : ""}`}
                                      style={
                                        !isCurrent && !isRejected
                                          ? { color: "#1F2937" }
                                          : {}
                                      }
                                    >
                                      {step.title}
                                    </h4>
                                    {(isCompleted || isCurrent || isRejected) && (
                                      <button
                                        className="ml-auto"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setExpandedStep(
                                            isExpanded ? null : step.step,
                                          );
                                        }}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  <p
                                    className={`text-sm mt-1 ${isRejected ? "text-red-600" : "text-gray-600"}`}
                                  >
                                    {step.description}
                                  </p>
                                </div>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                                    isCompleted
                                      ? "bg-green-100 text-green-700"
                                      : isRejected
                                        ? "bg-red-100 text-red-700"
                                        : isPendingApproval
                                          ? "bg-amber-100 text-amber-700"
                                          : isCurrent
                                            ? "text-white"
                                            : isLocked
                                              ? "bg-gray-100 text-gray-500"
                                              : "bg-blue-100 text-blue-700"
                                  }`}
                                  style={
                                    isCurrent
                                      ? { backgroundColor: "#E7710F" }
                                      : {}
                                  }
                                >
                                  {isCompleted
                                    ? "Complete"
                                    : isRejected
                                      ? "Rejected"
                                      : isPendingApproval
                                        ? "Pending Approval"
                                        : isCurrent
                                          ? "In Progress"
                                          : isLocked
                                            ? "Locked"
                                            : "Upcoming"}
                                </span>
                              </div>
                              {step.completedDate && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Completed on{" "}
                                  {new Date(
                                    step.completedDate,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Dropdown Content */}
                          {isExpanded && (
                            <div className="dropdown-enter px-4 pb-4">
                              <div
                                className="border-t pt-4"
                                style={{ borderColor: "#E8EBF0" }}
                              >
                                {renderStepReceipt(step)}

                                {/* Action buttons */}
                                {!isLocked && selectedReservation && (
                                  <div className="flex items-center gap-2 mt-4">
                                    {step.step === "visit_scheduled" &&
                                      isRejected && (
                                        <button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            navigate("/tenant/reservation-flow", {
                                              state: {
                                                reservationId:
                                                  selectedReservation._id,
                                                continueFlow: true,
                                                step: 2,
                                              },
                                            });
                                          }}
                                          className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-red-50"
                                          style={{
                                            borderColor: "#EF4444",
                                            color: "#EF4444",
                                          }}
                                        >
                                          Reschedule Visit
                                        </button>
                                      )}
                                    {step.step === "room_selected" &&
                                      selectedReservation?.status !==
                                        "confirmed" &&
                                      selectedReservation?.status !==
                                        "checked-in" && (
                                      <button
                                        onClick={async (event) => {
                                          event.stopPropagation();
                                          if (
                                            window.confirm(
                                              "Are you sure you want to cancel this reservation? This action cannot be undone.",
                                            )
                                          ) {
                                            try {
                                              await reservationApi.delete(
                                                selectedReservation._id,
                                              );
                                              showNotification(
                                                "Reservation cancelled successfully",
                                                "success",
                                                3000,
                                              );
                                              window.location.reload();
                                            } catch (error) {
                                              console.error(
                                                "Error cancelling reservation:",
                                                error,
                                              );
                                              showNotification(
                                                "Failed to cancel reservation",
                                                "error",
                                                3000,
                                              );
                                            }
                                          }
                                        }}
                                        className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-red-50"
                                        style={{
                                          borderColor: "#EF4444",
                                          color: "#EF4444",
                                        }}
                                      >
                                        Cancel Reservation
                                      </button>
                                    )}
                                    {step.step === "application_submitted" &&
                                      step.editable && (
                                        <button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            navigate("/tenant/reservation-flow", {
                                              state: {
                                                reservationId:
                                                  selectedReservation._id,
                                                editMode: true,
                                                step: 4,
                                              },
                                            });
                                          }}
                                          className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-blue-50"
                                          style={{
                                            borderColor: "#3B82F6",
                                            color: "#3B82F6",
                                          }}
                                        >
                                          Edit Application
                                        </button>
                                      )}
                                    {isClickable && (isCurrent || isRejected) && (
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleStepClick(step);
                                        }}
                                        className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-all hover:shadow-md"
                                        style={{ backgroundColor: "#E7710F" }}
                                      >
                                        {isRejected ? "Reschedule" : "Continue"} →
                                      </button>
                                    )}
                                    {step.status === "completed" && (
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setReceiptModal({
                                            open: true,
                                            step,
                                          });
                                        }}
                                        className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-all hover:shadow-md"
                                        style={{ backgroundColor: "#E7710F" }}
                                      >
                                        View Receipt
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {!selectedReservation && activeReservations.length === 0 && (
                    <div className="text-center py-12">
                      <Bed className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        No Active Reservation
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Start your journey by browsing available rooms
                      </p>
                      <Link to="/tenant/check-availability">
                        <button
                          className="px-6 py-3 rounded-lg font-medium text-white shadow-md hover:shadow-lg transition-shadow"
                          style={{ backgroundColor: "#E7710F" }}
                        >
                          Browse Available Rooms
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PERSONAL DETAILS TAB */}
            {activeTab === "personal" && (
              <div className="max-w-5xl">
                <div className="mb-8">
                  <h1
                    className="text-2xl font-semibold mb-1"
                    style={{ color: "#1F2937" }}
                  >
                    Personal Details
                  </h1>
                  <p className="text-sm text-gray-500">
                    Basic information for inquiries, visits, and reservations
                  </p>
                </div>

                <div className="space-y-6">
                  <div
                    className="bg-white rounded-xl p-6 border shadow-sm"
                    style={{ borderColor: "#E8EBF0" }}
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#0C375F" }}
                      >
                        <User className="w-10 h-10 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2
                          className="text-xl font-semibold mb-1"
                          style={{ color: "#1F2937" }}
                        >
                          {fullName}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {profileData.email}
                        </p>
                        <p className="text-sm text-gray-400">
                          {profileData.city || "Not provided"}
                        </p>
                      </div>
                      {!isEditingProfile && (
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors flex items-center gap-2"
                          style={{ borderColor: "#E8EBF0", color: "#E7710F" }}
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditingProfile && (
                      <div className="flex gap-2 mb-6">
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="px-5 py-2 text-sm rounded-lg text-white shadow-sm hover:shadow-md transition-shadow"
                          style={{ backgroundColor: "#E7710F" }}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-5 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
                          style={{ borderColor: "#E8EBF0" }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      {[
                        {
                          label: "Full Name",
                          field: "firstName",
                          display: fullName,
                        },
                        { label: "Email Address", field: "email" },
                        { label: "Phone Number", field: "phone" },
                        {
                          label: "Date of Birth",
                          field: "dateOfBirth",
                          type: "date",
                        },
                        { label: "Address", field: "address" },
                        { label: "City", field: "city" },
                        { label: "Student ID", field: "studentId" },
                        { label: "School", field: "school" },
                        { label: "Year Level", field: "yearLevel" },
                        {
                          label: "Emergency Contact",
                          field: "emergencyContact",
                        },
                        { label: "Emergency Phone", field: "emergencyPhone" },
                      ].map((item) => (
                        <div key={item.field}>
                          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                            {item.label}
                          </label>
                          {isEditingProfile && item.field !== "email" ? (
                            item.field === "firstName" ? (
                              <>
                                <input
                                  type="text"
                                  value={editData.firstName || ""}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      firstName: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 mb-2"
                                  placeholder="First Name"
                                  style={{ borderColor: "#E8EBF0" }}
                                />
                                <input
                                  type="text"
                                  value={editData.lastName || ""}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      lastName: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                                  placeholder="Last Name"
                                  style={{ borderColor: "#E8EBF0" }}
                                />
                              </>
                            ) : (
                              <input
                                type={item.type || "text"}
                                value={editData[item.field] || ""}
                                onChange={(e) =>
                                  setEditData({
                                    ...editData,
                                    [item.field]: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                                style={{ borderColor: "#E8EBF0" }}
                              />
                            )
                          ) : (
                            <p
                              className="text-sm py-2.5"
                              style={{ color: "#1F2937" }}
                            >
                              {item.field === "firstName"
                                ? item.display
                                : item.type === "date" &&
                                    profileData[item.field]
                                  ? formatDate(profileData[item.field])
                                  : profileData[item.field] || "Not provided"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITY LOG TAB */}
            {activeTab === "history" && (
              <div className="max-w-5xl">
                <div className="mb-8">
                  <h1
                    className="text-2xl font-semibold mb-1"
                    style={{ color: "#1F2937" }}
                  >
                    Activity History
                  </h1>
                  <p className="text-sm text-gray-500">
                    Complete record of visit requests, approvals, and
                    reservation updates
                  </p>
                </div>

                <div
                  className="bg-white rounded-xl p-6 border shadow-sm"
                  style={{ borderColor: "#E8EBF0" }}
                >
                  {activityLog.length > 0 ? (
                    <div className="space-y-4">
                      {activityLog.map((activity, index) => (
                        <div key={activity.id} className="relative">
                          {index !== activityLog.length - 1 && (
                            <div className="absolute left-5 top-12 bottom-0 w-px bg-gray-200"></div>
                          )}
                          <div className="flex items-start gap-4">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 shadow-sm"
                              style={{
                                backgroundColor:
                                  activity.type === "payment"
                                    ? "#DEF7EC"
                                    : activity.type === "reservation" ||
                                        activity.type === "approval"
                                      ? "#EEF2FF"
                                      : activity.type === "visit"
                                        ? "#DBEAFE"
                                        : "#F3F4F6",
                              }}
                            >
                              {activity.type === "payment" ? (
                                <DollarSign className="w-5 h-5 text-green-600" />
                              ) : activity.type === "reservation" ||
                                activity.type === "approval" ? (
                                <FileText
                                  className="w-5 h-5"
                                  style={{ color: "#0C375F" }}
                                />
                              ) : activity.type === "visit" ? (
                                <Calendar className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Edit2 className="w-5 h-5 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 pb-8">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4
                                    className="font-semibold mb-1"
                                    style={{ color: "#1F2937" }}
                                  >
                                    {activity.title}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {activity.description}
                                  </p>
                                </div>
                                {activity.status && (
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                                      activity.status === "Completed" ||
                                      activity.status === "Confirmed" ||
                                      activity.status === "Approved" ||
                                      activity.status === "Complete"
                                        ? "bg-green-100 text-green-700"
                                        : activity.status === "Scheduled" ||
                                            activity.status === "Pending"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {activity.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">
                                {new Date(activity.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        No Activity Yet
                      </h3>
                      <p className="text-sm text-gray-500">
                        Your reservation activities will appear here
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Receipt Modal */}
      {receiptModal.open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setReceiptModal({ open: false, step: null })}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "450px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Receipt Header */}
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  backgroundColor: "#FFF7ED",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <FileText size={28} color="#E7710F" />
              </div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#1F2937",
                  margin: "0 0 4px",
                }}
              >
                {receiptModal.step?.title || "Receipt"}
              </h2>
              <p style={{ fontSize: "14px", color: "#6B7280", margin: 0 }}>
                {activeReservation?.reservationCode && (
                  <>
                    Reservation Code:{" "}
                    <strong>{activeReservation.reservationCode}</strong>
                    <br />
                  </>
                )}
                {activeReservation?.paymentReference && (
                  <>
                    Payment Reference:{" "}
                    <strong>{activeReservation.paymentReference}</strong>
                  </>
                )}
                {!activeReservation?.reservationCode &&
                  !activeReservation?.paymentReference && (
                    <>No tracking codes yet</>
                  )}
              </p>
            </div>

            {/* Receipt Content */}
            <div
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: "12px",
                padding: "16px",
                border: "1px dashed #D1D5DB",
              }}
            >
              {receiptModal.step?.step === "room_selected" && (
                <>
                  {/* Room Details Section */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Room Details
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Room Name/Number</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {selectedReservation?.roomId?.name ||
                          selectedReservation?.roomId?.roomNumber ||
                          "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Branch Location</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}
                      >
                        {selectedReservation?.roomId?.branch || "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Room Type</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}
                      >
                        {selectedReservation?.roomId?.type || "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Floor</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {selectedReservation?.roomId?.floor
                          ? `Floor ${selectedReservation.roomId.floor}`
                          : "Ground Floor"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Room Capacity</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {(() => {
                          const capacity =
                            selectedReservation?.roomId?.capacity ||
                            selectedReservation?.roomId?.beds?.length;
                          if (!capacity) return "N/A";
                          return `${capacity} ${capacity === 1 ? "Person" : "Persons"}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Selected Bed/Slot */}
                  {selectedReservation?.selectedBed && (
                    <div style={{ marginBottom: "12px" }}>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#E7710F",
                          marginBottom: "8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Selected Slot
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: "1px solid #E5E7EB",
                        }}
                      >
                        <span style={{ color: "#6B7280" }}>Bed/Slot ID</span>
                        <span style={{ color: "#1F2937", fontWeight: "600" }}>
                          {selectedReservation.selectedBed.id}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: "1px solid #E5E7EB",
                        }}
                      >
                        <span style={{ color: "#6B7280" }}>Position</span>
                        <span style={{ color: "#1F2937", fontWeight: "600" }}>
                          {selectedReservation.selectedBed.position ||
                            "Standard"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Room Amenities */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Room Amenities
                    </p>
                    <div style={{ padding: "8px 0" }}>
                      {selectedReservation?.roomId?.amenities &&
                      selectedReservation.roomId.amenities.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          {selectedReservation.roomId.amenities.map(
                            (amenity, index) => (
                              <span
                                key={index}
                                style={{
                                  backgroundColor: "#FFF7ED",
                                  color: "#E7710F",
                                  padding: "4px 10px",
                                  borderRadius: "12px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                }}
                              >
                                {amenity}
                              </span>
                            ),
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#6B7280", fontSize: "13px" }}>
                          Standard amenities included
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Section */}
                  <div style={{ marginBottom: "8px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Pricing Details
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Monthly Rate</span>
                      <span
                        style={{
                          color: "#E7710F",
                          fontWeight: "700",
                          fontSize: "18px",
                        }}
                      >
                        ₱
                        {(
                          selectedReservation?.roomId?.price ||
                          selectedReservation?.totalPrice ||
                          0
                        ).toLocaleString()}
                      </span>
                    </div>
                    {selectedReservation?.roomId?.deposit && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                        }}
                      >
                        <span style={{ color: "#6B7280" }}>
                          Security Deposit
                        </span>
                        <span style={{ color: "#1F2937", fontWeight: "600" }}>
                          ₱{selectedReservation.roomId.deposit.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Selection Timestamp */}
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      backgroundColor: "#ECFDF5",
                      borderRadius: "8px",
                      borderLeft: "3px solid #10B981",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#6B7280", fontSize: "12px" }}>
                        Room Selected On
                      </span>
                      <span
                        style={{
                          color: "#166534",
                          fontWeight: "600",
                          fontSize: "13px",
                        }}
                      >
                        {selectedReservation?.createdAt
                          ? new Date(
                              selectedReservation.createdAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {receiptModal.step?.step === "visit_scheduled" && (
                <>
                  {/* Visit Booking Header */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Booking Details
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Visit Type</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {activeReservation?.viewingType === "inperson" ? (
                          <>
                            <Home size={16} />
                            In-Person Visit
                          </>
                        ) : (
                          <>
                            <Monitor size={16} />
                            Virtual Tour
                          </>
                        )}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>
                        {activeReservation?.scheduleApproved
                          ? "Confirmed Date"
                          : "Preferred Move-in Date"}
                      </span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.targetMoveInDate
                          ? new Date(
                              activeReservation.targetMoveInDate,
                            ).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "To be confirmed"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Schedule Status</span>
                      <span
                        style={{
                          color: activeReservation?.scheduleApproved
                            ? "#10B981"
                            : "#F59E0B",
                          fontWeight: "600",
                        }}
                      >
                        {activeReservation?.scheduleApproved
                          ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Check size={14} />
                                Confirmed by Admin
                              </span>
                            )
                          : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Clock size={14} />
                                Awaiting Admin Confirmation
                              </span>
                            )}
                      </span>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Contact Information
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Visitor Name</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.userId?.fullName ||
                          `${activeReservation?.firstName || ""} ${activeReservation?.lastName || ""}`.trim() ||
                          "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Contact Number</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.mobileNumber ||
                          activeReservation?.userId?.mobileNumber ||
                          "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Email</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          fontSize: "13px",
                        }}
                      >
                        {activeReservation?.userId?.email || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Policies Section */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Terms & Policies
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>
                        Policies Accepted
                      </span>
                      <span
                        style={{
                          color: "#10B981",
                          fontWeight: "600",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Check size={14} />
                        Yes
                      </span>
                    </div>
                  </div>

                  {/* Booking Timestamp */}
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      backgroundColor: "#ECFDF5",
                      borderRadius: "8px",
                      borderLeft: "3px solid #10B981",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#6B7280", fontSize: "12px" }}>
                        Booking Submitted
                      </span>
                      <span
                        style={{
                          color: "#166534",
                          fontWeight: "600",
                          fontSize: "13px",
                        }}
                      >
                        {activeReservation?.scheduleRequestedAt
                          ? new Date(
                              activeReservation.scheduleRequestedAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date(
                              activeReservation?.updatedAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {receiptModal.step?.step === "visit_completed" && (
                <>
                  {/* Visit Completion Status */}
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        backgroundColor: "#ECFDF5",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <CheckCircle size={28} color="#16A34A" />
                    </div>
                    <p
                      style={{
                        color: "#166534",
                        fontWeight: "700",
                        fontSize: "16px",
                        margin: "0 0 4px",
                      }}
                    >
                      Visit Completed Successfully
                    </p>
                    <p
                      style={{ color: "#6B7280", fontSize: "13px", margin: 0 }}
                    >
                      Your{" "}
                      {activeReservation?.viewingType === "inperson"
                        ? "in-person visit"
                        : "virtual tour"}{" "}
                      has been verified
                    </p>
                  </div>

                  {/* Completion Date */}
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "16px",
                      backgroundColor: "#ECFDF5",
                      borderRadius: "8px",
                      border: "1px solid #A7F3D0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#6B7280",
                            fontSize: "12px",
                            margin: "0 0 4px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Completion Date
                        </p>
                        <p
                          style={{
                            color: "#166534",
                            fontWeight: "700",
                            fontSize: "18px",
                            margin: 0,
                          }}
                        >
                          {activeReservation?.visitCompletedAt
                            ? new Date(
                                activeReservation.visitCompletedAt,
                              ).toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })
                            : activeReservation?.updatedAt
                              ? new Date(
                                  activeReservation.updatedAt,
                                ).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                        </p>
                      </div>
                      <Calendar size={22} color="#166534" />
                    </div>
                  </div>
                </>
              )}

              {receiptModal.step?.step === "application_submitted" && (
                <>
                  {/* Personal Information */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Personal Information
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Full Name</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.firstName}{" "}
                        {activeReservation?.middleName
                          ? `${activeReservation.middleName} `
                          : ""}
                        {activeReservation?.lastName}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Date of Birth</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.dateOfBirth
                          ? new Date(
                              activeReservation.dateOfBirth,
                            ).toLocaleDateString("en-US", {
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
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Gender</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}
                      >
                        {activeReservation?.gender || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Contact Information
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Mobile Number</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.mobileNumber || "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Email</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          fontSize: "13px",
                        }}
                      >
                        {activeReservation?.userId?.email || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Address Information */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Address
                    </p>
                    <div style={{ padding: "8px 0" }}>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "500",
                          lineHeight: "1.5",
                        }}
                      >
                        {activeReservation?.address
                          ? `${activeReservation.address}${activeReservation.city ? `, ${activeReservation.city}` : ""}${activeReservation.province ? `, ${activeReservation.province}` : ""}${activeReservation.zipCode ? ` ${activeReservation.zipCode}` : ""}`
                          : activeReservation?.permanentAddress || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Emergency Contact
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Name</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.emergencyContactName || "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Relationship</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}
                      >
                        {activeReservation?.emergencyContactRelation || "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Contact Number</span>
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.emergencyContactNumber || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Submission Timestamp */}
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      backgroundColor: "#ECFDF5",
                      borderRadius: "8px",
                      borderLeft: "3px solid #10B981",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#6B7280", fontSize: "12px" }}>
                        Application Submitted
                      </span>
                      <span
                        style={{
                          color: "#166534",
                          fontWeight: "600",
                          fontSize: "13px",
                        }}
                      >
                        {activeReservation?.applicationSubmittedAt
                          ? new Date(
                              activeReservation.applicationSubmittedAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date(
                              activeReservation?.updatedAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {receiptModal.step?.step === "payment_submitted" && (
                <>
                  {/* Payment Proof Image */}
                  <div style={{ marginBottom: "16px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Proof of Payment
                    </p>
                    {activeReservation?.proofOfPayment ||
                    activeReservation?.paymentProofUrl ? (
                      <div
                        style={{
                          borderRadius: "8px",
                          overflow: "hidden",
                          border: "1px solid #E5E7EB",
                        }}
                      >
                        <img
                          src={
                            activeReservation?.proofOfPayment ||
                            activeReservation?.paymentProofUrl
                          }
                          alt="Proof of Payment"
                          style={{
                            width: "100%",
                            maxHeight: "250px",
                            objectFit: "contain",
                            backgroundColor: "#F9FAFB",
                          }}
                          onClick={() =>
                            window.open(
                              activeReservation?.proofOfPayment ||
                                activeReservation?.paymentProofUrl,
                              "_blank",
                            )
                          }
                        />
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#6B7280",
                            textAlign: "center",
                            margin: "8px 0",
                            cursor: "pointer",
                          }}
                        >
                          Click image to view full size
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "24px",
                          backgroundColor: "#F9FAFB",
                          borderRadius: "8px",
                          textAlign: "center",
                          border: "1px dashed #D1D5DB",
                        }}
                      >
                        <FileText size={22} color="#6B7280" />
                        <p
                          style={{
                            color: "#6B7280",
                            fontSize: "13px",
                            margin: "8px 0 0",
                          }}
                        >
                          Payment proof not available
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment Details */}
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#E7710F",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Payment Details
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Amount Paid</span>
                      <span
                        style={{
                          color: "#E7710F",
                          fontWeight: "700",
                          fontSize: "18px",
                        }}
                      >
                        ₱{(activeReservation?.totalPrice || 0).toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>Payment Method</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}
                      >
                        {activeReservation?.paymentMethod || "N/A"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                      }}
                    >
                      <span style={{ color: "#6B7280" }}>
                        Verification Status
                      </span>
                      <span
                        style={{
                          color:
                            activeReservation?.status === "confirmed"
                              ? "#10B981"
                              : "#F59E0B",
                          fontWeight: "600",
                        }}
                      >
                        {activeReservation?.status === "confirmed"
                          ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Check size={14} />
                                Verified
                              </span>
                            )
                          : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Clock size={14} />
                                Pending Verification
                              </span>
                            )}
                      </span>
                    </div>
                  </div>

                  {/* Submission Timestamp */}
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      backgroundColor: "#ECFDF5",
                      borderRadius: "8px",
                      border: "1px solid #A7F3D0",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#166534",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Submission Date & Time
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#166534",
                            fontWeight: "700",
                            fontSize: "16px",
                            margin: 0,
                          }}
                        >
                          {activeReservation?.paymentSubmittedAt
                            ? new Date(
                                activeReservation.paymentSubmittedAt,
                              ).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : activeReservation?.updatedAt
                              ? new Date(
                                  activeReservation.updatedAt,
                                ).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                        </p>
                        <p
                          style={{
                            color: "#6B7280",
                            fontSize: "13px",
                            margin: "4px 0 0",
                          }}
                        >
                          {activeReservation?.paymentSubmittedAt
                            ? new Date(
                                activeReservation.paymentSubmittedAt,
                              ).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : activeReservation?.updatedAt
                              ? new Date(
                                  activeReservation.updatedAt,
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : ""}
                        </p>
                      </div>
                      <Clock size={22} color="#E7710F" />
                    </div>
                  </div>
                </>
              )}

              {receiptModal.step?.step === "confirmed" && (
                <>
                  <div
                    style={{
                      textAlign: "center",
                      padding: "16px 0",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <CheckCircle size={30} color="#166534" />
                    <p
                      style={{
                        color: "#166534",
                        fontWeight: "700",
                        fontSize: "18px",
                        margin: "8px 0 0",
                      }}
                    >
                      Reservation Confirmed!
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <span style={{ color: "#6B7280" }}>Room</span>
                    <span style={{ color: "#1F2937", fontWeight: "600" }}>
                      {activeReservation?.roomId?.name ||
                        activeReservation?.roomId?.roomNumber ||
                        "N/A"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <span style={{ color: "#6B7280" }}>Branch</span>
                    <span
                      style={{
                        color: "#1F2937",
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {activeReservation?.roomId?.branch || "N/A"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <span style={{ color: "#6B7280" }}>Monthly Rate</span>
                    <span style={{ color: "#E7710F", fontWeight: "700" }}>
                      ₱
                      {(
                        activeReservation?.roomId?.price ||
                        activeReservation?.totalPrice ||
                        0
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                    }}
                  >
                    <span style={{ color: "#6B7280" }}>Move-in Date</span>
                    <span style={{ color: "#1F2937", fontWeight: "600" }}>
                      {activeReservation?.finalMoveInDate
                        ? new Date(
                            activeReservation.finalMoveInDate,
                          ).toLocaleDateString()
                        : "TBD"}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Receipt Footer */}
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <p
                style={{
                  fontSize: "12px",
                  color: "#9CA3AF",
                  margin: "0 0 16px",
                }}
              >
                Generated on{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <button
                onClick={() => setReceiptModal({ open: false, step: null })}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#E5E7EB",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;