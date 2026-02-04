import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../shared/hooks/useAuth";
import LilycrestLogo from "../../../shared/components/LilycrestLogo";
import {
  showNotification,
  showConfirmation,
} from "../../../shared/utils/notification";

function Navbar({ type = "landing", currentPage = "home" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isAuthenticated, logout, globalLoading } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  const profileMenuRef = useRef(null);
  const profileButtonRef = useRef(null);
  const logoutCalledRef = useRef(false);

  /* ============================
     Helpers
  ============================ */

  const getInitials = useCallback((userData) => {
    if (!userData) return "";

    if (userData.firstName || userData.lastName) {
      return `${userData.firstName?.[0] || ""}${userData.lastName?.[0] || ""}`.toUpperCase();
    }

    if (userData.displayName) {
      const parts = userData.displayName.split(" ");
      return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
    }

    return userData.email?.[0]?.toUpperCase() || "";
  }, []);

  const getDisplayName = useCallback((userData) => {
    if (!userData) return "";
    if (userData.firstName || userData.lastName) {
      return `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
    }
    return userData.displayName || userData.email || "";
  }, []);

  /* ============================
     Logout
  ============================ */

  const handleLogout = useCallback(async () => {
    setShowProfileMenu(false);
    if (globalLoading || logoutCalledRef.current) return;

    const confirmed = await showConfirmation(
      "Are you sure you want to log out?",
      "Log Out",
      "Cancel"
    );

    if (!confirmed) return;

    logoutCalledRef.current = true;

    try {
      const result = await logout(user?.branch);
      if (result?.success) {
        showNotification("Logged out successfully", "success");
        window.location.href = result.branch || "/";
      }
    } catch (err) {
      showNotification("Logout failed. Please try again.", "error");
      logoutCalledRef.current = false;
    }
  }, [logout, globalLoading, user]);

  /* ============================
     Outside Click
  ============================ */

  useEffect(() => {
    if (!showProfileMenu) return;

    const handleClickOutside = (e) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target) &&
        !profileButtonRef.current?.contains(e.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  /* ============================
     Landing Scroll & Intersection Observer
  ============================ */

  // Use Intersection Observer to detect which section is in viewport on landing page
  useEffect(() => {
    if (type !== "landing" || location.pathname !== "/") return;

    const observerOptions = {
      root: null,
      rootMargin: "-50% 0px -50% 0px", // Trigger when section is in middle of viewport
      threshold: 0,
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Map section classes to nav link sections
          if (entry.target.classList.contains("landing-hero")) {
            setActiveSection("home");
          } else if (entry.target.classList.contains("landing-branches")) {
            setActiveSection("branches");
          } else if (entry.target.classList.contains("landing-about")) {
            setActiveSection("about");
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const heroSection = document.querySelector(".landing-hero");
    const branchesSection = document.querySelector(".landing-branches");
    const aboutSection = document.querySelector(".landing-about");

    if (heroSection) observer.observe(heroSection);
    if (branchesSection) observer.observe(branchesSection);
    if (aboutSection) observer.observe(aboutSection);

    return () => observer.disconnect();
  }, [type, location.pathname]);

  // Use Intersection Observer to detect which section is in viewport on branch pages
  useEffect(() => {
    if (type !== "branch") return;

    const isGilPuyat = currentPage?.includes("gil-puyat");
    const branchClass = isGilPuyat ? "gpuyat" : "guadalupe";

    // If on /rooms route, set Rooms & Rates as active
    if (location.pathname.includes("/rooms")) {
      setActiveSection("rooms");
      return;
    }

    // Otherwise use Intersection Observer for home and location sections
    const observerOptions = {
      root: null,
      rootMargin: "-50% 0px -50% 0px",
      threshold: 0,
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target.classList.contains(`${branchClass}-hero`)) {
            setActiveSection("home");
          } else if (entry.target.classList.contains(`${branchClass}-location`)) {
            setActiveSection("location");
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const heroSection = document.querySelector(`.${branchClass}-hero`);
    const locationSection = document.querySelector(`.${branchClass}-location`);

    if (heroSection) observer.observe(heroSection);
    if (locationSection) observer.observe(locationSection);

    return () => observer.disconnect();
  }, [type, currentPage, location.pathname]);

  const handleLandingScroll = (selector) => {
    if (location.pathname === "/") {
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: selector } });
    }
  };

  /* ============================
     LANDING NAV
  ============================ */

  if (type === "landing") {
    return (
      <nav className="landing-navbar">
        <div className="landing-container">
          <div className="landing-nav-content">
            <div className="landing-nav-logo">
              <NavLink to="/" className="landing-logo-link">
                <LilycrestLogo className="landing-logo-icon" aria-label="Lilycrest Logo" />
              </NavLink>
            </div>
            <div className="landing-nav-links">
              <button
                className={`landing-nav-link ${activeSection === "home" ? "active" : ""}`}
                onClick={() => handleLandingScroll(".landing-hero")}
                type="button"
              >
                Home
              </button>
              <button
                className={`landing-nav-link ${activeSection === "branches" ? "active" : ""}`}
                onClick={() => handleLandingScroll(".landing-branches")}
                type="button"
              >
                Branches
              </button>
              <button
                className={`landing-nav-link ${activeSection === "about" ? "active" : ""}`}
                onClick={() => handleLandingScroll(".landing-about")}
                type="button"
              >
                About
              </button>
              <NavLink to="/faqs" className="landing-nav-link">
                FAQs
              </NavLink>
            </div>
            <div className="landing-nav-auth">
              {isAuthenticated && user ? (
                <div
                  className="landing-nav-profile"
                  ref={profileMenuRef}
                >
                  <button
                    ref={profileButtonRef}
                    className="landing-profile-button"
                    onClick={() => setShowProfileMenu((v) => !v)}
                    aria-expanded={showProfileMenu}
                  >
                    <div className="landing-profile-avatar">
                      {getInitials(user)}
                    </div>
                    <span className="landing-profile-name">
                      {getDisplayName(user)}
                    </span>
                  </button>

                  {showProfileMenu && (
                    <div className="landing-profile-dropdown">
                      <button
                        className="landing-profile-dropdown-item"
                        onClick={() => navigate("/profile")}
                      >
                        My Profile
                      </button>
                      <button
                        className="landing-profile-dropdown-item logout"
                        onClick={handleLogout}
                        disabled={globalLoading}
                      >
                        {globalLoading ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate("/tenant/signin")}
                  className="landing-nav-login"
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

  /* ============================
     BRANCH NAV
  ============================ */

  if (type === "branch") {
    const isGilPuyat = currentPage?.includes("gil-puyat");
    const branchClass = isGilPuyat ? "gpuyat" : "guadalupe";
    const branchHome = isGilPuyat ? "/gil-puyat" : "/guadalupe";

    const handleHomeClick = () => {
      const heroElement = document.querySelector(`.${branchClass}-hero`);
      if (heroElement) {
        // We're on a branch page with the hero section
        heroElement.scrollIntoView({ behavior: "smooth" });
      } else {
        // We're on a details page or other page, navigate to branch home
        navigate(branchHome);
      }
    };

    const handleLocationClick = () => {
      const locationElement = document.querySelector(`.${branchClass}-location`);
      if (locationElement) {
        // We're on the branch home page, scroll to location section
        locationElement.scrollIntoView({ behavior: "smooth" });
      } else {
        // We're on rooms page or other pages, navigate to branch home with state
        navigate(branchHome, { state: { scrollToLocation: true } });
      }
    };

    return (
      <nav className={`${branchClass}-navbar`}>
        <div className={`${branchClass}-container`}>
          <div className={`${branchClass}-nav-content`}>
            <div className={`${branchClass}-nav-logo`}>
              <NavLink to="/" className={`${branchClass}-logo-link`}>
                <LilycrestLogo className={`${branchClass}-logo-icon`} aria-label="Lilycrest Logo" />
              </NavLink>
            </div>
            <div className={`${branchClass}-nav-links`}>
              <button
                className={`${branchClass}-nav-link ${activeSection === "home" ? "active" : ""}`}
                onClick={handleHomeClick}
                type="button"
              >
                Home
              </button>
              <button
                className={`${branchClass}-nav-link ${activeSection === "location" ? "active" : ""}`}
                onClick={handleLocationClick}
              >
                Location
              </button>
              <NavLink
                to={`${branchHome}/rooms`}
                className={`${branchClass}-nav-link ${activeSection === "rooms" ? "active" : ""}`}
              >
                Rooms & Rates
              </NavLink>
            </div>

            <div className={`${branchClass}-nav-auth`}>
              {isAuthenticated && user ? (
                <div
                  className={`${branchClass}-nav-profile`}
                  ref={profileMenuRef}
                >
                  <button
                    ref={profileButtonRef}
                    className={`${branchClass}-profile-button`}
                    onClick={() => setShowProfileMenu((v) => !v)}
                    aria-expanded={showProfileMenu}
                  >
                    <div className={`${branchClass}-profile-avatar`}>
                      {getInitials(user)}
                    </div>
                    <span className={`${branchClass}-profile-name`}>
                      {getDisplayName(user)}
                    </span>
                  </button>

                  {showProfileMenu && (
                    <div className={`${branchClass}-profile-dropdown`}>
                      <button
                        className={`${branchClass}-profile-dropdown-item`}
                        onClick={() => navigate("/profile")}
                      >
                        My Profile
                      </button>
                      <button
                        className={`${branchClass}-profile-dropdown-item logout`}
                        onClick={handleLogout}
                        disabled={globalLoading}
                      >
                        {globalLoading ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate("/tenant/signin")}
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
