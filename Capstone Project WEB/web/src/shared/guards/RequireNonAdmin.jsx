/**
 * =============================================================================
 * REQUIRE NON-ADMIN GUARD
 * =============================================================================
 *
 * Route protection component that blocks admin users from public/tenant pages.
 *
 * SESSION LOCK BEHAVIOR:
 * - Admin and super admin users are BLOCKED from accessing public/tenant pages
 * - Admins are redirected to /admin/dashboard (their designated workspace)
 * - Enforces strict role separation: admins stay in admin area, users in tenant area
 *
 * Usage:
 *   <Route path="/tenant/signin" element={<RequireNonAdmin><TenantSignIn /></RequireNonAdmin>} />
 *   <Route path="/" element={<RequireNonAdmin><LandingPage /></RequireNonAdmin>} />
 *
 * Behavior:
 * - Non-admin users: Allowed access
 * - Admin/Super admin users: Redirected to /admin/dashboard
 * =============================================================================
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Guard component that blocks admin users from accessing public/tenant pages
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Route content to protect
 * @returns {React.ReactElement} Children if non-admin, redirect if admin
 */
const RequireNonAdmin = ({ children }) => {
  const { user, loading } = useAuth();

  // Wait for auth to load
  if (loading) {
    return null;
  }

  // Block admin and super admin users from public/tenant routes
  const isAdmin = user?.role === "admin" || user?.role === "superAdmin";
  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Allow non-admin users (including unauthenticated users)
  return children;
};

export default RequireNonAdmin;
