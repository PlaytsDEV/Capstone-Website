import { useState, useEffect } from "react";
import { ShieldAlert, X, Check, LoaderCircle } from "lucide-react";
import { PRIORITY_OPTIONS, PRIORITY_DESCRIPTIONS } from "./chatConstants";

export default function AdminChatPriorityModal({
  isOpen,
  onClose,
  onConfirm,
  currentPriority = "normal",
  tenantName,
  updating = false,
}) {
  const [pendingPriority, setPendingPriority] = useState(currentPriority || "normal");

  useEffect(() => {
    if (isOpen) {
      setPendingPriority(currentPriority || "normal");
    }
  }, [isOpen, currentPriority]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(pendingPriority);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <h3 className="text-sm font-bold text-foreground">Update Ticket Priority</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Select the priority level for conversation with{" "}
          <strong className="text-foreground">{tenantName}</strong>:
        </p>

        <div className="space-y-2">
          {PRIORITY_OPTIONS.filter((opt) => opt.value !== "all").map((opt) => {
            const isSelected = pendingPriority === opt.value;
            const isCurrent = currentPriority === opt.value;

            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setPendingPriority(opt.value)}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                  isSelected
                    ? "bg-muted/90 border-primary/60 shadow-2xs"
                    : "bg-card border-border hover:bg-muted/40"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-900" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground">
                      {opt.label} Priority
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground uppercase">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {PRIORITY_DESCRIPTIONS[opt.value]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={updating || pendingPriority === currentPriority}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {updating ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            <span>Confirm Priority</span>
          </button>
        </div>
      </div>
    </div>
  );
}
