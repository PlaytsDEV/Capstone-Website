import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
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
  LogOut,
  Search,
  Check,
  LayoutDashboard,
  AlertCircle,
  CreditCard,
  ArrowRight,
  MapPin,
} from "lucide-react";

const ProfilePage = () => {
  const { user: authUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();
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

        // Load reservations and visits
        await loadReservationsAndVisits();
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const loadReservationsAndVisits = async () => {
    try {
      // Load reservations
      const reservationsData = await reservationApi.getAll();
      setReservations(reservationsData || []);

      // Find active reservation
      const active = reservationsData?.find((r) => {
        const status = r.reservationStatus || r.status;
        return status !== "completed" && status !== "cancelled";
      });
      setActiveReservation(active || null);

      // Extract visits from reservations
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

      // Build activity log from reservations
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
        if (r.paymentDate) {
          activities.push({
            id: `payment-${r._id}`,
            type: "payment",
            title: "Deposit Payment Completed",
            description: `Successfully paid security deposit for Room ${r.roomId?.name || "N/A"}`,
            date: r.paymentDate,
            status: "Completed",
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

  // Get reservation progress based on current status
  const getReservationProgress = () => {
    if (!activeReservation) {
      return {
        currentStep: "not_started",
        steps: [],
        currentStepIndex: -1,
      };
    }

    const status =
      activeReservation.reservationStatus ||
      activeReservation.status ||
      "pending";
    const stepOrder = [
      "room_selected",
      "visit_scheduled",
      "visit_completed",
      "application_submitted",
      "payment_submitted",
      "confirmed",
    ];

    const hasRoom = Boolean(activeReservation.roomId);
    const hasPoliciesAccepted = Boolean(
      activeReservation.agreedToPrivacy === true,
    );
    const hasVisitRequest = Boolean(
      activeReservation.viewingType && activeReservation.viewingType !== "none",
    );
    const isVisitScheduled = hasPoliciesAccepted && hasVisitRequest;
    const isVisitCompleted = Boolean(activeReservation.visitApproved === true);
    const hasApplication = Boolean(
      activeReservation.firstName && activeReservation.lastName,
    );
    const hasPayment = Boolean(activeReservation.proofOfPaymentUrl);
    const isConfirmed =
      status === "confirmed" || activeReservation.paymentStatus === "paid";

    let currentStepIndex = -1;
    if (hasRoom) currentStepIndex = 0;
    if (isVisitScheduled) currentStepIndex = 1;
    if (isVisitCompleted) currentStepIndex = 2;
    if (hasApplication) currentStepIndex = 3;
    if (hasPayment) currentStepIndex = 4;
    if (isConfirmed) currentStepIndex = 5;

    // Room selection is NOT editable once confirmed
    const isRoomEditable = false;
    // Application is editable until payment is submitted
    const isApplicationEditable = currentStepIndex >= 3 && !hasPayment;

    // Determine pending approval states
    const isSchedulePendingApproval =
      isVisitScheduled && !activeReservation.scheduleApproved;
    const isVisitPendingCompletion =
      activeReservation.scheduleApproved && !isVisitCompleted;
    const isPaymentPendingVerification = hasPayment && !isConfirmed;
    const isScheduleRejected = Boolean(activeReservation.scheduleRejected);

    const steps = [
      {
        step: "room_selected",
        title: "1. Room Selection",
        description: "Room selected and reserved",
        status: currentStepIndex >= 0 ? "completed" : "current",
        completedDate: activeReservation.createdAt,
      },
      {
        step: "visit_scheduled",
        title: "2. Policies & Visit Scheduled",
        description: isScheduleRejected
          ? `Schedule rejected: ${activeReservation.scheduleRejectionReason || "No reason provided"}`
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
          currentStepIndex >= 1 ? activeReservation.updatedAt : undefined,
        rejectionReason: isScheduleRejected
          ? activeReservation.scheduleRejectionReason
          : null,
      },
      {
        step: "visit_completed",
        title: "3. Visit Completed",
        description: activeReservation.scheduleApproved
          ? "Waiting for admin to verify visit completion"
          : isScheduleRejected
            ? "Please reschedule your visit"
            : "Complete your scheduled visit first",
        status:
          currentStepIndex >= 2
            ? "completed"
            : currentStepIndex === 1 && activeReservation.scheduleApproved
              ? "pending_approval"
              : "locked",
        completedDate:
          currentStepIndex >= 2
            ? activeReservation.visitCompletedAt
            : undefined,
      },
      {
        step: "application_submitted",
        title: "4. Tenant Application Submitted",
        description: isApplicationEditable
          ? "Application submitted - can still edit"
          : "Personal details and documents submitted",
        status:
          currentStepIndex >= 3
            ? "completed"
            : currentStepIndex === 2
              ? "current"
              : "locked",
        completedDate:
          currentStepIndex >= 3
            ? activeReservation.applicationSubmittedAt
            : undefined,
        editable: isApplicationEditable,
      },
      {
        step: "payment_submitted",
        title: "5. Payment Submitted",
        description: "Payment proof uploaded and pending verification",
        status:
          currentStepIndex >= 4
            ? isPaymentPendingVerification
              ? "pending_approval"
              : "completed"
            : currentStepIndex === 3
              ? "current"
              : "locked",
        completedDate:
          currentStepIndex >= 4 ? activeReservation.paymentDate : undefined,
      },
      {
        step: "confirmed",
        title: "6. Reservation Confirmed",
        description: "Reservation fully confirmed and finalized",
        status:
          currentStepIndex >= 5
            ? "completed"
            : currentStepIndex === 4
              ? "current"
              : "locked",
        completedDate:
          currentStepIndex >= 5 ? activeReservation.approvedDate : undefined,
      },
    ];

    return {
      currentStep: stepOrder[currentStepIndex] || "room_selected",
      steps,
      currentStepIndex: Math.max(currentStepIndex, 0),
    };
  };

  // Function to get progress for a specific reservation
  const getProgressForReservation = (reservation) => {
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
    const isScheduleRejected = Boolean(reservation.scheduleRejected);

    let currentStepIndex = -1;
    if (hasRoom) currentStepIndex = 0;
    if (isVisitScheduled && !isScheduleRejected) currentStepIndex = 1;
    if (isVisitCompleted) currentStepIndex = 2;
    if (hasApplication) currentStepIndex = 3;
    if (hasPayment) currentStepIndex = 4;
    if (isConfirmed) currentStepIndex = 5;

    const isSchedulePendingApproval =
      isVisitScheduled && !reservation.scheduleApproved && !isScheduleRejected;

    const steps = [
      {
        step: "room_selected",
        title: "1. Room Selection",
        description: "Room selected and reserved",
        status: currentStepIndex >= 0 ? "completed" : "current",
        completedDate: reservation.createdAt,
      },
      {
        step: "visit_scheduled",
        title: "2. Policies & Visit Scheduled",
        description: isScheduleRejected
          ? `Schedule rejected: ${reservation.scheduleRejectionReason || "No reason provided"}`
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
        rejectionReason: isScheduleRejected
          ? reservation.scheduleRejectionReason
          : null,
      },
      {
        step: "visit_completed",
        title: "3. Visit Completed",
        description: reservation.scheduleApproved
          ? "Waiting for admin to verify visit completion"
          : isScheduleRejected
            ? "Please reschedule your visit"
            : "Complete your scheduled visit first",
        status:
          currentStepIndex >= 2
            ? "completed"
            : currentStepIndex === 1 && reservation.scheduleApproved
              ? "pending_approval"
              : "locked",
      },
      {
        step: "application_submitted",
        title: "4. Tenant Application Submitted",
        description: "Personal details and documents submitted",
        status:
          currentStepIndex >= 3
            ? "completed"
            : currentStepIndex === 2
              ? "current"
              : "locked",
      },
      {
        step: "payment_submitted",
        title: "5. Payment Submitted",
        description: "Payment proof uploaded and pending verification",
        status:
          currentStepIndex >= 4
            ? "completed"
            : currentStepIndex === 3
              ? "current"
              : "locked",
      },
      {
        step: "confirmed",
        title: "6. Reservation Confirmed",
        description: "Reservation fully confirmed and finalized",
        status:
          currentStepIndex >= 5
            ? "completed"
            : currentStepIndex === 4
              ? "current"
              : "locked",
      },
    ];

    return {
      currentStep: stepOrder[currentStepIndex] || "room_selected",
      steps,
      currentStepIndex: Math.max(currentStepIndex, 0),
      roomName: reservation.roomId?.name || "Unknown Room",
      branch: reservation.roomId?.branch || "N/A",
      reservationId: reservation._id,
    };
  };

  const reservationProgress = getReservationProgress();

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

  const stepsToRender = activeReservation
    ? reservationProgress.steps
    : defaultSteps;

  const [expandedStep, setExpandedStep] = useState(null);
  const [receiptModal, setReceiptModal] = useState({ open: false, step: null });

  const handleStepClick = (step, reservation) => {
    // Handle locked steps
    if (step.status === "locked") {
      showNotification("Complete previous steps first.", "warning", 2500);
      return;
    }

    // Handle rejected steps - navigate to reschedule
    if (step.status === "rejected") {
      return; // Rejection has its own reschedule button
    }

    // Handle pending approval steps - just show info
    if (step.status === "pending_approval") {
      showNotification("Waiting for admin approval.", "info", 2500);
      return;
    }

    // Handle completed steps - no action needed
    if (step.status === "completed") {
      return;
    }

    // Navigate based on current step that needs action
    const reservationId = reservation?._id;

    switch (step.step) {
      case "room_selected":
        if (!reservationId) {
          navigate("/tenant/check-availability");
        } else {
          navigate("/tenant/reservation-flow", {
            state: { reservationId, continueFlow: true, step: 2 },
          });
        }
        break;
      case "visit_scheduled":
        // Navigate to schedule visit (step 2)
        navigate("/tenant/reservation-flow", {
          state: { reservationId, continueFlow: true, step: 2 },
        });
        break;
      case "visit_completed":
        navigate("/tenant/reservation-flow", {
          state: { reservationId, continueFlow: true, step: 4 },
        });
        break;
      case "application_submitted":
        navigate("/tenant/reservation-flow", {
          state: { reservationId, continueFlow: true, step: 5 },
        });
        break;
      case "payment_submitted":
        // Waiting for payment verification
        showNotification("Payment is being verified.", "info", 2500);
        break;
      case "confirmed":
        showNotification("Reservation is confirmed!", "success", 2500);
        break;
      default:
        break;
    }
  };

  // Render inline receipt content for each step
  const renderStepReceipt = (step) => {
    if (!activeReservation) return null;

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
                {activeReservation.roomId?.name ||
                  activeReservation.roomId?.roomNumber ||
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
                {activeReservation.roomId?.branch || "N/A"}
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
                {activeReservation.roomId?.type || "N/A"}
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
                  activeReservation.roomId?.price ||
                  activeReservation.totalPrice ||
                  0
                ).toLocaleString()}
              </span>
            </div>
            {activeReservation.selectedBed && (
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
                  {activeReservation.selectedBed.position} (
                  {activeReservation.selectedBed.id})
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
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {activeReservation.viewingType === "inperson"
                    ? "🏠 In-Person Visit"
                    : activeReservation.viewingType === "virtual"
                      ? "💻 Virtual Verification"
                      : "Not selected"}
                </span>
              </div>
              {activeReservation.isOutOfTown && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ color: "#6B7280" }}>Location</span>
                  <span style={{ color: "#1F2937", fontWeight: "500" }}>
                    📍 {activeReservation.currentLocation || "Out of town"}
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
                    color: activeReservation.agreedToPrivacy
                      ? "#10B981"
                      : "#6B7280",
                    fontWeight: "500",
                  }}
                >
                  {activeReservation.agreedToPrivacy ? "✓ Yes" : "No"}
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
                    color: activeReservation.scheduleApproved
                      ? "#10B981"
                      : "#F59E0B",
                    fontWeight: "600",
                  }}
                >
                  {activeReservation.scheduleApproved
                    ? "✓ Approved"
                    : "⏳ Awaiting Admin Approval"}
                </span>
              </div>
              {step.status === "current" &&
                !activeReservation.scheduleApproved && (
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
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {activeReservation.viewingType === "inperson"
                    ? "🏠 In-Person Visit"
                    : "💻 Virtual Verification"}
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
                <span style={{ color: "#10B981", fontWeight: "600" }}>
                  ✓ Approved
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
                <span style={{ color: "#10B981", fontWeight: "600" }}>
                  ✓ Completed & Verified
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
                <span style={{ color: "#1F2937", fontWeight: "500" }}>
                  {activeReservation.viewingType === "inperson"
                    ? "🏠 In-Person Visit"
                    : "💻 Virtual Verification"}
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
                    color: activeReservation.scheduleApproved
                      ? "#10B981"
                      : "#F59E0B",
                    fontWeight: "600",
                  }}
                >
                  {activeReservation.scheduleApproved
                    ? "✓ Approved"
                    : "⏳ Awaiting Approval"}
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
                <span style={{ color: "#F59E0B", fontWeight: "600" }}>
                  ⏳ Awaiting Completion
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
                  {activeReservation.firstName}{" "}
                  {activeReservation.middleName
                    ? activeReservation.middleName + " "
                    : ""}
                  {activeReservation.lastName}
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
                  {activeReservation.mobileNumber || "N/A"}
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
                  {activeReservation.emergencyContactName || "N/A"}
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
                  {activeReservation.employerSchool || "N/A"}
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
                <span style={{ color: "#10B981", fontWeight: "600" }}>
                  ✓ Submitted
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
                <strong>📝 Action Required:</strong> Submit your personal
                details and documents for admin review.
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
                  ₱{(activeReservation.totalPrice || 0).toLocaleString()}
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
                  {activeReservation.paymentMethod || "N/A"}
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
                  {activeReservation.finalMoveInDate
                    ? new Date(
                        activeReservation.finalMoveInDate,
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
                <span style={{ color: "#10B981", fontWeight: "600" }}>
                  ✓ Verified
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
                <strong>💳 Action Required:</strong> Upload your proof of
                payment to proceed.
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
                    margin: "0 0 4px",
                  }}
                >
                  🎉 Reservation Confirmed!
                </p>
                <p style={{ color: "#6B7280", fontSize: "13px", margin: 0 }}>
                  Code:{" "}
                  <strong>{activeReservation.reservationCode || "N/A"}</strong>
                </p>
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
                  {activeReservation.roomId?.name ||
                    activeReservation.roomId?.roomNumber ||
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
                  {activeReservation.roomId?.branch || "N/A"}
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
                    activeReservation.roomId?.price ||
                    activeReservation.totalPrice ||
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
                  {activeReservation.finalMoveInDate
                    ? new Date(
                        activeReservation.finalMoveInDate,
                      ).toLocaleDateString()
                    : "TBD"}
                </span>
              </div>
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
      </div>
    );
  }

  const fullName =
    `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim() ||
    "User";
  const selectedRoom = activeReservation?.roomId
    ? {
        roomNumber: activeReservation.roomId.name,
        location: activeReservation.roomId.branch,
        floor: activeReservation.roomId.floor,
        roomType: activeReservation.roomId.type,
        price: activeReservation.roomId.price,
      }
    : null;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F7F8FA" }}>
      {/* Left Sidebar Navigation */}
      <aside
        className="w-64 bg-white border-r flex flex-col"
        style={{ borderColor: "#E8EBF0" }}
      >
        <div className="p-6 border-b" style={{ borderColor: "#E8EBF0" }}>
          <Link
            to="/tenant/check-availability"
            className="flex items-center gap-3"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#0C375F" }}
            >
              <Bed className="w-5 h-5 text-white" />
            </div>
            <span
              className="font-semibold text-lg"
              style={{ color: "#0C375F" }}
            >
              Lilycrest
            </span>
          </Link>
        </div>

        <div className="p-4 border-b" style={{ borderColor: "#E8EBF0" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#0C375F" }}
            >
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "#1F2937" }}
              >
                {fullName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profileData.email}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
              Menu
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === "dashboard"
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  activeTab === "dashboard"
                    ? { backgroundColor: "#E7710F" }
                    : {}
                }
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </button>
              {/* <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Home className="w-5 h-5" />
                <span>Home</span>
              </Link> */}
              <Link
                to="/tenant/check-availability"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Bed className="w-5 h-5" />
                <span>Browse Rooms</span>
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
              Account
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("personal")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === "personal"
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  activeTab === "personal" ? { backgroundColor: "#E7710F" } : {}
                }
              >
                <User className="w-5 h-5" />
                <span>Personal Details</span>
              </button>
              <button
                onClick={() => setActiveTab("room")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === "room"
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  activeTab === "room" ? { backgroundColor: "#E7710F" } : {}
                }
              >
                <CreditCard className="w-5 h-5" />
                <span>Room & Payment</span>
                {activeReservation && (
                  <span
                    className="ml-auto w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#10B981" }}
                  ></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === "history"
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  activeTab === "history" ? { backgroundColor: "#E7710F" } : {}
                }
              >
                <History className="w-5 h-5" />
                <span>Activity Log</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: "#E8EBF0" }}>
          <Link
            to="/signin"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </Link>
        </div>
      </aside>

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
            <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors relative">
              <Bell className="w-5 h-5 text-gray-600" />
              {unacknowledgedCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: "#EF4444" }}
                ></span>
              )}
            </button>
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

                {/* RESERVATION PROGRESS TRACKER - CARD FORMAT */}
                <div className="space-y-6 mb-6">
                  {/* Show card for each reservation, or default empty state */}
                  {reservations.filter((r) => {
                    const status = r.reservationStatus || r.status;
                    return status !== "completed" && status !== "cancelled";
                  }).length > 0 ? (
                    reservations
                      .filter((r) => {
                        const status = r.reservationStatus || r.status;
                        return status !== "completed" && status !== "cancelled";
                      })
                      .map((reservation) => {
                        const progress = getProgressForReservation(reservation);
                        const roomName =
                          reservation.roomId?.name || "Unknown Room";
                        const branchName =
                          reservation.roomId?.branch === "gil-puyat"
                            ? "Gil Puyat"
                            : "Guadalupe";

                        return (
                          <div
                            key={reservation._id}
                            className="bg-white rounded-xl border overflow-hidden"
                            style={{ borderColor: "#E8EBF0" }}
                          >
                            {/* Card Header - Room Info */}
                            <div
                              className="p-4 border-b flex items-center justify-between"
                              style={{
                                backgroundColor: "#F8FAFC",
                                borderColor: "#E8EBF0",
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: "#FFF7ED" }}
                                >
                                  <Home
                                    className="w-5 h-5"
                                    style={{ color: "#E7710F" }}
                                  />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">
                                    {roomName}
                                  </h4>
                                  <p className="text-xs text-gray-500">
                                    {branchName} Branch • Code:{" "}
                                    {reservation.reservationCode || "N/A"}
                                  </p>
                                </div>
                              </div>
                              <div
                                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{
                                  backgroundColor:
                                    progress.currentStepIndex === 5
                                      ? "#DEF7EC"
                                      : progress.currentStepIndex === 4
                                        ? "#FEF3C7"
                                        : "#DBEAFE",
                                  color:
                                    progress.currentStepIndex === 5
                                      ? "#03543F"
                                      : progress.currentStepIndex === 4
                                        ? "#92400E"
                                        : "#1E40AF",
                                }}
                              >
                                Step {progress.currentStepIndex + 1} of 6
                              </div>
                            </div>

                            {/* Card Body - Progress Steps */}
                            <div className="p-6">
                              <div className="flex items-center justify-between mb-6">
                                <div>
                                  <h3
                                    className="font-semibold text-base"
                                    style={{ color: "#1F2937" }}
                                  >
                                    Reservation Progress
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    Follow these steps to complete your
                                    reservation
                                  </p>
                                </div>
                              </div>

                              {/* Progress Steps */}
                              <div className="space-y-4">
                                {progress.steps.map((step, stepIndex) => {
                                  const icons = {
                                    room_selected: Home,
                                    visit_scheduled: Calendar,
                                    visit_completed: Check,
                                    application_submitted: User,
                                    payment_submitted: DollarSign,
                                    confirmed: CheckCircle,
                                  };
                                  const StepIcon = icons[step.step];
                                  const isCompleted =
                                    step.status === "completed";
                                  const isCurrent = step.status === "current";
                                  const isLocked = step.status === "locked";
                                  const isPendingApproval =
                                    step.status === "pending_approval";
                                  const isRejected = step.status === "rejected";
                                  const isClickable = !isLocked && !isRejected;

                                  return (
                                    <div key={stepIndex} className="relative">
                                      {stepIndex !==
                                        progress.steps.length - 1 && (
                                        <div
                                          className="absolute left-6 top-14 bottom-0 w-0.5"
                                          style={{
                                            backgroundColor: isCompleted
                                              ? "#10B981"
                                              : "#E5E7EB",
                                          }}
                                        />
                                      )}
                                      <div
                                        className={`flex items-start gap-4 ${isClickable ? "cursor-pointer" : ""}`}
                                        onClick={
                                          isClickable
                                            ? () =>
                                                handleStepClick(
                                                  step,
                                                  reservation,
                                                )
                                            : undefined
                                        }
                                      >
                                        <div
                                          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 transition-all ${isLocked ? "bg-gray-200" : ""}`}
                                          style={
                                            isCompleted
                                              ? { backgroundColor: "#10B981" }
                                              : isCurrent
                                                ? { backgroundColor: "#E7710F" }
                                                : isPendingApproval
                                                  ? {
                                                      backgroundColor:
                                                        "#F59E0B",
                                                    }
                                                  : isRejected
                                                    ? {
                                                        backgroundColor:
                                                          "#DC2626",
                                                      }
                                                    : {}
                                          }
                                        >
                                          {isLocked ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                                          ) : isRejected ? (
                                            <span className="text-white text-lg font-bold">
                                              ✕
                                            </span>
                                          ) : (
                                            <StepIcon
                                              className={`w-6 h-6 ${isCompleted || isCurrent || isPendingApproval ? "text-white" : "text-gray-400"}`}
                                            />
                                          )}
                                        </div>
                                        <div
                                          className={`flex-1 pb-6 ${isLocked ? "opacity-50" : ""}`}
                                        >
                                          <div className="flex items-start justify-between mb-2">
                                            <div>
                                              <h4
                                                className={`font-semibold mb-1 ${isCurrent ? "text-orange-600" : ""}`}
                                                style={
                                                  !isCurrent
                                                    ? { color: "#1F2937" }
                                                    : {}
                                                }
                                              >
                                                {step.title}
                                              </h4>
                                              <p className="text-sm text-gray-600">
                                                {step.description}
                                              </p>
                                            </div>
                                            <span
                                              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                                                isCompleted
                                                  ? "bg-green-100 text-green-700"
                                                  : isPendingApproval
                                                    ? "bg-amber-100 text-amber-700"
                                                    : isRejected
                                                      ? "bg-red-100 text-red-700"
                                                      : isCurrent
                                                        ? "text-white"
                                                        : isLocked
                                                          ? "bg-gray-100 text-gray-500"
                                                          : "bg-blue-100 text-blue-700"
                                              }`}
                                              style={
                                                isCurrent
                                                  ? {
                                                      backgroundColor:
                                                        "#E7710F",
                                                    }
                                                  : {}
                                              }
                                            >
                                              {isCompleted
                                                ? "Complete"
                                                : isPendingApproval
                                                  ? "Pending Admin Approval"
                                                  : isRejected
                                                    ? "Rejected"
                                                    : isCurrent
                                                      ? "In Progress"
                                                      : isLocked
                                                        ? "Locked"
                                                        : "Upcoming"}
                                            </span>
                                          </div>
                                          {/* Status messages and action buttons */}
                                          {isCurrent && (
                                            <div className="mt-2 flex items-center justify-between">
                                              <p className="text-xs text-orange-600">
                                                Click to continue this step
                                              </p>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStepClick(
                                                    step,
                                                    reservation,
                                                  );
                                                }}
                                                className="px-4 py-1.5 text-xs font-medium rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity"
                                                style={{
                                                  backgroundColor: "#E7710F",
                                                }}
                                              >
                                                Continue
                                                <ArrowRight className="w-3 h-3" />
                                              </button>
                                            </div>
                                          )}
                                          {isPendingApproval && (
                                            <p className="text-xs text-amber-600 mt-1">
                                              Waiting for admin confirmation
                                            </p>
                                          )}
                                          {isRejected &&
                                            step.rejectionReason && (
                                              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <p className="text-xs text-red-700 font-medium mb-1">
                                                  ⚠️ Admin Rejection Reason:
                                                </p>
                                                <p className="text-sm text-red-600">
                                                  {step.rejectionReason}
                                                </p>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(
                                                      "/tenant/reservation-flow",
                                                      {
                                                        state: {
                                                          reservationId:
                                                            reservation._id,
                                                          continueFlow: true,
                                                          step: 2,
                                                        },
                                                      },
                                                    );
                                                  }}
                                                  className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                                                >
                                                  Reschedule Visit
                                                </button>
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div
                      className="bg-white rounded-xl p-8 border text-center"
                      style={{ borderColor: "#E8EBF0" }}
                    >
                      <Bed className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        No Active Reservations
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Start your journey by browsing available rooms
                      </p>
                      <Link to="/tenant/check-availability">
                        <button
                          className="px-6 py-3 rounded-lg font-medium text-white"
                          style={{ backgroundColor: "#E7710F" }}
                        >
                          Browse Available Rooms
                        </button>
                      </Link>
                    </div>
                  )}
                </div>

                {/* VISIT DETAILS & SELECTED ROOM */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div
                    className="bg-white rounded-xl p-6 border"
                    style={{ borderColor: "#E8EBF0" }}
                  >
                    <h3
                      className="font-semibold mb-4"
                      style={{ color: "#1F2937" }}
                    >
                      Visit Details
                    </h3>
                    {visits.length > 0 ? (
                      <div className="space-y-3">
                        {visits.slice(0, 2).map((visit) => (
                          <div
                            key={visit.id}
                            className="p-4 rounded-lg border"
                            style={{ borderColor: "#E8EBF0" }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm">
                                Room {visit.roomNumber}
                              </p>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  visit.status === "Completed"
                                    ? "bg-green-100 text-green-700"
                                    : visit.status === "Scheduled"
                                      ? "text-white"
                                      : "bg-gray-100 text-gray-600"
                                }`}
                                style={
                                  visit.status === "Scheduled"
                                    ? { backgroundColor: "#E7710F" }
                                    : {}
                                }
                              >
                                {visit.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                              {visit.location} · Floor {visit.floor}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(visit.date).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" },
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {visit.time}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No visits scheduled yet
                      </p>
                    )}
                  </div>

                  {/* SELECTED ROOM DETAILS */}
                  <div
                    className="bg-white rounded-xl p-6 border"
                    style={{ borderColor: "#E8EBF0" }}
                  >
                    <h3
                      className="font-semibold mb-4"
                      style={{ color: "#1F2937" }}
                    >
                      Selected Room
                    </h3>
                    {selectedRoom ? (
                      <div
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: "#FEF3E7" }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p
                              className="font-semibold text-lg mb-1"
                              style={{ color: "#0C375F" }}
                            >
                              Room {selectedRoom.roomNumber}
                            </p>
                            <p className="text-sm text-gray-600">
                              {selectedRoom.roomType}
                            </p>
                          </div>
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: "#E7710F" }}
                          >
                            <Bed className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {selectedRoom.location} · Floor {selectedRoom.floor}
                          </span>
                        </div>
                        <div
                          className="pt-3 border-t"
                          style={{ borderColor: "#E8EBF0" }}
                        >
                          <p className="text-xs text-gray-500 mb-1">
                            Monthly Rent
                          </p>
                          <p
                            className="text-2xl font-bold"
                            style={{ color: "#E7710F" }}
                          >
                            ₱{selectedRoom.price.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No room selected yet
                      </p>
                    )}
                  </div>
                </div>

                {/* RESERVATION & PAYMENT STATUS */}
                <div className="grid grid-cols-2 gap-6">
                  <div
                    className="bg-white rounded-xl p-6 border"
                    style={{ borderColor: "#E8EBF0" }}
                  >
                    <h3
                      className="font-semibold mb-4"
                      style={{ color: "#1F2937" }}
                    >
                      Reservation Status
                    </h3>
                    {activeReservation ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-medium">
                              Room {activeReservation.roomId?.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {activeReservation.roomId?.type}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              activeStatusLabel === "confirmed" ||
                              activeStatusLabel === "active"
                                ? "bg-green-100 text-green-700"
                                : activeStatusLabel === "visit-completed"
                                  ? "bg-blue-100 text-blue-700"
                                  : activeStatusLabel === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                          >
                            {activeStatusLabel}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Reservation Date
                            </span>
                            <span className="font-medium">
                              {formatDate(activeReservation.createdAt)}
                            </span>
                          </div>
                          {activeReservation.approvedDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Approval Date
                              </span>
                              <span className="font-medium">
                                {formatDate(activeReservation.approvedDate)}
                              </span>
                            </div>
                          )}
                          {activeReservation.moveInDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Move-In Date
                              </span>
                              <span className="font-medium">
                                {formatDate(activeReservation.moveInDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No active reservation
                      </p>
                    )}
                  </div>

                  <div
                    className="bg-white rounded-xl p-6 border"
                    style={{ borderColor: "#E8EBF0" }}
                  >
                    <h3
                      className="font-semibold mb-4"
                      style={{ color: "#1F2937" }}
                    >
                      Payment / Deposit Status
                    </h3>
                    {activeReservation ? (
                      <div>
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                              Status
                            </span>
                            <span
                              className="px-3 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: "#0C375F" }}
                            >
                              {activeReservation.paymentStatus || "Pending"}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {activeReservation.paymentVerified && (
                            <div
                              className="flex items-center justify-between p-3 rounded-lg"
                              style={{ backgroundColor: "#F0FDF4" }}
                            >
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium">
                                  Deposit
                                </span>
                              </div>
                              <span className="font-bold text-green-600">
                                ₱
                                {(
                                  activeReservation.totalAmount || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {!activeReservation.paymentVerified && (
                            <div
                              className="flex items-center justify-between p-3 rounded-lg border"
                              style={{ borderColor: "#E8EBF0" }}
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium">
                                  Payment Due
                                </span>
                              </div>
                              <span
                                className="font-bold"
                                style={{ color: "#E7710F" }}
                              >
                                ₱
                                {(
                                  activeReservation.totalAmount || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Complete a reservation to view payment details
                      </p>
                    )}
                  </div>
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
                    className="bg-white rounded-xl p-6 border"
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
                          className="px-5 py-2 text-sm rounded-lg text-white"
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

            {/* ROOM & PAYMENT TAB */}
            {activeTab === "room" && (
              <div className="max-w-5xl">
                <div className="mb-8">
                  <h1
                    className="text-2xl font-semibold mb-1"
                    style={{ color: "#1F2937" }}
                  >
                    Room & Payment
                  </h1>
                  <p className="text-sm text-gray-500">
                    Your selected room, reservation, and payment details
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Selected Room */}
                  {selectedRoom && (
                    <div
                      className="bg-white rounded-xl p-6 border"
                      style={{ borderColor: "#E8EBF0" }}
                    >
                      <h3
                        className="font-semibold text-lg mb-4"
                        style={{ color: "#1F2937" }}
                      >
                        Selected Room
                      </h3>
                      <div
                        className="p-5 rounded-lg"
                        style={{ backgroundColor: "#FEF3E7" }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4
                              className="text-2xl font-bold mb-1"
                              style={{ color: "#0C375F" }}
                            >
                              Room {selectedRoom.roomNumber}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {selectedRoom.roomType}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span>
                                {selectedRoom.location} · Floor{" "}
                                {selectedRoom.floor}
                              </span>
                            </div>
                          </div>
                          <div
                            className="w-14 h-14 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: "#E7710F" }}
                          >
                            <Bed className="w-7 h-7 text-white" />
                          </div>
                        </div>
                        <div
                          className="pt-4 border-t"
                          style={{ borderColor: "#E7710F30" }}
                        >
                          <p className="text-xs text-gray-500 mb-1">
                            Monthly Rent
                          </p>
                          <p
                            className="text-3xl font-bold"
                            style={{ color: "#E7710F" }}
                          >
                            ₱{selectedRoom.price.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reservation */}
                  {activeReservation && (
                    <div
                      className="bg-white rounded-xl p-6 border"
                      style={{ borderColor: "#E8EBF0" }}
                    >
                      <h3
                        className="font-semibold text-lg mb-4"
                        style={{ color: "#1F2937" }}
                      >
                        Reservation Details
                      </h3>
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Reservation Status
                          </p>
                          <span
                            className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${
                              activeStatusLabel === "confirmed" ||
                              activeStatusLabel === "active"
                                ? "bg-green-100 text-green-700"
                                : activeStatusLabel === "visit-completed"
                                  ? "bg-blue-100 text-blue-700"
                                  : activeStatusLabel === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                          >
                            {activeStatusLabel}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Move-In Date
                          </p>
                          <p
                            className="text-lg font-semibold"
                            style={{ color: "#1F2937" }}
                          >
                            {formatDate(activeReservation.moveInDate)}
                          </p>
                        </div>
                      </div>

                      <div
                        className="pt-6 border-t"
                        style={{ borderColor: "#E8EBF0" }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold">Payment Breakdown</h4>
                          <span
                            className="px-3 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: "#0C375F" }}
                          >
                            {activeReservation.paymentStatus || "Pending"}
                          </span>
                        </div>

                        <div className="space-y-3 mb-6">
                          {activeReservation.paymentVerified ? (
                            <div
                              className="flex items-center justify-between p-4 rounded-lg"
                              style={{ backgroundColor: "#F0FDF4" }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    Security Deposit
                                  </p>
                                  <p className="text-xs text-gray-500">Paid</p>
                                </div>
                              </div>
                              <p className="text-lg font-bold text-green-600">
                                ₱
                                {(
                                  activeReservation.totalAmount || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-between p-4 rounded-lg border"
                              style={{ borderColor: "#E8EBF0" }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <Clock className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    Payment Due
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Pending
                                  </p>
                                </div>
                              </div>
                              <p
                                className="text-lg font-bold"
                                style={{ color: "#E7710F" }}
                              >
                                ₱
                                {(
                                  activeReservation.totalAmount || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>

                        {!activeReservation.paymentVerified && (
                          <button
                            className="w-full py-3 text-sm font-medium rounded-lg text-white transition-colors"
                            style={{ backgroundColor: "#E7710F" }}
                          >
                            Pay Deposit - ₱
                            {(
                              activeReservation.totalAmount || 0
                            ).toLocaleString()}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!activeReservation && (
                    <div
                      className="bg-white rounded-xl p-8 border text-center"
                      style={{ borderColor: "#E8EBF0" }}
                    >
                      <Bed className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        No Active Reservation
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Start browsing rooms to make a reservation
                      </p>
                      <Link to="/tenant/check-availability">
                        <button
                          className="px-6 py-3 rounded-lg font-medium text-white"
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
                    Complete record of visit requests, approvals, reservation
                    updates, and payments
                  </p>
                </div>

                <div
                  className="bg-white rounded-xl p-6 border"
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
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
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
                <span style={{ fontSize: "28px" }}>🧾</span>
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
                Reservation Code:{" "}
                <strong>{activeReservation?.reservationCode || "N/A"}</strong>
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
                      <span style={{ color: "#6B7280" }}>Branch Location</span>
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
                      <span style={{ color: "#6B7280" }}>Room Type</span>
                      <span
                        style={{
                          color: "#1F2937",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}
                      >
                        {activeReservation?.roomId?.type || "N/A"}
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
                        {activeReservation?.roomId?.floor
                          ? `Floor ${activeReservation.roomId.floor}`
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
                            activeReservation?.roomId?.capacity ||
                            activeReservation?.roomId?.beds?.length;
                          if (!capacity) return "N/A";
                          return `${capacity} ${capacity === 1 ? "Person" : "Persons"}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Selected Bed/Slot */}
                  {activeReservation?.selectedBed && (
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
                          {activeReservation.selectedBed.id}
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
                          {activeReservation.selectedBed.position || "Standard"}
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
                      {activeReservation?.roomId?.amenities &&
                      activeReservation.roomId.amenities.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          {activeReservation.roomId.amenities.map(
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
                          activeReservation?.roomId?.price ||
                          activeReservation?.totalPrice ||
                          0
                        ).toLocaleString()}
                      </span>
                    </div>
                    {activeReservation?.roomId?.deposit && (
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
                          ₱{activeReservation.roomId.deposit.toLocaleString()}
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
                        {activeReservation?.createdAt
                          ? new Date(
                              activeReservation.createdAt,
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
                      <span style={{ color: "#1F2937", fontWeight: "600" }}>
                        {activeReservation?.viewingType === "inperson"
                          ? "🏠 In-Person Visit"
                          : "💻 Virtual Tour"}
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
                          ? "✓ Confirmed by Admin"
                          : "⏳ Awaiting Admin Confirmation"}
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
                      <span style={{ color: "#10B981", fontWeight: "600" }}>
                        ✓ Yes
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
                      <span style={{ fontSize: "28px" }}>✓</span>
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
                      <span style={{ fontSize: "24px" }}>📅</span>
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
                        <span style={{ fontSize: "24px" }}>📄</span>
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
                          ? "✓ Verified"
                          : "⏳ Pending Verification"}
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
                      <span style={{ fontSize: "24px" }}>⏰</span>
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
                    <span style={{ fontSize: "32px" }}>🎉</span>
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
