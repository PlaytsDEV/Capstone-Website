import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";

export default function RequirePermission({ permission, children }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  if (user?.role !== "owner" && !can(permission)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
}
