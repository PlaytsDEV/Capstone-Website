import Sidebar from "../components/Sidebar";
import "../styles/superadmin-dashboard.css";

function SuperAdminDashboard() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>Super Admin Dashboard</h1>
        <p>System-wide overview and management</p>
      </main>
    </div>
  );
}

export default SuperAdminDashboard;
