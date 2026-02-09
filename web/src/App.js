import React from "react";
import "./App.css";
import { Routes, Route, useLocation } from "react-router-dom";

import ScrollToTop from "./shared/components/ScrollToTop";
import { FirebaseAuthProvider } from "./shared/hooks/FirebaseAuthContext";
import { AuthProvider, useAuth } from "./shared/hooks/useAuth";
import GlobalLoading from "./shared/components/GlobalLoading";
import { useEffect } from "react";

// Public Pages
import LandingPage from "./features/public/pages/LandingPage";

// Admin Pages
import AdminLoginPage from "./features/admin/pages/AdminLoginPage";
import AdminDashboardPage from "./features/admin/pages/Dashboard";
import InquiriesPage from "./features/admin/pages/InquiriesPage";
import ReservationsPage from "./features/admin/pages/ReservationsPage";
import RoomAvailabilityPage from "./features/admin/pages/RoomAvailabilityPage";
import RoomConfigurationPage from "./features/admin/pages/RoomConfigurationPage";
import OccupancyTrackingPage from "./features/admin/pages/OccupancyTrackingPage";
import TenantsPage from "./features/admin/pages/TenantsPage";
import AuditLogsPage from "./features/admin/pages/AuditLogsPage";
import UserManagementPage from "./features/admin/pages/UserManagementPage";

// Guards
import RequireAdmin from "./shared/guards/RequireAdmin";
import RequireNonAdmin from "./shared/guards/RequireNonAdmin";
import ProtectedRoute from "./shared/components/ProtectedRoute";

// Tenant Pages
import SignIn from "./features/tenant/pages/SignIn.jsx";
import SignUp from "./features/public/pages/SignUp.jsx";
import ForgotPassword from "./features/tenant/pages/ForgotPassword.jsx";
import DashboardPage from "./features/tenant/pages/DashboardPage";
import CheckAvailabilityPage from "./features/tenant/pages/CheckAvailabilityPage";
import ReservationFlowPage from "./features/tenant/pages/ReservationFlowPage";
import ProfilePage from "./features/tenant/pages/ProfilePage";
import BillingPage from "./features/tenant/pages/BillingPage";
import MaintenancePage from "./features/tenant/pages/MaintenancePage";
import AnnouncementsPage from "./features/tenant/pages/AnnouncementsPage";
import SettingsPage from "./features/tenant/pages/SettingsPage";
import ContractsPage from "./features/tenant/pages/ContractsPage";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "24px", fontFamily: "Arial" }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
/**
 * Inner App component that uses auth context
 * Must be rendered inside AuthProvider to access useAuth hook
 */
function AppContent() {
  const { globalLoading, setGlobalLoading } = useAuth();
  const location = useLocation();

  // Stop global loader after navigation
  useEffect(() => {
    if (!globalLoading) return;

    const timer = setTimeout(() => {
      setGlobalLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname, globalLoading, setGlobalLoading]);
  return (
    <>
      <ScrollToTop />
      {/* Global loading overlay for auth operations */}
      {globalLoading && <GlobalLoading />}
      <ErrorBoundary>
        <Routes>
          {/* Public Page */}
          <Route
            path="/"
            element={
              <RequireNonAdmin>
                <LandingPage />
              </RequireNonAdmin>
            }
          />

          {/* Admin routes - all require admin auth */}
          <Route
            path="/admin/dashboard"
            element={
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/inquiries"
            element={
              <RequireAdmin>
                <InquiriesPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/reservations"
            element={
              <RequireAdmin>
                <ReservationsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/room-availability"
            element={
              <RequireAdmin>
                <RoomAvailabilityPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/room-configuration"
            element={
              <RequireAdmin>
                <RoomConfigurationPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/occupancy-tracking"
            element={
              <RequireAdmin>
                <OccupancyTrackingPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/tenants"
            element={
              <RequireAdmin>
                <TenantsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <RequireAdmin>
                <AuditLogsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <UserManagementPage />
              </RequireAdmin>
            }
          />

          {/* Tenant Page */}
          <Route
            path="/signin"
            element={
              <RequireNonAdmin>
                <SignIn />
              </RequireNonAdmin>
            }
          />
          <Route
            path="/signup"
            element={
              <RequireNonAdmin>
                <SignUp />
              </RequireNonAdmin>
            }
          />
          <Route
            path="/tenant/forgot-password"
            element={
              <RequireNonAdmin>
                <ForgotPassword />
              </RequireNonAdmin>
            }
          />
          <Route
            path="/check-availability"
            element={
              <ProtectedRoute requiredRole="user">
                <CheckAvailabilityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/check-availability"
            element={
              <ProtectedRoute requiredRole="user">
                <CheckAvailabilityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/reservation-flow"
            element={
              <ProtectedRoute requiredRole="user">
                <ReservationFlowPage />
              </ProtectedRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute requiredRole="user">
                <ProfilePage />
              </ProtectedRoute>
            }
            path="/tenant/profile"
          />
          <Route
            path="/tenant/dashboard"
            element={
              <ProtectedRoute requiredRole="user">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/billing"
            element={
              <ProtectedRoute requiredRole="user">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/maintenance"
            element={
              <ProtectedRoute requiredRole="user">
                <MaintenancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/announcements"
            element={
              <ProtectedRoute requiredRole="user">
                <AnnouncementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/settings"
            element={
              <ProtectedRoute requiredRole="user">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/reservation"
            element={
              <ProtectedRoute requiredRole="user">
                <ReservationFlowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/contracts"
            element={
              <ProtectedRoute requiredRole="user">
                <ContractsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ErrorBoundary>
    </>
  );
}

/**
 * Root App component
 * Wraps AppContent with auth providers so useAuth hook works correctly
 */
function App() {
  return (
    <FirebaseAuthProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </FirebaseAuthProvider>
  );
}

export default App;
