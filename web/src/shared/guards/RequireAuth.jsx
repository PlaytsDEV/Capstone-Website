import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default RequireAuth;
