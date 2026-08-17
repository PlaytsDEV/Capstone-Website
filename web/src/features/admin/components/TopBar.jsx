import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { User, LogOut, Moon, Sun, ChevronDown, ChevronRight, Clock, Menu, Sparkles } from "lucide-react";
import NotificationBell from "../../../shared/components/NotificationBell";
import AdminCopilotDrawer from "./copilot/AdminCopilotDrawer";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import ProfileAvatar, { getProfileInitials } from "../../../shared/components/ProfileAvatar";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useAppNavigation } from "../../../shared/hooks/useAppNavigation";
import { useTheme } from "../../public/context/ThemeContext";
import {
  AUTH_TOAST_DURATION,
  SIGN_OUT_SUCCESS_MESSAGE,
} from "../../../shared/utils/authToasts";
import { showNotification } from "../../../shared/utils/notification";

export default function TopBar({
  darkMode,
  onToggleDarkMode,
  breadcrumbs,
  onOpenSidebar,
}) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const appNavigate = useAppNavigation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [logoutInProgress, setLogoutInProgress] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const resolvedDarkMode = darkMode ?? theme === "dark";
  const handleToggleDarkMode = onToggleDarkMode ?? toggleTheme;

  const displayName = useMemo(() => {
    if (!user) return "Admin User";
    return (
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.username ||
      "Admin User"
    );
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "Administrator";
    if (user.role === "owner") return "Owner";
    if (user.role === "branch_admin") return "Branch Admin";
    return "Administrator";
  }, [user]);

  const initials = useMemo(() => getProfileInitials(user, "A"), [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowUserMenu(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    return undefined;
  }, [showUserMenu]);

  const formatDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  const handleLogoutClick = () => {
    if (logoutInProgress) return;
    setShowUserMenu(false);
    setShowLogoutConfirm(true);
  };

  const handleLogout = async () => {
    if (logoutInProgress) return;
    setLogoutInProgress(true);
    try {
      const result = await logout();
      if (result?.success) {
        showNotification(
          SIGN_OUT_SUCCESS_MESSAGE,
          "success",
          AUTH_TOAST_DURATION,
        );
        appNavigate("/signin", {
          replace: true,
        });
      }
    } catch (error) {
      console.error("Admin logout error:", error);
      showNotification("Sign out failed. Please try again.", "error");
    } finally {
      setLogoutInProgress(false);
      setShowLogoutConfirm(false);
      setShowUserMenu(false);
    }
  };

  const currentCrumbObj = breadcrumbs?.[breadcrumbs.length - 1];
  const currentCrumb =
    typeof currentCrumbObj === "string"
      ? currentCrumbObj
      : currentCrumbObj?.label || "Admin";
  const parentCrumbObj = breadcrumbs && breadcrumbs.length > 2 ? breadcrumbs[1] : null;
  const parentCrumbLabel =
    typeof parentCrumbObj === "string"
      ? parentCrumbObj
      : parentCrumbObj?.label || "Lilycrest admin";

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl md:px-6"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 items-center gap-2 overflow-hidden text-sm text-[var(--text-muted)] md:flex"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const label = typeof crumb === "string" ? crumb : crumb.label;
            const href = typeof crumb === "object" ? crumb.href : null;

            return (
              <div key={`${label}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 && <span className="text-[var(--text-muted)]/70 select-none">/</span>}
                {href && !isLast ? (
                  <Link
                    to={href}
                    className="min-w-0 truncate text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    className={`min-w-0 truncate ${isLast ? "font-semibold text-[var(--text-primary)]" : ""}`}
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="min-w-0 md:hidden">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {currentCrumb}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{parentCrumbLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 rounded-xl border px-2 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-xs"
          style={{
            backgroundColor: "var(--bg-hover)",
            borderColor: "var(--border-light)",
          }}
        >
          <Clock className="h-4 w-4 text-[var(--text-muted)]" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-xs text-[var(--text-primary)]">{formatDate(currentDateTime)}</span>
            <span className="text-xs text-[var(--text-muted)]">{formatTime(currentDateTime)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleDarkMode}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-primary)" }}
        >
          {resolvedDarkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={() => setShowCopilot(true)}
          className="flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[var(--primary)] dark:text-slate-400 dark:hover:bg-slate-800 shrink-0 relative"
          title="Open Copilot"
        >
          <Sparkles className="h-5 w-5" />
        </button>

        <div className="shrink-0">
          <NotificationBell />
        </div>

        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setShowUserMenu((previous) => !previous)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-all duration-200 sm:px-3 ${
              showUserMenu
                ? "border-[var(--color-accent)] bg-[var(--bg-hover)] shadow-sm"
                : "border-transparent hover:border-[var(--border-light)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <div className="transition-transform duration-200 group-hover:scale-105">
              <ProfileAvatar user={user} initials={initials} size={32} />
            </div>
            <div className="hidden min-w-0 text-left md:block">
              <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {displayName}
              </div>
              <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
            </div>
            <ChevronDown
              className={`hidden h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 md:block ${
                showUserMenu ? "rotate-180 text-[var(--text-primary)]" : ""
              }`}
            />
          </button>

          {showUserMenu ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-2xl border shadow-xl transition-all duration-200"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-light)",
                  boxShadow: "var(--shadow-xl)",
                  animation: "fadeIn 0.18s ease-out",
                }}
              >
                {/* User Identity Header */}
                <div
                  className="border-b px-4 py-3"
                  style={{
                    backgroundColor: "var(--bg-muted)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {displayName}
                  </div>
                  <div className="text-xs font-medium text-[var(--text-muted)] mt-0.5">
                    {roleLabel}
                  </div>
                </div>

                {/* Sign Out Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogoutClick}
                  disabled={logoutInProgress}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ color: "var(--status-error)" }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 group-hover:scale-105 group-hover:bg-red-600 group-hover:text-white"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--status-error) 12%, transparent)",
                      color: "var(--status-error)",
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </div>
                  <span className="flex-1 font-semibold text-red-600 dark:text-red-400">
                    {logoutInProgress ? "Signing out..." : "Sign Out"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => {
          if (!logoutInProgress) setShowLogoutConfirm(false);
        }}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        variant="danger"
        confirmText="Sign Out"
        cancelText="Cancel"
        loading={logoutInProgress}
      />
      <AdminCopilotDrawer isOpen={showCopilot} onClose={() => setShowCopilot(false)} />
    </header>
  );
}
