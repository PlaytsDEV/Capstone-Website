import React from "react";

/**
 * Helper to wrap dynamic import calls in React.lazy with automatic retry
 * and session-guarded page reload on module resolution/fetch failure.
 *
 * @param {Function} importFn - Dynamic import function, e.g. () => import('./SomePage')
 * @returns {React.LazyExoticComponent} Lazy loaded component with resilience logic
 */
const lazyWithRetry = (importFn) =>
  React.lazy(async () => {
    const pageKey = `module_retry_${window.location.pathname}`;
    try {
      const component = await importFn();
      sessionStorage.removeItem(pageKey);
      return component;
    } catch (error) {
      console.warn("[lazyWithRetry] Dynamic import failed:", error);
      const isAlreadyRetried = sessionStorage.getItem(pageKey);
      if (!isAlreadyRetried) {
        sessionStorage.setItem(pageKey, "true");
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(pageKey);
      throw error;
    }
  });

export const LandingPage = lazyWithRetry(
  () => import("../features/public/pages/LandingPage"),
);
export const PrivacyPolicyPage = lazyWithRetry(
  () => import("../features/public/pages/PrivacyPolicyPage"),
);
export const TermsOfServicePage = lazyWithRetry(
  () => import("../features/public/pages/TermsOfServicePage"),
);
export const NotFoundPage = lazyWithRetry(
  () => import("../features/public/pages/NotFoundPage"),
);
export const SignUp = lazyWithRetry(
  () => import("../features/public/pages/SignUp.jsx"),
);
export const AuthAction = lazyWithRetry(
  () => import("../features/tenant/pages/AuthAction.jsx"),
);

export const SignIn = lazyWithRetry(
  () => import("../features/tenant/pages/SignIn.jsx"),
);
export const ForgotPassword = lazyWithRetry(
  () => import("../features/tenant/pages/ForgotPassword.jsx"),
);
export const OtpVerify = lazyWithRetry(
  () => import("../features/tenant/pages/OtpVerify.jsx"),
);
export const ResetPassword = lazyWithRetry(
  () => import("../features/tenant/pages/ResetPassword.jsx"),
);
export const CheckAvailabilityPage = lazyWithRetry(
  () => import("../features/tenant/pages/CheckAvailabilityPage"),
);
export const ReservationFlowPage = lazyWithRetry(
  () => import("../features/tenant/pages/ReservationFlowPage"),
);
export const ProfilePage = lazyWithRetry(
  () => import("../features/tenant/pages/ProfilePage"),
);
export const ContractsPage = lazyWithRetry(
  () => import("../features/tenant/pages/ContractsPage"),
);
export const TenantBillingPage = lazyWithRetry(
  () => import("../features/tenant/pages/BillingPage"),
);
export const TenantMaintenancePage = lazyWithRetry(
  () => import("../features/tenant/pages/MaintenanceWorkspacePage"),
);
export const TenantAnnouncementsPage = lazyWithRetry(
  () => import("../features/tenant/pages/AnnouncementsPage"),
);
export const TenantSurveysPage = lazyWithRetry(
  () => import("../features/tenant/pages/SurveysPage.jsx"),
);

export const AdminLayout = lazyWithRetry(
  () => import("../features/admin/components/AdminLayout"),
);
export const AdminDashboardPage = lazyWithRetry(
  () => import("../features/admin/pages/Dashboard"),
);
export const ReservationsPage = lazyWithRetry(
  () => import("../features/admin/pages/ReservationsPage"),
);
export const RoomAvailabilityPage = lazyWithRetry(
  () => import("../features/admin/pages/RoomAvailabilityPage"),
);
export const TenantsWorkspacePage = lazyWithRetry(
  () => import("../features/admin/pages/TenantsWorkspacePage"),
);
export const AdminContractsPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminContractsPage"),
);
export const AuditLogsPage = lazyWithRetry(
  () => import("../features/admin/pages/AuditLogsPage"),
);
export const UserManagementPage = lazyWithRetry(
  () => import("../features/admin/pages/UserManagementPage"),
);
export const AdminBillingPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminBillingPage"),
);
export const AdminAnnouncementsPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminAnnouncementsPage"),
);
export const AdminChatPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminChatPage.jsx"),
);
export const InquiriesPage = lazyWithRetry(
  () => import("../features/admin/pages/InquiriesPage"),
);
export const MaintenancePage = lazyWithRetry(
  () => import("../features/admin/pages/AdminMaintenancePage.jsx"),
);
export const AnalyticsPage = lazyWithRetry(
  () => import("../features/admin/pages/AnalyticsPage.jsx"),
);
export const AnalyticsDetailsPage = lazyWithRetry(
  () => import("../features/admin/pages/AnalyticsDetailsPage.jsx"),
);
export const SurveyAnalyticsPage = lazyWithRetry(
  () => import("../features/admin/pages/SurveyAnalyticsPage.jsx"),
);
export const BranchManagementPage = lazyWithRetry(
  () => import("../features/super-admin/pages/BranchManagementPage"),
);
export const RolePermissionsPage = lazyWithRetry(
  () => import("../features/super-admin/pages/RolePermissionsPage"),
);
export const SystemSettingsPage = lazyWithRetry(
  () => import("../features/super-admin/pages/SystemSettingsPage"),
);
export const AdminNotificationsPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminNotificationsPage"),
);
export const SystemBackupPage = lazyWithRetry(
  () => import("../features/admin/pages/SystemBackupPage"),
);
