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
  AdminContractsPage,
  AuditLogsPage,
  UserManagementPage,
  AdminBillingPage,
  AdminAnnouncementsPage,
  AdminChatPage,
  MaintenancePage,
  InquiriesPage,
  AnalyticsPage,
  AnalyticsDetailsPage,
  SurveyAnalyticsPage,
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
import RequirePermission from "../../shared/guards/RequirePermission";
import {
  AdminDashboardSkeleton,
  AdminTablePageSkeleton,
  AdminCardGridSkeleton,
  AdminFormPageSkeleton,
  AdminChatSkeleton,
} from "../../features/admin/components/AdminContentSkeletons";

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
          <RouteShell name="AdminDashboard" fallback={<AdminDashboardSkeleton />}>
            <AdminDashboardPage />
          </RouteShell>
        }
      />
      <Route
        path="reservations"
        element={
          <RouteShell name="Reservations" fallback={<AdminTablePageSkeleton />}>
            <ReservationsPage />
          </RouteShell>
        }
      />
      <Route
        path="room-availability"
        element={
          <RouteShell name="RoomAvailability" fallback={<AdminCardGridSkeleton />}>
            <RoomAvailabilityPage />
          </RouteShell>
        }
      />
      <Route
        path="tenants"
        element={
          <RouteShell name="Tenants" fallback={<AdminTablePageSkeleton />}>
            <TenantsWorkspacePage />
          </RouteShell>
        }
      />
      <Route
        path="contracts"
        element={
          <RequirePermission permission="manageTenants">
            <RouteShell name="Contracts" fallback={<AdminTablePageSkeleton />}>
              <AdminContractsPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="contracts/:contractId"
        element={
          <RequirePermission permission="manageTenants">
            <RouteShell name="ContractDetails" fallback={<AdminTablePageSkeleton />}>
              <AdminContractsPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="audit-logs"
        element={
          <RouteShell name="AuditLogs" fallback={<AdminTablePageSkeleton />}>
            <AuditLogsPage />
          </RouteShell>
        }
      />
      <Route
        path="users"
        element={
          <RouteShell name="UserManagement" fallback={<AdminTablePageSkeleton />}>
            <UserManagementPage />
          </RouteShell>
        }
      />
      <Route
        path="billing"
        element={
          <RouteShell name="AdminBilling" fallback={<AdminTablePageSkeleton />}>
            <AdminBillingPage />
          </RouteShell>
        }
      />
      <Route
        path="announcements"
        element={
          <RouteShell name="AdminAnnouncements" fallback={<AdminTablePageSkeleton />}>
            <AdminAnnouncementsPage />
          </RouteShell>
        }
      />
      <Route
        path="chat"
        element={
          <RouteShell name="AdminChat" fallback={<AdminChatSkeleton />}>
            <AdminChatPage />
          </RouteShell>
        }
      />
      <Route
        path="maintenance"
        element={
          <RouteShell name="AdminMaintenance" fallback={<AdminCardGridSkeleton />}>
            <MaintenancePage />
          </RouteShell>
        }
      />
      <Route
        path="analytics"
        element={
          <RouteShell name="Analytics" fallback={<AdminDashboardSkeleton />}>
            <AnalyticsPage />
          </RouteShell>
        }
      />
      <Route
        path="analytics/feedback-surveys"
        element={<Navigate to="/admin/analytics?tab=surveys" replace />}
      />
      <Route
        path="analytics/details"
        element={
          <RouteShell name="AnalyticsDetails" fallback={<AdminDashboardSkeleton />}>
            <AnalyticsDetailsPage />
          </RouteShell>
        }
      />
      <Route
        path="inquiries"
        element={
          <RouteShell name="Inquiries" fallback={<AdminTablePageSkeleton />}>
            <InquiriesPage />
          </RouteShell>
        }
      />
      <Route
        path="notifications"
        element={
          <RouteShell name="AdminNotifications" fallback={<AdminTablePageSkeleton />}>
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
        element={<Navigate to="/admin/room-availability" replace />}
      />
      <Route
        path="occupancy"
        element={
          <Navigate to="/admin/room-availability" replace />
        }
      />
      <Route
        path="digital-twin"
        element={
          <Navigate to="/admin/room-availability" replace />
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
            <RouteShell name="Branches" fallback={<AdminCardGridSkeleton />}>
              <BranchManagementPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="settings"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="Settings" fallback={<AdminFormPageSkeleton />}>
              <SystemSettingsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="roles"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="Roles" fallback={<AdminFormPageSkeleton />}>
              <RolePermissionsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="backups"
        element={
          <ProtectedRoute requiredRole="owner">
            <RouteShell name="SystemBackup" fallback={<AdminTablePageSkeleton />}>
              <SystemBackupPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
    </Route>
  );
}
