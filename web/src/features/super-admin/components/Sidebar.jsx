import { NavLink } from "react-router-dom";
import "../styles/superadmin-sidebar.css";

function Sidebar() {
  return (
    <aside className="superadmin-sidebar">
      <div className="superadmin-sidebar-header">
        <h2>Super Admin</h2>
      </div>
      <nav className="superadmin-sidebar-nav">
        <NavLink to="/super-admin/dashboard">Dashboard</NavLink>
        <NavLink to="/super-admin/users">User Management</NavLink>
        <NavLink to="/super-admin/roles">Roles & Permissions</NavLink>
        <NavLink to="/super-admin/branches">Branch Management</NavLink>
        <NavLink to="/super-admin/tenants">All Tenants</NavLink>
        <NavLink to="/super-admin/logs">Activity Logs</NavLink>
        <NavLink to="/super-admin/settings">System Settings</NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
