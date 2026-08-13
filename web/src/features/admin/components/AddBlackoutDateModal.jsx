import React, { useState, useEffect } from "react";
import { CalendarX, X, AlertTriangle, Plus, Tag } from "lucide-react";
import { getTomorrowISO } from "../utils/visitPresetDates";

const PRESET_REASON_CHIPS = [
  "Regular Holiday",
  "Special Non-Working Holiday",
  "Building Maintenance",
  "Staff Event",
  "Facility Renovation",
  "Emergency Closure",
];

export default function AddBlackoutDateModal({
  isOpen,
  onClose,
  onAddBlackout,
  existingBlackouts = [],
  isLoading = false,
}) {
  const [date, setDate] = useState(getTomorrowISO());
  const [reason, setReason] = useState("");
  const [activeChip, setActiveChip] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDate(getTomorrowISO());
      setReason("");
      setActiveChip("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Duplicate date check
  const isDuplicate = Boolean(
    date && existingBlackouts.some((item) => item.date === date)
  );

  const isValid = Boolean(date) && !isDuplicate;

  const handleChipClick = (chipText) => {
    if (activeChip === chipText) {
      setActiveChip("");
      setReason("");
    } else {
      setActiveChip(chipText);
      setReason(chipText);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;

    onAddBlackout({
      date,
      reason: reason.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-blackout-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <CalendarX className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="add-blackout-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Add Blackout Date
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Block visit bookings for a holiday or operational closure.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Duplicate Date Warning Alert */}
          {isDuplicate && (
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Duplicate Date Detected</strong>
                <p className="mt-0.5">
                  The date <strong>{date}</strong> is already configured as a blackout date in your schedule rules.
                </p>
              </div>
            </div>
          )}

          {/* Date Picker Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Blackout Calendar Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
            <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  isDuplicate
                    ? "border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100"
                    : "border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                } ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          {/* Quick Reason Chips */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Tag size={13} className="text-slate-400" />
              <span>Quick Reason Suggestions</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_REASON_CHIPS.map((chip) => {
                const isActive = activeChip === chip || reason === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason Note Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Closure Reason / Note <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              placeholder="e.g. Regular Holiday, Building Maintenance, Staff Event"
              disabled={isLoading}
              onChange={(e) => {
                setReason(e.target.value);
                if (activeChip && e.target.value !== activeChip) {
                  setActiveChip("");
                }
              }}
              className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
              <button
              type="submit"
              disabled={!isValid || isLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-all ${
                isValid && !isLoading
                  ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
                  : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              }`}
            >
              <Plus size={15} />
              <span>Add Blackout Date</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
