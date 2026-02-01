import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { isLoggedIn, getCurrentUser, logout } from "../../../shared/utils/auth";

function Navbar({ type = "landing", currentPage = "home", onLoginClick }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Check authentication status on mount and when user changes
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isLoggedIn();
      setLoggedIn(authenticated);
      if (authenticated) {
        setUser(getCurrentUser());
      }
    };

    checkAuth();

    // Re-check when localStorage changes (e.g., after login/logout)
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowProfileMenu(false);
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  // Landing page navigation
  if (type === "landing") {
    return (
      <nav className="landing-navbar">
        <div className="landing-container">
          <div className="landing-nav-content">
            <button
              onClick={() => navigate("/")}
              className={`landing-nav-link ${currentPage === "home" ? "active" : ""}`}
            >
              Home
            </button>
            <button
              onClick={() =>
                document
                  .querySelector(".landing-branches")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className={`landing-nav-link ${currentPage === "branches" ? "active" : ""}`}
            >
              Branches
            </button>
            <button
              onClick={() =>
                document
                  .querySelector(".landing-about")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className={`landing-nav-link ${currentPage === "about" ? "active" : ""}`}
            >
              About
            </button>
            <button
              onClick={() => {}}
              className={`landing-nav-link ${currentPage === "faqs" ? "active" : ""}`}
            >
              FAQs
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // Branch page navigation (Gil Puyat or Guadalupe)
  if (type === "branch") {
    const isBranchGilPuyat = currentPage?.includes("gil-puyat");
    const branchClass = isBranchGilPuyat ? "gpuyat" : "guadalupe";
    const navbarClass = `${branchClass}-navbar`;
    const containerClass = `${branchClass}-container`;
    const navLinkClass = `${branchClass}-nav-link`;

    return (
      <nav className={navbarClass}>
        <div className={containerClass}>
          <div className={`${branchClass}-nav-content`}>
            {/* Navigation Links - Center */}
            <div className={`${branchClass}-nav-links`}>
              <button onClick={() => navigate("/")} className={navLinkClass}>
                Home
              </button>
              <button
                onClick={() =>
                  document
                    .querySelector(`.${branchClass}-location`)
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className={navLinkClass}
              >
                Location
              </button>
              <button
                onClick={() => {
                  if (isBranchGilPuyat) {
                    navigate("/gil-puyat/rooms");
                  } else {
                    navigate("/guadalupe/rooms");
                  }
                }}
                className={navLinkClass}
              >
                Rooms & Rates
              </button>
            </div>

            {/* Auth Section - Right */}
            <div className={`${branchClass}-nav-auth`}>
              {loggedIn && user ? (
                <div
                  className={`${branchClass}-nav-profile`}
                  ref={profileMenuRef}
                >
                  <button
                    className={`${branchClass}-profile-button`}
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                  >
                    <div className={`${branchClass}-profile-avatar`}>
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                    <span className={`${branchClass}-profile-name`}>
                      {user.firstName} {user.lastName}
                    </span>
                    <svg
                      className={`${branchClass}-profile-arrow ${showProfileMenu ? "open" : ""}`}
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {showProfileMenu && (
                    <div className={`${branchClass}-profile-dropdown`}>
                      <div className={`${branchClass}-profile-dropdown-header`}>
                        <div
                          className={`${branchClass}-profile-dropdown-avatar`}
                        >
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <div className={`${branchClass}-profile-dropdown-info`}>
                          <div
                            className={`${branchClass}-profile-dropdown-name`}
                          >
                            {user.firstName} {user.lastName}
                          </div>
                          <div
                            className={`${branchClass}-profile-dropdown-email`}
                          >
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`${branchClass}-profile-dropdown-divider`}
                      ></div>
                      <button
                        className={`${branchClass}-profile-dropdown-item`}
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate("/profile");
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z"
                            fill="currentColor"
                          />
                        </svg>
                        My Profile
                      </button>
                      <button
                        className={`${branchClass}-profile-dropdown-item`}
                        onClick={handleLogout}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLoginClick}
                  className={`${branchClass}-nav-login`}
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return null;
}

export default Navbar;
