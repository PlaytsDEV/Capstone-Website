export default function ReservationStatsBar({
 statItems,
 activeFilter,
 onFilterChange,
}) {
 return (
    <div className="ar-stats">
      {statItems?.map((s) => (
        <div
          key={s.key}
          className={`ar-stat ${s.cls || ""} transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm hover:-translate-y-0.5`}
        >
          <span className="ar-stat-count">{s.count}</span>
          <span className="ar-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
 );
}
