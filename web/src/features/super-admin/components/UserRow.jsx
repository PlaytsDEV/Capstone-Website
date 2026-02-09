import React from "react";

const UserRow = ({ user }) => {
  return (
    <tr className="user-row">
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>{user.role}</td>
      <td>{user.status}</td>
      <td>
        <button>Edit</button>
        <button>Delete</button>
      </td>
    </tr>
  );
};

export default UserRow;
