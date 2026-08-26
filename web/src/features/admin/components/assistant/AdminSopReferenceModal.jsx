import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function AdminSopReferenceModal({ sop, onClose }) {
  if (!sop) return null;

  const content = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-card rounded-xl shadow-xl overflow-hidden flex flex-col border border-border animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="text-foreground font-semibold">
            <span>Standard Operating Procedure</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
          <div>
            <h2 className="text-base font-bold text-foreground mb-0.5">{sop.title}</h2>
            <p className="text-xs text-muted-foreground">Reference: {sop.policyLink}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required Steps</h3>
            <ul className="space-y-2.5">
              {sop.steps.map((step, idx) => (
                <li key={idx} className="flex gap-2.5 text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border">
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {idx + 1}
                  </div>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="pt-4 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Policy Context</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This procedure is standard for all dormitory operations to ensure security, compliance, and accurate accounting. Any exceptions require prior management authorization.
            </p>
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-card flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
