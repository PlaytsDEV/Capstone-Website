import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "lp-theme";

/**
 * Updates <html> attributes synchronously so CSS variables and dark-mode styles apply.
 */
function updateDOMTheme(resolved) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.toggle("dark", resolved === "dark");
  const landing = document.querySelector(".landing-page");
  if (landing) {
    landing.setAttribute("data-theme", resolved);
  }
}


/**
 * Supports three modes: "light" | "dark" | "system"
 * Ultra-smooth 60/120 FPS full-screen crossfade dissolve using View Transitions API + GPU compositing.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch {
      return "system";
    }
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const isInitialMount = useRef(true);

  // Listen to OS color scheme preference changes
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

  // Apply to DOM on initial mount or when OS scheme changes while in "system" mode
  useEffect(() => {
    if (isInitialMount.current) {
      updateDOMTheme(resolvedTheme);
      isInitialMount.current = false;
      return;
    }

    if (theme === "system") {
      updateDOMTheme(resolvedTheme);
    }
  }, [theme, resolvedTheme]);

  /**
   * Transitions to target theme with high-performance View Transitions API crossfade.
   */
  const changeThemeWithTransition = useCallback(
    (newThemeOrUpdater, _event) => {
      const nextTheme =
        typeof newThemeOrUpdater === "function"
          ? newThemeOrUpdater(theme)
          : newThemeOrUpdater;

      const nextResolved =
        nextTheme === "system"
          ? systemPrefersDark
            ? "dark"
            : "light"
          : nextTheme;

      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {}

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const canUseViewTransition =
        typeof document !== "undefined" &&
        typeof document.startViewTransition === "function" &&
        !prefersReducedMotion;

      if (!canUseViewTransition) {
        if (typeof document !== "undefined" && !prefersReducedMotion) {
          document.documentElement.classList.add("theme-transitioning");
          updateDOMTheme(nextResolved);
          setThemeState(nextTheme);
          window.setTimeout(() => {
            document.documentElement.classList.remove("theme-transitioning");
          }, 500);
        } else {
          updateDOMTheme(nextResolved);
          setThemeState(nextTheme);
        }
        return;
      }

      document.startViewTransition(() => {
        updateDOMTheme(nextResolved);
        setThemeState(nextTheme);
      });
    },
    [theme, systemPrefersDark]
  );

  const toggleTheme = useCallback(
    (event) => {
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
      changeThemeWithTransition(nextTheme, event);
    },
    [resolvedTheme, changeThemeWithTransition]
  );

  const setTheme = useCallback(
    (newTheme, event) => {
      changeThemeWithTransition(newTheme, event);
    },
    [changeThemeWithTransition]
  );

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, isDark, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
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

