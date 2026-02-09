import { useState, useEffect } from "react";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";

function VisitSchedulesTab() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState({ open: false, schedule: null });
  const [rejectModal, setRejectModal] = useState({ open: false, scheduleId: null });
  const [rejectReason, setRejectReason] = useState("");

  // Fetch reservations that have visit scheduled but not yet approved
  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await reservationApi.getAll();

      // Filter reservations that have:
      // - viewingType set (not null/none)
      // - agreedToPrivacy = true (step 2 completed)
      // - visitApproved = false (not yet approved by admin)
      // OR visitApproved = true (completed visits for reference)
      const visitSchedules = data.filter((res) => {
        const hasViewingType = res.viewingType && res.viewingType !== "none";
        const hasPoliciesAccepted = res.agreedToPrivacy === true;
        return hasViewingType && hasPoliciesAccepted;
      });

      // Transform for display
      const transformed = visitSchedules.map((res) => ({
        id: res._id,
        reservationCode: res.reservationCode || "N/A",
        customer:
          `${res.userId?.firstName || ""} ${res.userId?.lastName || ""}`.trim() ||
          "Unknown",
        email: res.userId?.email || "N/A",
        phone: res.mobileNumber || res.userId?.phone || "N/A",
        room: res.roomId?.name || res.roomId?.roomNumber || "Unknown",
        branch: res.roomId?.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe",
        viewingType: res.viewingType,
        isOutOfTown: res.isOutOfTown,
        currentLocation: res.currentLocation,
        scheduleApproved: res.scheduleApproved,
        visitApproved: res.visitApproved,
        scheduledDate: res.createdAt,
        billingEmail: res.billingEmail,
        firstName: res.firstName,
        lastName: res.lastName,
      }));

      setSchedules(transformed);
    } catch (error) {
      console.error("Error fetching visit schedules:", error);
      showNotification("Failed to load visit schedules", "error", 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSchedule = async (scheduleId) => {
    if (
      !window.confirm(
        "Approve this visit schedule? The user will be notified to attend their scheduled visit.",
      )
    ) {
      return;
    }

    try {
      setActionLoading(scheduleId);
      await reservationApi.update(scheduleId, { scheduleApproved: true });
      showNotification(
        "Visit schedule approved! User notified.",
        "success",
        3000,
      );
      fetchSchedules();
    } catch (error) {
      console.error("Error approving schedule:", error);
      showNotification("Failed to approve schedule", "error", 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkVisitComplete = async (scheduleId) => {
    if (
      !window.confirm(
        "Mark this visit as completed? This will unlock the next stage for the user.",
      )
    ) {
      return;
    }

    try {
      setActionLoading(scheduleId);
      await reservationApi.update(scheduleId, { visitApproved: true });
      showNotification(
        "Visit marked as completed! User can now proceed.",
        "success",
        3000,
      );
      fetchSchedules();
    } catch (error) {
      console.error("Error completing visit:", error);
      showNotification("Failed to complete visit", "error", 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSchedule = async (scheduleId) => {
    // Open reject modal instead of prompt
    setRejectModal({ open: true, scheduleId });
    setRejectReason("");
  };

  const confirmRejectSchedule = async () => {
    const scheduleId = rejectModal.scheduleId;
    if (!scheduleId) return;

    try {
      setActionLoading(scheduleId);
      await reservationApi.update(scheduleId, {
        scheduleRejected: true,
        scheduleRejectionReason: rejectReason || "No reason provided",
        scheduleRejectedAt: new Date().toISOString(),
        // Reset schedule-related fields
        scheduleApproved: false,
        viewingType: null,
      });
      showNotification("Visit schedule rejected. User has been notified.", "warning", 3000);
      setRejectModal({ open: false, scheduleId: null });
      setRejectReason("");
      fetchSchedules();
    } catch (error) {
      console.error("Error rejecting schedule:", error);
      showNotification("Failed to reject schedule", "error", 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoftDelete = async (scheduleId) => {
    if (
      !window.confirm(
        "Soft delete this visit record? It will be marked as archived but not permanently removed.",
      )
    ) {
      return;
    }

    try {
      setActionLoading(scheduleId);
      await reservationApi.update(scheduleId, {
        isArchived: true,
        archivedAt: new Date().toISOString(),
      });
      showNotification("Visit record archived successfully.", "success", 3000);
      fetchSchedules();
    } catch (error) {
      console.error("Error archiving schedule:", error);
      showNotification("Failed to archive record", "error", 3000);
    } finally {
      setActionLoading(null);
    }
  };

  // Separate into three categories
  const pendingScheduleApproval = schedules.filter(
    (s) => !s.scheduleApproved && !s.visitApproved,
  );
  const awaitingVisitCompletion = schedules.filter(
    (s) => s.scheduleApproved && !s.visitApproved,
  );
  const completedVisits = schedules.filter((s) => s.visitApproved);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px" }}>
        <p style={{ color: "#6B7280" }}>Loading visit schedules...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <div
          style={{
            flex: 1,
            padding: "20px",
            backgroundColor: "#FEF3C7",
            borderRadius: "12px",
            border: "1px solid #FDE68A",
          }}
        >
          <p
            style={{ fontSize: "14px", color: "#92400E", marginBottom: "4px" }}
          >
            Pending Schedule Approval
          </p>
          <p style={{ fontSize: "28px", fontWeight: "700", color: "#B45309" }}>
            {pendingScheduleApproval.length}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            padding: "20px",
            backgroundColor: "#DBEAFE",
            borderRadius: "12px",
            border: "1px solid #BFDBFE",
          }}
        >
          <p
            style={{ fontSize: "14px", color: "#1E40AF", marginBottom: "4px" }}
          >
            Awaiting Visit Completion
          </p>
          <p style={{ fontSize: "28px", fontWeight: "700", color: "#2563EB" }}>
            {awaitingVisitCompletion.length}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            padding: "20px",
            backgroundColor: "#D1FAE5",
            borderRadius: "12px",
            border: "1px solid #A7F3D0",
          }}
        >
          <p
            style={{ fontSize: "14px", color: "#047857", marginBottom: "4px" }}
          >
            Completed Visits
          </p>
          <p style={{ fontSize: "28px", fontWeight: "700", color: "#059669" }}>
            {completedVisits.length}
          </p>
        </div>
      </div>

      {/* Pending Schedule Approval Section */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          marginBottom: "24px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E5E7EB",
            backgroundColor: "#FFFBEB",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#92400E",
              margin: 0,
            }}
          >
            ⏳ Pending Schedule Approval ({pendingScheduleApproval.length})
          </h3>
          <p style={{ fontSize: "13px", color: "#B45309", margin: "4px 0 0" }}>
            Review and approve visit schedule requests
          </p>
        </div>

        {pendingScheduleApproval.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#6B7280" }}>No pending schedule approvals</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Customer
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Room
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Visit Type
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Contact
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Requested
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingScheduleApproval.map((schedule) => (
                  <tr
                    key={schedule.id}
                    style={{ borderBottom: "1px solid #E5E7EB" }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1F2937",
                            margin: 0,
                          }}
                        >
                          {schedule.customer}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "2px 0 0",
                          }}
                        >
                          {schedule.reservationCode}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1F2937",
                            margin: 0,
                          }}
                        >
                          {schedule.room}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "2px 0 0",
                          }}
                        >
                          {schedule.branch}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor:
                            schedule.viewingType === "inperson"
                              ? "#DBEAFE"
                              : "#F3E8FF",
                          color:
                            schedule.viewingType === "inperson"
                              ? "#1E40AF"
                              : "#7C3AED",
                        }}
                      >
                        {schedule.viewingType === "inperson"
                          ? "🏠 In-Person"
                          : "💻 Virtual"}
                      </span>
                      {schedule.isOutOfTown && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#6B7280",
                            margin: "4px 0 0",
                          }}
                        >
                          📍 {schedule.currentLocation || "Out of town"}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#1F2937",
                          margin: 0,
                        }}
                      >
                        {schedule.email}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6B7280",
                          margin: "2px 0 0",
                        }}
                      >
                        {schedule.phone}
                      </p>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#6B7280",
                          margin: 0,
                        }}
                      >
                        {new Date(schedule.scheduledDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => setViewDetailsModal({ open: true, schedule })}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#EFF6FF",
                            color: "#1E40AF",
                            border: "1px solid #BFDBFE",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor: "pointer",
                          }}
                        >
                          👁️ View Details
                        </button>
                        <button
                          onClick={() => handleApproveSchedule(schedule.id)}
                          disabled={actionLoading === schedule.id}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#F59E0B",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor:
                              actionLoading === schedule.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: actionLoading === schedule.id ? 0.6 : 1,
                          }}
                        >
                          ✓ Approve Schedule
                        </button>
                        <button
                          onClick={() => handleRejectSchedule(schedule.id)}
                          disabled={actionLoading === schedule.id}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "white",
                            color: "#DC2626",
                            border: "1px solid #DC2626",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor:
                              actionLoading === schedule.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: actionLoading === schedule.id ? 0.6 : 1,
                          }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Awaiting Visit Completion Section */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          marginBottom: "24px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E5E7EB",
            backgroundColor: "#EFF6FF",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#1E40AF",
              margin: 0,
            }}
          >
            📅 Awaiting Visit Completion ({awaitingVisitCompletion.length})
          </h3>
          <p style={{ fontSize: "13px", color: "#2563EB", margin: "4px 0 0" }}>
            Approved schedules - mark as complete after visit
          </p>
        </div>

        {awaitingVisitCompletion.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#6B7280" }}>No visits awaiting completion</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Customer
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Room
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Visit Type
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Contact
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Approved
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {awaitingVisitCompletion.map((schedule) => (
                  <tr
                    key={schedule.id}
                    style={{ borderBottom: "1px solid #E5E7EB" }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1F2937",
                            margin: 0,
                          }}
                        >
                          {schedule.customer}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "2px 0 0",
                          }}
                        >
                          {schedule.reservationCode}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1F2937",
                            margin: 0,
                          }}
                        >
                          {schedule.room}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "2px 0 0",
                          }}
                        >
                          {schedule.branch}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor:
                            schedule.viewingType === "inperson"
                              ? "#DBEAFE"
                              : "#F3E8FF",
                          color:
                            schedule.viewingType === "inperson"
                              ? "#1E40AF"
                              : "#7C3AED",
                        }}
                      >
                        {schedule.viewingType === "inperson"
                          ? "🏠 In-Person"
                          : "💻 Virtual"}
                      </span>
                      {schedule.isOutOfTown && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#6B7280",
                            margin: "4px 0 0",
                          }}
                        >
                          📍 {schedule.currentLocation || "Out of town"}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#1F2937",
                          margin: 0,
                        }}
                      >
                        {schedule.email}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6B7280",
                          margin: "2px 0 0",
                        }}
                      >
                        {schedule.phone}
                      </p>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#6B7280",
                          margin: 0,
                        }}
                      >
                        {new Date(schedule.scheduledDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => setViewDetailsModal({ open: true, schedule })}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#EFF6FF",
                            color: "#1E40AF",
                            border: "1px solid #BFDBFE",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor: "pointer",
                          }}
                        >
                          👁️ View Details
                        </button>
                        <button
                          onClick={() => handleMarkVisitComplete(schedule.id)}
                          disabled={actionLoading === schedule.id}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#10B981",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor:
                              actionLoading === schedule.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: actionLoading === schedule.id ? 0.6 : 1,
                          }}
                        >
                          ✓ Complete Visit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Visits Section */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E5E7EB",
            backgroundColor: "#F0FDF4",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#047857",
              margin: 0,
            }}
          >
            ✓ Completed Visits ({completedVisits.length})
          </h3>
          <p style={{ fontSize: "13px", color: "#059669", margin: "4px 0 0" }}>
            Users who have completed their room visit
          </p>
        </div>

        {completedVisits.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#6B7280" }}>No completed visits yet</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Customer
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Room
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Visit Type
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {completedVisits.slice(0, 10).map((schedule) => (
                  <tr
                    key={schedule.id}
                    style={{ borderBottom: "1px solid #E5E7EB" }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1F2937",
                            margin: 0,
                          }}
                        >
                          {schedule.customer}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "2px 0 0",
                          }}
                        >
                          {schedule.reservationCode}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1F2937",
                            margin: 0,
                          }}
                        >
                          {schedule.room}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "2px 0 0",
                          }}
                        >
                          {schedule.branch}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor:
                            schedule.viewingType === "inperson"
                              ? "#DBEAFE"
                              : "#F3E8FF",
                          color:
                            schedule.viewingType === "inperson"
                              ? "#1E40AF"
                              : "#7C3AED",
                        }}
                      >
                        {schedule.viewingType === "inperson"
                          ? "🏠 In-Person"
                          : "💻 Virtual"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor: "#D1FAE5",
                          color: "#059669",
                        }}
                      >
                        ✓ Completed
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => setViewDetailsModal({ open: true, schedule })}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#EFF6FF",
                            color: "#1E40AF",
                            border: "1px solid #BFDBFE",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor: "pointer",
                          }}
                        >
                          👁️ View Details
                        </button>
                        <button
                          onClick={() => handleSoftDelete(schedule.id)}
                          disabled={actionLoading === schedule.id}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "white",
                            color: "#6B7280",
                            border: "1px solid #D1D5DB",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor:
                              actionLoading === schedule.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: actionLoading === schedule.id ? 0.6 : 1,
                          }}
                        >
                          🗑️ Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {viewDetailsModal.open && viewDetailsModal.schedule && (
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
            padding: "20px",
          }}
          onClick={() => setViewDetailsModal({ open: false, schedule: null })}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1F2937" }}>
                  Visit Schedule Details
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
                  {viewDetailsModal.schedule.reservationCode}
                </p>
              </div>
              <button
                onClick={() => setViewDetailsModal({ open: false, schedule: null })}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6B7280",
                  padding: "4px",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "24px" }}>
              {/* Customer Info */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Customer Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Name</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.customer}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Email</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.email}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Phone</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.phone}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Billing Email</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.billingEmail || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Room Info */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Room Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Room</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.room}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Branch</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.branch}
                    </p>
                  </div>
                </div>
              </div>

              {/* Visit Info */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Visit Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Visit Type</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {viewDetailsModal.schedule.viewingType === "inperson" ? "🏠 In-Person" : "💻 Virtual"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Requested Date</p>
                    <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                      {new Date(viewDetailsModal.schedule.scheduledDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {viewDetailsModal.schedule.isOutOfTown && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>Current Location (Out of Town)</p>
                      <p style={{ fontSize: "14px", color: "#1F2937", fontWeight: "500", margin: 0 }}>
                        📍 {viewDetailsModal.schedule.currentLocation || "Not specified"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Status
                </h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "500",
                      backgroundColor: viewDetailsModal.schedule.scheduleApproved ? "#D1FAE5" : "#FEF3C7",
                      color: viewDetailsModal.schedule.scheduleApproved ? "#059669" : "#92400E",
                    }}
                  >
                    {viewDetailsModal.schedule.scheduleApproved ? "✓ Schedule Approved" : "⏳ Pending Approval"}
                  </span>
                  {viewDetailsModal.schedule.visitApproved && (
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "500",
                        backgroundColor: "#D1FAE5",
                        color: "#059669",
                      }}
                    >
                      ✓ Visit Completed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setViewDetailsModal({ open: false, schedule: null })}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#F3F4F6",
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

      {/* Reject Modal */}
      {rejectModal.open && (
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
            padding: "20px",
          }}
          onClick={() => setRejectModal({ open: false, scheduleId: null })}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#DC2626" }}>
                ⚠️ Reject Visit Schedule
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#6B7280" }}>
                The user will be notified about this rejection and can reschedule.
              </p>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "24px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#374151", marginBottom: "8px" }}>
                Rejection Reason
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection (this will be shown to the user)..."
                style={{
                  width: "100%",
                  minHeight: "120px",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                onClick={() => {
                  setRejectModal({ open: false, scheduleId: null });
                  setRejectReason("");
                }}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectSchedule}
                disabled={actionLoading}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#DC2626",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisitSchedulesTab;
