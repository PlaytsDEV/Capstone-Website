import React from "react";
import { AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";

export default function AdminIssueClusterBanner({ clusters = [] }) {
  if (!clusters || clusters.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {clusters.map((cluster, idx) => (
        <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="mt-0.5 text-amber-500">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <TrendingUp size={14} />
              Issue Cluster Detected: {cluster.type}
            </h4>
            <p className="text-xs text-amber-800 mt-1">
              {cluster.description} ({cluster.count} similar reports in {cluster.location}).
            </p>
            {cluster.action && (
              <button className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1">
                {cluster.action} <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
