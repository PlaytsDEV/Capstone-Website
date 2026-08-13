import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Plus,
  Save,
  Trash2,
  CalendarX,
  Users,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Building2,
  RotateCcw,
  History,
} from "lucide-react";
import {
  useUpdateVisitAvailabilitySettings,
  useVisitAvailability,
  useVisitAvailabilitySettings,
  useVisitAvailabilityPreflight,
} from "../../../shared/hooks/queries/useReservations";
import { useCurrentUser } from "../../../shared/hooks/queries/useUsers";
import { showNotification } from "../../../shared/utils/notification";
import { getBranchLabel } from "../utils/reservationRows";
import VisitAvailabilityHistoryDrawer from "./VisitAvailabilityHistoryDrawer";
import VisitConflictWarningModal from "./VisitConflictWarningModal";
import VisitSlotVisitorsModal from "./VisitSlotVisitorsModal";
import "../styles/design-tokens.css";
import "../styles/admin-reservations.css";

const WEEKDAYS = [
  { value: 1, label: "Mon", full: "Monday", type: "weekday" },
  { value: 2, label: "Tue", full: "Tuesday", type: "weekday" },
  { value: 3, label: "Wed", full: "Wednesday", type: "weekday" },
  { value: 4, label: "Thu", full: "Thursday", type: "weekday" },
  { value: 5, label: "Fri", full: "Friday", type: "weekday" },
  { value: 6, label: "Sat", full: "Saturday", type: "weekend" },
  { value: 0, label: "Sun", full: "Sunday", type: "weekend" },
];

const DEFAULT_SLOT_LABELS = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
];

const createDefaultDraft = () => ({
  enabledWeekdays: [1, 2, 3, 4, 5],
  slots: DEFAULT_SLOT_LABELS.map((label) => ({
    label,
    enabled: true,
    capacity: 5,
  })),
  blackoutDates: [],
});

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toISODate(date);
}

function formatRemainingSlots(slot) {
  const remaining = Number(slot?.remaining);
  if (!Number.isFinite(remaining)) return "";
  if (remaining <= 0) return "Full";
  return `${remaining} ${remaining === 1 ? "slot" : "slots"} left`;
}

