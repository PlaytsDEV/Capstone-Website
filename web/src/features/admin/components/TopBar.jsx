import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, Clock, Menu, Sparkles, Search } from "lucide-react";
import NotificationBell from "../../../shared/components/NotificationBell";
import AdminCopilotDrawer from "./copilot/AdminCopilotDrawer";
import ProfileAvatar, { getProfileInitials } from "../../../shared/components/ProfileAvatar";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useTheme } from "../../public/context/ThemeContext";
import { formatDisplayName } from "../../../shared/utils/formatDate";

export default function TopBar({
  darkMode,
  onToggleDarkMode,
  breadcrumbs,
  onOpenSidebar,
  onOpenCommandPalette,
}) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [showCopilot, setShowCopilot] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const resolvedDarkMode = darkMode ?? theme === "dark";
  const handleToggleDarkMode = onToggleDarkMode ?? toggleTheme;

  const displayName = useMemo(() => {
    if (!user) return "Admin User";
    const raw = (
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.name ||
      user.fullName ||
      user.username ||
      "Admin User"
    );
    return formatDisplayName(raw);
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
      className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-5 backdrop-blur-xl md:px-7"
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
        {/* Quick Command Palette Launcher */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          style={{
            backgroundColor: "var(--bg-hover)",
            borderColor: "var(--border-light)",
          }}
          title="Open Command Palette (Ctrl+K)"
          aria-label="Open Command Palette"
        >
          <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="hidden md:inline">Quick Search...</span>
          <kbd className="inline-flex items-center justify-center rounded border border-[var(--border-light)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] leading-none shadow-xs">
            Ctrl K
          </kbd>
        </button>

        <div
          className="flex items-center gap-2 rounded-xl border px-2 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-xs"
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
          title="Open Assistant"
          aria-label="Open Assistant"
        >
          <Sparkles className="h-5 w-5 text-amber-500 dark:text-amber-400" />
        </button>

        <div className="shrink-0">
          <NotificationBell />
        </div>

        {/* User Identity Chip */}
        <div
          className="flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 sm:px-3"
          style={{
            backgroundColor: "var(--bg-hover)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="shrink-0">
            <ProfileAvatar user={user} initials={initials} size={32} />
          </div>
          <div className="hidden min-w-0 text-left md:block">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)] capitalize">
              {displayName}
            </div>
            <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
          </div>
        </div>
      </div>
      <AdminCopilotDrawer isOpen={showCopilot} onClose={() => setShowCopilot(false)} />
    </header>
  );
}
