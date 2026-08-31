import { Menu, User, X } from "lucide-react";
import { RippleButton } from "../../../registry/magicui/ripple-button";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import ThemeToggleButton from "./ThemeToggleButton";
import { useTheme } from "../context/ThemeContext";
import logo from "../../../assets/images/LOGO.svg";
import { formatDisplayName } from "../../../shared/utils/formatDate";
import { smoothScrollTo } from "../../../shared/utils/smoothScroll";


export function Navigation({ type } = {}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [hoveredSection, setHoveredSection] = useState(null);
  const { user, isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();

  const resolvedTheme =
    theme === "system"
      ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
  const isDark = resolvedTheme === "dark";

  // Scroll listener — compact navbar after 20px (rAF debounced to prevent forced reflow)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: highlight active nav link based on visible section
  useEffect(() => {
    const sectionIds = ["rooms", "facilities", "location", "inquiry"];
    const observers = [];

    const handleIntersect = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const observer = new IntersectionObserver(handleIntersect, {
          rootMargin: "-20% 0px -70% 0px",
          threshold: 0,
        });
        observer.observe(el);
        observers.push(observer);
      }
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, []);

  // Escape key handler to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  useBodyScrollLock(isMenuOpen);

  // Determine profile URL based on role
  const isAdmin = user?.role === "branch_admin" || user?.role === "owner";
  const profileUrl = isAdmin ? "/admin/dashboard" : "/applicant/profile";

  // Display name: first name, or email prefix
  const rawDisplayName =
    (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : null) ||
    user?.name ||
    user?.fullName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "User";
  const displayName = formatDisplayName(rawDisplayName);


  const navLinks = [
    { href: "#rooms", label: "Rooms", id: "rooms" },
    { href: "#facilities", label: "Facilities", id: "facilities" },
    { href: "#location", label: "Location", id: "location" },
    { href: "#inquiry", label: "Contact", id: "inquiry" },
  ];

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    smoothScrollTo(targetId, 80);
    setActiveSection(targetId);
  };

  const handleLogoClick = (e) => {
    if (type === "landing" || window.location.pathname === "/") {
      e.preventDefault();
      smoothScrollTo("top");
      setActiveSection("");
    }
  };

  // Colors adapt: transparent hero = always white text; scrolled = theme-aware
  const textColor = isScrolled ? "var(--lp-text)" : (isDark ? "rgba(255,255,255,0.9)" : "var(--lp-navy)");

  // Ghost button styles for Sign In (clean transparent ghost pill with crisp border & micro-lift on hover)
  const ghostBorderRest = isScrolled
    ? (isDark ? "1px solid rgba(255, 255, 255, 0.20)" : "1px solid rgba(15, 23, 42, 0.18)")
    : (isDark ? "1.5px solid rgba(255, 255, 255, 0.30)" : "1.5px solid rgba(10, 22, 40, 0.22)");

  const ghostBorderHover = isScrolled
    ? (isDark ? "1px solid rgba(255, 255, 255, 0.65)" : "1px solid var(--lp-navy)")
    : (isDark ? "1.5px solid rgba(255, 255, 255, 0.75)" : "1.5px solid var(--lp-navy)");

  const ghostBgHover = "transparent";

  const ghostTextHover = isDark ? "#ffffff" : "var(--lp-navy)";

  const ghostShadowHover = isDark
    ? "0 3px 10px rgba(0, 0, 0, 0.35)"
    : "0 2px 8px rgba(10, 22, 40, 0.08)";

  const ghostBtnStyle = {
    color: isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)"),
    fontSize: "14px",
    fontWeight: "500",
    padding: "8px 22px",
    borderRadius: "9999px",
    border: ghostBorderRest,
    backgroundColor: "transparent",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    textDecoration: "none",
    letterSpacing: "0.2px",
    boxShadow: "none",
    transform: "translateY(0)",
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: isScrolled
          ? "var(--lp-bg)"
          : "transparent",
        backdropFilter: isScrolled ? "blur(20px) saturate(1.2)" : "none",
        boxShadow: isScrolled
          ? "var(--lp-nav-shadow)"
          : "none",
        borderBottom: isScrolled
          ? "1px solid var(--lp-border)"
          : "1px solid transparent",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        className="max-w-screen-2xl mx-auto px-4 sm:px-8 lg:px-12"
        style={{
          paddingTop: isScrolled ? "18px" : "24px",
          paddingBottom: isScrolled ? "18px" : "24px",
          transition: "padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="relative flex items-center">
          {/* Logo + Theme Toggle (left side) */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              onClick={handleLogoClick}
              className="font-semibold tracking-wide no-underline inline-flex items-center gap-2 cursor-pointer"
              style={{
                color: isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)"),
                fontSize: isScrolled ? "18px" : "22px",
                transition: "all 0.4s ease",
                letterSpacing: "0.5px",
              }}
            >
              <img
                src={logo}
                alt="Lilycrest logo"
                style={{
                  width: isScrolled ? "24px" : "28px",
                  height: isScrolled ? "24px" : "28px",
                  transition: "all 0.4s ease",
                }}
              />
              Lilycrest
            </Link>
            {/* Theme Toggle — desktop only */}
            {type === "landing" && (
              <div className="hidden lg:flex items-center">
                <ThemeToggleButton variant={isScrolled ? "scrolled" : "hero"} />
              </div>
            )}
          </div>

          {/* Desktop Nav Links — absolutely centered on lg/xl with responsive gap */}
          <div
            className="hidden lg:flex items-center gap-1 xl:gap-2"
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              const isHovered = hoveredSection === link.id;
              const isHighlighted = isActive || isHovered;

              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.id)}
                  className="no-underline cursor-pointer"
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    color: isScrolled
                      ? "var(--lp-text)"
                      : (isDark ? "white" : "var(--lp-navy)"),
                    fontSize: "15px",
                    fontWeight: isHighlighted ? "500" : "400",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    position: "relative",
                    backgroundColor: "transparent",
                    transition: "color 0.2s ease, font-weight 0.2s ease",
                  }}
                  onMouseEnter={() => setHoveredSection(link.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  {link.label}
                  {/* Active & Hover indicator underline */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      bottom: "2px",
                      left: "50%",
                      transform: `translateX(-50%) scaleX(${isHighlighted ? 1 : 0})`,
                      width: "24px",
                      height: "2px",
                      backgroundColor: "var(--lp-accent)",
                      borderRadius: "2px",
                      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
                      transformOrigin: "center",
                      opacity: isHighlighted ? 1 : 0,
                    }}
                  />
                </a>
              );
            })}
          </div>

          {/* Right Side: Sign In + Book Now + Mobile/Tablet hamburger */}
          <div className="flex items-center gap-3 ml-auto">
            {!loading && (
              <>
                {isAuthenticated ? (
                  <Link
                    to={profileUrl}
                    className="hidden lg:flex items-center justify-center no-underline cursor-pointer"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      backgroundColor: "transparent",
                      border: ghostBorderRest,
                      color: isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)"),
                      fontSize: "14px",
                      fontWeight: "500",
                      letterSpacing: "0.3px",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: "none",
                      transform: "translateY(0)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = ghostBgHover;
                      e.currentTarget.style.border = ghostBorderHover;
                      e.currentTarget.style.color = ghostTextHover;
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = ghostShadowHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.border = ghostBorderRest;
                      e.currentTarget.style.color = isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)");
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Link>
                ) : (
                  /* Not logged in: ghost-button Sign In */
                  <Link
                    to="/signin"
                    className="hidden lg:inline-flex items-center justify-center no-underline cursor-pointer"
                    style={ghostBtnStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = ghostBgHover;
                      e.currentTarget.style.border = ghostBorderHover;
                      e.currentTarget.style.color = ghostTextHover;
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = ghostShadowHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.border = ghostBorderRest;
                      e.currentTarget.style.color = isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)");
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}
            <Link
              to="/applicant/check-availability"
              className="hidden lg:inline-flex items-center justify-center rounded-full no-underline cursor-pointer"
              style={{
                color: "white",
                backgroundColor: "var(--lp-accent)",
                fontSize: "15px",
                fontWeight: "500",
                padding: isScrolled ? "10px 28px" : "12px 34px",
                transition:
                  "all 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(212, 175, 55, 0.35)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Book Now
            </Link>
            <button
              className="lg:hidden bg-transparent border-none cursor-pointer min-w-[48px] min-h-[48px] flex items-center justify-center p-2 rounded-lg"
              style={{
                color: isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)"),
                minWidth: "48px",
                minHeight: "48px",
              }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </nav>

      {/* Mobile / Tablet Backdrop & Right Slide-Over Sheet via Portal directly on document.body */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop Overlay */}
            <div
              className={`lg:hidden fixed inset-0 transition-opacity duration-300 ${
                isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                zIndex: 99998,
              }}
              onClick={() => setIsMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-Over Drawer */}
            <div
              className="lg:hidden flex flex-col transition-transform duration-300 ease-out"
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                maxWidth: "340px",
                height: "100dvh",
                backgroundColor: isDark ? "var(--lp-bg-card, #111C31)" : "#ffffff",
                color: isDark ? "#F8FAFC" : "var(--lp-navy, #0A1628)",
                borderLeft: isDark
                  ? "1px solid var(--lp-border, #27334A)"
                  : "1px solid rgba(10,22,40,0.12)",
                boxShadow: isDark
                  ? "-8px 0 32px rgba(0, 0, 0, 0.6)"
                  : "-8px 0 32px rgba(10, 22, 40, 0.15)",
                transform: isMenuOpen ? "translateX(0)" : "translateX(100%)",
                padding: "24px",
                paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
                overflowY: "auto",
                zIndex: 99999,
              }}
              aria-hidden={!isMenuOpen}
            >
              {/* Drawer Header */}
              <div
                className="flex items-center justify-between pb-4 mb-2 flex-shrink-0"
                style={{
                  borderBottom: isDark
                    ? "1px solid var(--lp-border, #27334A)"
                    : "1px solid rgba(10,22,40,0.1)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <img src={logo} alt="Lilycrest logo" style={{ width: "26px", height: "26px" }} />
                  <span
                    className="font-semibold tracking-wide text-lg"
                    style={{ color: isDark ? "white" : "var(--lp-navy)" }}
                  >
                    Lilycrest
                  </span>
                </div>
                <button
                  className="bg-transparent border-none cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-full transition-colors"
                  style={{ color: isDark ? "white" : "var(--lp-navy)" }}
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <div className="flex flex-col gap-1 py-3 flex-1 overflow-y-auto">
                {navLinks.map((link) => {
                  const isActive = activeSection === link.id;
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      className="font-normal transition-colors no-underline cursor-pointer rounded-xl flex items-center px-4"
                      onClick={(e) => {
                        setIsMenuOpen(false);
                        handleNavClick(e, link.id);
                      }}
                      style={{
                        minHeight: "48px",
                        color: isActive
                          ? (isDark ? "var(--lp-accent, #D4AF37)" : "var(--lp-accent-text, #8C6200)")
                          : (isDark ? "#F8FAFC" : "var(--lp-navy, #0A1628)"),
                        backgroundColor: isActive
                          ? (isDark
                              ? "rgba(212, 175, 55, 0.14)"
                              : "rgba(212, 175, 55, 0.10)")
                          : "transparent",
                        fontWeight: isActive ? "600" : "400",
                        fontSize: "15px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>

              {/* Drawer Footer: Theme Switcher & Actions */}
              <div
                className="pt-4 flex flex-col gap-3 flex-shrink-0"
                style={{
                  borderTop: isDark
                    ? "1px solid var(--lp-border, #27334A)"
                    : "1px solid rgba(10,22,40,0.1)",
                }}
              >
                {type === "landing" && (
                  <div className="px-2">
                    <ThemeToggleButton variant="mobile" />
                  </div>
                )}

                {!loading && (
                  <div className="flex flex-col gap-2.5 pt-1">
                    {isAuthenticated ? (
                      <Link
                        to={profileUrl}
                        className="no-underline capitalize w-full flex items-center justify-center gap-2 rounded-xl transition-all"
                        onClick={() => setIsMenuOpen(false)}
                        style={{
                          minHeight: "48px",
                          padding: "12px 16px",
                          color: isDark ? "white" : "var(--lp-navy)",
                          fontWeight: "500",
                          fontSize: "15px",
                          border: ghostBorderRest,
                          backgroundColor: "transparent",
                        }}
                      >
                        <User className="w-4 h-4" />
                        {displayName}
                      </Link>
                    ) : (
                      <Link
                        to="/signin"
                        className="no-underline w-full flex items-center justify-center rounded-xl transition-all"
                        onClick={() => setIsMenuOpen(false)}
                        style={{
                          minHeight: "48px",
                          padding: "12px 16px",
                          color: isDark ? "white" : "var(--lp-navy)",
                          fontSize: "15px",
                          fontWeight: "500",
                          border: ghostBorderRest,
                          backgroundColor: "transparent",
                        }}
                      >
                        Sign In
                      </Link>
                    )}

                    <Link
                      to="/applicant/check-availability"
                      className="no-underline w-full flex items-center justify-center rounded-full text-center cursor-pointer transition-all"
                      onClick={() => setIsMenuOpen(false)}
                      style={{
                        minHeight: "48px",
                        padding: "12px 16px",
                        color: "white",
                        backgroundColor: "var(--lp-accent)",
                        fontWeight: "500",
                        fontSize: "15px",
                        boxShadow: "0 4px 16px rgba(212, 175, 55, 0.25)",
                      }}
                    >
                      Book Now
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export default Navigation;
