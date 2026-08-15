import { useState, useEffect } from "react";
import { X, Info, Zap, Calendar, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import {
  useOpenUtilityPeriod,
  useCloseUtilityPeriod,
  useDeleteUtilityPeriod,
} from "../../../../shared/hooks/queries/useUtility";
import useBillingNotifier from "./shared/useBillingNotifier";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import {
  readMoveInDate,
  readMoveOutDate,
} from "../../../../shared/utils/lifecycleNaming";
import { fmtDate, fmtCurrency } from "../../utils/formatters";

const MAX_METER_READING = 999999.99;
const MAX_ELECTRICITY_RATE = 100.00;
const MAX_WATER_RATE = 100000.00;
const MAX_CYCLE_USAGE = 50000.00;

/** Sanitize numeric string to respect maximum decimal and whole digit lengths */
const sanitizeNumericInput = (val, maxDecimals = 2, maxWholeDigits = 6) => {
  if (!val) return "";
  let clean = String(val).replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length > 2) {
    clean = parts[0] + "." + parts.slice(1).join("");
  }
  const [whole, decimal] = clean.split(".");
  const limitedWhole = whole ? whole.slice(0, maxWholeDigits) : "";
  if (decimal !== undefined) {
    return `${limitedWhole}.${decimal.slice(0, maxDecimals)}`;
  }
  return limitedWhole;
};

const addDays = (dateStr, days = 1) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const get15th = () => {
  const d = new Date();
  d.setDate(15);
  return d.toISOString().slice(0, 10);
};

const addOneMonth = (fromDateStr) => {
  if (!fromDateStr) return "";
  const d = new Date(fromDateStr);
  if (Number.isNaN(d.getTime())) return "";
  const currentDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() !== currentDay) {
    d.setDate(0);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** Reusable token-aware focus handlers for inputs/selects */
const ringFocus = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = "var(--ring)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.outline = "none";
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = "";
    e.currentTarget.style.boxShadow = "";
    e.currentTarget.style.outline = "";
  },
};

