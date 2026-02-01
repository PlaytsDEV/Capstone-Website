import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const RequireSuperAdmin = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || user?.role !== "superAdmin") {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default RequireSuperAdmin;
