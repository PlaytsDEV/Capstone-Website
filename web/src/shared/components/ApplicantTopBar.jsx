import { useMemo } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import NotificationBell from "./NotificationBell";
import ProfileAvatar, { getProfileInitials } from "./ProfileAvatar";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../../features/public/context/ThemeContext";
import { formatDisplayName } from "../utils/formatDate";

export default function ApplicantTopBar({ onOpenSidebar }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const displayName = useMemo(() => {
    if (!user) return "User";
    const raw = (
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.name ||
      user.fullName ||
      user.username ||
      "User"
    );
    return formatDisplayName(raw);
  }, [user]);


  const roleLabel = useMemo(() => {
    return user?.role === "tenant" ? "Tenant" : "Applicant";
  }, [user]);

  const initials = useMemo(() => getProfileInitials(user, "U"), [user]);
  const isDark = theme === "dark";

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

        {/* Clean Portal Identifier (Desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Lilycrest Portal
          </span>
        </div>

        {/* Clean Mobile Brand */}
        <div className="min-w-0 md:hidden">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            Lilycrest
          </div>
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
            <div className="truncate text-sm font-semibold text-[var(--text-primary)] capitalize">
              {displayName}
            </div>
            <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
