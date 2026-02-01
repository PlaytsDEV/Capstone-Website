import "../styles/superadmin-sidebar.css";

function Sidebar() {
  return (
    <aside className="superadmin-sidebar">
      <div className="superadmin-sidebar-header">
        <h2>Super Admin</h2>
      </div>
      <nav className="superadmin-sidebar-nav">
        <ul>
          <li>Dashboard</li>
          <li>Users</li>
          <li>Branches</li>
          <li>Roles</li>
          <li>Settings</li>
          <li>Logs</li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
