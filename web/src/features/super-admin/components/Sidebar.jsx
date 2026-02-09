import React from "react";

const Sidebar = () => {
  return (
    <div className="superadmin-sidebar">
      <h2>Super Admin</h2>
      <nav>
        <ul>
          <li>Dashboard</li>
          <li>User Management</li>
          <li>Roles & Permissions</li>
          <li>Branch Management</li>
          <li>All Tenants</li>
          <li>Activity Logs</li>
          <li>System Settings</li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
