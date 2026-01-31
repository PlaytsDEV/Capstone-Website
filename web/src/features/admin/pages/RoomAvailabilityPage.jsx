import { useState } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/admin-room-availability.css";

function RoomAvailabilityPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Sample room data
  const rooms = [
    // Floor 1 - Gil Puyat
    {
      id: "GP-101",
      floor: 1,
      branch: "Gil Puyat",
      type: "Single",
      beds: 1,
      occupied: 1,
      reserved: 0,
    },
    {
      id: "GP-102",
      floor: 1,
      branch: "Gil Puyat",
      type: "Double",
      beds: 2,
      occupied: 1,
      reserved: 0,
    },
    {
      id: "GP-103",
      floor: 1,
      branch: "Gil Puyat",
      type: "Double",
      beds: 2,
      occupied: 0,
      reserved: 0,
    },
    {
      id: "MK-101",
      floor: 1,
      branch: "Gil Puyat",
      type: "Single",
      beds: 1,
      occupied: 0,
      reserved: 0,
    },
    {
      id: "MK-102",
      floor: 1,
      branch: "Gil Puyat",
      type: "Single",
      beds: 1,
      occupied: 1,
      reserved: 0,
    },
    {
      id: "MK-103",
      floor: 1,
      branch: "Gil Puyat",
      type: "Double",
      beds: 2,
      occupied: 0,
      reserved: 0,
    },
    // Floor 2 - Gil Puyat
    {
      id: "GP-201",
      floor: 2,
      branch: "Gil Puyat",
      type: "Quadruple",
      beds: 4,
      occupied: 1,
      reserved: 0,
    },
    {
      id: "GP-202",
      floor: 2,
      branch: "Gil Puyat",
      type: "Quadruple",
      beds: 4,
      occupied: 4,
      reserved: 0,
    },
    {
      id: "GP-203",
      floor: 2,
      branch: "Gil Puyat",
      type: "Double",
      beds: 2,
      occupied: 2,
      reserved: 0,
    },
    {
      id: "MK-201",
      floor: 2,
      branch: "Gil Puyat",
      type: "Double",
      beds: 2,
      occupied: 2,
      reserved: 0,
    },
    {
      id: "MK-202",
      floor: 2,
      branch: "Gil Puyat",
      type: "Quadruple",
      beds: 4,
      occupied: 2,
      reserved: 1,
    },
    {
      id: "MK-203",
      floor: 2,
      branch: "Gil Puyat",
      type: "Quadruple",
      beds: 4,
      occupied: 0,
      reserved: 0,
    },
  ];

  // Calculate stats
  const totalRooms = rooms.length;
  const fullyOccupied = rooms.filter((r) => r.occupied === r.beds).length;
  const fullyAvailable = rooms.filter(
    (r) => r.occupied === 0 && r.reserved === 0,
  ).length;
  const partial = totalRooms - fullyOccupied - fullyAvailable;
  const totalBeds = rooms.reduce((sum, r) => sum + r.beds, 0);
  const occupiedBeds = rooms.reduce((sum, r) => sum + r.occupied, 0);
  const reservedBeds = rooms.reduce((sum, r) => sum + r.reserved, 0);
  const availableBeds = totalBeds - occupiedBeds - reservedBeds;
  const occupancyRate = ((occupiedBeds / totalBeds) * 100).toFixed(1);

  const getRoomStatus = (room) => {
    if (room.occupied === room.beds) return "full";
    if (room.occupied === 0 && room.reserved === 0) return "available";
    return "partial";
  };

  const renderBedIcons = (room) => {
    const icons = [];
    for (let i = 0; i < room.beds; i++) {
      let status = "available";
      if (i < room.occupied) status = "occupied";
      else if (i < room.occupied + room.reserved) status = "reserved";

      icons.push(
        <svg
          key={i}
          className={`room-bed-icon room-bed-${status}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 13V6C2 5.46957 2.21071 4.96086 2.58579 4.58579C2.96086 4.21071 3.46957 4 4 4H16C16.5304 4 17.0391 4.21071 17.4142 4.58579C17.7893 4.96086 18 5.46957 18 6V13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 13V16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 13V16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 10H18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>,
      );
    }
    return icons;
  };

  const getRoomIcon = (type) => {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 10V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H12C12.5304 3 13.0391 3.21071 13.4142 3.58579C13.7893 3.96086 14 4.46957 14 5V10"
          stroke="#6B7280"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 10V13"
          stroke="#6B7280"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 10V13"
          stroke="#6B7280"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 8H14"
          stroke="#6B7280"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Group rooms by floor
  const floor1Rooms = rooms.filter((r) => r.floor === 1);
  const floor2Rooms = rooms.filter((r) => r.floor === 2);

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main-content">
        <div className="room-availability-container">
          {/* Header */}
          <div className="room-availability-header">
            <h1 className="room-availability-title">Room Availability</h1>
            <p className="room-availability-subtitle">
              Visual overview of all rooms and bed occupancy
            </p>
          </div>

          {/* Top Stats */}
          <div className="room-availability-top-stats">
            <div className="room-stat-card">
              <div className="room-stat-label">Total Rooms</div>
              <div className="room-stat-value">{totalRooms}</div>
            </div>
            <div className="room-stat-card room-stat-occupied">
              <div className="room-stat-label">Fully Occupied</div>
              <div className="room-stat-value">{fullyOccupied}</div>
            </div>
            <div className="room-stat-card room-stat-partial">
              <div className="room-stat-label">Partial</div>
              <div className="room-stat-value">{partial}</div>
            </div>
            <div className="room-stat-card room-stat-available">
              <div className="room-stat-label">Fully Available</div>
              <div className="room-stat-value">{fullyAvailable}</div>
            </div>
            <div className="room-stat-card room-stat-rate">
              <div className="room-stat-label">Occupancy Rate</div>
              <div className="room-stat-value">{occupancyRate}%</div>
            </div>
          </div>

          {/* Bed Stats */}
          <div className="room-availability-bed-stats">
            <div className="bed-stat-card">
              <div className="bed-stat-label">Total Beds</div>
              <div className="bed-stat-value">{totalBeds}</div>
            </div>
            <div className="bed-stat-card bed-stat-occupied">
              <div className="bed-stat-label">Occupied</div>
              <div className="bed-stat-value">{occupiedBeds}</div>
            </div>
            <div className="bed-stat-card bed-stat-reserved">
              <div className="bed-stat-label">Reserved</div>
              <div className="bed-stat-value">{reservedBeds}</div>
            </div>
            <div className="bed-stat-card bed-stat-available">
              <div className="bed-stat-label">Available</div>
              <div className="bed-stat-value">{availableBeds}</div>
            </div>
          </div>

          {/* Search */}
          <div className="room-availability-search-wrapper">
            <svg
              className="room-search-icon"
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
              className="room-search-input"
              placeholder="Search room or tenant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Legend */}
          <div className="room-legend">
            <div className="room-legend-title">Legend:</div>
            <div className="room-legend-items">
              <div className="room-legend-item">
                <div className="room-legend-box room-legend-available"></div>
                <span>Available</span>
              </div>
              <div className="room-legend-item">
                <div className="room-legend-box room-legend-reserved"></div>
                <span>Reserved</span>
              </div>
              <div className="room-legend-item">
                <div className="room-legend-box room-legend-occupied"></div>
                <span>Occupied</span>
              </div>
            </div>
          </div>

          {/* Floor 1 */}
          <div className="room-floor-section">
            <div className="room-floor-header">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.25 6.75L9 2.25L15.75 6.75V15C15.75 15.3978 15.592 15.7794 15.3107 16.0607C15.0294 16.342 14.6478 16.5 14.25 16.5H3.75C3.35218 16.5 2.97064 16.342 2.68934 16.0607C2.40804 15.7794 2.25 15.3978 2.25 15V6.75Z"
                  stroke="#374151"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h2 className="room-floor-title">Floor 1 - Gil Puyat</h2>
            </div>
            <div className="room-grid">
              {floor1Rooms.map((room) => (
                <div
                  key={room.id}
                  className={`room-card room-card-${getRoomStatus(room)}`}
                >
                  <div className="room-card-header">
                    <div className="room-card-id">{room.id}</div>
                    <button className="room-card-info-btn">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 12V9"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 6H9.0075"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="room-card-type">
                    {getRoomIcon(room.type)}
                    <span>{room.type}</span>
                  </div>
                  <div className="room-card-beds">{renderBedIcons(room)}</div>
                  <div className="room-card-footer">
                    <div className="room-card-occupancy">
                      {room.occupied + room.reserved}/{room.beds} occupied
                    </div>
                    <span
                      className={`room-status-badge room-status-${getRoomStatus(room)}`}
                    >
                      {getRoomStatus(room) === "full"
                        ? "Full"
                        : getRoomStatus(room) === "available"
                          ? "Available"
                          : "Partial"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floor 2 */}
          <div className="room-floor-section">
            <div className="room-floor-header">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.25 6.75L9 2.25L15.75 6.75V15C15.75 15.3978 15.592 15.7794 15.3107 16.0607C15.0294 16.342 14.6478 16.5 14.25 16.5H3.75C3.35218 16.5 2.97064 16.342 2.68934 16.0607C2.40804 15.7794 2.25 15.3978 2.25 15V6.75Z"
                  stroke="#374151"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h2 className="room-floor-title">Floor 2 - Gil Puyat</h2>
            </div>
            <div className="room-grid">
              {floor2Rooms.map((room) => (
                <div
                  key={room.id}
                  className={`room-card room-card-${getRoomStatus(room)}`}
                >
                  <div className="room-card-header">
                    <div className="room-card-id">{room.id}</div>
                    <button className="room-card-info-btn">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 12V9"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 6H9.0075"
                          stroke="#9CA3AF"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="room-card-type">
                    {getRoomIcon(room.type)}
                    <span>{room.type}</span>
                  </div>
                  <div className="room-card-beds">{renderBedIcons(room)}</div>
                  <div className="room-card-footer">
                    <div className="room-card-occupancy">
                      {room.occupied + room.reserved}/{room.beds} occupied
                    </div>
                    <span
                      className={`room-status-badge room-status-${getRoomStatus(room)}`}
                    >
                      {getRoomStatus(room) === "full"
                        ? "Full"
                        : getRoomStatus(room) === "available"
                          ? "Available"
                          : "Partial"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RoomAvailabilityPage;
