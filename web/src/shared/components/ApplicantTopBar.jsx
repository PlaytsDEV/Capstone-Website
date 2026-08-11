import { useMemo } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ProfileAvatar, { getProfileInitials } from "./ProfileAvatar";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../../features/public/context/ThemeContext";
import { getApplicantPageMeta } from "./applicantShellMeta.mjs";

export default function ApplicantTopBar({ onOpenSidebar }) {
  const { user } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const pageMeta = getApplicantPageMeta(
    location.pathname,
    location.search,
    location.state,
  );
  const portalLabel = user?.role === "tenant" ? "Resident" : "Applicant";
  const breadcrumbs = user?.role === "tenant" ? [portalLabel, pageMeta.title] : [pageMeta.title];
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
  const isDark = theme === "dark";

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
            return (
              <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 && <span className="text-[var(--text-muted)]/70">/</span>}
                <span
                  className={`min-w-0 truncate ${
                    isLast ? "font-semibold text-[var(--text-primary)]" : ""
                  }`}
                >
                  {crumb}
                </span>
              </div>
            );
          })}
        </nav>

        <div className="min-w-0 md:hidden">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {currentCrumb}
          </div>
          <div className="text-xs text-[var(--text-muted)]">Lilycrest</div>
        </div>
      </div>

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

        <div
          className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 sm:px-3"
          aria-label={`${displayName}, ${roleLabel}`}
        >
          <ProfileAvatar user={user} initials={initials} size={32} />
          <div className="hidden min-w-0 text-left md:block">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {displayName}
            </div>
            <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
