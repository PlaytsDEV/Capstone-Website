import React from "react";

const TenantLayout = ({ children }) => {
  return (
    <div className="tenant-layout">
      <header className="tenant-header">
        <h2>Tenant Portal</h2>
      </header>
      <main className="tenant-content">{children}</main>
    </div>
  );
};

export default TenantLayout;
