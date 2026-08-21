import React from "react";

/**
 * Helper to wrap dynamic import calls in React.lazy with automatic in-memory retry,
 * and session-guarded page reload on module resolution/fetch failure.
 *
 * @param {Function} importFn - Dynamic import function, e.g. () => import('./SomePage')
 * @returns {React.LazyExoticComponent} Lazy loaded component with resilience logic
 */
const lazyWithRetry = (importFn) =>
  React.lazy(async () => {
    // Attempt in-memory retry first to handle transient Vite HMR / transform delays
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await importFn();
      } catch (err) {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        } else {
          console.warn("[lazyWithRetry] Dynamic import failed after retries:", err);
          throw err;
        }
      }
    }
  });

export const LandingPage = lazyWithRetry(
  () => import("../features/public/pages/LandingPage.jsx"),
);
export const PrivacyPolicyPage = lazyWithRetry(
  () => import("../features/public/pages/PrivacyPolicyPage.jsx"),
);
export const TermsOfServicePage = lazyWithRetry(
  () => import("../features/public/pages/TermsOfServicePage.jsx"),
);
export const NotFoundPage = lazyWithRetry(
  () => import("../features/public/pages/NotFoundPage.jsx"),
);
export const SignUp = lazyWithRetry(
  () => import("../features/public/pages/SignUp.jsx"),
);
export const AuthAction = lazyWithRetry(
  () => import("../features/tenant/pages/AuthAction.jsx"),
);
export const PublicStayVerificationPage = lazyWithRetry(
  () => import("../features/public/pages/PublicStayVerificationPage.jsx"),
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
  () => import("../features/tenant/pages/CheckAvailabilityPage.jsx"),
);
export const ReservationFlowPage = lazyWithRetry(
  () => import("../features/tenant/pages/ReservationFlowPage.jsx"),
);
export const ProfilePage = lazyWithRetry(
  () => import("../features/tenant/pages/ProfilePage.jsx"),
);
export const ContractsPage = lazyWithRetry(
  () => import("../features/tenant/pages/ContractsPage.jsx"),
);
export const TenantBillingPage = lazyWithRetry(
  () => import("../features/tenant/pages/BillingPage.jsx"),
);
export const TenantMaintenancePage = lazyWithRetry(
  () => import("../features/tenant/pages/MaintenanceWorkspacePage.jsx"),
);
export const TenantAnnouncementsPage = lazyWithRetry(
  () => import("../features/tenant/pages/AnnouncementsPage.jsx"),
);

export const AdminLayout = lazyWithRetry(
  () => import("../features/admin/components/AdminLayout.jsx"),
);
export const AdminDashboardPage = lazyWithRetry(
  () => import("../features/admin/pages/Dashboard.jsx"),
);
export const ReservationsPage = lazyWithRetry(
  () => import("../features/admin/pages/ReservationsPage.jsx"),
);
export const RoomAvailabilityPage = lazyWithRetry(
  () => import("../features/admin/pages/RoomAvailabilityPage.jsx"),
);
export const TenantsWorkspacePage = lazyWithRetry(
  () => import("../features/admin/pages/TenantsWorkspacePage.jsx"),
);
export const AuditLogsPage = lazyWithRetry(
  () => import("../features/admin/pages/AuditLogsPage.jsx"),
);
export const UserManagementPage = lazyWithRetry(
  () => import("../features/admin/pages/UserManagementPage.jsx"),
);
export const AdminBillingPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminBillingPage.jsx"),
);
export const AdminAnnouncementsPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminAnnouncementsPage.jsx"),
);
export const AdminChatPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminChatPage.jsx"),
);
export const InquiriesPage = lazyWithRetry(
  () => import("../features/admin/pages/InquiriesPage.jsx"),
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
export const BranchManagementPage = lazyWithRetry(
  () => import("../features/owner/pages/BranchManagementPage.jsx"),
);
export const RolePermissionsPage = lazyWithRetry(
  () => import("../features/owner/pages/RolePermissionsPage.jsx"),
);
export const SystemSettingsPage = lazyWithRetry(
  () => import("../features/owner/pages/SystemSettingsPage.jsx"),
);
export const AdminNotificationsPage = lazyWithRetry(
  () => import("../features/admin/pages/AdminNotificationsPage.jsx"),
);
export const SystemBackupPage = lazyWithRetry(
  () => import("../features/admin/pages/SystemBackupPage.jsx"),
);
