import { useState, useEffect } from "react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import Sidebar from "../components/Sidebar";
import ReservationDetailsModal from "../components/ReservationDetailsModal";
import "../styles/admin-reservations.css";

function ReservationsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch reservations from API
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await reservationApi.getAll();
        console.log("📊 Fetched reservations:", data);

        // Transform API data to UI format
        const transformedReservations = data.map((res) => ({
          id: res._id,
          date: new Date(res.createdAt).toISOString().split("T")[0],
          customer:
            res.userId?.firstName + " " + res.userId?.lastName || "Unknown",
          email: res.userId?.email || "N/A",
          room: res.roomId?.name || "Unknown Room",
          branch:
            res.roomId?.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe",
          moveInDate: new Date(res.checkInDate).toISOString().split("T")[0],
          status: res.status.charAt(0).toUpperCase() + res.status.slice(1),
          totalPrice: res.totalPrice,
          paymentStatus: res.paymentStatus,
          notes: res.notes || "No notes",
          roomType: res.roomId?.type || "Unknown",
          roomId: res.roomId?._id,
          userId: res.userId?._id,
          checkOutDate: res.checkOutDate
            ? new Date(res.checkOutDate).toISOString().split("T")[0]
            : null,
        }));

        setReservations(transformedReservations);
      } catch (err) {
        console.error("❌ Error fetching reservations:", err);
        setError(err.message);
        showNotification("Failed to load reservations", "error", 3000);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchReservations();
    }
  }, [user]);

  // Function to refresh data after updates
  const handleRefreshData = async () => {
    try {
      const data = await reservationApi.getAll();
      const transformedReservations = data.map((res) => ({
        id: res._id,
        date: new Date(res.createdAt).toISOString().split("T")[0],
        customer:
          res.userId?.firstName + " " + res.userId?.lastName || "Unknown",
        email: res.userId?.email || "N/A",
        room: res.roomId?.name || "Unknown Room",
        branch: res.roomId?.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe",
        moveInDate: new Date(res.checkInDate).toISOString().split("T")[0],
        status: res.status.charAt(0).toUpperCase() + res.status.slice(1),
        totalPrice: res.totalPrice,
        paymentStatus: res.paymentStatus,
        notes: res.notes || "No notes",
        roomType: res.roomId?.type || "Unknown",
        roomId: res.roomId?._id,
        userId: res.userId?._id,
        checkOutDate: res.checkOutDate
          ? new Date(res.checkOutDate).toISOString().split("T")[0]
          : null,
      }));
      setReservations(transformedReservations);
    } catch (err) {
      console.error("❌ Error refreshing reservations:", err);
    }
  };

  // Calculate stats from real data
  const stats = [
    {
      label: "Pending",
      value: reservations.filter((r) => r.status.toLowerCase() === "pending")
        .length,
      color: "yellow",
    },
    {
      label: "Confirmed",
      value: reservations.filter((r) => r.status.toLowerCase() === "confirmed")
        .length,
      color: "blue",
    },
    {
      label: "Ready For Move In",
      value: reservations.filter((r) => r.status.toLowerCase() === "ready-for-move-in")
        .length,
      color: "green",
    },
    {
      label: "Active Tenant",
      value: reservations.filter(
        (r) => r.status.toLowerCase() === "active-tenant",
      ).length,
      color: "purple",
    },
    {
      label: "Cancelled",
      value: reservations.filter((r) => r.status.toLowerCase() === "cancelled")
        .length,
      color: "red",
    },
  ];

  const handleView = (id) => {
    const reservation = reservations.find((res) => res.id === id);
    if (reservation) {
      setSelectedReservation(reservation);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this reservation? This action cannot be undone.")) {
      try {
        await reservationApi.delete(id);
        showNotification("Reservation deleted successfully", "success", 3000);
        handleRefreshData();
      } catch (err) {
        console.error("❌ Error deleting reservation:", err);
        showNotification("Failed to delete reservation", "error", 3000);
      }
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main-content">
        <div className="admin-reservations-container">
          {/* Header */}
          <div className="admin-reservations-header">
            <h1 className="admin-reservations-title">
              Reservations Management
            </h1>
            <p className="admin-reservations-subtitle">
              ₱2,000 slot holder - NOT a tenant yet | Non-refundable, deductible
              from rent
            </p>
          </div>

          {/* Reservation Rules Info Box */}
          <div className="admin-reservations-info-box">
            <div className="admin-reservations-info-header">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 9.99999C18.3333 5.39762 14.6024 1.66666 10 1.66666C5.39763 1.66666 1.66667 5.39762 1.66667 9.99999C1.66667 14.6024 5.39763 18.3333 10 18.3333Z"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 13.3333V10"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 6.66666H10.0083"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="admin-reservations-info-title">
                RESERVATION RULES:
              </span>
            </div>
            <ul className="admin-reservations-info-list">
              <li>
                <strong>₱2,000 fee:</strong> <strong>non-refundable</strong> +
                deductible from first month rent
              </li>
              <li>
                Reservations hold a slot; customer is <strong>NOT</strong> a
                tenant
              </li>
              <li>
                <strong>NOT counted</strong> in room occupancy
              </li>
              <li>1 month validity (extendable)</li>
              <li>
                Refund terms: ONLY after fee credit <strong>not payment</strong>{" "}
                + physical arrival
              </li>
            </ul>
          </div>

          {/* Stats Cards */}
          <div className="admin-reservations-stats">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`admin-reservations-stat-card admin-reservations-stat-card-${stat.color}`}
              >
                <div className="admin-reservations-stat-label">
                  {stat.label}
                </div>
                <div className="admin-reservations-stat-value">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className="admin-reservations-search-section">
            <div className="admin-reservations-search-wrapper">
              <svg
                className="admin-reservations-search-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z"
                  stroke="#9CA3AF"
                  strokeWidth="1.66667"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17.5 17.5L13.875 13.875"
                  stroke="#9CA3AF"
                  strokeWidth="1.66667"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="text"
                className="admin-reservations-search-input"
                placeholder="Search by reservation ID, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="admin-reservations-filters">
              <select
                className="admin-reservations-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked In</option>
                <option value="checked-out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                className="admin-reservations-filter-select"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="all">All Branches</option>
                <option value="gil puyat">Gil Puyat</option>
                <option value="guadalupe">Guadalupe</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="admin-reservations-table-wrapper">
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Loading reservations...</p>
              </div>
            ) : error ? (
              <div
                style={{ textAlign: "center", padding: "40px", color: "red" }}
              >
                <p>Error: {error}</p>
              </div>
            ) : reservations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>No reservations found</p>
              </div>
            ) : (
              <table className="admin-reservations-table">
                <thead className="admin-reservations-table-head">
                  <tr>
                    <th className="admin-reservations-table-th">
                      RESERVATION ID
                    </th>
                    <th className="admin-reservations-table-th">CUSTOMER</th>
                    <th className="admin-reservations-table-th">
                      ROOM & BRANCH
                    </th>
                    <th className="admin-reservations-table-th">
                      MOVE-IN DATE
                    </th>
                    <th className="admin-reservations-table-th">STATUS</th>
                    <th className="admin-reservations-table-th">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="admin-reservations-table-body">
                  {reservations
                    .filter((reservation) => {
                      const matchesSearch =
                        reservation.customer
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        reservation.email
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        reservation.id
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase());
                      const matchesStatus =
                        statusFilter === "all" ||
                        reservation.status.toLowerCase() ===
                          statusFilter.toLowerCase();
                      const matchesBranch =
                        branchFilter === "all" ||
                        reservation.branch.toLowerCase() ===
                          branchFilter.toLowerCase();
                      return matchesSearch && matchesStatus && matchesBranch;
                    })
                    .map((reservation) => (
                      <tr
                        key={reservation.id}
                        className="admin-reservations-table-row"
                      >
                        <td className="admin-reservations-table-td">
                          <div className="admin-reservations-id">
                            {reservation.id}
                          </div>
                          <div className="admin-reservations-date">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M9.5 2H2.5C1.94772 2 1.5 2.44772 1.5 3V10C1.5 10.5523 1.94772 11 2.5 11H9.5C10.0523 11 10.5 10.5523 10.5 10V3C10.5 2.44772 10.0523 2 9.5 2Z"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M8 1V3"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M4 1V3"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M1.5 5H10.5"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {reservation.date}
                          </div>
                        </td>
                        <td className="admin-reservations-table-td">
                          <div className="admin-reservations-customer">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M7 7C8.65685 7 10 5.65685 10 4C10 2.34315 8.65685 1 7 1C5.34315 1 4 2.34315 4 4C4 5.65685 5.34315 7 7 7Z"
                                stroke="#6B7280"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M13 13C13 11.1435 13 10.2152 12.6955 9.48237C12.3166 8.57537 11.6246 7.88338 10.7176 7.50447C9.98477 7.2 9.05652 7.2 7.2 7.2H6.8C4.94348 7.2 4.01523 7.2 3.28237 7.50447C2.37537 7.88338 1.68338 8.57537 1.30447 9.48237C1 10.2152 1 11.1435 1 13"
                                stroke="#6B7280"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {reservation.customer}
                          </div>
                          <div className="admin-reservations-email">
                            {reservation.email}
                          </div>
                        </td>
                        <td className="admin-reservations-table-td">
                          <div className="admin-reservations-room">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M1 7.5C1 7.5 2.5 5 7 5C11.5 5 13 7.5 13 7.5"
                                stroke="#6B7280"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M1 13V7.5"
                                stroke="#6B7280"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M13 13V7.5"
                                stroke="#6B7280"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx="7"
                                cy="3"
                                r="2"
                                stroke="#6B7280"
                                strokeWidth="1.2"
                              />
                            </svg>
                            {reservation.room}
                          </div>
                          <div className="admin-reservations-branch">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M6 10.5C8.48528 10.5 10.5 8.48528 10.5 6C10.5 3.51472 8.48528 1.5 6 1.5C3.51472 1.5 1.5 3.51472 1.5 6C1.5 8.48528 3.51472 10.5 6 10.5Z"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M6 1.5C7.2 3 7.8 4.95 7.8 6C7.8 7.05 7.2 9 6 10.5C4.8 9 4.2 7.05 4.2 6C4.2 4.95 4.8 3 6 1.5Z"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M1.5 6H10.5"
                                stroke="#9CA3AF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {reservation.branch}
                          </div>
                        </td>
                        <td className="admin-reservations-table-td">
                          <div className="admin-reservations-date-icon">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M11 2H3C2.44772 2 2 2.44772 2 3V11C2 11.5523 2.44772 12 3 12H11C11.5523 12 12 11.5523 12 11V3C12 2.44772 11.5523 2 11 2Z"
                                stroke="#2563EB"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M9 1V3"
                                stroke="#2563EB"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M5 1V3"
                                stroke="#2563EB"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M2 5H12"
                                stroke="#2563EB"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {reservation.moveInDate}
                          </div>
                        </td>
                        <td className="admin-reservations-table-td">
                          <span
                            className={`admin-reservations-status admin-reservations-status-${reservation.status.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-")}`}
                          >
                            {reservation.status}
                          </span>
                        </td>
                        <td className="admin-reservations-table-td">
                          <div className="admin-reservations-actions">
                            <button
                              className="admin-reservations-action-btn"
                              onClick={() => handleView(reservation.id)}
                              title="View Details"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 18 18"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M1.5 9C1.5 9 4.5 3 9 3C13.5 3 16.5 9 16.5 9C16.5 9 13.5 15 9 15C4.5 15 1.5 9 1.5 9Z"
                                  stroke="#6B7280"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z"
                                  stroke="#6B7280"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              className="admin-reservations-action-btn admin-reservations-action-btn-delete"
                              onClick={() => handleDelete(reservation.id)}
                              title="Delete Reservation"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 18 18"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M2.25 4.5H16.5"
                                  stroke="#EF4444"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M3.75 4.5V14.25C3.75 15.0117 4.23857 15.75 5.25 15.75H12.75C13.7614 15.75 14.25 15.0117 14.25 14.25V4.5"
                                  stroke="#EF4444"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M7.5 7.5V13.5"
                                  stroke="#EF4444"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M10.5 7.5V13.5"
                                  stroke="#EF4444"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6.75 4.5V3C6.75 2.58579 7.08579 2.25 7.5 2.25H10.5C10.9142 2.25 11.25 2.58579 11.25 3V4.5"
                                  stroke="#EF4444"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <ReservationDetailsModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onUpdate={handleRefreshData}
        />
      )}
    </div>
  );
}

export default ReservationsPage;
