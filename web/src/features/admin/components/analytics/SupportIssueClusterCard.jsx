import React from "react";
import { AlertCircle, Wrench, Users, ChevronRight } from "lucide-react";

export default function SupportIssueClusterCard({ title, count, location, status, impact, onAction }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:shadow-xs transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="text-amber-600 dark:text-amber-400 shrink-0">
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-xs">{title}</h4>
            <span className="text-[11px] text-muted-foreground">{location}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-base font-bold text-foreground">{count}</span>
          <p className="text-[10px] text-muted-foreground">tickets</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs pt-3 border-t border-border">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-transparent">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "Active" ? "bg-rose-500" : "bg-emerald-500"
            }`}
          />
          <span>{status}</span>
        </span>
        <button
          type="button"
          onClick={onAction}
          className="text-primary hover:underline focus:outline-hidden inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
        >
          <span>View details</span>
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
