import Sidebar from "../components/Sidebar";
import "../styles/superadmin-users.css";

function AllTenantsPage() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>All Tenants</h1>
        <p>View tenants across all branches</p>
      </main>
    </div>
  );
}

export default AllTenantsPage;
