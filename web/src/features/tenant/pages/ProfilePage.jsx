import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { authApi, userApi, reservationApi } from "../../../shared/api/apiClient";
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
  MapPin
} from 'lucide-react';

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
    yearLevel: ""
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
    yearLevel: ""
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
          yearLevel: profile.yearLevel || ""
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
      const allVisits = reservationsData
        ?.filter(r => r.visitDate)
        .map(r => ({
          id: r._id,
          roomNumber: r.roomId?.name || "N/A",
          location: r.roomId?.branch || "N/A",
          floor: r.roomId?.floor || 1,
          date: r.visitDate,
          time: r.visitTime || "TBD",
          status: r.visitCompleted ? 'Completed' : 
                  new Date(r.visitDate) < new Date() ? 'Missed' : 'Scheduled',
          specialInstructions: "Please bring valid ID. Meet at the reception area."
        })) || [];
      setVisits(allVisits);

      // Build activity log from reservations
      const activities = [];
      reservationsData?.forEach(r => {
        if (r.createdAt) {
          activities.push({
            id: `res-${r._id}`,
            type: 'reservation',
            title: 'Room Reservation Submitted',
            description: `Submitted reservation request for Room ${r.roomId?.name || 'N/A'}`,
            date: r.createdAt,
            status: 'Pending'
          });
        }
        if (r.visitDate) {
          activities.push({
            id: `visit-${r._id}`,
            type: 'visit',
            title: r.visitCompleted ? 'Visit Completed' : 'Visit Scheduled',
            description: `${r.visitCompleted ? 'Completed' : 'Scheduled'} visit to Room ${r.roomId?.name || 'N/A'}`,
            date: r.visitDate,
            status: r.visitCompleted ? 'Completed' : 'Scheduled'
          });
        }
        if (r.paymentDate) {
          activities.push({
            id: `payment-${r._id}`,
            type: 'payment',
            title: 'Deposit Payment Completed',
            description: `Successfully paid security deposit for Room ${r.roomId?.name || 'N/A'}`,
            date: r.paymentDate,
            status: 'Completed'
          });
        }
        if (r.approvedDate) {
          activities.push({
            id: `approval-${r._id}`,
            type: 'approval',
            title: 'Reservation Approved',
            description: `Your reservation for Room ${r.roomId?.name || 'N/A'} has been approved by admin`,
            date: r.approvedDate,
            status: 'Approved'
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
      yearLevel: profileData.yearLevel || ""
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
        currentStep: 'not_started',
        steps: [],
        currentStepIndex: -1
      };
    }

    const status =
      activeReservation.reservationStatus || activeReservation.status || "pending";
    const stepOrder = [
      "policies_read",
      "room_selected",
      "visit_scheduled",
      "visit_completed",
      "application_submitted",
      "payment_submitted",
      "confirmed",
    ];

    const hasRoom = Boolean(activeReservation.roomId);
    const hasVisitRequest = Boolean(activeReservation.viewingType);
    const isVisitApproved = Boolean(activeReservation.visitApproved);
    const hasApplication = Boolean(
      activeReservation.agreedToPrivacy && activeReservation.agreedToCertification,
    );
    const hasPayment = Boolean(activeReservation.proofOfPaymentUrl);
    const isConfirmed =
      status === "confirmed" || activeReservation.paymentStatus === "paid";

    let currentStepIndex = 0;
    if (hasRoom) currentStepIndex = 1;
    if (hasVisitRequest) currentStepIndex = 2;
    if (isVisitApproved) currentStepIndex = 3;
    if (hasApplication) currentStepIndex = 4;
    if (hasPayment) currentStepIndex = 5;
    if (isConfirmed) currentStepIndex = 6;

    const steps = [
      {
        step: 'policies_read',
        title: '1. Read Policies',
        description: 'Review and acknowledge dormitory policies',
        status: currentStepIndex >= 0 ? 'completed' : 'current',
        completedDate: activeReservation.createdAt
      },
      {
        step: 'room_selected',
        title: '2. Room Selected',
        description: 'Room reserved with soft hold',
        status: currentStepIndex >= 1 ? 'completed' : currentStepIndex === 0 ? 'current' : 'upcoming',
        completedDate: currentStepIndex >= 1 ? activeReservation.createdAt : undefined
      },
      {
        step: 'visit_scheduled',
        title: '3. Visit Scheduled',
        description: 'Scheduled room inspection visit',
        status: currentStepIndex >= 2 ? 'completed' : currentStepIndex === 1 ? 'current' : 'locked',
        completedDate: currentStepIndex >= 2 ? activeReservation.visitDate : undefined
      },
      {
        step: 'visit_completed',
        title: '4. Visit Completed',
        description: 'Room visit completed successfully',
        status: currentStepIndex >= 3 ? 'completed' : currentStepIndex === 2 ? 'current' : 'locked',
        completedDate: currentStepIndex >= 3 ? activeReservation.visitDate : undefined
      },
      {
        step: 'application_submitted',
        title: '5. Application Submitted',
        description: 'Personal details and documents uploaded',
        status:  currentStepIndex >= 4 ? 'completed' : currentStepIndex === 3 ? 'current' : 'locked',
        completedDate: currentStepIndex >= 4 ? activeReservation.updatedAt : undefined
      },
      {
        step: 'payment_submitted',
        title: '6. Payment Submitted',
        description: 'Payment proof uploaded and pending verification',
        status: currentStepIndex >= 5 ? 'completed' : currentStepIndex === 4 ? 'current' : 'locked',
        completedDate: currentStepIndex >= 5 ? activeReservation.paymentDate : undefined
      },
      {
        step: 'confirmed',
        title: '7. Reservation Confirmed',
        description: 'Reservation fully confirmed and finalized',
        status: currentStepIndex >= 6 ? 'completed' : currentStepIndex === 5 ? 'current' : 'locked',
        completedDate: currentStepIndex >= 6 ? activeReservation.approvedDate : undefined
      }
    ];

    return {
      currentStep: stepOrder[currentStepIndex],
      steps,
      currentStepIndex
    };
  };

  const reservationProgress = getReservationProgress();

  const defaultSteps = [
    {
      step: "policies_read",
      title: "1. Read Policies",
      description: "Review and acknowledge dormitory policies",
      status: "current",
    },
    {
      step: "room_selected",
      title: "2. Room Selected",
      description: "Select a room to reserve",
      status: "locked",
    },
    {
      step: "visit_scheduled",
      title: "3. Visit Scheduled",
      description: "Schedule room inspection visit",
      status: "locked",
    },
    {
      step: "visit_completed",
      title: "4. Visit Completed",
      description: "Visit completed and verified",
      status: "locked",
    },
    {
      step: "application_submitted",
      title: "5. Application Submitted",
      description: "Personal details and documents uploaded",
      status: "locked",
    },
    {
      step: "payment_submitted",
      title: "6. Payment Submitted",
      description: "Payment proof uploaded",
      status: "locked",
    },
    {
      step: "confirmed",
      title: "7. Reservation Confirmed",
      description: "Reservation finalized",
      status: "locked",
    },
  ];

  const stepsToRender = activeReservation
    ? reservationProgress.steps
    : defaultSteps;

  const stepToStageMap = {
    policies_read: 1,
    room_selected: 1,
    visit_scheduled: 2,
    visit_completed: 2,
    application_submitted: 3,
    payment_submitted: 4,
    confirmed: 5,
  };

  const handleStepClick = (step) => {
    if (!activeReservation) {
      if (step.step === "policies_read") {
        navigate("/tenant/check-availability");
        return;
      }
      showNotification("Complete previous step first.", "warning", 2500);
      return;
    }
    if (step.status === "locked") {
      showNotification("Complete previous step first.", "warning", 2500);
      return;
    }

    const targetStage = stepToStageMap[step.step];
    if (!targetStage) return;

    navigate("/tenant/reservation-flow", {
      state: {
        reservationId: activeReservation._id,
        continueFlow: true,
        step: targetStage,
      },
    });
  };

  // Get next action based on current step
  const getNextAction = () => {
    if (!activeReservation) {
      return {
        title: 'Start Your Reservation',
        description: 'Browse available rooms and start the reservation process',
        buttonText: 'Browse Rooms',
        buttonLink: '/tenant/check-availability'
      };
    }

    const currentStep = reservationProgress.currentStep;

    switch (currentStep) {
      case 'room_selected':
        return {
          title: 'Schedule Your Visit',
          description: 'Schedule a visit to inspect the room in person. This is required before submitting your application.',
          buttonText: 'Schedule Visit',
          buttonLink: '/tenant/reservation-flow',
          reservationId: activeReservation._id,
          step: 2
        };
      case 'visit_scheduled':
        return {
          title: 'Attend Your Scheduled Visit',
          description: `Your visit is on ${activeReservation.visitDate ? new Date(activeReservation.visitDate).toLocaleDateString() : 'TBD'}. Please bring a valid ID and arrive 5 minutes early.`,
          buttonText: 'View Visit Details',
          buttonLink: '/tenant/reservation-flow',
          buttonVariant: 'outline',
          reservationId: activeReservation._id,
          step: 2
        };
      case 'visit_completed':
        return {
          title: 'Submit Your Application',
          description: 'Complete your personal details, upload required documents, and select your move-in date.',
          buttonText: 'Fill Application Form',
          buttonLink: '/tenant/reservation-flow',
          reservationId: activeReservation._id,
          step: 3
        };
      case 'application_submitted':
        return {
          title: 'Submit Payment',
          description: 'Upload proof of deposit payment to confirm your reservation. Payment must be submitted within 48 hours.',
          buttonText: 'Upload Payment Proof',
          buttonLink: '/tenant/reservation-flow',
          reservationId: activeReservation._id,
          step: 4
        };
      case 'payment_submitted':
        return {
          title: 'Awaiting Confirmation',
          description: 'Your payment is being verified. You will receive a confirmation email within 24 hours.',
          buttonText: 'Contact Support',
          buttonLink: '#contact',
          buttonVariant: 'outline'
        };
      case 'confirmed':
        return {
          title: 'Reservation Confirmed!',
          description: 'Your reservation is confirmed. Prepare for move-in and check your email for the contract details.',
          buttonText: 'View Details',
          buttonLink: '#contract'
        };
      default:
        return {
          title: 'Get Started',
          description: 'Browse available rooms to begin your reservation',
          buttonText: 'Browse Rooms',
          buttonLink: '/tenant/check-availability'
        };
    }
  };

  const nextAction = getNextAction();
  const activeStatusLabel =
    activeReservation?.reservationStatus || activeReservation?.status || "pending";

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '1rem' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid #e5e7eb', borderTopColor: '#E7710F', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || 'User';
  const selectedRoom = activeReservation?.roomId ? {
    roomNumber: activeReservation.roomId.name,
    location: activeReservation.roomId.branch,
    floor: activeReservation.roomId.floor,
    roomType: activeReservation.roomId.type,
    price: activeReservation.roomId.price
  } : null;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F7F8FA' }}>
      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-white border-r flex flex-col" style={{ borderColor: '#E8EBF0' }}>
        <div className="p-6 border-b" style={{ borderColor: '#E8EBF0' }}>
          <Link to="/tenant/check-availability" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0C375F' }}>
              <Bed className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg" style={{ color: '#0C375F' }}>Lilycrest</span>
          </Link>
        </div>

        <div className="p-4 border-b" style={{ borderColor: '#E8EBF0' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0C375F' }}>
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#1F2937' }}>{fullName}</p>
              <p className="text-xs text-gray-500 truncate">{profileData.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Menu</p>
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'dashboard' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={activeTab === 'dashboard' ? { backgroundColor: '#E7710F' } : {}}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </button>
              {/* <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Home className="w-5 h-5" />
                <span>Home</span>
              </Link> */}
              <Link to="/tenant/check-availability" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Bed className="w-5 h-5" />
                <span>Browse Rooms</span>
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Account</p>
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab('personal')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'personal' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={activeTab === 'personal' ? { backgroundColor: '#E7710F' } : {}}
              >
                <User className="w-5 h-5" />
                <span>Personal Details</span>
              </button>
              <button 
                onClick={() => setActiveTab('room')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'room' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={activeTab === 'room' ? { backgroundColor: '#E7710F' } : {}}
              >
                <CreditCard className="w-5 h-5" />
                <span>Room & Payment</span>
                {activeReservation && (
                  <span className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }}></span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'history' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={activeTab === 'history' ? { backgroundColor: '#E7710F' } : {}}
              >
                <History className="w-5 h-5" />
                <span>Activity Log</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: '#E8EBF0' }}>
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
        <header className="bg-white border-b h-16 flex items-center justify-between px-8" style={{ borderColor: '#E8EBF0' }}>
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
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#EF4444' }}></span>
              )}
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#0C375F' }}>
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-8">
            
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="max-w-6xl">
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1F2937' }}>Dashboard</h1>
                  <p className="text-sm text-gray-500">Track your application progress and next steps</p>
                </div>

                {/* NEXT ACTION PROMPT */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 mb-6 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="font-semibold text-lg">Next Action Required</h3>
                      </div>
                      <h2 className="text-2xl font-bold mb-2">{nextAction.title}</h2>
                      <p className="text-white/90 mb-4">{nextAction.description}</p>
                      <Link
                        to={nextAction.buttonLink}
                        state={{
                          reservationId: nextAction.reservationId,
                          continueFlow: true,
                          step: nextAction.step,
                        }}
                      >
                        <button className={`px-6 py-3 bg-white rounded-lg font-medium flex items-center gap-2 ${nextAction.buttonVariant === 'outline' ? 'border border-gray-300' : ''}`} style={{ color: '#E7710F' }}>
                          {nextAction.buttonText}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* NEW RESERVATION PROGRESS TRACKER - 7 STEPS */}
                <div className="bg-white rounded-xl p-8 border mb-6" style={{ borderColor: '#E8EBF0' }}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-semibold text-lg mb-1" style={{ color: '#1F2937' }}>Reservation Progress Tracker</h3>
                      <p className="text-sm text-gray-500">Follow these steps from room selection to confirmation</p>
                    </div>
                    {activeReservation ? (
                      <div className="px-4 py-2 rounded-lg text-sm font-medium" style={{ 
                        backgroundColor: reservationProgress.currentStepIndex === 6 ? '#DEF7EC' : 
                                        reservationProgress.currentStepIndex === 5 ? '#FEF3C7' : 
                                        '#DBEAFE',
                        color: reservationProgress.currentStepIndex === 6 ? '#03543F' : 
                               reservationProgress.currentStepIndex === 5 ? '#92400E' : 
                               '#1E40AF'
                      }}>
                        Step {reservationProgress.currentStepIndex + 1} of 7
                      </div>
                    ) : (
                      <div className="px-4 py-2 rounded-lg text-sm font-medium" style={{ 
                        backgroundColor: '#F3F4F6',
                        color: '#6B7280'
                      }}>
                        Not started
                      </div>
                    )}
                  </div>
                  
                  {/* New 7-Step Progress Tracker - Vertical List */}
                  <div className="space-y-4">
                      {stepsToRender.map((step, index) => {
                        const icons = {
                          'policies_read': FileText,
                          'room_selected': Home,
                          'visit_scheduled': Calendar,
                          'visit_completed': Check,
                          'application_submitted': User,
                          'payment_submitted': DollarSign,
                          'confirmed': CheckCircle
                        };
                        const StepIcon = icons[step.step];
                        const isCompleted = step.status === 'completed';
                        const isCurrent = step.status === 'current';
                        const isLocked = step.status === 'locked';
                        const isClickable = !isLocked && (activeReservation || step.step === 'policies_read');
                        
                        return (
                          <div key={index} className="relative">
                            {index !== reservationProgress.steps.length - 1 && (
                              <div 
                                className="absolute left-6 top-14 bottom-0 w-0.5"
                                style={{ 
                                  backgroundColor: isCompleted ? '#10B981' : '#E5E7EB'
                                }}
                              ></div>
                            )}
                            <div
                              className={`flex items-start gap-4 ${
                                isClickable ? 'cursor-pointer' : ''
                              }`}
                              onClick={isClickable ? () => handleStepClick(step) : undefined}
                            >
                              <div 
                                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 transition-all ${
                                  isLocked ? 'bg-gray-200' : ''
                                }`}
                                style={
                                  isCompleted ? { backgroundColor: '#10B981' } :
                                  isCurrent ? { backgroundColor: '#E7710F' } : {}
                                }
                              >
                                {isLocked ? (
                                  <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
                                ) : (
                                  <StepIcon className={`w-6 h-6 ${isCompleted || isCurrent ? 'text-white' : 'text-gray-400'}`} />
                                )}
                              </div>
                              <div className={`flex-1 pb-6 ${isLocked ? 'opacity-50' : ''}`}>
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className={`font-semibold mb-1 ${isCurrent ? 'text-orange-600' : ''}`} style={!isCurrent ? { color: '#1F2937' } : {}}>
                                      {step.title}
                                    </h4>
                                    <p className="text-sm text-gray-600">{step.description}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                                    isCompleted ? 'bg-green-100 text-green-700' :
                                    isCurrent ? 'text-white' :
                                    isLocked ? 'bg-gray-100 text-gray-500' :
                                    'bg-blue-100 text-blue-700'
                                  }`}
                                  style={isCurrent ? { backgroundColor: '#E7710F' } : {}}
                                  >
                                    {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : isLocked ? 'Locked' : 'Upcoming'}
                                  </span>
                                </div>
                                  {step.completedDate && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Completed on {new Date(step.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                )}
                                {isCurrent && step.step === 'visit_scheduled' && visits[0] && (
                                  <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                                    <p className="text-sm text-orange-800 font-medium mb-1">Upcoming Visit</p>
                                    <p className="text-xs text-orange-700">
                                      {new Date(visits[0].date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {visits[0].time}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>

                    {!activeReservation && (
                      <div className="text-center py-12">
                        <Bed className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Reservation</h3>
                        <p className="text-sm text-gray-500 mb-6">Start your journey by browsing available rooms</p>
                        <Link to="/tenant/check-availability">
                          <button className="px-6 py-3 rounded-lg font-medium text-white" style={{ backgroundColor: '#E7710F' }}>
                            Browse Available Rooms
                          </button>
                        </Link>
                      </div>
                    )}
                </div>

                {/* VISIT DETAILS & SELECTED ROOM */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                    <h3 className="font-semibold mb-4" style={{ color: '#1F2937' }}>Visit Details</h3>
                    {visits.length > 0 ? (
                      <div className="space-y-3">
                        {visits.slice(0, 2).map((visit) => (
                          <div key={visit.id} className="p-4 rounded-lg border" style={{ borderColor: '#E8EBF0' }}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm">Room {visit.roomNumber}</p>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                visit.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                                visit.status === 'Scheduled' ? 'text-white' : 'bg-gray-100 text-gray-600'
                              }`}
                              style={visit.status === 'Scheduled' ? { backgroundColor: '#E7710F' } : {}}
                              >
                                {visit.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{visit.location} · Floor {visit.floor}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(visit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                      <p className="text-sm text-gray-500">No visits scheduled yet</p>
                    )}
                  </div>

                  {/* SELECTED ROOM DETAILS */}
                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                    <h3 className="font-semibold mb-4" style={{ color: '#1F2937' }}>Selected Room</h3>
                    {selectedRoom ? (
                      <div className="p-4 rounded-lg" style={{ backgroundColor: '#FEF3E7' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-lg mb-1" style={{ color: '#0C375F' }}>Room {selectedRoom.roomNumber}</p>
                            <p className="text-sm text-gray-600">{selectedRoom.roomType}</p>
                          </div>
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E7710F' }}>
                            <Bed className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <MapPin className="w-4 h-4" />
                          <span>{selectedRoom.location} · Floor {selectedRoom.floor}</span>
                        </div>
                        <div className="pt-3 border-t" style={{ borderColor: '#E8EBF0' }}>
                          <p className="text-xs text-gray-500 mb-1">Monthly Rent</p>
                          <p className="text-2xl font-bold" style={{ color: '#E7710F' }}>₱{selectedRoom.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No room selected yet</p>
                    )}
                  </div>
                </div>

                {/* RESERVATION & PAYMENT STATUS */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                    <h3 className="font-semibold mb-4" style={{ color: '#1F2937' }}>Reservation Status</h3>
                    {activeReservation ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-medium">Room {activeReservation.roomId?.name}</p>
                            <p className="text-sm text-gray-500">{activeReservation.roomId?.type}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            activeStatusLabel === 'confirmed' || activeStatusLabel === 'active' ? 'bg-green-100 text-green-700' :
                            activeStatusLabel === 'visit-completed' ? 'bg-blue-100 text-blue-700' :
                            activeStatusLabel === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {activeStatusLabel}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Reservation Date</span>
                            <span className="font-medium">{formatDate(activeReservation.createdAt)}</span>
                          </div>
                          {activeReservation.approvedDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Approval Date</span>
                              <span className="font-medium">{formatDate(activeReservation.approvedDate)}</span>
                            </div>
                          )}
                          {activeReservation.moveInDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Move-In Date</span>
                              <span className="font-medium">{formatDate(activeReservation.moveInDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No active reservation</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                    <h3 className="font-semibold mb-4" style={{ color: '#1F2937' }}>Payment / Deposit Status</h3>
                    {activeReservation ? (
                      <div>
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Status</span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#0C375F' }}>
                              {activeReservation.paymentStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {activeReservation.paymentVerified && (
                            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#F0FDF4' }}>
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium">Deposit</span>
                              </div>
                              <span className="font-bold text-green-600">₱{(activeReservation.totalAmount || 0).toLocaleString()}</span>
                            </div>
                          )}
                          {!activeReservation.paymentVerified && (
                            <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#E8EBF0' }}>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium">Payment Due</span>
                              </div>
                              <span className="font-bold" style={{ color: '#E7710F' }}>₱{(activeReservation.totalAmount || 0).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Complete a reservation to view payment details</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PERSONAL DETAILS TAB */}
            {activeTab === 'personal' && (
              <div className="max-w-5xl">
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1F2937' }}>Personal Details</h1>
                  <p className="text-sm text-gray-500">Basic information for inquiries, visits, and reservations</p>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0C375F' }}>
                        <User className="w-10 h-10 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-1" style={{ color: '#1F2937' }}>{fullName}</h2>
                        <p className="text-sm text-gray-500">{profileData.email}</p>
                        <p className="text-sm text-gray-400">{profileData.city || 'Not provided'}</p>
                      </div>
                      {!isEditingProfile && (
                        <button 
                          onClick={() => setIsEditingProfile(true)}
                          className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors flex items-center gap-2"
                          style={{ borderColor: '#E8EBF0', color: '#E7710F' }}
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
                          style={{ backgroundColor: '#E7710F' }}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="px-5 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
                          style={{ borderColor: '#E8EBF0' }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { label: 'Full Name', field: 'firstName', display: fullName },
                        { label: 'Email Address', field: 'email' },
                        { label: 'Phone Number', field: 'phone' },
                        { label: 'Date of Birth', field: 'dateOfBirth', type: 'date' },
                        { label: 'Address', field: 'address' },
                        { label: 'City', field: 'city' },
                        { label: 'Student ID', field: 'studentId' },
                        { label: 'School', field: 'school' },
                        { label: 'Year Level', field: 'yearLevel' },
                        { label: 'Emergency Contact', field: 'emergencyContact' },
                        { label: 'Emergency Phone', field: 'emergencyPhone' }
                      ].map((item) => (
                        <div key={item.field}>
                          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">{item.label}</label>
                          {isEditingProfile && item.field !== 'email' ? (
                            item.field === 'firstName' ? (
                              <>
                                <input
                                  type="text"
                                  value={editData.firstName || ''}
                                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                                  className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 mb-2"
                                  placeholder="First Name"
                                  style={{ borderColor: '#E8EBF0' }}
                                />
                                <input
                                  type="text"
                                  value={editData.lastName || ''}
                                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                                  className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                                  placeholder="Last Name"
                                  style={{ borderColor: '#E8EBF0' }}
                                />
                              </>
                            ) : (
                              <input
                                type={item.type || 'text'}
                                value={editData[item.field] || ''}
                                onChange={(e) => setEditData({ ...editData, [item.field]: e.target.value })}
                                className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                                style={{ borderColor: '#E8EBF0' }}
                              />
                            )
                          ) : (
                            <p className="text-sm py-2.5" style={{ color: '#1F2937' }}>
                              {item.field === 'firstName' ? item.display :
                               item.type === 'date' && profileData[item.field] 
                                ? formatDate(profileData[item.field])
                                : profileData[item.field] || 'Not provided'}
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
            {activeTab === 'room' && (
              <div className="max-w-5xl">
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1F2937' }}>Room & Payment</h1>
                  <p className="text-sm text-gray-500">Your selected room, reservation, and payment details</p>
                </div>

                <div className="space-y-6">
                  {/* Selected Room */}
                  {selectedRoom && (
                    <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                      <h3 className="font-semibold text-lg mb-4" style={{ color: '#1F2937' }}>Selected Room</h3>
                      <div className="p-5 rounded-lg" style={{ backgroundColor: '#FEF3E7' }}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-2xl font-bold mb-1" style={{ color: '#0C375F' }}>Room {selectedRoom.roomNumber}</h4>
                            <p className="text-sm text-gray-600 mb-2">{selectedRoom.roomType}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span>{selectedRoom.location} · Floor {selectedRoom.floor}</span>
                            </div>
                          </div>
                          <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E7710F' }}>
                            <Bed className="w-7 h-7 text-white" />
                          </div>
                        </div>
                        <div className="pt-4 border-t" style={{ borderColor: '#E7710F30' }}>
                          <p className="text-xs text-gray-500 mb-1">Monthly Rent</p>
                          <p className="text-3xl font-bold" style={{ color: '#E7710F' }}>₱{selectedRoom.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reservation */}
                  {activeReservation && (
                    <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                      <h3 className="font-semibold text-lg mb-4" style={{ color: '#1F2937' }}>Reservation Details</h3>
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">Reservation Status</p>
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${
                            activeStatusLabel === 'confirmed' || activeStatusLabel === 'active' ? 'bg-green-100 text-green-700' :
                            activeStatusLabel === 'visit-completed' ? 'bg-blue-100 text-blue-700' :
                            activeStatusLabel === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {activeStatusLabel}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">Move-In Date</p>
                          <p className="text-lg font-semibold" style={{ color: '#1F2937' }}>
                            {formatDate(activeReservation.moveInDate)}
                          </p>
                        </div>
                      </div>

                      <div className="pt-6 border-t" style={{ borderColor: '#E8EBF0' }}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold">Payment Breakdown</h4>
                          <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#0C375F' }}>
                            {activeReservation.paymentStatus || 'Pending'}
                          </span>
                        </div>

                        <div className="space-y-3 mb-6">
                          {activeReservation.paymentVerified ? (
                            <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4' }}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Security Deposit</p>
                                  <p className="text-xs text-gray-500">Paid</p>
                                </div>
                              </div>
                              <p className="text-lg font-bold text-green-600">₱{(activeReservation.totalAmount || 0).toLocaleString()}</p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: '#E8EBF0' }}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <Clock className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Payment Due</p>
                                  <p className="text-xs text-gray-500">Pending</p>
                                </div>
                              </div>
                              <p className="text-lg font-bold" style={{ color: '#E7710F' }}>₱{(activeReservation.totalAmount || 0).toLocaleString()}</p>
                            </div>
                          )}
                        </div>

                        {!activeReservation.paymentVerified && (
                          <button className="w-full py-3 text-sm font-medium rounded-lg text-white transition-colors" style={{ backgroundColor: '#E7710F' }}>
                            Pay Deposit - ₱{(activeReservation.totalAmount || 0).toLocaleString()}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!activeReservation && (
                    <div className="bg-white rounded-xl p-8 border text-center" style={{ borderColor: '#E8EBF0' }}>
                      <Bed className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Reservation</h3>
                      <p className="text-sm text-gray-500 mb-6">Start browsing rooms to make a reservation</p>
                      <Link to="/tenant/check-availability">
                        <button className="px-6 py-3 rounded-lg font-medium text-white" style={{ backgroundColor: '#E7710F' }}>
                          Browse Available Rooms
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVITY LOG TAB */}
            {activeTab === 'history' && (
              <div className="max-w-5xl">
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1F2937' }}>Activity History</h1>
                  <p className="text-sm text-gray-500">Complete record of visit requests, approvals, reservation updates, and payments</p>
                </div>

                <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E8EBF0' }}>
                  {activityLog.length > 0 ? (
                    <div className="space-y-4">
                      {activityLog.map((activity, index) => (
                        <div key={activity.id} className="relative">
                          {index !== activityLog.length - 1 && (
                            <div className="absolute left-5 top-12 bottom-0 w-px bg-gray-200"></div>
                          )}
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative z-10" style={{ 
                              backgroundColor: activity.type === 'payment' ? '#DEF7EC' :
                                             activity.type === 'reservation' || activity.type === 'approval' ? '#EEF2FF' :
                                             activity.type === 'visit' ? '#DBEAFE' :
                                             '#F3F4F6'
                            }}>
                              {activity.type === 'payment' ? (
                                <DollarSign className="w-5 h-5 text-green-600" />
                              ) : activity.type === 'reservation' || activity.type === 'approval' ? (
                                <FileText className="w-5 h-5" style={{ color: '#0C375F' }} />
                              ) : activity.type === 'visit' ? (
                                <Calendar className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Edit2 className="w-5 h-5 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 pb-8">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold mb-1" style={{ color: '#1F2937' }}>{activity.title}</h4>
                                  <p className="text-sm text-gray-600">{activity.description}</p>
                                </div>
                                {activity.status && (
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                                    activity.status === 'Completed' || activity.status === 'Confirmed' || activity.status === 'Approved' || activity.status === 'Complete' ? 'bg-green-100 text-green-700' :
                                    activity.status === 'Scheduled' || activity.status === 'Pending' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {activity.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">
                                {new Date(activity.date).toLocaleDateString('en-US', { 
                                  month: 'long', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Activity Yet</h3>
                      <p className="text-sm text-gray-500">Your reservation activities will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
