import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function RequireAdmin({ children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user?.role !== "admin" && user?.role !== "super-admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RequireAdmin;
