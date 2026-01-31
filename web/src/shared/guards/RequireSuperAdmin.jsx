import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function RequireSuperAdmin({ children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user?.role !== "super-admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

export default RequireSuperAdmin;
