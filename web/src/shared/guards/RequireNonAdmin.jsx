/**
 * =============================================================================
 * REQUIRE NON-ADMIN GUARD
 * =============================================================================
 *
 * Route protection component that prevents admin users from accessing
 * non-admin routes (login pages, public pages, tenant pages).
 *
 * This enforces the strict admin session flow:
 * - Once an admin logs in, they are locked to admin-only routes
 * - Prevents admins from accessing login pages or public content
 * - Only explicit logout can break this session lock
 *
 * Usage:
 *   <Route path="/tenant/signin" element={<RequireNonAdmin><TenantSignIn /></RequireNonAdmin>} />
 *   <Route path="/" element={<RequireNonAdmin><LandingPage /></RequireNonAdmin>} />
 *
 * Behavior:
 * - If user is authenticated admin/superAdmin → redirect to /admin/dashboard
 * - If user is not authenticated or not admin → allow access to the route
 * =============================================================================
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useFirebaseAuth } from "../hooks/FirebaseAuthContext";

/**
 * Guard component that prevents admin users from accessing non-admin routes
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Route content to protect
 * @returns {React.ReactElement} Children if not admin, redirect to admin dashboard if admin
 */
const RequireNonAdmin = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const { user: firebaseUser, loading: firebaseLoading } = useFirebaseAuth();

  // Show loading while either auth system is checking
  if (loading || firebaseLoading) {
    return <div>Loading...</div>;
  }

  // If user is authenticated and has admin/superAdmin role,
  // redirect them to admin dashboard (strict session lock)
  if (firebaseUser && isAuthenticated) {
    const isAdmin = user?.role === "admin" || user?.role === "superAdmin";
    if (isAdmin) {
      // Admin is trying to access non-admin route - redirect to dashboard
      // This prevents back-button navigation and direct URL access
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  // User is not an authenticated admin, allow access to the route
  return children;
};

export default RequireNonAdmin;
