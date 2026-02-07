import React from "react";
import Sidebar from "../../features/super-admin/components/Sidebar";

const SuperAdminLayout = ({ children }) => {
  return (
    <div className="superadmin-layout">
      <Sidebar />
      <main className="superadmin-content">{children}</main>
    </div>
  );
};

export default SuperAdminLayout;
