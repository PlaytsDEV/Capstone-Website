import React from "react";

const RoleBadge = ({ role }) => {
  const getRoleColor = (role) => {
    switch (role) {
      case "super-admin":
        return "#dc3545";
      case "admin":
        return "#007bff";
      case "tenant":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  return (
    <span
      className="role-badge"
      style={{ backgroundColor: getRoleColor(role) }}
    >
      {role}
    </span>
  );
};

export default RoleBadge;
