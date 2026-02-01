import Sidebar from "../components/Sidebar";
import "../styles/superadmin-settings.css";

function SystemSettingsPage() {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">
        <h1>System Settings</h1>
        <p>Configure system-wide settings</p>
      </main>
    </div>
  );
}

export default SystemSettingsPage;
