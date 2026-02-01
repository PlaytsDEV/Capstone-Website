import Sidebar from "../components/Sidebar";
import "../styles/superadmin-settings.css";

function BranchManagementPage() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>Branch Management</h1>
        <p>Manage all branches (Gil Puyat, Guadalupe)</p>
      </main>
    </div>
  );
}

export default BranchManagementPage;
