import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { authApi, userApi } from "../../../shared/api/apiClient";
import TenantLayout from "../../../shared/layouts/TenantLayout";
import "../styles/profile-page.css";

const ProfilePage = () => {
  const { user: authUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [unacknowledgedCount] = useState(1); // TODO: Get from API
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
  });

  // Editable profile fields
  const [editData, setEditData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    profileImage: "",
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
        });
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

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

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <TenantLayout>
      <div className="profile-page">
        {unacknowledgedCount > 0 && (
          <div className="profile-alert alert-warning">
            <i className="fas fa-exclamation-triangle"></i>
            <div>
              <strong>Notice:</strong> You have {unacknowledgedCount}{" "}
              unacknowledged announcement{unacknowledgedCount > 1 ? "s" : ""}.
              <button
                className="alert-link"
                onClick={() => navigate("/tenant/announcements")}
              >
                View Now
              </button>
            </div>
          </div>
        )}
        <div className="profile-page-header">
          <h1>My Profile</h1>
          <p>Manage your personal information and view your stay history</p>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab-button ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <i className="fas fa-user"></i>
            Personal Info
          </button>
          <button
            className={`tab-button ${activeTab === "stays" ? "active" : ""}`}
            onClick={() => setActiveTab("stays")}
          >
            <i className="fas fa-home"></i>
            Stay History
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
            <button onClick={() => setError(null)} className="alert-close">
              ×
            </button>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <i className="fas fa-check-circle"></i>
            {success}
            <button onClick={() => setSuccess(null)} className="alert-close">
              ×
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="profile-content">
          {/* Personal Info Tab */}
          {activeTab === "profile" && (
            <div className="profile-info-section">
              <div className="profile-card">
                <div className="profile-card-header">
                  <h2>Personal Information</h2>
                </div>
                <div className="profile-card-body">
                  <form onSubmit={handleProfileUpdate}>
                    {/* Profile Image */}
                    <div className="profile-image-section">
                      <div className="profile-image-container">
                        <img
                          src={
                            editData.profileImage ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              `${profileData.firstName} ${profileData.lastName}`,
                            )}&size=200&background=6366f1&color=fff`
                          }
                          alt="Profile"
                          className="profile-image"
                        />
                        <label
                          htmlFor="profile-image-upload"
                          className="image-upload-btn"
                        >
                          <i className="fas fa-camera"></i>
                        </label>
                        <input
                          type="file"
                          id="profile-image-upload"
                          accept="image/*"
                          onChange={handleImageUpload}
                          style={{ display: "none" }}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="firstName">
                          First Name <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={editData.firstName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="lastName">
                          Last Name <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          value={editData.lastName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        type="email"
                        id="email"
                        value={profileData.email}
                        disabled
                        className="disabled-input"
                      />
                      <small className="form-hint">
                        Email cannot be changed
                      </small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="username">Username</label>
                      <input
                        type="text"
                        id="username"
                        value={profileData.username}
                        disabled
                        className="disabled-input"
                      />
                      <small className="form-hint">
                        Username cannot be changed
                      </small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Phone Number</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={editData.phone}
                        onChange={handleInputChange}
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Branch</label>
                        <input
                          type="text"
                          value={profileData.branch || "Not assigned"}
                          disabled
                          className="disabled-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <input
                          type="text"
                          value={profileData.tenantStatus || "registered"}
                          disabled
                          className="disabled-input"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Member Since</label>
                      <input
                        type="text"
                        value={formatDate(profileData.createdAt)}
                        disabled
                        className="disabled-input"
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i> Saving...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save"></i> Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Stay History Tab */}
          {activeTab === "stays" && (
            <div className="stays-section">
              {/* Stay Statistics */}
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-icon">
                    <i className="fas fa-calendar-check"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {stayData.stats.totalStays}
                    </div>
                    <div className="stat-label">Total Bookings</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <i className="fas fa-bed"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {stayData.stats.totalNights}
                    </div>
                    <div className="stat-label">Total Nights</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {stayData.stats.completedStays}
                    </div>
                    <div className="stat-label">Completed Stays</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {formatDate(stayData.stats.memberSince)}
                    </div>
                    <div className="stat-label">Member Since</div>
                  </div>
                </div>
              </div>

              {/* Current Stays */}
              {stayData.currentStays.length > 0 && (
                <div className="stays-card">
                  <div className="stays-card-header">
                    <h2>
                      <i className="fas fa-home"></i> Current Stay
                    </h2>
                  </div>
                  <div className="stays-list">
                    {stayData.currentStays.map((stay) => (
                      <div key={stay._id} className="stay-item current-stay">
                        <div className="stay-image">
                          {stay.roomId?.images?.[0] ? (
                            <img
                              src={stay.roomId.images[0]}
                              alt={stay.roomId.name}
                            />
                          ) : (
                            <div className="stay-image-placeholder">
                              <i className="fas fa-door-open"></i>
                            </div>
                          )}
                        </div>
                        <div className="stay-details">
                          <h3>{stay.roomId?.name || "Room"}</h3>
                          <p className="stay-branch">
                            <i className="fas fa-map-marker-alt"></i>{" "}
                            {stay.roomId?.branch || "N/A"}
                          </p>
                          <p className="stay-type">
                            {stay.roomId?.type || "N/A"}
                          </p>
                          <div className="stay-dates">
                            <span>
                              <i className="fas fa-calendar-day"></i> Check-in:{" "}
                              {formatDate(stay.checkInDate)}
                            </span>
                            {stay.checkOutDate && (
                              <span>
                                <i className="fas fa-calendar-day"></i>{" "}
                                Check-out: {formatDate(stay.checkOutDate)}
                              </span>
                            )}
                          </div>
                          <span
                            className={getStatusBadge(stay.reservationStatus)}
                          >
                            {stay.reservationStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Stays */}
              <div className="stays-card">
                <div className="stays-card-header">
                  <h2>
                    <i className="fas fa-history"></i> Stay History
                  </h2>
                </div>
                {stayData.pastStays.length === 0 ? (
                  <div className="no-stays">
                    <i className="fas fa-bed"></i>
                    <p>No past stays yet</p>
                  </div>
                ) : (
                  <div className="stays-list">
                    {stayData.pastStays.map((stay) => (
                      <div key={stay._id} className="stay-item">
                        <div className="stay-image">
                          {stay.roomId?.images?.[0] ? (
                            <img
                              src={stay.roomId.images[0]}
                              alt={stay.roomId.name}
                            />
                          ) : (
                            <div className="stay-image-placeholder">
                              <i className="fas fa-door-closed"></i>
                            </div>
                          )}
                        </div>
                        <div className="stay-details">
                          <h3>{stay.roomId?.name || "Room"}</h3>
                          <p className="stay-branch">
                            <i className="fas fa-map-marker-alt"></i>{" "}
                            {stay.roomId?.branch || "N/A"}
                          </p>
                          <p className="stay-type">
                            {stay.roomId?.type || "N/A"}
                          </p>
                          <div className="stay-dates">
                            <span>
                              <i className="fas fa-calendar-day"></i> Check-in:{" "}
                              {formatDate(stay.checkInDate)}
                            </span>
                            <span>
                              <i className="fas fa-calendar-day"></i> Check-out:{" "}
                              {formatDate(stay.checkOutDate)}
                            </span>
                          </div>
                          <span
                            className={getStatusBadge(stay.reservationStatus)}
                          >
                            {stay.reservationStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TenantLayout>
  );
};

export default ProfilePage;
