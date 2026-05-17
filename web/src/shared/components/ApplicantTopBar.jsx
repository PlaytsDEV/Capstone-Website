import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, Moon, Settings, Sun, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ConfirmModal from "./ConfirmModal";
import ProfileAvatar, { getProfileInitials } from "./ProfileAvatar";
import { useAuth } from "../hooks/useAuth";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { useTheme } from "../../features/public/context/ThemeContext";
import { showNotification } from "../utils/notification";
import {
  AUTH_TOAST_DURATION,
  SIGN_OUT_SUCCESS_MESSAGE,
} from "../utils/authToasts";
import { getApplicantPageMeta } from "./applicantShellMeta.mjs";

export default function ApplicantTopBar({ onOpenSidebar }) {
  const { user, logout } = useAuth();
  const appNavigate = useAppNavigation();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutInProgress, setLogoutInProgress] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const pageMeta = getApplicantPageMeta(
    location.pathname,
    location.search,
    location.state,
  );
  const breadcrumbs = ["Applicant", pageMeta.title];
  const currentCrumb = pageMeta.title;

  const displayName = useMemo(() => {
    if (!user) return "User";
    return (
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.username ||
      "User"
    );
  }, [user]);

  const roleLabel = useMemo(() => {
    if (user?.role === "tenant") return "Resident";
    return "Applicant";
  }, [user]);

  const initials = useMemo(() => getProfileInitials(user, "U"), [user]);

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
      if (event.key === "Escape") setShowUserMenu(false);
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
      if (result?.success !== false) {
        showNotification(SIGN_OUT_SUCCESS_MESSAGE, "success", AUTH_TOAST_DURATION);
        appNavigate("/signin", { replace: true });
      }
    } catch {
      showNotification("Sign out failed. Please try again.", "error");
    } finally {
      setLogoutInProgress(false);
      setShowLogoutConfirm(false);
      setShowUserMenu(false);
    }
  };

  const handleGoToPersonalDetails = () => {
    setShowUserMenu(false);
    appNavigate("/applicant/profile", { state: { tab: "personal" } });
  };

  const handleGoToSettings = () => {
    setShowUserMenu(false);
    appNavigate("/applicant/profile", { state: { tab: "settings" } });
  };

  const isDark = theme === "dark";

  return (
    <>
      <header
        className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl md:px-6"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-light)",
        }}
      >
        {/* Left: mobile menu + breadcrumb */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-2 overflow-hidden text-sm text-[var(--text-muted)] md:flex"
          >
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
                  {index > 0 && <span className="text-[var(--text-muted)]/70">/</span>}
                  <span
                    className={`min-w-0 truncate ${isLast ? "font-semibold text-[var(--text-primary)]" : ""}`}
                  >
                    {crumb}
                  </span>
                </div>
              );
            })}
          </nav>

          {/* Mobile page title */}
          <div className="min-w-0 md:hidden">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {currentCrumb}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Lilycrest</div>
          </div>
        </div>

        {/* Right: theme toggle + notification bell + profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-primary)" }}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="shrink-0">
            <NotificationBell />
          </div>

          <div className="relative">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setShowUserMenu((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:bg-[var(--bg-hover)] sm:px-3"
            >
              <ProfileAvatar user={user} initials={initials} size={32} />
              <div className="hidden min-w-0 text-left md:block">
                <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {displayName}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-[var(--text-muted)] md:block" />
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
                  className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border shadow-xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-light)",
                    boxShadow: "var(--shadow-xl)",
                  }}
                >
                  <div
                    className="border-b px-4 py-3"
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {displayName}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleGoToPersonalDetails}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] text-[var(--text-body)]"
                  >
                    <User className="h-4 w-4" />
                    Personal Details
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleGoToSettings}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] text-[var(--text-body)]"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>

                  <div
                    className="border-t"
                    style={{ borderColor: "var(--border-light)" }}
                  />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogoutClick}
                    disabled={logoutInProgress}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ color: "var(--status-error)" }}
                  >
                    <LogOut className="h-4 w-4" />
                    {logoutInProgress ? "Signing out..." : "Sign Out"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

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
    </>
  );
}
