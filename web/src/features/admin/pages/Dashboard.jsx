import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import ReservationItem from "../components/ReservationItem";
import InquiryItem from "../components/InquiryItem";
import {
  inquiryApi,
  reservationApi,
  roomApi,
  userApi,
} from "../../../shared/api/apiClient";
import "../styles/admin-dashboard.css";

export default function Dashboard() {
  const [stats, setStats] = useState([]);
  const [branchData, setBranchData] = useState([]);
  const [reservationData, setReservationData] = useState([]);
  const [recentInquiries, setRecentInquiries] = useState([]);
  const [reservationStatus, setReservationStatus] = useState({
    approved: 0,
    pending: 0,
    rejected: 0,
  });
  const [recentReservations, setRecentReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatRoomType = (type) => {
    if (!type) return "Unknown";
    if (type === "double-sharing") return "Double Sharing";
    if (type === "quadruple-sharing") return "Quadruple Sharing";
    if (type === "private") return "Private";
    return type;
  };

  const formatBranch = (branch) => {
    if (!branch) return "Unknown";
    if (branch === "gil-puyat") return "Gil Puyat";
    if (branch === "guadalupe") return "Guadalupe";
    return branch;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRelativeTime = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const getMonthSeries = (monthsBack = 5) => {
    const now = new Date();
    const series = [];
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      series.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: String(date.getMonth() + 1).padStart(2, "0"),
      });
    }
    return series;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.allSettled([
          roomApi.getBranchOccupancy(),
          inquiryApi.getStats(),
          userApi.getStats(),
          reservationApi.getAll(),
          inquiryApi.getAll({ limit: 6, sort: "createdAt", order: "desc" }),
        ]);

        const [
          occupancyResult,
          inquiryStatsResult,
          userStatsResult,
          reservationsResult,
          inquiriesResult,
        ] = results;

        const getValue = (result, fallback) =>
          result.status === "fulfilled" ? result.value : fallback;

        const occupancyResponse = getValue(occupancyResult, null);
        const inquiryStats = getValue(inquiryStatsResult, null);
        const userStats = getValue(userStatsResult, null);
        const reservations = getValue(reservationsResult, []);
        const inquiries = getValue(inquiriesResult, []);
        const inquiryItems = Array.isArray(inquiries)
          ? inquiries
          : inquiries?.inquiries || [];

        const failedCount = results.filter(
          (result) => result.status === "rejected",
        ).length;

        const occupancyStats =
          occupancyResponse?.statistics || occupancyResponse;
        const totalInquiries = inquiryStats?.total || 0;
        const availableBeds =
          (occupancyStats?.totalCapacity || 0) -
          (occupancyStats?.totalOccupancy || 0);
        const registeredUsers = userStats?.total || 0;
        const activeBookings = (reservations || []).filter((reservation) =>
          ["confirmed", "checked-in"].includes(reservation.status),
        ).length;

        const recentInquiriesData = (inquiryItems || [])
          .slice(0, 4)
          .map((item) => {
            const status =
              item.status === "resolved" || item.status === "closed"
                ? "responded"
                : "new";

            return {
              id: item._id,
              name:
                `${item.firstName || ""} ${item.lastName || ""}`.trim() ||
                item.name ||
                "Unknown",
              email: item.email || "-",
              branch: formatBranch(item.branch),
              time: formatRelativeTime(item.createdAt),
              status,
            };
          });

        const sortedReservations = (reservations || [])
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const recentReservationsData = sortedReservations
          .slice(0, 4)
          .map((item) => {
            const guestName =
              `${item.userId?.firstName || ""} ${
                item.userId?.lastName || ""
              }`.trim() ||
              item.guestName ||
              "Unknown";

            return {
              id: item._id,
              roomType: formatRoomType(
                item.roomId?.type || item.preferredRoomType,
              ),
              guestName,
              branch: formatBranch(item.roomId?.branch || item.branch),
              date: formatDate(item.checkInDate || item.createdAt),
              status: item.status || "pending",
            };
          });

        const approvedCount = (reservations || []).filter((reservation) =>
          ["confirmed", "checked-in"].includes(reservation.status),
        ).length;
        const pendingCount = (reservations || []).filter(
          (reservation) => reservation.status === "pending",
        ).length;
        const rejectedCount = (reservations || []).filter((reservation) =>
          ["cancelled", "rejected"].includes(reservation.status),
        ).length;

        const monthSeries = getMonthSeries(5);
        const monthlyData = monthSeries.map((entry) => ({
          key: entry.key,
          month: entry.month,
          gilPuyat: 0,
          guadalupe: 0,
          total: 0,
        }));

        const monthIndex = monthlyData.reduce((acc, item, index) => {
          acc[item.key] = index;
          return acc;
        }, {});

        (reservations || []).forEach((reservation) => {
          const dateValue = reservation.createdAt || reservation.checkInDate;
          if (!dateValue) return;
          const date = new Date(dateValue);
          const key = `${date.getFullYear()}-${date.getMonth()}`;
          const index = monthIndex[key];
          if (index === undefined) return;

          const branch = reservation.roomId?.branch || reservation.branch;
          if (branch === "gil-puyat") monthlyData[index].gilPuyat += 1;
          if (branch === "guadalupe") monthlyData[index].guadalupe += 1;
          monthlyData[index].total += 1;
        });

        const reservationSeries = monthlyData.map((item) => ({
          month: item.month,
          value: item.total,
        }));

        if (isMounted) {
          setStats([
            {
              id: 1,
              label: "Total Inquiries",
              value: String(totalInquiries),
              icon: "inquiries",
              color: "#3B82F6",
              percentage: inquiryStats?.recentCount
                ? `${inquiryStats.recentCount} last 7d`
                : "-",
            },
            {
              id: 2,
              label: "Available Beds",
              value: String(Math.max(availableBeds, 0)),
              icon: "rooms",
              color: "#F59E0B",
              percentage: occupancyStats?.overallOccupancyRate || "-",
            },
            {
              id: 3,
              label: "Registered Users",
              value: String(registeredUsers),
              icon: "tenants",
              color: "#10B981",
              percentage: userStats?.activeCount
                ? `${userStats.activeCount} active`
                : "-",
            },
            {
              id: 4,
              label: "Active Bookings",
              value: String(activeBookings),
              icon: "reservations",
              color: "#A855F7",
              percentage: approvedCount ? `${approvedCount} confirmed` : "-",
            },
          ]);
          setRecentInquiries(recentInquiriesData);
          setRecentReservations(recentReservationsData);
          setReservationStatus({
            approved: approvedCount,
            pending: pendingCount,
            rejected: rejectedCount,
          });
          setBranchData(
            monthlyData.map(({ month, gilPuyat, guadalupe }) => ({
              month,
              gilPuyat,
              guadalupe,
            })),
          );
          setReservationData(reservationSeries);

          if (failedCount > 0) {
            setError(
              "Some dashboard data failed to load. Showing partial data.",
            );
          }
        }
      } catch (fetchError) {
        console.error("Failed to load dashboard data:", fetchError);
        if (isMounted) {
          setError("Failed to load dashboard data. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    const refreshInterval = setInterval(fetchDashboardData, 60000);
    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  const renderStatIcon = (iconType) => {
    switch (iconType) {
      case "inquiries":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M22 17C22 17.5304 21.7893 18.0391 21.4142 18.4142C21.0391 18.7893 20.5304 19 20 19H6.828C6.29761 19.0001 5.78899 19.2109 5.414 19.586L3.212 21.788C3.1127 21.8873 2.9862 21.9549 2.84849 21.9823C2.71077 22.0097 2.56803 21.9956 2.43831 21.9419C2.30858 21.8881 2.1977 21.7971 2.11969 21.6804C2.04167 21.5637 2.00002 21.4264 2 21.286V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5V17Z"
              stroke="#155DFC"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "reservations":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M8 2V6"
              stroke="#9810FA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 2V6"
              stroke="#9810FA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
              stroke="#9810FA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 10H21"
              stroke="#9810FA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "rooms":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M15 21V13C15 12.7348 14.8946 12.4804 14.7071 12.2929C14.5196 12.1054 14.2652 12 14 12H10C9.73478 12 9.48043 12.1054 9.29289 12.2929C9.10536 12.4804 9 12.7348 9 13V21"
              stroke="#F54900"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 9.99999C2.99993 9.70906 3.06333 9.42161 3.18579 9.15771C3.30824 8.8938 3.4868 8.65979 3.709 8.47199L10.709 2.47199C11.07 2.1669 11.5274 1.99951 12 1.99951C12.4726 1.99951 12.93 2.1669 13.291 2.47199L20.291 8.47199C20.5132 8.65979 20.6918 8.8938 20.8142 9.15771C20.9367 9.42161 21.0001 9.70906 21 9.99999V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V9.99999Z"
              stroke="#F54900"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "tenants":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21"
              stroke="#00A63E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 3.12805C16.8578 3.35042 17.6174 3.85132 18.1597 4.55211C18.702 5.25291 18.9962 6.11394 18.9962 7.00005C18.9962 7.88616 18.702 8.74719 18.1597 9.44799C17.6174 10.1488 16.8578 10.6497 16 10.8721"
              stroke="#00A63E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 21V19C21.9993 18.1137 21.7044 17.2528 21.1614 16.5523C20.6184 15.8519 19.8581 15.3516 19 15.13"
              stroke="#00A63E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z"
              stroke="#00A63E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const reservationTotal = useMemo(
    () =>
      reservationStatus.approved +
      reservationStatus.pending +
      reservationStatus.rejected,
    [reservationStatus],
  );

  return (
    <div className="admin-dashboard">
      <Sidebar />
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-header">
          <div>
            <h1 className="admin-dashboard-title">Dashboard</h1>
            <p className="admin-dashboard-subtitle">
              Welcome back! Here's your admin overview.
            </p>
          </div>
          <div className="admin-dashboard-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {error && <div className="admin-dashboard-error">{error}</div>}

        {loading && (
          <div className="admin-dashboard-loading">Loading dashboard...</div>
        )}

        {/* Stats Cards */}
        <div className="admin-dashboard-stats">
          {stats.map((stat) => (
            <div key={stat.id} className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-header">
                <div
                  className="admin-dashboard-stat-icon"
                  style={{ color: stat.color }}
                >
                  {renderStatIcon(stat.icon)}
                </div>
                <p
                  className={
                    stat.percentage === "-"
                      ? "admin-dashboard-stat-percentage muted"
                      : "admin-dashboard-stat-percentage"
                  }
                >
                  {stat.percentage}
                </p>
              </div>
              <div className="admin-dashboard-stat-body">
                <p className="admin-dashboard-stat-value">{stat.value}</p>
                <p className="admin-dashboard-stat-label">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="admin-dashboard-charts">
          {/* Branch Distribution Chart */}
          <div className="admin-dashboard-chart-card">
            <h3 className="admin-dashboard-chart-title">
              Reservation Distribution
            </h3>
            <div className="admin-dashboard-chart">
              <div className="admin-dashboard-chart-bars">
                {branchData.map((data, index) => {
                  const maxValue = branchData.length
                    ? Math.max(
                        ...branchData.map((item) =>
                          Math.max(item.gilPuyat, item.guadalupe, 1),
                        ),
                      )
                    : 1;
                  const gilPuyatHeight = (data.gilPuyat / maxValue) * 100;
                  const guadalupeHeight = (data.guadalupe / maxValue) * 100;

                  return (
                    <div
                      key={index}
                      className="admin-dashboard-chart-bar-group"
                    >
                      <div className="admin-dashboard-chart-bars-pair">
                        <div
                          className="admin-dashboard-chart-bar blue"
                          style={{ height: `${gilPuyatHeight}%` }}
                          title={`Gil Puyat: ${data.gilPuyat}`}
                        >
                          <span className="admin-dashboard-chart-bar-value">
                            {data.gilPuyat}
                          </span>
                        </div>
                        <div
                          className="admin-dashboard-chart-bar orange"
                          style={{ height: `${guadalupeHeight}%` }}
                          title={`Guadalupe: ${data.guadalupe}`}
                        >
                          <span className="admin-dashboard-chart-bar-value">
                            {data.guadalupe}
                          </span>
                        </div>
                      </div>
                      <div className="admin-dashboard-chart-label">
                        {data.month}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="admin-dashboard-chart-legend">
                <div className="admin-dashboard-chart-legend-item">
                  <span className="admin-dashboard-chart-legend-color blue"></span>
                  <span>Gil Puyat</span>
                </div>
                <div className="admin-dashboard-chart-legend-item">
                  <span className="admin-dashboard-chart-legend-color orange"></span>
                  <span>Guadalupe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Activity Chart */}
          <div className="admin-dashboard-chart-card">
            <h3 className="admin-dashboard-chart-title">
              Reservation Activity
            </h3>
            <div className="admin-dashboard-chart">
              <div className="admin-dashboard-chart-bars">
                {reservationData.map((data, index) => {
                  const maxValue = reservationData.length
                    ? Math.max(
                        ...reservationData.map((item) => item.value || 1),
                      )
                    : 1;
                  const height = (data.value / maxValue) * 100;

                  return (
                    <div
                      key={index}
                      className="admin-dashboard-chart-bar-group single"
                    >
                      <div className="admin-dashboard-chart-bars-pair">
                        <div
                          className="admin-dashboard-chart-bar blue single"
                          style={{ height: `${height}%` }}
                          title={`Reservations: ${data.value}`}
                        >
                          <span className="admin-dashboard-chart-bar-value">
                            {data.value}
                          </span>
                        </div>
                      </div>
                      <div className="admin-dashboard-chart-label">
                        {data.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Inquiries and Reservation Status Section */}
        <div className="admin-dashboard-bottom-section">
          {/* Recent Inquiries */}
          <div className="admin-dashboard-inquiries-section">
            <div className="admin-dashboard-inquiries-header">
              <h2 className="admin-dashboard-section-title">
                Recent Inquiries
              </h2>
              <a href="/admin/inquiries" className="admin-dashboard-view-all">
                View All
              </a>
            </div>
            <div className="admin-dashboard-inquiries-list">
              {recentInquiries.length > 0 ? (
                recentInquiries.map((inquiry) => (
                  <InquiryItem key={inquiry.id} inquiry={inquiry} />
                ))
              ) : (
                <p className="admin-dashboard-empty">No recent inquiries.</p>
              )}
            </div>
          </div>

          {/* Reservation Status */}
          <div className="admin-dashboard-reservation-status-section">
            <h2 className="admin-dashboard-section-title">
              Reservation Status
            </h2>
            <div className="admin-dashboard-donut-container">
              <svg
                className="admin-dashboard-donut-chart"
                viewBox="0 0 200 200"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="40"
                  strokeDasharray={`${
                    reservationTotal
                      ? (reservationStatus.approved / reservationTotal) * 439.8
                      : 0
                  } 439.8`}
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="40"
                  strokeDasharray={`${
                    reservationTotal
                      ? (reservationStatus.pending / reservationTotal) * 439.8
                      : 0
                  } 439.8`}
                  strokeDashoffset={`-${
                    reservationTotal
                      ? (reservationStatus.approved / reservationTotal) * 439.8
                      : 0
                  }`}
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="40"
                  strokeDasharray={`${
                    reservationTotal
                      ? (reservationStatus.rejected / reservationTotal) * 439.8
                      : 0
                  } 439.8`}
                  strokeDashoffset={`-${
                    reservationTotal
                      ? ((reservationStatus.approved +
                          reservationStatus.pending) /
                          reservationTotal) *
                        439.8
                      : 0
                  }`}
                  transform="rotate(-90 100 100)"
                />
              </svg>
            </div>
            <div className="admin-dashboard-reservation-legend">
              <div className="admin-dashboard-reservation-legend-item">
                <span className="admin-dashboard-reservation-legend-dot green"></span>
                <span className="admin-dashboard-reservation-legend-label">
                  Approved
                </span>
                <span className="admin-dashboard-reservation-legend-value">
                  ({reservationStatus.approved})
                </span>
              </div>
              <div className="admin-dashboard-reservation-legend-item">
                <span className="admin-dashboard-reservation-legend-dot orange"></span>
                <span className="admin-dashboard-reservation-legend-label">
                  Pending
                </span>
                <span className="admin-dashboard-reservation-legend-value">
                  ({reservationStatus.pending})
                </span>
              </div>
              <div className="admin-dashboard-reservation-legend-item">
                <span className="admin-dashboard-reservation-legend-dot red"></span>
                <span className="admin-dashboard-reservation-legend-label">
                  Rejected
                </span>
                <span className="admin-dashboard-reservation-legend-value">
                  ({reservationStatus.rejected})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Reservations Section */}
        <div className="admin-dashboard-reservations-full-section">
          <div className="admin-dashboard-reservations-header">
            <h2 className="admin-dashboard-section-title">
              Recent Reservations
            </h2>
            <a href="/admin/reservations" className="admin-dashboard-view-all">
              View All
            </a>
          </div>
          <div className="admin-dashboard-reservations-list">
            {recentReservations.length > 0 ? (
              recentReservations.map((reservation) => (
                <ReservationItem
                  key={reservation.id}
                  reservation={reservation}
                />
              ))
            ) : (
              <p className="admin-dashboard-empty">No recent reservations.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
