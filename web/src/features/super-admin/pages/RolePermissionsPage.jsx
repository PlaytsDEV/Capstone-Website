import Sidebar from "../components/Sidebar";
import "../styles/superadmin-settings.css";

function RolePermissionsPage() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>Roles & Permissions</h1>
        <p>Configure system roles and permissions</p>
      </main>
    </div>
  );
}

export default RolePermissionsPage;
