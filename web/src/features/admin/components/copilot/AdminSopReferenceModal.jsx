import React from "react";
import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";

export default function AdminSopReferenceModal({ sop, onClose }) {
  if (!sop) return null;

  const content = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div 
        className="w-full max-w-lg bg-[var(--card)] rounded-lg shadow-xl overflow-hidden flex flex-col border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
            <FileText size={20} className="text-[var(--primary)]" />
            Standard Operating Procedure
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <h2 className="text-lg font-bold text-[var(--text-main)] mb-1">{sop.title}</h2>
          <p className="text-sm text-slate-500 mb-6">Reference: {sop.policyLink}</p>

          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--text-main)]">Required Steps</h3>
            <ul className="space-y-3">
              {sop.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0 text-xs">
                    {idx + 1}
                  </div>
                  {step}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="mt-8 pt-4 border-t border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text-main)] mb-2">Policy Context</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This procedure is mandatory for all move-outs to ensure security and proper accounting. Exceptions require direct manager approval. Failure to adhere to these steps may result in operational discrepancies.
            </p>
          </div>
        </div>
        
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)] flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
