import Sidebar from "../components/Sidebar";
import "../styles/admin-tenants.css";

function TenantsPage() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <h1>Tenants Management</h1>
        <p>View and manage all tenants</p>
      </main>
    </div>
  );
}

export default TenantsPage;
