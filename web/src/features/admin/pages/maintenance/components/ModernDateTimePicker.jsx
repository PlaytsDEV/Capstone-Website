import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Check,
} from "lucide-react";
import dayjs from "dayjs";

const POPULAR_TIME_SLOTS = [
  { time: "09:00", label: "9:00 AM", period: "Morning Window" },
  { time: "10:30", label: "10:30 AM", period: "Late Morning" },
  { time: "14:00", label: "2:00 PM", period: "Afternoon Window" },
  { time: "16:00", label: "4:00 PM", period: "Late Afternoon" },
];

export function ModernDateTimePicker({
  dateValue = "",
  timeValue = "",
  onDateChange,
  onTimeChange,
  minDate = dayjs().format("YYYY-MM-DD"),
  maxDate = dayjs().add(365, "day").format("YYYY-MM-DD"),
  disabled = false,
}) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (dateValue ? dayjs(dateValue) : dayjs()));

  const calendarContainerRef = useRef(null);
  const timeContainerRef = useRef(null);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        calendarContainerRef.current &&
        !calendarContainerRef.current.contains(e.target)
      ) {
        setIsCalendarOpen(false);
      }
      if (
        timeContainerRef.current &&
        !timeContainerRef.current.contains(e.target)
      ) {
        setIsTimePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update viewDate when dateValue changes externally
  useEffect(() => {
    if (dateValue && dayjs(dateValue).isValid()) {
      setViewDate(dayjs(dateValue));
    }
  }, [dateValue]);

  // Calendar Grid Calculation
  const calendarDays = useMemo(() => {
    const startOfMonth = viewDate.startOf("month");
    const endOfMonth = viewDate.endOf("month");
    const startDayOfWeek = startOfMonth.day(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = endOfMonth.date();

    const days = [];

    // Previous month padding
    const prevMonth = viewDate.subtract(1, "month");
    const prevMonthDays = prevMonth.endOf("month").date();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonth.date(prevMonthDays - i);
      days.push({
        dateStr: d.format("YYYY-MM-DD"),
        dayNum: d.date(),
        isCurrentMonth: false,
        isPast: d.isBefore(dayjs(minDate), "day"),
        isFuture: d.isAfter(dayjs(maxDate), "day"),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = viewDate.date(i);
      days.push({
        dateStr: d.format("YYYY-MM-DD"),
        dayNum: i,
        isCurrentMonth: true,
        isPast: d.isBefore(dayjs(minDate), "day"),
        isFuture: d.isAfter(dayjs(maxDate), "day"),
      });
    }

    // Next month padding to fill 6 rows (42 days)
    const nextMonth = viewDate.add(1, "month");
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = nextMonth.date(i);
      days.push({
        dateStr: d.format("YYYY-MM-DD"),
        dayNum: i,
        isCurrentMonth: false,
        isPast: d.isBefore(dayjs(minDate), "day"),
        isFuture: d.isAfter(dayjs(maxDate), "day"),
      });
    }

    return days;
  }, [viewDate, minDate, maxDate]);

  // Friendly human-readable display values
  const formattedDateDisplay = useMemo(() => {
    if (!dateValue || !dayjs(dateValue).isValid()) return null;
    const d = dayjs(dateValue);
    const today = dayjs().startOf("day");
    const tomorrow = dayjs().add(1, "day").startOf("day");

    let prefix = "";
    if (d.isSame(today, "day")) prefix = "Today, ";
    else if (d.isSame(tomorrow, "day")) prefix = "Tomorrow, ";

    return `${prefix}${d.format("ddd, MMM D, YYYY")}`;
  }, [dateValue]);

  const formattedTimeDisplay = useMemo(() => {
    if (!timeValue) return null;
    const [hStr, mStr] = timeValue.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return timeValue;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }, [timeValue]);

  // Quick Preset Actions
  const handleQuickDay = (offsetDays, specificTime = null) => {
    const target = dayjs().add(offsetDays, "day");
    onDateChange(target.format("YYYY-MM-DD"));
    if (specificTime) {
      onTimeChange(specificTime);
    } else if (!timeValue) {
      onTimeChange("09:00");
    }
  };

  const handleSelectDay = (dateStr, isPast, isFuture) => {
    if (isPast || isFuture || disabled) return;
    onDateChange(dateStr);
    setIsCalendarOpen(false);
  };

  const handleSelectTimeSlot = (time) => {
    onTimeChange(time);
    setIsTimePickerOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* 2-Column Responsive Picker Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Date Selector */}
        <div className="space-y-1.5 relative" ref={calendarContainerRef}>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CalendarIcon size={13} className="text-slate-600 dark:text-slate-400" />
              <span>Visit Date *</span>
            </span>
            {dateValue && (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Selected
              </span>
            )}
          </label>

          {/* Trigger Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsCalendarOpen((prev) => !prev);
              setIsTimePickerOpen(false);
            }}
            className={`w-full h-10 rounded-lg border px-3 flex items-center justify-between text-xs font-medium transition cursor-pointer text-left ${
              isCalendarOpen
                ? "border-slate-900 dark:border-slate-100 ring-1 ring-slate-900/10 bg-white dark:bg-slate-900"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 shadow-2xs"
            }`}
          >
            <span className={formattedDateDisplay ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-400"}>
              {formattedDateDisplay || "Pick visit date..."}
            </span>
            <CalendarIcon size={14} className="text-slate-400 shrink-0 ml-2" />
          </button>

          {/* Custom Modern Calendar Popover */}
          {isCalendarOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-40 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
              {/* Calendar Month Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setViewDate((prev) => prev.subtract(1, "month"))}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {viewDate.format("MMMM YYYY")}
                </span>
                <button
                  type="button"
                  onClick={() => setViewDate((prev) => prev.add(1, "month"))}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Day Headers (Sun - Sat) */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <span key={day} className="text-[10px] font-bold text-slate-400">
                    {day}
                  </span>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const isSelected = dateValue === day.dateStr;
                  const isToday = dayjs().format("YYYY-MM-DD") === day.dateStr;
                  const isDisabledDay = day.isPast || day.isFuture;

                  return (
                    <button
                      key={`${day.dateStr}-${idx}`}
                      type="button"
                      disabled={isDisabledDay}
                      onClick={() => handleSelectDay(day.dateStr, day.isPast, day.isFuture)}
                      className={`h-7 w-full rounded-md text-xs font-medium flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs"
                          : isToday
                          ? "border border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 font-bold"
                          : isDisabledDay
                          ? "opacity-25 cursor-not-allowed text-slate-400"
                          : day.isCurrentMonth
                          ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {day.dayNum}
                    </button>
                  );
                })}
              </div>

              {/* Quick Jump Buttons Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    handleQuickDay(0);
                    setIsCalendarOpen(false);
                  }}
                  className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickDay(1);
                    setIsCalendarOpen(false);
                  }}
                  className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickDay(2);
                    setIsCalendarOpen(false);
                  }}
                  className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  In 2 Days
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Time Selector */}
        <div className="space-y-1.5 relative" ref={timeContainerRef}>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-600 dark:text-slate-400" />
              <span>Estimated Arrival Time *</span>
            </span>
            {timeValue && (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Selected
              </span>
            )}
          </label>

          {/* Trigger Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsTimePickerOpen((prev) => !prev);
              setIsCalendarOpen(false);
            }}
            className={`w-full h-10 rounded-lg border px-3 flex items-center justify-between text-xs font-medium transition cursor-pointer text-left ${
              isTimePickerOpen
                ? "border-slate-900 dark:border-slate-100 ring-1 ring-slate-900/10 bg-white dark:bg-slate-900"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 shadow-2xs"
            }`}
          >
            <span className={formattedTimeDisplay ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-400"}>
              {formattedTimeDisplay || "Pick arrival time..."}
            </span>
            <Clock size={14} className="text-slate-400 shrink-0 ml-2" />
          </button>

          {/* Custom Modern Time Slots Popover */}
          {isTimePickerOpen && (
            <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-1.5 z-40 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Standard Service Windows
                </span>
                <span className="text-[10px] text-slate-400">Working Hours</span>
              </div>

              {/* Standard Slots */}
              <div className="grid grid-cols-1 gap-1.5">
                {POPULAR_TIME_SLOTS.map((slot) => {
                  const isSelected = timeValue === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => handleSelectTimeSlot(slot.time)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={12} className={isSelected ? "text-white dark:text-slate-900" : "text-slate-400"} />
                        <span className="font-semibold">{slot.label}</span>
                      </div>
                      <span className={`text-[10px] ${isSelected ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
                        {slot.period}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Time Manual Selection Row */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Custom Time:
                </span>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className="h-7 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Visual Chips Row */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles size={11} className="text-amber-500" />
          <span>Quick Windows:</span>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            handleQuickDay(0, dayjs().add(2, "hour").format("HH:00"));
          }}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer shadow-2xs border ${
            dateValue === dayjs().format("YYYY-MM-DD")
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent font-bold"
              : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Today (+2 hrs)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            handleQuickDay(1, "09:00");
          }}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer shadow-2xs border ${
            dateValue === dayjs().add(1, "day").format("YYYY-MM-DD") && timeValue === "09:00"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent font-bold"
              : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Tomorrow 9:00 AM
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            handleQuickDay(1, "14:00");
          }}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer shadow-2xs border ${
            dateValue === dayjs().add(1, "day").format("YYYY-MM-DD") && timeValue === "14:00"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent font-bold"
              : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Tomorrow 2:00 PM
        </button>
      </div>
    </div>
  );
}
