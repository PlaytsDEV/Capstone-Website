import Sidebar from "../components/Sidebar";
import "../styles/superadmin-users.css";

function UserManagementPage() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>User Management</h1>
        <p>Manage all system users and their roles</p>
      </main>
    </div>
  );
}

export default UserManagementPage;