export default function NewBillingPeriodModal({
  isOpen,
  onClose,
  utilityType,
  selectedRoomId,
  selectedPeriodId,
  openPeriodForRoom,
  lastClosedPeriod,
  latestReading,
  defaultRatePerUnit,
  roomBranch,
  roomName,
  activeTenantCount = 0,
  periods = [],
  onSuccess,
}) {
  useEscapeClose(isOpen, onClose);
  const notify = useBillingNotifier();

  const openPeriod = useOpenUtilityPeriod(utilityType);
  const closePeriod = useCloseUtilityPeriod(utilityType);
  const deletePeriod = useDeleteUtilityPeriod(utilityType);

  const [generationBlocker, setGenerationBlocker] = useState(null);
  const [periodForm, setPeriodForm] = useState({
    startDate: get15th(),
    startReading: "",
    ratePerUnit: defaultRatePerUnit || "",
    endReading: "",
    endDate: addOneMonth(get15th()),
  });

  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setPeriodForm((prev) => ({
      ...prev,
      startDate: newStart,
      endDate: addOneMonth(newStart) || prev.endDate,
    }));
  };

  useEffect(() => {
    if (isOpen) {
      const continuationDate = lastClosedPeriod?.endDate
        ? addDays(toInputDate(lastClosedPeriod.endDate), 1)
        : null;
      const continuationReading = lastClosedPeriod?.endReading ?? null;
      const startDate = continuationDate || toInputDate(new Date());
      const initialStartReading =
        continuationReading ?? latestReading?.reading ?? 0;
      setPeriodForm({
        startDate,
        startReading:
          initialStartReading !== undefined && initialStartReading !== null
            ? String(initialStartReading)
            : "0",
        ratePerUnit:
          lastClosedPeriod?.ratePerUnit != null
            ? String(lastClosedPeriod.ratePerUnit)
            : defaultRatePerUnit !== undefined &&
                defaultRatePerUnit !== null &&
                defaultRatePerUnit !== ""
              ? String(defaultRatePerUnit)
              : "",
        endReading: "",
        endDate: addOneMonth(startDate),
      });
      setGenerationBlocker(null);
    }
  }, [isOpen, defaultRatePerUnit, lastClosedPeriod, latestReading]);

  if (!isOpen) return null;

  const isFixedRateBranch = roomBranch === "guadalupe";

  // Determine source of start reading for UX contextual badge
  const startReadingSource =
    lastClosedPeriod?.endReading != null
      ? `Auto-filled from previous cycle (${lastClosedPeriod.endReading} kWh)`
      : latestReading?.reading != null
        ? `Pre-filled from latest room meter log (${latestReading.reading} kWh)`
        : "Baseline starting reading (0 kWh)";

  // Calculations for live calculation preview
  const isElectricity = utilityType === "electricity";
  const startNum = parseFloat(periodForm.startReading);
  const endNum = parseFloat(periodForm.endReading);
  const rateNum = parseFloat(periodForm.ratePerUnit);

  const maxRate = isElectricity ? MAX_ELECTRICITY_RATE : MAX_WATER_RATE;
  const isRateInvalid = !isNaN(rateNum) && (rateNum < 0 || rateNum > maxRate);
  const hasValidRate = !isNaN(rateNum) && rateNum >= 0 && rateNum <= maxRate;

  const isStartReadingExceedsMax = !isNaN(startNum) && startNum > MAX_METER_READING;
  const isEndReadingExceedsMax = !isNaN(endNum) && endNum > MAX_METER_READING;
  const isReadingLower =
    isElectricity && !isNaN(startNum) && !isNaN(endNum) && endNum < startNum;

  const hasValidReadings =
    !isNaN(startNum) &&
    !isNaN(endNum) &&
    endNum >= startNum &&
    !isStartReadingExceedsMax &&
    !isEndReadingExceedsMax;

  const isDateInvalid =
    periodForm.startDate &&
    periodForm.endDate &&
    new Date(periodForm.endDate) <= new Date(periodForm.startDate);

  // Date Overlap validation against existing periods in this room
  const isDateOverlapping = (periods || []).some((p) => {
    if (p.id === selectedPeriodId || p.status === "archived") return false;
    const pStart = toInputDate(p.startDate);
    const pEnd = toInputDate(p.endDate);
    if (!pStart || !pEnd) return false;
    return periodForm.startDate <= pEnd && periodForm.endDate >= pStart;
  });

  // Cycle duration in days
  const cycleDays =
    periodForm.startDate && periodForm.endDate && !isDateInvalid
      ? Math.max(
          1,
          Math.round(
            (new Date(periodForm.endDate) - new Date(periodForm.startDate)) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

  const calculatedUsage =
    isElectricity && hasValidReadings ? endNum - startNum : 0;
  const isUsageExceedsMax = calculatedUsage > MAX_CYCLE_USAGE;

  const estimatedTotalCost =
    isElectricity && hasValidReadings && hasValidRate
      ? calculatedUsage * rateNum
      : !isElectricity && hasValidRate
        ? rateNum
        : 0;

  const dailyBurnRate =
    isElectricity && hasValidReadings && cycleDays > 0
      ? calculatedUsage / cycleDays
      : 0;

  const tenantCount = Math.max(0, Number(activeTenantCount) || 0);
  const estPerTenantCost =
    tenantCount > 0 ? estimatedTotalCost / tenantCount : estimatedTotalCost;

  // Unbilled gap check: expected start is previous cycle end + 1 day
  const continuationDate = lastClosedPeriod?.endDate
    ? addDays(toInputDate(lastClosedPeriod.endDate), 1)
    : null;
  const hasUnbilledGap =
    continuationDate &&
    periodForm.startDate &&
    periodForm.startDate > continuationDate;
  const unbilledGapDays = hasUnbilledGap
    ? Math.round(
        (new Date(periodForm.startDate) - new Date(continuationDate)) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Real-life time (today) vs last closed bill
  const todayDateStr = toInputDate(new Date());
  const lastEndDateStr = lastClosedPeriod?.endDate
    ? toInputDate(lastClosedPeriod.endDate)
    : null;

  const daysAheadOrBehind = lastEndDateStr
    ? Math.round(
        (new Date(lastEndDateStr) - new Date(todayDateStr)) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Status A: Ahead of schedule (Advance Bill)
  const isAdvanceBill = Boolean(lastEndDateStr && daysAheadOrBehind > 0);

  // Status C: Behind schedule by > 35 days (Catch-up required)
  const isCatchUpRequired = Boolean(lastEndDateStr && daysAheadOrBehind < -35);
  const daysBehind = Math.abs(daysAheadOrBehind);

  // Anomaly checks
  const previousUsage = Number(lastClosedPeriod?.computedTotalUsage || 0);
  const isUsageSpike =
    isElectricity &&
    hasValidReadings &&
    !isUsageExceedsMax &&
    ((previousUsage > 0 && calculatedUsage > previousUsage * 2) ||
      dailyBurnRate > 35);

  const isFutureDate =
    Boolean(periodForm.endDate) &&
    new Date(periodForm.endDate) > new Date();

  const isAbnormalCycleLength = cycleDays > 0 && (cycleDays < 7 || cycleDays > 45);

  const buildGenerationBlocker = (error) => {
    const payload = error?.response?.data?.error || null;
    const message =
      payload?.message ||
      payload?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Unable to finalize billing cycle.";
    const details = payload?.details || null;
    const lines = [];

    const overlaps = details?.overlaps || [];
    if (Array.isArray(overlaps) && overlaps.length > 0) {
      for (const overlap of overlaps.slice(0, 5)) {
        lines.push(
          `Bed ${overlap.bedKey}: ${overlap.firstTenantName || "Tenant A"} overlaps ${overlap.secondTenantName || "Tenant B"}`,
        );
      }
    }

    const missingMoveIns = details?.missingMoveInReadings || [];
    const missingMoveOuts = details?.missingMoveOutReadings || [];
    if (Array.isArray(missingMoveIns) && missingMoveIns.length > 0) {
      for (const entry of missingMoveIns.slice(0, 5)) {
        lines.push(
          `Missing move-in reading: ${entry.tenantName || "Tenant"} (${fmtDate(readMoveInDate(entry)) || "date required"})`,
        );
      }
    }
    if (Array.isArray(missingMoveOuts) && missingMoveOuts.length > 0) {
      for (const entry of missingMoveOuts.slice(0, 5)) {
        lines.push(
          `Missing move-out reading: ${entry.tenantName || "Tenant"} (${fmtDate(readMoveOutDate(entry)) || "date required"})`,
        );
      }
    }

    return { message, lines };
  };

  const handleGenerateCycle = async () => {
    if (isFixedRateBranch) {
      return notify.warn("Guadalupe uses fixed-rate billing. Separate utility cycles cannot be generated for this branch.");
    }

    if (isDateOverlapping) {
      return notify.warn("Dates overlap with an existing billing cycle in this room.");
    }

    if (
      !periodForm.startDate ||
      !periodForm.endDate ||
      !periodForm.ratePerUnit ||
      (isElectricity && (!periodForm.startReading || !periodForm.endReading))
    ) {
      return notify.warn("All fields (dates, readings, and rate) are required.");
    }

    if (isRateInvalid) {
      return notify.warn(`Rate cannot be negative or exceed ₱${maxRate.toLocaleString()}.`);
    }

    if (isStartReadingExceedsMax || isEndReadingExceedsMax) {
      return notify.warn(`Meter readings cannot exceed ${MAX_METER_READING.toLocaleString()} kWh.`);
    }

    if (isUsageExceedsMax) {
      return notify.warn(`Calculated usage cannot exceed ${MAX_CYCLE_USAGE.toLocaleString()} kWh per cycle.`);
    }

    if (isReadingLower) {
      return notify.warn("Final reading cannot be lower than opening meter reading.");
    }

    if (isDateInvalid) {
      return notify.warn("Cycle end date must be after cycle start date.");
    }

    let newlyOpenedPeriodId = null;
    try {
      setGenerationBlocker(null);

      if (openPeriodForRoom) {
        if (selectedPeriodId === openPeriodForRoom.id) {
          onSuccess(null);
        }
        await deletePeriod.mutateAsync(openPeriodForRoom.id);
      }

      const openedData = await openPeriod.mutateAsync({
        roomId: selectedRoomId,
        startDate: periodForm.startDate,
        startReading:
          utilityType === "water" ? 0 : Number(periodForm.startReading),
        ratePerUnit: Number(periodForm.ratePerUnit),
      });

      const newPeriodId =
        openedData?.period?._id || openedData?.period?.id || openedData?.id;

      if (newPeriodId) {
        newlyOpenedPeriodId = newPeriodId;
        onSuccess(newPeriodId);
        await closePeriod.mutateAsync({
          periodId: newPeriodId,
          endReading:
            utilityType === "water" ? 0 : Number(periodForm.endReading),
          endDate: periodForm.endDate,
        });
        notify.success("Draft billing cycle created successfully. Ready for review.");
        setGenerationBlocker(null);
        onClose();
      } else {
        notify.success(
          "Billing period opened, but could not finalize automatically.",
        );
        onClose();
      }
    } catch (err) {
      if (newlyOpenedPeriodId) {
        try {
          await deletePeriod.mutateAsync(newlyOpenedPeriodId);
          if (selectedPeriodId === newlyOpenedPeriodId) {
            onSuccess(null);
          }
          notify.warn(
            "Cycle finalize failed, so the temporary open period was rolled back.",
          );
        } catch {
          // Keep primary error context
        }
      }
      setGenerationBlocker(buildGenerationBlocker(err));
      notify.error(err, "Failed to generate billing cycle.");
    }
  };

  const isPending = openPeriod.isPending || closePeriod.isPending;
  const isActionDisabled =
    isPending ||
    isReadingLower ||
    isDateInvalid ||
    isRateInvalid ||
    isStartReadingExceedsMax ||
    isEndReadingExceedsMax ||
    isUsageExceedsMax ||
    isFixedRateBranch ||
    isDateOverlapping;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "color-mix(in srgb, var(--background) 60%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
        style={{ boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              isElectricity ? "border-amber-500/30 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" : "border-blue-500/30 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            }`}>
              {isElectricity ? <Zap size={16} /> : <Sparkles size={16} />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                New {isElectricity ? "Electricity" : "Water"} Billing Period
              </h2>
              {roomName && (
                <p className="text-xs text-muted-foreground">
                  Room: <span className="font-medium text-foreground">{roomName}</span>
                  {tenantCount > 0 ? ` • ${tenantCount} active occupant${tenantCount > 1 ? "s" : ""}` : " • Vacant / 0 occupants"}
                </p>
              )}
            </div>
          </div>
          <button
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-card-foreground disabled:opacity-50"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3.5 px-6 py-4 max-h-[calc(85vh-130px)] overflow-y-auto">
          {/* Fixed rate branch warning */}
          {isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Fixed-Rate Branch (Guadalupe):</span> Separate sub-metered utility billing cycles are not used for rooms in this branch.
              </div>
            </div>
          )}

          {/* Error blocker */}
          {generationBlocker && !isFixedRateBranch && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{generationBlocker.message}</span>
              </div>
              {generationBlocker.lines.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 mt-1 text-muted-foreground">
                  {generationBlocker.lines.map((line, idx) => (
                    <li key={`${line}-${idx}`}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Date Overlap Error Notice */}
          {isDateOverlapping && !isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-medium">Date Overlap:</span> The selected date range overlaps with an existing cycle in this room. Please adjust dates.
              </div>
            </div>
          )}

          {/* Advance Bill Notice (when last bill ends after today) */}
          {isAdvanceBill && !isDateOverlapping && !isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Advance Bill:</span> Room is already billed through <span className="font-medium text-foreground">{fmtDate(lastClosedPeriod.endDate)}</span>. This creates an advance bill for <span className="font-medium text-foreground">{fmtDate(periodForm.startDate)} – {fmtDate(periodForm.endDate)}</span>.
              </div>
            </div>
          )}

          {/* Catch-Up Cycle Notice (when last bill was > 35 days ago) */}
          {isCatchUpRequired && !isDateOverlapping && !isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Catch-Up Cycle:</span> Room was last billed through <span className="font-medium text-foreground">{fmtDate(lastClosedPeriod.endDate)}</span> ({daysBehind} days ago). Generating this cycle will cover <span className="font-medium text-foreground">{fmtDate(periodForm.startDate)} – {fmtDate(periodForm.endDate)}</span> to help bring the room up to date.
              </div>
            </div>
          )}

          {/* Unbilled Gap Warning */}
          {hasUnbilledGap && !isDateOverlapping && !isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Unbilled Gap:</span> Previous cycle ended on <span className="font-medium text-foreground">{fmtDate(lastClosedPeriod.endDate)}</span>. Starting on <span className="font-medium text-foreground">{fmtDate(periodForm.startDate)}</span> leaves a {unbilledGapDays}-day gap.
              </div>
            </div>
          )}

          {/* Usage Anomaly Notice */}
          {isUsageSpike && !isDateOverlapping && !isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Usage Anomaly:</span> {calculatedUsage.toLocaleString()} kWh is higher than usual
                {previousUsage > 0 ? ` (previous cycle: ${previousUsage.toLocaleString()} kWh)` : ""}.
                {dailyBurnRate > 35 ? ` Rate is ~${dailyBurnRate.toFixed(1)} kWh/day.` : ""}
                {" "}Please confirm final meter digits.
              </div>
            </div>
          )}

          {/* Future Date Informative Notice */}
          {isFutureDate && !isAdvanceBill && !isDateOverlapping && !isFixedRateBranch && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Future Date:</span> Cycle end date is after today. Ensure readings reflect scheduled values.
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Define the billing cycle duration, meter readings, and rate to compute draft utility charges for all active room occupants.
          </p>

          {/* Dates + Rate row */}
          <div className="grid gap-3.5 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Calendar size={12} /> Cycle Start
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none disabled:opacity-60"
                {...ringFocus}
                value={periodForm.startDate}
                onChange={handleStartDateChange}
                disabled={isPending || isFixedRateBranch}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Calendar size={12} /> Cycle End
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none disabled:opacity-60"
                {...ringFocus}
                value={periodForm.endDate}
                onChange={(e) =>
                  setPeriodForm({ ...periodForm, endDate: e.target.value })
                }
                disabled={isPending || isFixedRateBranch}
              />
              {isDateInvalid && !isFixedRateBranch ? (
                <p className="text-[11px] font-medium text-red-500">
                  Must be after cycle start
                </p>
              ) : isAbnormalCycleLength && !isFixedRateBranch ? (
                <p className="text-[11px] text-muted-foreground">
                  {cycleDays} days duration
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">
                  {utilityType === "water"
                    ? "Total Water (PHP)"
                    : `Rate (PHP/${isElectricity ? "kWh" : "cu.m."})`}
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Max: ₱{maxRate.toLocaleString()}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                className={`w-full rounded-lg border px-3 py-2 text-sm text-card-foreground focus:outline-none disabled:opacity-60 ${
                  isRateInvalid && !isFixedRateBranch ? "border-red-500" : "border-border bg-card"
                }`}
                {...ringFocus}
                value={periodForm.ratePerUnit}
                onChange={(e) =>
                  setPeriodForm({
                    ...periodForm,
                    ratePerUnit: sanitizeNumericInput(
                      e.target.value,
                      2,
                      isElectricity ? 3 : 6,
                    ),
                  })
                }
                placeholder="e.g. 16.00"
                disabled={isPending || isFixedRateBranch}
              />
              {isRateInvalid && !isFixedRateBranch && (
                <p className="text-[11px] font-medium text-red-500">
                  Rate cannot exceed ₱{maxRate.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Meter readings — electricity only */}
          {isElectricity ? (
            <div className="space-y-3">
              <div className="grid gap-3.5 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Opening Meter Reading (kWh)
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Max: 999,999.99
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-card-foreground focus:outline-none disabled:opacity-60 ${
                      isStartReadingExceedsMax && !isFixedRateBranch ? "border-red-500" : "border-border bg-card"
                    }`}
                    {...ringFocus}
                    value={periodForm.startReading}
                    onChange={(e) =>
                      setPeriodForm({
                        ...periodForm,
                        startReading: sanitizeNumericInput(e.target.value, 2, 6),
                      })
                    }
                    placeholder={
                      latestReading?.reading != null
                        ? `Last: ${latestReading.reading}`
                        : "e.g. 1200"
                    }
                    disabled={isPending || isFixedRateBranch}
                  />
                  {isStartReadingExceedsMax && !isFixedRateBranch ? (
                    <p className="text-[11px] font-medium text-red-500 mt-1">
                      Reading cannot exceed 999,999.99 kWh
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                      <Info size={12} className="shrink-0 text-blue-500" />
                      <span className="truncate">{startReadingSource}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Final Reading (kWh)
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Max: 999,999.99
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-card-foreground focus:outline-none disabled:opacity-60 ${
                      (isReadingLower || isEndReadingExceedsMax || isUsageExceedsMax) && !isFixedRateBranch
                        ? "border-red-500"
                        : "border-border bg-card"
                    }`}
                    {...ringFocus}
                    value={periodForm.endReading}
                    onChange={(e) =>
                      setPeriodForm({
                        ...periodForm,
                        endReading: sanitizeNumericInput(e.target.value, 2, 6),
                      })
                    }
                    placeholder="e.g. 1350"
                    disabled={isPending || isFixedRateBranch}
                  />
                  {isEndReadingExceedsMax && !isFixedRateBranch ? (
                    <p className="text-[11px] font-medium text-red-500 mt-1">
                      Reading cannot exceed 999,999.99 kWh
                    </p>
                  ) : isReadingLower && !isFixedRateBranch ? (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-red-500 mt-1">
                      <AlertCircle size={12} />
                      <span>Cannot be lower than opening reading ({periodForm.startReading})</span>
                    </div>
                  ) : isUsageExceedsMax && !isFixedRateBranch ? (
                    <p className="text-[11px] font-medium text-red-500 mt-1">
                      Usage (+{calculatedUsage.toLocaleString()} kWh) exceeds max limit of 50,000 kWh
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Current meter reading at cycle end
                    </p>
                  )}
                </div>
              </div>

              {/* Enhanced Live Calculation Preview Card */}
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2.5">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-foreground">
                    Live Cycle Calculation Preview
                  </span>
                  {hasValidReadings && !isFixedRateBranch && !isDateOverlapping && !isUsageExceedsMax && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                      <Zap size={12} /> Ready to compute
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-card border border-border p-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Total Usage</div>
                    <div className="text-sm font-bold text-foreground mt-0.5">
                      {hasValidReadings && !isFixedRateBranch ? `${calculatedUsage.toLocaleString()} kWh` : "—"}
                    </div>
                    {cycleDays > 0 && hasValidReadings && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        ~{dailyBurnRate.toFixed(1)} kWh/day
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg bg-card border border-border p-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Rate</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {hasValidRate && !isFixedRateBranch ? `₱${rateNum.toFixed(2)}/kWh` : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {cycleDays > 0 ? `${cycleDays} days cycle` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Est. Room Total</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {hasValidReadings && hasValidRate && !isFixedRateBranch && !isUsageExceedsMax
                        ? fmtCurrency(estimatedTotalCost)
                        : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Full room charge
                    </div>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Est. Per Occupant</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                      {hasValidReadings && hasValidRate && !isFixedRateBranch && !isUsageExceedsMax
                        ? tenantCount > 0
                          ? fmtCurrency(estPerTenantCost)
                          : "₱0.00 (Overhead)"
                        : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {tenantCount > 0 ? `${tenantCount} active occupant${tenantCount > 1 ? "s" : ""}` : "Vacant room"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-lg px-4 py-3 text-xs"
                style={{
                  background: "var(--muted)",
                  color: "var(--muted-foreground)",
                }}
              >
                Water billing uses room occupancy overlap. Enter the total water
                charge above and the billing engine will split it by covered calendar days for all active occupants.
              </div>

              {/* Enhanced Live Preview for Water */}
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2.5">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-foreground">
                    Water Billing Summary
                  </span>
                  {cycleDays > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {cycleDays} days duration
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-card border border-border p-2.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Total Water Charge</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {hasValidRate && !isFixedRateBranch ? fmtCurrency(rateNum) : "₱0.00"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-2.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Est. Per Occupant</div>
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                      {hasValidRate && !isFixedRateBranch
                        ? tenantCount > 0
                          ? fmtCurrency(rateNum / tenantCount)
                          : "₱0.00 (Overhead)"
                        : "₱0.00"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3.5 bg-muted/20">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Creates draft records for admin review before dispatch.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <div className="relative inline-block group">
              <button
                onClick={handleGenerateCycle}
                disabled={isActionDisabled}
                className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                {isPending ? "Calculating..." : "Generate Draft Bills"}
              </button>
              {isActionDisabled && !isPending && (
                <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 w-72 rounded-lg bg-slate-900 p-2.5 text-xs text-white shadow-xl dark:bg-slate-800 dark:text-slate-100 border border-slate-700">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                    <AlertCircle size={13} /> Action Disabled
                  </div>
                  <div>
                    {isFixedRateBranch
                      ? "Guadalupe uses fixed-rate billing. Separate utility cycles cannot be generated for this branch."
                      : isDateOverlapping
                      ? "The selected date range overlaps with an existing cycle in this room."
                      : isStartReadingExceedsMax || isEndReadingExceedsMax
                      ? `Meter readings cannot exceed ${MAX_METER_READING.toLocaleString()} kWh.`
                      : isUsageExceedsMax
                      ? `Usage exceeds maximum single-cycle limit of ${MAX_CYCLE_USAGE.toLocaleString()} kWh.`
                      : isReadingLower
                      ? "Final meter reading cannot be lower than opening reading."
                      : isDateInvalid
                      ? "Cycle end date must be after cycle start date."
                      : isRateInvalid
                      ? `Rate cannot exceed ₱${maxRate.toLocaleString()}.`
                      : "Please fill in all required fields."}
                  </div>
                  <div className="absolute top-full right-6 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}