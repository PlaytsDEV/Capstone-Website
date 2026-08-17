import React, { useState } from "react";
import {
  AlertTriangle,
  X,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  FileText,
} from "lucide-react";

/**
 * Pre-Save Warning Modal for Visit Availability Rule Conflicts.
 *
 * Intercepts rule save actions when confirmed/pending visit conflicts exist.
 */
export default function VisitConflictWarningModal({
  isOpen,
  conflictReport,
  onCancel,
  onConfirmSave,
  isSaving = false,
}) {
  const [adminNote, setAdminNote] = useState("");

  if (!isOpen || !conflictReport || !conflictReport.hasConflicts) return null;

  const totalAffected = conflictReport.totalAffected || 0;
  const conflicts = conflictReport.conflicts || [];

  const handleConfirm = () => {
    onConfirmSave({
      adminNote: adminNote.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3
                id="conflict-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Schedule Impact Warning
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This rule change will affect {totalAffected} existing active{" "}
                {totalAffected === 1 ? "reservation" : "reservations"}.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close warning modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm text-slate-700 dark:text-slate-300">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Saving these availability rules will block or invalidate previously confirmed visit schedules.
            Existing reservations will remain active for admin manual rescheduling, and an impact event will be logged.
          </p>

          {/* Conflict Groups */}
          <div className="space-y-4">
            {conflicts.map((group, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    {group.trigger || "Rule Conflict"}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-transparent text-amber-700 dark:text-amber-400">
                    {group.affectedCount} affected
                  </span>
                </div>

                {/* Affected Reservation Items */}
                <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  {(group.reservations || []).map((res, rIdx) => (
                    <div
                      key={res.reservationId || rIdx}
                      className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{res.tenantName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{res.visitDate || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{res.visitSlot || "N/A"}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase bg-transparent text-slate-700 dark:text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {res.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Optional Admin Note */}
          <div className="space-y-1.5 pt-2">
            <label
              htmlFor="conflict-admin-note"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin Resolution Note (Optional)</span>
            </label>
            <textarea
              id="conflict-admin-note"
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Branch electrical maintenance scheduled on this date. Rescheduling phone calls in progress."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-slate-400 focus:border-slate-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <span>Saving Changes...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Acknowledge & Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
