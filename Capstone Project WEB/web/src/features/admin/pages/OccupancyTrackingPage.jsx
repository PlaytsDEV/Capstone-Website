import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { roomApi } from "../../../shared/api/apiClient";
import "../styles/admin-occupancy-tracking.css";

function OccupancyTrackingPage({ isEmbedded = false }) {
  const [branchFilter, setBranchFilter] = useState("all");
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch rooms on mount
  useEffect(() => {
    let isMounted = true;

    const fetchRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await roomApi.getAll();
        if (isMounted) {
          setRooms(data);
        }
      } catch (err) {
        console.error("Failed to fetch rooms:", err);
        if (isMounted) {
          setError("Failed to load occupancy data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRooms();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter rooms by branch
  const filteredRooms = rooms.filter((room) => {
    if (branchFilter === "all") return true;
    return room.branch === branchFilter;
  });

  // Calculate statistics
  const stats = {
    totalRooms: filteredRooms.length,
    totalCapacity: filteredRooms.reduce((sum, r) => sum + (r.capacity || 0), 0),
    totalOccupied: filteredRooms.reduce(
      (sum, r) => sum + (r.currentOccupancy || 0),
      0,
    ),
    totalAvailable: filteredRooms.reduce(
      (sum, r) => sum + ((r.capacity || 0) - (r.currentOccupancy || 0)),
      0,
    ),
    occupancyRate: filteredRooms.length
      ? Math.round(
          (filteredRooms.reduce(
            (sum, r) => sum + (r.currentOccupancy || 0),
            0,
          ) /
            filteredRooms.reduce((sum, r) => sum + (r.capacity || 0), 0)) *
            100,
        )
      : 0,
  };

  // Group rooms by type
  const roomsByType = {
    private: filteredRooms.filter((r) => r.type === "private"),
    "double-sharing": filteredRooms.filter((r) => r.type === "double-sharing"),
    "quadruple-sharing": filteredRooms.filter(
      (r) => r.type === "quadruple-sharing",
    ),
  };

  const getRoomTypeLabel = (type) => {
    if (type === "private") return "Private";
    if (type === "double-sharing") return "Double Sharing";
    if (type === "quadruple-sharing") return "Quadruple Sharing";
    return type;
  };

  const getOccupancyColor = (occupied, capacity) => {
    const rate = (occupied / capacity) * 100;
    if (rate === 0) return "#10b981"; // green - empty
    if (rate < 50) return "#3b82f6"; // blue - low
    if (rate < 100) return "#f59e0b"; // amber - high
    return "#ef4444"; // red - full
  };

  if (loading) {
    const loadingHtml = (
      <div className="admin-section">
        <div className="admin-loading">Loading occupancy data...</div>
      </div>
    );
    if (isEmbedded) return loadingHtml;
    return (
      <div className="admin-layout">
        <Sidebar />
        <main className="admin-main">{loadingHtml}</main>
      </div>
    );
  }

  const pageContent = (
    <section className="admin-section">
      {!isEmbedded && (
        <div className="admin-section-header">
          <h1>Occupancy Tracking</h1>
          <p className="admin-section-subtitle">
            Monitor real-time room occupancy across branches
          </p>
        </div>
      )}

      {error && <div className="admin-error-message">{error}</div>}

      {/* Branch Filter */}
      <div className="occupancy-filters">
        <div className="filter-group">
          <label>Branch</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Branches</option>
            <option value="gil-puyat">Gil Puyat</option>
            <option value="guadalupe">Guadalupe</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="occupancy-overview">
        <div className="stat-card">
          <h3>Total Rooms</h3>
          <p className="stat-value">{stats.totalRooms}</p>
        </div>
        <div className="stat-card">
          <h3>Total Capacity</h3>
          <p className="stat-value">{stats.totalCapacity} beds</p>
        </div>
        <div className="stat-card">
          <h3>Occupied</h3>
          <p className="stat-value">{stats.totalOccupied} beds</p>
        </div>
        <div className="stat-card">
          <h3>Available</h3>
          <p className="stat-value">{stats.totalAvailable} beds</p>
        </div>
        <div className="stat-card highlight">
          <h3>Occupancy Rate</h3>
          <p className="stat-value">{stats.occupancyRate}%</p>
        </div>
      </div>

      {/* Overall Occupancy Bar */}
      <div className="overall-occupancy">
        <h3>Overall Occupancy</h3>
        <div className="occupancy-bar">
          <div
            className="occupancy-fill"
            style={{
              width: `${stats.occupancyRate}%`,
              background:
                stats.occupancyRate === 0
                  ? "#10b981"
                  : stats.occupancyRate < 50
                    ? "#3b82f6"
                    : stats.occupancyRate < 100
                      ? "#f59e0b"
                      : "#ef4444",
            }}
          />
        </div>
      </div>

      {/* Room Type Breakdown */}
      <div className="room-type-breakdown">
        <h2>Room Type Analysis</h2>
        <div className="type-cards">
          {Object.entries(roomsByType).map(([type, typeRooms]) => {
            const typeCapacity = typeRooms.reduce(
              (sum, r) => sum + r.capacity,
              0,
            );
            const typeOccupied = typeRooms.reduce(
              (sum, r) => sum + r.currentOccupancy,
              0,
            );
            const typeRate = typeCapacity
              ? Math.round((typeOccupied / typeCapacity) * 100)
              : 0;

            return (
              <div key={type} className="type-card">
                <h3>{getRoomTypeLabel(type)}</h3>
                <p className="type-count">
                  {typeRooms.length} room{typeRooms.length !== 1 ? "s" : ""}
                </p>
                <div className="type-occupancy-bar">
                  <div
                    className="occupancy-fill"
                    style={{
                      width: `${typeRate}%`,
                      background: getOccupancyColor(typeOccupied, typeCapacity),
                    }}
                  />
                </div>
                <p className="occupancy-text">
                  {typeOccupied} / {typeCapacity} ({typeRate}%)
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rooms Table */}
      <div className="rooms-table-section">
        <h2>Room Details</h2>
        <div className="table-wrapper">
          <table className="occupancy-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Occupied</th>
                <th>Available</th>
                <th>Occupancy Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.length > 0 ? (
                filteredRooms.map((room) => {
                  const occupancyRate = Math.round(
                    (room.currentOccupancy / room.capacity) * 100,
                  );
                  const statusColor = getOccupancyColor(
                    room.currentOccupancy,
                    room.capacity,
                  );

                  return (
                    <tr key={room._id}>
                      <td className="room-name">{room.name}</td>
                      <td>{getRoomTypeLabel(room.type)}</td>
                      <td>{room.capacity}</td>
                      <td>
                        <span className="occupied-badge">
                          {room.currentOccupancy}
                        </span>
                      </td>
                      <td>
                        <span className="available-badge">
                          {room.capacity - room.currentOccupancy}
                        </span>
                      </td>
                      <td>
                        <div className="occupancy-cell">
                          <div className="mini-bar">
                            <div
                              className="mini-fill"
                              style={{
                                width: `${occupancyRate}%`,
                                background: statusColor,
                              }}
                            />
                          </div>
                          <span>{occupancyRate}%</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            background: statusColor,
                            color: "white",
                          }}
                        >
                          {occupancyRate === 0
                            ? "Empty"
                            : occupancyRate < 50
                              ? "Low"
                              : occupancyRate < 100
                                ? "High"
                                : "Full"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No rooms found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  if (isEmbedded) {
    return pageContent;
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">{pageContent}</main>
    </div>
  );
}

export default OccupancyTrackingPage;
