import { Sun, Moon } from "lucide-react";
import { useState, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Animated theme toggle button with spin+fade icon swap and glow ring.
 *
 * @param {"hero" | "scrolled" | "mobile"} variant
 *   - hero:     white icon on transparent bg (over hero image)
 *   - scrolled: theme-aware colors (scrolled navbar)
 *   - mobile:   row item for the hamburger menu
 */
export default function ThemeToggleButton({ variant = "hero" }) {
  const { isDark, toggleTheme } = useTheme();
  const [isGlowing, setIsGlowing] = useState(false);

  const handleClick = useCallback(() => {
    setIsGlowing(false);
    requestAnimationFrame(() => {
      setIsGlowing(true);
    });
    toggleTheme();
  }, [toggleTheme]);

  const accessibleLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

  /* ── Mobile variant: full-width row with label ── */
  if (variant === "mobile") {
    return (
      <button
        onClick={handleClick}
        onAnimationEnd={() => setIsGlowing(false)}
        className={`theme-toggle-btn theme-toggle-mobile ${isGlowing ? "theme-toggle--glow" : ""}`}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          minHeight: "44px",
          padding: "12px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: "15px",
          fontWeight: "300",
        }}
      >
        <span className="theme-toggle-icon-wrapper" style={{ width: 22, height: 22 }}>
          <Sun
            className={`theme-toggle-icon ${isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
            style={{ width: 18, height: 18, color: "var(--lp-accent, #D4AF37)" }}
            strokeWidth={2}
          />
          <Moon
            className={`theme-toggle-icon ${!isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
            style={{ width: 18, height: 18, color: "var(--lp-navy, #0A1628)" }}
            strokeWidth={2}
          />
        </span>
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </button>
    );
  }

  /* ── Desktop variants: hero & scrolled ── */
  const isScrolled = variant === "scrolled";

  // Neutral ghost borders matching Sign In / profile buttons in Navbar
  const borderRest = isScrolled
    ? (isDark ? "1px solid rgba(255, 255, 255, 0.20)" : "1px solid rgba(15, 23, 42, 0.18)")
    : (isDark ? "1.5px solid rgba(255, 255, 255, 0.30)" : "1.5px solid rgba(10, 22, 40, 0.22)");

  const borderHover = isScrolled
    ? (isDark ? "1px solid rgba(255, 255, 255, 0.65)" : "1px solid var(--lp-navy)")
    : (isDark ? "1.5px solid rgba(255, 255, 255, 0.75)" : "1.5px solid var(--lp-navy)");

  // Deep Navy (#0A1628) in light mode matches Sign In typography (14:1+ AAA contrast), crisp white in dark mode
  const iconColorRest = isDark ? "#ffffff" : "var(--lp-navy, #0A1628)";
  const iconColorHover = isDark ? "#ffffff" : "var(--lp-navy, #0A1628)";

  const shadowHover = isDark
    ? "0 3px 10px rgba(0, 0, 0, 0.35)"
    : "0 2px 8px rgba(10, 22, 40, 0.08)";

  const btnStyles = {
    position: "relative",
    width: "38px",
    height: "38px",
    minWidth: "38px",
    minHeight: "38px",
    borderRadius: "50%",
    backgroundColor: "transparent",
    border: borderRest,
    color: iconColorRest,
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "none",
    transform: "translateY(0)",
  };

  return (
    <button
      onClick={handleClick}
      onAnimationEnd={() => setIsGlowing(false)}
      className={`theme-toggle-btn hidden lg:flex items-center justify-center ${isGlowing ? "theme-toggle--glow" : ""}`}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      style={btnStyles}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.border = borderHover;
        e.currentTarget.style.color = iconColorHover;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = shadowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.border = borderRest;
        e.currentTarget.style.color = iconColorRest;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span className="theme-toggle-icon-wrapper" style={{ width: 18, height: 18 }}>
        {/* Sun — visible when dark (switch to light) */}
        <Sun
          className={`theme-toggle-icon ${isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
          style={{ width: 18, height: 18 }}
          strokeWidth={2}
        />
        {/* Moon — visible when light (switch to dark) */}
        <Moon
          className={`theme-toggle-icon ${!isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
          style={{ width: 18, height: 18 }}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
