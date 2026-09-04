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

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;
  const isDark = resolvedTheme === "dark";

  const updateDOMTheme = (resolved) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
  };

  const applyThemeWithTransition = (newResolved) => {
    const root = document.documentElement;
    const currentTheme = root.getAttribute("data-theme");
    if (currentTheme === newResolved) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
      typeof document !== "undefined" &&
      typeof document.startViewTransition === "function" &&
      !prefersReducedMotion
    ) {
      document.startViewTransition(() => {
        updateDOMTheme(newResolved);
      });
    } else {
      updateDOMTheme(newResolved);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("lp-theme", theme);
    } catch {}

    const root = document.documentElement;
    if (!root.hasAttribute("data-theme")) {
      updateDOMTheme(resolvedTheme);
    } else {
      applyThemeWithTransition(resolvedTheme);
    }
  }, [theme, resolvedTheme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const currentResolved =
        prev === "system" ? (systemPrefersDark ? "dark" : "light") : prev;
      return currentResolved === "dark" ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, isDark, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "light",
      resolvedTheme: "light",
      isDark: false,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

