import { Sun, Moon } from "lucide-react";
import { useRef, useCallback } from "react";
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
  const { theme, toggleTheme } = useTheme();
  const btnRef = useRef(null);
  const isDark = theme === "dark";

  const handleClick = useCallback(() => {
    // Trigger glow ring animation
    const btn = btnRef.current;
    if (btn) {
      btn.classList.remove("theme-toggle--glow");
      // Force reflow so re-adding the class restarts the animation
      void btn.offsetWidth;
      btn.classList.add("theme-toggle--glow");
    }
    toggleTheme();
  }, [toggleTheme]);

  /* ── Mobile variant: full-width row with label ── */
  if (variant === "mobile") {
    return (
      <button
        ref={btnRef}
        onClick={handleClick}
        className="theme-toggle-btn theme-toggle-mobile"
        aria-label="Toggle theme"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          padding: "10px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: "15px",
          fontWeight: "300",
        }}
      >
        <span className="theme-toggle-icon-wrapper" style={{ width: 20, height: 20 }}>
          <Sun
            className={`theme-toggle-icon ${isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
            style={{ width: 18, height: 18 }}
          />
          <Moon
            className={`theme-toggle-icon ${!isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
            style={{ width: 18, height: 18 }}
          />
        </span>
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </button>
    );
  }

  /* ── Desktop variants: hero & scrolled ── */
  const isHero = variant === "hero";

  const btnStyles = {
    position: "relative",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: isHero ? "rgba(255,255,255,0.1)" : "var(--lp-icon-bg)",
    border: isHero
      ? "1.5px solid rgba(255,255,255,0.2)"
      : "1px solid var(--lp-border)",
    color: isHero ? "white" : "var(--lp-text)",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    /* transition for hover, not for the glow (that's keyframed) */
    transition: "background-color 0.3s ease, border-color 0.3s ease",
  };

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      className="theme-toggle-btn hidden md:flex items-center justify-center"
      aria-label="Toggle theme"
      style={btnStyles}
      onMouseEnter={(e) => {
        if (isHero) {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
        } else {
          e.currentTarget.style.backgroundColor = "rgba(255, 140, 66, 0.15)";
          e.currentTarget.style.borderColor = "var(--lp-accent)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isHero
          ? "rgba(255,255,255,0.1)"
          : "var(--lp-icon-bg)";
        e.currentTarget.style.borderColor = isHero
          ? "rgba(255,255,255,0.2)"
          : "var(--lp-border)";
      }}
    >
      <span className="theme-toggle-icon-wrapper">
        {/* Sun — visible when dark (switch to light) */}
        <Sun
          className={`theme-toggle-icon ${isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
          style={{ width: 16, height: 16 }}
        />
        {/* Moon — visible when light (switch to dark) */}
        <Moon
          className={`theme-toggle-icon ${!isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive"}`}
          style={{ width: 16, height: 16 }}
        />
      </span>
    </button>
  );
}
