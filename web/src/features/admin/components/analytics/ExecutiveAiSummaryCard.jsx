import React from "react";
import { Sparkles, ArrowRight, ShieldAlert, TrendingDown } from "lucide-react";

export default function ExecutiveAiSummaryCard({ title, findings, recommendations }) {
  return (
    <div className="bg-[#0A1628] dark:bg-slate-900 rounded-xl p-6 text-white shadow-md border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-[#D4AF37]" size={20} />
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Key Findings</h4>
          <ul className="space-y-3">
            {findings.map((finding, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-200">
                <div className="mt-0.5 text-slate-400">
                  {finding.type === 'alert' ? <ShieldAlert size={14} className="text-amber-400" /> : <TrendingDown size={14} className="text-emerald-400" />}
                </div>
                {finding.text}
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Strategic Actions</h4>
          <ul className="space-y-3">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-200 bg-white/5 p-2 rounded border border-white/10">
                <ArrowRight size={14} className="mt-0.5 text-blue-400 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
