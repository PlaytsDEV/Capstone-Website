import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Plus,
  Save,
  Trash2,
  CalendarX,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Building2,
  RotateCcw,
  History,
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
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
import ConfirmModal from "../../../shared/components/ConfirmModal";
import VisitAvailabilityHistoryDrawer from "./VisitAvailabilityHistoryDrawer";
import VisitConflictWarningModal from "./VisitConflictWarningModal";
import VisitSlotVisitorsModal from "./VisitSlotVisitorsModal";
import AddBlackoutDateModal from "./AddBlackoutDateModal";
import {
  getTodayISO,
  getBlackoutDateStatus,
  filterAndSortBlackouts,
  partitionExpiredBlackouts,
  formatBlackoutDateDisplay,
} from "../utils/visitPresetDates";
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
  dayOverrides: {},
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

  // Blackout toolbar & pagination state
  const BLACKOUT_PAGE_SIZE = 10;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [blackoutSearch, setBlackoutSearch] = useState("");
  const [blackoutStatusFilter, setBlackoutStatusFilter] = useState("all");
  const [blackoutSortOrder, setBlackoutSortOrder] = useState("asc");
  const [blackoutPage, setBlackoutPage] = useState(1);
  const [editingBlackoutIndex, setEditingBlackoutIndex] = useState(null);
  const [editBlackoutForm, setEditBlackoutForm] = useState({ date: "", reason: "" });
  const [isSavingBlackout, setIsSavingBlackout] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    variant: "danger",
    confirmText: "Delete",
    onConfirm: null,
  });
  // Day-selector panel state: null = auto-select first enabled weekday
  const [selectedDay, setSelectedDay] = useState(null);

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
      dayOverrides: settings.dayOverrides || {},
    });
  }, [settings]);

  // Check if draft has unsaved modifications
  const isDirty = useMemo(() => {
    if (!settings) return false;
    const origWeekdays = settings.enabledWeekdays || [1, 2, 3, 4, 5];
    const origSlots = settings.slots || [];
    const origBlackouts = settings.blackoutDates || [];
    const origDayOverrides = settings.dayOverrides || {};

    if (JSON.stringify(draft.enabledWeekdays.sort()) !== JSON.stringify([...origWeekdays].sort())) return true;
    if (draft.blackoutDates.length !== origBlackouts.length) return true;
    if (JSON.stringify(draft.blackoutDates) !== JSON.stringify(origBlackouts)) return true;
    if (JSON.stringify(draft.dayOverrides) !== JSON.stringify(origDayOverrides)) return true;

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

  const startEditBlackout = (originalIndex, item) => {
    setEditingBlackoutIndex(originalIndex);
    setEditBlackoutForm({ date: item.date || "", reason: item.reason || "" });
  };

  const cancelEditBlackout = () => {
    setEditingBlackoutIndex(null);
    setEditBlackoutForm({ date: "", reason: "" });
  };

  /**
   * Immediately persists blackout-only changes to the database.
   * Uses server-saved weekdays + slots to avoid accidentally committing
   * any unsaved schedule edits the admin may have in progress.
   */
  const persistBlackouts = async (
    newBlackoutDates,
    { skipConflictCheck = false, successMessage } = {},
  ) => {
    setIsSavingBlackout(true);
    const savedSlots = (settings?.slots?.length ? settings.slots : draft.slots).map((slot) => ({
      ...slot,
      capacity: Math.max(0, Math.floor(Number(slot.capacity) || 0)),
    }));
    const payload = {
      enabledWeekdays: settings?.enabledWeekdays ?? draft.enabledWeekdays,
      slots: savedSlots,
      blackoutDates: newBlackoutDates.filter((item) => item.date),
    };
    try {
      if (!skipConflictCheck) {
        const res = await preflightCheck.mutateAsync({ branch, data: payload });
        const report = res?.data || res;
        if (report && report.hasConflicts) {
          setConflictReport(report);
          setWarningModalOpen(true);
          return;
        }
      }
      await updateSettings.mutateAsync({ branch, data: payload });
      setWarningModalOpen(false);
      setConflictReport(null);
      showNotification(successMessage || "Blackout dates saved", "success", 3000);
    } catch (error) {
      showNotification(
        error?.response?.data?.error || "Failed to save blackout date.",
        "error",
        4000,
      );
    } finally {
      setIsSavingBlackout(false);
    }
  };

  const saveEditBlackout = async (originalIndex) => {
    if (!editBlackoutForm.date) return;
    const newBlackoutDates = draft.blackoutDates.map((item, itemIndex) =>
      itemIndex === originalIndex
        ? { date: editBlackoutForm.date, reason: editBlackoutForm.reason.trim() }
        : item,
    );
    setDraft((previous) => ({ ...previous, blackoutDates: newBlackoutDates }));
    setEditingBlackoutIndex(null);
    await persistBlackouts(newBlackoutDates, {
      successMessage: "Blackout date updated and saved",
    });
  };

  const handleConfirmAddBlackout = async ({ date, reason }) => {
    const newBlackoutDates = [{ date, reason }, ...draft.blackoutDates];
    setDraft((previous) => ({ ...previous, blackoutDates: newBlackoutDates }));
    await persistBlackouts(newBlackoutDates, {
      successMessage: `Blackout date added — ${date} is now blocked for visits`,
    });
  };

  const updateBlackout = (index, patch) => {
    setDraft((previous) => ({
      ...previous,
      blackoutDates: previous.blackoutDates.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const removeBlackout = async (index) => {
    const newBlackoutDates = draft.blackoutDates.filter((_, itemIndex) => itemIndex !== index);
    setDraft((previous) => ({ ...previous, blackoutDates: newBlackoutDates }));
    await persistBlackouts(newBlackoutDates, {
      skipConflictCheck: true,
      successMessage: "Blackout date removed",
    });
  };

  const promptRemoveBlackout = (index, item) => {
    const dateDisplay = formatBlackoutDateDisplay(item.date);
    const reasonText = item.reason ? ` (${item.reason})` : "";
    setConfirmModal({
      open: true,
      title: "Delete Blackout Date",
      message: `Are you sure you want to delete the blackout date for ${dateDisplay}${reasonText}? This will unblock visit bookings for this date.`,
      variant: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmModal((previous) => ({ ...previous, open: false }));
        await removeBlackout(index);
      },
    });
  };

  const handleRemoveExpiredBlackouts = async () => {
    const todayISO = getTodayISO();
    const { active, expired } = partitionExpiredBlackouts(draft.blackoutDates, todayISO);
    if (expired.length === 0) return;
    setDraft((previous) => ({ ...previous, blackoutDates: active }));
    await persistBlackouts(active, {
      skipConflictCheck: true,
      successMessage: `Removed ${expired.length} expired blackout date(s) and saved`,
    });
  };

  const promptRemoveExpiredBlackouts = () => {
    const todayISO = getTodayISO();
    const { expired } = partitionExpiredBlackouts(draft.blackoutDates, todayISO);
    if (expired.length === 0) return;

    setConfirmModal({
      open: true,
      title: "Clear Expired Blackout Dates",
      message: `Are you sure you want to remove ${expired.length} expired blackout date(s) older than today?`,
      variant: "danger",
      confirmText: "Clear Expired",
      onConfirm: async () => {
        setConfirmModal((previous) => ({ ...previous, open: false }));
        await handleRemoveExpiredBlackouts();
      },
    });
  };

  const resetToDefault = () => {
    setDraft(createDefaultDraft());
    setSelectedDay(null);
    showNotification("Reset to standard defaults", "info", 2500);
  };

  const discardChanges = () => {
    if (!settings) return;
    setDraft({
      enabledWeekdays: settings.enabledWeekdays || [1, 2, 3, 4, 5],
      slots: settings.slots?.length ? settings.slots : createDefaultDraft().slots,
      blackoutDates: settings.blackoutDates || [],
      dayOverrides: settings.dayOverrides || {},
    });
    setSelectedDay(null);
    showNotification("Discarded unsaved changes", "info", 2500);
  };

  /**
   * Toggles the per-day enabled override for a specific slot on a specific weekday.
   * Maintains sparse state by removing key if it matches master defaults.
   */
  const toggleDaySlot = (weekday, slotLabel) => {
    setDraft((previous) => {
      const globalSlot = previous.slots.find((s) => s.label === slotLabel);
      const existingOverride = previous.dayOverrides?.[weekday]?.[slotLabel] || {};
      const currentEffective = existingOverride.enabled !== undefined
        ? existingOverride.enabled
        : (globalSlot?.enabled ?? true);
      const newEnabled = !currentEffective;

      const updatedDay = { ...(previous.dayOverrides?.[weekday] || {}) };
      const currentCap = existingOverride.capacity !== undefined ? existingOverride.capacity : globalSlot?.capacity;

      const isEnabledDefault = newEnabled === globalSlot?.enabled;
      const isCapDefault = currentCap === globalSlot?.capacity;

      if (isEnabledDefault && isCapDefault) {
        delete updatedDay[slotLabel];
      } else {
        const nextSlotOverride = { ...existingOverride, enabled: newEnabled };
        if (isCapDefault) delete nextSlotOverride.capacity;
        updatedDay[slotLabel] = nextSlotOverride;
      }

      const updatedOverrides = { ...previous.dayOverrides };
      if (Object.keys(updatedDay).length === 0) {
        delete updatedOverrides[weekday];
      } else {
        updatedOverrides[weekday] = updatedDay;
      }

      return { ...previous, dayOverrides: updatedOverrides };
    });
  };

  /**
   * Updates visitor capacity specifically for a single slot on a single weekday.
   */
  const updateDaySlotCapacity = (weekday, slotLabel, newCapacity) => {
    const parsedCap = Math.max(0, Math.floor(Number(newCapacity) || 0));
    setDraft((previous) => {
      const globalSlot = previous.slots.find((s) => s.label === slotLabel);
      const existingOverride = previous.dayOverrides?.[weekday]?.[slotLabel] || {};
      const currentEnabled = existingOverride.enabled !== undefined ? existingOverride.enabled : globalSlot?.enabled;

      const updatedDay = { ...(previous.dayOverrides?.[weekday] || {}) };
      const isCapDefault = parsedCap === globalSlot?.capacity;
      const isEnabledDefault = currentEnabled === globalSlot?.enabled;

      if (isCapDefault && isEnabledDefault) {
        delete updatedDay[slotLabel];
      } else {
        const nextSlotOverride = { ...existingOverride, capacity: parsedCap };
        if (isEnabledDefault) delete nextSlotOverride.enabled;
        updatedDay[slotLabel] = nextSlotOverride;
      }

      const updatedOverrides = { ...previous.dayOverrides };
      if (Object.keys(updatedDay).length === 0) {
        delete updatedOverrides[weekday];
      } else {
        updatedOverrides[weekday] = updatedDay;
      }

      return { ...previous, dayOverrides: updatedOverrides };
    });
  };

  /**
   * Enables or disables all time slots specifically for a single weekday without affecting other days.
   */
  const toggleAllSlotsForDay = (weekday, enable) => {
    setDraft((previous) => {
      const updatedDay = { ...(previous.dayOverrides?.[weekday] || {}) };
      for (const slot of previous.slots) {
        if (enable === slot.enabled) {
          delete updatedDay[slot.label];
        } else {
          updatedDay[slot.label] = { enabled: enable };
        }
      }
      const updatedOverrides = { ...previous.dayOverrides };
      if (Object.keys(updatedDay).length === 0) {
        delete updatedOverrides[weekday];
      } else {
        updatedOverrides[weekday] = updatedDay;
      }
      return { ...previous, dayOverrides: updatedOverrides };
    });
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
      dayOverrides: draft.dayOverrides || {},
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
      dayOverrides: draft.dayOverrides || {},
    };

    await executeSave(payload, {
      acknowledgeConflicts: true,
      adminNote,
    });
  };

  const todayISO = getTodayISO();
  const processedBlackouts = useMemo(() => {
    return filterAndSortBlackouts(
      draft.blackoutDates,
      {
        search: blackoutSearch,
        statusFilter: blackoutStatusFilter,
        sortOrder: blackoutSortOrder,
      },
      todayISO
    );
  }, [draft.blackoutDates, blackoutSearch, blackoutStatusFilter, blackoutSortOrder, todayISO]);

  // Reset pagination page when filters, search, or blackout count changes
  useEffect(() => {
    setBlackoutPage(1);
  }, [blackoutSearch, blackoutStatusFilter, blackoutSortOrder, draft.blackoutDates.length]);

  const totalBlackoutPages = useMemo(
    () => Math.max(1, Math.ceil(processedBlackouts.length / BLACKOUT_PAGE_SIZE)),
    [processedBlackouts.length]
  );

  const pagedBlackouts = useMemo(() => {
    const start = (blackoutPage - 1) * BLACKOUT_PAGE_SIZE;
    return processedBlackouts.slice(start, start + BLACKOUT_PAGE_SIZE);
  }, [processedBlackouts, blackoutPage]);

  const blackoutStats = useMemo(() => {
    let upcoming = 0;
    let today = 0;
    let past = 0;
    for (const item of draft.blackoutDates) {
      const status = getBlackoutDateStatus(item.date, todayISO);
      if (status === "upcoming") upcoming++;
      else if (status === "today") today++;
      else if (status === "past") past++;
    }
    return {
      total: draft.blackoutDates.length,
      upcoming,
      today,
      past,
    };
  }, [draft.blackoutDates, todayISO]);

  return (
    <div className="visit-avail-redesign">
      {/* TOOLBAR CONTROLS BAR */}
      <div className="visit-avail-toolbar">
        <div className="visit-avail-toolbar__left">
          <div className="visit-avail-branch-picker">
            <Building2 size={15} />
            <select
              value={branch}
              disabled={isBranchAdmin}
              onChange={(event) => setBranch(event.target.value)}
              aria-label="Select branch for availability rules"
            >
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isDirty && (
            <div className="visit-avail-dirty-group">
              <div className="visit-avail-dirty-pill">
                <span className="visit-avail-dirty-dot" />
                <span>Unsaved Changes</span>
              </div>
              <button
                type="button"
                className="visit-discard-btn"
                onClick={discardChanges}
                title="Discard unsaved changes and revert to last saved state"
              >
                <X size={13} />
                <span>Discard</span>
              </button>
            </div>
          )}
        </div>

        <div className="visit-avail-toolbar__actions">
          <button
            type="button"
            className="res-action-btn res-action-btn--secondary"
            onClick={() => setHistoryOpen(true)}
            title="View audit logs & rule change history"
          >
            <History size={15} />
            <span>History</span>
          </button>

          <button
            type="button"
            className="res-action-btn res-action-btn--secondary"
            onClick={resetToDefault}
            title="Reset form values to default system settings"
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            disabled={updateSettings.isPending || isSavingBlackout || isLoading}
            className={`res-action-btn visit-avail-save-btn ${isDirty ? "visit-avail-save-btn--active" : "visit-avail-save-btn--clean"}`}
            onClick={save}
          >
            {updateSettings.isPending ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <Save size={15} />
            )}
            <span>{updateSettings.isPending ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* UNIFIED DAY-SELECTOR PANEL */}
      <section className="visit-card visit-card--full">
        <div className="visit-card__header">
          <div className="visit-card__header-icon">
            <CalendarCheck size={18} />
          </div>
          <div className="visit-card__header-text">
            <h3>Operating Schedule Configuration</h3>
            <p>Set operating days, configure time slots and visitor caps, and manage per-day slot exceptions.</p>
          </div>
          <div className="visit-card__header-actions">
            <div className="visit-cap-quick-set">
              <span className="visit-cap-label">Quick Cap:</span>
              <div className="visit-cap-pills">
                <button type="button" className="visit-cap-pill" onClick={() => setAllSlotsCapacity(3)}>3</button>
                <button type="button" className="visit-cap-pill" onClick={() => setAllSlotsCapacity(5)}>5</button>
                <button type="button" className="visit-cap-pill" onClick={() => setAllSlotsCapacity(10)}>10</button>
              </div>
            </div>
            <div className="visit-header-divider" />
            <button
              type="button"
              className="visit-mini-btn"
              onClick={() => {
                const activeDay = selectedDay ?? draft.enabledWeekdays[0] ?? 1;
                toggleAllSlotsForDay(activeDay, true);
              }}
              title="Enable all time slots for the selected day"
            >
              Enable All
            </button>
            <button
              type="button"
              className="visit-mini-btn"
              onClick={() => {
                const activeDay = selectedDay ?? draft.enabledWeekdays[0] ?? 1;
                toggleAllSlotsForDay(activeDay, false);
              }}
              title="Disable all time slots for the selected day"
            >
              Disable All
            </button>
          </div>
        </div>

        <div className="visit-card__body">
          {/* DAY TABS ROW */}
          <div className="visit-day-tabs-container">
            <div className="visit-day-tabs">
              {WEEKDAYS.map((day) => {
                const isOperating = draft.enabledWeekdays.includes(day.value);
                const activeDay = selectedDay ?? draft.enabledWeekdays[0] ?? 1;
                const isActive = activeDay === day.value;
                const hasOverrides = Object.keys(draft.dayOverrides?.[day.value] || {}).length > 0;
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setSelectedDay(day.value)}
                    className={`visit-day-tab ${isActive ? "visit-day-tab--active" : ""} ${!isOperating ? "visit-day-tab--off" : ""}`}
                    title={isOperating ? `${day.full} — operating` : `${day.full} — day off`}
                  >
                    <div className="visit-day-tab__top">
                      <span className="visit-day-tab__short">{day.label}</span>
                      <div className="visit-day-tab__toggle">
                        <input
                          type="checkbox"
                          checked={isOperating}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleWeekday(day.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          title={isOperating ? "Disable this day" : "Enable this day"}
                        />
                      </div>
                    </div>
                    <span className="visit-day-tab__full">{day.full}</span>
                    {hasOverrides && <span className="visit-day-tab__override-dot" title="Has per-day slot exceptions" />}
                  </button>
                );
              })}
            </div>
            <div className="visit-day-tab-presets">
              <button type="button" className="visit-mini-btn" onClick={selectWeekdaysOnly}>Mon – Fri</button>
              <button type="button" className="visit-mini-btn" onClick={selectAllDays}>All 7 Days</button>
            </div>
          </div>

          {/* SELECTED DAY SLOT PANEL */}
          {(() => {
            const activeDay = selectedDay ?? draft.enabledWeekdays[0] ?? 1;
            const activeDayInfo = WEEKDAYS.find((d) => d.value === activeDay);
            const isDayOperating = draft.enabledWeekdays.includes(activeDay);
            const dayOverridesForDay = draft.dayOverrides?.[activeDay] || {};

            const slotGroups = [
              { label: "Morning Session (AM)", icon: <Sun size={14} />, slots: draft.slots.filter((s) => s.label.includes("AM")) },
              { label: "Afternoon Session (PM)", icon: <Moon size={14} />, slots: draft.slots.filter((s) => s.label.includes("PM")) },
            ];

            return (
              <div className={`visit-day-slot-panel ${!isDayOperating ? "visit-day-slot-panel--dimmed" : ""}`}>
                <div className="visit-day-slot-panel__heading">
                  <span className="visit-day-slot-panel__day-name">{activeDayInfo?.full ?? "Selected Day"}</span>
                  {!isDayOperating && (
                    <span className="visit-day-slot-panel__off-badge">Day Off — pre-configure slots for when this day is re-enabled</span>
                  )}
                  {isDayOperating && Object.keys(dayOverridesForDay).length > 0 && (
                    <span className="visit-day-slot-panel__override-badge">
                      {Object.keys(dayOverridesForDay).length} custom slot rule{Object.keys(dayOverridesForDay).length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="visit-slot-groups visit-slot-groups--2col">
                  {slotGroups.map((group) => (
                    <div key={group.label} className="visit-slot-group">
                      <div className="visit-slot-group__title">
                        {group.icon}
                        <span>{group.label}</span>
                      </div>
                      <div className="visit-slot-table">
                        {group.slots.map((slot) => {
                          const globalIndex = draft.slots.findIndex((s) => s.label === slot.label);
                          const dayOverride = dayOverridesForDay[slot.label];
                          const effectiveEnabled = dayOverride?.enabled !== undefined ? dayOverride.enabled : slot.enabled;
                          const effectiveCapacity = dayOverride?.capacity !== undefined ? dayOverride.capacity : slot.capacity;
                          const hasOverride = dayOverride !== undefined && (dayOverride.enabled !== undefined || dayOverride.capacity !== undefined);
                          const rowId = `slot-row-${slot.label.replace(/\s+/g, "-").toLowerCase()}-day${activeDay}`;

                          return (
                            <div
                              id={rowId}
                              key={slot.label}
                              className={`visit-slot-row ${effectiveEnabled ? "" : "visit-slot-row--disabled"} ${hasOverride ? "visit-slot-row--overridden" : ""}`}
                            >
                              <div className="visit-slot-time">
                                <strong>{slot.label}</strong>
                                {hasOverride && (
                                  <span className="visit-slot-override-tag" title="This slot has a custom setting for this day">
                                    Custom
                                  </span>
                                )}
                              </div>

                              {/* Per-day toggle (affects this day only) */}
                              <label className="visit-custom-toggle" title={effectiveEnabled ? "Disable for this day only" : "Enable for this day"}>
                                <input
                                  type="checkbox"
                                  checked={effectiveEnabled}
                                  onChange={() => toggleDaySlot(activeDay, slot.label)}
                                />
                                <span className="visit-custom-toggle__slider" />
                                <span className="visit-custom-toggle__text">
                                  {effectiveEnabled ? "Active" : "Off this day"}
                                </span>
                              </label>

                              {/* Per-day capacity stepper */}
                              <div className="visit-slot-cap-input" title="Set visitor cap for this day">
                                <button
                                  type="button"
                                  disabled={!effectiveEnabled || Number(effectiveCapacity) <= 0}
                                  onClick={() => updateDaySlotCapacity(activeDay, slot.label, Math.max(0, Number(effectiveCapacity) - 1))}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={effectiveCapacity}
                                  disabled={!effectiveEnabled}
                                  onChange={(e) => updateDaySlotCapacity(activeDay, slot.label, e.target.value)}
                                />
                                <button
                                  type="button"
                                  disabled={!effectiveEnabled}
                                  onClick={() => updateDaySlotCapacity(activeDay, slot.label, Number(effectiveCapacity) + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* POLICY SUMMARY ROW */}
          <div className="visit-policy-summary visit-policy-summary--inline">
            <div className="visit-policy-stat">
              <span className="visit-policy-stat__value">{draft.enabledWeekdays.length}</span>
              <span className="visit-policy-stat__label">Operating Days / Wk</span>
            </div>
            <div className="visit-policy-stat">
              <span className="visit-policy-stat__value">{activeSlots.length}</span>
              <span className="visit-policy-stat__label">Active Global Slots</span>
            </div>
            <div className="visit-policy-stat">
              <span className="visit-policy-stat__value">{totalCapacity}</span>
              <span className="visit-policy-stat__label">Max Visitors / Day</span>
            </div>
            <div className="visit-policy-stat">
              <span className="visit-policy-stat__value">{Object.keys(draft.dayOverrides || {}).length}</span>
              <span className="visit-policy-stat__label">Days with Exceptions</span>
            </div>
          </div>
        </div>
      </section>


      {/* REAL-TIME LIVE SLOT MONITOR */}
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
            <div className="visit-blackout-header-actions">
              <button
                type="button"
                className="res-action-btn res-action-btn--primary"
                onClick={() => setIsAddModalOpen(true)}
                disabled={isSavingBlackout}
                title="Open modal to add a blackout calendar date entry"
              >
                <Plus size={15} />
                <span>Add Blackout Date</span>
              </button>
            </div>
          </div>

          {/* TOOLBAR: SEARCH, STATUS TABS, SORT, & EXPIRED CLEANUP */}
          {draft.blackoutDates.length > 0 && (
            <div className="visit-blackout-toolbar">
              <div className="visit-blackout-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Filter by date or reason..."
                  value={blackoutSearch}
                  onChange={(e) => setBlackoutSearch(e.target.value)}
                />
                {blackoutSearch && (
                  <button
                    type="button"
                    className="visit-blackout-search-clear"
                    onClick={() => setBlackoutSearch("")}
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="visit-blackout-tabs">
                <button
                  type="button"
                  className={`visit-blackout-tab ${blackoutStatusFilter === "all" ? "active" : ""}`}
                  onClick={() => setBlackoutStatusFilter("all")}
                >
                  All ({blackoutStats.total})
                </button>
                <button
                  type="button"
                  className={`visit-blackout-tab ${blackoutStatusFilter === "upcoming" ? "active" : ""}`}
                  onClick={() => setBlackoutStatusFilter("upcoming")}
                >
                  Upcoming ({blackoutStats.upcoming})
                </button>
                <button
                  type="button"
                  className={`visit-blackout-tab ${blackoutStatusFilter === "today" ? "active" : ""}`}
                  onClick={() => setBlackoutStatusFilter("today")}
                >
                  Today ({blackoutStats.today})
                </button>
                <button
                  type="button"
                  className={`visit-blackout-tab ${blackoutStatusFilter === "past" ? "active" : ""}`}
                  onClick={() => setBlackoutStatusFilter("past")}
                >
                  Past ({blackoutStats.past})
                </button>
              </div>

              <div className="visit-blackout-toolbar-right">
                <button
                  type="button"
                  className="visit-blackout-sort-btn"
                  onClick={() =>
                    setBlackoutSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                  title={`Sort by date (${blackoutSortOrder === "asc" ? "Ascending" : "Descending"})`}
                >
                  <ArrowUpDown size={14} />
                  <span>{blackoutSortOrder === "asc" ? "Date Asc" : "Date Desc"}</span>
                </button>

                <button
                  type="button"
                  className="visit-blackout-clean-btn"
                  disabled={blackoutStats.past === 0}
                  title={
                    blackoutStats.past === 0
                      ? "No expired blackout dates to remove"
                      : `Remove ${blackoutStats.past} expired blackout date(s) older than today`
                  }
                  onClick={promptRemoveExpiredBlackouts}
                >
                  <Trash2 size={14} />
                  <span>Clear Expired ({blackoutStats.past})</span>
                </button>
              </div>
            </div>
          )}

          {/* BLACKOUT DATES CONTAINER */}
          <div className="visit-blackout-container">
            {draft.blackoutDates.length === 0 ? (
              <div className="visit-empty-box">
                <CheckCircle2 size={28} />
                <div className="visit-empty-text">
                  <strong>No blackout dates currently configured</strong>
                  <p>All open operating weekdays are available for physical visit bookings.</p>
                </div>
              </div>
            ) : processedBlackouts.length === 0 ? (
              <div className="visit-empty-box visit-empty-box--compact">
                <AlertCircle size={20} />
                <span>No blackout dates match your search or filter criteria.</span>
                <button
                  type="button"
                  className="visit-link-btn"
                  onClick={() => {
                    setBlackoutSearch("");
                    setBlackoutStatusFilter("all");
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                <div className="visit-blackout-grid">
                  {pagedBlackouts.map((item) => {
                    const originalIndex = draft.blackoutDates.findIndex((b) => b === item);
                    const itemStatus = getBlackoutDateStatus(item.date, todayISO);
                    const isPast = itemStatus === "past";
                    const isToday = itemStatus === "today";
                    const isEditing = editingBlackoutIndex === originalIndex;
                    const isEditDirty = isEditing && (
                      editBlackoutForm.date !== (item.date || "") ||
                      editBlackoutForm.reason !== (item.reason || "")
                    );

                    return (
                      <div
                        key={`${item.date}-${originalIndex}`}
                        className={`visit-blackout-item ${isPast ? "visit-blackout-item--past" : ""} ${
                          isToday ? "visit-blackout-item--today" : ""
                        } ${isEditing ? "visit-blackout-item--editing" : ""}`}
                      >
                        {isEditing ? (
                          <>
                            <div className="visit-blackout-item__left">
                              <span
                                className={`visit-blackout-badge visit-blackout-badge--${itemStatus}`}
                              >
                                {isPast ? "Past" : isToday ? "Today" : "Upcoming"}
                              </span>
                              <div className="visit-input-field visit-input-field--date">
                                <label>Date</label>
                                <input
                                  type="date"
                                  value={editBlackoutForm.date}
                                  onChange={(e) =>
                                    setEditBlackoutForm((prev) => ({
                                      ...prev,
                                      date: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>

                            <div className="visit-input-field visit-input-field--reason">
                              <label>Reason / Closure Note</label>
                              <input
                                type="text"
                                value={editBlackoutForm.reason}
                                placeholder="e.g. Regular Holiday, Building Maintenance"
                                onChange={(e) =>
                                  setEditBlackoutForm((prev) => ({
                                    ...prev,
                                    reason: e.target.value,
                                  }))
                                }
                                autoFocus
                              />
                            </div>

                            <div className="visit-blackout-item__actions">
                              <button
                                type="button"
                                className="res-icon-btn res-icon-btn--success"
                                onClick={() => saveEditBlackout(originalIndex)}
                                title="Save changes"
                                disabled={!editBlackoutForm.date || !isEditDirty}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                className="res-icon-btn res-icon-btn--secondary"
                                onClick={cancelEditBlackout}
                                title="Cancel editing"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="visit-blackout-item__left">
                              <span
                                className={`visit-blackout-badge visit-blackout-badge--${itemStatus}`}
                              >
                                {isPast ? "Past" : isToday ? "Today" : "Upcoming"}
                              </span>
                              <div className="visit-blackout-display-date">
                                <span className="visit-blackout-display-label">Date</span>
                                <span className="visit-blackout-display-value">
                                  {formatBlackoutDateDisplay(item.date)}
                                </span>
                              </div>
                            </div>

                            <div className="visit-blackout-display-reason">
                              <span className="visit-blackout-display-label">Reason / Closure Note</span>
                              <span className="visit-blackout-display-value">
                                {item.reason || <span className="visit-blackout-no-reason">No reason specified</span>}
                              </span>
                            </div>

                            <div className="visit-blackout-item__actions">
                              <button
                                type="button"
                                className="res-icon-btn res-icon-btn--secondary"
                                onClick={() => startEditBlackout(originalIndex, item)}
                                title="Edit blackout date"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="res-icon-btn res-icon-btn--danger"
                                onClick={() => promptRemoveBlackout(originalIndex, item)}
                                title="Remove blackout date"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* FIXED PAGINATION CONTROLS AT BOTTOM */}
                {processedBlackouts.length > 0 && (
                  <div className="visit-blackout-pagination">
                    <span className="visit-blackout-pagination-info">
                      Showing {(blackoutPage - 1) * BLACKOUT_PAGE_SIZE + 1}–
                      {Math.min(blackoutPage * BLACKOUT_PAGE_SIZE, processedBlackouts.length)} of{" "}
                      {processedBlackouts.length} blackout {processedBlackouts.length === 1 ? "date" : "dates"}
                    </span>
                    <div className="visit-blackout-pagination-controls">
                      <button
                        type="button"
                        className="visit-blackout-page-btn"
                        disabled={blackoutPage <= 1}
                        onClick={() => setBlackoutPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                      >
                        <ChevronLeft size={15} />
                        <span>Previous</span>
                      </button>
                      <span className="visit-blackout-page-num">
                        Page {blackoutPage} of {totalBlackoutPages}
                      </span>
                      <button
                        type="button"
                        className="visit-blackout-page-btn"
                        disabled={blackoutPage >= totalBlackoutPages}
                        onClick={() => setBlackoutPage((p) => Math.min(totalBlackoutPages, p + 1))}
                        title="Next Page"
                      >
                        <span>Next</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

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

      <AddBlackoutDateModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddBlackout={handleConfirmAddBlackout}
        existingBlackouts={draft.blackoutDates}
        isLoading={isSavingBlackout}
      />

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() =>
          setConfirmModal((previous) => ({ ...previous, open: false }))
        }
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText || "Delete"}
      />
    </div>
  );
}

export default VisitAvailabilityTab;
