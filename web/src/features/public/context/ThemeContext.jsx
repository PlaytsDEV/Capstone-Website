import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

/**
 * Supports three modes: "light" | "dark" | "system"
 * Applies data-theme="light" or data-theme="dark" to <html> so CSS can react.
 * Uses View Transitions API (when available) + CSS transitions for ultra-smooth switching.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("lp-theme") || "system";
    } catch {
      return "system";
    }
  });

  // Resolve system preference
  const getResolved = (t) => {
    if (t !== "system") return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const applyThemeWithTransition = (newResolved) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", newResolved);
    root.classList.toggle("dark", newResolved === "dark");
  };

  useEffect(() => {
    // Persist
    try { localStorage.setItem("lp-theme", theme); } catch {}

    const resolved = getResolved(theme);
    const root = document.documentElement;

    // Initial sync without transition flicker on page load
    if (!root.hasAttribute("data-theme")) {
      root.setAttribute("data-theme", resolved);
      root.classList.toggle("dark", resolved === "dark");
    } else {
      applyThemeWithTransition(resolved);
    }

    // If system, watch for media changes while this mode is active
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e) => {
        const newResolved = e.matches ? "dark" : "light";
        applyThemeWithTransition(newResolved);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  // Kept for backward-compat; new code should use setTheme directly
  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: "light", setTheme: () => {}, toggleTheme: () => {} };
  return ctx;
}

