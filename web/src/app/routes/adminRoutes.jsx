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
import RequirePermission from "../../shared/guards/RequirePermission";
import GlobalLoading from "../../shared/components/GlobalLoading";
import {
  AdminDashboardSkeleton,
  AdminTablePageSkeleton,
  AdminRoomAvailabilitySkeleton,
  AdminMaintenanceSkeleton,
  AdminAnalyticsSkeleton,
  AdminFormPageSkeleton,
  AdminRolePermissionsSkeleton,
  AdminChatSkeleton,
  AdminBranchesSkeleton,
  AdminPoliciesSettingsSkeleton,
  AdminSystemBackupSkeleton,
} from "../../features/admin/components/AdminContentSkeletons";

export function AdminRoutes() {
  return (
    <Route
      path="/admin"
      element={
        <ProtectedRoute requiredRole="branch_admin" loadingFallback={<GlobalLoading />}>
          <RouteShell name="AdminLayout" fallback={<GlobalLoading />}>
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
          <RequirePermission permission="manageReservations">
            <RouteShell name="Reservations" fallback={<AdminTablePageSkeleton />}>
              <ReservationsPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="room-availability"
        element={
          <RequirePermission permission="manageRooms">
            <RouteShell name="RoomAvailability" fallback={<AdminRoomAvailabilitySkeleton />}>
              <RoomAvailabilityPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="tenants"
        element={
          <RequirePermission permission="manageTenants">
            <RouteShell name="Tenants" fallback={<AdminTablePageSkeleton />}>
              <TenantsWorkspacePage />
            </RouteShell>
          </RequirePermission>
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
            <RouteShell name="Contracts" fallback={<AdminTablePageSkeleton />}>
              <AdminContractsPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="audit-logs"
        element={
          <ProtectedRoute requiredRole="owner" loadingFallback={<AdminTablePageSkeleton />}>
            <RouteShell name="AuditLogs" fallback={<AdminTablePageSkeleton />}>
              <AuditLogsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="users"
        element={
          <RequirePermission permission="manageUsers">
            <RouteShell name="UserManagement" fallback={<AdminTablePageSkeleton />}>
              <UserManagementPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="billing"
        element={
          <RequirePermission permission="manageBilling">
            <RouteShell name="AdminBilling" fallback={<AdminTablePageSkeleton />}>
              <AdminBillingPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="announcements"
        element={
          <RequirePermission permission="manageAnnouncements">
            <RouteShell name="AdminAnnouncements" fallback={<AdminTablePageSkeleton />}>
              <AdminAnnouncementsPage />
            </RouteShell>
          </RequirePermission>
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
          <RequirePermission permission="manageMaintenance">
            <RouteShell name="AdminMaintenance" fallback={<AdminMaintenanceSkeleton />}>
              <MaintenancePage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="analytics"
        element={
          <RequirePermission permission="viewReports">
            <RouteShell name="Analytics" fallback={<AdminAnalyticsSkeleton />}>
              <AnalyticsPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="analytics/details"
        element={
          <RequirePermission permission="viewReports">
            <RouteShell name="AnalyticsDetails" fallback={<AdminAnalyticsSkeleton />}>
              <AnalyticsDetailsPage />
            </RouteShell>
          </RequirePermission>
        }
      />
      <Route
        path="inquiries"
        element={
          <RequirePermission permission="manageReservations">
            <RouteShell name="Inquiries" fallback={<AdminTablePageSkeleton />}>
              <InquiriesPage />
            </RouteShell>
          </RequirePermission>
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
          <ProtectedRoute requiredRole="owner" loadingFallback={<AdminBranchesSkeleton />}>
            <RouteShell name="Branches" fallback={<AdminBranchesSkeleton />}>
              <BranchManagementPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="settings"
        element={
          <ProtectedRoute requiredRole="owner" loadingFallback={<AdminPoliciesSettingsSkeleton />}>
            <RouteShell name="Settings" fallback={<AdminPoliciesSettingsSkeleton />}>
              <SystemSettingsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="roles"
        element={
          <ProtectedRoute requiredRole="owner" loadingFallback={<AdminRolePermissionsSkeleton />}>
            <RouteShell name="Roles" fallback={<AdminRolePermissionsSkeleton />}>
              <RolePermissionsPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="backups"
        element={
          <ProtectedRoute requiredRole="owner" loadingFallback={<AdminSystemBackupSkeleton />}>
            <RouteShell name="SystemBackup" fallback={<AdminSystemBackupSkeleton />}>
              <SystemBackupPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
    </Route>
  );
}
