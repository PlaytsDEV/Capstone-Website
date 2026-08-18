import React from "react";
import { AlertTriangle, TrendingUp, ChevronRight, X } from "lucide-react";

export default function AdminIssueClusterBanner({ clusters = [], onDismiss }) {
  if (!clusters || clusters.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {clusters.map((cluster, idx) => (
        <div
          key={idx}
          className="flex items-start justify-between gap-3 p-3 rounded-lg bg-card border border-border shadow-2xs"
        >
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp size={13} className="text-muted-foreground" />
                <span>Issue Cluster Detected: {cluster.type}</span>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {cluster.description}{" "}
                <span className="font-medium text-foreground">
                  ({cluster.count} similar reports in {cluster.location || "this branch"})
                </span>
                .
              </p>
              {cluster.action && (
                <button
                  type="button"
                  onClick={cluster.onAction}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus:outline-hidden transition-colors cursor-pointer"
                >
                  <span>{cluster.action}</span>
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>

          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(idx)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Dismiss warning"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

