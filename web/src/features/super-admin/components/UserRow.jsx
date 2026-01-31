function UserRow({ user }) {
  return (
    <tr className="user-row">
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>{user.role}</td>
      <td>{user.status}</td>
    </tr>
  );
}

export default UserRow;
