import React, { useState, useEffect, useRef } from "react";
import { Clock, X, Check, ChevronDown, Sparkles } from "lucide-react";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const TIME_PRESETS = [
  { label: "Now", getVal: () => getCurrentTimeFormatted() },
  { label: "10:00 PM (Curfew)", val: "10:00 PM" },
  { label: "11:00 PM (Quiet Hrs)", val: "11:00 PM" },
  { label: "12:00 AM (Midnight)", val: "12:00 AM" },
  { label: "02:00 PM (Afternoon)", val: "02:00 PM" },
  { label: "08:00 AM (Morning)", val: "08:00 AM" },
];

function getCurrentTimeFormatted() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
}

export default function ModernTimePicker({ value, onChange, placeholder = "Set approximate time..." }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value (e.g. "10:30 PM" or "22:30" or "")
  const parseValue = (val) => {
    if (!val) {
      return { hour: "10", minute: "00", period: "PM" };
    }
    const match12 = String(val).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      let p = match12[3] ? match12[3].toUpperCase() : "PM";
      if (!match12[3] && h > 12) {
        h = h - 12;
        p = "PM";
      }
      return {
        hour: String(h || 12).padStart(2, "0"),
        minute: String(match12[2] || "00").padStart(2, "0"),
        period: p,
      };
    }
    return { hour: "10", minute: "00", period: "PM" };
  };

  const parsed = parseValue(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  useEffect(() => {
    if (value) {
      const p = parseValue(value);
      setHour(p.hour);
      setMinute(p.minute);
      setPeriod(p.period);
    }
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleValueChange = (newHour, newMin, newPeriod) => {
    const formatted = `${newHour}:${newMin} ${newPeriod}`;
    onChange(formatted);
  };

  const handleApply = (newHour = hour, newMin = minute, newPeriod = period) => {
    const formatted = `${newHour}:${newMin} ${newPeriod}`;
    onChange(formatted);
    setOpen(false);
  };

  const handleClear = (e) => {
    e?.stopPropagation?.();
    onChange("");
    setOpen(false);
  };

  const handlePresetSelect = (preset) => {
    const val = preset.getVal ? preset.getVal() : preset.val;
    onChange(val);
    const p = parseValue(val);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Display Input trigger */}
      <div
        onClick={() => setOpen(!open)}
        className={`flex h-9 w-full cursor-pointer items-center justify-between rounded-xl border bg-card px-3 text-xs shadow-xs transition ${
          open
            ? "border-slate-800 ring-1 ring-slate-800 dark:border-slate-200 dark:ring-slate-200"
            : "border-border hover:border-slate-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className={value ? "text-slate-900 dark:text-slate-100" : "text-muted-foreground"} />
          {value ? (
            <span className="font-bold text-card-foreground tracking-wide">{value}</span>
          ) : (
            <span className="text-muted-foreground font-medium">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-card-foreground transition"
              title="Clear time"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={13} className="text-muted-foreground" />
        </div>
      </div>

      {/* Popover Custom Time Picker */}
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 z-40 mt-1.5 w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-card-foreground"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock size={13} /> Select Incident Time
            </span>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-semibold text-muted-foreground hover:text-red-600 transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* Time Spinners / Dropdown Selectors */}
          <div className="flex items-center justify-center gap-2 p-2 rounded-xl border border-border bg-muted/20">
            {/* Hour Selector */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Hour</span>
              <select
                value={hour}
                onChange={(e) => {
                  setHour(e.target.value);
                  handleValueChange(e.target.value, minute, period);
                }}
                className="h-9 w-14 rounded-lg border border-border bg-card px-1 text-center text-xs font-bold text-card-foreground focus:border-slate-800 focus:outline-none cursor-pointer"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-sm font-bold text-muted-foreground mt-4">:</span>

            {/* Minute Selector */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Min</span>
              <select
                value={minute}
                onChange={(e) => {
                  setMinute(e.target.value);
                  handleValueChange(hour, e.target.value, period);
                }}
                className="h-9 w-14 rounded-lg border border-border bg-card px-1 text-center text-xs font-bold text-card-foreground focus:border-slate-800 focus:outline-none cursor-pointer"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* AM / PM Segmented Control */}
            <div className="flex flex-col items-center ml-1">
              <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Period</span>
              <div className="flex rounded-lg border border-border bg-card p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPeriod("AM");
                    handleValueChange(hour, minute, "AM");
                  }}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition cursor-pointer ${
                    period === "AM"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs"
                      : "text-muted-foreground hover:text-card-foreground"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriod("PM");
                    handleValueChange(hour, minute, "PM");
                  }}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition cursor-pointer ${
                    period === "PM"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs"
                      : "text-muted-foreground hover:text-card-foreground"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mt-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Quick Preset Times
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[11px] font-medium text-card-foreground hover:bg-muted transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Done action */}
          <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Selected: <strong className="text-card-foreground font-bold">{hour}:{minute} {period}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleApply(hour, minute, period)}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white transition"
            >
              <Check size={12} /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
