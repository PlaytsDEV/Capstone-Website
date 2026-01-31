import Sidebar from "../components/Sidebar";
import "../styles/superadmin-settings.css";

function ActivityLogsPage() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>Activity Logs</h1>
        <p>System audit trail and activity logs</p>
      </main>
    </div>
  );
}

export default ActivityLogsPage;
