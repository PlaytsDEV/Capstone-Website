import { useEffect, useState } from "react";
import { Coins, Save } from "lucide-react";
import { showNotification } from "../../../../../shared/utils/notification";
import { useUpdateMaintenanceCost } from "../../../../../shared/hooks/queries/useMaintenance";
import { getMaintenanceApiErrorMessage, sanitizeAmountInput } from "../maintenanceUtils";

export function CostAttributionCard({ request }) {
  const updateCostMutation = useUpdateMaintenanceCost();

  const [laborCost, setLaborCost] = useState(
    request?.costBreakdown?.laborCost !== undefined ? String(request.costBreakdown.laborCost) : "0",
  );
  const [materialsCost, setMaterialsCost] = useState(
    request?.costBreakdown?.materialsCost !== undefined ? String(request.costBreakdown.materialsCost) : "0",
  );
  const [isTenantChargeable, setIsTenantChargeable] = useState(
    Boolean(request?.costBreakdown?.isTenantChargeable),
  );
  const [chargeReason, setChargeReason] = useState(
    request?.costBreakdown?.chargeReason || "",
  );

  useEffect(() => {
    if (request) {
      setLaborCost(
        request?.costBreakdown?.laborCost !== undefined ? String(request.costBreakdown.laborCost) : "0",
      );
      setMaterialsCost(
        request?.costBreakdown?.materialsCost !== undefined ? String(request.costBreakdown.materialsCost) : "0",
      );
      setIsTenantChargeable(Boolean(request?.costBreakdown?.isTenantChargeable));
      setChargeReason(request?.costBreakdown?.chargeReason || "");
    }
  }, [request]);

  const numLabor = Math.max(0, Number(laborCost) || 0);
  const numMaterials = Math.max(0, Number(materialsCost) || 0);
  const totalCost = numLabor + numMaterials;

  const handleSaveCost = async () => {
    try {
      await updateCostMutation.mutateAsync({
        requestId: request.request_id,
        payload: {
          laborCost: numLabor,
          materialsCost: numMaterials,
          isTenantChargeable,
          chargeReason: isTenantChargeable ? chargeReason.trim() : null,
        },
      });

      showNotification({
        title: "Cost Saved",
        message: `Maintenance cost recorded at PHP ${totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Save Failed",
        message: getMaintenanceApiErrorMessage(err, "Failed to save cost details"),
        type: "error",
      });
    }
  };

  const hasChanges =
    numLabor !== Number(request?.costBreakdown?.laborCost || 0) ||
    numMaterials !== Number(request?.costBreakdown?.materialsCost || 0) ||
    isTenantChargeable !== Boolean(request?.costBreakdown?.isTenantChargeable) ||
    chargeReason.trim() !== String(request?.costBreakdown?.chargeReason || "").trim();

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Coins size={15} className="text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Cost & Attribution
          </h3>
        </div>
        <span className="rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Admin Only
        </span>
      </div>

      {/* 3-Column Financial Grid */}
      <div className="grid grid-cols-3 gap-2.5 items-end">
        {/* Labor Cost */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Labor Cost
          </label>
          <div className="relative rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs font-bold text-slate-400">
              ₱
            </span>
            <input
              type="text"
              value={laborCost}
              onChange={(e) => setLaborCost(sanitizeAmountInput(e.target.value))}
              placeholder="0.00"
              className="h-9 w-full rounded-lg bg-transparent pl-6 pr-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Materials Cost */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Materials Cost
          </label>
          <div className="relative rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs font-bold text-slate-400">
              ₱
            </span>
            <input
              type="text"
              value={materialsCost}
              onChange={(e) => setMaterialsCost(sanitizeAmountInput(e.target.value))}
              placeholder="0.00"
              className="h-9 w-full rounded-lg bg-transparent pl-6 pr-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Total Expense */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Total Expense
          </label>
          <div className="flex h-9 items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Total</span>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate">
              PHP {totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Resident Damage Attribution Box */}
      <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
            <input
              type="checkbox"
              checked={isTenantChargeable}
              onChange={(e) => setIsTenantChargeable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-primary cursor-pointer shrink-0"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
              Charge to resident (Tenant Damage)
            </span>
          </label>

          <button
            type="button"
            onClick={handleSaveCost}
            disabled={!hasChanges || updateCostMutation.isPending}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
          >
            <Save size={12} />
            <span>{updateCostMutation.isPending ? "Saving..." : "Save Cost"}</span>
          </button>
        </div>

        {isTenantChargeable && (
          <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Reason for resident damage charge
            </label>
            <input
              type="text"
              value={chargeReason}
              onChange={(e) => setChargeReason(e.target.value)}
              placeholder="e.g. Fixture broken due to resident misuse"
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition"
            />
          </div>
        )}
      </div>
    </div>
  );
}
