import React from "react";
import { AlertCircle, Wrench, Users, ChevronRight } from "lucide-react";

export default function SupportIssueClusterCard({ title, count, location, status, impact }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-md ${impact === 'High' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-[var(--text-main)] text-sm">{title}</h4>
            <span className="text-xs text-slate-500">{location}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-[var(--text-main)]">{count}</span>
          <p className="text-xs text-slate-500">tickets</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs pt-3 border-t border-[var(--border)]">
        <span className={`px-2 py-1 rounded-full font-medium ${
          status === 'Active' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {status}
        </span>
        <button className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
          View details <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
