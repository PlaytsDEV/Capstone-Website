import { Outlet } from "react-router-dom";

function RequireAdmin() {
  return <Outlet />;
}

export default RequireAdmin;
