import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { isLoggedIn, getCurrentUser, logout } from "../../../shared/utils/auth";
import { showNotification } from "../../../shared/utils/notification";

/**
 * Navbar component with profile dropdown functionality
 * Supports multiple navbar types (landing, branch) with consistent behavior
 * Features accessibility enhancements, keyboard navigation, and error handling
 */
function Navbar({ type = "landing", currentPage = "home", onLoginClick }) {
  const navigate = useNavigate();

  // State management
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(0);

  // Refs for DOM manipulation
  const profileMenuRef = useRef(null);
  const profileButtonRef = useRef(null);

  /**
   * Safely retrieves user initials with defensive checks
   * @param {string} firstName - User's first name
   * @param {string} lastName - User's last name
   * @returns {string} Uppercase initials or empty string
   */
  const getInitials = useCallback((firstName, lastName) => {
    try {
      const first = (firstName || "").charAt(0).toUpperCase();
      const last = (lastName || "").charAt(0).toUpperCase();
      return `${first}${last}`;
    } catch (error) {
      console.warn("Error generating user initials:", error);
      return "";
    }
  }, []);

  /**
   * Measures the profile button width for dropdown alignment
   */
  const measureButtonWidth = useCallback(() => {
    if (profileButtonRef.current) {
      const width = profileButtonRef.current.offsetWidth;
      setButtonWidth(width);
    }
  }, []);

  /**
   * Checks authentication status and updates state
   * Includes error handling for auth operations
   */
  const checkAuth = useCallback(() => {
    try {
      const authenticated = isLoggedIn();
      setLoggedIn(authenticated);

      if (authenticated) {
        const currentUser = getCurrentUser();
        if (currentUser && typeof currentUser === "object") {
          setUser(currentUser);
        } else {
          console.warn("Invalid user data received");
          setUser(null);
          setLoggedIn(false);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      setLoggedIn(false);
      setUser(null);
    }
  }, []);

  /**
   * Handles logout with proper error handling and user feedback
   */
  const handleLogout = useCallback(async () => {
    setShowProfileMenu(false);
    setIsLoading(true);

    try {
      await logout();
      showNotification("Successfully logged out", "success");
      // Auth state will be updated via storage event listener
    } catch (error) {
      console.error("Logout error:", error);
      showNotification("Failed to logout. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggles profile menu visibility with accessibility considerations
   */
  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu((prev) => !prev);
  }, []);

  /**
   * Closes profile menu
   */
  const closeProfileMenu = useCallback(() => {
    setShowProfileMenu(false);
  }, []);

  /**
   * Handles keyboard navigation for accessibility
   * @param {KeyboardEvent} event - Keyboard event
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (!showProfileMenu) return;

      switch (event.key) {
        case "Escape":
          closeProfileMenu();
          profileButtonRef.current?.focus();
          break;
        case "ArrowDown":
          event.preventDefault();
          // Focus first dropdown item
          const firstItem =
            profileMenuRef.current?.querySelector('[role="menuitem"]');
          firstItem?.focus();
          break;
        default:
          break;
      }
    },
    [showProfileMenu, closeProfileMenu],
  );

  /**
   * Handles clicks outside the dropdown to close it
   * Uses modern event handling without global listeners when possible
   * @param {MouseEvent} event - Click event
   */
  const handleClickOutside = useCallback(
    (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target) &&
        !profileButtonRef.current?.contains(event.target)
      ) {
        closeProfileMenu();
      }
    },
    [closeProfileMenu],
  );

  // Authentication status check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Storage event listener for auth changes (login/logout from other tabs)
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "user" || event.key === "token") {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [checkAuth]);

  // Measure button width when user data changes (only for branch pages)
  useEffect(() => {
    if (loggedIn && user && type === "branch") {
      // Use setTimeout to ensure DOM is updated
      const timer = setTimeout(() => {
        measureButtonWidth();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [loggedIn, user, type, measureButtonWidth]);

  // Click outside handler
  useEffect(() => {
    if (!showProfileMenu) return;

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu, handleClickOutside]);

  // Keyboard navigation
  useEffect(() => {
    if (!showProfileMenu) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showProfileMenu, handleKeyDown]);

  // Focus management for accessibility
  useEffect(() => {
    if (showProfileMenu) {
      // Focus trap within dropdown
      const focusableElements = profileMenuRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements?.[0];
      const lastElement = focusableElements?.[focusableElements.length - 1];

      const handleTabKey = (e) => {
        if (e.key === "Tab") {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleTabKey);
      return () => document.removeEventListener("keydown", handleTabKey);
    }
  }, [showProfileMenu]);

  // Landing page navigation
  if (type === "landing") {
    return (
      <nav
        className="landing-navbar"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="landing-container">
          <div className="landing-nav-content">
            {/* Navigation Links - Center */}
            <div className="landing-nav-links" role="menubar">
              <button
                onClick={() => navigate("/")}
                className={`landing-nav-link ${currentPage === "home" ? "active" : ""}`}
                role="menuitem"
                aria-current={currentPage === "home" ? "page" : undefined}
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
                role="menuitem"
                aria-current={currentPage === "branches" ? "page" : undefined}
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
                role="menuitem"
                aria-current={currentPage === "about" ? "page" : undefined}
              >
                About
              </button>
              <button
                onClick={() => {}}
                className={`landing-nav-link ${currentPage === "faqs" ? "active" : ""}`}
                role="menuitem"
                aria-current={currentPage === "faqs" ? "page" : undefined}
              >
                FAQs
              </button>
            </div>

            {/* Auth Section - Hidden on landing page */}
            {/* <div className="landing-nav-auth">
              {loggedIn && user ? (
                <div className="landing-nav-profile" ref={profileMenuRef}>
                  <button
                    ref={profileButtonRef}
                    className="landing-profile-button"
                    onClick={toggleProfileMenu}
                    aria-expanded={showProfileMenu}
                    aria-haspopup="menu"
                    aria-label={`User menu for ${user.firstName || ""} ${user.lastName || ""}`}
                    disabled={isLoading}
                  >
                    <div className="landing-profile-avatar" aria-hidden="true">
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                    <span className="landing-profile-name">
                      {user.firstName || ""} {user.lastName || ""}
                    </span>
                    <svg
                      className={`landing-profile-arrow ${showProfileMenu ? "open" : ""}`}
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
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
                    <div
                      className="landing-profile-dropdown"
                      role="menu"
                      aria-label="User menu"
                      style={{
                        width: buttonWidth || "auto",
                        minWidth: "auto",
                        maxWidth: "none",
                      }}
                    >
                      <div
                        className="landing-profile-dropdown-header"
                        role="none"
                      >
                        <div
                          className="landing-profile-dropdown-avatar"
                          aria-hidden="true"
                        >
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <div
                          className="landing-profile-dropdown-info"
                          role="none"
                        >
                          <div className="landing-profile-dropdown-name">
                            {user.firstName || ""} {user.lastName || ""}
                          </div>
                          <div className="landing-profile-dropdown-email">
                            {user.email || ""}
                          </div>
                        </div>
                      </div>
                      <div
                        className="landing-profile-dropdown-divider"
                        role="separator"
                        aria-hidden="true"
                      ></div>
                      <button
                        className="landing-profile-dropdown-item"
                        onClick={() => {
                          closeProfileMenu();
                          navigate("/profile");
                        }}
                        role="menuitem"
                        tabIndex={0}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z"
                            fill="currentColor"
                          />
                        </svg>
                        My Profile
                      </button>
                      <button
                        className="landing-profile-dropdown-item"
                        onClick={handleLogout}
                        role="menuitem"
                        tabIndex={0}
                        disabled={isLoading}
                        aria-label={isLoading ? "Logging out..." : "Logout"}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {isLoading ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div> */}
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
      <nav
        className={navbarClass}
        role="navigation"
        aria-label="Branch navigation"
      >
        <div className={containerClass}>
          <div className={`${branchClass}-nav-content`}>
            {/* Navigation Links - Center */}
            <div className={`${branchClass}-nav-links`} role="menubar">
              <button
                onClick={() => navigate("/")}
                className={navLinkClass}
                role="menuitem"
              >
                Home
              </button>
              <button
                onClick={() =>
                  document
                    .querySelector(`.${branchClass}-location`)
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className={navLinkClass}
                role="menuitem"
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
                role="menuitem"
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
                    ref={profileButtonRef}
                    className={`${branchClass}-profile-button`}
                    onClick={toggleProfileMenu}
                    aria-expanded={showProfileMenu}
                    aria-haspopup="menu"
                    aria-label={`User menu for ${user.firstName || ""} ${user.lastName || ""}`}
                    disabled={isLoading}
                  >
                    <div
                      className={`${branchClass}-profile-avatar`}
                      aria-hidden="true"
                    >
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                    <span className={`${branchClass}-profile-name`}>
                      {user.firstName || ""} {user.lastName || ""}
                    </span>
                    <svg
                      className={`${branchClass}-profile-arrow ${showProfileMenu ? "open" : ""}`}
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
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
                    <div
                      className={`${branchClass}-profile-dropdown`}
                      role="menu"
                      aria-label="User menu"
                      style={{
                        width: buttonWidth || "auto",
                        minWidth: "auto",
                        maxWidth: "none",
                      }}
                    >
                      <div
                        className={`${branchClass}-profile-dropdown-header`}
                        role="none"
                      >
                        <div
                          className={`${branchClass}-profile-dropdown-avatar`}
                          aria-hidden="true"
                        >
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <div
                          className={`${branchClass}-profile-dropdown-info`}
                          role="none"
                        >
                          <div
                            className={`${branchClass}-profile-dropdown-name`}
                          >
                            {user.firstName || ""} {user.lastName || ""}
                          </div>
                          <div
                            className={`${branchClass}-profile-dropdown-email`}
                          >
                            {user.email || ""}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`${branchClass}-profile-dropdown-divider`}
                        role="separator"
                        aria-hidden="true"
                      ></div>
                      <button
                        className={`${branchClass}-profile-dropdown-item`}
                        onClick={() => {
                          closeProfileMenu();
                          navigate("/profile");
                        }}
                        role="menuitem"
                        tabIndex={0}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
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
                        role="menuitem"
                        tabIndex={0}
                        disabled={isLoading}
                        aria-label={isLoading ? "Logging out..." : "Logout"}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {isLoading ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLoginClick}
                  className={`${branchClass}-nav-login`}
                  aria-label="Login to your account"
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
