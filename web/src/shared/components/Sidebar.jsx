import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  Bed,
  ChevronLeft,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Settings,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { useUnreadCount } from "../hooks/queries/useNotifications";
import useBodyScrollLock from "../hooks/useBodyScrollLock";
import { USER_ROLES } from "../utils/constants";
import ConfirmModal from "./ConfirmModal";
import { showNotification } from "../utils/notification";
import { buildSignOutSuccessFlash } from "../utils/authToasts";
import "./Sidebar.css";
import logo from "../../assets/images/LOGO.svg";

const MOBILE_BP = 768;

const buildNavSections = (isTenant) => [
  {
    label: "Main",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/applicant/profile",
        tab: "dashboard",
      },
    ],
  },
  ...(isTenant
    ? [
        {
          label: "Community",
          items: [
            {
              id: "announcements",
              label: "Announcements",
              icon: Megaphone,
              path: "/applicant/announcements",
            },
          ],
        },
      ]
    : []),
  {
    label: "My Stay",
    items: [
      {
        id: "reservation",
        label: "My Reservation",
        icon: Bed,
        path: "/applicant/profile",
        tab: "reservation",
      },
      ...(isTenant
        ? [
            {
              id: "contract",
              label: "My Contract",
              icon: FileText,
              path: "/applicant/contracts",
            },
            {
              id: "maintenance",
              label: "Maintenance",
              icon: Wrench,
              path: "/applicant/maintenance",
            },
          ]
        : []),
      {
        id: "history",
        label: "Activity & History",
        icon: History,
        path: "/applicant/profile",
        tab: "history",
      },
    ],
  },
  ...(isTenant
    ? [
        {
          label: "Billing & Payments",
          items: [
            {
              id: "billing",
              label: "My Bills",
              icon: CreditCard,
              path: "/applicant/billing",
            },
          ],
        },
      ]
    : []),
  {
    label: "Account",
    items: [
      {
        id: "personal",
        label: "My Profile",
        icon: User,
        path: "/applicant/profile",
        tab: "personal",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        path: "/applicant/profile",
        tab: "notifications",
      },
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        path: "/applicant/profile",
        tab: "settings",
      },
    ],
  },
];

export default function Sidebar({ isOpen, toggleSidebar, isCollapsed, toggleCollapse }) {
  const { user, logout } = useAuth();
  const appNavigate = useAppNavigation();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BP);

  const isTenant = user?.role === USER_ROLES.TENANT;
  const navSections = useMemo(() => buildNavSections(isTenant), [isTenant]);
  const { data: unreadData } = useUnreadCount();
  const sidebarUnreadCount = unreadData?.unreadCount ?? 0;

  const currentTab = location.state?.tab || "dashboard";
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";
  const email = user?.email || "";
  const initials = `${user?.firstName?.[0] || "U"}${user?.lastName?.[0] || ""}`.toUpperCase();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BP;
      setIsMobile(mobile);
      if (!mobile && isOpen) toggleSidebar();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, toggleSidebar]);

  useBodyScrollLock(isMobile && isOpen);

  const isItemActive = (item) => {
    if (item.path !== location.pathname) return false;
    if (item.path === "/applicant/profile" && item.tab) {
      return currentTab === item.tab;
    }
    return true;
  };

  const handleItemClick = (item) => {
    appNavigate(item.path, { state: item.tab ? { tab: item.tab } : undefined });
    if (isMobile && isOpen) toggleSidebar();
  };

  const handleLogout = () => {
    if (!isLoggingOut) setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    setIsLoggingOut(true);
    try {
      await logout();
      appNavigate("/signin", buildSignOutSuccessFlash());
    } catch (error) {
      console.error("Logout error:", error);
      showNotification("Logout failed. Please try again.", "error", 3000);
      setIsLoggingOut(false);
    }
  };

  const sidebarClasses = [
    "sidebar",
    isCollapsed && !isMobile ? "collapsed" : "",
    isMobile && isOpen ? "open" : "",
  ].filter(Boolean).join(" ");

  const renderSidebarContent = () => (
    <>
      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand">
          <div className="sidebar-brand-mark" style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden" }}>
            <img src={logo} alt="Lilycrest logo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>
          <span className="sidebar-brand-name">Lilycrest</span>
        </Link>

        {isMobile ? (
          <button type="button" className="sidebar-close" onClick={toggleSidebar} aria-label="Close menu">
            <X size={18} />
          </button>
        ) : (
          <button type="button" className="sidebar-collapse-toggle" onClick={toggleCollapse} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft size={14} style={{ transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.24s ease" }} />
          </button>
        )}
      </div>

      <button
        type="button"
        className="sidebar-identity"
        onClick={() => handleItemClick({ path: "/applicant/profile", tab: "personal" })}
        title="View My Profile"
        aria-label="View My Profile"
      >
        <div className="sidebar-avatar">
          {user?.profileImage ? (
            <img src={user.profileImage} alt="Profile" className="sidebar-avatar-img" />
          ) : (
            <span className="sidebar-avatar-initials">{initials}</span>
          )}
        </div>
        <div className="sidebar-identity-text">
          <p className="sidebar-identity-name">{fullName}</p>
          <p className="sidebar-identity-email">{email}</p>
        </div>
      </button>

      <div className="sidebar-cta-wrap">
        <button type="button" className="sidebar-cta" onClick={() => handleItemClick({ path: "/applicant/check-availability" })} title="Browse Rooms">
          <Search size={15} style={{ flexShrink: 0 }} />
          <span>Browse Rooms</span>
        </button>
      </div>

      <nav aria-label="Tenant navigation" className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label} className="sidebar-group">
            <p className="sidebar-group-label">{section.label}</p>
            <div className="sidebar-group-items">
              {section.items.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                const badge = item.id === "notifications" && sidebarUnreadCount > 0 ? sidebarUnreadCount : null;
                return (
                  <button key={item.id} type="button" onClick={() => handleItemClick(item)} title={isCollapsed && !isMobile ? item.label : undefined} className={`sidebar-nav-item${active ? " active" : ""}`}>
                    <Icon size={17} className="sidebar-nav-icon" />
                    <span className="sidebar-nav-label">{item.label}</span>
                    {badge && (
                      <span className="sidebar-badge" aria-label={`${badge} unread notifications`}>
                        <span className="sidebar-badge-text">{badge > 99 ? "99+" : badge}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={handleLogout} disabled={isLoggingOut} title="Sign Out">
          <LogOut size={17} />
          <span>{isLoggingOut ? "Signing out…" : "Sign Out"}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {isMobile && (
        <div className="sidebar-topbar">
          <button type="button" className="sidebar-topbar-menu" onClick={toggleSidebar} aria-label="Open menu"><Menu size={20} /></button>
          <Link to="/" className="sidebar-topbar-brand">
            <div className="sidebar-brand-mark" style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden" }}>
              <img src={logo} alt="Lilycrest logo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
            </div>
            <span>Lilycrest</span>
          </Link>
        </div>
      )}

      {isMobile && isOpen && <div className="sidebar-overlay" onClick={toggleSidebar} aria-hidden="true" />}

      <aside className={sidebarClasses}>{renderSidebarContent()}</aside>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        variant="danger"
        confirmText="Log Out"
        loading={isLoggingOut}
      />
    </>
  );
}