function VisitAvailabilityTab() {
  const { data: currentUser } = useCurrentUser();
  const isBranchAdmin = currentUser?.role === "branch_admin";
  const branchOptions = useMemo(
    () =>
      isBranchAdmin
        ? [
            {
              value: currentUser?.branch || "gil-puyat",
              label: getBranchLabel(currentUser?.branch || "gil-puyat"),
            },
          ]
        : [
            { value: "gil-puyat", label: "Gil Puyat Branch" },
            { value: "guadalupe", label: "Guadalupe Branch" },
          ],
    [currentUser?.branch, isBranchAdmin],
  );

  const [branch, setBranch] = useState(branchOptions[0]?.value || "gil-puyat");
  const [draft, setDraft] = useState(createDefaultDraft);
  const [usageDate, setUsageDate] = useState(getTomorrowISO);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conflictReport, setConflictReport] = useState(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [slotVisitorInspect, setSlotVisitorInspect] = useState(null);

  const canLoadSettings =
    Boolean(currentUser) && (!isBranchAdmin || branch === currentUser.branch);
  const { data: settings, isLoading } = useVisitAvailabilitySettings(branch, {
    enabled: canLoadSettings,
  });
  const {
    data: liveAvailability,
    isError: liveUsageError,
    isLoading: liveUsageLoading,
    refetch: refetchLiveUsage,
  } = useVisitAvailability(
    { branch, from: usageDate, days: 1 },
    { enabled: canLoadSettings && Boolean(usageDate) },
  );
  const updateSettings = useUpdateVisitAvailabilitySettings();
  const preflightCheck = useVisitAvailabilityPreflight();

  useEffect(() => {
    if (isBranchAdmin && currentUser?.branch && branch !== currentUser.branch) {
      setBranch(currentUser.branch);
    }
  }, [branch, currentUser?.branch, isBranchAdmin]);

  useEffect(() => {
    if (!settings) return;
    setDraft({
      enabledWeekdays: settings.enabledWeekdays || [1, 2, 3, 4, 5],
      slots: settings.slots?.length ? settings.slots : createDefaultDraft().slots,
      blackoutDates: settings.blackoutDates || [],
    });
  }, [settings]);

  // Check if draft has unsaved modifications
  const isDirty = useMemo(() => {
    if (!settings) return false;
    const origWeekdays = settings.enabledWeekdays || [1, 2, 3, 4, 5];
    const origSlots = settings.slots || [];
    const origBlackouts = settings.blackoutDates || [];

    if (JSON.stringify(draft.enabledWeekdays.sort()) !== JSON.stringify([...origWeekdays].sort())) return true;
    if (draft.blackoutDates.length !== origBlackouts.length) return true;
    if (JSON.stringify(draft.blackoutDates) !== JSON.stringify(origBlackouts)) return true;

    if (draft.slots.length !== origSlots.length) return true;
    for (let i = 0; i < draft.slots.length; i++) {
      const d = draft.slots[i];
      const o = origSlots.find((s) => s.label === d.label);
      if (!o || d.enabled !== o.enabled || Number(d.capacity) !== Number(o.capacity)) return true;
    }
    return false;
  }, [draft, settings]);

  const activeSlots = draft.slots.filter((slot) => slot.enabled);
  const totalCapacity = activeSlots.reduce(
    (sum, slot) => sum + (Number(slot.capacity) || 0),
    0,
  );
  const liveDate = liveAvailability?.dates?.[0] || null;
  const liveSlotsByLabel = useMemo(() => {
    const slots = new Map();
    for (const slot of liveDate?.slots || []) {
      slots.set(slot.label, slot);
    }
    return slots;
  }, [liveDate]);

  const morningSlots = useMemo(
    () => draft.slots.filter((s) => s.label.includes("AM")),
    [draft.slots],
  );
  const afternoonSlots = useMemo(
    () => draft.slots.filter((s) => s.label.includes("PM")),
    [draft.slots],
  );

  const toggleWeekday = (day) => {
    setDraft((previous) => {
      const next = new Set(previous.enabledWeekdays);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...previous, enabledWeekdays: [...next].sort((a, b) => a - b) };
    });
  };

  const selectWeekdaysOnly = () => {
    setDraft((prev) => ({ ...prev, enabledWeekdays: [1, 2, 3, 4, 5] }));
  };

  const selectAllDays = () => {
    setDraft((prev) => ({ ...prev, enabledWeekdays: [0, 1, 2, 3, 4, 5, 6] }));
  };

  const updateSlot = (index, patch) => {
    setDraft((previous) => ({
      ...previous,
      slots: previous.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    }));
  };

  const setAllSlotsCapacity = (newCapacity) => {
    setDraft((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => ({ ...s, capacity: Math.max(0, newCapacity) })),
    }));
  };

  const toggleAllSlots = (enable) => {
    setDraft((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => ({ ...s, enabled: enable })),
    }));
  };

  const addBlackout = () => {
    setDraft((previous) => ({
      ...previous,
      blackoutDates: [{ date: "", reason: "" }, ...previous.blackoutDates],
    }));
  };

  const updateBlackout = (index, patch) => {
    setDraft((previous) => ({
      ...previous,
      blackoutDates: previous.blackoutDates.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const removeBlackout = (index) => {
    setDraft((previous) => ({
      ...previous,
      blackoutDates: previous.blackoutDates.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetToDefault = () => {
    setDraft(createDefaultDraft());
    showNotification("Reset to standard defaults", "info", 2500);
  };

  const executeSave = async (payload, extraData = {}) => {
    try {
      await updateSettings.mutateAsync({
        branch,
        data: {
          ...payload,
          ...extraData,
        },
      });
      setWarningModalOpen(false);
      setConflictReport(null);
      showNotification("Visit availability rules saved successfully", "success", 3000);
    } catch (error) {
      showNotification(
        error?.response?.data?.error || "Failed to save visit availability rules.",
        "error",
        4000,
      );
    }
  };

  const save = async () => {
    const payload = {
      enabledWeekdays: draft.enabledWeekdays,
      slots: draft.slots.map((slot) => ({
        ...slot,
        capacity: Math.max(0, Math.floor(Number(slot.capacity) || 0)),
      })),
      blackoutDates: draft.blackoutDates.filter((item) => item.date),
    };

    try {
      const res = await preflightCheck.mutateAsync({
        branch,
        data: payload,
      });

      const report = res?.data || res;
      if (report && report.hasConflicts) {
        setConflictReport(report);
        setWarningModalOpen(true);
        return;
      }

      await executeSave(payload);
    } catch (error) {
      showNotification(
        error?.response?.data?.error || "Failed to verify schedule conflicts before saving.",
        "error",
        4000,
      );
    }
  };

  const handleConfirmConflictSave = async ({ adminNote }) => {
    const payload = {
      enabledWeekdays: draft.enabledWeekdays,
      slots: draft.slots.map((slot) => ({
        ...slot,
        capacity: Math.max(0, Math.floor(Number(slot.capacity) || 0)),
      })),
      blackoutDates: draft.blackoutDates.filter((item) => item.date),
    };

    await executeSave(payload, {
      acknowledgeConflicts: true,
      adminNote,
    });
  };

  return (
    <div className="visit-avail-redesign">
      {/* HEADER SECTION */}
      <div className="visit-avail-header">
        <div className="visit-avail-header__title">
          <div className="visit-avail-badge">
            <Sliders size={14} />
            <span>Schedule Control System</span>
          </div>
          <h2>Physical Visit & Viewing Availability Rules</h2>
          <p>
            Configure weekly operating days, custom time slots, per-slot visitor caps, and blackout dates per branch.
          </p>
        </div>

        <div className="visit-avail-header__controls">
          <div className="visit-avail-branch-picker">
            <Building2 size={15} />
            <select
              value={branch}
              disabled={isBranchAdmin}
              onChange={(event) => setBranch(event.target.value)}
            >
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isDirty && (
            <div className="visit-avail-dirty-pill">
              <span className="visit-avail-dirty-dot" />
              <span>Unsaved Changes</span>
            </div>
          )}

          <button
            type="button"
            className="res-action-btn res-action-btn--secondary"
            onClick={() => setHistoryOpen(true)}
            title="View Availability Rule Change History"
          >
            <History size={16} />
            <span>History</span>
          </button>

          <button
            type="button"
            className="res-action-btn res-action-btn--success visit-avail-save-btn"
            disabled={isLoading || updateSettings.isPending || preflightCheck.isPending}
            onClick={save}
          >
            <Save size={16} />
            <span>{updateSettings.isPending || preflightCheck.isPending ? "Checking..." : "Save"}</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="visit-avail-kpi-grid">
        <div className="visit-kpi-card visit-kpi-card--primary">
          <div className="visit-kpi-card__icon">
            <CalendarCheck size={20} />
          </div>
          <div className="visit-kpi-card__content">
            <span className="visit-kpi-card__value">{draft.enabledWeekdays.length} / 7</span>
            <span className="visit-kpi-card__label">Operating Days / Week</span>
          </div>
        </div>

        <div className="visit-kpi-card visit-kpi-card--accent">
          <div className="visit-kpi-card__icon">
            <Clock size={20} />
          </div>
          <div className="visit-kpi-card__content">
            <span className="visit-kpi-card__value">{activeSlots.length} Slots</span>
            <span className="visit-kpi-card__label">Active Time Windows</span>
          </div>
        </div>

        <div className="visit-kpi-card visit-kpi-card--success">
          <div className="visit-kpi-card__icon">
            <Users size={20} />
          </div>
          <div className="visit-kpi-card__content">
            <span className="visit-kpi-card__value">{totalCapacity} Visitors</span>
            <span className="visit-kpi-card__label">Max Daily Visit Cap</span>
          </div>
        </div>

        <div className="visit-kpi-card visit-kpi-card--warning">
          <div className="visit-kpi-card__icon">
            <CalendarX size={20} />
          </div>
          <div className="visit-kpi-card__content">
            <span className="visit-kpi-card__value">
              {draft.blackoutDates.filter((item) => item.date).length} Dates
            </span>
            <span className="visit-kpi-card__label">Configured Blackouts</span>
          </div>
        </div>
      </div>

      {/* PRESETS BAR */}
      <div className="visit-avail-presets-bar">
        <div className="visit-avail-presets-bar__label">
          <Sparkles size={15} />
          <span>Quick Presets:</span>
        </div>
        <div className="visit-avail-presets-bar__buttons">
          <button type="button" onClick={selectWeekdaysOnly} className="visit-preset-btn">
            Mon–Fri Only
          </button>
          <button type="button" onClick={selectAllDays} className="visit-preset-btn">
            7 Days Open
          </button>
          <button type="button" onClick={() => setAllSlotsCapacity(5)} className="visit-preset-btn">
            Cap = 5 / Slot
          </button>
          <button type="button" onClick={() => setAllSlotsCapacity(10)} className="visit-preset-btn">
            Cap = 10 / Slot
          </button>
          <button type="button" onClick={resetToDefault} className="visit-preset-btn visit-preset-btn--ghost">
            <RotateCcw size={13} />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONFIGURATION LAYOUT */}
      <div className="visit-avail-main-grid">
        {/* COLUMN 1: WEEKDAY OPERATING SCHEDULE */}
        <section className="visit-card">
          <div className="visit-card__header">
            <div className="visit-card__header-icon">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h3>Weekly Operating Schedule</h3>
              <p>Toggle which days of the week physical room viewings are open for booking.</p>
            </div>
          </div>

          <div className="visit-weekday-selector">
            {WEEKDAYS.map((day) => {
              const isOpen = draft.enabledWeekdays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={`visit-weekday-chip ${isOpen ? "visit-weekday-chip--open" : ""}`}
                  onClick={() => toggleWeekday(day.value)}
                >
                  <div className="visit-weekday-chip__top">
                    <strong>{day.label}</strong>
                    <span className={`visit-status-badge ${isOpen ? "visit-status-badge--open" : "visit-status-badge--closed"}`}>
                      {isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>
                  <span className="visit-weekday-chip__full">{day.full}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* COLUMN 2: TIME SLOTS & CAPACITY CONTROL */}
        <section className="visit-card">
          <div className="visit-card__header">
            <div className="visit-card__header-icon">
              <Clock size={18} />
            </div>
            <div>
              <h3>Time Slots & Visitor Capacity</h3>
              <p>Configure hourly viewing slots and maximum concurrent visitor capacity per window.</p>
            </div>
            <div className="visit-slot-quick-actions">
              <button
                type="button"
                className="visit-mini-btn"
                onClick={() => toggleAllSlots(true)}
                title="Enable all time slots"
              >
                Enable All
              </button>
              <button
                type="button"
                className="visit-mini-btn"
                onClick={() => toggleAllSlots(false)}
                title="Disable all time slots"
              >
                Disable All
              </button>
            </div>
          </div>

          <div className="visit-slot-groups">
            {/* MORNING SECTION */}
            <div className="visit-slot-group">
              <div className="visit-slot-group__title">
                <Sun size={15} />
                <span>Morning Session (AM)</span>
              </div>
              <div className="visit-slot-table">
                {morningSlots.map((slot) => {
                  const globalIndex = draft.slots.findIndex((s) => s.label === slot.label);
                  const rowId = `slot-row-${slot.label.replace(/\s+/g, "-").toLowerCase()}`;
                  return (
                    <div id={rowId} key={slot.label} className={`visit-slot-row ${slot.enabled ? "" : "visit-slot-row--disabled"}`}>
                      <div className="visit-slot-time">
                        <strong>{slot.label}</strong>
                      </div>
                      <label className="visit-custom-toggle">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) => updateSlot(globalIndex, { enabled: e.target.checked })}
                        />
                        <span className="visit-custom-toggle__slider" />
                        <span className="visit-custom-toggle__text">
                          {slot.enabled ? "Active" : "Closed"}
                        </span>
                      </label>
                      <div className="visit-slot-cap-input">
                        <button
                          type="button"
                          disabled={!slot.enabled || Number(slot.capacity) <= 0}
                          onClick={() => updateSlot(globalIndex, { capacity: Math.max(0, Number(slot.capacity) - 1) })}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={slot.capacity}
                          disabled={!slot.enabled}
                          onChange={(e) => updateSlot(globalIndex, { capacity: e.target.value })}
                        />
                        <button
                          type="button"
                          disabled={!slot.enabled}
                          onClick={() => updateSlot(globalIndex, { capacity: Number(slot.capacity) + 1 })}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AFTERNOON SECTION */}
            <div className="visit-slot-group">
              <div className="visit-slot-group__title">
                <Moon size={15} />
                <span>Afternoon Session (PM)</span>
              </div>
              <div className="visit-slot-table">
                {afternoonSlots.map((slot) => {
                  const globalIndex = draft.slots.findIndex((s) => s.label === slot.label);
                  const rowId = `slot-row-${slot.label.replace(/\s+/g, "-").toLowerCase()}`;
                  return (
                    <div id={rowId} key={slot.label} className={`visit-slot-row ${slot.enabled ? "" : "visit-slot-row--disabled"}`}>
                      <div className="visit-slot-time">
                        <strong>{slot.label}</strong>
                      </div>
                      <label className="visit-custom-toggle">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) => updateSlot(globalIndex, { enabled: e.target.checked })}
                        />
                        <span className="visit-custom-toggle__slider" />
                        <span className="visit-custom-toggle__text">
                          {slot.enabled ? "Active" : "Closed"}
                        </span>
                      </label>
                      <div className="visit-slot-cap-input">
                        <button
                          type="button"
                          disabled={!slot.enabled || Number(slot.capacity) <= 0}
                          onClick={() => updateSlot(globalIndex, { capacity: Math.max(0, Number(slot.capacity) - 1) })}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={slot.capacity}
                          disabled={!slot.enabled}
                          onChange={(e) => updateSlot(globalIndex, { capacity: e.target.value })}
                        />
                        <button
                          type="button"
                          disabled={!slot.enabled}
                          onClick={() => updateSlot(globalIndex, { capacity: Number(slot.capacity) + 1 })}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* FULL-WIDTH CARD 3: REAL-TIME LIVE SLOT MONITOR */}
        <section className="visit-card visit-card--full">
          <div className="visit-card__header">
            <div className="visit-card__header-icon">
              <Users size={18} />
            </div>
            <div>
              <h3>Real-Time Live Slot Occupancy Monitor</h3>
              <p>Inspect visitor bookings and remaining slot capacities for any selected calendar date.</p>
            </div>
            <div className="visit-live-picker-group">
              <label>
                <span>Viewing Date</span>
                <input
                  type="date"
                  value={usageDate}
                  onChange={(event) => setUsageDate(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="visit-mini-btn"
                onClick={() => refetchLiveUsage()}
                title="Refresh live occupancy data"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>
          </div>

          <div className="visit-live-grid">
            {liveUsageLoading && (
              <div className="visit-empty-box">
                <RefreshCw size={22} className="spin" />
                <span>Loading live slot usage data...</span>
              </div>
            )}
            {liveUsageError && (
              <div className="visit-empty-box visit-empty-box--error">
                <AlertCircle size={22} />
                <span>Unable to load live slot occupancy. Ensure branch is selected.</span>
              </div>
            )}
            {!liveUsageLoading &&
              !liveUsageError &&
              draft.slots.map((configuredSlot) => {
                const liveSlot = liveSlotsByLabel.get(configuredSlot.label);
                const bookedCount = liveSlot?.count || 0;
                const capacity = Number(configuredSlot.capacity) || 1;
                const pct = Math.min(100, Math.round((bookedCount / capacity) * 100));

                const isFull =
                  liveSlot?.disabledCode === "VISIT_CAPACITY_REACHED" ||
                  Number(liveSlot?.remaining) <= 0;
                const isClosed =
                  !configuredSlot.enabled ||
                  (liveSlot && (!liveSlot.available || liveSlot.enabled === false) && !isFull);

                return (
                  <div
                    key={configuredSlot.label}
                    onClick={() => {
                      if (bookedCount > 0) {
                        setSlotVisitorInspect({ slot: configuredSlot.label, date: usageDate });
                      }
                    }}
                    className={`visit-live-card ${isFull ? "visit-live-card--full" : ""} ${isClosed ? "visit-live-card--closed" : ""} ${bookedCount > 0 ? "visit-live-card--interactive cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-2xs hover:shadow-xs" : ""}`}
                    title={bookedCount > 0 ? `Click to inspect ${bookedCount} visitor(s)` : `${configuredSlot.label} — ${bookedCount} bookings`}
                  >
                    <div className="visit-live-card__header">
                      <strong>{configuredSlot.label}</strong>
                      <span className={`visit-live-card__badge ${bookedCount > 0 ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold" : ""}`}>
                        {isClosed ? "CLOSED" : isFull ? "FULL" : `${bookedCount}/${capacity} Booked`}
                      </span>
                    </div>

                    <div className="visit-live-card__meter">
                      <div
                        className={`visit-live-card__fill ${pct >= 100 ? "full" : pct >= 70 ? "warning" : ""}`}
                        style={{ width: `${isClosed ? 0 : pct}%` }}
                      />
                    </div>

                    <div className="visit-live-card__footer flex items-center justify-between">
                      <span>
                        {isClosed
                          ? "Slot Disabled"
                          : liveSlot
                            ? formatRemainingSlots(liveSlot)
                            : `${capacity} Available`}
                      </span>
                      {bookedCount > 0 && (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 underline">
                          View &rarr;
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* FULL-WIDTH CARD 4: BLACKOUT DATES & SPECIAL CLOSURES */}
        <section className="visit-card visit-card--full">
          <div className="visit-card__header">
            <div className="visit-card__header-icon">
              <CalendarX size={18} />
            </div>
            <div>
              <h3>Blackout Dates & Special Closures</h3>
              <p>Block specific calendar dates for holidays, maintenance, or staff events.</p>
            </div>
            <button type="button" className="res-action-btn res-action-btn--primary" onClick={addBlackout}>
              <Plus size={15} />
              <span>Add Blackout Date</span>
            </button>
          </div>

          <div className="visit-blackout-container">
            {draft.blackoutDates.length === 0 ? (
              <div className="visit-empty-box">
                <CheckCircle2 size={24} />
                <span>No blackout dates currently configured. All open weekdays are available for booking.</span>
              </div>
            ) : (
              <div className="visit-blackout-grid">
                {draft.blackoutDates.map((item, index) => (
                  <div key={`${item.date}-${index}`} className="visit-blackout-item">
                    <div className="visit-blackout-item__inputs">
                      <div className="visit-input-field">
                        <label>Blackout Date</label>
                        <input
                          type="date"
                          value={item.date || ""}
                          onChange={(e) => updateBlackout(index, { date: e.target.value })}
                        />
                      </div>
                      <div className="visit-input-field visit-input-field--flex">
                        <label>Reason / Closure Note</label>
                        <input
                          type="text"
                          value={item.reason || ""}
                          placeholder="e.g. Regular Holiday, Building Maintenance"
                          onChange={(e) => updateBlackout(index, { reason: e.target.value })}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="res-icon-btn res-icon-btn--danger"
                      onClick={() => removeBlackout(index)}
                      title="Remove blackout date"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <VisitAvailabilityHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        branch={branch}
      />

      <VisitConflictWarningModal
        isOpen={warningModalOpen}
        conflictReport={conflictReport}
        onCancel={() => setWarningModalOpen(false)}
        onConfirmSave={handleConfirmConflictSave}
        isSaving={updateSettings.isPending}
      />

      <VisitSlotVisitorsModal
        isOpen={Boolean(slotVisitorInspect)}
        onClose={() => setSlotVisitorInspect(null)}
        branch={branch}
        date={slotVisitorInspect?.date}
        slot={slotVisitorInspect?.slot}
      />
    </div>
  );
}

export default VisitAvailabilityTab;
