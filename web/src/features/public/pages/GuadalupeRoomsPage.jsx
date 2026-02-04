import "../styles/guadalupe-rooms.css";
import locationMapImage from "../../../assets/images/branches/gil-puyat/location-map.jpg";
import quadrupleSharingImage from "../../../assets/images/branches/gil-puyat/premium-room.jpg";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

function GuadalupeRoomsPage() {
  const navigate = useNavigate();
  return (
    <div className="guadalupe-rooms-page">
      {/* Navigation */}
      <Navbar
        type="branch"
        currentPage="guadalupe"
        onLoginClick={() => navigate("/tenant/signin")}
      />

      {/* Breadcrumb */}
      <div className="guadalupe-rooms-breadcrumb">
        <div className="guadalupe-rooms-container">
          <span
            onClick={() => navigate("/guadalupe")}
            className="breadcrumb-link"
          >
            Home
          </span>
          <span className="breadcrumb-separator">/</span>
          <span
            onClick={() => navigate("/guadalupe")}
            className="breadcrumb-link"
          >
            Guadalupe Branch
          </span>
          <span className="breadcrumb-separator">/</span>
          <span
            onClick={() => navigate("/guadalupe/rooms")}
            className="breadcrumb-current"
          >
            Rooms & Rates
          </span>
        </div>
      </div>

      {/* Room Types Section */}
      <section className="guadalupe-rooms-types">
        <div className="guadalupe-rooms-container">
          <h2>Room Types</h2>

          <div className="guadalupe-room-type-card">
            <div className="guadalupe-room-type-image">
              <img src={quadrupleSharingImage} alt="Quadruple Sharing" />
            </div>
            <div className="guadalupe-room-type-content">
              <h3>Quadruple Sharing</h3>
              <div className="guadalupe-room-type-features">
                <span className="feature">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M10.6667 14V12.6667C10.6667 11.9594 10.3858 11.2811 9.88566 10.781C9.38556 10.281 8.70728 10 8.00004 10H4.00004C3.2928 10 2.61452 10.281 2.11442 10.781C1.61433 11.2811 1.33337 11.9594 1.33337 12.6667V14"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.6666 2.08545C11.2385 2.2337 11.7449 2.56763 12.1064 3.03482C12.4679 3.50202 12.6641 4.07604 12.6641 4.66678C12.6641 5.25752 12.4679 5.83154 12.1064 6.29874C11.7449 6.76594 11.2385 7.09987 10.6666 7.24812"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14.6666 14.0002V12.6669C14.6662 12.0761 14.4695 11.5021 14.1075 11.0351C13.7455 10.5682 13.2387 10.2346 12.6666 10.0869"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.00004 7.33333C7.4728 7.33333 8.66671 6.13943 8.66671 4.66667C8.66671 3.19391 7.4728 2 6.00004 2C4.52728 2 3.33337 3.19391 3.33337 4.66667C3.33337 6.13943 4.52728 7.33333 6.00004 7.33333Z"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  4 persons
                </span>
                <span className="feature">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M1.33337 2.6665V13.3332"
                      stroke="#2B7FFF"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M1.33337 5.3335H13.3334C13.687 5.3335 14.0261 5.47397 14.2762 5.72402C14.5262 5.97407 14.6667 6.31321 14.6667 6.66683V13.3335"
                      stroke="#2B7FFF"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M1.33337 11.3335H14.6667"
                      stroke="#2B7FFF"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 5.3335V11.3335"
                      stroke="#2B7FFF"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  4 beds
                </span>
                <span className="feature">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M5.33337 1.3335V4.00016"
                      stroke="#00C950"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.6666 1.3335V4.00016"
                      stroke="#00C950"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12.6667 2.6665H3.33333C2.59695 2.6665 2 3.26346 2 3.99984V13.3332C2 14.0696 2.59695 14.6665 3.33333 14.6665H12.6667C13.403 14.6665 14 14.0696 14 13.3332V3.99984C14 3.26346 13.403 2.6665 12.6667 2.6665Z"
                      stroke="#00C950"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 6.6665H14"
                      stroke="#00C950"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  3 months minimum
                </span>
              </div>
              <p className="guadalupe-room-type-description">
                Our most economical option designed for students and interns.
                This quad room features comfortable beds with individual reading
                lights, shared study area, lockers, and air conditioning. Build
                lasting friendships in a vibrant community atmosphere.
              </p>
              <div className="guadalupe-room-type-footer">
                <div className="guadalupe-room-type-price">
                  <span className="price">₱4,500</span>
                  <span className="period">per month</span>
                </div>
                <button
                  className="guadalupe-btn-view-room-details"
                  onClick={() => navigate("/guadalupe/rooms/quadruple")}
                >
                  View Details →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Header Section */}
      <section className="guadalupe-rooms-header">
        <div className="guadalupe-rooms-container">
          <h1>Guadalupe Branch</h1>
          <p className="guadalupe-rooms-location">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M13.3333 6.66659C13.3333 9.99525 9.64067 13.4619 8.40067 14.5326C8.28515 14.6194 8.14453 14.6664 8 14.6664C7.85547 14.6664 7.71485 14.6194 7.59933 14.5326C6.35933 13.4619 2.66667 9.99525 2.66667 6.66659C2.66667 5.2521 3.22857 3.89554 4.22877 2.89535C5.22896 1.89516 6.58551 1.33325 8 1.33325C9.41449 1.33325 10.771 1.89516 11.7712 2.89535C12.7714 3.89554 13.3333 5.2521 13.3333 6.66659Z"
                stroke="#FF6900"
                strokeWidth="1.33333"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 8.66675C9.10457 8.66675 10 7.77132 10 6.66675C10 5.56218 9.10457 4.66675 8 4.66675C6.89543 4.66675 6 5.56218 6 6.66675C6 7.77132 6.89543 8.66675 8 8.66675Z"
                stroke="#FF6900"
                strokeWidth="1.33333"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            456 Guadalupe Avenue, Makati City, Metro Manila
          </p>
        </div>
      </section>

      {/* About Section */}
      <section className="guadalupe-rooms-about">
        <div className="guadalupe-rooms-container">
          <h2>About Guadalupe Branch</h2>
          <p>
            Located in the peaceful yet accessible Guadalupe area, our dormitory
            offers a perfect balance of tranquility and convenience. Close to
            major business districts, shopping centers, and educational
            institutions, it's an ideal choice for students and young
            professionals.
          </p>
          <p>
            Our Guadalupe branch features spacious, fully-furnished rooms
            designed for comfort and community. With 24/7 security, high-speed
            internet, and modern amenities, this is your ideal home away from
            home. Enjoy access to shared facilities including a fully-equipped
            kitchen, lounge areas, study rooms, and laundry facilities.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="guadalupe-rooms-location-section">
        <div className="guadalupe-rooms-container">
          <h2>Location</h2>
          <div className="guadalupe-rooms-map">
            <img src={locationMapImage} alt="Location Map" />
            <p className="guadalupe-rooms-map-address">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M13.3333 6.66659C13.3333 9.99525 9.64067 13.4619 8.40067 14.5326C8.28515 14.6194 8.14453 14.6664 8 14.6664C7.85547 14.6664 7.71485 14.6194 7.59933 14.5326C6.35933 13.4619 2.66667 9.99525 2.66667 6.66659C2.66667 5.2521 3.22857 3.89554 4.22877 2.89535C5.22896 1.89516 6.58551 1.33325 8 1.33325C9.41449 1.33325 10.771 1.89516 11.7712 2.89535C12.7714 3.89554 13.3333 5.2521 13.3333 6.66659Z"
                  stroke="#FF6900"
                  strokeWidth="1.33333"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 8.66675C9.10457 8.66675 10 7.77132 10 6.66675C10 5.56218 9.10457 4.66675 8 4.66675C6.89543 4.66675 6 5.56218 6 6.66675C6 7.77132 6.89543 8.66675 8 8.66675Z"
                  stroke="#FF6900"
                  strokeWidth="1.33333"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              456 Guadalupe Avenue, Makati City, Metro Manila
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="guadalupe-rooms-cta">
        <div className="guadalupe-rooms-container">
          <h2>Ready to Move In?</h2>
          <p>
            Contact us today to schedule a visit or inquire about availability
          </p>
          <div className="guadalupe-rooms-cta-buttons">
            <button className="guadalupe-btn-book-tour">Book a Tour</button>
            <button className="guadalupe-btn-contact-us">Contact Us</button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default GuadalupeRoomsPage;
