function TenantItem({ tenant }) {
  return (
    <div className="admin-tenant-item">
      <h3>{tenant.name}</h3>
      <p>Room: {tenant.roomNumber}</p>
    </div>
  );
}

export default TenantItem;
