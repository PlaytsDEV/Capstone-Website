import React from "react";
import { Navigate, Route } from "react-router-dom";
import ProtectedRoute from "../../shared/components/ProtectedRoute";
import { RouteShell } from "./RouteShell";
import {
  AdminLayout,
  AdminDashboardPage,
  ReservationsPage,
  RoomAvailabilityPage,
  TenantsWorkspacePage,
  AuditLogsPage,
  UserManagementPage,
  AdminBillingPage,
  AdminAnnouncementsPage,
  AdminChatPage,
  MaintenancePage,
  InquiriesPage,
  AnalyticsPage,
  AnalyticsDetailsPage,
  BranchManagementPage,
  RolePermissionsPage,
  SystemSettingsPage,
  AdminNotificationsPage,
  SystemBackupPage,
} from "../lazyPages";
import {
  ANALYTICS_DETAILS_PATH,
  LEGACY_ANALYTICS_REDIRECTS,
} from "../../features/admin/pages/analyticsNavigation.mjs";
import AdminLayoutSkeleton from "../../features/admin/components/AdminLayoutSkeleton";

export function AdminRoutes() {
  return (
    <Route
      path="/admin"
      element={
        <ProtectedRoute requiredRole="branch_admin">
          <RouteShell name="AdminLayout" fallback={<AdminLayoutSkeleton />}>
            <AdminLayout />
          </RouteShell>
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <RouteShell name="AdminDashboard" fallback={<AdminLayoutSkeleton />}>
            <AdminDashboardPage />
          </RouteShell>
        }
      />
      <Route
        path="reservations"
        element={
          <RouteShell name="Reservations" fallback={<AdminLayoutSkeleton />}>
            <ReservationsPage />
          </RouteShell>
        }
      />
      <Route
        path="room-availability"
        element={
          <RouteShell name="RoomAvailability" fallback={<AdminLayoutSkeleton />}>
            <RoomAvailabilityPage />
          </RouteShell>
        }
      />
      <Route
        path="tenants"
        element={
          <RouteShell name="Tenants" fallback={<AdminLayoutSkeleton />}>
            <TenantsWorkspacePage />
          </RouteShell>
        }
      />
      <Route
        path="audit-logs"
        element={
          <RouteShell name="AuditLogs" fallback={<AdminLayoutSkeleton />}>
            <AuditLogsPage />
          </RouteShell>
        }
      />
      <Route
        path="users"
        element={
          <RouteShell name="UserManagement" fallback={<AdminLayoutSkeleton />}>
            <UserManagementPage />
          </RouteShell>
        }
      />
      <Route
        path="billing"
        element={
          <RouteShell name="AdminBilling" fallback={<AdminLayoutSkeleton />}>
            <AdminBillingPage />
          </RouteShell>
        }
      />
      <Route
        path="announcements"
        element={
          <RouteShell name="AdminAnnouncements" fallback={<AdminLayoutSkeleton />}>
            <AdminAnnouncementsPage />
          </RouteShell>
        }
      />
      <Route
        path="chat"
        element={
          <RouteShell name="AdminChat" fallback={<AdminLayoutSkeleton />}>
            <AdminChatPage />
          </RouteShell>
        }
      />
      <Route
        path="maintenance"
        element={
          <RouteShell name="AdminMaintenance" fallback={<AdminLayoutSkeleton />}>
            <MaintenancePage />
          </RouteShell>
        }
      />
      <Route
        path="analytics"
        element={
          <RouteShell name="Analytics" fallback={<AdminLayoutSkeleton />}>
            <AnalyticsPage />
          </RouteShell>
        }
      />
      <Route
        path="analytics/details"
        element={
          <RouteShell name="AnalyticsDetails" fallback={<AdminLayoutSkeleton />}>
            <AnalyticsDetailsPage />
          </RouteShell>
        }
      />
      <Route
        path="inquiries"
        element={
          <RouteShell name="Inquiries" fallback={<AdminLayoutSkeleton />}>
            <InquiriesPage />
          </RouteShell>
        }
      />
      <Route
        path="notifications"
        element={
          <RouteShell name="AdminNotifications" fallback={<AdminLayoutSkeleton />}>
            <AdminNotificationsPage />
          </RouteShell>
        }
      />
      <Route
        path="reports/occupancy"
        element={<Navigate to={LEGACY_ANALYTICS_REDIRECTS.occupancy} replace />}
      />
      <Route
        path="reports/billing"
        element={<Navigate to={LEGACY_ANALYTICS_REDIRECTS.billing} replace />}
      />
      <Route
        path="reports/operations"
        element={<Navigate to={LEGACY_ANALYTICS_REDIRECTS.operations} replace />}
      />
      <Route
        path="room-configuration"
        element={<Navigate to="/admin/room-availability?tab=rooms" replace />}
      />
      <Route
        path="occupancy"
        element={
          <Navigate to="/admin/room-availability?tab=occupancy" replace />
        }
      />
      <Route
        path="digital-twin"
        element={
          <Navigate to="/admin/room-availability?tab=occupancy" replace />
        }
      />
      <Route
        path="financial"
        element={<Navigate to={LEGACY_ANALYTICS_REDIRECTS.financials} replace />}
      />
      <Route
        path="financials"
        element={<Navigate to={LEGACY_ANALYTICS_REDIRECTS.financials} replace />}
      />
      <Route
        path="analytics/reports"
        element={<Navigate to={ANALYTICS_DETAILS_PATH} replace />}
      />
      <Route
        path="branches"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="Branches" fallback={<AdminLayoutSkeleton />}>
              <BranchManagementPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="settings"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="Settings" fallback={<AdminLayoutSkeleton />}>
              <SystemSettingsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="roles"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="Roles" fallback={<AdminLayoutSkeleton />}>
              <RolePermissionsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="backups"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="SystemBackup" fallback={<AdminLayoutSkeleton />}>
              <SystemBackupPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
    </Route>
  );
}
