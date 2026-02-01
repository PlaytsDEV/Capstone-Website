import React from "react";

const TenantItem = ({ tenant }) => {
  return (
    <div className="tenant-item">
      <h3>{tenant.name}</h3>
      <p>Room: {tenant.room}</p>
      <p>Status: {tenant.status}</p>
    </div>
  );
};

export default TenantItem;
