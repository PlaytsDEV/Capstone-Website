import "../styles/landingpage.css";
import gilPuyatImage from "../assets/landingpage-images/gil-puyat-branch.png";
import guadalupeImage from "../assets/landingpage-images/guadalupe-branch.png";
import LilycrestLogo from "../../../shared/components/LilycrestLogo";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import InquiryModal from "../modals/InquiryModal";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Navigation */}
      <Navbar type="landing" currentPage="home" />

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-content">
            <LilycrestLogo
              className="landing-logo"
              aria-label="Lilycrest Logo"
            />
            <p className="landing-hero-tagline">
              A Safe & Comfortable Living Space
            </p>

            <div className="landing-search-bar">
              <input type="text" placeholder="Search for rooms, amenities" />
              <button className="landing-btn-search">Find Your Room</button>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="landing-welcome">
        <div className="landing-container">
          <h2>Welcome To Lilycrest</h2>
          <p>
            Experience modern urban living at its finest. We provide safe,
            comfortable, and affordable dormitory spaces in prime locations
            across Metro Manila.
          </p>
        </div>
      </section>

      {/* About Section */}
      <section className="landing-about">
        <div className="landing-container">
          <h2>About Lilycrest</h2>
          <p>
            Lilycrest offers premium dormitory accommodations designed for
            students and young professionals. With two strategic locations in
            Gil Puyat and Guadalupe, we provide easy access to business
            districts, educational institutions, and vibrant entertainment
            areas. Each facility is equipped with modern amenities to ensure a
            comfortable and productive living experience.
          </p>
        </div>
      </section>

      {/* Branches Section */}
      <section className="landing-branches">
        <div className="landing-container">
          <h2>Select Your Preferred Branch</h2>
          <p>
            Choose from our two strategically located dormitories in Metro
            Manila.
          </p>

          <div className="landing-branches-grid">
            <div className="landing-branch-card">
              <div className="landing-branch-image">
                <img src={gilPuyatImage} alt="Gil Puyat Branch" />
              </div>
              <div className="landing-branch-content">
                <h3>Gil Puyat Branch</h3>
                <p className="landing-branch-location">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M13.3333 6.66659C13.3333 9.99525 9.64067 13.4619 8.40067 14.5326C8.28515 14.6194 8.14453 14.6664 8 14.6664C7.85547 14.6664 7.71485 14.6194 7.59933 14.5326C6.35933 13.4619 2.66667 9.99525 2.66667 6.66659C2.66667 5.2521 3.22857 3.89554 4.22877 2.89535C5.22896 1.89516 6.58551 1.33325 8 1.33325C9.41449 1.33325 10.771 1.89516 11.7712 2.89535C12.7714 3.89554 13.3333 5.2521 13.3333 6.66659Z"
                      stroke="#4A5565"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 8.66675C9.10457 8.66675 10 7.77132 10 6.66675C10 5.56218 9.10457 4.66675 8 4.66675C6.89543 4.66675 6 5.56218 6 6.66675C6 7.77132 6.89543 8.66675 8 8.66675Z"
                      stroke="#4A5565"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Gil Puyat Avenue, Makati City
                </p>
                <p className="landing-branch-description">
                  Conveniently located along Gil Puyat Avenue with easy access
                  to business districts, shopping centers, and entertainment
                  venues.
                </p>
                <button
                  onClick={() => navigate("/gil-puyat")}
                  className="landing-branch-explore"
                >
                  Explore Gil
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M3.33333 8H12.6667"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 3.33325L12.6667 7.99992L8 12.6666"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="landing-branch-card">
              <div className="landing-branch-image">
                <img src={guadalupeImage} alt="Guadalupe Branch" />
              </div>
              <div className="landing-branch-content">
                <h3>Guadalupe Branch</h3>
                <p className="landing-branch-location">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M13.3333 6.66659C13.3333 9.99525 9.64067 13.4619 8.40067 14.5326C8.28515 14.6194 8.14453 14.6664 8 14.6664C7.85547 14.6664 7.71485 14.6194 7.59933 14.5326C6.35933 13.4619 2.66667 9.99525 2.66667 6.66659C2.66667 5.2521 3.22857 3.89554 4.22877 2.89535C5.22896 1.89516 6.58551 1.33325 8 1.33325C9.41449 1.33325 10.771 1.89516 11.7712 2.89535C12.7714 3.89554 13.3333 5.2521 13.3333 6.66659Z"
                      stroke="#4A5565"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 8.66675C9.10457 8.66675 10 7.77132 10 6.66675C10 5.56218 9.10457 4.66675 8 4.66675C6.89543 4.66675 6 5.56218 6 6.66675C6 7.77132 6.89543 8.66675 8 8.66675Z"
                      stroke="#4A5565"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Guadalupe Central Business District
                </p>
                <p className="landing-branch-description">
                  Prime location in the heart of Guadalupe business and
                  entertainment district with easy access to shopping, dining,
                  and entertainment venues.
                </p>
                <button
                  onClick={() => navigate("/guadalupe")}
                  className="landing-branch-explore"
                >
                  Explore Guadalupe
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M3.33333 8H12.6667"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 3.33325L12.6667 7.99992L8 12.6666"
                      stroke="#FF6900"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-how-it-works">
        <div className="landing-container">
          <h2>How It Works?</h2>

          <div className="landing-steps-grid">
            <div className="landing-step">
              <div className="landing-step-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <path
                    d="M28 27.9998L22.2133 22.2131"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14.6667 25.3333C20.5577 25.3333 25.3333 20.5577 25.3333 14.6667C25.3333 8.77563 20.5577 4 14.6667 4C8.77563 4 4 8.77563 4 14.6667C4 20.5577 8.77563 25.3333 14.6667 25.3333Z"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>Browse & Select</h3>
              <p>
                Explore our available rooms and choose your preferred branch and
                room type.
              </p>
            </div>

            <div className="landing-step">
              <div className="landing-step-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <path
                    d="M20 2.66675H7.99998C7.29274 2.66675 6.61446 2.9477 6.11436 3.4478C5.61426 3.94789 5.33331 4.62617 5.33331 5.33341V26.6667C5.33331 27.374 5.61426 28.0523 6.11436 28.5524C6.61446 29.0525 7.29274 29.3334 7.99998 29.3334H24C24.7072 29.3334 25.3855 29.0525 25.8856 28.5524C26.3857 28.0523 26.6666 27.374 26.6666 26.6667V9.33341L20 2.66675Z"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.6667 2.66675V8.00008C18.6667 8.70733 18.9476 9.3856 19.4477 9.8857C19.9478 10.3858 20.6261 10.6667 21.3334 10.6667H26.6667"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 19.9999L14.6667 22.6666L20 17.3333"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>Submit Requirements</h3>
              <p>
                Complete the application form and submit the necessary documents
                online.
              </p>
            </div>

            <div className="landing-step">
              <div className="landing-step-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <path
                    d="M20.6667 9.99992L23.7334 13.0666C23.9826 13.3109 24.3177 13.4477 24.6667 13.4477C25.0157 13.4477 25.3508 13.3109 25.6 13.0666L28.4 10.2666C28.6443 10.0173 28.7812 9.68226 28.7812 9.33325C28.7812 8.98425 28.6443 8.64916 28.4 8.39992L25.3334 5.33325"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M28 2.66675L15.2 15.4667"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 27.9999C14.0501 27.9999 17.3334 24.7167 17.3334 20.6666C17.3334 16.6165 14.0501 13.3333 10 13.3333C5.94993 13.3333 2.66669 16.6165 2.66669 20.6666C2.66669 24.7167 5.94993 27.9999 10 27.9999Z"
                    stroke="#FF6900"
                    strokeWidth="2.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>Move In</h3>
              <p>
                Once approved, schedule your move-in date and start your
                Lilycrest experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Policies Section */}
      <section className="landing-policies">
        <div className="landing-container">
          <h2>General Policies and Disclaimers</h2>

          <div className="landing-policies-grid">
            <div className="landing-policy-box">
              <h4>Security & Safety</h4>
              <ul>
                <li>24/7 security personnel</li>
                <li>CCTV monitoring</li>
                <li>Secure access control</li>
              </ul>
            </div>

            <div className="landing-policy-box">
              <h4>House Rules</h4>
              <ul>
                <li>No smoking inside rooms</li>
                <li>Guest hours: 10 PM - 8 AM</li>
                <li>Guest registration required</li>
              </ul>
            </div>

            <div className="landing-policy-box">
              <h4>Payment Terms</h4>
              <ul>
                <li>Monthly advance payment</li>
                <li>Security deposit required</li>
                <li>Utility fees as per usage</li>
              </ul>
            </div>

            <div className="landing-policy-box">
              <h4>Amenities Included</h4>
              <ul>
                <li>High-speed WiFi</li>
                <li>Common lounge area</li>
                <li>Laundry facilities</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="landing-contact">
        <div className="landing-container">
          <h2>Get in Touch?</h2>
          <p className="landing-contact-subtitle">
            Have questions? We're here to help you find your perfect space
          </p>

          <div className="landing-contact-options">
            <div className="landing-contact-box">
              <div className="landing-contact-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M13.832 16.568C14.0385 16.6628 14.2712 16.6845 14.4917 16.6294C14.7122 16.5744 14.9073 16.4458 15.045 16.265L15.4 15.8C15.5863 15.5516 15.8279 15.35 16.1056 15.2111C16.3833 15.0723 16.6895 15 17 15H20C20.5304 15 21.0391 15.2107 21.4142 15.5858C21.7893 15.9609 22 16.4696 22 17V20C22 20.5304 21.7893 21.0391 21.4142 21.4142C21.0391 21.7893 20.5304 22 20 22C15.2261 22 10.6477 20.1036 7.27208 16.7279C3.89642 13.3523 2 8.7739 2 4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H7C7.53043 2 8.03914 2.21071 8.41421 2.58579C8.78929 2.96086 9 3.46957 9 4V7C9 7.31049 8.92771 7.61672 8.78885 7.89443C8.65 8.17214 8.44839 8.41371 8.2 8.6L7.732 8.951C7.54842 9.09118 7.41902 9.29059 7.36579 9.51535C7.31256 9.74012 7.33878 9.97638 7.44 10.184C8.80668 12.9599 11.0544 15.2048 13.832 16.568Z"
                    stroke="#FF8904"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p>+63 2 1234 5678</p>
            </div>

            <div className="landing-contact-box">
              <div className="landing-contact-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M22 7L13.009 12.727C12.7039 12.9042 12.3573 12.9976 12.0045 12.9976C11.6517 12.9976 11.3051 12.9042 11 12.727L2 7"
                    stroke="#FF8904"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V6C22 4.89543 21.1046 4 20 4Z"
                    stroke="#FF8904"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p>info@lilycrest.ph</p>
            </div>

            <div className="landing-contact-box">
              <div className="landing-contact-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M22 17C22 17.5304 21.7893 18.0391 21.4142 18.4142C21.0391 18.7893 20.5304 19 20 19H6.828C6.29761 19.0001 5.78899 19.2109 5.414 19.586L3.212 21.788C3.1127 21.8873 2.9862 21.9549 2.84849 21.9823C2.71077 22.0097 2.56803 21.9956 2.43831 21.9419C2.30858 21.8881 2.1977 21.7971 2.11969 21.6804C2.04167 21.5637 2.00002 21.4264 2 21.286V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5V17Z"
                    stroke="#FF8904"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p>Live Chat Support</p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="landing-btn-inquiry"
          >
            Inquiry / Learn More
          </button>
          <p className="landing-contact-note">
            Visit us at our Gil Puyat or Guadalupe branches for a tour
          </p>
        </div>
      </section>

      <InquiryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <Footer />
    </div>
  );
}

export default LandingPage;
