import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, LoaderCircle, X } from "lucide-react";
import { useCloseUtilityPeriod } from "../../../../shared/hooks/queries/useUtility";
import useBillingNotifier from "./shared/useBillingNotifier";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { toInputDate } from "./utility/utilityConstants";

const finiteNonNegative = (value) =>
  value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

export default function CloseCurrentPeriodModal({
  isOpen,
  onClose,
  utilityType,
  period,
  roomName,
  latestReading,
  onSuccess,
}) {
  const notify = useBillingNotifier();
  const closePeriod = useCloseUtilityPeriod(utilityType);
  const isElectricity = utilityType === "electricity";
  const [form, setForm] = useState({ endDate: "", endReading: "" });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      endDate: toInputDate(new Date()),
      endReading: String(latestReading?.reading ?? period?.startReading ?? ""),
    });
  }, [isOpen, latestReading, period]);

  useEscapeClose(isOpen, onClose);
  if (!isOpen || !period || typeof document === "undefined") return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.endDate) return notify.warn("Closing date is required.");
    if (isElectricity && !finiteNonNegative(form.endReading)) {
      return notify.warn("Closing meter reading must be finite and non-negative.");
    }
    try {
      const response = await closePeriod.mutateAsync({
        periodId: period.id || period._id,
        endDate: form.endDate,
        endReading: isElectricity ? Number(form.endReading) : 0,
      });
      notify.success(
        response?.result?.nextPeriodId
          ? "Period closed. Occupancy continues, so the next period was opened from the verified closing reading."
          : "Period closed. The room is vacant, so no new active period was needed.",
      );
      onSuccess?.(response?.result?.nextPeriodId || response?.result?.nextPeriod?.id || null);
      onClose();
    } catch (error) {
      notify.error(error, "Unable to close the current period.");
    }
  };

  const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <form className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground"><CalendarCheck size={17} /> Close Current Period</h3>
            <p className="mt-1 text-xs text-muted-foreground">{roomName}. Occupied rooms continue from this reading; vacant rooms remain without an active period until the next move-in.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            Opening: {period.startReading ?? "—"} {isElectricity ? "kWh" : ""} · Rate: ₱{Number(period.ratePerUnit || 0).toFixed(2)}
          </div>
          <label className="text-xs font-semibold text-foreground">Closing date
            <input className={inputClass} type="date" value={form.endDate} min={toInputDate(period.startDate)} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required />
          </label>
          {isElectricity ? <label className="text-xs font-semibold text-foreground">Physical closing reading (kWh)
            <input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal" value={form.endReading} onChange={(event) => setForm((current) => ({ ...current, endReading: event.target.value }))} required />
          </label> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={closePeriod.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#0A1628] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {closePeriod.isPending ? <LoaderCircle size={15} className="animate-spin" /> : null} Close Period
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
