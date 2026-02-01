import Sidebar from "../components/Sidebar";
import "../styles/admin-reports.css";

function ReportsPage() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <h1>Reports & Analytics</h1>
        <p>Generate and view reports</p>
      </main>
    </div>
  );
}

export default ReportsPage;
