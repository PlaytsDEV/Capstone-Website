import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useSocketClient from "../hooks/useSocketClient";
import Sidebar from "../components/Sidebar";
import ApplicantTopBar from "../components/ApplicantTopBar";
import RouteTransitionBoundary from "../components/RouteTransitionBoundary";
import AccountBlockedBanner from "../components/AccountBlockedBanner";
import { useRouteFlash } from "../hooks/useRouteFlash";
import {
  TenantAssistantLauncher,
  TenantAssistantDrawer,
} from "../../features/tenant/components/assistant";
import "./TenantLayout.css";

const TenantLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  useSocketClient();
  useRouteFlash();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const content = children ?? <Outlet />;
  const contentRef = useRef(null);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="tenant-layout">
      <Sidebar
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        isCollapsed={sidebarCollapsed}
        toggleCollapse={toggleCollapse}
      />

      <div
        className={`tenant-layout-main ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <ApplicantTopBar onOpenSidebar={() => setSidebarOpen(true)} />
        <main ref={contentRef} className="tenant-content">
          {(user?.accountStatus === "suspended" ||
            user?.accountStatus === "banned") && (
            <AccountBlockedBanner accountStatus={user.accountStatus} />
          )}
          <RouteTransitionBoundary
            routeKey={location.pathname}
            className="tenant-route-transition"
          >
            {content}
          </RouteTransitionBoundary>
        </main>
      </div>

      {/* Lilycrest Resident AI Assistant & Live Support */}
      <TenantAssistantLauncher
        onClick={() => setIsAssistantOpen(true)}
        isOpen={isAssistantOpen}
        unreadCount={unreadSupportCount}
      />
      <TenantAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onUnreadCountChange={setUnreadSupportCount}
      />
    </div>
  );
};

export default TenantLayout;

