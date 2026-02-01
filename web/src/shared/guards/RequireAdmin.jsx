import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useFirebaseAuth } from "../hooks/FirebaseAuthContext";

const RequireAdmin = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const { user: firebaseUser, loading: firebaseLoading } = useFirebaseAuth();

  // Show loading while either auth system is loading
  if (loading || firebaseLoading) {
    return <div>Loading...</div>;
  }

  // Check if user is authenticated with Firebase (basic auth check)
  if (!firebaseUser) {
    console.log("🔐 RequireAdmin: No Firebase user, redirecting to login");
    return <Navigate to="/admin/login" replace />;
  }

  // Check if user has admin/superAdmin role from backend
  if (
    !isAuthenticated ||
    (user?.role !== "admin" && user?.role !== "superAdmin")
  ) {
    console.log("🔐 RequireAdmin: User not authenticated or not admin role", {
      isAuthenticated,
      role: user?.role,
      firebaseUser: firebaseUser?.email,
    });
    return <Navigate to="/admin/login" replace />;
  }

  console.log(
    "✅ RequireAdmin: Access granted for",
    user?.email,
    "role:",
    user?.role,
  );
  return children;
};

export default RequireAdmin;
