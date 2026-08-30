import { Menu, User, X } from "lucide-react";
import { RippleButton } from "../../../registry/magicui/ripple-button";
import { useState, useEffect } from "react";
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
        className="max-w-screen-2xl mx-auto px-8 lg:px-12"
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
              <ThemeToggleButton variant={isScrolled ? "scrolled" : "hero"} />
            )}
          </div>

          {/* Desktop Nav Links — absolutely centered */}
          <div
            className="hidden md:flex items-center gap-2"
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

          {/* Right Side: Sign In + Book Now + Mobile hamburger */}
          <div className="flex items-center gap-3 ml-auto">
            {!loading && (
              <>
                {isAuthenticated ? (
                  <Link
                    to={profileUrl}
                    className="hidden md:flex items-center justify-center no-underline cursor-pointer"
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
                    className="hidden md:inline-flex items-center justify-center no-underline cursor-pointer"
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
              className="hidden md:inline-flex items-center justify-center rounded-full no-underline cursor-pointer"
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
              className="md:hidden bg-transparent border-none cursor-pointer inline-flex items-center justify-center p-2 rounded-lg"
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

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div
            className="md:hidden mt-4 backdrop-blur-lg rounded-2xl p-6"
            style={{
              backgroundColor: isScrolled
                ? "var(--lp-bg-card)"
                : (isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.92)"),
              border: isScrolled
                ? "1px solid var(--lp-border)"
                : (isDark ? "none" : "1px solid rgba(10,22,40,0.12)"),
              paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Nav links with stagger animation */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {navLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block font-light transition-colors no-underline cursor-pointer"
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleNavClick(e, link.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    minHeight: "48px",
                    padding: "14px 12px",
                    color: activeSection === link.id
                      ? "var(--lp-accent-text)"
                      : (isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)")),
                    fontWeight: activeSection === link.id ? "500" : "300",
                    animation: `navFadeIn 0.3s ease forwards`,
                    animationDelay: `${index * 60}ms`,
                    opacity: 0,
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Mobile Theme Toggle & Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                animation: `navFadeIn 0.3s ease forwards`,
                animationDelay: `${navLinks.length * 50}ms`,
                opacity: 0,
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  color: isScrolled ? "var(--lp-text)" : (isDark ? "rgba(255,255,255,0.8)" : "var(--lp-navy)"),
                  fontWeight: "400",
                }}
              >
                Appearance
              </span>
              <ThemeToggleButton variant={isScrolled ? "scrolled" : "hero"} />
            </div>

            {/* Divider */}
            <div
              style={{
                height: "1px",
                backgroundColor: isScrolled ? "var(--lp-border)" : "rgba(255,255,255,0.15)",
                margin: "8px 0 12px 0",
              }}
            />

            {/* Action buttons — side by side */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                animation: "navFadeIn 0.3s ease forwards",
                animationDelay: `${navLinks.length * 60}ms`,
                opacity: 0,
              }}
            >
              {!loading &&
                (isAuthenticated ? (
                  <Link
                    to={profileUrl}
                    className="no-underline capitalize"
                    onClick={() => setIsMenuOpen(false)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minHeight: "48px",
                      padding: "12px 16px",
                      color: isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)"),
                      fontWeight: "500",
                      fontSize: "15px",
                      borderRadius: "12px",
                      border: ghostBorderRest,
                      textAlign: "center",
                    }}
                  >
                    <User className="w-4 h-4" />
                    {displayName}
                  </Link>
                ) : (
                  <Link
                    to="/signin"
                    className="no-underline"
                    onClick={() => setIsMenuOpen(false)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "48px",
                      padding: "12px 16px",
                      color: isScrolled ? "var(--lp-text)" : (isDark ? "white" : "var(--lp-navy)"),
                      fontSize: "15px",
                      fontWeight: "500",
                      borderRadius: "12px",
                      border: ghostBorderRest,
                      backgroundColor: "transparent",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Sign In
                  </Link>
                ))}
              <Link
                to="/applicant/check-availability"
                className="no-underline text-center cursor-pointer transition-all"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "48px",
                  padding: "12px 16px",
                  color: "white",
                  backgroundColor: "var(--lp-accent)",
                  fontWeight: "500",
                  fontSize: "15px",
                  borderRadius: "9999px",
                }}
              >
                Book Now
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe for stagger fade-in */}
      <style>{`
        @keyframes navFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </nav>
  );
}

export default Navigation;
