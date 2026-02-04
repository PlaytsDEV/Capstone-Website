import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import "../../../shared/styles/notification.css";
import "../styles/tenant-dashboard.css";

function CheckAvailabilityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedRoomType, setSelectedRoomType] = useState("All");
  const [bookingLoading, setBookingLoading] = useState(false);

  // Get available room types based on selected branch
  const getAvailableRoomTypes = () => {
    if (selectedBranch === "All") {
      return ["All", "Private", "Shared", "Quadruple"];
    } else if (selectedBranch === "Gil Puyat") {
      return ["All", "Private", "Shared", "Quadruple"];
    } else if (selectedBranch === "Guadalupe") {
      return ["All", "Quadruple"];
    }
    return ["All"];
  };

  const availableRoomTypes = getAvailableRoomTypes();

  const availableRooms = [
    // Gil Puyat - Private Rooms
    {
      id: "GP-P-001",
      title: "Room GP-P-001",
      branch: "Gil Puyat",
      type: "Private",
      occupancy: "0/1",
      bedsLeft: "1 bed available",
      price: 8000,
      image: require("../../../assets/images/branches/gil-puyat/standard-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Window"],
    },
    {
      id: "GP-P-002",
      title: "Room GP-P-002",
      branch: "Gil Puyat",
      type: "Private",
      occupancy: "0/1",
      bedsLeft: "1 bed available",
      price: 8000,
      image: require("../../../assets/images/branches/gil-puyat/standard-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Window"],
    },
    {
      id: "GP-P-003",
      title: "Room GP-P-003",
      branch: "Gil Puyat",
      type: "Private",
      occupancy: "1/1",
      bedsLeft: "Full",
      price: 8000,
      image: require("../../../assets/images/branches/gil-puyat/standard-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Window"],
    },
    // Gil Puyat - Shared (Double) Rooms
    {
      id: "GP-D-001",
      title: "Room GP-D-001",
      branch: "Gil Puyat",
      type: "Shared",
      occupancy: "1/2",
      bedsLeft: "1 bed available",
      price: 5500,
      image: require("../../../assets/images/branches/gil-puyat/premium-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Shared Bathroom"],
    },
    {
      id: "GP-D-002",
      title: "Room GP-D-002",
      branch: "Gil Puyat",
      type: "Shared",
      occupancy: "0/2",
      bedsLeft: "2 beds available",
      price: 5500,
      image: require("../../../assets/images/branches/gil-puyat/premium-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Shared Bathroom"],
    },
    // Gil Puyat - Quadruple Rooms
    {
      id: "GP-Q-001",
      title: "Room GP-Q-001",
      branch: "Gil Puyat",
      type: "Quadruple",
      occupancy: "2/4",
      bedsLeft: "2 beds available",
      price: 4500,
      image: require("../../../assets/images/branches/gil-puyat/gallery1.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    },
    {
      id: "GP-Q-002",
      title: "Room GP-Q-002",
      branch: "Gil Puyat",
      type: "Quadruple",
      occupancy: "0/4",
      bedsLeft: "4 beds available",
      price: 4500,
      image: require("../../../assets/images/branches/gil-puyat/gallery1.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    },
    // Guadalupe - Quadruple Rooms Only
    {
      id: "GD-Q-001",
      title: "Room GD-Q-001",
      branch: "Guadalupe",
      type: "Quadruple",
      occupancy: "0/4",
      bedsLeft: "4 beds available",
      price: 4800,
      image: require("../../../assets/images/branches/gil-puyat/deluxe-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    },
    {
      id: "GD-Q-002",
      title: "Room GD-Q-002",
      branch: "Guadalupe",
      type: "Quadruple",
      occupancy: "1/4",
      bedsLeft: "3 beds available",
      price: 4800,
      image: require("../../../assets/images/branches/gil-puyat/premium-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    },
    {
      id: "GD-Q-003",
      title: "Room GD-Q-003",
      branch: "Guadalupe",
      type: "Quadruple",
      occupancy: "2/4",
      bedsLeft: "2 beds available",
      price: 4300,
      image: require("../../../assets/images/branches/gil-puyat/standard-room.jpg"),
      amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    },
  ];

  const upcomingRoom = {
    id: "GD-Q-004",
    title: "Room GD-Q-004",
    branch: "Guadalupe",
    type: "Quadruple",
    price: 4200,
    availableFrom: "March 15, 2026",
  };

  // Filter rooms based on search and filters
  const filteredRooms = availableRooms.filter((room) => {
    const matchesSearch =
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.branch.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch =
      selectedBranch === "All" || room.branch === selectedBranch;
    const matchesType =
      selectedRoomType === "All" || room.type === selectedRoomType;
    return matchesSearch && matchesBranch && matchesType;
  });

  const handleBranchFilter = (branch) => {
    setSelectedBranch(branch);
    // Reset room type when branch changes
    setSelectedRoomType("All");
  };

  const handleRoomTypeFilter = (type) => {
    setSelectedRoomType(type);
  };

  const handleBookNow = async (room) => {
    if (bookingLoading) return;

    try {
      setBookingLoading(true);

      // Check if user is logged in
      if (!user) {
        showNotification("Please log in to book a room", "warning", 3000);
        navigate("/tenant/signin");
        return;
      }

      // Prepare reservation data
      const checkInDate = new Date();
      const reservationData = {
        roomName: room.id, // Using the room identifier (e.g., GP-100)
        checkInDate: checkInDate.toISOString(),
        totalPrice: room.price,
        notes: `Booking for ${room.title} - ${room.type} at ${room.branch} branch`,
      };

      console.log("📝 Creating reservation:", reservationData);

      // Create reservation via API
      const response = await reservationApi.create(reservationData);

      console.log("✅ Reservation created:", response);

      showNotification(
        `Successfully booked ${room.title}! Waiting for admin confirmation.`,
        "success",
        4000,
      );

      // Navigate to profile or reservations page after short delay
      setTimeout(() => {
        navigate("/tenant/profile");
      }, 1500);
    } catch (error) {
      console.error("❌ Booking error:", error);

      let errorMessage = "Failed to create booking. Please try again.";

      if (error.message?.includes("ROOM_NOT_FOUND")) {
        errorMessage = "Room not found in the system. Please contact support.";
      } else if (error.message?.includes("ROOM_NOT_AVAILABLE")) {
        errorMessage = "This room is no longer available.";
      } else if (error.message?.includes("USER_NOT_FOUND")) {
        errorMessage =
          "User account not found. Please complete your registration.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      showNotification(errorMessage, "error", 5000);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleSendInquiry = () => {
    navigate("/tenant/inquiry");
  };

  const handleViewFAQs = () => {
    navigate("/faqs");
  };

  const handleGetNotified = () => {
    handleSendInquiry();
  };

  return (
    <div className="tenant-dashboard-page">
      <div className="tenant-dashboard-container">
        <h1 className="tenant-dashboard-title">Check Room Availability</h1>
        <p className="tenant-dashboard-subtitle">
          Browse available rooms at Lilycrest dormitories
        </p>

        <div className="tenant-dashboard-search-row">
          <div className="tenant-dashboard-search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9.16667 16.6667C13.3088 16.6667 16.6667 13.3088 16.6667 9.16667C16.6667 5.02453 13.3088 1.66667 9.16667 1.66667C5.02453 1.66667 1.66667 5.02453 1.66667 9.16667C1.66667 13.3088 5.02453 16.6667 9.16667 16.6667Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M18.3333 18.3333L14.7083 14.7083"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by room number or branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="tenant-dashboard-filter-btn"
            type="button"
            title="Toggle filters"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 3.5H14M4.5 8H11.5M6.5 12.5H9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Filters
          </button>
        </div>

        <div className="tenant-dashboard-filters">
          <div className="tenant-dashboard-filter-group">
            <span className="tenant-dashboard-filter-label">Branch</span>
            <button
              className={`tenant-dashboard-pill ${selectedBranch === "All" ? "active" : ""}`}
              type="button"
              onClick={() => handleBranchFilter("All")}
            >
              All
            </button>
            <button
              className={`tenant-dashboard-pill ${selectedBranch === "Gil Puyat" ? "active" : ""}`}
              type="button"
              onClick={() => handleBranchFilter("Gil Puyat")}
            >
              Gil Puyat
            </button>
            <button
              className={`tenant-dashboard-pill ${selectedBranch === "Guadalupe" ? "active" : ""}`}
              type="button"
              onClick={() => handleBranchFilter("Guadalupe")}
            >
              Guadalupe
            </button>
          </div>
          <div className="tenant-dashboard-filter-group">
            <span className="tenant-dashboard-filter-label">Room Type</span>
            {availableRoomTypes.map((type) => (
              <button
                key={type}
                className={`tenant-dashboard-pill ${selectedRoomType === type ? "active" : ""}`}
                type="button"
                onClick={() => handleRoomTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <section className="tenant-dashboard-section">
          <h2>Available Now</h2>
          <p>{filteredRooms.length} rooms ready for immediate move-in</p>
          <div className="tenant-dashboard-grid">
            {filteredRooms.map((room) => (
              <article key={room.id} className="tenant-room-card">
                <div className="tenant-room-image">
                  <img src={room.image} alt={room.title} />
                  <span className="tenant-room-badge">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3.5 6L5 7.5L8.5 4"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Available
                  </span>
                </div>
                <div className="tenant-room-content">
                  <div className="tenant-room-title">
                    <h3>{room.title}</h3>
                    <span className="tenant-room-type">{room.type}</span>
                  </div>
                  <div className="tenant-room-meta">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 1C3.791 1 2 2.791 2 5C2 7.209 6 11 6 11C6 11 10 7.209 10 5C10 2.791 8.209 1 6 1Z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <circle
                        cx="6"
                        cy="5"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                    {room.branch}
                  </div>
                  <div className="tenant-room-stats">
                    <span>{room.occupancy}</span>
                    <span>{room.bedsLeft}</span>
                  </div>
                  <div className="tenant-room-tags">
                    {room.amenities.map((amenity) => (
                      <span key={amenity} className="tenant-room-tag">
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <div className="tenant-room-footer">
                    <div className="tenant-room-price">
                      ₱{room.price.toLocaleString()}
                      <span>/month</span>
                    </div>
                    <button
                      className="tenant-room-cta"
                      type="button"
                      onClick={() => handleBookNow(room)}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? "Booking..." : "Book Now"}
                      {!bookingLoading && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M3 6H9"
                            stroke="white"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7 3L9 6L7 9"
                            stroke="white"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="tenant-dashboard-section">
          <h2>Coming Soon</h2>
          <p>Rooms that will be available soon</p>
          <div className="tenant-dashboard-grid">
            <article className="tenant-room-upcoming">
              <div className="tenant-room-upcoming-header">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="3"
                    y="4"
                    width="14"
                    height="13"
                    rx="2"
                    stroke="white"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M6 2V6"
                    stroke="white"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 2V6"
                    stroke="white"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <div>
                  <div>Available from</div>
                  <strong>{upcomingRoom.availableFrom}</strong>
                </div>
              </div>
              <div className="tenant-room-upcoming-body">
                <div className="tenant-room-title">
                  <h3>{upcomingRoom.title}</h3>
                  <span className="tenant-room-type">{upcomingRoom.type}</span>
                </div>
                <div className="tenant-room-meta">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 1C3.791 1 2 2.791 2 5C2 7.209 6 11 6 11C6 11 10 7.209 10 5C10 2.791 8.209 1 6 1Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx="6"
                      cy="5"
                      r="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                  {upcomingRoom.branch}
                </div>
                <div className="tenant-room-footer">
                  <div className="tenant-room-price">
                    ₱{upcomingRoom.price.toLocaleString()}
                    <span>/month</span>
                  </div>
                  <button
                    className="tenant-room-cta"
                    type="button"
                    onClick={handleGetNotified}
                  >
                    Get Notified
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="tenant-dashboard-cta">
          <h3>Ready to move in?</h3>
          <p>Schedule a viewing or send us an inquiry to reserve your room</p>
          <div className="tenant-dashboard-cta-buttons">
            <button
              className="tenant-dashboard-cta-primary"
              type="button"
              onClick={handleSendInquiry}
            >
              Send an Inquiry
            </button>
            <button
              className="tenant-dashboard-cta-secondary"
              type="button"
              onClick={handleViewFAQs}
            >
              View FAQs
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CheckAvailabilityPage;
