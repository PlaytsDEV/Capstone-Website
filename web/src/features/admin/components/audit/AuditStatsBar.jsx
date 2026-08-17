import React from "react";
import { Activity, AlertCircle, Clock, Trash2 } from "lucide-react";

export default function AuditStatsBar({ stats = {} }) {
  const total = Number(stats?.total || 0);
  const critical = Number(stats?.critical || 0);
  const today = Number(stats?.today || 0);
  const deletions = Number(stats?.deletions || 0);

  return (
    <div className="audit-stats">
      <div className="stat-card stat-card--blue">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <span className="stat-card-label">Total Logs</span>
            <h3 className="stat-card-value">{total.toLocaleString()}</h3>
          </div>
          <div className="stat-card-icon blue">
            <Activity size={24} />
          </div>
        </div>
      </div>

      <div className="stat-card stat-card--red">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <span className="stat-card-label">Critical Events</span>
            <h3 className="stat-card-value">{critical.toLocaleString()}</h3>
          </div>
          <div className="stat-card-icon red">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      <div className="stat-card stat-card--green">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <span className="stat-card-label">Today's Activity</span>
            <h3 className="stat-card-value">{today.toLocaleString()}</h3>
          </div>
          <div className="stat-card-icon green">
            <Clock size={24} />
          </div>
        </div>
      </div>

      <div className="stat-card stat-card--orange">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <span className="stat-card-label">Data Deletions</span>
            <h3 className="stat-card-value">{deletions.toLocaleString()}</h3>
          </div>
          <div className="stat-card-icon orange">
            <Trash2 size={24} />
          </div>
        </div>
      </div>
    </div>
  );
}
