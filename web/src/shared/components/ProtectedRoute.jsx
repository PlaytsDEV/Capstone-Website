import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Protected Route Component
 *
 * Protects routes based on authentication and role requirements.
 * Uses Firebase custom claims from the ID token for role verification.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {string} props.requiredRole - Required role: 'admin', 'superAdmin', or 'user'
 * @param {boolean} props.requireAuth - Whether authentication is required (default: true)
 *
 * @returns {React.ReactNode} Protected content or redirect
 */
const ProtectedRoute = ({ children, requiredRole, requireAuth = true }) => {
  const { user, isAuthenticated, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/tenant/signin" replace />;
  }

  // Check role requirements using custom claims from ID token
  if (requiredRole) {
    // For admin routes, check if user has admin or superAdmin custom claims
    if (requiredRole === "admin") {
      if (
        !user?.role ||
        (user.role !== "admin" && user.role !== "superAdmin")
      ) {
        return <Navigate to="/unauthorized" replace />;
      }
    }
    // For super admin routes, check for superAdmin role
    else if (requiredRole === "superAdmin") {
      if (!user?.role || user.role !== "superAdmin") {
        return <Navigate to="/unauthorized" replace />;
      }
    }
    // For user routes, ensure user is NOT an admin (prevents admin access to user endpoints)
    else if (requiredRole === "user") {
      if (user?.role === "admin" || user?.role === "superAdmin") {
        return <Navigate to="/admin/dashboard" replace />;
      }

      // BRANCH ENFORCEMENT: Users must have selected a branch before accessing protected routes
      // If no branch is selected, redirect to branch selection
      if (!user?.branch || user.branch === "") {
        return <Navigate to="/tenant/branch-selection" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
