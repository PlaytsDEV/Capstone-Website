import { Outlet } from "react-router-dom";
import Sidebar from "../../features/super-admin/components/Sidebar";

function SuperAdminLayout() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <Outlet />
      </main>
    </div>
  );
}

export default SuperAdminLayout;
