import { Outlet } from "react-router-dom";
import Sidebar from "../../features/admin/components/Sidebar";

function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
