function StatCard({ title, value, icon }) {
  return (
    <div className="admin-stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  );
}

export default StatCard;
